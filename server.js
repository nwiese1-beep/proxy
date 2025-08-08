const express = require('express');
const http = require('http');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { createProxyServer } = require('http-proxy');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const url = require('url');

const SITE_PASSWORD = '314159';
const AUTH_COOKIE_NAME = 'proxy_auth_v1';
const PROXY_PATH = '/proxy';
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const proxy = createProxyServer({ changeOrigin: true, ws: true });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(__dirname));

app.get('/login', (req, res) => res.sendFile(__dirname + '/login.html'));
app.post('/login', (req, res) => {
  const pw = req.body.password || '';
  if (pw === SITE_PASSWORD) {
    res.cookie(AUTH_COOKIE_NAME, '1', { maxAge: 1000 * 60 * 60 * 12, httpOnly: true, sameSite: 'lax' });
    return res.redirect('/');
  }
  return res.status(401).send('<h3>Invalid password</h3><p><a href="/login">Retry</a></p>');
});
app.get('/', (req, res) => {
  if (req.cookies[AUTH_COOKIE_NAME] === '1') {
    return res.sendFile(__dirname + '/index.html');
  }
  return res.redirect('/login');
});

function normalizeTarget(raw) {
  if (!raw) return null;
  raw = raw.trim();
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try { return new URL(raw).toString(); } catch { return null; }
}

function filterResponseHeaders(headers) {
  const blocked = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only', 'x-content-security-policy'];
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (blocked.includes(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}

async function rewriteHtml(body, baseUrl) {
  const $ = cheerio.load(body, { decodeEntities: false });
  function rewriteAttr(raw) {
    if (!raw) return raw;
    if (/^\s*data:/i.test(raw) || /^\s*javascript:/i.test(raw) || /^\s*mailto:/i.test(raw) || /^\s*#/i.test(raw)) return raw;
    try {
      const abs = new URL(raw, baseUrl).toString();
      return PROXY_PATH + '?url=' + encodeURIComponent(abs);
    } catch (e) { return raw; }
  }
  $('*[href]').each((i, el) => { const v = $(el).attr('href'); $(el).attr('href', rewriteAttr(v)); });
  $('img[src]').each((i, el) => { const v = $(el).attr('src'); $(el).attr('src', rewriteAttr(v)); });
  $('img[srcset]').each((i, el) => {
    const v = $(el).attr('srcset');
    if (!v) return;
    const parts = v.split(',').map(s => { const [u, size] = s.trim().split(/\s+/); return rewriteAttr(u) + (size ? ' ' + size : ''); });
    $(el).attr('srcset', parts.join(', '));
  });
  $('video[poster]').each((i, el) => { const p = $(el).attr('poster'); $(el).attr('poster', rewriteAttr(p)); });
  $('script[src]').each((i, el) => { const v = $(el).attr('src'); $(el).attr('src', rewriteAttr(v)); });
  $('link[rel="stylesheet"]').each((i, el) => { const v = $(el).attr('href'); $(el).attr('href', rewriteAttr(v)); });
  $('form[action]').each((i, el) => {
    const v = $(el).attr('action');
    try { $(el).attr('action', PROXY_PATH + '?url=' + encodeURIComponent(new URL(v, baseUrl).toString())); } catch { $(el).attr('action', v); }
  });
  $('style').each((i, el) => {
    const txt = $(el).html();
    const replaced = txt.replace(/url\(([^)]+)\)/g, (m, p1) => {
      let v = p1.trim().replace(/^['"]|['"]$/g, '');
      try { const abs = new URL(v, baseUrl).toString(); return `url("${PROXY_PATH}?url=${encodeURIComponent(abs)}")`; } catch { return m; }
    });
    $(el).html(replaced);
  });
  $('*[style]').each((i, el) => {
    const st = $(el).attr('style') || '';
    const replaced = st.replace(/url\(([^)]+)\)/g, (m, p1) => {
      let v = p1.trim().replace(/^['"]|['"]$/g, '');
      try { const abs = new URL(v, baseUrl).toString(); return `url("${PROXY_PATH}?url=${encodeURIComponent(abs)}")`; } catch { return m; }
    });
    $(el).attr('style', replaced);
  });
  $('head').prepend('<meta name="referrer" content="no-referrer">');
  if ($('base').length === 0) $('head').prepend(`<base href="${baseUrl}">`);
  return $.html();
}

app.all(PROXY_PATH, async (req, res) => {
  if (req.cookies[AUTH_COOKIE_NAME] !== '1') return res.status(403).send('Forbidden: not authenticated. Please <a href="/login">login</a>.');
  const rawUrl = req.query.url || req.body.url;
  const target = normalizeTarget(rawUrl);
  if (!target) return res.status(400).send('Bad request: missing or invalid url parameter.');

  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    return proxy.web(req, res, { target, changeOrigin: true }, (err) => { res.writeHead(502); res.end('Bad gateway (websocket)'); });
  }

  const method = req.method.toUpperCase();
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (['host', 'accept-encoding', 'content-length'].includes(k.toLowerCase())) continue;
    headers[k] = v;
  }

  try {
    const upstreamResp = await fetch(target, { method, headers, redirect: 'manual' });
    if (upstreamResp.status >= 300 && upstreamResp.status < 400 && upstreamResp.headers.get('location')) {
      const loc = upstreamResp.headers.get('location');
      let newLoc;
      try { newLoc = new URL(loc, target).toString(); } catch { newLoc = loc; }
      const proxied = PROXY_PATH + '?url=' + encodeURIComponent(newLoc);
      res.setHeader('location', proxied);
      return res.status(upstreamResp.status).end();
    }

    const rawHeaders = {};
    upstreamResp.headers.forEach((v, k) => rawHeaders[k] = v);
    const safeHeaders = filterResponseHeaders(rawHeaders);
    for (const [k, v] of Object.entries(safeHeaders)) {
      if (k.toLowerCase() === 'content-length') continue;
      res.setHeader(k, v);
    }

    const contentType = upstreamResp.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      const text = await upstreamResp.text();
      const rewritten = await rewriteHtml(text, upstreamResp.url || target);
      res.setHeader('content-type', 'text/html; charset=utf-8');
      return res.status(upstreamResp.status).send(rewritten);
    } else {
      res.status(upstreamResp.status);
      upstreamResp.body.pipe(res);
    }
  } catch (err) {
    return res.status(502).send('Bad gateway: failed to fetch target.');
  }
});

proxy.on('error', (err, req, res) => {
  try { if (!res.headersSent) { res.writeHead(502, { 'Content-Type': 'text/plain' }); } res.end('Bad gateway: proxy error.'); } catch(e){}
});

server.on('upgrade', (req, socket, head) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname !== PROXY_PATH) { socket.end(); return; }
  const target = normalizeTarget(parsed.query.url);
  if (!target) { socket.end(); return; }
  proxy.ws(req, socket, head, { target, changeOrigin: true }, () => { socket.end(); });
});

server.listen(PORT, () => console.log(`Listening ${PORT}`));
