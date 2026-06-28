import { describe, expect, it } from 'vitest'
import { DEFAULT_HOST_SORT, buildGroupTree, filterHostsByGroup, filterHostsBySearch, isHostSort, sortHosts } from '../../layers/termius/app/utils/hosts'
import type { Group, Host } from '../../layers/termius/app/types/ssh'

function group(id: string, parentId: string | null = null, name = id): Group {
  return { id, name, parentId, createdAt: '', updatedAt: '' }
}

function host(id: string, groupId: string | null, label = id, address = `${id}.example`): Host {
  return { id, label, address, port: 22, os: null, groupId, identityId: null, createdAt: '', updatedAt: '' }
}

// Host with overridable label and createdAt for sort tests. createdAt accepts a
// string or Date so we can exercise both representations (typed loosely because
// the wire type is string but the helper normalizes either).
function sortableHost(id: string, label: string, createdAt: string | Date): Host {
  return { ...host(id, null, label), createdAt: createdAt as string }
}

describe('buildGroupTree', () => {
  it('builds a tree from a flat list (roots = parentId null)', () => {
    const tree = buildGroupTree([group('a'), group('b')])
    expect(tree.map(n => n.id).sort()).toEqual(['a', 'b'])
    expect(tree.every(n => n.children.length === 0)).toBe(true)
  })

  it('nests multiple levels under their parent', () => {
    const tree = buildGroupTree([group('root'), group('child', 'root'), group('grandchild', 'child')])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.id).toBe('root')
    expect(tree[0]!.children[0]!.id).toBe('child')
    expect(tree[0]!.children[0]!.children[0]!.id).toBe('grandchild')
  })

  it('treats an orphan (parentId pointing nowhere) as a root', () => {
    const tree = buildGroupTree([group('orphan', 'missing')])
    expect(tree.map(n => n.id)).toEqual(['orphan'])
  })
})

describe('filterHostsByGroup', () => {
  const groups = [group('parent'), group('child', 'parent')]
  const tree = buildGroupTree(groups)
  const hosts = [host('h1', 'parent'), host('h2', 'child'), host('h3', null)]

  it('"all" returns every host', () => {
    expect(filterHostsByGroup(hosts, 'all', tree).map(h => h.id)).toEqual(['h1', 'h2', 'h3'])
  })

  it('"ungrouped" returns only hosts with no group', () => {
    expect(filterHostsByGroup(hosts, 'ungrouped', tree).map(h => h.id)).toEqual(['h3'])
  })

  it('a parent group includes hosts of its descendant groups', () => {
    expect(filterHostsByGroup(hosts, 'parent', tree).map(h => h.id).sort()).toEqual(['h1', 'h2'])
  })

  it('a leaf group returns only its own hosts', () => {
    expect(filterHostsByGroup(hosts, 'child', tree).map(h => h.id)).toEqual(['h2'])
  })
})

describe('filterHostsBySearch', () => {
  const hosts = [host('web', null, 'Web Server', '10.0.0.1'), host('db', null, 'Database', '10.0.0.2')]

  it('matches on label (case-insensitive)', () => {
    expect(filterHostsBySearch(hosts, 'web').map(h => h.id)).toEqual(['web'])
    expect(filterHostsBySearch(hosts, 'DATABASE').map(h => h.id)).toEqual(['db'])
  })

  it('matches on address', () => {
    expect(filterHostsBySearch(hosts, '0.0.0.2').map(h => h.id)).toEqual(['db'])
  })

  it('blank query returns the full list unchanged', () => {
    expect(filterHostsBySearch(hosts, '   ')).toHaveLength(2)
    expect(filterHostsBySearch(hosts, '')).toHaveLength(2)
  })
})

describe('sortHosts', () => {
  // Insertion order is intentionally not name/date order so a passing sort
  // proves the helper reordered rather than echoing input order.
  const hosts = [
    sortableHost('h1', 'cherry', '2024-03-01T00:00:00.000Z'),
    sortableHost('h2', 'Apple', '2024-01-01T00:00:00.000Z'),
    sortableHost('h3', 'banana', '2024-02-01T00:00:00.000Z')
  ]

  it('name-asc orders by label A→Z, case-insensitive', () => {
    expect(sortHosts(hosts, 'name-asc').map(h => h.label)).toEqual(['Apple', 'banana', 'cherry'])
  })

  it('name-desc orders by label Z→A, case-insensitive', () => {
    expect(sortHosts(hosts, 'name-desc').map(h => h.label)).toEqual(['cherry', 'banana', 'Apple'])
  })

  it('created-desc orders newest first', () => {
    expect(sortHosts(hosts, 'created-desc').map(h => h.id)).toEqual(['h1', 'h3', 'h2'])
  })

  it('created-asc orders oldest first', () => {
    expect(sortHosts(hosts, 'created-asc').map(h => h.id)).toEqual(['h2', 'h3', 'h1'])
  })

  it('sorts createdAt given as Date the same as ISO strings', () => {
    const dateHosts = [
      sortableHost('h1', 'a', new Date('2024-03-01T00:00:00.000Z')),
      sortableHost('h2', 'b', new Date('2024-01-01T00:00:00.000Z')),
      sortableHost('h3', 'c', new Date('2024-02-01T00:00:00.000Z'))
    ]
    expect(sortHosts(dateHosts, 'created-asc').map(h => h.id)).toEqual(['h2', 'h3', 'h1'])
  })

  it('tie-breaks equal keys by id for deterministic order', () => {
    // Same label and createdAt: order must follow id, regardless of input order.
    const tied = [
      sortableHost('z', 'same', '2024-01-01T00:00:00.000Z'),
      sortableHost('a', 'same', '2024-01-01T00:00:00.000Z'),
      sortableHost('m', 'same', '2024-01-01T00:00:00.000Z')
    ]
    expect(sortHosts(tied, 'name-asc').map(h => h.id)).toEqual(['a', 'm', 'z'])
    expect(sortHosts(tied, 'created-desc').map(h => h.id)).toEqual(['a', 'm', 'z'])
  })

  it('returns a new array without mutating the input', () => {
    const input = [...hosts]
    const result = sortHosts(input, 'name-asc')
    expect(result).not.toBe(input)
    expect(input.map(h => h.id)).toEqual(['h1', 'h2', 'h3'])
  })

  it('falls back to the default sort for a missing or unknown stored value', () => {
    // Mirrors the page guard: an unrecognized localStorage value resolves to the
    // default (name ascending).
    expect(DEFAULT_HOST_SORT).toBe('name-asc')
    expect(isHostSort('bogus')).toBe(false)
    expect(isHostSort(undefined)).toBe(false)
    expect(isHostSort('name-asc')).toBe(true)

    const stored: unknown = 'bogus'
    const resolved = isHostSort(stored) ? stored : DEFAULT_HOST_SORT
    expect(sortHosts(hosts, resolved).map(h => h.label)).toEqual(['Apple', 'banana', 'cherry'])
  })
})
