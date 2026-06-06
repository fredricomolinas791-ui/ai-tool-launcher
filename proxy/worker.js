/* ─────────────────────────────────────────────────────────────────────
 *  AI Tools Launcher — CORS / Streaming Reverse Proxy
 *  ─────────────────────────────────────────────────────────────────────
 *  Cloudflare Worker that forwards browser requests to upstream AI
 *  providers and adds permissive CORS headers so the SPA can call
 *  them directly from the user's browser.
 *
 *  Why this exists
 *  ---------------
 *  Most AI providers (MiniMax, DeepSeek, Moonshot, Volcengine Ark,
 *  ...) do not return CORS headers wide enough for direct browser
 *  calls. In dev, the Vite dev server already proxies via `/proxy/*`.
 *  In production, this Worker plays the same role at the edge.
 *
 *  Routes
 *  ------
 *    /proxy/minimaxi/*  → https://api.minimaxi.com/*
 *    /proxy/deepseek/*  → https://api.deepseek.com*
 *    /proxy/openai/*    → https://api.openai.com*
 *    /proxy/anthropic/* → https://api.anthropic.com*
 *
 *  Deploy
 *  ------
 *    1. Install wrangler:     npm i -g wrangler   (or use npx)
 *    2. Login:                npx wrangler login
 *    3. Deploy:               npm run deploy:proxy
 *       → returns a URL like https://ai-proxy.<subdomain>.workers.dev
 *    4. In the app's Settings → AI Provider, set BASE URL to:
 *         https://ai-proxy.<subdomain>.workers.dev/proxy/minimaxi/anthropic/v1
 * ───────────────────────────────────────────────────────────────────── */

/** Add new providers by appending to this list. The first segment after
 *  /proxy/ must match a route's `prefix`; the rest is forwarded verbatim. */
const ROUTES = [
  { prefix: '/proxy/minimaxi/',  target: 'https://api.minimaxi.com'  },
  { prefix: '/proxy/deepseek/',  target: 'https://api.deepseek.com'  },
  { prefix: '/proxy/openai/',    target: 'https://api.openai.com'    },
  { prefix: '/proxy/anthropic/', target: 'https://api.anthropic.com' },
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  // Allow everything: providers use a long tail of custom headers
  // (X-Api-Key, anthropic-version, anthropic-dangerous-direct-browser-access,
  // anthropic-beta, openai-organization, ...). Listing them all here
  // is brittle; the wildcard is the right call for an opaque proxy.
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  // SSE / streaming responses expose a few headers browsers won't reveal
  // by default — without these, getReader() can't see event types.
  'Access-Control-Expose-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export default {
  /** Handle CORS preflight without touching the upstream. */
  async fetch(request, _env, _ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const route = ROUTES.find((r) => url.pathname.startsWith(r.prefix));
    if (!route) {
      return new Response('Not Found: no route for ' + url.pathname, {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS },
      });
    }

    // Build the upstream URL: strip the /proxy/<name> prefix and glue
    // the rest onto the target origin. The trailing `+ url.search`
    // preserves query strings.
    const stripped = url.pathname.slice(route.prefix.length - 1); // keep leading '/'
    const targetUrl = route.target + stripped + url.search;

    // Build outbound headers. Preserve everything the client sent EXCEPT
    // Host (must match upstream origin for SNI / virtual-host routing)
    // and a few hop-by-hop headers that don't survive proxies.
    const outHeaders = new Headers();
    for (const [k, v] of request.headers.entries()) {
      const lower = k.toLowerCase();
      if (lower === 'host' || lower === 'connection' || lower === 'content-length') continue;
      outHeaders.set(k, v);
    }
    outHeaders.set('Host', new URL(route.target).host);

    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: outHeaders,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'follow',
    });

    // Copy upstream's response headers, then layer CORS on top.
    // Don't touch Content-Encoding / Transfer-Encoding — Cloudflare
    // already handles those for the streamed body.
    const respHeaders = new Headers();
    for (const [k, v] of upstream.headers.entries()) {
      const lower = k.toLowerCase();
      if (lower === 'access-control-allow-origin') continue; // we set our own
      if (lower === 'content-length') continue; // body length is recomputed
      respHeaders.set(k, v);
    }
    for (const [k, v] of Object.entries(CORS_HEADERS)) respHeaders.set(k, v);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });
  },
};
