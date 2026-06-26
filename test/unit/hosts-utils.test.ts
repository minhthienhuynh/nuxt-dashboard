import { describe, expect, it } from 'vitest'
import { buildGroupTree, filterHostsByGroup, filterHostsBySearch } from '../../layers/termius/app/utils/hosts'
import type { Group, Host } from '../../layers/termius/app/types/ssh'

function group(id: string, parentId: string | null = null, name = id): Group {
  return { id, name, parentId, createdAt: '', updatedAt: '' }
}

function host(id: string, groupId: string | null, label = id, address = `${id}.example`): Host {
  return { id, label, address, port: 22, os: null, description: null, groupId, identityId: null, createdAt: '', updatedAt: '' }
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
