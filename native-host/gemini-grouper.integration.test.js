/**
 * Full integration test for gemini-grouper.js
 *
 * - Spawns gemini-grouper.js as a subprocess (real process, real Gemini API call)
 * - Connects a fake Chrome extension that returns synthetic tab data over WebSocket
 * - Each test uses a unique free port to avoid conflicts with each other and
 *   with the real Chrome extension (which auto-connects to port 9876)
 * - Asserts exit code 0 and that groups were created from the correct tab IDs
 *
 * Requirements:
 *   GEMINI_API_KEY must be set in the environment (or loaded from ../.env).
 *
 * Run:
 *   cd native-host && npm test
 */

'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const { WebSocket } = require('ws');

// ── Fake tab data ─────────────────────────────────────────────────────────────

const FAKE_TABS = [
  { id: 1, url: 'https://github.com/anthropics/claude-code', title: 'claude-code · GitHub' },
  { id: 2, url: 'https://github.com/anthropics/anthropic-sdk-python', title: 'anthropic-sdk-python · GitHub' },
  { id: 3, url: 'https://docs.anthropic.com/claude/reference', title: 'API Reference · Anthropic' },
  { id: 4, url: 'https://console.anthropic.com/workbench', title: 'Workbench · Anthropic Console' },
  { id: 5, url: 'https://news.ycombinator.com', title: 'Hacker News' },
  { id: 6, url: 'https://news.ycombinator.com/item?id=39958420', title: 'Ask HN: Best practices for LLM evals | Hacker News' },
  { id: 7, url: 'https://linear.app/myteam/issue/ENG-42', title: 'ENG-42: Fix tab grouper edge case · Linear' },
  { id: 8, url: 'https://linear.app/myteam/project/q2-roadmap', title: 'Q2 Roadmap · Linear' },
];

const FAKE_SNAPSHOT = { groups: [], ungrouped: FAKE_TABS };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find a free TCP port by letting the OS assign one. */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/** Connect a WebSocket client with retry (server may not be up immediately). */
async function connectWithRetry(url, { retries = 20, delayMs = 300 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      return await new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.once('open', () => resolve(ws));
        ws.once('error', reject);
      });
    } catch {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error(`Could not connect to ${url} after ${retries} retries`);
}

/**
 * Spawn gemini-grouper.js on a dedicated free port, attach a fake extension,
 * and return { code, stdout, stderr, createdGroups } when the process exits.
 *
 * @param {string[]} args  - CLI args after the script name (e.g. ['intent'])
 */
async function runGrouper(args) {
  const port = await getFreePort();

  return new Promise((resolve, reject) => {
    const createdGroups = [];
    let stdout = '';
    let stderr = '';

    const child = spawn(
      process.execPath,
      [path.join(__dirname, 'gemini-grouper.js'), ...args, `--port=${port}`],
      { env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    // Connect fake extension once the server is ready
    connectWithRetry(`ws://localhost:${port}`)
      .then(ws => {
        ws.send(JSON.stringify({ event: 'connected', version: '1.0-test' }));

        ws.on('message', raw => {
          let msg;
          try { msg = JSON.parse(raw); } catch { return; }

          const { id, cmd, params } = msg;

          switch (cmd) {
            case 'groups.list':
              ws.send(JSON.stringify({ id, data: [] }));
              break;

            case 'snapshot':
              ws.send(JSON.stringify({ id, data: FAKE_SNAPSHOT }));
              break;

            case 'groups.create': {
              const { title, color, tabIds } = params;
              createdGroups.push({ title, color, tabIds });
              ws.send(JSON.stringify({ id, data: { id: createdGroups.length * 100, title, color } }));
              break;
            }

            default:
              ws.send(JSON.stringify({ id, data: null }));
          }
        });

        ws.on('error', err => {
          if (!['ECONNRESET', 'ECONNREFUSED'].includes(err.code)) reject(err);
        });
      })
      .catch(reject);

    child.on('close', code => resolve({ code, stdout, stderr, createdGroups }));
    child.on('error', reject);

    // Safety net — Gemini calls should finish well within 60s
    setTimeout(() => {
      child.kill();
      reject(new Error(`gemini-grouper timed out after 60s\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, 60_000);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const ALL_TAB_IDS = new Set(FAKE_TABS.map(t => t.id));
const VALID_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];

before(() => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set — cannot run integration tests');
  }
});

// ── intent (run once, shared across the 4 property checks) ───────────────────

test('intent strategy — exits 0 and creates at least one group', async () => {
  const { code, stdout, createdGroups, stderr } = await runGrouper(['intent']);

  assert.equal(code, 0, `Expected exit 0, got ${code}\nstderr: ${stderr}`);
  assert.ok(createdGroups.length > 0, 'Expected at least one group to be created');
  assert.match(stdout, /Done — created \d+ group/);
});

test('intent strategy — all tab IDs in groups come from fake tabs', async () => {
  const { code, createdGroups, stderr } = await runGrouper(['intent']);

  assert.equal(code, 0, `stderr: ${stderr}`);
  for (const group of createdGroups) {
    for (const id of group.tabIds) {
      assert.ok(ALL_TAB_IDS.has(id), `Unknown tab ID ${id} in group "${group.title}"`);
    }
  }
});

test('intent strategy — no tab ID appears in more than one group', async () => {
  const { createdGroups } = await runGrouper(['intent']);

  const seen = new Set();
  for (const group of createdGroups) {
    for (const id of group.tabIds) {
      assert.ok(!seen.has(id), `Tab ID ${id} appears in multiple groups`);
      seen.add(id);
    }
  }
});

test('intent strategy — each group has at least 2 tabs', async () => {
  const { createdGroups } = await runGrouper(['intent']);

  for (const group of createdGroups) {
    assert.ok(group.tabIds.length >= 2, `Group "${group.title}" has only ${group.tabIds.length} tab(s)`);
  }
});

test('intent strategy — colors are valid', async () => {
  const { createdGroups } = await runGrouper(['intent']);

  for (const group of createdGroups) {
    assert.ok(VALID_COLORS.includes(group.color), `Invalid color "${group.color}" in group "${group.title}"`);
  }
});

// ── other strategies ──────────────────────────────────────────────────────────

test('domain strategy — exits 0 and creates groups', async () => {
  const { code, createdGroups, stderr } = await runGrouper(['domain']);

  assert.equal(code, 0, `stderr: ${stderr}`);
  assert.ok(createdGroups.length > 0);
});

test('priority strategy — creates exactly 3 groups (active/background/archive)', async () => {
  const { code, createdGroups, stderr } = await runGrouper(['priority']);

  assert.equal(code, 0, `stderr: ${stderr}`);
  assert.equal(createdGroups.length, 3, `Expected 3 groups, got ${createdGroups.length}`);

  const titles = createdGroups.map(g => g.title.toLowerCase());
  assert.ok(titles.some(t => t.includes('active')), 'Missing "active" group');
  assert.ok(titles.some(t => t.includes('background')), 'Missing "background" group');
  assert.ok(titles.some(t => t.includes('archive')), 'Missing "archive" group');
});

test('context strategy — exits 0 and creates groups', async () => {
  const { code, createdGroups, stderr } = await runGrouper(['context', '--context', 'Anthropic API development']);

  assert.equal(code, 0, `stderr: ${stderr}`);
  assert.ok(createdGroups.length > 0);
});

// ── error cases (fast, no Gemini call) ───────────────────────────────────────

test('invalid strategy — exits non-zero without calling Gemini', async () => {
  const { code, stderr } = await runGrouper(['bogus']);

  assert.notEqual(code, 0);
  assert.match(stderr, /Unknown strategy/);
});

test('missing API key — exits non-zero', async () => {
  const port = await getFreePort();
  const { code, stderr } = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, 'gemini-grouper.js'), 'intent', `--port=${port}`],
      { env: { ...process.env, GEMINI_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => resolve({ code, stderr }));
    child.on('error', reject);
  });

  assert.notEqual(code, 0);
  assert.match(stderr, /GEMINI_API_KEY/);
});
