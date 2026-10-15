# Validación local: harden_security_01_critical

Migración: `supabase/migrations/20261015021942_harden_security_01_critical.sql`.
Creada mediante `supabase migration new harden_security_01_critical`.

## Alcance y decisiones

- Baseline intacto: SHA-256 `C41D2D67C856F1D50CDFF9A27A739D8655F93844A7876301795AC0AFF1B42620`.
- get_user_org_id/get_user_role conservan SECURITY DEFINER, STABLE, active=true, LIMIT 1 y semántica de roles. Se cualifica public.organization_members y se fija search_path vacío.
- is_org_member/is_org_admin ya exigían active=true y admin literal en el baseline. Sus cuerpos no cambian; se fija search_path vacío. Se conservan ACL de los cuatro helpers dependidos por RLS/defaults.
- get_public_schema_columns no tiene consumidores frontend encontrados. Se revoca EXECUTE de PUBLIC/anon/authenticated; se mantiene postgres propietario y el permiso service_role existente para diagnóstico operativo confiable. Sin cambios a defaults globales ni eliminación de funciones.
- Select profile cambia a authenticated y auth.uid=id. Manage profile se conserva. No se encontró consumo de un directorio de perfiles ajenos; organization_members sigue proporcionando los datos de miembros usados por el CRM.
- Solo se elimina Payroll payments org access. Payroll org access y las cuatro reglas granulares se conservan: todavía existe su autorización ALL amplia, explícitamente fuera de este paso.
- website_exchange_rates_auth_manage sigue siendo ALL, pero exige una membresía del mismo usuario con active=true y role=admin. Como las tasas son globales y no tienen organization_id, basta ser admin activo de alguna organización. La subconsulta evita tomar un role de un tenant y una organización de otro mediante LIMIT 1. La lectura pública de tasas activas se conserva; admin puede gestionar también tasas inactivas.

## Ejecución y resultados

`supabase db reset` se ejecutó únicamente en local, sin --linked, y terminó con código 0 al aplicar baseline y nueva migración. Único aviso de reproducción: no existe supabase/seed.sql.

Prueba reproducible: `supabase/tests/security_01_critical.sql`, ejecutada con psql ON_ERROR_STOP dentro de `supabase_db_CRM_NOVELI`. Usa SET ROLE real anon/authenticated y claims de sesión de usuarios sintéticos; no prueba acceso con postgres como sustituto de RLS. Los fixtures y helpers temporales están dentro de BEGIN/ROLLBACK.

| Verificación | Resultado |
|---|---|
| Tablas public | 46 |
| Funciones public | 5, conservadas |
| RLS | Habilitado en las 46 tablas |
| Políticas | 165 antes → 164 después |
| Payroll | 6 → 5; solo desaparece el duplicado exacto |
| Cuatro helpers | SECURITY DEFINER, search_path seguro y EXECUTE preservados |
| Membresía/login | La consulta role/organization_id de usuario activo sigue funcionando |
| Admin literal activo | is_org_admin/is_org_member verdaderos |
| Admin inactivo | Ambos falsos; helpers antiguos devuelven NULL |
| Rol administrador | No se convierte a admin; no administra tasas |
| Admin multi-organización | Reconocido en su organización admin; puede gestionar tasas globales |
| Perfiles anon | Cero perfiles visibles |
| Perfil authenticated | Solo el propio; lectura y actualización conservadas |
| Tasas activas públicas | Lectura conservada para anon/no-admin |
| Escritura tasas anon/no-admin/inactivo/sin membresía | INSERT rechazado; UPDATE/DELETE afectan cero filas |
| Escritura tasas admin activo | INSERT/UPDATE/DELETE permitidos |
| RPC de metadatos | Ejecución denegada a anon/authenticated; privilegio preservado para postgres/service_role |
| Fixtures | ROLLBACK; no se conservan usuarios, membresías, perfiles ni tasas de prueba |

## Compatibilidad y pendientes

No se modificó frontend. Las consultas de membresía y perfil propio están verificadas en SQL bajo authenticated; no se ejecutó un login end-to-end en navegador. El esquema Auth no cambió.

El rol legado administrador pierde la capacidad de modificar tasas que antes tenía cualquier authenticated: es el endurecimiento solicitado, no una conversión de roles. La interfaz aún mezcla admin/administrador y finanzas/contador, y guarda visualizador mientras otros controles esperan solo lectura. No se resuelve aquí. La RPC get_user_id_by_email ausente y el wrapper sin rpc son incompatibilidades preexistentes, no introducidas por esta migración.

No se tocaron otras políticas redundantes, ownership, normalización de roles, website_leads, referencias entre tenants, grants de tablas/default privileges ni índices de FK. Requieren decisiones y pruebas más amplias. El LIMIT 1 histórico de organización/rol y las rutas ALL amplias siguen pendientes por instrucción de alcance.

No se ejecutaron db push, db pull, reset --linked, migration repair, cambios manuales remotos ni SQL del baseline en producción durante esta implementación.
