/**
 * Example: Use TabGroups API from an external script
 * Run AFTER server.js is started and extension is connected.
 */

const { TabGroups } = require('./server');

// Wait a moment for extension to connect, then run demo
setTimeout(async () => {
  console.log('\n── Snapshot ─────────────────────────────────');
  const snap = await TabGroups.snapshot();
  console.log(`Groups: ${snap.groups.length}, Ungrouped tabs: ${snap.ungrouped.length}`);
  snap.groups.forEach(g => {
    console.log(`  [${g.color}] "${g.title}" — ${g.tabs.length} tabs${g.collapsed ? ' (collapsed)' : ''}`);
    g.tabs.forEach(t => console.log(`    • ${t.title}`));
  });

  console.log('\n── Create "MoMo Work" group ─────────────────');
  const group = await TabGroups.create({
    title: 'MoMo Work',
    color: 'blue',
    urls: [
      'https://jira.atlassian.net',
      'https://confluence.atlassian.net'
    ]
  });
  console.log(`Created group id=${group.id}`);

  console.log('\n── Collapse it after 3s ─────────────────────');
  await new Promise(r => setTimeout(r, 3000));
  await TabGroups.collapse(group.id);
  console.log('Collapsed!');

}, 2000);
