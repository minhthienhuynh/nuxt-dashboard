# Termius - Nuxt Dashboard Template

## Commands
- **Setup**: Node 22 (`.nvmrc`). `pnpm` is provided by Corepack — if `pnpm` is missing after switching Node versions, run `corepack enable` once so the pinned `pnpm@11.6.0` becomes available (do **not** `npm i -g pnpm`, it drifts from the pinned version).
- **Install**: `pnpm install` (uses pnpm@11.6.0)
- **Dev**: `pnpm dev` — starts dev server on http://localhost:3000
- **Build**: `pnpm build` — production build
- **Preview**: `pnpm preview` — preview production build
- **Lint**: `pnpm lint` — runs eslint
- **Typecheck**: `pnpm typecheck` — runs `nuxt typecheck`
- **Test**: `pnpm test` — runs [Vitest](https://nuxt.com/docs/4.x/getting-started/testing). No tests exist yet, so a run reporting "No test files found" and exiting cleanly is expected for now.

## Testing
- Config: `vitest.config.ts` defines two Vitest projects (per the official Nuxt guide).
- `test/unit/*.{test,spec}.ts` — pure logic/utilities, run in the `node` environment (fast, no Nuxt runtime).
- `test/nuxt/*.{test,spec}.ts` — tests needing Nuxt auto-imports/composables, run in the `nuxt` environment.
- `passWithNoTests` is enabled so `pnpm test` exits 0 while the suite is empty.

## CI Order
`pnpm install` → `pnpm lint` → `pnpm typecheck`. `pnpm test` is not yet wired into CI.

## Architecture
- **Nuxt 4** with **Nuxt UI** module. All `U*` components (e.g. `UDashboardPanel`, `UTable`, `UButton`) are auto-imported from `@nuxt/ui` — never import them manually. Prefer Nuxt auto-imports for composables/utils too.
- **App entry**: `app/app.vue` — wraps `<UApp>` + `<NuxtLayout>` + `<NuxtPage>`, sets SEO/head.
- **Layout**: `app/layouts/default.vue` — dashboard shell (`UDashboardGroup` → sidebar + search + page slot + notifications slideover). Nav `links` are defined inline here as `NavigationMenuItem[][]`.
- **Pages**: `app/pages/` — index, customers, inbox, settings (nested: `settings/index`, `members`, `notifications`, `security`).
- **Components**: `app/components/` — organized by feature (customers, home, inbox, settings). Folder name becomes the component prefix (`home/HomeChart.vue` → `<HomeChart>`).
- **Composables**: `app/composables/useDashboard.ts` — shared via `createSharedComposable`; holds global state (notifications slideover) and registers keyboard shortcuts with `defineShortcuts` (`g-h`, `g-i`, `g-c`, `g-s`, `n`).
- **Types**: `app/types/index.d.ts` — central domain types (`User`, `Mail`, `Member`, `Sale`, `Notification`, `Period`, `Range`). Import via `~/types`.
- **Utils**: `app/utils/index.ts` — auto-imported helpers (`randomInt`, `randomFrom`).
- **Server API**: `server/api/` — Nitro `eventHandler` routes returning hard-coded **in-memory mock data** (customers, mails, members, notifications). No database. `/api/**` has CORS enabled.

## Data Flow
- Pages fetch endpoints with `useFetch<T>('/api/...', { lazy: true })`, typed against `~/types`.
- Tables use `@tanstack/table-core` models (e.g. `getPaginationRowModel`) wired into `UTable`.
- Charts use `@unovis/vue`, with `.client.vue`/`.server.vue` component variants for SSR splitting (see `home/HomeChart`).

## Conventions
- ESLint stylistic (`nuxt.config.ts`): **no trailing commas** (`commaDangle: 'never'`), **1tbs** brace style, max **3** attributes per line on single-line Vue tags. Run `pnpm lint --fix` instead of formatting by hand.
- `<script setup lang="ts">` everywhere.
- UI theme in `app/app.config.ts` (primary `green`, neutral `zinc`).
- Dependencies kept current by Renovate (`renovate.json`); most `main` commits are dependency bumps.

## Key Config
- `nuxt.config.ts` — modules: `@nuxt/eslint`, `@nuxt/ui`, `@vueuse/nuxt`; CSS: `~/assets/css/main.css`
- `eslint.config.mjs` — extends `.nuxt/eslint.config.mjs`; custom rules for Vue
- `tsconfig.json` — references generated `.nuxt/tsconfig.*.json`
- Node 22, pnpm 11.6.0 (`.nvmrc`, `package.json`, CI) — pnpm via Corepack (`corepack enable`)

## Env
- `.env.example` exists — copy to `.env` if needed