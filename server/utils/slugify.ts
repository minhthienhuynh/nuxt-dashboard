import { dash } from 'radash'

export function slugify(name: string): string {
  return dash(
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
  )
}

export function websiteContainerName(name: string): string {
  return `website-${slugify(name)}`
}
