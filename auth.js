(function(){
  function hasAuth(){
    return document.cookie.split(';').some(c=>c.trim().startsWith('proxy_auth_v1='));
  }
  if (location.pathname === '/' && !hasAuth()) {
    location.href = '/login';
  }
})();
