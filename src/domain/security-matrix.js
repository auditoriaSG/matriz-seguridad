(function(global){
  function normalizeState(candidate){
    const source=candidate&&typeof candidate==='object'?candidate:{};
    return {
      ...source,
      values:source.values&&typeof source.values==='object'?source.values:{},
      groups:source.groups&&typeof source.groups==='object'?source.groups:{},
      homeLayout:source.homeLayout&&typeof source.homeLayout==='object'?source.homeLayout:{}
    };
  }

  function toCloudPayload(state){
    const normalized=normalizeState(state);
    return {values:normalized.values,groups:normalized.groups,homeLayout:normalized.homeLayout};
  }

  function hasConfiguredProfiles(payload){
    return Boolean(payload?.values&&Object.keys(payload.values).some(key=>!key.startsWith('Control de Stock|')));
  }

  function mergeAdministrativeData(summary,detail){
    const base=summary||{departamentos:[],puestos:[],perfiles:[],sucursales:[],empleados:[]};
    const detailsByEmployee=new Map((detail||[]).map(item=>[item.empleado_id,item]));
    return {...base,empleados:(base.empleados||[]).map(employee=>({...employee,...(detailsByEmployee.get(employee.id)||{})}))};
  }

  global.SKDomain=Object.freeze({normalizeState,toCloudPayload,hasConfiguredProfiles,mergeAdministrativeData});
})(window);
