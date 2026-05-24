import { dash } from 'radash'

// Convert Vietnamese string to URL-safe slug.
// NFD decomposes accented chars into base + combining marks,
// then we strip the combining marks (U+0300–U+036F) and handle đ/Đ
// which don't decompose in NFD.
export function slugify(name: string): string {
  const result = dash(
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
  )
  return result || 'unnamed'
}

export function websiteContainerName(name: string): string {
  return `website-${slugify(name)}`
}
