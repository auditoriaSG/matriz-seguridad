/* Expedientes digitales: interfaz independiente del catálogo de empleados. */
const recordFilters={search:'',branch:''};
let activeRecordEmployeeId='',activeRecordData={tipos:[],documentos:[]},recordRequest=0;

function recordEmployeeName(employee){
  return [employee.nombres,employee.apellido_paterno,employee.apellido_materno].filter(Boolean).join(' ').trim()||'Nombre pendiente';
}
function recordMatches(employee){
  const terms=filterText(recordFilters.search).split(/\s+/).filter(Boolean);
  const text=filterText([recordEmployeeName(employee),employee.numero_empleado,employee.correo].join(' '));
  return (!terms.length||terms.every(term=>text.includes(term)))&&(!recordFilters.branch||employee.sucursal===recordFilters.branch);
}
function recordBytes(size){
  if(!Number.isFinite(Number(size)))return '';
  const bytes=Number(size);return bytes<1024?`${bytes} B`:bytes<1048576?`${Math.round(bytes/1024)} KB`:`${(bytes/1048576).toFixed(1)} MB`;
}
function renderAdminRecords(){
  const all=[...(adminData.empleados||[])].sort((a,b)=>employeeSortKey(a).localeCompare(employeeSortKey(b),'es'));
  const branches=[...new Set(all.map(employee=>employee.sucursal).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const rows=all.filter(recordMatches);
  const groups=new Map();
  rows.forEach(employee=>{const branch=employee.sucursal||'Sin sucursal asignada';if(!groups.has(branch))groups.set(branch,[]);groups.get(branch).push(employee)});
  const branchGroups=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],'es'));
  $('#adminRecords').innerHTML=`
    <div class="records-heading">
      <div><h3>Plantillas y expedientes digitales</h3><p>Plantilla agrupada por sucursal. Abre cada ficha para consultar y cargar documentos de Capital Humano.</p></div>
      <span class="status-pill">${rows.length} de ${all.length} empleados</span>
    </div>
    <div class="record-filters" aria-label="Buscar expedientes">
      <label class="employee-search"><span>Buscar por nombre</span><input data-record-filter="search" type="search" autocomplete="off" value="${safe(recordFilters.search)}" placeholder="Nombre o número de empleado"></label>
      <label><span>Sucursal</span><select data-record-filter="branch"><option value="">Todas las sucursales</option>${branches.map(branch=>adminOption(branch,branch,recordFilters.branch)).join('')}</select></label>
      <button class="clear-employee-filters" data-clear-record-filters ${recordFilters.search||recordFilters.branch?'':'disabled'}>Limpiar filtros</button>
    </div>
    <div class="record-branch-list">${branchGroups.length?branchGroups.map(([branch,employees],index)=>`
      <details class="record-branch" ${index===0?'open':''}>
        <summary><span class="record-plus">+</span><div><strong>${safe(branch)}</strong><small>${employees.length} empleado${employees.length===1?'':'s'} en esta sucursal</small></div></summary>
        <div class="record-employee-grid">${employees.map(employee=>`
          <article class="record-employee-card">
            <div>${employeeNameMarkup(employee)}<small>${safe(employee.numero_empleado||'Número pendiente')} · ${safe(employee.departamento||'Sin departamento')} · ${safe(employee.puesto||'Sin puesto')}</small></div>
            <button class="button small" data-open-record="${safe(employee.id)}">Abrir expediente</button>
          </article>`).join('')}
        </div>
      </details>`).join(''):'<div class="admin-empty">No hay empleados que coincidan con la búsqueda.</div>'}
    </div>`;
}
function recordTypeDocuments(code){return (activeRecordData.documentos||[]).filter(document=>document.tipo_codigo===code)}
function renderEmployeeRecordDialog(employee,loading=false){
  const target=$('#employeeRecordContent');
  if(!employee){target.innerHTML='';return}
  if(loading){target.innerHTML=`<div class="dialog-heading"><div><p class="kicker">Expediente digital</p><h2>${safe(recordEmployeeName(employee))}</h2></div><button class="icon-close" id="closeEmployeeRecord" type="button" aria-label="Cerrar">×</button></div><p class="record-loading">Cargando documentos protegidos…</p>`;return}
  const types=activeRecordData.tipos||[];
  target.innerHTML=`
    <div class="dialog-heading"><div><p class="kicker">Expediente digital</p><h2>${safe(recordEmployeeName(employee))}</h2><small>${safe(employee.numero_empleado||'Número pendiente')} · ${safe(employee.sucursal||'Sin sucursal asignada')}</small></div><button class="icon-close" id="closeEmployeeRecord" type="button" aria-label="Cerrar">×</button></div>
    <section class="record-employee-summary"><div><span>Departamento</span><strong>${safe(employee.departamento||'Pendiente')}</strong></div><div><span>Puesto</span><strong>${safe(employee.puesto||'Pendiente')}</strong></div><div><span>Correo</span><strong>${safe(employee.correo||'Pendiente')}</strong></div></section>
    <section class="record-document-section"><div class="record-document-intro"><div><h3>Documentación</h3><p>Los documentos se almacenan de forma privada. Formatos permitidos: PDF, JPG, PNG o HEIC; máximo 10 MB.</p></div><span class="status-pill">${(activeRecordData.documentos||[]).length} archivo${(activeRecordData.documentos||[]).length===1?'':'s'}</span></div>
      <div class="record-document-grid">${types.map(type=>{const documents=recordTypeDocuments(type.codigo);return `<article class="record-document-card"><div class="record-document-card-heading"><h4>${safe(type.nombre)}</h4><span>${documents.length?`${documents.length} archivo${documents.length===1?'':'s'}`:'Pendiente'}</span></div><div class="record-file-list">${documents.length?documents.map(document=>`<button class="record-file" data-download-document="${safe(document.ruta_storage)}" title="Descargar ${safe(document.archivo_nombre)}"><span>${safe(document.archivo_nombre||'Documento')}</span><small>${safe(recordBytes(document.tamano_bytes))} · Descargar</small></button>`).join(''):'<p>Sin archivo cargado.</p>'}</div><div class="record-upload-actions"><label class="record-upload"><span>Seleccionar archivo</span><input type="file" data-record-upload="${safe(type.codigo)}" accept="application/pdf,image/jpeg,image/png,image/heic,.pdf,.jpg,.jpeg,.png,.heic"></label><button class="button small" data-save-document="${safe(type.codigo)}" disabled>Guardar documento</button></div><small class="record-selected-file" data-selected-file="${safe(type.codigo)}">Ningún archivo seleccionado.</small></article>`}).join('')}</div>
    </section>`;
}
async function openEmployeeRecord(employeeId){
  const employee=(adminData.empleados||[]).find(item=>item.id===employeeId);if(!employee)return;
  activeRecordEmployeeId=employeeId;activeRecordData={tipos:[],documentos:[]};
  const dialog=$('#employeeRecordDialog');renderEmployeeRecordDialog(employee,true);dialog.showModal();
  const request=++recordRequest;const {data,error}=await appCore.records.load(employeeId);
  if(request!==recordRequest||activeRecordEmployeeId!==employeeId)return;
  if(error){renderEmployeeRecordDialog(employee);toast('No se pudo cargar la documentación: '+error.message);return}
  activeRecordData=data||{tipos:[],documentos:[]};renderEmployeeRecordDialog(employee);
}
function safeStorageName(name){return String(name||'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'archivo'}
async function uploadEmployeeDocument(input){
  const file=input.files?.[0],employee=(adminData.empleados||[]).find(item=>item.id===activeRecordEmployeeId);if(!file||!employee)return;
  const allowed=['application/pdf','image/jpeg','image/png','image/heic'];
  if(!allowed.includes(file.type)||file.size>10485760){input.value='';toast('Usa PDF, JPG, PNG o HEIC de máximo 10 MB');return}
  const path=`${employee.id}/${Date.now()}-${safeStorageName(file.name)}`;
  input.disabled=true;const card=input.closest('.record-document-card'),label=input.closest('.record-upload'),saveButton=card?.querySelector('[data-save-document]');label?.classList.add('uploading');if(saveButton){saveButton.disabled=true;saveButton.textContent='Guardando…'}
  const uploaded=await appCore.records.upload(path,file);
  if(uploaded.error){input.disabled=false;label?.classList.remove('uploading');if(saveButton){saveButton.disabled=false;saveButton.textContent='Guardar documento'}toast('No se pudo cargar el archivo: '+uploaded.error.message);return}
  const saved=await appCore.records.register({employeeId:employee.id,typeCode:input.dataset.recordUpload,path,fileName:file.name,mimeType:file.type,size:file.size});
  input.disabled=false;label?.classList.remove('uploading');input.value='';
  if(saved.error){toast('El archivo se cargó, pero no se registró en el expediente. Contacta a Sistemas.');return}
  toast('Documento guardado correctamente en el expediente');await openEmployeeRecord(employee.id);
}
$('#adminRecords').onclick=event=>{
  const open=event.target.closest('[data-open-record]');if(open){openEmployeeRecord(open.dataset.openRecord);return}
  if(event.target.closest('[data-clear-record-filters]')){recordFilters.search='';recordFilters.branch='';renderAdminRecords()}
};
$('#adminRecords').oninput=event=>{const filter=event.target.closest('[data-record-filter="search"]');if(!filter)return;recordFilters.search=filter.value;renderAdminRecords();const replacement=$('[data-record-filter="search"]');if(replacement){replacement.focus();replacement.setSelectionRange(recordFilters.search.length,recordFilters.search.length)}};
$('#adminRecords').onchange=event=>{const filter=event.target.closest('[data-record-filter="branch"]');if(filter){recordFilters.branch=filter.value;renderAdminRecords()}};
$('#employeeRecordDialog').onclick=event=>{if(event.target.closest('#closeEmployeeRecord')){$('#employeeRecordDialog').close();return}const saveButton=event.target.closest('[data-save-document]');if(saveButton){const input=saveButton.closest('.record-document-card')?.querySelector('[data-record-upload]');if(input)uploadEmployeeDocument(input);return}const download=event.target.closest('[data-download-document]');if(download){appCore.records.download(download.dataset.downloadDocument).then(({data,error})=>{if(error||!data){toast('No se pudo preparar la descarga');return}window.open(data,'_blank','noopener')})}};
$('#employeeRecordDialog').onchange=event=>{const input=event.target.closest('[data-record-upload]');if(!input)return;const file=input.files?.[0],card=input.closest('.record-document-card'),button=card?.querySelector('[data-save-document]'),message=card?.querySelector('[data-selected-file]');if(!file){if(button)button.disabled=true;if(message)message.textContent='Ningún archivo seleccionado.';return}if(button)button.disabled=false;if(message)message.textContent=`Archivo seleccionado: ${file.name}`};
