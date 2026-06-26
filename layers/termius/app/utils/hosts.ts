import type { Group, GroupNode, GroupSelection, Host } from '../types/ssh'

// Build a nested tree from the flat group list via each group's `parentId`.
// Roots are groups with `parentId == null` or a `parentId` that resolves to no
// known group (orphans are surfaced rather than dropped).
export function buildGroupTree(groups: Group[]): GroupNode[] {
  const byId = new Map<string, GroupNode>()
  for (const g of groups) byId.set(g.id, { ...g, children: [] })

  const roots: GroupNode[] = []
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

// A group id plus all of its descendant ids, found from the built tree.
function groupAndDescendantIds(tree: GroupNode[], groupId: string): Set<string> {
  const ids = new Set<string>()

  const find = (nodes: GroupNode[]): GroupNode | undefined => {
    for (const node of nodes) {
      if (node.id === groupId) return node
      const hit = find(node.children)
      if (hit) return hit
    }
    return undefined
  }

  const collect = (node: GroupNode) => {
    ids.add(node.id)
    node.children.forEach(collect)
  }

  const start = find(tree)
  if (start) collect(start)
  return ids
}

// Filter hosts by the current group selection:
//  - "all"       → no filter
//  - "ungrouped" → hosts with no group (`groupId == null`)
//  - a group id  → hosts in that group or any of its descendant groups
export function filterHostsByGroup(hosts: Host[], selection: GroupSelection, tree: GroupNode[]): Host[] {
  if (selection === 'all') return hosts
  if (selection === 'ungrouped') return hosts.filter(host => host.groupId == null)

  const ids = groupAndDescendantIds(tree, selection)
  return hosts.filter(host => host.groupId != null && ids.has(host.groupId))
}

// Filter hosts by a case-insensitive search over label and address. A blank
// query returns the list unchanged.
export function filterHostsBySearch(hosts: Host[], query: string): Host[] {
  const q = query.trim().toLowerCase()
  if (!q) return hosts
  return hosts.filter(host =>
    host.label.toLowerCase().includes(q) || host.address.toLowerCase().includes(q))
}
