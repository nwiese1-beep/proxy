window.addEventListener('error', function(e){
  try { fetch('/_pp_error', {method:'POST', body: JSON.stringify({msg:e.message, stack:e.error?e.error.stack:null})}); } catch {}
});
