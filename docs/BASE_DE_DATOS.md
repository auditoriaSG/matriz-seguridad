# Reglas de crecimiento de la base de datos de Nexus SK

## Fuente de verdad

- Supabase/PostgreSQL es la fuente de verdad de producción.
- `public.matriz_seguridad.datos` se conserva temporalmente como respaldo compatible.
- El modelo definitivo de seguridad está en `seguridad.permisos`,
  `seguridad.perfil_permisos`, `seguridad.grupos_empleados` y
  `seguridad.grupo_perfiles_predeterminados`.
- Nunca se elimina el JSON anterior hasta que una comparación automatizada dé
  cero diferencias.

## Dos controles de seguridad independientes

- **Shortcuts:** la matriz histórica de perfiles, permisos y grupos es
  informativa. Sirve para documentar y administrar la configuración que existe
  en el sistema externo Shortcuts. No autoriza funciones dentro de Nexus SK.
- **Nexus SK:** tendrá su propio panel de acceso, perfiles y políticas. Este sí
  gobernará lo que cada usuario puede ver o modificar en esta aplicación y en
  la base de datos.
- Los perfiles de Shortcuts y los perfiles de Nexus SK nunca se relacionan por
  nombre ni se reutilizan automáticamente.

## Separación de responsabilidades

- `core`: organizaciones, departamentos, puestos, regiones y sucursales.
- `rh`: empleados, asignaciones, movimientos, documentos, vacaciones y reloj.
- `seguridad`: usuarios, perfiles, grupos, permisos y PIN cifrado.
- `configuracion` y `catalogo`: apartados, productos y servicios base.
- `stock`: almacenes, existencias, lotes, movimientos y traspasos.
- `ventas`: precios, promociones, paquetes, ventas y sesiones.
- `capacitacion`: recetas, insumos, habilidades, cursos y asistencias.
- `soporte`: tickets y seguimiento de Sistemas.
- `auditoria`: eventos y respaldos verificables.

## Reglas obligatorias para cambios

1. Todo cambio de estructura se crea como una migración SQL nueva.
2. Nunca se edita una migración que ya fue aplicada en producción.
3. Toda tabla debe tener llave primaria, relaciones e índices para sus llaves
   foráneas.
4. Toda tabla de negocio debe incluir `organizacion_id` y RLS.
5. Lectura y escritura se autorizan por separado; iniciar sesión no concede
   por sí solo permisos administrativos.
6. Los perfiles de seguridad no se mezclan con puestos laborales.
7. Las asignaciones que cambian en el tiempo usan `vigente_desde` y
   `vigente_hasta`; no se sobrescribe su historia.
8. Los secretos y hashes nunca se devuelven al navegador.
9. Antes de cada migración se crea respaldo y después se ejecutan los asesores
   de seguridad y rendimiento.
10. Los cambios se prueban primero en local o en una rama de desarrollo y sólo
    después se publican.

## Flujo de despliegue

1. Respaldo.
2. Migración en desarrollo.
3. Pruebas automáticas y manuales.
4. Comparación de cantidades y relaciones.
5. Migración en producción.
6. Revisión de asesores y registros.
7. Publicación de la página.

## Estado de la migración de Seguridad

- Empleados respaldados: 138 de 138.
- Permisos normalizados: 410.
- Permisos activos: 388.
- Decisiones normalizadas: 2,471.
- Grupos normalizados: 16.
- Grupos con perfil predeterminado: 16.
- El JSON permanece como respaldo compatible durante la transición.
