// server.js
// Modern proxy server. Flat-file repo. Run: npm install && npm start
const express = require('express');
const http = require('http');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { createProxyServer } = require('http-proxy');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const url = require('url');

const SITE_PASSWORD = '314159'; // site password as requested
const AUTH_COOKIE_NAME = 'proxy_auth_v1';
const PROXY_PATH = '/proxy'; // route used to proxy pages
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

// http-proxy instance for non-HTML streaming & websocket proxying
const proxy = createProxyServer({
  changeOrigin: true,
  selfHandleResponse: false,
  ws: true
});

// Basic security headers
app.use(helmet({
  contentSecurityPolicy: false // we modify CSP ourselves sometimes
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Serve login page and static UI pages (flat files provided below)
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});
app.post('/login', (req, res) => {
  const pw = req.body.password || '';
  if (pw === SITE_PASSWORD) {
    // set cookie (not httpOnly so client-side JS can read if needed; you can set httpOnly:true if you prefer)
    res.cookie(AUTH_COOKIE_NAME, '1', { maxAge: 1000 * 60 * 60 * 12, httpOnly: true, sameSite: 'lax' });
    return res.redirect('/');
  }
  return res.status(401).send('<h3>Invalid password</h3><p><a href="/login">Try again</a></p>');
});

// Main UI (requires auth cookie)
app.get('/', (req, res) => {
  if (req.cookies[AUTH_COOKIE_NAME] === '1') {
    return res.sendFile(__dirname + '/index.html');
  }
  return res.redirect('/login');
});

// Helper to validate/normalize incoming target URLs
function normalizeTarget(raw) {
  if (!raw) return null;
  raw = raw.trim();
  // if no scheme, assume https
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try {
    const u = new URL(raw);
    return u.toString();
  } catch (e) {
    return null;
  }
}

// Remove headers that would block framing or break proxying
function filterResponseHeaders(headers) {
  const blocked = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'x-content-security-policy'];
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (blocked.includes(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

// Rewrites HTML: attributes that contain URLs are rewritten to point back through our proxy.
// baseUrl: the absolute URL of the page we fetched; returns modified HTML string
async function rewriteHtml(body, baseUrl) {
  const $ = cheerio.load(body, { decodeEntities: false });

  // Utility to resolve & rewrite a URL to /proxy?url=...
  function rewriteAttr(raw) {
    if (!raw) return raw;
    // data: URLs and javascript: should be left intact
    if (/^\s*data:/i.test(raw) || /^\s*javascript:/i.test(raw) || /^\s*mailto:/i.test(raw) || /^\s*#/i.test(raw)) return raw;
    try {
      const abs = new URL(raw, baseUrl).toString();
      return PROXY_PATH + '?url=' + encodeURIComponent(abs);
    } catch (e) {
      return raw;
    }
  }

  // Attributes to rewrite
  const ATTRS = ['href', 'src', 'srcset', 'data-src', 'data-href', 'poster'];

  // Rewrite tags with src/srcset/href/action
  $('*[href]').each((i, el) => {
    const v = $(el).attr('href');
    $(el).attr('href', rewriteAttr(v));
  });
  $('img[src]').each((i, el) => {
    const v = $(el).attr('src');
    $(el).attr('src', rewriteAttr(v));
  });
  $('img[srcset]').each((i, el) => {
    const v = $(el).attr('srcset');
    if (!v) return;
    // rewrite each candidate
    const parts = v.split(',').map(s => {
      const [u, size] = s.trim().split(/\s+/);
      return rewriteAttr(u) + (size ? ' ' + size : '');
    });
    $(el).attr('srcset', parts.join(', '));
  });
  $('video[poster]').each((i, el) => {
    const p = $(el).attr('poster');
    $(el).attr('poster', rewriteAttr(p));
  });
  $('script[src]').each((i, el) => {
    const v = $(el).attr('src');
    $(el).attr('src', rewriteAttr(v));
  });
  $('link[rel="stylesheet"]').each((i, el) => {
    const v = $(el).attr('href');
    $(el).attr('href', rewriteAttr(v));
  });
  $('form[action]').each((i, el) => {
    const v = $(el).attr('action');
    // We rewrite form actions to proxy but keep method intact
    $(el).attr('action', PROXY_PATH + '?url=' + encodeURIComponent(new URL(v, baseUrl).toString()));
  });

  // Inline CSS url(...) rewriting in style tags and style attributes
  $('style').each((i, el) => {
    const txt = $(el).html();
    const replaced = txt.replace(/url\(([^)]+)\)/g, (m, p1) => {
      let v = p1.trim().replace(/^['"]|['"]$/g, '');
      if (/^\s*data:/i.test(v) || /^\s*http/i.test(v)) {
        try {
          const abs = new URL(v, baseUrl).toString();
          return `url("${PROXY_PATH}?url=${encodeURIComponent(abs)}")`;
        } catch {
          return m;
        }
      } else {
        try {
          const abs = new URL(v, baseUrl).toString();
          return `url("${PROXY_PATH}?url=${encodeURIComponent(abs)}")`;
        } catch {
          return m;
        }
      }
    });
    $(el).html(replaced);
  });
  // style attributes
  $('*[style]').each((i, el) => {
    const st = $(el).attr('style') || '';
    const replaced = st.replace(/url\(([^)]+)\)/g, (m, p1) => {
      let v = p1.trim().replace(/^['"]|['"]$/g, '');
      try {
        const abs = new URL(v, baseUrl).toString();
        return `url("${PROXY_PATH}?url=${encodeURIComponent(abs)}")`;
      } catch {
        return m;
      }
    });
    $(el).attr('style', replaced);
  });

  // Add a small meta tag to prevent robots indexing (optional)
  $('head').prepend('<meta name="referrer" content="no-referrer">');

  // Make sure base tag exists so relative links are handled by us (but we still rewrite most links).
  if ($('base').length === 0) {
    $('head').prepend(`<base href="${baseUrl}">`);
  }

  return $.html();
}

// Proxy route: GET or POST to /proxy?url=<encoded>
// For non-HTML content we stream through using http-proxy; for HTML we fetch, rewrite, and send modified HTML.
app.all(PROXY_PATH, async (req, res, next) => {
  // check auth cookie
  if (req.cookies[AUTH_COOKIE_NAME] !== '1') {
    return res.status(403).send('Forbidden: not authenticated. Please <a href="/login">login</a>.');
  }

  const rawUrl = req.query.url || req.body.url;
  const target = normalizeTarget(rawUrl);
  if (!target) return res.status(400).send('Bad request: missing or invalid url parameter.');

  // If request is websocket upgrade, fall back to proxy (upgrade handled elsewhere)
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    // Let http-proxy handle it in upgrade handler
    return proxy.web(req, res, { target, changeOrigin: true }, (err) => {
      console.error('WS proxy error', err && err.message);
      res.writeHead(502);
      res.end('Bad gateway (websocket proxy failed).');
    });
  }

  // For POST (form submit), we will pass through the body to target using fetch
  const method = req.method.toUpperCase();

  // Make fetch options, copy headers but not host/accept-encoding (we handle compression)
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (['host', 'accept-encoding', 'content-length'].includes(k.toLowerCase())) continue;
    headers[k] = v;
  }

  // If not GET, capture body
  let body = null;
  if (method !== 'GET' && method !== 'HEAD') {
    body = req.body && Object.keys(req.body).length ? req.body : undefined;
    // If raw body needed, prefer raw stream, but for simplicity we use JSON/form depending on headers
  }

  try {
    const upstreamResp = await fetch(target, {
      method,
      headers,
      body: (method !== 'GET' && method !== 'HEAD') ? (req.rawBody || JSON.stringify(body) || null) : undefined,
      redirect: 'manual'
    });

    // If upstream redirected, follow and proxy the redirected location (or rewrite to proxied URL)
    if (upstreamResp.status >= 300 && upstreamResp.status < 400 && upstreamResp.headers.get('location')) {
      const loc = upstreamResp.headers.get('location');
      // make absolute
      let newLoc;
      try { newLoc = new URL(loc, target).toString(); } catch(e) { newLoc = loc; }
      const proxied = PROXY_PATH + '?url=' + encodeURIComponent(newLoc);
      res.setHeader('location', proxied);
      return res.status(upstreamResp.status).end();
    }

    // Pass through headers except those we want to strip
    const rawHeaders = {};
    upstreamResp.headers.forEach((v, k) => rawHeaders[k] = v);
    const safeHeaders = filterResponseHeaders(rawHeaders);
    for (const [k, v] of Object.entries(safeHeaders)) {
      // Do not set content-length if we modify the body
      if (k.toLowerCase() === 'content-length') continue;
      res.setHeader(k, v);
    }

    const contentType = upstreamResp.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      // Buffer HTML, rewrite, then send
      const text = await upstreamResp.text();
      const rewritten = await rewriteHtml(text, upstreamResp.url || target);
      // Slightly modify CSP and other headers
      res.setHeader('content-type', 'text/html; charset=utf-8');
      return res.status(upstreamResp.status).send(rewritten);
    } else {
      // Stream binary or other content directly to client
      res.status(upstreamResp.status);
      upstreamResp.body.pipe(res);
    }
  } catch (err) {
    console.error('Error proxying', err && err.stack ? err.stack : err);
    return res.status(502).send('Bad gateway: failed to fetch target.');
  }
});

// Use http-proxy for websocket upgrades & fallback proxy for non-HTML requests that we want to stream
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err && err.message);
  try {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    res.end('Bad gateway: proxy error.');
  } catch (e) {
    // ignore
  }
});

// For other routes that look like resources direct to target (optional helper)
app.get('/r', (req, res) => {
  // shortcut route: /r?url=...
  return app.handle(req, res);
});

// Upgrade handler for WebSockets - forward to target determined by url param in query
server.on('upgrade', (req, socket, head) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname !== PROXY_PATH) {
    socket.end();
    return;
  }
  const target = normalizeTarget(parsed.query.url);
  if (!target) {
    socket.end();
    return;
  }
  proxy.ws(req, socket, head, { target, changeOrigin: true }, (err) => {
    console.error('WS upgrade proxy failed', err && err.message);
    try { socket.end(); } catch (e) {}
  });
});

// Start server
server.listen(PORT, () => console.log(`Proxy server running on port ${PORT}. Visit http://localhost:${PORT}/login`));
