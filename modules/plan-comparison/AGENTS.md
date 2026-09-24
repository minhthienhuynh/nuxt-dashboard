# AGENTS.md — module plan-comparison

Chi tiết xem `README.md`. Dưới đây là quy ước + bẫy.

- `index.ts`: `addComponentsDir` + `addServerScanDir` + route `/plan-comparison`.
- Components prefix `PlanComparison*`. `Model` camelCase theo item script CMD.
- `PLAN_COMPARISON_PLANS` (`plan-colors.ts`) là registry duy nhất cho plan id/label/color — đừng tạo map id song song.
- Copy UI tiếng Anh, format số/ngày `en-US` (tooltip dùng `formatDate` UTC-pinned).
- Model tooltip là hover (`UPopover mode="hover"` + virtual `reference`): hover tracking nằm ở `usePlanChartHover.ts`, resolve row qua `rowFromEventTarget` (d3 `__data__`). Shared chart setup ở `usePlanComparisonChartFrame.ts` + `plan-chart.css` — 2 chart phải dùng chung, đừng nhân bản.
- Test colocated; parsers pure + fixture, không fetch thật.
- Đừng sort lại pricing (dedupe keep-first). Đừng lấy bảng HTML làm ground truth số model (trừ row FREE). Chunk hash dò qua HTML. Vendor mới kiểm tra naming `vendor` vs `provider` + vendor-map.
- Lệnh: `pnpm exec vitest run modules/plan-comparison/` · `pnpm exec eslint modules/plan-comparison app nuxt.config.ts` · `pnpm run typecheck`
