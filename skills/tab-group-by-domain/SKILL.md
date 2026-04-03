---
name: tab-group-by-domain
description: Organise Chrome tabs into groups using graph-based similarity clustering — builds a tab similarity graph from domain, URL, and title signals, then groups by community detection. Use this skill when the user asks to group tabs by domain, similarity, or URL patterns, or says things like "group tabs by site", "cluster similar tabs", "group tabs that are related", "organise by domain", or when they want an objective/structural grouping rather than intent-based.
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
