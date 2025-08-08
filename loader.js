function showLoader(){
  let el = document.getElementById('pp_loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pp_loader';
    el.style.position = 'fixed';
    el.style.left = '12px';
    el.style.top = '12px';
    el.style.padding = '8px 12px';
    el.style.borderRadius = '8px';
    el.style.background = 'rgba(0,0,0,0.5)';
    el.style.color = 'white';
    el.style.zIndex = 9999;
    el.innerText = 'Loading...';
    document.body.appendChild(el);
  }
  el.style.display = 'block';
}
function hideLoader(){ const el = document.getElementById('pp_loader'); if (el) el.style.display = 'none'; }
