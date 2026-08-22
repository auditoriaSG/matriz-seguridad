create or replace function public.nexus_panel_acceso()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'perfiles', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.es_sistema desc,p.nombre)
      from acceso_nexus.perfiles p
      where p.activo
    ),'[]'::jsonb),
    'politicas', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.modulo,x.orden,x.nombre)
      from acceso_nexus.politicas x
      where x.activo
    ),'[]'::jsonb),
    'decisiones', coalesce((
      select jsonb_agg(to_jsonb(pp))
      from acceso_nexus.perfil_politicas pp
    ),'[]'::jsonb)
  );
$$;

create or replace function public.nexus_guardar_perfil(
  p_codigo text,
  p_nombre text,
  p_descripcion text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select up.organizacion_id into v_org
  from acceso_nexus.usuario_perfiles up
  where up.auth_usuario_id = (select auth.uid())
    and up.vigente_desde <= now()
    and (up.vigente_hasta is null or up.vigente_hasta > now())
  limit 1;
  if v_org is null then raise exception 'Sin organización autorizada'; end if;

  insert into acceso_nexus.perfiles(organizacion_id,codigo,nombre,descripcion)
  values(v_org,upper(trim(p_codigo)),trim(p_nombre),nullif(trim(p_descripcion),''))
  returning id into v_id;

  insert into acceso_nexus.perfil_politicas(organizacion_id,perfil_id,politica_id,decision,actualizado_por)
  select v_org,v_id,p.id,'DENEGAR',(select auth.uid())
  from acceso_nexus.politicas p
  where p.organizacion_id=v_org and p.activo;
  return v_id;
end;
$$;

create or replace function public.nexus_guardar_decision(
  p_perfil_id uuid,
  p_politica_id uuid,
  p_decision text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_org uuid;
begin
  if p_decision not in ('PERMITIR','DENEGAR') then raise exception 'Decisión no válida'; end if;
  select organizacion_id into v_org from acceso_nexus.perfiles where id=p_perfil_id and activo;
  if v_org is null or not exists(
    select 1 from acceso_nexus.politicas where id=p_politica_id and organizacion_id=v_org and activo
  ) then raise exception 'Perfil o política no válidos'; end if;

  insert into acceso_nexus.perfil_politicas(organizacion_id,perfil_id,politica_id,decision,actualizado_por,actualizado_en)
  values(v_org,p_perfil_id,p_politica_id,p_decision,(select auth.uid()),now())
  on conflict(perfil_id,politica_id) do update
  set decision=excluded.decision,actualizado_por=excluded.actualizado_por,actualizado_en=excluded.actualizado_en;
end;
$$;

revoke all on function public.nexus_panel_acceso() from public,anon;
revoke all on function public.nexus_guardar_perfil(text,text,text) from public,anon;
revoke all on function public.nexus_guardar_decision(uuid,uuid,text) from public,anon;
grant execute on function public.nexus_panel_acceso() to authenticated;
grant execute on function public.nexus_guardar_perfil(text,text,text) to authenticated;
grant execute on function public.nexus_guardar_decision(uuid,uuid,text) to authenticated;
