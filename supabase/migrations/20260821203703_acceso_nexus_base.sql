create schema if not exists acceso_nexus;
revoke all on schema acceso_nexus from public,anon;
grant usage on schema acceso_nexus to authenticated;

create table acceso_nexus.perfiles (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references core.organizaciones(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  es_sistema boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique(organizacion_id,codigo)
);

create table acceso_nexus.politicas (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references core.organizaciones(id) on delete cascade,
  codigo text not null,
  modulo text not null,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  orden integer not null default 0,
  unique(organizacion_id,codigo)
);

create table acceso_nexus.perfil_politicas (
  organizacion_id uuid not null references core.organizaciones(id) on delete cascade,
  perfil_id uuid not null references acceso_nexus.perfiles(id) on delete cascade,
  politica_id uuid not null references acceso_nexus.politicas(id) on delete cascade,
  decision text not null default 'DENEGAR' check(decision in ('PERMITIR','DENEGAR')),
  actualizado_por uuid references auth.users(id),
  actualizado_en timestamptz not null default now(),
  primary key(perfil_id,politica_id)
);

create table acceso_nexus.usuario_perfiles (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references core.organizaciones(id) on delete cascade,
  auth_usuario_id uuid not null references auth.users(id) on delete cascade,
  empleado_id uuid references rh.empleados(id) on delete set null,
  perfil_id uuid not null references acceso_nexus.perfiles(id) on delete restrict,
  alcance_tipo text not null default 'GLOBAL'
    check(alcance_tipo in ('GLOBAL','REGION','SUCURSAL','PROPIO')),
  alcance_id uuid,
  vigente_desde timestamptz not null default now(),
  vigente_hasta timestamptz,
  asignado_por uuid references auth.users(id)
);

create table acceso_nexus.eventos (
  id bigint generated always as identity primary key,
  organizacion_id uuid not null references core.organizaciones(id) on delete cascade,
  auth_usuario_id uuid references auth.users(id),
  accion text not null,
  entidad text not null,
  entidad_id text,
  datos jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

alter table acceso_nexus.perfiles enable row level security;
alter table acceso_nexus.politicas enable row level security;
alter table acceso_nexus.perfil_politicas enable row level security;
alter table acceso_nexus.usuario_perfiles enable row level security;
alter table acceso_nexus.eventos enable row level security;

create index ix_nexus_politicas_modulo on acceso_nexus.politicas(organizacion_id,modulo,orden);
create index ix_nexus_perfil_politicas_politica on acceso_nexus.perfil_politicas(politica_id);
create index ix_nexus_usuario_perfiles_usuario on acceso_nexus.usuario_perfiles(auth_usuario_id,organizacion_id) where vigente_hasta is null;
create index ix_nexus_usuario_perfiles_empleado on acceso_nexus.usuario_perfiles(empleado_id) where empleado_id is not null;
create index ix_nexus_usuario_perfiles_perfil on acceso_nexus.usuario_perfiles(perfil_id);
create index ix_nexus_eventos_org_fecha on acceso_nexus.eventos(organizacion_id,creado_en desc);

with org as (select organizacion_id from seguridad.miembros_organizacion limit 1),
seed(codigo,modulo,nombre,orden) as (values
 ('MATRIZ_ACCESO_VER','Seguridad Nexus','Consultar matriz de acceso',10),
 ('MATRIZ_ACCESO_ADMINISTRAR','Seguridad Nexus','Administrar perfiles y políticas',20),
 ('USUARIOS_VER','Seguridad Nexus','Consultar usuarios',30),
 ('USUARIOS_ADMINISTRAR','Seguridad Nexus','Crear, suspender y asignar usuarios',40),
 ('CAPITAL_HUMANO_VER','Capital Humano','Consultar empleados',50),
 ('CAPITAL_HUMANO_ADMINISTRAR','Capital Humano','Administrar empleados y expedientes',60),
 ('REGIONAL_VER','Configuración regional','Consultar regiones y sucursales',70),
 ('REGIONAL_ADMINISTRAR','Configuración regional','Administrar regiones y sucursales',80),
 ('GENERAL_VER','Configuración general','Consultar configuración general',90),
 ('GENERAL_ADMINISTRAR','Configuración general','Administrar catálogos generales',100),
 ('STOCK_VER','Stock','Consultar Stock',110),
 ('STOCK_ADMINISTRAR','Stock','Administrar existencias y movimientos',120),
 ('VENTAS_VER','Ventas','Consultar ventas, servicios y precios',130),
 ('VENTAS_ADMINISTRAR','Ventas','Administrar ventas, servicios y precios',140),
 ('CAPACITACION_VER','Capacitación','Consultar capacitación',150),
 ('CAPACITACION_ADMINISTRAR','Capacitación','Administrar capacitación',160),
 ('SISTEMAS_VER','Sistemas','Consultar tickets',170),
 ('SISTEMAS_ADMINISTRAR','Sistemas','Administrar tickets y soporte',180),
 ('AUDITORIA_VER','Auditoría','Consultar historial y auditoría',190)
)
insert into acceso_nexus.politicas(organizacion_id,codigo,modulo,nombre,orden)
select org.organizacion_id,seed.codigo,seed.modulo,seed.nombre,seed.orden
from org cross join seed;

with org as (select organizacion_id from seguridad.miembros_organizacion limit 1)
insert into acceso_nexus.perfiles(organizacion_id,codigo,nombre,descripcion,es_sistema)
select organizacion_id,'ADMIN_NEXUS','Administrador Nexus','Perfil inicial de recuperación y administración de la matriz.',true
from org;

insert into acceso_nexus.perfil_politicas(organizacion_id,perfil_id,politica_id,decision)
select profile.organizacion_id,profile.id,policy.id,'PERMITIR'
from acceso_nexus.perfiles profile
join acceso_nexus.politicas policy on policy.organizacion_id=profile.organizacion_id
where profile.codigo='ADMIN_NEXUS';

insert into acceso_nexus.usuario_perfiles(
  organizacion_id,auth_usuario_id,perfil_id,alcance_tipo,asignado_por
)
select member.organizacion_id,member.auth_usuario_id,profile.id,'GLOBAL',member.auth_usuario_id
from seguridad.miembros_organizacion member
join acceso_nexus.perfiles profile
  on profile.organizacion_id=member.organizacion_id and profile.codigo='ADMIN_NEXUS'
where member.activo and member.tipo='PROPIETARIO';

create or replace function acceso_nexus.tiene_politica(
  p_organizacion_id uuid,p_codigo text
)
returns boolean
language sql
stable
security definer
set search_path=acceso_nexus,public
as $$
  select (select auth.uid()) is not null and exists(
    select 1
    from acceso_nexus.usuario_perfiles user_profile
    join acceso_nexus.perfil_politicas profile_policy
      on profile_policy.perfil_id=user_profile.perfil_id
    join acceso_nexus.politicas policy on policy.id=profile_policy.politica_id
    where user_profile.organizacion_id=p_organizacion_id
      and user_profile.auth_usuario_id=(select auth.uid())
      and user_profile.vigente_hasta is null
      and policy.codigo=p_codigo and policy.activo
      and profile_policy.decision='PERMITIR'
  );
$$;
revoke all on function acceso_nexus.tiene_politica(uuid,text) from public,anon;
grant execute on function acceso_nexus.tiene_politica(uuid,text) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['perfiles','politicas','perfil_politicas','usuario_perfiles','eventos']
  loop
    execute format('create policy nexus_lectura on acceso_nexus.%I for select to authenticated using ((select acceso_nexus.tiene_politica(organizacion_id,''MATRIZ_ACCESO_VER'')))',table_name);
  end loop;
  foreach table_name in array array['perfiles','politicas','perfil_politicas']
  loop
    execute format('create policy nexus_alta_matriz on acceso_nexus.%I for insert to authenticated with check ((select acceso_nexus.tiene_politica(organizacion_id,''MATRIZ_ACCESO_ADMINISTRAR'')))',table_name);
    execute format('create policy nexus_edicion_matriz on acceso_nexus.%I for update to authenticated using ((select acceso_nexus.tiene_politica(organizacion_id,''MATRIZ_ACCESO_ADMINISTRAR''))) with check ((select acceso_nexus.tiene_politica(organizacion_id,''MATRIZ_ACCESO_ADMINISTRAR'')))',table_name);
    execute format('create policy nexus_baja_matriz on acceso_nexus.%I for delete to authenticated using ((select acceso_nexus.tiene_politica(organizacion_id,''MATRIZ_ACCESO_ADMINISTRAR'')))',table_name);
  end loop;
end $$;

create policy nexus_alta_usuarios on acceso_nexus.usuario_perfiles for insert to authenticated
with check((select acceso_nexus.tiene_politica(organizacion_id,'USUARIOS_ADMINISTRAR')));
create policy nexus_edicion_usuarios on acceso_nexus.usuario_perfiles for update to authenticated
using((select acceso_nexus.tiene_politica(organizacion_id,'USUARIOS_ADMINISTRAR')))
with check((select acceso_nexus.tiene_politica(organizacion_id,'USUARIOS_ADMINISTRAR')));

grant select,insert,update,delete on acceso_nexus.perfiles,acceso_nexus.politicas,
  acceso_nexus.perfil_politicas,acceso_nexus.usuario_perfiles to authenticated;
grant select on acceso_nexus.eventos to authenticated;
