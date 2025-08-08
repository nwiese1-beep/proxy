function openWebSocketThroughProxy(targetUrl){
  try {
    const wsUrl = new URL(targetUrl);
    const proxyUrl = '/proxy?url=' + encodeURIComponent(wsUrl.toString());
    const ws = new WebSocket(proxyUrl.replace(/^http/, 'ws'));
    ws.onopen = ()=> console.log('ws open');
    ws.onmessage = m=> console.log('ws msg', m);
    ws.onclose = ()=> console.log('ws closed');
    return ws;
  } catch(e){ return null; }
}
