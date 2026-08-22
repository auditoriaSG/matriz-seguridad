-- Los hashes de PIN nunca se exponen al navegador.
-- Las funciones RPC verifican el PIN sin devolver el hash.

revoke all on seguridad.empleado_pines from public, anon, authenticated;

drop policy if exists empleado_pines_bloqueo_directo
  on seguridad.empleado_pines;
create policy empleado_pines_bloqueo_directo
on seguridad.empleado_pines
for all
to authenticated
using (false)
with check (false);
