create or replace function seguridad.sincronizar_matriz_legacy()
returns trigger
language plpgsql
security invoker
set search_path = seguridad, public
as $$
begin
  insert into seguridad.perfil_permisos(
    organizacion_id,perfil_id,permiso_id,decision,version,
    actualizado_por,actualizado_en
  )
  select profile.organizacion_id,profile.id,permission.id,
         case item.value when 'allow' then 'APLICA' else 'SIN_ACCESO' end,
         1,new.actualizado_por,coalesce(new.actualizado_en,now())
  from jsonb_each_text(new.datos->'values') item(key,value)
  join seguridad.perfiles profile
    on profile.nombre = split_part(item.key,'|',1)
  join seguridad.permisos permission
    on permission.organizacion_id=profile.organizacion_id
   and permission.legacy_id=split_part(item.key,'|',2)
  where item.value in ('allow','deny')
  on conflict (perfil_id,permiso_id)
  do update set
    decision=excluded.decision,
    version=seguridad.perfil_permisos.version+1,
    actualizado_por=excluded.actualizado_por,
    actualizado_en=excluded.actualizado_en
  where seguridad.perfil_permisos.decision is distinct from excluded.decision;

  return new;
end;
$$;

revoke all on function seguridad.sincronizar_matriz_legacy()
  from public,anon,authenticated;

drop trigger if exists trg_sincronizar_matriz_legacy
  on public.matriz_seguridad;
create trigger trg_sincronizar_matriz_legacy
after insert or update of datos
on public.matriz_seguridad
for each row
execute function seguridad.sincronizar_matriz_legacy();
