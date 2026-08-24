(function(global){
  const clone=value=>JSON.parse(JSON.stringify(value));
  const ok=data=>Promise.resolve({data:clone(data),error:null});
  function createLocalPreviewPorts(storage,matrixKey,adminKey,snapshotUrl,matrixSnapshotUrl){
    const browserMatrixState=global.SKAdapters.createBrowserStatePort(storage,matrixKey);
    const matrixState={
      load(){
        const stored=browserMatrixState.load();
        if(stored?.values&&Object.keys(stored.values).length)return stored;
        try{
          const request=new XMLHttpRequest();
          request.open('GET',matrixSnapshotUrl,false);
          request.send(null);
          if(request.status>=200&&request.status<300){
            const snapshot=JSON.parse(request.responseText);
            browserMatrixState.save(snapshot);
            return snapshot;
          }
        }catch(error){console.warn('No se pudo cargar la matriz local completa',error)}
        return stored;
      },
      save:state=>browserMatrixState.save(state)
    };
    let adminCache=null;
    async function loadAdmin(){if(adminCache)return adminCache;const stored=storage.getItem(adminKey);if(stored){adminCache=JSON.parse(stored);return adminCache}const response=await fetch(snapshotUrl,{cache:'no-store'});if(!response.ok)throw new Error('No se encontró la copia local. Ejecuta iniciar-local.ps1.');adminCache=await response.json();storage.setItem(adminKey,JSON.stringify(adminCache));return adminCache}
    function employeeKey(employee){
      const id=String(employee?.id||employee?.empleado_id||'').trim();
      if(id)return `id:${id}`;
      const number=String(employee?.numero_empleado||'').trim().toUpperCase();
      return number?`numero:${number}`:'';
    }
    function mergeAdmin(base,stored){
      if(!stored)return base;
      const localEmployees=Array.isArray(stored.empleados)?stored.empleados:[];
      const localByKey=new Map();
      localEmployees.forEach(employee=>{const key=employeeKey(employee);if(key)localByKey.set(key,employee)});
      const used=new Set();
      const employees=(base.empleados||[]).map(source=>{
        const key=employeeKey(source),local=localByKey.get(key);
        if(!local)return source;
        used.add(key);
        return {...source,...local,id:source.id||local.id,empleado_id:source.empleado_id||local.empleado_id,numero_empleado:local.numero_empleado||source.numero_empleado};
      });
      localEmployees.forEach(employee=>{const key=employeeKey(employee);if(!key||!used.has(key))employees.push(employee)});
      return {...base,...stored,empleados:employees};
    }
    async function loadAdmin(){
      if(adminCache)return adminCache;
      let stored=null;
      try{stored=JSON.parse(storage.getItem(adminKey)||'null')}catch(error){console.warn('Se ignoró una copia local dañada',error)}
      const response=await fetch(snapshotUrl,{cache:'no-store'});
      if(!response.ok){if(stored){adminCache=stored;return adminCache}throw new Error('No se encontró la copia local. Ejecuta iniciar-local.ps1.');}
      adminCache=mergeAdmin(await response.json(),stored);
      storage.setItem(adminKey,JSON.stringify(adminCache));
      return adminCache;
    }
    function persist(data){adminCache=data;storage.setItem(adminKey,JSON.stringify(data))}
    function catalogName(rows,id){return (rows||[]).find(x=>x.id===id)?.nombre||null}
    async function pinHash(pin){const bytes=new TextEncoder().encode(pin),digest=await global.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')}
    async function setEmployeePin(employeeId,pin){const data=await loadAdmin(),employee=(data.empleados||[]).find(item=>item.id===employeeId);if(!employee)return {data:null,error:new Error('Empleado no encontrado')};employee.pin_hash_local=await pinHash(pin);storage.setItem('nexus-local-user-pin-hash',employee.pin_hash_local);persist(data);return ok(true)}
    async function verifyPin(pin){const expected=storage.getItem('nexus-local-user-pin-hash');return ok(Boolean(expected&&expected===await pinHash(pin)))}
    async function saveEmployee(args){const data=await loadAdmin(),employees=data.empleados||[],id=args.p_id||global.crypto.randomUUID(),previous=employees.find(x=>x.id===id)||{};const employee={...previous,id,numero_empleado:previous.numero_empleado||args.p_numero_empleado,nombres:args.p_nombres,apellido_paterno:args.p_apellido_paterno||null,apellido_materno:args.p_apellido_materno||null,correo:args.p_correo||null,telefono:args.p_telefono||null,estado:args.p_estado||'ACTIVO',departamento_id:args.p_departamento_id||null,puesto_id:args.p_puesto_id||null,sucursal_id:args.p_sucursal_id||null,perfil_id:args.p_perfil_id||null,departamento:catalogName(data.departamentos,args.p_departamento_id),puesto:catalogName(data.puestos,args.p_puesto_id),sucursal:catalogName(data.sucursales,args.p_sucursal_id),perfil:catalogName(data.perfiles,args.p_perfil_id)};const index=employees.findIndex(x=>x.id===id);if(index<0)employees.push(employee);else employees[index]=employee;persist({...data,empleados:employees});return ok(employee)}
    async function saveCatalog(type,args){const data=await loadAdmin(),key=type==='department'?'departamentos':'puestos',rows=data[key]||[],id=args.p_id||global.crypto.randomUUID(),previous=rows.find(x=>x.id===id)||{},item={...previous,id,codigo:args.p_codigo,nombre:args.p_nombre};if(type==='department')item.descripcion=args.p_descripcion||null;else{item.clasificacion=args.p_clasificacion||'ADMINISTRATIVO';item.departamento_id=args.p_departamento_id||null;item.departamento=catalogName(data.departamentos,args.p_departamento_id)}const index=rows.findIndex(x=>x.id===id);if(index<0)rows.push(item);else rows[index]=item;persist({...data,[key]:rows});return ok(item)}
    const accessKey='nexus-local-access-panel-v2';
    const localPolicyNames=[['MATRIZ_ACCESO_VER','Seguridad Nexus','Consultar matriz de acceso'],['MATRIZ_ACCESO_ADMINISTRAR','Seguridad Nexus','Administrar matriz de acceso'],['USUARIOS_VER','Seguridad Nexus','Consultar usuarios'],['USUARIOS_ADMINISTRAR','Seguridad Nexus','Administrar usuarios'],['CAPITAL_HUMANO_VER','Capital Humano','Consultar Capital Humano'],['CAPITAL_HUMANO_ADMINISTRAR','Capital Humano','Administrar Capital Humano'],['REGIONAL_VER','Configuración regional','Consultar configuración regional'],['REGIONAL_ADMINISTRAR','Configuración regional','Administrar configuración regional'],['GENERAL_VER','Configuración general','Consultar configuración general'],['GENERAL_ADMINISTRAR','Configuración general','Administrar configuración general'],['STOCK_VER','Stock','Consultar stock'],['STOCK_ADMINISTRAR','Stock','Administrar stock'],['VENTAS_VER','Ventas','Consultar ventas'],['VENTAS_ADMINISTRAR','Ventas','Administrar ventas'],['CAPACITACION_VER','Capacitación','Consultar capacitación'],['CAPACITACION_ADMINISTRAR','Capacitación','Administrar capacitación'],['SISTEMAS_VER','Sistemas','Consultar sistemas'],['SISTEMAS_ADMINISTRAR','Sistemas','Administrar sistemas'],['AUDITORIA_VER','Auditoría','Consultar auditoría']];
    const localPolicies=localPolicyNames.map((x,i)=>({id:`local-policy-${i+1}`,codigo:x[0],modulo:x[1],nombre:x[2],orden:(i+1)*10}));
    const localAccessDefault={perfiles:[{id:'local-admin',codigo:'ADMIN_NEXUS',nombre:'Administrador Nexus',descripcion:'Acceso total de recuperación',es_sistema:true}],politicas:localPolicies,decisiones:localPolicies.map(p=>({perfil_id:'local-admin',politica_id:p.id,decision:'PERMITIR'})),usuarios:[{id:'local-user-admin',correo:'entorno.local@skinklinik',empleado_id:null,perfil_id:'local-admin',alcance_tipo:'GLOBAL',activo:true}]};
    const loadAccess=()=>{const data=JSON.parse(storage.getItem(accessKey)||JSON.stringify(localAccessDefault));if(!Array.isArray(data.usuarios))data.usuarios=[];return data};
    const saveAccess=data=>storage.setItem(accessKey,JSON.stringify(data));
    const access={load:()=>ok(loadAccess()),saveProfile:command=>{const data=loadAccess(),id=global.crypto.randomUUID();data.perfiles.push({id,codigo:command.p_codigo,nombre:command.p_nombre,descripcion:command.p_descripcion,es_sistema:false});data.politicas.forEach(p=>data.decisiones.push({perfil_id:id,politica_id:p.id,decision:'DENEGAR'}));saveAccess(data);return ok(id)},saveDecision:command=>{const data=loadAccess(),row=data.decisiones.find(x=>x.perfil_id===command.p_perfil_id&&x.politica_id===command.p_politica_id);if(row)row.decision=command.p_decision;else data.decisiones.push({perfil_id:command.p_perfil_id,politica_id:command.p_politica_id,decision:command.p_decision});saveAccess(data);return ok(true)},saveUser:async command=>{const data=loadAccess(),email=String(command.p_correo||'').trim().toLowerCase(),existing=data.usuarios.find(x=>x.correo===email),user={id:existing?.id||global.crypto.randomUUID(),correo:email,empleado_id:command.p_empleado_id||null,perfil_id:command.p_perfil_id,alcance_tipo:command.p_alcance_tipo||'GLOBAL',pin_hash:await pinHash(command.p_pin),activo:true};if(existing)Object.assign(existing,user);else data.usuarios.push(user);saveAccess(data);return ok(user)}};
    async function loadRegional(){const data=await loadAdmin(),branches=data.sucursales||[],regions=[];branches.forEach(branch=>{const name=branch.region||branch.region_nombre||'Monterrey (MTY)',code=branch.region_codigo||(/cdmx/i.test(name)?'CDMX':'MTY'),id=branch.region_id||`local-region-${code}`;if(!regions.some(x=>x.id===id))regions.push({id,codigo:code,nombre:name,activa:true});branch.region_id=id});return ok({regiones:regions,sucursales:branches,almacenes:data.almacenes||[]})}
    const loadGeneral=()=>ok({productos:0,tipos_producto:0,servicios:0,listas_precios:0,precios_servicio:0,precios_producto:0,promociones:0,clientes:0});
    const recordTypes=[['IDENTIFICACION','Identificación oficial'],['CONTRATO','Contrato laboral'],['ALTA','Alta de empleado'],['DOMICILIO','Comprobante de domicilio'],['CONSTANCIA','Constancias y certificaciones'],['LABORAL','Documentos laborales'],['OTRO','Otro documento']].map(([codigo,nombre])=>({id:`local-${codigo}`,codigo,nombre}));
    const recordsKey='nexus-local-expedientes-v1';
    const recordRows=()=>{try{return JSON.parse(storage.getItem(recordsKey)||'[]')}catch{return []}};
    const records={load:employeeId=>ok({tipos:recordTypes,documentos:recordRows().filter(row=>row.empleado_id===employeeId)}),upload:path=>ok({path}),register:command=>{const rows=recordRows();rows.unshift({id:global.crypto.randomUUID(),empleado_id:command.employeeId,tipo_codigo:command.typeCode,tipo_nombre:recordTypes.find(type=>type.codigo===command.typeCode)?.nombre||command.typeCode,ruta_storage:command.path,archivo_nombre:command.fileName,mime_tipo:command.mimeType,tamano_bytes:command.size,creado_en:new Date().toISOString()});storage.setItem(recordsKey,JSON.stringify(rows));return ok(true)},download:()=>ok(null)};
    return {auth:{getVerifiedUser:()=>Promise.resolve({user:{id:'local',email:'entorno.local@skinklinik'},error:null}),signIn:()=>Promise.resolve({user:{id:'local',email:'entorno.local@skinklinik'},error:null}),signOut:()=>ok(true)},matrix:{load:()=>ok({datos:matrixState.load()}),save:()=>ok({local:true})},admin:{loadSummary:async()=>ok(await loadAdmin()),loadEmployeeDetails:()=>ok([]),loadRegional,loadGeneral,saveEmployee,setEmployeePin,verifyPin,saveCatalog},records,access,localState:matrixState};
  }
  global.SKAdapters={...(global.SKAdapters||{}),createLocalPreviewPorts};
})(window);
