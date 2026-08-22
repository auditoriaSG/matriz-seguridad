-- Correcciones críticas previas a la normalización de la matriz.
-- Esta migración es aditiva: no elimina la matriz JSON ni los respaldos.

create extension if not exists pgcrypto with schema extensions;

create or replace function seguridad.es_administrador(p_organizacion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = seguridad, public
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from seguridad.miembros_organizacion m
    where m.organizacion_id = p_organizacion_id
      and m.auth_usuario_id = (select auth.uid())
      and m.activo
      and m.tipo in ('PROPIETARIO','ADMINISTRADOR')
  );
$$;

revoke all on function seguridad.es_administrador(uuid) from public, anon;
grant execute on function seguridad.es_administrador(uuid) to authenticated;

alter table auditoria.respaldos_matriz_legacy enable row level security;
revoke all on auditoria.respaldos_matriz_legacy from anon;

drop policy if exists respaldos_matriz_solo_administradores
  on auditoria.respaldos_matriz_legacy;
create policy respaldos_matriz_solo_administradores
on auditoria.respaldos_matriz_legacy
for select
to authenticated
using (
  exists (
    select 1
    from seguridad.miembros_organizacion m
    where m.auth_usuario_id = (select auth.uid())
      and m.activo
      and m.tipo in ('PROPIETARIO','ADMINISTRADOR')
  )
);

revoke all on auditoria.respaldos_plantilla_empleados from anon;
drop policy if exists respaldos_plantilla_solo_administradores
  on auditoria.respaldos_plantilla_empleados;
create policy respaldos_plantilla_solo_administradores
on auditoria.respaldos_plantilla_empleados
for select
to authenticated
using ((select seguridad.es_administrador(organizacion_id)));

alter table stock.existencias
  add column if not exists id uuid default gen_random_uuid();
update stock.existencias set id = gen_random_uuid() where id is null;
alter table stock.existencias alter column id set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'stock.existencias'::regclass and contype = 'p'
  ) then
    alter table stock.existencias
      add constraint existencias_pkey primary key (id);
  end if;
end $$;

create unique index if not exists ux_existencias_producto_lote
on stock.existencias (organizacion_id, almacen_id, producto_id, lote_id)
nulls not distinct;

create table if not exists seguridad.empleado_pines (
  empleado_id uuid primary key references rh.empleados(id) on delete cascade,
  pin_hash text not null,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users(id)
);

alter table seguridad.empleado_pines enable row level security;
revoke all on seguridad.empleado_pines from public, anon, authenticated;

create or replace function public.admin_establecer_pin_empleado(
  p_empleado_id uuid,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public, seguridad, rh, extensions
as $$
declare
  v_organizacion_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sesión requerida';
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'El PIN debe contener exactamente 4 dígitos';
  end if;

  select organizacion_id into v_organizacion_id
  from rh.empleados
  where id = p_empleado_id;

  if v_organizacion_id is null then
    raise exception 'Empleado no encontrado';
  end if;
  if not seguridad.es_administrador(v_organizacion_id) then
    raise exception 'No autorizado';
  end if;

  insert into seguridad.empleado_pines(
    empleado_id, pin_hash, actualizado_en, actualizado_por
  )
  values (
    p_empleado_id, crypt(p_pin, gen_salt('bf', 10)), now(), (select auth.uid())
  )
  on conflict (empleado_id) do update
    set pin_hash = excluded.pin_hash,
        actualizado_en = now(),
        actualizado_por = (select auth.uid());
  return true;
end;
$$;

create or replace function public.seguridad_verificar_pin(p_pin text)
returns boolean
language sql
stable
security definer
set search_path = public, seguridad, rh, extensions
as $$
  select (select auth.uid()) is not null
    and p_pin ~ '^[0-9]{4}$'
    and coalesce(bool_or(ep.pin_hash = crypt(p_pin, ep.pin_hash)), false)
  from seguridad.empleado_pines ep
  join rh.empleados e on e.id = ep.empleado_id
  where e.id in (
    select up.empleado_id
    from seguridad.usuario_perfiles up
    where up.auth_usuario_id = (select auth.uid())
      and up.empleado_id is not null
    union
    select employee.id
    from rh.empleados employee
    where lower(employee.correo) = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

revoke all on function public.admin_establecer_pin_empleado(uuid,text)
  from public, anon;
revoke all on function public.seguridad_verificar_pin(text)
  from public, anon;
grant execute on function public.admin_establecer_pin_empleado(uuid,text)
  to authenticated;
grant execute on function public.seguridad_verificar_pin(text)
  to authenticated;

create index if not exists ix_empleado_pines_actualizado_por
  on seguridad.empleado_pines(actualizado_por);
