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
 * Parses per-model pricing sections. Each section is anchored by a deal link
 * (`#<slug>-...`) followed by Was/Now pricing tables. Only the Was (list)
 * column is extracted — it is the list price the plan tables quote.
 */
export function parsePricingLimits(html: string): PricingLimitsSection[] {
  const sections: PricingLimitsSection[] = []
  const anchorMatches = [...html.matchAll(/<a[^>]+href="(#[a-z0-9][a-z0-9-]*)"[^>]*>/gi)]
  for (let i = 0; i < anchorMatches.length; i++) {
    const slug = slugFromAnchor(anchorMatches[i]?.[1] ?? '')
    if (!slug || sections.some(s => s.slug === slug)) continue
    const start = anchorMatches[i]?.index ?? 0
    const end = anchorMatches[i + 1]?.index ?? html.length
    const segment = html.slice(start, end)
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
