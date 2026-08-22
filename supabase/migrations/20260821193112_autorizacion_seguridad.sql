-- Lectura para miembros; modificaciones sólo para propietario/administrador.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'perfiles','permisos','perfil_permisos','grupos_empleados',
    'grupo_perfiles_predeterminados','usuario_perfiles'
  ]
  loop
    execute format('drop policy if exists acceso_miembros on seguridad.%I', table_name);
    execute format('drop policy if exists lectura_miembros on seguridad.%I', table_name);
    execute format('drop policy if exists cambios_administradores on seguridad.%I', table_name);

    execute format(
      'create policy lectura_miembros on seguridad.%I for select to authenticated using ((select seguridad.es_miembro(organizacion_id)))',
      table_name
    );
    execute format(
      'create policy cambios_administradores on seguridad.%I for all to authenticated using ((select seguridad.es_administrador(organizacion_id))) with check ((select seguridad.es_administrador(organizacion_id)))',
      table_name
    );
  end loop;
end $$;

drop policy if exists "Usuarios pueden actualizar la matriz"
  on public.matriz_seguridad;
drop policy if exists "Usuarios pueden crear la matriz"
  on public.matriz_seguridad;
drop policy if exists "Usuarios pueden consultar la matriz"
  on public.matriz_seguridad;

create policy matriz_lectura_miembros
on public.matriz_seguridad
for select
to authenticated
using (
  exists (
    select 1 from seguridad.miembros_organizacion m
    where m.auth_usuario_id = (select auth.uid()) and m.activo
  )
);

create policy matriz_cambios_administradores
on public.matriz_seguridad
for all
to authenticated
using (
  exists (
    select 1 from seguridad.miembros_organizacion m
    where m.auth_usuario_id = (select auth.uid())
      and m.activo
      and m.tipo in ('PROPIETARIO','ADMINISTRADOR')
  )
)
with check (
  exists (
    select 1 from seguridad.miembros_organizacion m
    where m.auth_usuario_id = (select auth.uid())
      and m.activo
      and m.tipo in ('PROPIETARIO','ADMINISTRADOR')
  )
);
