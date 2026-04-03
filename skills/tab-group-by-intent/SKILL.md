---
name: tab-group-by-intent
description: Organise Chrome tabs into groups by inferred user intent — two-pass clustering that figures out what you were trying to accomplish (not just what the content is about), then names groups from those goals. Use this skill whenever the user asks to group, organise, sort, or tidy Chrome tabs, or says things like "clean up my tabs", "group my tabs", "organise tabs by intent/goal/purpose", or "cluster my open tabs".
---

# Tab Grouping — Intent-Based Clustering

Organise the user's open Chrome tabs into meaningful groups based on what they were trying to accomplish.

## How to execute

1. Call `tab_snapshot` to get all current tabs (groups + ungrouped).

2. **Pass 1 — Clustering**: For each tab, infer the user's goal — what they were *trying to accomplish* — not what the content is about. Look at URL, title, and domain together. Assign each tab to a task cluster with a descriptive working label (e.g. "Planning Vietnam trip", "Debugging RabbitMQ issue", "Job search — backend roles").

3. **Pass 2 — Naming**: Review each cluster's actual content and write a concise group name (2–4 words) that captures the user's *goal*, not the content type. Choose a fitting color from: grey, blue, red, yellow, green, pink, purple, cyan.

4. **Execution**: For each group, call `tab_group_create` with `title`, `color`, and `tabIds`.

5. Leave clearly unrelated one-off tabs ungrouped — don't force everything into a group.

6. After grouping, briefly summarise what groups were created and why.
