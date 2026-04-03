---
name: tab-group-by-context
description: Group Chrome tabs using your work context (role, project, sprint). Use when user says "group my tabs, I'm a backend engineer on a fintech sprint" or "organise tabs for my X project" or "group tabs based on what I'm working on".
argument-hint: '[your role and current work context]'
allowed-tools:
  - mcp__chrome-tabs__tab_snapshot
  - mcp__chrome-tabs__tab_group_create
---

# Tab Grouping — Context-Aware

Organise tabs using the user's real work context so groups reflect their actual tasks and projects.

## How to execute

1. **Get user context** from `$ARGUMENTS` if provided. If `$ARGUMENTS` is empty, ask: "What are you working on right now? (e.g. 'backend engineer, sprint planning for a fintech app')"

2. Call `tab_snapshot` to get all current tabs.

3. **Map tabs to real tasks**: Using the context, group tabs around the user's actual work — not generic categories like "Social Media" or "Documentation". Ask: what does *this specific user* need right now? Use vocabulary from their own context in group names.

4. **Execution**: For each group call `tab_group_create` with `title`, `color`, and `tabIds`. Colors: grey, blue, red, yellow, green, pink, purple, cyan.

5. After grouping, briefly explain how each group maps to something from the user's context.
