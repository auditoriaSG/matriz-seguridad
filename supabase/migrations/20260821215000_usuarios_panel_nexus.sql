alter table acceso_nexus.usuario_perfiles
  add column if not exists pin_hash text;

create or replace function acceso_nexus.panel_acceso_actual()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  select up.organizacion_id into v_org
  from acceso_nexus.usuario_perfiles up
  where up.auth_usuario_id=(select auth.uid())
    and up.vigente_desde<=now()
    and (up.vigente_hasta is null or up.vigente_hasta>now())
  limit 1;
  if v_org is null or not acceso_nexus.tiene_politica(v_org,'MATRIZ_ACCESO_VER') then
    raise exception 'Sin permiso para consultar el panel de acceso';
  end if;
  return jsonb_build_object(
    'perfiles',coalesce((select jsonb_agg(to_jsonb(p) order by p.es_sistema desc,p.nombre) from acceso_nexus.perfiles p where p.organizacion_id=v_org and p.activo),'[]'::jsonb),
    'politicas',coalesce((select jsonb_agg(to_jsonb(p) order by p.modulo,p.orden,p.nombre) from acceso_nexus.politicas p where p.organizacion_id=v_org and p.activo),'[]'::jsonb),
    'decisiones',coalesce((select jsonb_agg(to_jsonb(pp)) from acceso_nexus.perfil_politicas pp where pp.organizacion_id=v_org),'[]'::jsonb),
    'usuarios',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',up.id,'correo',u.email,'empleado_id',up.empleado_id,'perfil_id',up.perfil_id,
        'alcance_tipo',up.alcance_tipo,'activo',(up.vigente_hasta is null or up.vigente_hasta>now())
      ) order by u.email)
      from acceso_nexus.usuario_perfiles up
      join auth.users u on u.id=up.auth_usuario_id
      where up.organizacion_id=v_org and (up.vigente_hasta is null or up.vigente_hasta>now())
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function acceso_nexus.panel_acceso_actual() from public,anon;
grant execute on function acceso_nexus.panel_acceso_actual() to authenticated;

create or replace function public.nexus_panel_acceso()
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select acceso_nexus.panel_acceso_actual(); $$;

create or replace function acceso_nexus.guardar_usuario_actual(
  p_correo text,p_empleado_id uuid,p_perfil_id uuid,p_alcance_tipo text,p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid; v_auth_user uuid; v_assignment uuid;
begin
  select up.organizacion_id into v_org
  from acceso_nexus.usuario_perfiles up
  where up.auth_usuario_id=(select auth.uid())
    and up.vigente_desde<=now()
    and (up.vigente_hasta is null or up.vigente_hasta>now())
  limit 1;
  if v_org is null or not acceso_nexus.tiene_politica(v_org,'USUARIOS_ADMINISTRAR') then
    raise exception 'Sin permiso para administrar usuarios';
  end if;
  if p_alcance_tipo not in ('GLOBAL','REGION','SUCURSAL','PROPIO') then raise exception 'Alcance no válido'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then raise exception 'El PIN debe contener exactamente 4 números'; end if;
  if not exists(select 1 from acceso_nexus.perfiles p where p.id=p_perfil_id and p.organizacion_id=v_org and p.activo) then raise exception 'Nivel de seguridad no válido'; end if;
  select u.id into v_auth_user from auth.users u where lower(u.email)=lower(trim(p_correo)) limit 1;
  if v_auth_user is null then raise exception 'El correo todavía no tiene una cuenta de acceso en Supabase Auth'; end if;
  update acceso_nexus.usuario_perfiles set vigente_hasta=now()
  where organizacion_id=v_org and auth_usuario_id=v_auth_user and vigente_hasta is null;
  insert into acceso_nexus.usuario_perfiles(organizacion_id,auth_usuario_id,empleado_id,perfil_id,alcance_tipo,pin_hash,asignado_por)
  values(v_org,v_auth_user,p_empleado_id,p_perfil_id,p_alcance_tipo,extensions.crypt(p_pin,extensions.gen_salt('bf')),(select auth.uid())) returning id into v_assignment;
  insert into acceso_nexus.eventos(organizacion_id,auth_usuario_id,accion,entidad,entidad_id,datos)
  values(v_org,(select auth.uid()),'ASIGNAR_NIVEL','usuario_perfiles',v_assignment::text,jsonb_build_object('usuario',v_auth_user,'perfil',p_perfil_id,'alcance',p_alcance_tipo));
  return v_assignment;
end;
$$;

revoke all on function acceso_nexus.guardar_usuario_actual(text,uuid,uuid,text,text) from public,anon;
grant execute on function acceso_nexus.guardar_usuario_actual(text,uuid,uuid,text,text) to authenticated;

create or replace function public.nexus_guardar_usuario(
  p_correo text,p_empleado_id uuid,p_perfil_id uuid,p_alcance_tipo text,p_pin text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select acceso_nexus.guardar_usuario_actual(p_correo,p_empleado_id,p_perfil_id,p_alcance_tipo,p_pin); $$;

revoke all on function public.nexus_guardar_usuario(text,uuid,uuid,text,text) from public,anon;
grant execute on function public.nexus_guardar_usuario(text,uuid,uuid,text,text) to authenticated;
