import http from 'node:http';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const host='127.0.0.1';
const port=4173;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon'};
const supabaseUrl='https://amlweohcbadjdqscoajp.supabase.co';
const publishableKey='sb_publishable_EhpzIT3LJVEWkjfG3wQ9Ew_G1og6EiC';
const readJsonBody=req=>new Promise((resolveBody,reject)=>{let body='';req.on('data',chunk=>{body+=chunk;if(body.length>20000)reject(new Error('Solicitud demasiado grande'))});req.on('end',()=>{try{resolveBody(JSON.parse(body||'{}'))}catch(error){reject(error)}});req.on('error',reject)});

async function importFromSupabase(req,res){
  const {email,password}=await readJsonBody(req);
  if(!email||!password){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Escribe el correo y la contraseña.'}));return}
  const login=await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  if(!login.ok){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'El correo o la contraseña de la Matriz no son correctos.'}));return}
  const session=await login.json(),headers={apikey:publishableKey,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'};
  const [summaryResponse,detailResponse]=await Promise.all(['admin_resumen','admin_plantilla_detalle'].map(name=>fetch(`${supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers,body:'{}'})));
  if(!summaryResponse.ok||!detailResponse.ok)throw new Error('Supabase no permitió leer la plantilla.');
  const summary=await summaryResponse.json(),detail=await detailResponse.json(),details=new Map((detail||[]).map(item=>[item.empleado_id,item]));
  summary.empleados=(summary.empleados||[]).map(employee=>({...employee,...(details.get(employee.id)||{})}));
  const dataDir=resolve(root,'local-data');await mkdir(dataDir,{recursive:true});await writeFile(resolve(dataDir,'admin-snapshot.json'),JSON.stringify(summary,null,2),'utf8');
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,counts:{empleados:summary.empleados?.length||0,departamentos:summary.departamentos?.length||0,puestos:summary.puestos?.length||0,perfiles:summary.perfiles?.length||0,sucursales:summary.sucursales?.length||0}}));
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${host}:${port}`);
    if(req.method==='POST'&&url.pathname==='/api/importar'){await importFromSupabase(req,res);return}
    const requested=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const target=resolve(root,`.${requested}`);
    if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403);res.end('Acceso denegado');return}
    const info=await stat(target);
    const file=info.isDirectory()?resolve(target,'index.html'):target;
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  }catch{
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('Archivo no encontrado');
  }
});

server.listen(port,host,()=>console.log(`Entorno local disponible en http://${host}:${port}`));
