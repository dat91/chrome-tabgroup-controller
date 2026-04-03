---
name: tab-group-by-domain
description: Group Chrome tabs by domain and URL similarity using graph-based clustering. Use when user says "group tabs by site", "cluster similar tabs", "organise by domain", or wants structural (not intent-based) grouping.
allowed-tools:
  - mcp__chrome-tabs__tab_snapshot
  - mcp__chrome-tabs__tab_group_create
---

# Tab Grouping — Graph-Based Domain/Similarity Clustering

Cluster tabs by structural similarity: shared domains, URL paths, and title keywords — no intent inference needed.

## How to execute

1. Call `tab_snapshot` to get all current tabs.

2. **Step 1 — Build similarity graph**: Each tab is a node. Draw edges between tabs that share two or more signals:
   - Same domain
   - Same subdomain
   - Overlapping URL path prefix
   - Related keywords in titles
   
   Weight edges by number of shared signals.

3. **Step 2 — Find communities**: Identify clusters of densely connected tabs (multiple shared signals). Isolated nodes with no strong similarity can stay ungrouped.

4. **Step 3 — Name each community** from its dominant signal — e.g. `"github.com/myrepo — PR review"`, `"docs.stripe.com — integration"`. Choose a fitting color from: grey, blue, red, yellow, green, pink, purple, cyan.

5. **Execution**: Call `tab_group_create` for each community with `title`, `color`, and `tabIds`. Truly isolated tabs may be left ungrouped or collected into a small "Misc" group.

6. After grouping, briefly explain the dominant signal that defined each cluster.
