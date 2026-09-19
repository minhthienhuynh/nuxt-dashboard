# plan-comparison

Trang `/plan-comparison`: so sánh quota/credit/giá các gói AI coding plans theo model.

```
Nguồn live → crawler (parse + merge + validate) → Nitro storage (S3, không TTL)
  → GET /api/plan-comparison/database → UI (fetch, sort/filter/charts)
```

- Refresh thủ công bằng nút "Cập nhật dữ liệu". UI hiện tuổi dữ liệu + badge "Dữ liệu đã cũ" quá 24h.
- Xóa cache archive bản cũ thành object `backup:<millis>` (giữ 3 mới nhất). Mỗi crawl tăng `version`; crawl fail lúc trống thì rollback backup mới nhất (`rolledBack`), hết backup mới 502.
- `plans` + `providers` tĩnh; `models`/`pricing`/`plan_models` động hoàn toàn.

## Nguồn live

| Nguồn | Lấy gì |
|---|---|
| GOAT Flight: `"models":[...]`, `GoatEstimatesTable` (`$L45`) | Full shape model; budgets/rates/shape/fractions từng row |
| Pricing-limits HTML (`#<slug>-...`) | Cột **Was** (giá list) |
| Go page summary | Credits $10 cho derived rows |
| OpenCode Go (Astro): pricing / `#estimated-requests` / endpoints | Giá hiện hành, estimates, Model ID (join key) |
| AA `/models/<slug>` JSON-LD | Điểm intel exact cho model CMD thiếu điểm (map `AA_MODEL_SLUGS`, tròn 1dp) |

Kiểm chứng tay: `curl -A "Mozilla/5.0"` 2 lần + `cmp`. Runtime: fetch 1 + retry 1, zod guard. Chunk hash đổi mỗi deploy — dò qua HTML.

## Quota (mirror script `v8`+`ku`)

```
cost = shape.in/1e6×inputCost + shape.out/1e6×outputCost + shape.cache/1e6×cacheReadCost
month = budget/cost; 5h = ku(month×f5); tuần = ku(month×fw); ku = Number(n.toPrecision(3))
```

Shape riêng từng row (mặc định 800/180/50K). Output theo vendor khi thiếu (normalize bỏ dấu câu: `Z AI` → 150). Off-peak khi schedule live. Cache-read 50K thường gánh phần lớn cost.

## Merge

Go/GOAT only (`minPlanName` Pro/Max loại). Free + stealth loại. OC trùng CMD tái dùng id (unify `.`/`-`, bỏ vendor prefix, fallback tên). Pricing list-first, dedupe giữ entry đầu. Mọi bản ghi có `sourceUrl` + `fetchedAt`.

## Cấu hình

S3-compatible qua `nitro.storage` + peer dep `aws4fetch`. Env `S3_*` xem `.env.example` (không commit `.env`).

## Endpoints

- `GET .../database` → `{ database, fetchedAt, rolledBack }` (`X-Plan-Cache: HIT|FRESH|ROLLEDBACK|MISS`)
- `DELETE .../cache` → clear + archive (rate-limit 60s)
- `GET .../backups` → tóm tắt tối đa 3 bản

## Lệnh

```bash
pnpm exec vitest run modules/plan-comparison/
pnpm exec eslint modules/plan-comparison app nuxt.config.ts
pnpm run typecheck
```
