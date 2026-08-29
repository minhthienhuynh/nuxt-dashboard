# AGENTS.md — module plan-comparison

Chỉ dẫn riêng cho thư mục này; các quy ước chung của repo xem `AGENTS.md` ở root.

## Cấu trúc

- `index.ts` — entry Nuxt module: đăng ký `runtime/app/components` qua `addComponentsDir` và route `/plan-comparison` qua hook `pages:extend`. Page KHÔNG nằm trong `app/pages` của app chính.
- `runtime/app/pages/plan-comparison.vue` — entry UI, dùng layout `default` của app chính.
- `runtime/app/components/` — auto-registered, bắt buộc prefix `PlanComparison*` (page dùng trực tiếp không cần import; prefix tránh đụng namespace component của app chính).
- `runtime/app/composables/` — `usePlanComparisonDatabase` (state + filters + normalize + sort option), `usePlanComparisonPricing` (pricing index, effective cost), `usePlanComparisonSort` (`sortRows`). Test colocated cùng thư mục.
- `runtime/app/types.ts` — types domain dùng chung; các file dataset import type từ đây.
- `runtime/app/plan-colors.ts` — nguồn duy nhất cho planId/label/màu của 3 plans (cmd, goat, go) và thứ tự series trên bar/tooltip.
- `runtime/server/api/*.ts` — dataset tĩnh có type, **không phải Nitro endpoint** (không `defineEventHandler`); composable import trực tiếp. Không thêm endpoint mới ở đây nếu không có ý định serve qua HTTP.

## Công thức effective price (Command Code usage profile)

- `effectiveCost()` trong `runtime/app/composables/usePlanComparisonPricing.ts` tính giá một request theo profile dùng cố định: `(input×800 + output×outTokens + cache_read×50000) / 1e6` — pricing là $/M tokens nên chia 1e6.
- `outTokens`: lookup `OUTPUT_TOKENS_BY_MODEL` theo model (glm: 150, minimax: 125, gpt-luna: 160...), model không có trong bảng dùng `DEFAULT_OUTPUT_TOKENS = 200`.
- `getEffectivePricing()` ưu tiên `DEAL_EFFECTIVE_PRICING` (giá deal thời hạn) trước giá list trong pricing index.
- Kết quả gắn vào field `effective` trên mỗi row trong `normalizePlanComparisonDatabase` — là cơ sở cho sort `cheapest`/`priciest`.
- Quy đổi quota: `estimates.per_month` trong `runtime/server/api/plan_models.ts` ≈ `monthly_credits_usd / effectiveCost` làm tròn (vd: glm-5.3 cost 0.01478 → 10/0.01478 = 677; 20/0.01478 ≈ 1350). Đổi hằng số profile (800/50K/200) hoặc giá deal là phải cân nhắc cập nhật lại các estimates này.

## Nguồn cập nhật dữ liệu

- Command Code (plans `cmd-go`, `cmd-goat`): pricing/limits từ `https://commandcode.ai/docs/resources/pricing-limits`; usage limits GOAT từ `https://commandcode.ai/docs/plans/goat#usage-limits`.
- OpenCode Go (plan `oc-go`): pricing và usage per request từ `https://opencode.ai/docs/go`.
- Khi sync số liệu mới từ các trang trên, ghi note vào row tương ứng trong `runtime/server/api/plan_models.ts` theo pattern sẵn có: `Synced <ngày> from <URL> — <điểm chính>`; số liệu tính tay cũng ghi note kèm ngày (`Derived from usage calculator formula ...` / `Recalc <ngày>: ...`).

## Điểm dễ miss

- Mapping planId hardcode ở 2 nơi: `PLAN_IDS` trong `usePlanComparisonDatabase.ts` và `PLAN_COMPARISON_PLANS` trong `plan-colors.ts`. Thêm/đổi plan phải sửa cả hai.
- Types domain (Plan, Model, PricingEntry...) dùng snake_case cho field — giữ nguyên khi thêm field mới.
- Charts dùng `@unovis/vue` (dependency của root `package.json`, module không có `package.json` riêng).

## Xác minh thay đổi

- `pnpm exec vitest run modules/plan-comparison/runtime/app/composables/<tên-file>.test.ts` — chạy test của module.
- `pnpm exec eslint modules` — lint scoped (root lint fail do file prototype ngoài module, không liên quan).
