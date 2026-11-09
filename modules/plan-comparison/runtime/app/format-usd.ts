/**
 * Money on this page — plan prices, monthly credit, per-model caps, funding
 * rows. Whole dollars stay `$10`; fractional amounts keep both decimals
 * (`$2.50`) so a plan's monthly cap and the card headline never disagree on
 * precision. Per-1M-token rates are NOT this money: `$0.003625` needs more
 * decimals than a credit figure ever does, so rates keep `model-info.ts`'s
 * `displayNumber`.
 */
export function formatUsd(value: number): string {
  const decimals = Number.isInteger(value) ? 0 : 2
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}
