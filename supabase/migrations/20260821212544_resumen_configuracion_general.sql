create or replace function public.nexus_resumen_configuracion_general()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'productos',(select count(*) from catalogo.productos),
    'tipos_producto',(select count(*) from catalogo.producto_tipos),
    'servicios',(select count(*) from catalogo.servicios),
    'listas_precios',(select count(*) from ventas.listas_precios),
    'precios_servicio',(select count(*) from ventas.servicio_precios),
    'precios_producto',(select count(*) from ventas.producto_precios),
    'promociones',(select count(*) from ventas.promociones),
    'clientes',(select count(*) from clientes.clientes)
  );
$$;

revoke all on function public.nexus_resumen_configuracion_general() from public,anon;
grant execute on function public.nexus_resumen_configuracion_general() to authenticated;
