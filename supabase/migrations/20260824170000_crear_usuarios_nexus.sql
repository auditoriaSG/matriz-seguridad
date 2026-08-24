create or replace function acceso_nexus.crear_usuario_desde_panel(
  p_administrador_id uuid,
  p_auth_usuario_id uuid,
  p_empleado_id uuid,
  p_perfil_id uuid,
  p_alcance_tipo text,
  p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organizacion_id uuid;
  v_asignacion_id uuid;
begin
  select up.organizacion_id into v_organizacion_id
  from acceso_nexus.usuario_perfiles up
  join acceso_nexus.perfil_politicas pp on pp.perfil_id=up.perfil_id
  join acceso_nexus.politicas po on po.id=pp.politica_id
  where up.auth_usuario_id=p_administrador_id
    and up.vigente_desde<=now()
    and (up.vigente_hasta is null or up.vigente_hasta>now())
    and po.codigo='USUARIOS_ADMINISTRAR'
    and po.activo
    and pp.decision='PERMITIR'
  limit 1;

  if v_organizacion_id is null then
    raise exception 'Sin permiso para crear usuarios de Nexus';
  end if;
  if p_alcance_tipo not in ('GLOBAL','REGION','SUCURSAL','PROPIO') then
    raise exception 'Alcance no válido';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'El PIN debe contener exactamente 4 números';
  end if;
  if not exists (select 1 from auth.users u where u.id=p_auth_usuario_id) then
    raise exception 'La cuenta de acceso no existe';
  end if;
  if not exists (select 1 from acceso_nexus.perfiles p where p.id=p_perfil_id and p.organizacion_id=v_organizacion_id and p.activo) then
    raise exception 'Nivel de seguridad no válido';
  end if;
  if p_empleado_id is not null and not exists (select 1 from rh.empleados e where e.id=p_empleado_id and e.organizacion_id=v_organizacion_id) then
    raise exception 'El empleado no pertenece a esta organización';
  end if;

  update acceso_nexus.usuario_perfiles
  set vigente_hasta=now()
  where organizacion_id=v_organizacion_id and auth_usuario_id=p_auth_usuario_id and vigente_hasta is null;

  insert into acceso_nexus.usuario_perfiles(
    organizacion_id,auth_usuario_id,empleado_id,perfil_id,alcance_tipo,pin_hash,asignado_por
  ) values (
    v_organizacion_id,p_auth_usuario_id,p_empleado_id,p_perfil_id,p_alcance_tipo,
    extensions.crypt(p_pin,extensions.gen_salt('bf')),p_administrador_id
  ) returning id into v_asignacion_id;

  insert into acceso_nexus.eventos(organizacion_id,auth_usuario_id,accion,entidad,entidad_id,datos)
  values(
    v_organizacion_id,p_administrador_id,'CREAR_USUARIO_NEXUS','usuario_perfiles',v_asignacion_id::text,
    jsonb_build_object('usuario',p_auth_usuario_id,'perfil',p_perfil_id,'alcance',p_alcance_tipo)
  );
  return v_asignacion_id;
end;
$$;

revoke all on function acceso_nexus.crear_usuario_desde_panel(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function acceso_nexus.crear_usuario_desde_panel(uuid,uuid,uuid,uuid,text,text) to service_role;

create or replace function public.nexus_crear_usuario_desde_panel(
  p_administrador_id uuid,
  p_auth_usuario_id uuid,
  p_empleado_id uuid,
  p_perfil_id uuid,
  p_alcance_tipo text,
  p_pin text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select acceso_nexus.crear_usuario_desde_panel(
    p_administrador_id,p_auth_usuario_id,p_empleado_id,p_perfil_id,p_alcance_tipo,p_pin
  );
$$;

revoke all on function public.nexus_crear_usuario_desde_panel(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.nexus_crear_usuario_desde_panel(uuid,uuid,uuid,uuid,text,text) to service_role;
