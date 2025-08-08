const quick = [
  {t:'YouTube', u:'https://youtube.com'},
  {t:'Spotify', u:'https://spotify.com'},
  {t:'Twitter', u:'https://twitter.com'},
  {t:'GitHub', u:'https://github.com'},
  {t:'Reddit', u:'https://reddit.com'}
];
const quickbar = document.getElementById('quickbar');
quick.forEach(q=>{
  const b = document.createElement('button');
  b.innerText = q.t;
  b.addEventListener('click', ()=> openProxied(q.u));
  quickbar.appendChild(b);
});
