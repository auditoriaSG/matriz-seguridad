(function(global){
  const config={
    supabaseUrl:'https://amlweohcbadjdqscoajp.supabase.co',
    supabasePublishableKey:'sb_publishable_EhpzIT3LJVEWkjfG3wQ9Ew_G1og6EiC',
    localStorageKey:'matriz-seguridad-v1'
  };
  const remote=global.SKAdapters.createSupabasePorts({url:config.supabaseUrl,publishableKey:config.supabasePublishableKey});
  if(!remote){global.SKApp=null;return}
  const ports={...remote,localState:global.SKAdapters.createBrowserStatePort(global.localStorage,config.localStorageKey)};
  global.SKApp=global.SKApplication.createApplication(ports,global.SKDomain);
})(window);
