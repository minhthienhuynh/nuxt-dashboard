# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment

- **Node**: Managed via [nvm](https://github.com/nvm-sh/nvm). Run `nvm use` to switch to the project's Node version (pinned in `.nvmrc`).
- **Package manager**: pnpm 10+. Enable Corepack via `corepack enable pnpm` so the correct pnpm version is used automatically.

## Commands

```bash
nvm use          # Switch to project Node version
pnpm dev         # Dev server on http://localhost:3000
pnpm build       # Production build
pnpm preview     # Preview production build locally
pnpm lint        # ESLint
pnpm typecheck   # TypeScript type checking via nuxt typecheck
```

No test suite is configured.

## Architecture

This is a **Nuxt 4 dashboard template** powered by **Nuxt UI 4** and **Tailwind CSS v4**. Package manager: **pnpm 10+**.

### Directory structure

- `app/` — frontend (Nuxt 4 uses this instead of root-level `pages/`, `layouts/`, `components/`, `composables/`)
  - `app.config.ts` — Nuxt UI theme (primary: green, neutral: zinc)
  - `types/index.d.ts` — shared TypeScript interfaces (`User`, `Mail`, `Member`, `Stat`, `Sale`, `Notification`, `Period`, `Range`)
  - `composables/useDashboard.ts` — shared composable with keyboard shortcuts (`g-h`, `g-i`, `g-c`, `g-s` for navigation; `N` for notifications slideover)
  - `layouts/default.vue` — sidebar layout using `UDashboardGroup`, `UDashboardSidebar`, `UDashboardSearch`, and `UNavigationMenu`
- `server/api/` — API endpoints returning static mock data (`customers.ts`, `notifications.ts`, `mails.ts`, `members.ts`). Use `eventHandler()` from `h3`.
- `public/` — static assets

### Key patterns

- **Nuxt UI Pro components**: Uses `UDashboardPanel`, `UDashboardNavbar`, `UDashboardToolbar`, `UDashboardSidebar`, `UDashboardSearch`, `UDashboardGroup` — these are Nuxt UI Pro dashboard layout components.
- **Component resolution**: Components are auto-imported by Nuxt. Server API files in `server/api/` are auto-registered as `/api/*` routes.
- **Client/server split**: Components with `.client.vue` suffix render only client-side (e.g., `HomeChart.client.vue` using `@unovis/vue` charts). `.server.vue` renders only server-side.
- **resolveComponent for render functions**: When building table cells with `h()` render functions, components must be resolved via `resolveComponent('UAvatar')` etc. — see `pages/customers.vue`.
- **SSR-safe composables**: `useDashboard` wraps with `createSharedComposable` from `@vueuse/core` to share state across components.
- **Keyboard shortcuts**: Defined via `defineShortcuts()` in composables. Format: key combo to action mapping.
- **API route rules**: `nuxt.config.ts` sets `cors: true` for all `/api/**` routes.
- **ESLint**: Extends Nuxt's ESLint config with stylistic rules (no comma dangle, 1tbs brace style). Max 3 attributes per line for single-line Vue elements.
