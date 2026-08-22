(function(global){
  function createApplication(ports,domain){
    if(!ports?.auth||!ports?.matrix||!ports?.admin||!ports?.access||!ports?.localState)throw new Error('Faltan puertos para iniciar la aplicación');

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
          const [summaryResult,detailResult,regionalResult,generalResult]=await Promise.all([ports.admin.loadSummary(),ports.admin.loadEmployeeDetails(),ports.admin.loadRegional(),ports.admin.loadGeneral()]);
          if(summaryResult.error)return {data:null,error:summaryResult.error};
          const data=domain.mergeAdministrativeData(summaryResult.data,detailResult.data);
          if(regionalResult.data)Object.assign(data,regionalResult.data);
          data.configuracion_general=generalResult.data||{};
          return {data,error:detailResult.error||regionalResult.error||generalResult.error||null};
        },
        saveEmployee:command=>ports.admin.saveEmployee(command),
        setEmployeePin:(employeeId,pin)=>ports.admin.setEmployeePin(employeeId,pin),
        verifyPin:pin=>ports.admin.verifyPin(pin),
        saveCatalog:(type,command)=>ports.admin.saveCatalog(type,command)
      }),
      access:Object.freeze({
        load:()=>ports.access.load(),
        saveProfile:command=>ports.access.saveProfile(command),
        saveDecision:command=>ports.access.saveDecision(command),
        saveUser:command=>ports.access.saveUser(command)
      })
    });
  }

  global.SKApplication=Object.freeze({createApplication});
})(window);
