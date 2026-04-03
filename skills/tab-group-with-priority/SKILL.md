---
name: tab-group-with-priority
description: Group Chrome tabs with priority tiers (active/background/archive) and suggested actions (keep/close/bookmark). Use when user wants to triage tabs, says "group by priority", "help me declutter", or "which tabs should I close".
disable-model-invocation: true
allowed-tools:
  - mcp__chrome-tabs__tab_snapshot
  - mcp__chrome-tabs__tab_group_create
  - mcp__chrome-tabs__tabs_close
---

# Tab Grouping — Priority-Aware

Group tabs AND triage them: active work, background reference, or archive (stale/done).

## How to execute

1. Call `tab_snapshot` to get all current tabs.

2. **For each group, determine**:
   - `group_name`: concise label (2–4 words)
   - `color`: grey, blue, red, yellow, green, pink, purple, cyan
   - `tabs`: list of tab IDs
   - `priority`: `"active"` (currently in use) | `"background"` (reference / return later) | `"archive"` (stale / done)
   - `suggested_action`: `"keep"` (actively useful) | `"close"` (done or duplicate) | `"bookmark"` (save for later, then close)

3. **Output a structured summary** of all groups with your reasoning for each priority and action. Show this to the user *before* executing — they should see the plan.

4. **Execute**:
   - Call `tab_group_create` for all `"active"` and `"background"` groups.
   - For `"archive"` groups: present the list and **ask the user for confirmation** before closing or bookmarking any tabs.

5. Report what was done and what's pending user decision.
