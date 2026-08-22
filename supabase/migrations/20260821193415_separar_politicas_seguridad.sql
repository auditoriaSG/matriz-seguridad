do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'perfiles','permisos','perfil_permisos','grupos_empleados',
    'grupo_perfiles_predeterminados','usuario_perfiles'
  ]
  loop
    execute format('drop policy if exists cambios_administradores on seguridad.%I', table_name);
    execute format('drop policy if exists alta_administradores on seguridad.%I', table_name);
    execute format('drop policy if exists edicion_administradores on seguridad.%I', table_name);
    execute format('drop policy if exists baja_administradores on seguridad.%I', table_name);
    execute format(
      'create policy alta_administradores on seguridad.%I for insert to authenticated with check ((select seguridad.es_administrador(organizacion_id)))', table_name
    );
    execute format(
      'create policy edicion_administradores on seguridad.%I for update to authenticated using ((select seguridad.es_administrador(organizacion_id))) with check ((select seguridad.es_administrador(organizacion_id)))', table_name
    );
    execute format(
      'create policy baja_administradores on seguridad.%I for delete to authenticated using ((select seguridad.es_administrador(organizacion_id)))', table_name
    );
  end loop;
end $$;

drop policy if exists matriz_cambios_administradores
  on public.matriz_seguridad;
create policy matriz_alta_administradores
on public.matriz_seguridad for insert to authenticated
with check (
  exists (select 1 from seguridad.miembros_organizacion m
          where m.auth_usuario_id=(select auth.uid()) and m.activo
            and m.tipo in ('PROPIETARIO','ADMINISTRADOR'))
);
create policy matriz_edicion_administradores
on public.matriz_seguridad for update to authenticated
using (
  exists (select 1 from seguridad.miembros_organizacion m
          where m.auth_usuario_id=(select auth.uid()) and m.activo
            and m.tipo in ('PROPIETARIO','ADMINISTRADOR'))
)
with check (
  exists (select 1 from seguridad.miembros_organizacion m
          where m.auth_usuario_id=(select auth.uid()) and m.activo
            and m.tipo in ('PROPIETARIO','ADMINISTRADOR'))
);
create policy matriz_baja_administradores
on public.matriz_seguridad for delete to authenticated
using (
  exists (select 1 from seguridad.miembros_organizacion m
          where m.auth_usuario_id=(select auth.uid()) and m.activo
            and m.tipo in ('PROPIETARIO','ADMINISTRADOR'))
);
