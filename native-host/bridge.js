#!/usr/bin/env node
/**
 * Tab Group Controller - WebSocket Bridge
 * 
 * Runs a local WebSocket server on ws://localhost:9999
 * External clients (scripts, Claude, etc.) connect and send JSON commands.
 * The bridge relays them to the Chrome extension via a persistent connection.
 * 
 * Install: npm install ws
 * Run:     node bridge.js
 */

const { WebSocketServer, WebSocket } = require('ws');

const PORT = 9999;
const wss = new WebSocketServer({ port: PORT });

let extensionSocket = null;   // the Chrome extension's persistent connection
const clientSockets = new Set(); // external clients

console.log(`\n🗂  Tab Group Controller - WebSocket Bridge`);
console.log(`   Listening on ws://localhost:${PORT}\n`);
console.log(`   1. Load the Chrome extension (Unpacked) in chrome://extensions`);
console.log(`   2. Open the extension popup once to activate it`);
console.log(`   3. Connect external clients to ws://localhost:${PORT}\n`);

// Pending requests map: requestId → { resolve, reject, timeout }
const pending = new Map();
let requestIdCounter = 0;

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  const isExtension = req.url === '/extension';

  if (isExtension) {
    console.log(`✅ Chrome extension connected`);
    extensionSocket = ws;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const { requestId, ...rest } = msg;

        if (requestId !== undefined && pending.has(requestId)) {
          const { resolve, timeout } = pending.get(requestId);
          clearTimeout(timeout);
          pending.delete(requestId);
          resolve(rest);
        }
      } catch (e) {
        console.error('Bad message from extension:', e.message);
      }
    });

    ws.on('close', () => {
      console.log(`❌ Chrome extension disconnected`);
      extensionSocket = null;
    });

  } else {
    console.log(`🔌 External client connected from ${ip}`);
    clientSockets.add(ws);

    ws.on('message', async (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const { command, params } = parsed;

      if (!command) {
        ws.send(JSON.stringify({ error: 'Missing "command" field' }));
        return;
      }

      if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
        ws.send(JSON.stringify({ error: 'Chrome extension not connected' }));
        return;
      }

      // Forward to extension and wait for response
      const requestId = ++requestIdCounter;
      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error('Request timed out after 10s'));
        }, 10000);
        pending.set(requestId, { resolve, reject, timeout });
      });

      extensionSocket.send(JSON.stringify({ requestId, command, params: params || {} }));

      try {
        const result = await responsePromise;
        ws.send(JSON.stringify(result));
      } catch (err) {
        ws.send(JSON.stringify({ error: err.message }));
      }
    });

    ws.on('close', () => {
      clientSockets.delete(ws);
      console.log(`🔌 External client disconnected`);
    });
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down bridge...');
  wss.close(() => process.exit(0));
});
