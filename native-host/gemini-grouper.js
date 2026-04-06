#!/usr/bin/env node
/**
 * gemini-grouper.js — Standalone Gemini-powered tab grouper
 *
 * Run OUTSIDE Claude Code sessions (port 9876 must be free).
 *
 * Usage:
 *   GEMINI_API_KEY=... node gemini-grouper.js intent
 *   GEMINI_API_KEY=... node gemini-grouper.js context --context "frontend dev, sprint 12"
 *   GEMINI_API_KEY=... node gemini-grouper.js priority
 *   GEMINI_API_KEY=... node gemini-grouper.js domain
 */

const net = require('net');
const { GoogleGenAI, Type } = require('@google/genai');

const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '9876');
const STRATEGY = process.argv[2] || 'intent';
const ctxIdx = process.argv.indexOf('--context');
const USER_CONTEXT = ctxIdx !== -1 ? process.argv[ctxIdx + 1] : null;

const VALID_STRATEGIES = ['intent', 'context', 'priority', 'domain'];
const VALID_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];

// ── PORT CHECK ───────────────────────────────────────────────────────────────

function checkPortFree() {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(
          `Port ${PORT} is already in use.\n` +
          `The MCP server (Claude Code) is likely running. Stop it first:\n` +
          `  1. Close Claude Code, or\n` +
          `  2. Run: kill $(lsof -ti :${PORT})`
        ));
      } else {
        reject(err);
      }
    });
    tester.once('listening', () => tester.close(resolve));
    tester.listen(PORT);
  });
}

// ── JSON SCHEMA ──────────────────────────────────────────────────────────────

const GROUP_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    groups: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Short group name, 2–4 words'
          },
          color: {
            type: Type.STRING,
            enum: VALID_COLORS
          },
          tabIds: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: 'Tab IDs to include in this group'
          }
        },
        required: ['title', 'color', 'tabIds']
      }
    }
  },
  required: ['groups']
};

// ── PROMPTS ──────────────────────────────────────────────────────────────────

function buildPrompt(strategy, snapshot, userContext) {
  const allTabs = [
    ...snapshot.groups.flatMap(g => g.tabs),
    ...snapshot.ungrouped
  ];

  const tabsJson = JSON.stringify(
    allTabs.map(t => ({ id: t.id, url: t.url, title: t.title })),
    null,
    2
  );

  const base = `Here are the user's open Chrome tabs:\n${tabsJson}\n\n`;

  switch (strategy) {
    case 'intent':
      return base + `Group these tabs by user intent using two passes.

Pass 1 — Clustering: For each tab, infer what the user was trying to accomplish (not what the content is about). Look at the URL, title, and domain together. Assign each tab to a task cluster (e.g. "Planning Vietnam trip", "Debugging RabbitMQ issue", "Job search — backend roles").

Pass 2 — Naming: Review each cluster's actual content and write a concise group name (2–4 words) that captures the user's goal, not the content type. Choose a fitting color from: ${VALID_COLORS.join(', ')}.

Collect any remaining tabs that don't fit a clear intent cluster into an "Archive" group (grey color). Every tab must end up in a group — none left ungrouped. Each named group should have at least 2 tabs; Archive may have 1.`;

    case 'context':
      return base + `The user describes their current work as: "${userContext}"

Map each tab to the user's real tasks, projects, or concerns described in the context. Avoid generic categories like "Social Media" or "Documentation" — group by what matters to this specific user right now. Use group names that match vocabulary from the user's own context description. Collect any tabs that don't map to the stated context into an "Archive" group (grey). Every tab must end up in a group — none left ungrouped.`;

    case 'priority':
      return base + `Organise tabs into groups with priority levels:
- "active" (green): currently in use, directly needed right now
- "background" (blue): reference material, return later
- "archive" (grey): stale or done

Always create an "Archive" group (grey) for stale/done tabs. Every tab must end up in a group — none left ungrouped.`;

    case 'domain':
      return base + `Cluster tabs using a graph-based similarity approach.

Step 1 — Build similarity graph: each tab is a node. Draw edges between tabs that share two or more signals: same domain, same subdomain, overlapping URL path prefix, or related keywords in titles. Weight edges by number of shared signals.

Step 2 — Find communities: identify clusters of tabs that are densely connected (multiple shared signals). Isolated nodes with no strong similarity to others can remain ungrouped.

Step 3 — Name each community from its dominant signal (e.g. "github.com/myrepo — PR review", "docs.stripe.com — integration"). Choose a fitting color from: ${VALID_COLORS.join(', ')}.

Collect any truly isolated tabs with no cluster fit into an "Archive" group (grey). Every tab must end up in a group — none left ungrouped.`;
  }
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

async function waitForExtension(TabGroups, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await TabGroups.list();
      return;
    } catch (e) {
      if (!e.message.includes('Extension not connected')) throw e;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error(
    'Chrome extension did not connect within 15s.\n' +
    'Make sure the extension is loaded and enabled at chrome://extensions'
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  // Validate args before starting the server
  if (!VALID_STRATEGIES.includes(STRATEGY)) {
    console.error(`Error: Unknown strategy "${STRATEGY}". Valid: ${VALID_STRATEGIES.join(', ')}`);
    process.exit(1);
  }

  if (STRATEGY === 'context' && !USER_CONTEXT) {
    console.error('Error: --context "your role/project" is required for the context strategy.');
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is not set.');
    process.exit(1);
  }

  let shutdown = () => {};

  try {
    // Check port before starting the WebSocket server
    await checkPortFree();

    // Lazy-require server to avoid starting it until we've validated everything
    const server = require('./server');
    shutdown = server.shutdown;
    const { TabGroups } = server;

    process.stdout.write('Waiting for Chrome extension... ');
    await waitForExtension(TabGroups);
    console.log('connected.');

    const snapshot = await TabGroups.snapshot();
    const totalTabs =
      snapshot.groups.reduce((n, g) => n + g.tabs.length, 0) +
      snapshot.ungrouped.length;

    if (totalTabs === 0) {
      console.log('No open tabs found.');
      shutdown();
      process.exit(0);
    }

    console.log(`Analysing ${totalTabs} tabs with Gemini (${STRATEGY})...`);

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildPrompt(STRATEGY, snapshot, USER_CONTEXT),
      config: {
        responseMimeType: 'application/json',
        responseSchema: GROUP_SCHEMA
      }
    });

    const { groups } = JSON.parse(response.text);

    if (!groups?.length) {
      console.log('No groups to create.');
      shutdown();
      process.exit(0);
    }

    console.log('');
    for (const group of groups) {
      await TabGroups.create({ title: group.title, color: group.color, tabIds: group.tabIds });
      console.log(`  ✓  ${group.title}  (${group.tabIds.length} tabs · ${group.color})`);
    }

    console.log(`\nDone — created ${groups.length} group${groups.length !== 1 ? 's' : ''}.`);
    shutdown();
    process.exit(0);
  } catch (err) {
    console.error('\nError:', err.message);
    shutdown();
    process.exit(1);
  }
}

main();
