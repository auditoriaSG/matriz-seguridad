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
        signOut:()=>client.auth.signOut({scope:'local'})
      }),
      matrix:Object.freeze({
        load:()=>client.from('matriz_seguridad').select('datos,actualizado_en').eq('id','principal').single(),
        save:(payload,userId)=>client.from('matriz_seguridad').update({datos:payload,actualizado_en:new Date().toISOString(),actualizado_por:userId}).eq('id','principal')
      }),
      admin:Object.freeze({
        loadSummary:()=>client.rpc('admin_resumen'),
        loadEmployeeDetails:()=>client.rpc('admin_plantilla_detalle'),
        loadRegional:()=>client.rpc('nexus_resumen_regional'),
        loadGeneral:()=>client.rpc('nexus_resumen_configuracion_general'),
        saveEmployee:command=>client.rpc('admin_guardar_empleado',command),
        setEmployeePin:(employeeId,pin)=>client.rpc('admin_establecer_pin_empleado',{p_empleado_id:employeeId,p_pin:pin}),
        verifyPin:pin=>client.rpc('seguridad_verificar_pin',{p_pin:pin}),
        saveCatalog:(type,command)=>client.rpc(type==='department'?'admin_guardar_departamento':'admin_guardar_puesto',command)
      }),
      records:Object.freeze({
        load:employeeId=>client.rpc('admin_documentos_empleado',{p_empleado_id:employeeId}),
        upload:(path,file)=>client.storage.from('expedientes-empleados').upload(path,file,{upsert:false}),
        register:command=>client.rpc('admin_registrar_documento_empleado',{
          p_empleado_id:command.employeeId,p_tipo_codigo:command.typeCode,p_ruta_storage:command.path,
          p_archivo_nombre:command.fileName,p_mime_tipo:command.mimeType,p_tamano_bytes:command.size
        }),
        async download(path){
          const {data,error}=await client.storage.from('expedientes-empleados').createSignedUrl(path,60,{download:true});
          return {data:data?.signedUrl||null,error};
        }
      }),
      access:Object.freeze({
        load:()=>client.rpc('nexus_panel_acceso'),
        saveProfile:command=>client.rpc('nexus_guardar_perfil',command),
        saveDecision:command=>client.rpc('nexus_guardar_decision',command),
        saveUser:command=>client.rpc('nexus_guardar_usuario',command),
        createUser:command=>client.functions.invoke('nexus-crear-usuario',{body:command})
      })
    });
  }

  global.SKAdapters=global.SKAdapters||{};
  global.SKAdapters.createSupabasePorts=createSupabasePorts;
})(window);
