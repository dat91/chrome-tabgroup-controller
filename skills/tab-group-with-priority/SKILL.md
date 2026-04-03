---
name: tab-group-with-priority
description: Organise Chrome tabs into groups with priority levels (active/background/archive) and suggested actions (keep/close/bookmark) — useful when the user wants to not just group but also triage and declutter their browser. Use this skill when the user asks to group tabs with priority, triage tabs, clean up tabs, close stale tabs, or says things like "group my tabs and tell me what to close", "organise tabs by priority", "help me declutter my browser", or "which tabs should I keep".
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
