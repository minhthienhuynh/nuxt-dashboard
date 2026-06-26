// Termius feature layer: SSH manager UI + the interactive terminal view.
// Extended from the root nuxt.config.ts. WebSocket is enabled here because the
// terminal bridge (server/routes/api/terminal.ts) is a WS handler.
export default defineNuxtConfig({
  nitro: {
    experimental: {
      websocket: true
    }
  }
})
