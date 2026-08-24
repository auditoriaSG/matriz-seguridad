-- Expedientes digitales de Capital Humano.
-- Los archivos viven en un bucket privado; esta tabla conserva solamente sus metadatos.

alter table rh.documentos_empleado
  add column if not exists archivo_nombre text,
  add column if not exists mime_tipo text,
  add column if not exists tamano_bytes bigint;

create unique index if not exists documentos_empleado_ruta_storage_unica
  on rh.documentos_empleado(organizacion_id,ruta_storage);

-- Catálogo inicial. Se crea para cada organización y no sustituye los tipos que se agreguen después.
insert into rh.tipos_documento(organizacion_id,codigo,nombre,requiere_vencimiento,confidencial)
select o.id, tipo.codigo, tipo.nombre, false, true
from core.organizaciones o
cross join (values
  ('IDENTIFICACION','Identificación oficial'),
  ('CONTRATO','Contrato laboral'),
  ('ALTA','Alta de empleado'),
  ('DOMICILIO','Comprobante de domicilio'),
  ('CONSTANCIA','Constancias y certificaciones'),
  ('LABORAL','Documentos laborales'),
  ('OTRO','Otro documento')
) as tipo(codigo,nombre)
where not exists (
  select 1 from rh.tipos_documento existente
  where existente.organizacion_id=o.id and existente.codigo=tipo.codigo
);

-- Las políticas originales de "miembros" eran demasiado amplias para expedientes personales.
drop policy if exists acceso_miembros on rh.tipos_documento;
drop policy if exists acceso_miembros on rh.documentos_empleado;

create policy tipos_documento_nexus_lectura on rh.tipos_documento
  for select to authenticated
  using ((select acceso_nexus.tiene_politica(organizacion_id,'CAPITAL_HUMANO_VER')));

create policy tipos_documento_nexus_administrar on rh.tipos_documento
  for all to authenticated
  using ((select acceso_nexus.tiene_politica(organizacion_id,'CAPITAL_HUMANO_ADMINISTRAR')))
  with check ((select acceso_nexus.tiene_politica(organizacion_id,'CAPITAL_HUMANO_ADMINISTRAR')));

create policy documentos_empleado_nexus_lectura on rh.documentos_empleado
  for select to authenticated
  using ((select acceso_nexus.tiene_politica(organizacion_id,'CAPITAL_HUMANO_VER')));

create policy documentos_empleado_nexus_administrar on rh.documentos_empleado
  for all to authenticated
  using ((select acceso_nexus.tiene_politica(organizacion_id,'CAPITAL_HUMANO_ADMINISTRAR')))
  with check ((select acceso_nexus.tiene_politica(organizacion_id,'CAPITAL_HUMANO_ADMINISTRAR')));

grant select,insert,update,delete on rh.tipos_documento,rh.documentos_empleado to authenticated;

create or replace function acceso_nexus.puede_ver_expedientes()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from acceso_nexus.usuario_perfiles up
    join acceso_nexus.perfil_politicas pp on pp.perfil_id=up.perfil_id
    join acceso_nexus.politicas p on p.id=pp.politica_id
    where up.auth_usuario_id=(select auth.uid())
      and up.vigente_desde<=now()
      and (up.vigente_hasta is null or up.vigente_hasta>now())
      and p.activo and p.codigo in ('CAPITAL_HUMANO_VER','CAPITAL_HUMANO_ADMINISTRAR')
      and pp.decision='PERMITIR'
  );
$$;

create or replace function acceso_nexus.puede_administrar_expedientes()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from acceso_nexus.usuario_perfiles up
    join acceso_nexus.perfil_politicas pp on pp.perfil_id=up.perfil_id
    join acceso_nexus.politicas p on p.id=pp.politica_id
    where up.auth_usuario_id=(select auth.uid())
      and up.vigente_desde<=now()
      and (up.vigente_hasta is null or up.vigente_hasta>now())
      and p.activo and p.codigo='CAPITAL_HUMANO_ADMINISTRAR'
      and pp.decision='PERMITIR'
  );
$$;

revoke all on function acceso_nexus.puede_ver_expedientes() from public,anon;
revoke all on function acceso_nexus.puede_administrar_expedientes() from public,anon;
grant execute on function acceso_nexus.puede_ver_expedientes() to authenticated;
grant execute on function acceso_nexus.puede_administrar_expedientes() to authenticated;

-- El bucket no es público: cada descarga se realiza con una URL temporal firmada.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'expedientes-empleados',
  'expedientes-empleados',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/heic']::text[]
)
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists expedientes_empleados_ver on storage.objects;
drop policy if exists expedientes_empleados_cargar on storage.objects;
drop policy if exists expedientes_empleados_actualizar on storage.objects;
drop policy if exists expedientes_empleados_eliminar on storage.objects;

create policy expedientes_empleados_ver on storage.objects
  for select to authenticated
  using (bucket_id='expedientes-empleados' and (select acceso_nexus.puede_ver_expedientes()));

create policy expedientes_empleados_cargar on storage.objects
  for insert to authenticated
  with check (bucket_id='expedientes-empleados' and (select acceso_nexus.puede_administrar_expedientes()));

create policy expedientes_empleados_actualizar on storage.objects
  for update to authenticated
  using (bucket_id='expedientes-empleados' and (select acceso_nexus.puede_administrar_expedientes()))
  with check (bucket_id='expedientes-empleados' and (select acceso_nexus.puede_administrar_expedientes()));

create policy expedientes_empleados_eliminar on storage.objects
  for delete to authenticated
  using (bucket_id='expedientes-empleados' and (select acceso_nexus.puede_administrar_expedientes()));

create or replace function public.admin_documentos_empleado(p_empleado_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select up.organizacion_id into v_org
  from acceso_nexus.usuario_perfiles up
  where up.auth_usuario_id=(select auth.uid())
    and up.vigente_desde<=now()
    and (up.vigente_hasta is null or up.vigente_hasta>now())
  limit 1;

  if v_org is null or not acceso_nexus.tiene_politica(v_org,'CAPITAL_HUMANO_VER') then
    raise exception 'Sin permiso para consultar expedientes de empleados';
  end if;
  if not exists(select 1 from rh.empleados e where e.id=p_empleado_id and e.organizacion_id=v_org) then
    raise exception 'Empleado no encontrado en la organización';
  end if;

  return jsonb_build_object(
    'tipos', coalesce((
      select jsonb_agg(jsonb_build_object('id',t.id,'codigo',t.codigo,'nombre',t.nombre) order by t.nombre)
      from rh.tipos_documento t
      where t.organizacion_id=v_org
    ),'[]'::jsonb),
    'documentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',d.id,'tipo_codigo',t.codigo,'tipo_nombre',t.nombre,'ruta_storage',d.ruta_storage,
        'archivo_nombre',coalesce(d.archivo_nombre,split_part(d.ruta_storage,'/',2)),
        'mime_tipo',d.mime_tipo,'tamano_bytes',d.tamano_bytes,'estado',d.estado,
        'creado_en',d.creado_en,'vence_en',d.vence_en
      ) order by d.creado_en desc)
      from rh.documentos_empleado d
      join rh.tipos_documento t on t.id=d.tipo_documento_id
      where d.organizacion_id=v_org and d.empleado_id=p_empleado_id
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_registrar_documento_empleado(
  p_empleado_id uuid,
  p_tipo_codigo text,
  p_ruta_storage text,
  p_archivo_nombre text,
  p_mime_tipo text,
  p_tamano_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_tipo_id uuid;
  v_id uuid;
begin
  select up.organizacion_id into v_org
  from acceso_nexus.usuario_perfiles up
  where up.auth_usuario_id=(select auth.uid())
    and up.vigente_desde<=now()
    and (up.vigente_hasta is null or up.vigente_hasta>now())
  limit 1;

  if v_org is null or not acceso_nexus.tiene_politica(v_org,'CAPITAL_HUMANO_ADMINISTRAR') then
    raise exception 'Sin permiso para administrar expedientes de empleados';
  end if;
  if not exists(select 1 from rh.empleados e where e.id=p_empleado_id and e.organizacion_id=v_org) then
    raise exception 'Empleado no encontrado en la organización';
  end if;
  if left(coalesce(p_ruta_storage,''),37) <> p_empleado_id::text || '/' then
    raise exception 'La ruta del archivo no corresponde al empleado';
  end if;
  if p_mime_tipo not in ('application/pdf','image/jpeg','image/png','image/heic') then
    raise exception 'Tipo de archivo no permitido';
  end if;
  if p_tamano_bytes is null or p_tamano_bytes<1 or p_tamano_bytes>10485760 then
    raise exception 'El archivo debe pesar como máximo 10 MB';
  end if;

  select t.id into v_tipo_id
  from rh.tipos_documento t
  where t.organizacion_id=v_org and t.codigo=upper(trim(p_tipo_codigo));
  if v_tipo_id is null then raise exception 'Tipo de documento no válido'; end if;

  insert into rh.documentos_empleado(
    organizacion_id,empleado_id,tipo_documento_id,ruta_storage,archivo_nombre,mime_tipo,tamano_bytes,
    estado,cargado_por
  ) values (
    v_org,p_empleado_id,v_tipo_id,p_ruta_storage,trim(p_archivo_nombre),p_mime_tipo,p_tamano_bytes,
    'VIGENTE',(select auth.uid())
  ) returning id into v_id;

  insert into acceso_nexus.eventos(organizacion_id,auth_usuario_id,accion,entidad,entidad_id,datos)
  values(v_org,(select auth.uid()),'CARGAR_DOCUMENTO','documentos_empleado',v_id::text,
    jsonb_build_object('empleado_id',p_empleado_id,'tipo',upper(trim(p_tipo_codigo))));
  return v_id;
end;
$$;

revoke all on function public.admin_documentos_empleado(uuid) from public,anon;
revoke all on function public.admin_registrar_documento_empleado(uuid,text,text,text,text,bigint) from public,anon;
grant execute on function public.admin_documentos_empleado(uuid) to authenticated;
grant execute on function public.admin_registrar_documento_empleado(uuid,text,text,text,text,bigint) to authenticated;
