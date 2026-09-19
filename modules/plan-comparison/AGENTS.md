# AGENTS.md — module plan-comparison

Chỉ dẫn riêng cho thư mục này; các quy ước chung của repo xem `AGENTS.md` ở root.

## Cấu trúc

- `index.ts` — entry Nuxt module: đăng ký `runtime/app/components` qua `addComponentsDir` và route `/plan-comparison` qua hook `pages:extend`. Page KHÔNG nằm trong `app/pages` của app chính.
- `runtime/app/pages/plan-comparison.vue` — entry UI, dùng layout `default` của app chính.
- `runtime/app/components/` — auto-registered, bắt buộc prefix `PlanComparison*` (page dùng trực tiếp không cần import; prefix tránh đụng namespace component của app chính).
- `runtime/app/composables/` — `usePlanComparisonDatabase` (state + filters + normalize + sort option), `usePlanComparisonPricing` (pricing index, giá input), `usePlanComparisonSort` (`sortRows`). Test colocated cùng thư mục.
- `runtime/app/types.ts` — types domain dùng chung; các file dataset import type từ đây.
- `runtime/app/plan-colors.ts` — nguồn duy nhất cho planId/label/màu của 3 plans (cmd, goat, go) và thứ tự series trên bar/tooltip.
- `runtime/server/api/*.ts` — dataset tĩnh có type, **không phải Nitro endpoint** (không `defineEventHandler`); composable import trực tiếp. Không thêm endpoint mới ở đây nếu không có ý định serve qua HTTP.

## Sort theo giá

- `inputPrice()` trong `runtime/app/composables/usePlanComparisonPricing.ts` trả **giá input niêm yết** ($/1M token) của entry `command-code` ĐẦU TIÊN cho `model_id` đó — đúng con số cột **Input** trên bảng plan của Command Code (`docs/plans/goat#models-included`, `docs/plans/go`).
- Sort `cheapest` / `priciest` dùng thẳng giá này (`SortKey = 'inputPrice'`). Không có công thức profile, không có hệ số output/cache, không có tiền xử lý tier.
- Vì sao lấy entry đầu tiên: model nhiều context tier thì bảng hiển thị **tier đầu (rẻ nhất)**. Model có deal thì cột Input hiển thị **giá list** (giá đầu, phần gạch ngang) rồi mới tới giá deal ⇒ entry `command-code` đầu tiên cũng là giá list. Verified 2026-09-10: 47/47 model có giá khớp cả thứ tự lẫn giá trị với cột Input live.
- Model không có giá (không có entry `command-code`, vd `meituan/longcat-2.0`) → `inputPrice` = `null`, luôn xếp **cuối** ở cả 2 chiều.
- **Pitfall `peak`/`off_peak`:** nhiều model có 2 entry (`off_peak` rồi `peak`). Trang hiển thị giá off-peak ("Off-peak shown (17h/day)"), nên **chỉ cần giữ thứ tự sẵn có trong `pricing.ts`** (off_peak trước) — đừng sort lại file theo giá, sẽ làm sort lấy nhầm giá peak.
- `estimates.per_month` trong `plan_models.ts` là ngân sách credit chia cho cost/request **theo công thức riêng của Command Code**, KHÔNG suy ra được từ cột Input. Đừng dùng nó để suy ngược giá.

## Nguồn cập nhật dữ liệu

- Command Code (plans `cmd-go`, `cmd-goat`): pricing/limits từ `https://commandcode.ai/docs/resources/pricing-limits`; usage limits GOAT từ `https://commandcode.ai/docs/plans/goat#usage-limits`; usage limits Go từ `https://commandcode.ai/docs/plans/go#usage-limits`.
- OpenCode Go (plan `oc-go`): pricing và usage per request từ `https://opencode.ai/docs/go`.
- Khi sync số liệu mới từ các trang trên, ghi note vào row tương ứng trong `runtime/server/api/plan_models.ts` theo pattern sẵn có: `Synced <ngày> from <URL> — <điểm chính>`; số liệu tính tay cũng ghi note kèm ngày (`Derived from usage calculator formula ...` / `Recalc <ngày>: ...`).

## Công thức quota & cách extract từ trang GOAT (verified 2026-09-18)

- Trang `docs/plans/goat` là Next.js Flight: data nằm trong `self.__next_f.push(... "models":[...])`
  (escape 1 lớp). Fetch bằng `curl -A "Mozilla/5.0"`, 2 lần + `md5sum`/`cmp` byte-identical mới tin.
- Snapshot 2026-09-18: **72 slugs = 52 opensource + 20 premium**; bảng HTML `/models/<slug>`
  render đủ 52 opensource, 20 premium (`minPlanName` Pro/Max) chỉ nằm trong JS — đừng dùng bảng
  HTML làm ground truth số model.
- Mỗi object model có: `slug/id/name/vendor/category`, `contextWindow`, `reasoning/vision`,
  `inputCost/outputCost/cacheReadCost/cacheWriteCost` (`"$undefined"` = không có),
  `tiers[].rates` (bảng hiển thị tier đầu), `minPlanName` (availability), `deal`,
  `caps`, `intelligenceIndex/codingIndex`, `releaseDate` (lab release, `$undefined` = chưa có),
  `launchedAt` (ngày lên CC — dùng sort Newest-first).
- Quota KHÔNG nằm trong object model — nằm ở component `GoatEstimatesTable` (`$L45`):
  `{"rows":[{"name","budgetUsd","rates","shape","timeOfDay?"}],"fiveHourFraction":0.2,"weeklyFraction":0.5}`.
  `budgetUsd` = allowance $ của model đó (model mới mặc định $20 — đọc field, đừng đoán).
- Công thức render (chunk `6856-*`, module `901`): shape mặc định 800 in / 180 out mặc định /
  50K cache-read; output theo vendor (Anthropic 180, OpenAI 160, Moonshot 200, Z.ai 150,
  MiniMax 125, DeepSeek/Alibaba/StepFun 200, fallback 200);
  `cost/req = in/1e6×inputCost + out/1e6×outputCost + cache/1e6×cacheReadCost`;
  `month = budgetUsd/cost` (cost ≤ 0 → "Free"); 5h = `ku(month×0.2)`, tuần = `ku(month×0.5)`,
  tháng = `ku(month)`; `ku` = `Number(n.toPrecision(3)).toLocaleString('en-US')`.
  Có `timeOfDay` + qua `effective`: bảng dùng offPeak, tooltip peak (17h/ngày + cuối tuần off-peak).
- Đối chiếu `budgetUsd` + tính tay trước khi sync vào `plan_models.ts`; số hiển thị trên trang
  đã qua `toPrecision(3)` nên lệch nhẹ số tính tay là bình thường (project giữ số chính xác đã sync).

## Model free (KHÔNG đưa vào dataset)

- Trang Command Code có thể có model free 100% (vd: `Laguna S 2.1` — deal "FREE while capacity lasts", $0.00 input/output/cache read, không tiêu credit, có row riêng "FREE" trên bảng plans).
- **Quy ước: KHÔNG thêm model free vào `models.ts` / `pricing.ts` / `plan_models.ts`.** Lý do:
  - `estimates.per_month = budget / 0` → chia cho 0 (Infinity), phá vỡ sort `cheapest`/`priciest` và domain log-scale của dot chart.
  - So sánh credit/request trở nên vô nghĩa vì model free không tiêu credit của plan nào.
  - Deal free là tạm thời ("while capacity lasts"), thêm vào rồi phải kéo ra khi hết hạn.
- Khi check sync deals/usage: đếm số model trên bảng live **trừ các row FREE** trước khi đối chiếu với dataset (vd: bảng Go live 39 dòng = 38 model + 1 row Laguna S 2.1 FREE).

## Model tạm / stealth (KHÔNG đưa vào dataset)

- Model stealth ẩn danh, chỉ có trên 1 plan, không có thông số chính thức từ lab (vd: `Omen Alpha` — OpenCode Go 2026-09-04, maker không công bố, chỉ serve qua Go).
- **Quy ước (user chốt 2026-09-05): KHÔNG thêm model tạm vào dataset**, tương tự model free — tránh thêm rồi phải kéo ra khi model bị rút/đổi tên sau reveal.

## Điểm dễ miss

- Mapping planId hardcode ở 2 nơi: `PLAN_IDS` trong `usePlanComparisonDatabase.ts` và `PLAN_COMPARISON_PLANS` trong `plan-colors.ts`. Thêm/đổi plan phải sửa cả hai.
- Types domain (Plan, Model, PricingEntry...) dùng snake_case cho field — giữ nguyên khi thêm field mới.
- Charts dùng `@unovis/vue` (dependency của root `package.json`, module không có `package.json` riêng).

## Xác minh thay đổi

- `pnpm exec vitest run modules/plan-comparison/runtime/app/composables/<tên-file>.test.ts` — chạy test của module.
- `pnpm exec eslint modules` — lint scoped (root lint fail do file prototype ngoài module, không liên quan).
