(function(global){
  function createBrowserStatePort(storage,key){
    return Object.freeze({
      load(){
        try{return JSON.parse(storage.getItem(key))||{}}catch{return {}}
      },
      save(state){storage.setItem(key,JSON.stringify(state));return state}
    });
  }

  global.SKAdapters=global.SKAdapters||{};
  global.SKAdapters.createBrowserStatePort=createBrowserStatePort;
})(window);
