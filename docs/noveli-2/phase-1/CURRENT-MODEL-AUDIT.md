# Auditoría del modelo actual — Phase 1

Captura productiva: 2026-10-18T21:15:48.042484+00:00. Proyecto `bdxlzhpmifxwmqjnnmxa`. Código CRM inspeccionado: `d4332c4ac3f6d6f5b84325ab532f4e3bd39ba273`.

Solo SELECT de catálogos y perfiles de datos; sin cambios productivos. Datos personales y contenido documental excluidos del perfil. Los archivos JSON adjuntos son evidencia de catálogo, no un backup de datos.

## Evidencia y alcance

La auditoría de catálogo, tipos/grants, perfil agregado de datos y consumidores frontend se conservó como artefactos locales de revisión. Los JSON/TXT de evidencia detallada no forman parte del commit de Phase 1A; este informe resume sus conclusiones relevantes. No se incluye contenido personal ni credenciales.

Hay 46 tablas públicas; 46 con RLS. Historial: `20261014031607` → `20261015021942` → `20261015023731` → `20261015030234` → `20261015230850` → `20261015233425` → `20261016013219` → `20261016013221`. Buckets actuales: documents privado (36 objetos), brand-assets público (19). Los 7 documents tienen path canónico y objeto existente.

## Hallazgos que condicionan el diseño

1. Clients/prospects/services contienen simultáneamente identidad, acuerdo, cobro, firma y preparación operativa. La Orden debe separar estas responsabilidades sin retirar los campos legacy.
2. Las 6 cotizaciones están en borrador, sin client_id; 5 sin ítems. No hay candidatos aceptados para una conversión automática ni evidencia histórica suficiente para crear órdenes fiables desde clientes pagados.
3. Cotización dac4ca9d-f590-4210-919c-914fcc4adae9: ítem pack 490000; ajuste 30%=147000; neto 637000; impuesto 121030; total 758030 CLP. El ítem conserva total 490000 y gross_amount/net_amount/tax_amount en cero. No se puede copiar únicamente total del ítem ni usar price (cero) como precio vigente.
4. price/unit_price y gross_amount/total discrepan en el único quotation_item; includes_vat/includes_iva discrepan en 5 cotizaciones; total_amount/total_agreed_amount discrepan en los 4 clientes. No aplicar COALESCE a columnas monetarias cuyo default cero aparenta información válida. Los balances de clientes sí coinciden actualmente; eso no demuestra equivalencia semántica permanente.
5. Frontend Quotation/QuickQuote actualiza cabecera, borra ítems y los reinserta en requests separados. No garantiza transacción ni identidad estable del ítem. Una orden debe conservar snapshot independiente y source_quotation_item_id histórico sin FK rígida al ítem mutable.
6. Quotation UI ofrece y escribe “convertida a prospecto”; el CHECK productivo solo admite borrador/enviada/aceptada/rechazada/vencida. La conversión crea primero un prospecto y puede fallar después al actualizar cotización. Se registra como deuda preexistente; no se corrige en esta iteración.
7. Las FK actuales por id no prueban igualdad de organization_id entre padre e hijo. Las 34 comprobaciones auditadas dan cero discrepancias ahora; no equivalen a un enforcement multi-tenant futuro.
8. get_user_org_id/get_user_role usan LIMIT 1 sobre membresías activas. Phase 1 debe recibir tenant explícito y validarlo, nunca elegirlo implícitamente en escenarios multi-organización.
9. income_allocations distribuye internamente ingreso por área; income_distributions financia fondos/reservas/nómina. Ninguna es una aplicación de pago a vencimientos. Los 10 allocations existentes y 4 incomes se conservan, sin duplicar caja.
10. staff.role es cargo laboral libre; no es rol de autorización. user_id en staff no demuestra que cada colaborador sea ese usuario de Auth; no crear nuevos permisos desde esos campos.
11. activity_log no es un libro de eventos inmutable ni dispone de payload estructurado. No sustenta por sí solo trazabilidad financiera o evidencia legal.
12. RLS de fila no protege columnas sensibles ni vuelve inmutables bytes Storage. Los futuros contratos firmados necesitan controles de DB y Storage específicos sin abrir documents.

## Lectura del frontend y efectos

| Área | Evidencia principal | Dependencia a conservar |
|---|---|---|
| Cotizaciones | Quotations.jsx 425, 611, 969–1063, 1108–1166; QuickQuoteModal.jsx 738–824; ClientQuotesModal.jsx 40,89 | Catálogo/packs, importes calculados en JS, guardado separado, PDF y conversión legacy |
| Cálculo | src/utils/proposalCalculations.js 5–200 | Ajuste extensión, descuento de cabecera, IVA included/plus/exento, Math.round actualmente incluso USD |
| Clientes | Clients.jsx 365,487,881,915,1012,1167,1539–1777 | Acuerdo financiero, contratos/archivos, generación servicios e ingresos |
| Prospectos | Prospects.jsx 543,755–1006,1073 | Conversión a cliente y servicio; campos de acuerdo duplicados |
| Operación | Services.jsx 527,678–702,803,878–955; Agenda.jsx 48–53,309–446 | Services es expediente operativo, no catálogo comercial; etapas/checklists siguen vigentes |
| Finanzas | Incomes.jsx 86,175,218–219,423–517; IncomeDistributionModal.jsx 191–345 | Asignaciones/distribuciones con efectos en fondos/nómina; no llamar al registrar un pago nuevo |
| Gastos | Expenses.jsx 113–116,288–392,448–457 | Comprobantes, fondos, moneda y flujo caja existentes |
| Documentos | Documents.jsx 97–103,293,330; utils/storageDocuments.js; utils/frontendMutations.js | Signed URLs 300 s y confirmación real de borrado; referencias opcionales a entidades legacy |
| Catálogo/packs | Catalog.jsx 67–225; Packs.jsx 52–56,141–241 | Pricing fuente para nuevas propuestas; no para recalcular órdenes históricas |
| Staff/permisos | Staff.jsx 106–135,254–363; UsersPermissions.jsx 87–252; utils/roles.js | Finanzas restringida a admin/finanzas; membresía activa y roles canónicos |
| Informes/dashboard | Reports.jsx 81–88; CompletedSales.jsx 32–35; Dashboard.jsx; App.jsx | No sumar payments e incomes en paralelo; los adaptadores actuales siguen intactos |
| CMS | Website.jsx 2523,2606 | Leads generan cotización/prospecto; la web pública no recibe API de órdenes/pagos/contratos |
| Adaptación de esquema | config/databaseContract.js; supabaseClient.js 1930–2200,2352 | Contrato estático y joins de compatibilidad pueden ignorar columnas/tablas desconocidas. Phase 1 requiere registro explícito cuando se implemente |

Las líneas se verifican contra el commit indicado, no contra una futura implementación.

## Inventario por tabla

Leyenda: NULL=columna nullable; default “—”=sin default. PK/FK/CHECK/UNIQUE, índices y policies se reproducen desde producción. Las FK generan triggers internos de Postgres; se describen en constraints, no como triggers de negocio. Un listado vacío de triggers significa que no existe trigger de usuario para esa tabla.

### clients

Filas: **4**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"clients","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | auth.uid() |
| name | text | NO | — |
| email | text | YES | — |
| instagram | text | YES | — |
| phone | text | YES | — |
| country | text | YES | — |
| status | text | NO | 'prospecto'::text |
| notes | text | YES | — |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| organization_id | uuid | YES | get_user_org_id() |
| city | text | YES | — |
| timezone | text | YES | — |
| client_type | text | YES | 'Nacional'::text |
| preferred_currency | text | YES | 'CLP'::text |
| agreement_notes | text | YES | — |
| agreement_period_type | text | YES | — |
| amount_paid | numeric | YES | 0 |
| total_amount | numeric | YES | 0 |
| remaining_amount | numeric | YES | 0 |
| payment_status | text | YES | 'pendiente'::text |
| payment_method | text | YES | — |
| contract_status | text | YES | 'pendiente'::text |
| contract_signed | boolean | YES | false |
| balance_due | numeric | YES | 0 |
| invoice_status | text | YES | 'pendiente'::text |
| invoice_required | boolean | YES | false |
| payment_link | text | YES | — |
| payment_date | date | YES | — |
| contract_sent | boolean | YES | false |
| contract_sent_at | timestamp with time zone | YES | — |
| invoice_sent | boolean | YES | false |
| invoice_number | text | YES | — |
| contract_signed_received | boolean | YES | false |
| contract_signed_at | timestamp with time zone | YES | — |
| contract_signed_received_at | timestamp with time zone | YES | — |
| contract_file_url | text | YES | — |
| signed_contract_file_url | text | YES | — |
| currency | text | YES | 'CLP'::text |
| files_received | boolean | YES | false |
| files_received_at | timestamp with time zone | YES | — |
| files_status | text | YES | 'pendiente'::text |
| manuscripts_received | boolean | YES | false |
| manuscripts_received_at | timestamp with time zone | YES | — |
| documents_received | boolean | YES | false |
| documents_received_at | timestamp with time zone | YES | — |
| cover_received | boolean | YES | false |
| cover_received_at | timestamp with time zone | YES | — |
| files_notes | text | YES | — |
| includes_vat | boolean | YES | false |
| subtotal_amount | numeric | YES | 0 |
| vat_amount | numeric | YES | 0 |
| final_amount | numeric | YES | 0 |
| interest_service | text | YES | — |
| total_agreed_amount | numeric | YES | 0.00 |
| paid_at | date | YES | — |
| payment_link_sent | boolean | YES | false |
| payment_link_sent_at | date | YES | — |
| ready_to_start | boolean | YES | false |
| selected_services | jsonb | YES | '[]'::jsonb |
| service_category | text | YES | 'editorial'::text |
| materials_received | boolean | YES | false |
| materials_received_at | date | YES | — |
| partial_payment_authorized | boolean | YES | false |
| ready_to_start_reason | text | YES | — |
| services_summary | text | YES | — |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |
| includes_iva | boolean | YES | true |

Restricciones:

- `clients_pkey`: `PRIMARY KEY (id)`.
- `clients_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `clients_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- `clients_status_check`: `CHECK ((status = ANY (ARRAY['cliente'::text, 'prospecto'::text, 'interesado'::text, 'contrato enviado'::text, 'acuerdo enviado'::text, 'link de pago enviado'::text, 'esperando pago'::text, 'pago recibido'::text, 'contrato firmado recibido'::text, 'esperando contrato firmado'::text, 'esperando manuscrito/archivos'::text, 'esperando archivos/materiales'::text, 'listo para iniciar'::text, 'en proceso editorial'::text, 'en proceso'::text, 'finalizado'::text, 'perdido / rechazado'::text, 'perdido'::text])))`.

Índices:

- `CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id)`.
- `CREATE INDEX idx_clients_user_id ON public.clients USING btree (user_id)`.
- `CREATE INDEX idx_clients_org_id ON public.clients USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.clients FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): payment_status="pagado" (4); currency="CLP" (4); status="listo para iniciar" (2); contract_status="pendiente" (4); status="cliente" (1); status="en proceso editorial" (1).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03b_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03b_insert | PERMISSIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security03b_select | PERMISSIVE | authenticated | SELECT | is_org_member(organization_id) | — |
| security03b_update | PERMISSIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

- prospects.prospects_converted_to_client_id_fkey: `FOREIGN KEY (converted_to_client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- services.services_client_id_fkey: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE`.
- incomes.incomes_client_id_fkey: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- quotations.quotations_client_id_fkey: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- documents.documents_client_id_fkey: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- prospects.prospects_converted_client_id_fkey: `FOREIGN KEY (converted_client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- expenses.expenses_client_id_fkey: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- client_funds.client_funds_client_id_fkey: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE`.
- agenda_events.agenda_events_client_id_fkey: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- quotations.quotations_converted_client_id_fkey: `FOREIGN KEY (converted_client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- income_distributions.income_distributions_client_id_fkey: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`.

### prospects

Filas: **10**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"prospects","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | auth.uid() |
| name | text | NO | — |
| contact | text | YES | — |
| origin | text | NO | 'Instagram'::text |
| interest_service | text | YES | — |
| probability | text | NO | 'media'::text |
| next_action | text | YES | — |
| followup_date | date | YES | — |
| notes | text | YES | — |
| converted_to_client_id | uuid | YES | — |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| organization_id | uuid | YES | get_user_org_id() |
| city | text | YES | — |
| timezone | text | YES | — |
| client_type | text | YES | 'Nacional'::text |
| preferred_currency | text | YES | 'CLP'::text |
| country | text | YES | — |
| agreement_notes | text | YES | — |
| agreement_period_type | text | YES | — |
| agreement_start_date | date | YES | — |
| agreement_duration_value | integer | YES | — |
| agreement_duration_unit | text | YES | 'meses'::text |
| agreement_end_date | date | YES | — |
| selected_services | jsonb | YES | '[]'::jsonb |
| services_summary | text | YES | — |
| agreed_amount | numeric(12,2) | YES | 0 |
| amount | numeric(12,2) | YES | 0 |
| currency | text | YES | 'CLP'::text |
| includes_iva | boolean | YES | false |
| amount_paid | numeric(12,2) | YES | 0 |
| balance_due | numeric(12,2) | YES | 0 |
| payment_method | text | YES | — |
| payment_status | text | YES | 'sin pago'::text |
| payment_date | date | YES | — |
| payment_link_sent | boolean | YES | false |
| payment_link_sent_at | date | YES | — |
| contract_sent | boolean | YES | false |
| contract_sent_at | date | YES | — |
| contract_signed_received | boolean | YES | false |
| contract_signed_received_at | date | YES | — |
| files_received | boolean | YES | false |
| files_received_at | date | YES | — |
| materials_received | boolean | YES | false |
| materials_received_at | date | YES | — |
| partial_payment_authorized | boolean | YES | false |
| ready_to_start | boolean | YES | false |
| ready_to_start_reason | text | YES | — |
| service_category | text | YES | — |
| status | text | YES | 'prospecto'::text |
| email | text | YES | — |
| instagram | text | YES | — |
| phone | text | YES | — |
| follow_up_date | date | YES | — |
| total_agreed_amount | numeric(12,2) | YES | 0.00 |
| includes_vat | boolean | YES | false |
| paid_at | date | YES | — |
| converted_to_client | boolean | YES | false |
| converted_client_id | uuid | YES | — |
| converted_at | timestamp with time zone | YES | — |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |

Restricciones:

- `prospects_origin_check`: `CHECK ((origin = ANY (ARRAY['Instagram'::text, 'web'::text, 'referido'::text, 'correo'::text, 'otro'::text])))`.
- `prospects_probability_check`: `CHECK ((probability = ANY (ARRAY['baja'::text, 'media'::text, 'alta'::text])))`.
- `prospects_pkey`: `PRIMARY KEY (id)`.
- `prospects_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `prospects_converted_to_client_id_fkey`: `FOREIGN KEY (converted_to_client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- `prospects_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- `prospects_converted_client_id_fkey`: `FOREIGN KEY (converted_client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- `chk_prospects_status`: `CHECK (((status IS NULL) OR (status = ANY (ARRAY['prospecto'::text, 'interesado'::text, 'acuerdo enviado'::text, 'contrato enviado'::text, 'link de pago enviado'::text, 'esperando pago'::text, 'pago recibido'::text, 'contrato firmado recibido'::text, 'esperando contrato firmado'::text, 'esperando manuscrito/archivos'::text, 'esperando archivos/materiales'::text, 'listo para iniciar'::text, 'en proceso editorial'::text, 'en proceso'::text, 'finalizado'::text, 'perdido / rechazado'::text, 'perdido'::text, 'cliente'::text, 'activo'::text, 'convertido'::text]))))`.
- `chk_prospects_payment_status`: `CHECK ((payment_status = ANY (ARRAY['sin pago'::text, 'pendiente'::text, 'pago parcial'::text, 'pagado'::text])))`.
- `chk_prospects_currency`: `CHECK ((currency = ANY (ARRAY['CLP'::text, 'USD'::text, 'EUR'::text])))`.
- `chk_prospects_service_category`: `CHECK ((service_category = ANY (ARRAY['editorial'::text, 'publicidad'::text, 'diseño'::text, 'asesoría'::text, 'otro'::text])))`.
- `chk_prospects_duration_unit`: `CHECK ((agreement_duration_unit = ANY (ARRAY['meses'::text, 'semanas'::text, 'días'::text, 'años'::text])))`.

Índices:

- `CREATE UNIQUE INDEX prospects_pkey ON public.prospects USING btree (id)`.
- `CREATE INDEX idx_prospects_user_id ON public.prospects USING btree (user_id)`.
- `CREATE INDEX idx_prospects_org_id ON public.prospects USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.prospects FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): payment_status="sin pago" (10); currency="CLP" (10); status="prospecto" (8); status="convertido" (2).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03b_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03b_insert | PERMISSIVE | authenticated | INSERT | — | (is_org_writer(organization_id) AND ((converted_client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = prospects.converted_client_id) AND (parent.organization_id = prospects.organization_id))))) AND ((converted_to_client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = prospects.converted_to_client_id) AND (parent.organization_id = prospects.organization_id)))))) |
| security03b_select | PERMISSIVE | authenticated | SELECT | is_org_member(organization_id) | — |
| security03b_update | PERMISSIVE | authenticated | UPDATE | is_org_writer(organization_id) | (is_org_writer(organization_id) AND ((converted_client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = prospects.converted_client_id) AND (parent.organization_id = prospects.organization_id))))) AND ((converted_to_client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = prospects.converted_to_client_id) AND (parent.organization_id = prospects.organization_id)))))) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

- quotations.quotations_prospect_id_fkey: `FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL`.
- incomes.incomes_prospect_id_fkey: `FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL`.
- quotations.quotations_converted_prospect_id_fkey: `FOREIGN KEY (converted_prospect_id) REFERENCES prospects(id) ON DELETE SET NULL`.
- income_distributions.income_distributions_prospect_id_fkey: `FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL`.
- website_leads.website_leads_converted_prospect_id_fkey: `FOREIGN KEY (converted_prospect_id) REFERENCES prospects(id) ON DELETE SET NULL`.

### quotations

Filas: **6**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"quotations","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | auth.uid() |
| client_id | uuid | YES | — |
| prospect_id | uuid | YES | — |
| discount | numeric(12,2) | NO | 0.00 |
| currency | text | NO | 'CLP'::text |
| status | text | NO | 'borrador'::text |
| notes | text | YES | — |
| includes_vat | boolean | NO | false |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| organization_id | uuid | YES | get_user_org_id() |
| exchange_rate | numeric(12,4) | NO | 1.0000 |
| value_converted | numeric(12,2) | NO | 0.00 |
| rate_date | date | YES | — |
| amount | numeric(12,2) | YES | 0 |
| subtotal | numeric(12,2) | YES | 0 |
| tax_amount | numeric(12,2) | YES | 0 |
| total | numeric(12,2) | YES | 0 |
| includes_iva | boolean | YES | true |
| manuscript_pages | integer | YES | 0 |
| extension_adjustment_type | text | YES | 'none'::text |
| extension_adjustment_value | numeric(12,2) | YES | 0 |
| converted_to_service | boolean | YES | false |
| service_id | uuid | YES | — |
| quote_number | text | YES | — |
| issue_date | date | YES | CURRENT_DATE |
| valid_until | date | YES | — |
| validity_days | integer | YES | 15 |
| payment_terms | text | YES | — |
| scope_notes | text | YES | — |
| includes_notes | text | YES | — |
| excludes_notes | text | YES | — |
| start_conditions | text | YES | — |
| legal_notes | text | YES | — |
| pdf_url | text | YES | — |
| sent_at | timestamp with time zone | YES | — |
| approved_at | timestamp with time zone | YES | — |
| updated_at | timestamp with time zone | YES | timezone('utc'::text, now()) |
| author_name | text | YES | — |
| author_email | text | YES | — |
| country | text | YES | — |
| city | text | YES | — |
| object | text | YES | — |
| work_timeline | text | YES | — |
| other_notes | text | YES | — |
| author_phone | text | YES | — |
| author_instagram | text | YES | — |
| origin | text | YES | — |
| accepted_at | timestamp with time zone | YES | — |
| rejected_at | timestamp with time zone | YES | — |
| converted_to_prospect | boolean | YES | false |
| converted_prospect_id | uuid | YES | — |
| converted_at | timestamp with time zone | YES | — |
| payment_plan_type | text | YES | '50_50'::text |
| upfront_percentage | numeric(5,2) | YES | 50 |
| installments | integer | YES | 1 |
| proposal_type | text | YES | 'propuesta_comercial_preliminar'::text |
| work_title | text | YES | — |
| request_type | text | YES | — |
| iva_mode | text | YES | 'included'::text |
| tax_rate | numeric(5,2) | YES | 19 |
| net_amount | numeric(12,2) | YES | 0 |
| included_items | jsonb | YES | '[]'::jsonb |
| excluded_items | jsonb | YES | '[]'::jsonb |
| start_condition_items | jsonb | YES | '[]'::jsonb |
| proposal_format | text | YES | 'formal_completo'::text |
| show_signatures | boolean | YES | true |
| has_alternatives | boolean | YES | false |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |
| converted_client_id | uuid | YES | — |
| converted_to_client | boolean | YES | false |

Restricciones:

- `quotations_currency_check`: `CHECK ((currency = ANY (ARRAY['CLP'::text, 'USD'::text])))`.
- `quotations_status_check`: `CHECK ((status = ANY (ARRAY['borrador'::text, 'enviada'::text, 'aceptada'::text, 'rechazada'::text, 'vencida'::text])))`.
- `quotations_pkey`: `PRIMARY KEY (id)`.
- `quotations_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `quotations_client_id_fkey`: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- `quotations_prospect_id_fkey`: `FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL`.
- `quotations_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- `quotations_converted_prospect_id_fkey`: `FOREIGN KEY (converted_prospect_id) REFERENCES prospects(id) ON DELETE SET NULL`.
- `quotations_service_id_fkey`: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.
- `quotations_converted_client_id_fkey`: `FOREIGN KEY (converted_client_id) REFERENCES clients(id) ON DELETE SET NULL`.

Índices:

- `CREATE UNIQUE INDEX quotations_pkey ON public.quotations USING btree (id)`.
- `CREATE INDEX idx_quotations_user_id ON public.quotations USING btree (user_id)`.
- `CREATE INDEX idx_quotations_org_id ON public.quotations USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.quotations FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): currency="CLP" (6); payment_plan_type="100_inicio" (1); iva_mode="included" (5); iva_mode="+ IVA" (1); status="borrador" (6); payment_plan_type="50_50" (5).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03b_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03b_insert | PERMISSIVE | authenticated | INSERT | — | (is_org_writer(organization_id) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = quotations.client_id) AND (parent.organization_id = quotations.organization_id))))) AND ((prospect_id IS NULL) OR (EXISTS ( SELECT 1    FROM prospects parent   WHERE ((parent.id = quotations.prospect_id) AND (parent.organization_id = quotations.organization_id))))) AND ((converted_client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = quotations.converted_client_id) AND (parent.organization_id = quotations.organization_id))))) AND ((converted_prospect_id IS NULL) OR (EXISTS ( SELECT 1    FROM prospects parent   WHERE ((parent.id = quotations.converted_prospect_id) AND (parent.organization_id = quotations.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM services parent   WHERE ((parent.id = quotations.service_id) AND (parent.organization_id = quotations.organization_id)))))) |
| security03b_select | PERMISSIVE | authenticated | SELECT | is_org_member(organization_id) | — |
| security03b_update | PERMISSIVE | authenticated | UPDATE | is_org_writer(organization_id) | (is_org_writer(organization_id) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = quotations.client_id) AND (parent.organization_id = quotations.organization_id))))) AND ((prospect_id IS NULL) OR (EXISTS ( SELECT 1    FROM prospects parent   WHERE ((parent.id = quotations.prospect_id) AND (parent.organization_id = quotations.organization_id))))) AND ((converted_client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = quotations.converted_client_id) AND (parent.organization_id = quotations.organization_id))))) AND ((converted_prospect_id IS NULL) OR (EXISTS ( SELECT 1    FROM prospects parent   WHERE ((parent.id = quotations.converted_prospect_id) AND (parent.organization_id = quotations.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM services parent   WHERE ((parent.id = quotations.service_id) AND (parent.organization_id = quotations.organization_id)))))) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

- documents.documents_quotation_id_fkey: `FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL`.
- quotation_items.quotation_items_quotation_id_fkey: `FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE`.
- website_leads.website_leads_converted_quotation_id_fkey: `FOREIGN KEY (converted_quotation_id) REFERENCES quotations(id) ON DELETE SET NULL`.

### quotation_items

Filas: **1**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"quotation_items","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | auth.uid() |
| quotation_id | uuid | NO | — |
| service_id | uuid | YES | — |
| pack_id | uuid | YES | — |
| custom_name | text | YES | — |
| price | numeric(12,2) | NO | 0.00 |
| quantity | integer | NO | 1 |
| organization_id | uuid | YES | get_user_org_id() |
| concept | text | YES | — |
| description | text | YES | — |
| unit_price | numeric(12,2) | YES | 0 |
| total | numeric(12,2) | YES | 0 |
| source_type | text | YES | — |
| catalog_id | uuid | YES | — |
| display_order | integer | YES | 0 |
| net_amount | numeric(12,2) | YES | 0 |
| tax_amount | numeric(12,2) | YES | 0 |
| gross_amount | numeric(12,2) | YES | 0 |
| includes_iva | boolean | YES | true |
| iva_mode | text | YES | 'included'::text |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |

Restricciones:

- `quotation_items_pkey`: `PRIMARY KEY (id)`.
- `quotation_items_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `quotation_items_quotation_id_fkey`: `FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE`.
- `quotation_items_service_id_fkey`: `FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON DELETE SET NULL`.
- `quotation_items_pack_id_fkey`: `FOREIGN KEY (pack_id) REFERENCES service_packs(id) ON DELETE SET NULL`.
- `quotation_items_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- `quotation_items_catalog_id_fkey`: `FOREIGN KEY (catalog_id) REFERENCES service_catalog(id) ON DELETE SET NULL`.

Índices:

- `CREATE UNIQUE INDEX quotation_items_pkey ON public.quotation_items USING btree (id)`.
- `CREATE INDEX idx_quotation_items_quot ON public.quotation_items USING btree (quotation_id)`.
- `CREATE INDEX idx_quotation_items_org_id ON public.quotation_items USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.quotation_items FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): iva_mode="included" (1); source_type="pack" (1).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03b_delete | PERMISSIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security03b_insert | PERMISSIVE | authenticated | INSERT | — | (is_org_writer(organization_id) AND ((quotation_id IS NULL) OR (EXISTS ( SELECT 1    FROM quotations parent   WHERE ((parent.id = quotation_items.quotation_id) AND (parent.organization_id = quotation_items.organization_id))))) AND ((catalog_id IS NULL) OR (EXISTS ( SELECT 1    FROM service_catalog parent   WHERE ((parent.id = quotation_items.catalog_id) AND (parent.organization_id = quotation_items.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM service_catalog parent   WHERE ((parent.id = quotation_items.service_id) AND (parent.organization_id = quotation_items.organization_id))))) AND ((pack_id IS NULL) OR (EXISTS ( SELECT 1    FROM service_packs parent   WHERE ((parent.id = quotation_items.pack_id) AND (parent.organization_id = quotation_items.organization_id)))))) |
| security03b_select | PERMISSIVE | authenticated | SELECT | is_org_member(organization_id) | — |
| security03b_update | PERMISSIVE | authenticated | UPDATE | is_org_writer(organization_id) | (is_org_writer(organization_id) AND ((quotation_id IS NULL) OR (EXISTS ( SELECT 1    FROM quotations parent   WHERE ((parent.id = quotation_items.quotation_id) AND (parent.organization_id = quotation_items.organization_id))))) AND ((catalog_id IS NULL) OR (EXISTS ( SELECT 1    FROM service_catalog parent   WHERE ((parent.id = quotation_items.catalog_id) AND (parent.organization_id = quotation_items.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM service_catalog parent   WHERE ((parent.id = quotation_items.service_id) AND (parent.organization_id = quotation_items.organization_id))))) AND ((pack_id IS NULL) OR (EXISTS ( SELECT 1    FROM service_packs parent   WHERE ((parent.id = quotation_items.pack_id) AND (parent.organization_id = quotation_items.organization_id)))))) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

Ninguna FK entrante encontrada.

### services

Filas: **1**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"services","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | auth.uid() |
| client_id | uuid | NO | — |
| type | text | NO | — |
| book_title | text | NO | — |
| status | text | NO | 'recibido'::text |
| value | numeric(12,2) | NO | 0.00 |
| currency | text | NO | 'CLP'::text |
| start_date | date | NO | CURRENT_DATE |
| estimated_delivery | date | YES | — |
| notes | text | YES | — |
| current_stage | text | NO | 'recepción de material'::text |
| advance_percent | integer | NO | 0 |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| organization_id | uuid | YES | get_user_org_id() |
| exchange_rate | numeric(12,4) | NO | 1.0000 |
| value_converted | numeric(12,2) | NO | 0.00 |
| rate_date | date | YES | — |
| agreement_notes | text | YES | — |
| amount_paid | numeric(12,2) | YES | 0 |
| balance_due | numeric(12,2) | YES | 0 |
| total_agreed_amount | numeric(12,2) | YES | 0 |
| payment_status | text | YES | 'sin pago'::text |
| payment_method | text | YES | — |
| paid_at | date | YES | — |
| payment_link_sent | boolean | YES | false |
| payment_link_sent_at | date | YES | — |
| contract_sent | boolean | YES | false |
| contract_sent_at | date | YES | — |
| contract_signed_received | boolean | YES | false |
| contract_signed_received_at | date | YES | — |
| files_received | boolean | YES | false |
| files_received_at | date | YES | — |
| materials_received | boolean | YES | false |
| materials_received_at | date | YES | — |
| partial_payment_authorized | boolean | YES | false |
| ready_to_start | boolean | YES | false |
| ready_to_start_reason | text | YES | — |
| contract_notes | text | YES | — |
| contract_start_date | date | YES | — |
| contract_end_date | date | YES | — |
| contract_duration_value | integer | YES | — |
| contract_duration_unit | text | YES | 'meses'::text |
| agreement_period_type | text | YES | — |
| service_category | text | YES | 'editorial'::text |
| selected_services | jsonb | YES | '[]'::jsonb |
| services_summary | text | YES | — |
| service_type | text | YES | — |
| title | text | YES | — |
| stage | text | YES | — |
| estimated_delivery_date | date | YES | — |
| progress | integer | YES | 0 |
| service_name | text | YES | — |
| stage_progress | numeric(5,2) | YES | 0 |
| checklist_progress | numeric(5,2) | YES | 0 |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |

Restricciones:

- `services_advance_percent_check`: `CHECK (((advance_percent >= 0) AND (advance_percent <= 100)))`.
- `services_pkey`: `PRIMARY KEY (id)`.
- `services_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `services_client_id_fkey`: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE`.
- `services_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- `chk_services_currency`: `CHECK ((currency = ANY (ARRAY['CLP'::text, 'USD'::text, 'EUR'::text])))`.
- `chk_services_payment_status`: `CHECK ((payment_status = ANY (ARRAY['sin pago'::text, 'pendiente'::text, 'pago parcial'::text, 'pagado'::text])))`.
- `chk_services_service_category`: `CHECK ((service_category = ANY (ARRAY['editorial'::text, 'publicidad'::text, 'diseño'::text, 'asesoría'::text, 'otro'::text])))`.
- `chk_services_contract_duration_unit`: `CHECK ((contract_duration_unit = ANY (ARRAY['meses'::text, 'semanas'::text, 'días'::text, 'años'::text])))`.
- `services_type_check`: `CHECK (((type IS NULL) OR (type = ANY (ARRAY['corrección'::text, 'correccion'::text, 'maquetación'::text, 'maquetacion'::text, 'portada'::text, 'ebook'::text, 'libro físico'::text, 'libro fisico'::text, 'difusión'::text, 'difusion'::text, 'publicidad'::text, 'derechos de autor'::text, 'asesoría'::text, 'asesoria'::text, 'full ebook'::text, 'full físico'::text, 'full fisico'::text, 'full total'::text, 'pack difusión'::text, 'pack difusion'::text, 'pack portada'::text, 'pack corrección'::text, 'pack correccion'::text, 'pack maquetación'::text, 'pack maquetacion'::text, 'editorial'::text, 'diseño'::text, 'diseno'::text, 'otro'::text]))))`.

Índices:

- `CREATE UNIQUE INDEX services_pkey ON public.services USING btree (id)`.
- `CREATE INDEX idx_services_user_id ON public.services USING btree (user_id)`.
- `CREATE INDEX idx_services_org_id ON public.services USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.services FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): status="recibido" (1); payment_status="pagado" (1); currency="CLP" (1).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03b_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03b_insert | PERMISSIVE | authenticated | INSERT | — | (is_org_writer(organization_id) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = services.client_id) AND (parent.organization_id = services.organization_id)))))) |
| security03b_select | PERMISSIVE | authenticated | SELECT | is_org_member(organization_id) | — |
| security03b_update | PERMISSIVE | authenticated | UPDATE | is_org_writer(organization_id) | (is_org_writer(organization_id) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = services.client_id) AND (parent.organization_id = services.organization_id)))))) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

- documents.documents_service_id_fkey: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.
- service_stages.service_stages_service_id_fkey: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE`.
- incomes.incomes_service_id_fkey: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.
- service_checklists.service_checklists_service_id_fkey: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE`.
- expenses.expenses_service_id_fkey: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.
- client_funds.client_funds_service_id_fkey: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.
- agenda_events.agenda_events_service_id_fkey: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.
- quotations.quotations_service_id_fkey: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.
- income_distributions.income_distributions_service_id_fkey: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.

### service_catalog

Filas: **10**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"service_catalog","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES | auth.uid() |
| name | text | NO | — |
| description | text | YES | — |
| base_price | numeric(12,2) | NO | 0.00 |
| currency | text | NO | 'CLP'::text |
| includes_vat | boolean | NO | false |
| category | text | NO | — |
| active | boolean | NO | true |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| organization_id | uuid | YES | get_user_org_id() |
| requires_manuscript | boolean | YES | false |
| requires_materials | boolean | YES | false |
| requires_signed_contract | boolean | YES | false |
| requires_agreement_sent | boolean | YES | false |
| requires_period_defined | boolean | YES | true |
| service_category | text | YES | 'editorial'::text |
| requires_duration | boolean | YES | false |
| title | text | YES | — |
| price_from | numeric(12,2) | YES | 0 |
| includes_iva | boolean | YES | true |
| price_type | text | YES | 'desde'::text |
| quote_enabled | boolean | YES | true |
| visible_on_quotes | boolean | YES | true |
| display_order | integer | YES | 0 |
| includes_text | text | YES | — |
| excludes_text | text | YES | — |
| default_work_timeline | text | YES | — |
| default_payment_terms | text | YES | — |
| default_start_conditions | text | YES | — |
| default_legal_notes | text | YES | — |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |

Restricciones:

- `service_catalog_currency_check`: `CHECK ((currency = ANY (ARRAY['CLP'::text, 'USD'::text])))`.
- `service_catalog_pkey`: `PRIMARY KEY (id)`.
- `service_catalog_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `service_catalog_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.

Índices:

- `CREATE UNIQUE INDEX service_catalog_pkey ON public.service_catalog USING btree (id)`.
- `CREATE INDEX idx_catalog_user_id ON public.service_catalog USING btree (user_id)`.
- `CREATE INDEX idx_catalog_org_id ON public.service_catalog USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.service_catalog FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): active=true (10); currency="CLP" (10).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03b_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03b_insert | PERMISSIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security03b_select | PERMISSIVE | authenticated | SELECT | is_org_member(organization_id) | — |
| security03b_update | PERMISSIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

- service_pack_items.service_pack_items_service_id_fkey: `FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON DELETE CASCADE`.
- quotation_items.quotation_items_service_id_fkey: `FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON DELETE SET NULL`.
- quotation_items.quotation_items_catalog_id_fkey: `FOREIGN KEY (catalog_id) REFERENCES service_catalog(id) ON DELETE SET NULL`.

### service_packs

Filas: **4**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"service_packs","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES | auth.uid() |
| name | text | NO | — |
| description | text | YES | — |
| price_special | numeric(12,2) | YES | — |
| currency | text | NO | 'CLP'::text |
| includes_vat | boolean | NO | false |
| active | boolean | NO | true |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| organization_id | uuid | YES | get_user_org_id() |
| requires_duration | boolean | YES | false |
| title | text | YES | — |
| base_price | numeric(12,2) | YES | 0 |
| price_from | numeric(12,2) | YES | 0 |
| includes_iva | boolean | YES | true |
| includes_text | text | YES | — |
| excludes_text | text | YES | — |
| category | text | YES | 'Editorial'::text |
| quote_enabled | boolean | YES | true |
| visible_on_quotes | boolean | YES | true |
| display_order | integer | YES | 0 |
| requires_manuscript | boolean | YES | true |
| requires_materials | boolean | YES | false |
| requires_signed_contract | boolean | YES | true |
| requires_agreement_sent | boolean | YES | false |
| requires_period_defined | boolean | YES | true |
| service_category | text | YES | 'editorial'::text |
| default_work_timeline | text | YES | — |
| default_payment_terms | text | YES | — |
| default_start_conditions | text | YES | — |
| default_legal_notes | text | YES | — |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |

Restricciones:

- `service_packs_currency_check`: `CHECK ((currency = ANY (ARRAY['CLP'::text, 'USD'::text])))`.
- `service_packs_pkey`: `PRIMARY KEY (id)`.
- `service_packs_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `service_packs_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.

Índices:

- `CREATE UNIQUE INDEX service_packs_pkey ON public.service_packs USING btree (id)`.
- `CREATE INDEX idx_packs_user_id ON public.service_packs USING btree (user_id)`.
- `CREATE INDEX idx_packs_org_id ON public.service_packs USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.service_packs FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): currency="CLP" (4); active=true (4).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03b_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03b_insert | PERMISSIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security03b_select | PERMISSIVE | authenticated | SELECT | is_org_member(organization_id) | — |
| security03b_update | PERMISSIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

- service_pack_items.service_pack_items_pack_id_fkey: `FOREIGN KEY (pack_id) REFERENCES service_packs(id) ON DELETE CASCADE`.
- quotation_items.quotation_items_pack_id_fkey: `FOREIGN KEY (pack_id) REFERENCES service_packs(id) ON DELETE SET NULL`.

### income_allocations

Filas: **10**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"income_allocations","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| organization_id | uuid | YES | — |
| user_id | uuid | YES | — |
| income_id | uuid | YES | — |
| area | text | NO | 'otro'::text |
| allocation_type | text | NO | 'porcentaje'::text |
| value | numeric(12,2) | NO | 0 |
| calculated_amount | numeric(12,2) | NO | 0 |
| notes | text | YES | — |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |

Restricciones:

- `income_allocations_pkey`: `PRIMARY KEY (id)`.
- `income_allocations_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- `income_allocations_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL`.
- `income_allocations_income_id_fkey`: `FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE CASCADE`.

Índices:

- `CREATE UNIQUE INDEX income_allocations_pkey ON public.income_allocations USING btree (id)`.

Triggers de usuario:

- `CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.income_allocations FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): allocation_type="monto fijo" (10).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03c_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03c_insert | PERMISSIVE | authenticated | INSERT | — | (is_org_finance(organization_id) AND ((income_id IS NULL) OR (EXISTS ( SELECT 1    FROM incomes parent   WHERE ((parent.id = income_allocations.income_id) AND (parent.organization_id = income_allocations.organization_id)))))) |
| security03c_select | PERMISSIVE | authenticated | SELECT | is_org_finance(organization_id) | — |
| security03c_update | PERMISSIVE | authenticated | UPDATE | is_org_finance(organization_id) | (is_org_finance(organization_id) AND ((income_id IS NULL) OR (EXISTS ( SELECT 1    FROM incomes parent   WHERE ((parent.id = income_allocations.income_id) AND (parent.organization_id = income_allocations.organization_id)))))) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

Ninguna FK entrante encontrada.

### income_distributions

Filas: **0**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"income_distributions","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| organization_id | uuid | YES | — |
| income_id | uuid | YES | — |
| client_id | uuid | YES | — |
| prospect_id | uuid | YES | — |
| service_id | uuid | YES | — |
| distribution_type | text | YES | — |
| category | text | YES | — |
| amount | numeric(12,2) | YES | 0 |
| percentage | numeric(5,2) | YES | 0 |
| status | text | YES | 'pendiente'::text |
| notes | text | YES | — |
| created_by | uuid | YES | — |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| updated_at | timestamp with time zone | NO | timezone('utc'::text, now()) |

Restricciones:

- `income_distributions_pkey`: `PRIMARY KEY (id)`.
- `income_distributions_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- `income_distributions_income_id_fkey`: `FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE CASCADE`.
- `income_distributions_client_id_fkey`: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- `income_distributions_prospect_id_fkey`: `FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL`.
- `income_distributions_service_id_fkey`: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.
- `income_distributions_created_by_fkey`: `FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL`.

Índices:

- `CREATE UNIQUE INDEX income_distributions_pkey ON public.income_distributions USING btree (id)`.

Triggers de usuario:

- `CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.income_distributions FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): sin campos perfilados o sin filas.

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03c_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03c_insert | PERMISSIVE | authenticated | INSERT | — | (is_org_finance(organization_id) AND ((income_id IS NULL) OR (EXISTS ( SELECT 1    FROM incomes parent   WHERE ((parent.id = income_distributions.income_id) AND (parent.organization_id = income_distributions.organization_id))))) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = income_distributions.client_id) AND (parent.organization_id = income_distributions.organization_id))))) AND ((prospect_id IS NULL) OR (EXISTS ( SELECT 1    FROM prospects parent   WHERE ((parent.id = income_distributions.prospect_id) AND (parent.organization_id = income_distributions.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM services parent   WHERE ((parent.id = income_distributions.service_id) AND (parent.organization_id = income_distributions.organization_id)))))) |
| security03c_select | PERMISSIVE | authenticated | SELECT | is_org_finance(organization_id) | — |
| security03c_update | PERMISSIVE | authenticated | UPDATE | is_org_finance(organization_id) | (is_org_finance(organization_id) AND ((income_id IS NULL) OR (EXISTS ( SELECT 1    FROM incomes parent   WHERE ((parent.id = income_distributions.income_id) AND (parent.organization_id = income_distributions.organization_id))))) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = income_distributions.client_id) AND (parent.organization_id = income_distributions.organization_id))))) AND ((prospect_id IS NULL) OR (EXISTS ( SELECT 1    FROM prospects parent   WHERE ((parent.id = income_distributions.prospect_id) AND (parent.organization_id = income_distributions.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM services parent   WHERE ((parent.id = income_distributions.service_id) AND (parent.organization_id = income_distributions.organization_id)))))) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

- payroll_payments.payroll_payments_distribution_id_fkey: `FOREIGN KEY (distribution_id) REFERENCES income_distributions(id) ON DELETE SET NULL`.
- operational_reserve_movements.operational_reserve_movements_distribution_id_fkey: `FOREIGN KEY (distribution_id) REFERENCES income_distributions(id) ON DELETE SET NULL`.

### incomes

Filas: **4**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"incomes","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | auth.uid() |
| client_id | uuid | YES | — |
| service_id | uuid | YES | — |
| amount | numeric(12,2) | NO | 0.00 |
| currency | text | NO | 'CLP'::text |
| date | date | NO | CURRENT_DATE |
| payment_method | text | NO | — |
| includes_vat | boolean | NO | false |
| status | text | NO | 'pagado'::text |
| notes | text | YES | — |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| organization_id | uuid | YES | get_user_org_id() |
| exchange_rate | numeric(12,4) | NO | 1.0000 |
| value_converted | numeric(12,2) | NO | 0.00 |
| rate_date | date | YES | — |
| source | text | YES | — |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |
| concept | text | YES | — |
| category | text | YES | — |
| payment_date | date | YES | — |
| source_type | text | YES | — |
| source_id | uuid | YES | — |
| prospect_id | uuid | YES | — |
| gross_amount | numeric(12,2) | YES | 0 |
| net_amount | numeric(12,2) | YES | 0 |
| tax_amount | numeric(12,2) | YES | 0 |
| distributed_amount | numeric(12,2) | YES | 0 |
| undistributed_amount | numeric(12,2) | YES | 0 |
| distribution_status | text | YES | 'pendiente'::text |

Restricciones:

- `incomes_currency_check`: `CHECK ((currency = ANY (ARRAY['CLP'::text, 'USD'::text])))`.
- `incomes_status_check`: `CHECK ((status = ANY (ARRAY['pagado'::text, 'pendiente'::text, 'parcial'::text])))`.
- `incomes_pkey`: `PRIMARY KEY (id)`.
- `incomes_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `incomes_client_id_fkey`: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- `incomes_service_id_fkey`: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.
- `incomes_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- `incomes_prospect_id_fkey`: `FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL`.

Índices:

- `CREATE UNIQUE INDEX incomes_pkey ON public.incomes USING btree (id)`.
- `CREATE INDEX idx_incomes_user_id ON public.incomes USING btree (user_id)`.
- `CREATE INDEX idx_incomes_org_id ON public.incomes USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.incomes FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): currency="CLP" (4); source_type=null (4); status="pagado" (4).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03c_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03c_insert | PERMISSIVE | authenticated | INSERT | — | (is_org_finance(organization_id) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = incomes.client_id) AND (parent.organization_id = incomes.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM services parent   WHERE ((parent.id = incomes.service_id) AND (parent.organization_id = incomes.organization_id))))) AND ((prospect_id IS NULL) OR (EXISTS ( SELECT 1    FROM prospects parent   WHERE ((parent.id = incomes.prospect_id) AND (parent.organization_id = incomes.organization_id)))))) |
| security03c_select | PERMISSIVE | authenticated | SELECT | is_org_finance(organization_id) | — |
| security03c_update | PERMISSIVE | authenticated | UPDATE | is_org_finance(organization_id) | (is_org_finance(organization_id) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = incomes.client_id) AND (parent.organization_id = incomes.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM services parent   WHERE ((parent.id = incomes.service_id) AND (parent.organization_id = incomes.organization_id))))) AND ((prospect_id IS NULL) OR (EXISTS ( SELECT 1    FROM prospects parent   WHERE ((parent.id = incomes.prospect_id) AND (parent.organization_id = incomes.organization_id)))))) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

- documents.documents_income_id_fkey: `FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE SET NULL`.
- fund_movements.fund_movements_income_id_fkey: `FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE SET NULL`.
- income_tax_reservations.income_tax_reservations_income_id_fkey: `FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE CASCADE`.
- income_allocations.income_allocations_income_id_fkey: `FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE CASCADE`.
- expenses.expenses_source_income_id_fkey: `FOREIGN KEY (source_income_id) REFERENCES incomes(id) ON DELETE SET NULL`.
- payroll_payments.payroll_payments_source_income_id_fkey: `FOREIGN KEY (source_income_id) REFERENCES incomes(id) ON DELETE SET NULL`.
- operational_reserve_movements.operational_reserve_movements_source_income_id_fkey: `FOREIGN KEY (source_income_id) REFERENCES incomes(id) ON DELETE SET NULL`.
- income_distributions.income_distributions_income_id_fkey: `FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE CASCADE`.

### expenses

Filas: **13**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"expenses","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | auth.uid() |
| provider_id | uuid | YES | — |
| category | text | NO | — |
| amount | numeric(12,2) | NO | 0.00 |
| currency | text | NO | 'CLP'::text |
| date | date | NO | CURRENT_DATE |
| includes_vat | boolean | NO | false |
| deductible | boolean | NO | true |
| notes | text | YES | — |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| organization_id | uuid | YES | get_user_org_id() |
| exchange_rate | numeric(12,4) | NO | 1.0000 |
| value_converted | numeric(12,2) | NO | 0.00 |
| rate_date | date | YES | — |
| payroll_payment_id | uuid | YES | — |
| source | text | YES | — |
| tax_payment | boolean | YES | false |
| affects_cashflow | boolean | YES | true |
| tax_type | text | YES | — |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |
| concept | text | YES | — |
| payment_method | text | YES | — |
| payment_date | date | YES | — |
| client_id | uuid | YES | — |
| service_id | uuid | YES | — |
| fund_id | uuid | YES | — |
| funding_source | text | YES | — |
| affects_client_fund | boolean | YES | false |
| source_income_id | uuid | YES | — |
| fund_type | text | YES | — |
| money_source | text | YES | — |
| gross_amount | numeric(12,2) | YES | 0 |
| net_amount | numeric(12,2) | YES | 0 |
| tax_amount | numeric(12,2) | YES | 0 |
| affects_cash | boolean | YES | true |

Restricciones:

- `expenses_currency_check`: `CHECK ((currency = ANY (ARRAY['CLP'::text, 'USD'::text])))`.
- `expenses_pkey`: `PRIMARY KEY (id)`.
- `expenses_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `expenses_provider_id_fkey`: `FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL`.
- `expenses_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- `expenses_client_id_fkey`: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- `expenses_service_id_fkey`: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.
- `expenses_fund_id_fkey`: `FOREIGN KEY (fund_id) REFERENCES client_funds(id) ON DELETE SET NULL`.
- `expenses_payroll_payment_id_fkey`: `FOREIGN KEY (payroll_payment_id) REFERENCES payroll_payments(id) ON DELETE SET NULL`.
- `expenses_source_income_id_fkey`: `FOREIGN KEY (source_income_id) REFERENCES incomes(id) ON DELETE SET NULL`.

Índices:

- `CREATE UNIQUE INDEX expenses_pkey ON public.expenses USING btree (id)`.
- `CREATE INDEX idx_expenses_user_id ON public.expenses USING btree (user_id)`.
- `CREATE INDEX idx_expenses_org_id ON public.expenses USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.expenses FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): currency="CLP" (13).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03c_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03c_insert | PERMISSIVE | authenticated | INSERT | — | (is_org_finance(organization_id) AND ((provider_id IS NULL) OR (EXISTS ( SELECT 1    FROM providers parent   WHERE ((parent.id = expenses.provider_id) AND (parent.organization_id = expenses.organization_id))))) AND ((payroll_payment_id IS NULL) OR (EXISTS ( SELECT 1    FROM payroll_payments parent   WHERE ((parent.id = expenses.payroll_payment_id) AND (parent.organization_id = expenses.organization_id))))) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = expenses.client_id) AND (parent.organization_id = expenses.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM services parent   WHERE ((parent.id = expenses.service_id) AND (parent.organization_id = expenses.organization_id))))) AND ((fund_id IS NULL) OR (EXISTS ( SELECT 1    FROM client_funds parent   WHERE ((parent.id = expenses.fund_id) AND (parent.organization_id = expenses.organization_id))))) AND ((source_income_id IS NULL) OR (EXISTS ( SELECT 1    FROM incomes parent   WHERE ((parent.id = expenses.source_income_id) AND (parent.organization_id = expenses.organization_id)))))) |
| security03c_select | PERMISSIVE | authenticated | SELECT | is_org_finance(organization_id) | — |
| security03c_update | PERMISSIVE | authenticated | UPDATE | is_org_finance(organization_id) | (is_org_finance(organization_id) AND ((provider_id IS NULL) OR (EXISTS ( SELECT 1    FROM providers parent   WHERE ((parent.id = expenses.provider_id) AND (parent.organization_id = expenses.organization_id))))) AND ((payroll_payment_id IS NULL) OR (EXISTS ( SELECT 1    FROM payroll_payments parent   WHERE ((parent.id = expenses.payroll_payment_id) AND (parent.organization_id = expenses.organization_id))))) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = expenses.client_id) AND (parent.organization_id = expenses.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM services parent   WHERE ((parent.id = expenses.service_id) AND (parent.organization_id = expenses.organization_id))))) AND ((fund_id IS NULL) OR (EXISTS ( SELECT 1    FROM client_funds parent   WHERE ((parent.id = expenses.fund_id) AND (parent.organization_id = expenses.organization_id))))) AND ((source_income_id IS NULL) OR (EXISTS ( SELECT 1    FROM incomes parent   WHERE ((parent.id = expenses.source_income_id) AND (parent.organization_id = expenses.organization_id)))))) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

- documents.documents_expense_id_fkey: `FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL`.
- fund_movements.fund_movements_expense_id_fkey: `FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL`.

### documents

Filas: **7**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"documents","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | auth.uid() |
| name | text | YES | — |
| file_path | text | NO | — |
| file_type | text | YES | — |
| client_id | uuid | YES | — |
| provider_id | uuid | YES | — |
| income_id | uuid | YES | — |
| expense_id | uuid | YES | — |
| service_id | uuid | YES | — |
| quotation_id | uuid | YES | — |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| organization_id | uuid | YES | get_user_org_id() |
| document_type | text | YES | — |
| title | text | YES | — |
| file_name | text | YES | — |
| file_url | text | YES | — |
| mime_type | text | YES | — |
| file_size | bigint | YES | — |
| notes | text | YES | — |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |
| category | text | YES | — |
| uploaded_by | text | YES | — |
| uploaded_at | timestamp with time zone | YES | timezone('utc'::text, now()) |

Restricciones:

- `documents_expense_id_fkey`: `FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL`.
- `documents_service_id_fkey`: `FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL`.
- `documents_quotation_id_fkey`: `FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL`.
- `documents_pkey`: `PRIMARY KEY (id)`.
- `documents_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `documents_client_id_fkey`: `FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL`.
- `documents_provider_id_fkey`: `FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL`.
- `documents_income_id_fkey`: `FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE SET NULL`.
- `documents_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- `documents_document_type_check`: `CHECK (((document_type IS NULL) OR (document_type = ANY (ARRAY['contrato'::text, 'factura'::text, 'boleta'::text, 'comprobante de pago'::text, 'manuscrito'::text, 'portada'::text, 'archivo final'::text, 'documento legal'::text, 'imagen'::text, 'otro'::text]))))`.

Índices:

- `CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id)`.
- `CREATE INDEX idx_documents_user_id ON public.documents USING btree (user_id)`.
- `CREATE INDEX idx_documents_org_id ON public.documents USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.documents FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): sin campos perfilados o sin filas.

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03b_delete | PERMISSIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security03b_insert | PERMISSIVE | authenticated | INSERT | — | (is_org_writer(organization_id) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = documents.client_id) AND (parent.organization_id = documents.organization_id))))) AND ((provider_id IS NULL) OR (EXISTS ( SELECT 1    FROM providers parent   WHERE ((parent.id = documents.provider_id) AND (parent.organization_id = documents.organization_id))))) AND ((income_id IS NULL) OR (EXISTS ( SELECT 1    FROM incomes parent   WHERE ((parent.id = documents.income_id) AND (parent.organization_id = documents.organization_id))))) AND ((expense_id IS NULL) OR (EXISTS ( SELECT 1    FROM expenses parent   WHERE ((parent.id = documents.expense_id) AND (parent.organization_id = documents.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM services parent   WHERE ((parent.id = documents.service_id) AND (parent.organization_id = documents.organization_id))))) AND ((quotation_id IS NULL) OR (EXISTS ( SELECT 1    FROM quotations parent   WHERE ((parent.id = documents.quotation_id) AND (parent.organization_id = documents.organization_id)))))) |
| security03b_select | PERMISSIVE | authenticated | SELECT | is_org_member(organization_id) | — |
| security03b_update | PERMISSIVE | authenticated | UPDATE | is_org_writer(organization_id) | (is_org_writer(organization_id) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1    FROM clients parent   WHERE ((parent.id = documents.client_id) AND (parent.organization_id = documents.organization_id))))) AND ((provider_id IS NULL) OR (EXISTS ( SELECT 1    FROM providers parent   WHERE ((parent.id = documents.provider_id) AND (parent.organization_id = documents.organization_id))))) AND ((income_id IS NULL) OR (EXISTS ( SELECT 1    FROM incomes parent   WHERE ((parent.id = documents.income_id) AND (parent.organization_id = documents.organization_id))))) AND ((expense_id IS NULL) OR (EXISTS ( SELECT 1    FROM expenses parent   WHERE ((parent.id = documents.expense_id) AND (parent.organization_id = documents.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM services parent   WHERE ((parent.id = documents.service_id) AND (parent.organization_id = documents.organization_id))))) AND ((quotation_id IS NULL) OR (EXISTS ( SELECT 1    FROM quotations parent   WHERE ((parent.id = documents.quotation_id) AND (parent.organization_id = documents.organization_id)))))) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

Ninguna FK entrante encontrada.

### activity_log

Filas: **721**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"activity_log","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | auth.uid() |
| user_email | text | YES | — |
| date | timestamp with time zone | NO | timezone('utc'::text, now()) |
| module | text | NO | — |
| action | text | NO | — |
| description | text | NO | — |
| entity_id | uuid | YES | — |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| organization_id | uuid | YES | get_user_org_id() |

Restricciones:

- `activity_log_pkey`: `PRIMARY KEY (id)`.
- `activity_log_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `activity_log_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.

Índices:

- `CREATE UNIQUE INDEX activity_log_pkey ON public.activity_log USING btree (id)`.
- `CREATE INDEX idx_activity_log_user_id ON public.activity_log USING btree (user_id)`.
- `CREATE INDEX idx_activity_log_org_id ON public.activity_log USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.activity_log FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): sin campos perfilados o sin filas.

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03b_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03b_insert | PERMISSIVE | authenticated | INSERT | — | (is_org_writer(organization_id) AND (user_id = ( SELECT auth.uid() AS uid))) |
| security03b_select | PERMISSIVE | authenticated | SELECT | is_org_member(organization_id) | — |
| security03b_update | PERMISSIVE | authenticated | UPDATE | is_org_admin(organization_id) | is_org_admin(organization_id) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

Ninguna FK entrante encontrada.

### organizations

Filas: **1**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"organizations","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | — |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |

Restricciones:

- `organizations_pkey`: `PRIMARY KEY (id)`.

Índices:

- `CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id)`.

Triggers de usuario:

Ninguno.

Valores reales (estado/moneda/rol cuando aplica): sin campos perfilados o sin filas.

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| Manage organization | PERMISSIVE | public | ALL | ((id = get_user_org_id()) AND (get_user_role() = 'admin'::text)) | ((id = get_user_org_id()) AND (get_user_role() = 'admin'::text)) |
| Select organization | PERMISSIVE | public | SELECT | (id = get_user_org_id()) | — |

Dependencias entrantes (incluye tablas fuera del alcance principal):

- organization_members.organization_members_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- providers.providers_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- clients.clients_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- prospects.prospects_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- services.services_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- service_stages.service_stages_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- incomes.incomes_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- expenses.expenses_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- service_catalog.service_catalog_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- service_packs.service_packs_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- service_pack_items.service_pack_items_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- quotations.quotations_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- quotation_items.quotation_items_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- quick_replies.quick_replies_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- documents.documents_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- settings.settings_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- exchange_rates.exchange_rates_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- editorial_stages.editorial_stages_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- service_checklists.service_checklists_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- activity_log.activity_log_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- agenda_events.agenda_events_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- company_settings.company_settings_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- fund_movements.fund_movements_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- income_tax_reservations.income_tax_reservations_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- staff.staff_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- payroll_payments.payroll_payments_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- operational_reserve_movements.operational_reserve_movements_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- income_allocations.income_allocations_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- website_settings.website_settings_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- website_services.website_services_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- website_books.website_books_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- website_links.website_links_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- website_sections.website_sections_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.
- income_distributions.income_distributions_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- client_funds.client_funds_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- website_hero_quick_services.website_hero_quick_services_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- website_leads.website_leads_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- notifications.notifications_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- website_book_categories.website_book_categories_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- website_footer_settings.website_footer_settings_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- website_footer_gallery.website_footer_gallery_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- website_hero_settings.website_hero_settings_organization_id_fkey: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.

### organization_members

Filas: **2**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"organization_members","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| organization_id | uuid | NO | — |
| user_id | uuid | NO | — |
| role | text | NO | — |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| area | text | YES | 'administracion'::text |
| full_name | text | YES | — |
| email | text | YES | — |
| active | boolean | YES | true |
| permissions | jsonb | YES | '{}'::jsonb |
| updated_at | timestamp with time zone | YES | timezone('utc'::text, now()) |

Restricciones:

- `organization_members_role_canonical_check`: `CHECK ((role = ANY (ARRAY['admin'::text, 'editor'::text, 'diseñador'::text, 'corrector'::text, 'finanzas'::text, 'visualizador'::text])))`.
- `organization_members_pkey`: `PRIMARY KEY (id)`.
- `organization_members_organization_id_user_id_key`: `UNIQUE (organization_id, user_id)`.
- `organization_members_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- `organization_members_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`.

Índices:

- `CREATE UNIQUE INDEX organization_members_pkey ON public.organization_members USING btree (id)`.
- `CREATE UNIQUE INDEX organization_members_organization_id_user_id_key ON public.organization_members USING btree (organization_id, user_id)`.
- `CREATE INDEX idx_organization_members_org ON public.organization_members USING btree (organization_id)`.
- `CREATE INDEX idx_organization_members_user ON public.organization_members USING btree (user_id)`.

Triggers de usuario:

Ninguno.

Valores reales (estado/moneda/rol cuando aplica): active=true (2); role="admin" (2).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| admins_can_delete_members | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| admins_can_insert_members | PERMISSIVE | authenticated | INSERT | — | is_org_admin(organization_id) |
| admins_can_update_members | PERMISSIVE | authenticated | UPDATE | is_org_admin(organization_id) | is_org_admin(organization_id) |
| members_can_read_same_org | PERMISSIVE | authenticated | SELECT | is_org_member(organization_id) | — |
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

Ninguna FK entrante encontrada.

### staff

Filas: **4**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"staff","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| organization_id | uuid | YES | — |
| user_id | uuid | YES | — |
| name | text | NO | — |
| role | text | YES | — |
| staff_type | text | YES | 'colaborador'::text |
| agreed_salary | numeric(12,2) | YES | 0 |
| currency | text | YES | 'CLP'::text |
| frequency | text | YES | 'mensual'::text |
| status | text | YES | 'activo'::text |
| notes | text | YES | — |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| agreed_payment | numeric(12,2) | YES | 0 |
| full_name | text | YES | — |
| position | text | YES | — |
| type | text | YES | 'colaborador'::text |
| payment_frequency | text | YES | 'mensual'::text |
| salary | numeric(12,2) | YES | 0 |
| email | text | YES | — |
| phone | text | YES | — |
| start_date | date | YES | — |
| end_date | date | YES | — |
| active | boolean | YES | true |
| is_test | boolean | YES | false |
| test_run_id | text | YES | — |
| payment_period | text | YES | — |

Restricciones:

- `staff_pkey`: `PRIMARY KEY (id)`.
- `staff_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE`.
- `staff_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL`.

Índices:

- `CREATE UNIQUE INDEX staff_pkey ON public.staff USING btree (id)`.

Triggers de usuario:

- `CREATE TRIGGER security03c_preserve_tenant BEFORE UPDATE OF organization_id ON public.staff FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): role="Directora General" (1); status="activo" (4); role="EDITORA" (1); role="DISEÑADORA" (1); currency="CLP" (4); role="Director de Operaciones " (1); active=true (4).

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03c_delete | PERMISSIVE | authenticated | DELETE | is_org_admin(organization_id) | — |
| security03c_insert | PERMISSIVE | authenticated | INSERT | — | is_org_finance(organization_id) |
| security03c_select | PERMISSIVE | authenticated | SELECT | is_org_finance(organization_id) | — |
| security03c_update | PERMISSIVE | authenticated | UPDATE | is_org_finance(organization_id) | is_org_finance(organization_id) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

- payroll_payments.payroll_payments_staff_id_fkey: `FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL`.

### service_pack_items

Filas: **3**. Tenant NULL: 0; filas is_test=true: 0. RLS: {"table":"service_pack_items","forced":false,"enabled":true}.

| Columna | Tipo exacto | NULL | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES | auth.uid() |
| pack_id | uuid | NO | — |
| service_id | uuid | NO | — |
| organization_id | uuid | YES | get_user_org_id() |

Restricciones:

- `service_pack_items_pkey`: `PRIMARY KEY (id)`.
- `service_pack_items_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `service_pack_items_pack_id_fkey`: `FOREIGN KEY (pack_id) REFERENCES service_packs(id) ON DELETE CASCADE`.
- `service_pack_items_service_id_fkey`: `FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON DELETE CASCADE`.
- `service_pack_items_organization_id_fkey`: `FOREIGN KEY (organization_id) REFERENCES organizations(id)`.

Índices:

- `CREATE UNIQUE INDEX service_pack_items_pkey ON public.service_pack_items USING btree (id)`.
- `CREATE INDEX idx_pack_items_pack ON public.service_pack_items USING btree (pack_id)`.
- `CREATE INDEX idx_pack_items_org_id ON public.service_pack_items USING btree (organization_id)`.

Triggers de usuario:

- `CREATE TRIGGER security03b_preserve_tenant BEFORE UPDATE OF organization_id ON public.service_pack_items FOR EACH ROW EXECUTE FUNCTION security03b_preserve_tenant()`.

Valores reales (estado/moneda/rol cuando aplica): sin campos perfilados o sin filas.

Policies exactas:

| Policy | Modo | Roles | Operación | USING | WITH CHECK |
|---|---|---|---|---|---|
| security02_writer_delete | RESTRICTIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security02_writer_insert | RESTRICTIVE | authenticated | INSERT | — | is_org_writer(organization_id) |
| security02_writer_update | RESTRICTIVE | authenticated | UPDATE | is_org_writer(organization_id) | is_org_writer(organization_id) |
| security03b_delete | PERMISSIVE | authenticated | DELETE | is_org_writer(organization_id) | — |
| security03b_insert | PERMISSIVE | authenticated | INSERT | — | (is_org_writer(organization_id) AND ((pack_id IS NULL) OR (EXISTS ( SELECT 1    FROM service_packs parent   WHERE ((parent.id = service_pack_items.pack_id) AND (parent.organization_id = service_pack_items.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM service_catalog parent   WHERE ((parent.id = service_pack_items.service_id) AND (parent.organization_id = service_pack_items.organization_id)))))) |
| security03b_select | PERMISSIVE | authenticated | SELECT | is_org_member(organization_id) | — |
| security03b_update | PERMISSIVE | authenticated | UPDATE | is_org_writer(organization_id) | (is_org_writer(organization_id) AND ((pack_id IS NULL) OR (EXISTS ( SELECT 1    FROM service_packs parent   WHERE ((parent.id = service_pack_items.pack_id) AND (parent.organization_id = service_pack_items.organization_id))))) AND ((service_id IS NULL) OR (EXISTS ( SELECT 1    FROM service_catalog parent   WHERE ((parent.id = service_pack_items.service_id) AND (parent.organization_id = service_pack_items.organization_id)))))) |

Dependencias entrantes (incluye tablas fuera del alcance principal):

Ninguna FK entrante encontrada.

## Funciones, permisos y vistas

Los cuerpos íntegros de las 13 funciones públicas están en catalog-audit.json. No se encontraron funciones de conversión order/payment/contract ni triggers de sincronización de importes: todavía no existen esas entidades. security03b_preserve_tenant rechaza cambios de tenant con SQLSTATE 23514. Las helpers is_org_member/admin/writer/finance consultan organization_members activa; los defaults get_user_org_id/get_user_role usan la primera membresía activa. storage04_org/can_read/can_write gobiernan paths y roles actuales; security04_asset_reference_inventory inspecciona referencias CMS. get_org_branding expone branding a miembros y get_public_schema_columns expone metadatos según grants actuales.

Las policies permisivas y restrictivas se evalúan conjuntamente; la policy legacy por user_id no reemplaza la barrera tenant/rol instalada por 03A–04B. Grants de tablas y funciones se conservan íntegros en integrity-and-grants.json; ninguna conclusión de permiso se basa solo en el nombre de una policy. No se propone ampliar grants legacy.

La auditoría registra estado en dos consultas de datos/catálogo independientes durante una ventana corta; no constituye snapshot transaccional exportado. Prospectos actuales: 10 (no reutilizar el conteo histórico 7 del cierre anterior). Ninguna escritura fue realizada para obtener o normalizar estos datos.
