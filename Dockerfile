# syntax=docker/dockerfile:1
# Nuxt 4 (Nitro node-server) — multi-stage, toi uu cache cho Dokploy.
#
# S3 credentials KHONG di qua build: nuxt.config khong con khai bao
# nitro.storage — plugin runtime modules/plan-comparison/runtime/server/
# plugins/plan-comparison-storage.ts doc env S3_* (hoac NUXT_PLAN_COMPARISON_S3_*)
# luc container boot. Build chay sach khong can bat ky S3 env nao.

ARG NODE_VERSION=22.20.0

# ---------- deps: cai 1 lan, cache theo lockfile ----------
FROM node:${NODE_VERSION}-slim AS deps
RUN npm i -g pnpm@11.24.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# ---------- build ----------
FROM node:${NODE_VERSION}-slim AS build
RUN npm i -g pnpm@11.24.0
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=cache,target=/app/node_modules/.cache \
    NITRO_PRESET=node-server pnpm run build

# ---------- runtime: chi mang .output (~nhe, khong node_modules thua) ----------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nuxt
COPY --from=build --chown=nuxt:nodejs /app/.output ./.output
USER nuxt
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
