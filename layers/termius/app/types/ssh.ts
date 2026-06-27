// SSH domain types for the UI. These match the JSON shape returned by the REST
// API (`/api/hosts|groups|identities|tags`): Prisma models with secret fields
// (`password`/`privateKey`/`passphrase`) stripped at the API boundary, and
// `DateTime` columns serialized to ISO strings over HTTP.

export interface Group {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export interface Host {
  id: string
  label: string
  address: string
  port: number
  os: string | null
  description: string | null
  groupId: string | null
  identityId: string | null
  createdAt: string
  updatedAt: string
}

// Identity with secrets stripped (no `password`).
export interface Identity {
  id: string
  label: string | null
  username: string
  authType: 'password' | 'key'
  sshKeyId: string | null
  createdAt: string
  updatedAt: string
}

// SSH key with secrets stripped (no `privateKey`/`passphrase`). `publicKey` is
// non-secret and returned by the API.
export interface SSHKey {
  id: string
  label: string
  keyType: string
  publicKey: string
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: string
  name: string
}

export interface HostTagLink {
  hostId: string
  tagId: string
  tag: Tag
}

export interface ConnectionHistoryEntry {
  id: string
  hostId: string
  startedAt: string
  endedAt: string | null
  status: string
}

// Shape returned by GET /api/hosts/:id?relations=true (nested identity redacted).
export interface HostWithRelations extends Host {
  group: Group | null
  identity: Identity | null
  tags: HostTagLink[]
  history: ConnectionHistoryEntry[]
}

// Tree node built from the flat group list (see utils/hosts.ts).
export interface GroupNode extends Group {
  children: GroupNode[]
}

// Group filter selection: a real group id, or one of the two virtual entries.
export type GroupSelection = 'all' | 'ungrouped' | string
