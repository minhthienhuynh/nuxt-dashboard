import type { Group, GroupNode, GroupSelection, Host, HostSort } from '../types/ssh'

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

export const DEFAULT_HOST_SORT: HostSort = 'name-asc'

// Sort options for the toolbar control, in display order.
export const HOST_SORT_OPTIONS: { value: HostSort, label: string, icon: string }[] = [
  { value: 'name-asc', label: 'Name (A→Z)', icon: 'i-lucide-arrow-down-a-z' },
  { value: 'name-desc', label: 'Name (Z→A)', icon: 'i-lucide-arrow-down-z-a' },
  { value: 'created-desc', label: 'Newest first', icon: 'i-lucide-calendar-arrow-down' },
  { value: 'created-asc', label: 'Oldest first', icon: 'i-lucide-calendar-arrow-up' }
]

// Narrow an arbitrary (e.g. stored) value to a known sort key.
export function isHostSort(value: unknown): value is HostSort {
  return HOST_SORT_OPTIONS.some(o => o.value === value)
}

// Normalize a createdAt value to a comparable timestamp; an unparseable value
// sorts as 0 rather than throwing.
function toTime(value: string | number | Date | null | undefined): number {
  if (value == null) return 0
  const t = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value)
  return Number.isNaN(t) ? 0 : t
}

// Sort hosts for display; returns a new array (does not mutate the input). Equal
// keys are tie-broken by `id` (UUIDv7, stable) so order stays deterministic.
export function sortHosts(hosts: Host[], sort: HostSort): Host[] {
  const tieBreak = (a: Host, b: Host) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const compare = (a: Host, b: Host): number => {
    let primary: number
    if (sort === 'name-asc' || sort === 'name-desc') {
      primary = a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      if (sort === 'name-desc') primary = -primary
    } else {
      const ta = toTime(a.createdAt)
      const tb = toTime(b.createdAt)
      primary = sort === 'created-desc' ? tb - ta : ta - tb
    }
    return primary !== 0 ? primary : tieBreak(a, b)
  }
  return [...hosts].sort(compare)
}
