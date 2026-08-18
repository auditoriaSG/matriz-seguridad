(function(global){
  function createSupabasePorts(config){
    const client=global.supabase?.createClient(config.url,config.publishableKey);
    if(!client)return null;

    return Object.freeze({
      auth:Object.freeze({
        async getVerifiedUser(){
          const {data,error}=await client.auth.getUser();
          return {user:data?.user||null,error:error||null};
        },
        async signIn(email,password){
          const {data,error}=await client.auth.signInWithPassword({email,password});
          return {user:data?.user||null,error:error||null};
        },
        signOut:()=>client.auth.signOut()
      }),
      matrix:Object.freeze({
        load:()=>client.from('matriz_seguridad').select('datos,actualizado_en').eq('id','principal').single(),
        save:(payload,userId)=>client.from('matriz_seguridad').update({datos:payload,actualizado_en:new Date().toISOString(),actualizado_por:userId}).eq('id','principal')
      }),
      admin:Object.freeze({
        loadSummary:()=>client.rpc('admin_resumen'),
        loadEmployeeDetails:()=>client.rpc('admin_plantilla_detalle'),
        saveEmployee:command=>client.rpc('admin_guardar_empleado',command),
        saveCatalog:(type,command)=>client.rpc(type==='department'?'admin_guardar_departamento':'admin_guardar_puesto',command)
      })
    });
  }

  global.SKAdapters=global.SKAdapters||{};
  global.SKAdapters.createSupabasePorts=createSupabasePorts;
})(window);
