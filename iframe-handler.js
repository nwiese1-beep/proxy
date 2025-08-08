const frame = document.getElementById('proxyFrame');
frame.addEventListener('load', ()=> {
  try { frame.contentWindow.document.title && setTitle(frame.contentWindow.document.title); } catch {}
});
function setTitle(t){
  document.title = t + ' - Proxy';
}
window.frameNavigate = function(url){ const p = proxiedUrlFor(url); if (p) frame.src = p; };
