#!/usr/bin/env node
/**
 * SessionStart hook: MCP bridge connectivity check.
 *
 * Verifies port 9876 is reachable (WebSocket bridge running).
 * Outputs additionalContext so Claude Code sees the status at session start.
 *
 * Manual usage: node .claude/hooks/check_mcp_bridge.js
 */

const net = require('net');

const PORT = 9876;
const HOST = '127.0.0.1';
const TIMEOUT_MS = 2000;

function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const done = (ok, reason) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ ok, reason });
    };

    socket.setTimeout(TIMEOUT_MS);
    socket.on('connect', () => done(true, null));
    socket.on('timeout', () => done(false, `Timeout after ${TIMEOUT_MS}ms`));
    socket.on('error', (err) => done(false, err.message));
    socket.connect(port, host);
  });
}

async function main() {
  // Consume stdin (required by Claude Code hook protocol)
  await new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', resolve);
    process.stdin.on('error', resolve);
    // Don't block if stdin doesn't close
    setTimeout(resolve, 200);
  });

  const result = await checkPort(HOST, PORT);

  let contextLines;
  if (result.ok) {
    contextLines = [
      'MCP STATUS: BRIDGE UP',
      `WebSocket bridge is running on port ${PORT}.`,
      'MCP tools (tab_snapshot, tab_groups_list, etc.) should be available.',
      'If tools return "Extension not connected", reload the Chrome extension.',
    ];
  } else {
    contextLines = [
      'MCP STATUS: BRIDGE OFFLINE ⚠️',
      `WebSocket bridge is NOT running on port ${PORT}. Reason: ${result.reason}`,
      '',
      'MCP tools will fail until the bridge is started. To fix:',
      '  1. Do NOT run server.js separately — MCP server starts it automatically.',
      '  2. Restart this Claude Code session (MCP server starts on session launch).',
      '  3. Ensure Chrome extension is loaded: chrome://extensions > load unpacked > extension/',
    ];
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `\n=== MCP CONNECTIVITY CHECK ===\n\n${contextLines.join('\n')}\n`,
    },
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch(() => process.exit(0));
