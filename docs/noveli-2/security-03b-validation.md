# Seguridad 03B: RLS comercial y editorial

Fecha: 2026-10-15. Solo PostgreSQL/Docker LOCAL.

## Checkpoint y archivos protegidos

Checkpoint de 03A: **c1f8b3e**, `chore(noveli-2): consolidate website rls`. Se incluyeron exclusivamente los cuatro archivos aprobados de 03A (migración, SQL de pruebas, adaptador de regresiones y validación). Git quedó limpio antes de comenzar 03B. No se hizo push.

Migración creada mediante `supabase migration new harden_security_03b_rls_crm_editorial`:
`supabase/migrations/20261015230850_harden_security_03b_rls_crm_editorial.sql`.

Referencias: [audit](security-audit.md), [02](security-02-validation.md), [03A](security-03a-validation.md). Baseline y migraciones/pruebas anteriores intactas. SHA-256 binario del baseline: `c41d2d67c856f1d50cdff9a27a739d8655f93844a7876301795ac0aff1b42620`.

No hay consultas/cambios remotos, db push, db pull, reset --linked ni migration repair. No se hizo commit de 03B. No se alteraron columnas, índices ni políticas financieras, ni se incorporaron módulos nuevos.

## Conteos y alcance comprobados

| Métrica | Antes | Después |
|---|---:|---:|
| Tablas public | 46 | 46 |
| Políticas public | 284 | 291 |
| Permisivas | 158 | 165 |
| Restrictivas | 126 | 126 idénticas |
| Políticas en estas 15 tablas | 98 | 105 |
| Políticas fuera de estas tablas | 186 | 186 idénticas |
| Funciones public | 6 | 7 |

Se retiran **53 permisivas** y se crean **60**, cuatro por tabla. La cantidad total sube porque seis tablas tenían solo una política ALL por propietario, ahora sustituida por cuatro comandos explícitos. Las 231 políticas conservadas son idénticas en tabla/nombre, cmd, roles, USING, WITH CHECK y permissive/restrictive, incluidos los 126 guards 02. No se usa el nombre para inferir redundancia.

La séptima función, `security03b_preserve_tenant()`, es un trigger SECURITY INVOKER con `search_path = ''`, sin consultas ni elevación de permisos; no tiene EXECUTE para PUBLIC/anon/authenticated. Quince triggers BEFORE UPDATE OF organization_id impiden mover filas de tenant. No se eliminó ni cambió ningún helper existente.

## Modelo final por tabla y DELETE

Todas las políticas nuevas son PERMISSIVE TO authenticated, limitadas a la organización de la fila. Las permisivas de escritura se combinan con los guards RESTRICTIVE 02 existentes. SELECT requiere is_org_member (membresía activa); INSERT/UPDATE requieren is_org_writer y referencias del mismo tenant. Inactivo no lee ni escribe aunque conserve user_id como propietario; rol desconocido con membresía activa puede leer, pero no escribir. Anon no recibe ninguna política CRM/editorial.

| Tabla | SELECT | INSERT / UPDATE | DELETE | Decisión funcional |
| clients | Miembro activo | Escritor; referencias del mismo tenant | Admin | Entidad principal; se cierra el bypass de propietario sobre DELETE admin. |
| prospects | Miembro activo | Escritor; referencias del mismo tenant | Admin | Entidad principal; admin conserva conversión/gestión, escritor conserva creación y edición. |
| quotations | Miembro activo | Escritor; referencias del mismo tenant | Admin | Cabecera comercial admin; el editor puede seguir reconstruyendo ítems. |
| quotation_items | Miembro activo | Escritor; referencias del mismo tenant | Escritor | Escritores eliminan/reinsertan ítems al editar cotización (Quotations/QuickQuoteModal). |
| providers | Miembro activo | Escritor; referencias del mismo tenant | Admin | Entidad principal; admin elimina, escritores gestionan datos. |
| services | Miembro activo | Escritor; referencias del mismo tenant | Admin | Entidad principal; admin elimina, escritores editan producción. |
| service_catalog | Miembro activo | Escritor; referencias del mismo tenant | Admin | Catálogo reutilizable: se conserva la intención admin del DELETE granular preexistente. |
| service_packs | Miembro activo | Escritor; referencias del mismo tenant | Admin | Pack reutilizable: admin elimina cabecera; escritores pueden reemplazar sus ítems. |
| service_pack_items | Miembro activo | Escritor; referencias del mismo tenant | Escritor | Packs.jsx borra/reinserta ítems al guardar; no se rompe ese flujo. |
| service_checklists | Miembro activo | Escritor; referencias del mismo tenant | Escritor | Hijo operativo editable; escritor conserva gestión de tareas. |
| service_stages | Miembro activo | Escritor; referencias del mismo tenant | Escritor | Hijo de servicio: borrado/reconfiguración de etapas y agenda por escritores. |
| editorial_stages | Miembro activo | Escritor; referencias del mismo tenant | Escritor | Configuración de etapas operativas; se mantiene capacidad writer histórica. |
| documents | Miembro activo | Escritor; referencias del mismo tenant | Escritor | Escritor puede subir, actualizar metadata y eliminar documentos del tenant; flujos existentes en Documents/Clients/Services. |
| agenda_events | Miembro activo | Escritor; referencias del mismo tenant | Escritor | Escritores eliminan eventos manuales y sincronizan/reemplazan eventos generados (Agenda/Services/utils). |
| activity_log | Miembro activo | INSERT escritor + user_id = auth.uid(); UPDATE admin | Admin | INSERT directo necesario; solo admin puede corregir o eliminar historial. No se encontró UPDATE/DELETE real del frontend sobre esta tabla. |

La ampliación de SELECT para providers/hijos/agenda/activity_log es deliberada: sustituye propiedad individual por lectura de equipo activo del mismo tenant, conforme al modelo solicitado. La UI conserva su alcance de módulos por rol; RLS permite escritura general a los cinco roles escritores donde corresponde.

## Consistencia de tenant

Antes, las FK solo verificaban id: un escritor podía enlazar una fila de A con un padre de B si conocía su UUID. Ser miembro de ambas organizaciones tampoco hacía válido ese vínculo. Ahora INSERT y UPDATE contienen EXISTS sobre el padre con `parent.id = child.fk AND parent.organization_id = child.organization_id`, evaluados sin SECURITY DEFINER y bajo RLS del padre. Las FK no nulas originales siguen siendo obligatorias; las opcionales pueden ser NULL.

Referencias protegidas:
- **prospects**: `converted_client_id` → `clients`, `converted_to_client_id` → `clients`.
- **quotations**: `client_id` → `clients`, `prospect_id` → `prospects`, `converted_client_id` → `clients`, `converted_prospect_id` → `prospects`, `service_id` → `services`.
- **quotation_items**: `quotation_id` → `quotations`, `catalog_id` → `service_catalog`, `service_id` → `service_catalog`, `pack_id` → `service_packs`.
- **services**: `client_id` → `clients`.
- **service_pack_items**: `pack_id` → `service_packs`, `service_id` → `service_catalog`.
- **service_checklists**: `service_id` → `services`.
- **service_stages**: `service_id` → `services`.
- **documents**: `client_id` → `clients`, `provider_id` → `providers`, `income_id` → `incomes`, `expense_id` → `expenses`, `service_id` → `services`, `quotation_id` → `quotations`.
- **agenda_events**: `client_id` → `clients`, `service_id` → `services`, `stage_id` → `service_stages`.

La función de trigger bloquea también el movimiento posterior de un padre a otra organización, que de otro modo dejaría hijos válidos convertidos en vínculos cruzados. Aplica incluso a admin y al mantenimiento directo: una transferencia futura requerirá un procedimiento explícito, no un UPDATE corriente. No existe flujo frontend versionado que transfiera organization_id de filas existentes; no se agrega ninguna columna.

Las referencias de documents a incomes/expenses se validan únicamente mediante lectura del padre. No se cambian sus políticas ni se insertan fixtures financieros. En esas dos FK la prueba negativa usa un padre inexistente y confirma rechazo RLS previo al FK; no acredita un documento financiero válido de extremo a extremo. Las demás referencias se prueban con padres reales de otro tenant, incluso para un admin de ambas organizaciones.

## Documents y actividad

Documents: miembro activo lee; escritor sube filas/actualiza metadata/elimina. Se conserva DELETE writer por uso real en Documents.jsx, Clients.jsx y Services.jsx; la política owner anterior ya permitía ese borrado, pese al DELETE granular admin solapado. Las referencias financieras no conceden acceso adicional al padre. Storage no forma parte de esta migración: la autorización de objetos/bucket debe revisarse separadamente; probar RLS de public.documents no acredita la seguridad de enlaces o archivos públicos.

Activity_log: INSERT writer y autor real auth.uid(). UPDATE/DELETE solo admin activo del tenant; no se encontraron consumidores frontend que necesiten modificar historial. La lectura pasa a equipo activo del tenant. El logger automático en supabaseClient.js conserva organization_id del registro de origen, evitando depender del LIMIT 1 de get_user_org_id con fallback a la organización de la operación si el SELECT no devuelve esa columna. No es una auditoría inmutable/criptográfica: un escritor puede redactar un evento nuevo y entity_id es polimórfico, sin FK que permita comprobar genéricamente su tenant. Ese rediseño queda pendiente.

## Cambios frontend

`src/utils/roles.js` incorpora canDeleteEntity(role, table), con lista explícita admin/writer y rechazo de roles/tablas desconocidos. Usa la normalización de 02; no se crean roles ni cambian módulos. Botones DELETE y handlers afectados consultan getCurrentUserRole; el handler se detiene antes de borrados de Storage o asociaciones.

- Admin DELETE: Clients, Prospects, Quotations, ClientQuotesModal, Providers, Services, Catalog y Packs.
- Pendientes 03A: Website bloquea DELETE de website_services, website_books, website_links y website_sections para no-admin. No existe botón DELETE de website_settings que ajustar.
- Ítems, agenda y documentos mantienen su flujo writer; no se rediseñan componentes.
- supabaseClient.js: los tres INSERT automáticos de activity_log reciben organization_id del registro origen (fallback a orgId de la operación). La creación automática de service_stages fija el tenant del servicio y la consulta de plantillas editorial_stages filtra la organización actual. No se alteran operaciones/políticas financieras.
- La caché de rol controla presentación; RLS decide autorización efectiva y protege ante una caché manipulada o desactualizada.

## Políticas eliminadas y reemplazo exacto

Los predicados siguientes proceden del catálogo local antes de 03B, no de una inferencia por nombre. NULL significa que el comando no tenía ese predicado explícito. Cada ALL se sustituye por los cuatro comandos; no se conserva una permisiva capaz de hacer OR y eludir DELETE admin.

| Tabla | Política eliminada | cmd | roles | USING | WITH CHECK | Reemplazo | Motivo |
|---|---|---|---|---|---|---|---|
| activity_log | Users can manage their own activity_log | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| agenda_events | Users can manage their own agenda_events | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| clients | Users can manage their own clients | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| clients | clients_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03b_delete | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| clients | clients_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03b_insert | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| clients | clients_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03b_select | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| clients | clients_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03b_update | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| documents | Users can manage their own documents | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| documents | documents_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03b_delete | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| documents | documents_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03b_insert | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| documents | documents_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03b_select | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| documents | documents_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03b_update | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| editorial_stages | Users can manage their own editorial_stages | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| prospects | Users can manage their own prospects | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| prospects | prospects_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03b_delete | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| prospects | prospects_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03b_insert | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| prospects | prospects_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03b_select | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| prospects | prospects_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03b_update | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| providers | Users can manage their own providers | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| quotation_items | Users can manage their own quotation_items | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| quotation_items | quotation_items_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03b_delete | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| quotation_items | quotation_items_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03b_insert | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| quotation_items | quotation_items_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03b_select | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| quotation_items | quotation_items_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03b_update | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| quotations | Users can manage their own quotations | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| quotations | quotations_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03b_delete | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| quotations | quotations_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03b_insert | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| quotations | quotations_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03b_select | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| quotations | quotations_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03b_update | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_catalog | Users can manage their own service_catalog | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| service_catalog | service_catalog_org_access | ALL | authenticated | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | security03b_select/insert/update/delete | ALL solapado sin filtro active; reemplazo por helpers de membresía activa y writer. |
| service_catalog | service_catalog_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03b_delete | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_catalog | service_catalog_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03b_insert | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_catalog | service_catalog_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03b_select | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_catalog | service_catalog_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03b_update | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_checklists | Users can manage their own service_checklists | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| service_pack_items | Users can manage their own service_pack_items | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| service_packs | Users can manage their own service_packs | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| service_packs | service_packs_org_access | ALL | authenticated | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | (organization_id IN ( SELECT organization_members.organization_id    FROM organization_members   WHERE (organization_members.user_id = auth.uid()))) | security03b_select/insert/update/delete | ALL solapado sin filtro active; reemplazo por helpers de membresía activa y writer. |
| service_packs | service_packs_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03b_delete | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_packs | service_packs_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03b_insert | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_packs | service_packs_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03b_select | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_packs | service_packs_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03b_update | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_stages | Users can manage their own service_stages | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| service_stages | service_stages_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03b_delete | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_stages | service_stages_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03b_insert | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_stages | service_stages_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03b_select | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| service_stages | service_stages_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03b_update | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| services | Users can manage their own services | ALL | public | (auth.uid() = user_id) | (auth.uid() = user_id) | security03b_select/insert/update/delete | Sustituir propiedad individual/PUBLIC por tenant activo y comandos explícitos; cerrar OR que eludía restricciones. |
| services | services_org_delete | DELETE | authenticated | is_org_admin(organization_id) | NULL | security03b_delete | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| services | services_org_insert | INSERT | authenticated | NULL | is_org_member(organization_id) | security03b_insert | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| services | services_org_select | SELECT | authenticated | is_org_member(organization_id) | NULL | security03b_select | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |
| services | services_org_update | UPDATE | authenticated | is_org_member(organization_id) | is_org_member(organization_id) | security03b_update | Comando consolidado; escritura writer, integridad tenant y DELETE según decisión por tabla. |

## Pruebas y reproducción

Comandos locales:

```text
supabase db reset --local
python supabase/tests/security_03b_regressions.py
node --test src/utils/roles.test.js
npm run build
npx eslint . --format json --output-file <archivo-temporal>
```

El adaptador 03B reutiliza únicamente las funciones del adaptador 03A, sin ejecutar su runner al importarlo. Mantiene originales SQL 01/02/03A intactos; adapta de forma acotada conteos, inventario de la función trigger y DELETE admin de clients. El replay dentro de 02 sigue limitado al preflight de normalización de roles para no reinstalar políticas antiguas. Las expectativas de acceso restantes se conservan.

Todas las suites crean fixtures sintéticos dentro de BEGIN/ROLLBACK. La suite 03B prueba CRUD en las quince tablas para admin/editor/diseñador/corrector/finanzas/visualizador/inactivo/desconocido/anon; comprueba aislamiento de lectura, UPDATE y DELETE hacia B, referencias cruzadas INSERT/UPDATE, cambio de tenant y helper writer por organización. Incluye datos cuyo user_id es del usuario inactivo para detectar un eventual bypass por propiedad. Las regresiones 03A conservan lectura web legítima, anon sin CMS/leads SELECT y formulario válido con tenant fijo/campos internos bloqueados.

Resultados de la última ejecución:

| Verificación | Resultado |
|---|---|
| supabase db reset --local | PASS, exit 0; baseline → 01 → 02 → 03A → 03B |
| Security 01 | PASS, 49 avisos PASS |
| Security 02 | PASS, 274 avisos PASS |
| Security 03A | PASS, 316 avisos PASS |
| Security 03B | PASS, 989 avisos PASS |
| Frontend node --test | 5/5 PASS |
| npm run build | PASS, 421 módulos; warnings de tamaño de chunk y sourcemap Tailwind |
| Lint diagnóstico | Exit 1: 404 errores y 22 warnings históricos, mismos totales antes/después; 0 diagnósticos nuevos |
| Catálogo completo | 53 retiradas, 60 creadas, 231 idénticas; 126 guards idénticos |
| Baseline / migraciones anteriores | Sin cambios; comparación Git normalizando únicamente finales de línea y SHA binario del baseline |
| FK cruzadas existentes locales | 0 anomalías; no permite inferir estado remoto, fixtures revertidos |

Lint se comparó por archivo, regla, severidad y mensaje sin los code frames que incorporan números de línea/contexto desplazados por los imports. Tras el último ajuste se repitió lint únicamente en supabaseClient.js. No aparecieron diagnósticos nuevos en ningún archivo modificado; no se corrigieron errores históricos fuera de alcance. No hay script npm test: se ejecutó el único archivo de tests frontend existente con node --test.

La primera ejecución de la suite nueva rechazó el tipo sintético `servicios` de providers; se corrigió a `otro`, permitido por su CHECK. No fue un fallo de migración. Ambos resets locales completos terminaron correctamente. El aviso de seed.sql ausente ya existía y no bloquea reset. Todas las suites finalizaron con su marcador de ROLLBACK; no quedó información sintética persistida.

## Riesgos pendientes y exclusiones

- No se conoce el estado de producción: no se consultó ni cambió remoto. Revisar antes de desplegar filas históricas con organization_id nulo o referencias cruzadas; esta migración no las mueve ni las sanea. Las comprobaciones nuevas rechazarán su edición hasta corregir referencias. Las filas sin tenant dejan de ser visibles por RLS de membresía.
- DELETE principal pasa a admin como se solicitó; integraciones externas o clientes antiguos deben contemplar el nuevo rechazo. Triggers impiden transferencias entre tenants, incluso con membresía en ambos.
- Storage, entity_id polimórfico y arquitectura completa de auditoría pendientes. Los consumidores externos del log deben enviar explícitamente el tenant correcto.
- Las dos FK financieras de documents tienen prueba negativa sin fixtures financieros, no una prueba funcional financiera completa.
- Quedan fuera todas las tablas financieras y configuración, orders/payments/contracts/projects/colaboradores nuevos. No se altera website_leads ni los guards 02.
- Permanecen seis ALL para PUBLIC candidatas a revisión fuera de este alcance: exchange_rates, expenses, incomes, organizations, quick_replies y settings. No se afirma que todas tengan la misma vulnerabilidad; requieren análisis de sus comandos/predicados. También se conservan otras políticas financieras aún no consolidadas. Dentro de estas quince tablas no queda ninguna permisiva antigua ni PUBLIC/ALL.
- `contador` como tipo de proveedor es una categoría comercial del CHECK de providers, no un rol de acceso; no se normaliza como si fuese un rol.
