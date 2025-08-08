function showModal(title, message){
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '50%';
  el.style.top = '50%';
  el.style.transform = 'translate(-50%,-50%)';
  el.style.background = 'var(--card)';
  el.style.padding = '18px';
  el.style.borderRadius = '12px';
  el.style.color = 'var(--muted)';
  el.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';
  el.innerHTML = `<strong style="color:white">${title}</strong><div style="margin-top:8px">${message}</div><div style="text-align:right;margin-top:12px"><button id="mclose">Close</button></div>`;
  document.body.appendChild(el);
  document.getElementById('mclose').addEventListener('click', ()=> el.remove());
}
