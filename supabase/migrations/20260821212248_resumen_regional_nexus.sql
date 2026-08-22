create or replace function public.nexus_resumen_regional()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'regiones',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'codigo',r.codigo,'nombre',r.nombre,'activa',r.activa
      ) order by r.nombre)
      from core.regiones r
    ),'[]'::jsonb),
    'sucursales',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'region_id',s.region_id,'codigo',s.codigo,'nombre',s.nombre,
        'direccion',s.direccion,'telefono',s.telefono,'zona_horaria',s.zona_horaria,
        'activa',s.activa,'apertura_en',s.apertura_en,'cierre_en',s.cierre_en
      ) order by s.nombre)
      from core.sucursales s
    ),'[]'::jsonb),
    'almacenes',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'sucursal_id',a.sucursal_id,'codigo',a.codigo,'nombre',a.nombre,'activo',a.activo
      ) order by a.nombre)
      from stock.almacenes a
    ),'[]'::jsonb)
  );
$$;

revoke all on function public.nexus_resumen_regional() from public,anon;
grant execute on function public.nexus_resumen_regional() to authenticated;
