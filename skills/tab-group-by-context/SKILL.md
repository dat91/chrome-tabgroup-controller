---
name: tab-group-by-context
description: Organise Chrome tabs into groups using the user's own context — their role, project, or current work — to map tabs to what actually matters right now. Use this skill when the user wants to group or organise tabs and provides context about themselves or their work (e.g. "group my tabs, I'm a backend engineer working on a fintech sprint", "organise tabs for my research project on X", "tidy up my browser — I'm doing Y right now"). Also use it when the user says "group tabs by context", "organise tabs based on what I'm working on", or similar.
---

# Tab Grouping — Context-Aware

Organise tabs using the user's real work context so groups reflect their actual tasks and projects.

## How to execute

1. **Extract user context** from the user's message — their role, project, sprint, or situation. If it wasn't provided, ask: "What are you working on right now? (e.g. 'backend engineer, sprint planning for a fintech app')"

2. Call `tab_snapshot` to get all current tabs.

3. **Map tabs to real tasks**: Using the context, group tabs around the user's actual work — not generic categories like "Social Media" or "Documentation". Ask: what does *this specific user* need right now? Use vocabulary from their own context in group names.

4. **Execution**: For each group call `tab_group_create` with `title`, `color`, and `tabIds`. Colors: grey, blue, red, yellow, green, pink, purple, cyan.

5. After grouping, briefly explain how each group maps to something from the user's context.
