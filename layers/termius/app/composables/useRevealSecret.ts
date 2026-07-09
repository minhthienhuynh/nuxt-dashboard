// Loads a resource's secret fields via the REST API's `?reveal=true` variant
// when seeding an edit form, guarding against a stale response: if the form was
// closed or reopened for a different record while the request was in flight, the
// result is discarded. Returns the revealed payload, or null when the request
// failed or is no longer current — callers then leave their secret fields blank.
//
// Extracted from the host/key/identity form modals, which all repeated this
// fetch + stale-guard + swallow-on-error block.
export function useRevealSecret() {
  async function reveal<T>(
    resource: string,
    id: string,
    isCurrent: () => boolean
  ): Promise<T | null> {
    try {
      const revealed = await $fetch<T>(`/api/${resource}/${id}?reveal=true`)
      return isCurrent() ? revealed : null
    } catch {
      return null
    }
  }

  return { reveal }
}
