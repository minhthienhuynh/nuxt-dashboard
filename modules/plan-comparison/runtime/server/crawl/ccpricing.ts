import { toNumber } from './parse'

export interface PricingLimitsRates {
  input: number | null
  output: number | null
  cacheRead: number | null
  cacheWrite: number | null
}

export interface PricingLimitsSection {
  slug: string
  rates: PricingLimitsRates
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function tableCells(tableHtml: string): string[][] {
  const rows: string[][] = []
  const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? []
  for (const row of rowMatches) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => stripTags(m[1] ?? ''))
    if (cells.length > 0) rows.push(cells)
  }
  return rows
}

/**
 * Deal anchors look like `#minimax-m3-2x-usage` / `#<slug>-deal` / `#<slug>-usage`.
 * Returns the slug prefix, or null when the anchor is not model-scoped.
 */
export function slugFromAnchor(href: string): string | null {
  const match = href.match(/^#([a-z0-9]+(?:-[a-z0-9]+)*?)(?:-\dx-usage|-usage|-deal)?$/)
  if (!match) return null
  const slug = match[1] ?? ''
  return slug.includes('-') || slug.length > 2 ? slug : null
}

/**
 * Normalizes a `pick <model> from /model` marker to the same slug space as
 * `slugFromAnchor`: strip tags, dash-separate, then strip the same
 * `-Nx-usage` / `-usage` / `-deal` suffixes so `MiniMax M3 2x usage`
 * resolves to `minimax-m3` instead of `minimax-m3-2x-usage`.
 */
export function normalizeMarkerSlug(raw: string): string {
  const base = raw.replace(/<[^>]+>/g, ' ').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return base.replace(/(?:-\dx-usage|-usage|-deal)$/, '')
}

/**
 * True when a marker slug denotes a real model card rather than generic
 * prose (`pick any model from /model`). Mirrors the `slugFromAnchor` guard
 * (dash-separated or longer than 2 chars) and additionally requires a digit:
 * model names carry versions (`m3`, `v2.5`), prose does not. Unknown markers
 * fall back to legacy behavior (tables stay with the anchor slug) instead of
 * spawning a junk section that would steal the anchor's tables.
 */
export function isModelMarkerSlug(slug: string): boolean {
  if (!slug.includes('-') && slug.length <= 2) return false
  return /\d/.test(slug)
}

/**
 * Parses per-model pricing sections. Each section is anchored by a deal link
 * (`#<slug>-...`) followed by Was/Now pricing tables. Only the Was (list)
 * column is extracted — it is the list price the plan tables quote.
 *
 * One article can host SEVERAL deal cards (verified 2026-09-29: the
 * `minimax-m3-2x-usage` article carries MiniMax M3 + MiMo V2.5 Pro + MiMo
 * V2.5, each card ending in "pick <model> from /model" BEFORE its tables).
 * Without card splitting, the MiMo tables merge into the M3 section and the
 * M3 list price comes out as MiMo's (input 0.8 instead of 0.6). So the
 * anchor segment is further split at each `pick … from /model` marker:
 * tables before the first marker belong to the anchor slug, tables after a
 * marker belong to that marker's model.
 */
export function parsePricingLimits(html: string): PricingLimitsSection[] {
  const sections: PricingLimitsSection[] = []
  const pushSection = (slug: string, segment: string): void => {
    if (!slug || sections.some(s => s.slug === slug)) return
    const tables = segment.match(/<table[\s>][\s\S]*?<\/table>/gi) ?? []
    const rates: PricingLimitsRates = { input: null, output: null, cacheRead: null, cacheWrite: null }
    let found = false
    for (const table of tables) {
      for (const cells of tableCells(table)) {
        if (cells.length < 3) continue
        const label = (cells[0] ?? '').toLowerCase()
        const was = toNumber(cells[1] ?? '')
        if (label.startsWith('input')) {
          rates.input = was
          found = true
        } else if (label.startsWith('output')) {
          rates.output = was
          found = true
        } else if (label.startsWith('cache read')) {
          rates.cacheRead = was
          found = true
        } else if (label.startsWith('cache write')) {
          rates.cacheWrite = was
          found = true
        }
      }
    }
    if (found) sections.push({ slug, rates })
  }
  const anchorMatches = [...html.matchAll(/<a[^>]+href="(#[a-z0-9][a-z0-9-]*)"[^>]*>/gi)]
  for (let i = 0; i < anchorMatches.length; i++) {
    const slug = slugFromAnchor(anchorMatches[i]?.[1] ?? '')
    if (!slug || sections.some(s => s.slug === slug)) continue
    const start = anchorMatches[i]?.index ?? 0
    const end = anchorMatches[i + 1]?.index ?? html.length
    const segment = html.slice(start, end)
    const markers = [...segment.matchAll(/pick\s+([\s\S]+?)\s+from(?:\s|<[^>]+>)*\/model/gi)]
    if (markers.length === 0) {
      pushSection(slug, segment)
      continue
    }
    let cursor = 0
    let owner = slug
    for (const marker of markers) {
      const at = marker.index ?? 0
      const markerSlug = normalizeMarkerSlug(marker[1] ?? '')
      // Generic prose is not a card boundary: leave its tables with the
      // current owner instead of spawning a junk section for them.
      if (!isModelMarkerSlug(markerSlug)) continue
      pushSection(owner, segment.slice(cursor, at))
      owner = markerSlug
      cursor = at
    }
    pushSection(owner, segment.slice(cursor))
  }
  return sections
}

export interface GoPlanLimits {
  priceUsd: number | null
  creditsUsd: number | null
}

/** Extracts the Go plan row (price + monthly credits) from the plans/go summary table. */
export function parseGoPlanLimits(html: string): GoPlanLimits | null {
  const tables = html.match(/<table[\s>][\s\S]*?<\/table>/gi) ?? []
  for (const table of tables) {
    const rows = tableCells(table)
    if (rows.length === 0) continue
    const header = (rows[0] ?? []).map(c => c.toLowerCase())
    const priceIdx = header.findIndex(c => c.includes('price'))
    const creditIdx = header.findIndex(c => c.includes('credit'))
    if (priceIdx < 0 || creditIdx < 0) continue
    for (const row of rows.slice(1)) {
      if (!/^\s*go\s/i.test(row[0] ?? '') || /goat/i.test(row[0] ?? '')) continue
      return {
        priceUsd: toNumber(row[priceIdx] ?? ''),
        creditsUsd: toNumber(row[creditIdx] ?? '')
      }
    }
  }
  return null
}
