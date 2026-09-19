# AGENTS.md — module plan-comparison

Chi tiết xem `README.md`. Dưới đây là quy ước + bẫy.

- `index.ts`: `addComponentsDir` + `addServerScanDir` + route `/plan-comparison`.
- Components prefix `PlanComparison*`. `Model` camelCase theo item script CMD.
- `PLAN_IDS` (composable) và `PLAN_COMPARISON_PLANS` (`plan-colors.ts`) sửa đồng bộ.
- Test colocated; parsers pure + fixture, không fetch thật.
- Đừng sort lại pricing (dedupe keep-first). Đừng lấy bảng HTML làm ground truth số model (trừ row FREE). Chunk hash dò qua HTML. Vendor mới kiểm tra naming `vendor` vs `provider` + vendor-map.
- Lệnh: `pnpm exec vitest run modules/plan-comparison/` · `pnpm exec eslint modules/plan-comparison app nuxt.config.ts` · `pnpm run typecheck`
