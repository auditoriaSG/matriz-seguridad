(function(global){
  const config={
    supabaseUrl:'https://amlweohcbadjdqscoajp.supabase.co',
    supabasePublishableKey:'sb_publishable_EhpzIT3LJVEWkjfG3wQ9Ew_G1og6EiC',
    localStorageKey:'matriz-seguridad-v1'
  };
  const localPreview=['localhost','127.0.0.1'].includes(global.location.hostname);
  const remote=localPreview?null:global.SKAdapters.createSupabasePorts({url:config.supabaseUrl,publishableKey:config.supabasePublishableKey});
  const ports=localPreview
    ?global.SKAdapters.createLocalPreviewPorts(global.localStorage,config.localStorageKey+'-local-preview-v2',config.localStorageKey+'-admin-local-v3','local-data/admin-snapshot.json','local-data/matrix-snapshot.json')
    :{...remote,localState:global.SKAdapters.createBrowserStatePort(global.localStorage,config.localStorageKey)};
  if(!ports){global.SKApp=null;return}
  global.SKApp=global.SKApplication.createApplication(ports,global.SKDomain);
  if(localPreview){
    global.document.documentElement.classList.add('local-preview');
    const notice=global.document.createElement('div');
    notice.className='local-preview-notice';
    notice.textContent='ENTORNO LOCAL · Los cambios se guardan solamente en esta computadora';
    global.document.body.prepend(notice);
  }
})(window);
