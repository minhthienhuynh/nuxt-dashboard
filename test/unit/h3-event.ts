import type { H3Event } from 'h3'

export interface MockEventInit {
  method?: string
  path?: string
  params?: Record<string, string>
  body?: unknown
}

// Minimal h3 v1 event for unit-testing Nitro handlers without a running server.
// Mirrors exactly what the CRUD handlers read under h3 v1:
//  - event.method          → POST/PUT/DELETE branch
//  - event.path            → getQuery() parses the querystring (no `new URL()`)
//  - event.context.params  → getValidatedRouterParams()
//  - event._requestBody    → readBody() for payload methods (content-type json)
//
// Using a v1-shaped event (not h3 v2's mockEvent) is deliberate: the runtime is
// h3 v1, so tests must exercise the same code path that Nitro does.
export function mockH3Event(init: MockEventInit = {}): H3Event {
  const method = init.method ?? 'GET'
  const event = {
    method,
    path: init.path ?? '/',
    context: { params: init.params ?? {} },
    _requestBody: init.body,
    node: { req: { method, headers: { 'content-type': 'application/json' } } }
  }
  return event as unknown as H3Event
}
