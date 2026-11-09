/**
 * Release dates the Command Code payload does not publish (its model pages
 * show `—`), filled from `models.dev` (audited 2026-11-09 against
 * https://models.dev/api.json). Precedence follows the release-date audit
 * recipe: the lab's official provider entry on models.dev wins, then the
 * cross-provider consensus; a lone entry that contradicts the model's launch
 * date is rejected as a guess (e.g. `deepseek-v4-flash-fast` 2026-04-24 from a
 * single aggregator — CC launched it 2026-08-22).
 *
 * Speed/snapshot variants inherit the family date models.dev gives them
 * (`mimo-v2.6-pro-ultraspeed` is dated 2026-09-21 by Xiaomi itself), except
 * GLM-5.2 Fast, where the lab's own announcement (Jun 23, 2026) beats the
 * base-date copies most aggregators carry (audited 2026-09-01).
 *
 * The Token Harbor gateway-only entries (Office Pass models the other plans
 * never list) use the consensus across the aggregators carrying them; for
 * `mistral-large-2512` the consensus (2025-12-02, matching the `2512`
 * snapshot naming) beats Mistral's own stale 2024-11-01 entry.
 *
 * DeepSeek variants models.dev has no entry for take their family base's
 * date (`ultrafast`/Eco inherit V4.1 Flash's 2026-09-10, `-flash-fast`
 * inherits V4 Flash's 2026-07-31) — per user decision 2026-11-09. Jev 1.14.0
 * is on models.dev as a specialized model page (Release 2026-10-14) though
 * absent from the default `api.json` payload; the base `jev` has no page.
 *
 * Keyed by dataset model id; only applied when the payload leaves the date
 * unset, so a date CC starts publishing always wins.
 */
export const RELEASE_DATE_FALLBACKS: Record<string, string> = {
  'tencent/hy4-preview': '2026-08-28',
  'moonshotai/Kimi-K3.1-Pro': '2026-10-23',
  'moonshotai/Kimi-K2.7-Code-Highspeed': '2026-06-12',
  'z-ai/glm-5.3-flashx': '2026-09-18',
  'zai-org/GLM-5.2-Fast': '2026-06-23',
  'ornith/ornith-1.5-122b': '2026-10-20',
  'deepseek/deepseek-v4.1-flash-fast': '2026-09-10',
  'Qwen/Qwen3.8-Omni-Flash': '2026-09-17',
  'Qwen/Qwen3.8-Max-Prime': '2026-09-23',
  'Qwen/Qwen3.8-Flash': '2026-08-26',
  'Qwen/Qwen3.7-Flash': '2026-07-15',
  'inclusionai/ling-3.1-flash-1019': '2026-10-30',
  'xiaomi/mimo-v2.6-pro-ultraspeed': '2026-09-21',
  'meta/muse-spark-1.3-contributor': '2026-09-02',
  'meta/muse-spark-1.2-contributor': '2026-08-05',
  'mimo-v2.5': '2026-04-22',
  'mimo-v2.5-pro': '2026-04-22',
  'tokenharbor/gpt-6-luna-fast': '2026-09-22',
  'tokenharbor/deepseek-v4-1-flash-1017-fast': '2026-10-17',
  'tokenharbor/mistral-large-2512': '2025-12-02',
  'tokenharbor/gpt-5-6-luna-fast': '2026-07-09',
  'tokenharbor/qwen3-6-27b': '2026-04-22',
  'tokenharbor/qwen3-6-flash': '2026-04-27',
  'tokenharbor/deepseek-v3-2': '2025-12-01',
  'tokenharbor/qwen3-5-27b': '2026-02-23',
  // DeepSeek variants: inherit the family base's date (no own entry).
  'deepseek/deepseek-v4.1-flash-ultrafast': '2026-09-10',
  'open-design/deepseek-v4-1-flash-eco': '2026-09-10',
  'deepseek/deepseek-v4-flash-fast': '2026-07-31',
  // Specialized models.dev page (not in the default api.json payload).
  'typesafe/jev-1.14.0': '2026-10-14'
}
