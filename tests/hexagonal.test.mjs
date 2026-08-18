import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context={window:{},Map,Object,Boolean,JSON,Error};
context.window.window=context.window;
vm.createContext(context);
for(const file of ['src/domain/security-matrix.js','src/application/use-cases.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}

const domain=context.window.SKDomain;
const application=context.window.SKApplication;
assert.deepEqual(JSON.parse(JSON.stringify(domain.normalizeState(null))),{values:{},groups:{},homeLayout:{},groupRulesVersion:0});
assert.equal(domain.hasConfiguredProfiles({values:{'Control de Stock|1':'allow'}}),false);
assert.equal(domain.hasConfiguredProfiles({values:{'Empleado|1':'allow'}}),true);

let savedPayload=null;
const ports={
  auth:{getVerifiedUser:async()=>({user:{id:'u1'},error:null}),signIn:async()=>({user:{id:'u1'},error:null}),signOut:async()=>({error:null})},
  matrix:{load:async()=>({data:{datos:{values:{},groups:{}}},error:null}),save:async(payload)=>{savedPayload=payload;return {error:null}}},
  admin:{
    loadSummary:async()=>({data:{empleados:[{id:'e1',nombres:'Ana'}]},error:null}),
    loadEmployeeDetails:async()=>({data:[{empleado_id:'e1',puesto:'Médico'}],error:null}),
    saveEmployee:async()=>({error:null}),saveCatalog:async()=>({error:null})
  },
  localState:{load:()=>({}),save:state=>state}
};
const app=application.createApplication(ports,domain);
await app.matrix.saveCloud({values:{x:'allow'},groups:{}},'u1');
assert.deepEqual(JSON.parse(JSON.stringify(savedPayload)),{values:{x:'allow'},groups:{},homeLayout:{},groupRulesVersion:0});
const admin=await app.admin.load();
assert.equal(admin.data.empleados[0].puesto,'Médico');
console.log('Arquitectura hexagonal: pruebas superadas');
