# Arquitectura hexagonal

La aplicación separa las reglas del negocio de la interfaz y de Supabase.

```text
Adaptadores de entrada        Aplicación                 Dominio
Interfaz / navegación  ->  Casos de uso  ->  Matriz, perfiles y empleados
                                  |
                                  v
                           Puertos de salida
                                  |
                    Supabase / almacenamiento local
```

## Responsabilidades

- `src/domain`: reglas puras y normalización de entidades.
- `src/application`: casos de uso; no conoce HTML ni Supabase.
- `src/adapters`: implementaciones externas de autenticación, datos y almacenamiento.
- `src/bootstrap.js`: composición de dependencias.
- `app.js`: adaptador de entrada para la interfaz existente.

La clave pública de Supabase puede estar en el navegador. La autorización real debe mantenerse en PostgreSQL mediante permisos y RLS; nunca debe exponerse una clave `service_role`.
