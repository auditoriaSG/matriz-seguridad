(function(global){
  function createApplication(ports,domain){
    if(!ports?.auth||!ports?.matrix||!ports?.admin||!ports?.localState)throw new Error('Faltan puertos para iniciar la aplicación');

    return Object.freeze({
      auth:Object.freeze({
        restoreSession:()=>ports.auth.getVerifiedUser(),
        signIn:(email,password)=>ports.auth.signIn(email,password),
        signOut:()=>ports.auth.signOut()
      }),
      matrix:Object.freeze({
        loadLocal:()=>domain.normalizeState(ports.localState.load()),
        saveLocal:state=>ports.localState.save(domain.normalizeState(state)),
        loadCloud:()=>ports.matrix.load(),
        saveCloud:(state,userId)=>ports.matrix.save(domain.toCloudPayload(state),userId),
        hasCloudData:payload=>domain.hasConfiguredProfiles(payload)
      }),
      admin:Object.freeze({
        async load(){
          const [summaryResult,detailResult]=await Promise.all([ports.admin.loadSummary(),ports.admin.loadEmployeeDetails()]);
          if(summaryResult.error)return {data:null,error:summaryResult.error};
          return {data:domain.mergeAdministrativeData(summaryResult.data,detailResult.data),error:detailResult.error||null};
        },
        saveEmployee:command=>ports.admin.saveEmployee(command),
        saveCatalog:(type,command)=>ports.admin.saveCatalog(type,command)
      })
    });
  }

  global.SKApplication=Object.freeze({createApplication});
})(window);
