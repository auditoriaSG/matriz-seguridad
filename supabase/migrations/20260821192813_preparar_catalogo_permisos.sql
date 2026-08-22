-- Conserva la jerarquía funcional que utiliza la matriz actual.

alter table seguridad.permisos
  add column if not exists modulo text,
  add column if not exists pantalla text,
  add column if not exists obsoleto boolean not null default false;

create unique index if not exists ux_permisos_organizacion_legacy
  on seguridad.permisos(organizacion_id, legacy_id)
  where legacy_id is not null;

create index if not exists ix_permisos_modulo_orden
  on seguridad.permisos(organizacion_id, modulo, orden);

create index if not exists ix_perfil_permisos_organizacion
  on seguridad.perfil_permisos(organizacion_id, perfil_id);
