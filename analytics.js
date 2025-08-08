(function(){
  window.pp_analytics = {
    events: [],
    track: function(name, data){ this.events.push({name, data, t:Date.now()}); if (this.events.length>100) this.events.shift(); }
  };
})();
