async function textFetchProxied(raw){
  const t = proxiedUrlFor(raw);
  if (!t) throw new Error('invalid');
  const res = await fetch(t);
  const ct = res.headers.get('content-type')||'';
  if (ct.includes('text/html')) return res.text();
  if (ct.includes('application/json')) return res.json();
  return res.arrayBuffer();
}
