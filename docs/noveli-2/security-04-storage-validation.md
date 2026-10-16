# Seguridad 04A / 04B: Storage por etapas

Estado: **preparación, script y cierre validados exclusivamente en LOCAL; aprobados localmente para checkpoint, sin despliegue productivo**.

Checkpoint previo 03C: `77c4067b23b26c8e289a7db62a39a0531965decd`. El inventario read-only productivo conservado aquí corresponde a la auditoría anterior (35 documents + 5 brand-assets, ambos públicos, nueve políticas). **En esta refactorización no se consultó ni modificó producción.** No hubo copias, UPDATE, DELETE, cambio de bucket, push ni repair remoto.

Runbook operativo: [security-deployment-runbook.md](security-deployment-runbook.md).

## Migraciones aplicables y responsabilidades

1. **20261016013219_harden_security_04a_storage_prepare.sql**, creada mediante `supabase migration new harden_security_04a_storage_prepare`.
   - Crea documents público si no existe y preserva su flag si ya existe: nunca reabre un bucket previamente cerrado.
   - Mantiene brand-assets público.
   - Instala los tres helpers y las dieciséis políticas finales validadas de tenant/rol; endurece escritura de documentos y marca sin romper las rutas válidas existentes.
   - Agrega `security04_asset_reference_inventory()`, lectura de metadata de URLs públicas website en las 46 tablas, SECURITY INVOKER, search_path vacío y EXECUTE únicamente service_role/postgres. No extrae cuerpos de documentos ni añade bypass RLS.
   - La lectura de bytes de documents **sigue siendo pública** aunque el listado/firma autenticada ya usen las políticas nuevas. Las seis URLs documentales y las imágenes existentes siguen funcionando durante la transición.
2. **20261016013221_harden_security_04b_storage_lockdown.sql**, creada posteriormente con CLI.
   - Aborta si quedan URLs públicas website apuntando a documents, si faltan destinos brand-assets referenciados o si default-org no tiene reconciliación técnica revisada.
   - Reinstala las políticas finales validadas (incluidas brand-assets) y pone documents privado.
   - No copia/mueve/borra archivos ni cambia los paths de adjuntos. No usa metadata controlada por clientes para autorizar.

**La migración original 20261016001336_harden_security_04_storage.sql fue retirada de supabase/migrations y no queda como migración aplicable.** Su modelo final, pruebas y evidencia original se conservan en la separación y en las suites; no se incluye una copia ejecutable de referencia en otro nombre/versionado.

Los tres helpers Storage existentes son SECURITY INVOKER con search_path vacío. El UUID del primer segmento se valida y se contrasta con una membresía real, activa y canónica. No se autoriza por owner_id/user_metadata/metadata.organization_id. Los nombres de entidades organizan el resto del path; no son una FK por sí solos.

Documentación oficial consultada en la auditoría original: [buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [RLS Storage](https://supabase.com/docs/guides/storage/security/access-control).

## Estados y conteos

| Métrica | Estado A: hasta 04A | Estado B: después de assets + 04B |
|---|---|---|
| documents.public | true (transitorio) | false |
| brand-assets.public | true | true |
| Políticas storage.objects | 16: ocho permisivas + ocho restrictivas | Las mismas 16 finales |
| Políticas public | 306, sin cambios de 04A/04B | 306 |
| Guards 02 public | 126 conservados | 126 conservados |
| Restrictivas public + Storage | 134 | 134 |
| Tablas public | 46 | 46 |
| Funciones public | 13 | 13 |

El estado original local no tenía políticas Storage; el inventario productivo previo tenía nueve (ocho mutaciones/lecturas por bucket y una SELECT documents duplicada). No confundir una propuesta de 16 políticas con un cambio ya aplicado a producción.

Permisivas: security04_documents_{select,insert,update,delete} y security04_brand_{select,insert,update,delete}. Restrictivas: security04_boundary_* TO authenticated y security04_anon_* TO anon, cuatro comandos cada grupo. Protegen de un OR permisivo inseguro y no conceden permisos en otros buckets. Anon no necesita EXECUTE en helpers.

| Actor | Metadata/list/sign documents | Mutación documents | Marca raíz | Marca website |
|---|---|---|---|---|
| Admin activo | Su tenant | Su tenant | Admin de su tenant | Su tenant |
| Editor/diseñador/corrector/finanzas activos | Su tenant | Su tenant | No | Su tenant |
| Visualizador activo | Su tenant | No | No | No |
| Desconocido/inactivo/sin membresía | No | No | No | No |
| Anon | No | No | No | No |

La marca se lee públicamente. En A, documents también sirve bytes por sus URLs públicas antiguas: es una excepción transitoria del flag público, no un fallo de las políticas. Solo B cierra ese acceso. DELETE documental writer se conserva por los flujos aprobados de adjuntos de Documents/Clients/Services; identidad/configuración de marca admin-only.

## Script de assets y contrato auditado

- `scripts/noveli-2/migrate-storage-assets.mjs` y `storage-assets-manifest.json`.
- Manifiesto cerrado: 14 imágenes activas bajo website, sus object IDs, mismos paths destino en brand-assets y exactamente 16 ubicaciones tabla/id/columna/tenant. SHA-256: `36a3645ae746d6451ec6029c6bbd88ce5a08947696a389c0c784c6a50f2bfd1a`.
- `--dry-run` es el modo por defecto: solo RPC/listados de metadata y HEAD; cero copias/cero PATCH. No descarga cuerpos ni lee .env automáticamente.
- `--apply --confirm-project <projectRef>` copia server-side, verifica destinos y hace PATCH compare-and-swap solo de los 16 campos. Registra JSONL origen/destino/referencia/acción; preserva todos los originales.
- `--verify` exige destino existente, tamaño/ETag/MIME compatibles, HEAD público correcto y las 16 filas apuntando al destino. No modifica nada.
- Origen cambiado/eliminado, colisión, metadata insuficiente, tenant distinto o referencias nuevas/inesperadas abortan. También detecta otras imágenes website que sigan referenciadas desde documents y no estén en el manifiesto.
- Reejecución segura: destinos idénticos y referencias ya actualizadas se verifican y omiten. No sobrescribe un destino diferente ni una URL concurrentemente cambiada. Puede quedar un avance parcial si hay fallo entre PATCH: no hay una transacción única Storage+DB; conservar log/revisar y reanudar, sin rollback automático.
- Credenciales solo por entorno NOVELI_SUPABASE_URL/NOVELI_SUPABASE_SERVICE_ROLE_KEY. URL debe coincidir con manifiesto/proyecto. Overrides de manifiesto solo se admiten en localhost; no se incluyen secretos.
- Nunca toca los seis adjuntos, catorce imágenes sin referencia ni default-org; no tiene operación delete/move.

## Auditoría de consumidores y rutas (antes de cambiar código)

La búsqueda cubrió todo el repositorio, excluyendo dependencias, dist, Git, secretos y cachés .temp/.branches; scripts históricos SQL/documentación se distinguieron de consumidores ejecutables.

| Archivo | Uso previo | Path/persistencia |
|---|---|---|
| Clients.jsx | Upload upsert, remove, descarga y vista con file_url/getPublicUrl | O/clientes/client_id/docType/nombre; public.documents.file_path y file_url |
| Documents.jsx | Upload upsert, remove; vista/descarga ya firmaban 3600s, pero upload guardaba URL pública | O/clientes/client_id/...; O/proveedores/provider_id/...; O/general/...; public.documents |
| Incomes.jsx | Upload upsert, remove, enlaces públicos | O/clientes/client_id_o_general/ingresos/income_id/docType/nombre; public.documents con FK income_id |
| Expenses.jsx | Upload upsert, remove, enlaces públicos | O/proveedores/provider_id_o_general/gastos/expense_id/docType/nombre; public.documents con FK expense_id |
| Services.jsx | Upload upsert, remove, enlaces públicos | O/clientes/client_id/servicios/service_id/docType/nombre; public.documents con FK service_id |
| Configuration.jsx | Upload público de logo/favicon a brand-assets | O/assetType_timestamp.ext; settings/empresa según formulario |
| Quotations.jsx / QuickQuoteModal.jsx | Upload público company_logo a brand-assets | O/company_logo_timestamp.ext; company_settings.logo_url/logo_path |
| Website.jsx | Cinco uploads públicos al bucket documents, incorrectamente mezclados con adjuntos | O/website/hero, identity, covers, services, footer/nombre; campos de tablas website_* |
| supabaseClient.js | Expone Storage real y mock upload/getPublicUrl/remove | Mock, sin descarga real |

O representa organization_id real. Nombres de adjuntos se saneaban; algunas rutas contienen espacios en docType. Los archivos web usan timestamp y extensión. No se encontraron consumidores reales move/update/download de Storage: update ocurre mediante upload upsert; las aperturas descargan/visualizan en navegador. No existe un proceso de mover archivos en el frontend.

Brand-assets contiene realmente dos logos, dos favicons y un company_logo (PNG/WebP); tres rutas tienen referencias SQL y dos son versiones previas sin referencia encontrada. Documents contiene seis adjuntos referenciados, veintiocho imágenes bajo website y un objeto legacy default-org. Clasificación por metadata/ruta/consumidor; no se inspeccionó contenido.

## Compatibilidad de metadata productiva

- **6 filas public.documents**, todas con file_path y file_url pública, y las seis coinciden con un objeto existente. Tenant de la fila y primer segmento del path coinciden con O.
- 14 objetos web distintos están referenciados por **16 campos**: cover_url/cover_image_url del mismo libro comparten objeto; logo_url/logo_dark_url también comparten objeto. Son duplicidades de referencia legítimas dentro del mismo tenant, no un cruce de organizaciones.
- **14 imágenes website sin referencia SQL encontrada**, más **1 objeto legacy sin fila documents**, son candidatos a huérfanos. No se concluye que sean prescindibles: pueden tener consumidores externos, cachés o enlaces históricos. No se borran.
- Dos de los cinco brand-assets no tienen referencia encontrada; se conservan públicos como estaban.
- El gasto `a0bff6fd-9dac-46f7-a521-c3493eefa9b8` del path default-org existe y pertenece a O. Permite proponer el tenant mediante una fila real; no basta para crear automáticamente una vinculación documental ni para confiar en default-org.
- El path de la fila documents `6f9b74f4-f6c5-4f62-958b-5248f2677321` contiene el antiguo income `46d64d5c-4c42-4e0f-bd47-e5c712691f78`, que ya no existe; su FK income_id es NULL. El documento está vinculado al cliente y al tenant: se conserva, sin recrear ingresos ni inventar FK.
- El barrido encontró 25 referencias URL/columna y 23 rutas únicas entre ambos buckets. No encontró referencias cruzadas de tenant ni filas documents con objetos faltantes. No cubre navegadores/localStorage ni servicios externos al proyecto.

## Políticas legacy sustituidas

Políticas retiradas cuando existan (todas PERMISSIVE):

| Política anterior | cmd | roles | USING | WITH CHECK | Reemplazo |
| Authenticated users can delete brand assets | DELETE | authenticated | (bucket_id = 'brand-assets'::text) | NULL | security04_brand_delete + boundaries |
| Authenticated users can delete documents | DELETE | authenticated | (bucket_id = 'documents'::text) | NULL | security04_documents_delete + boundaries |
| Authenticated users can update brand assets | UPDATE | authenticated | (bucket_id = 'brand-assets'::text) | (bucket_id = 'brand-assets'::text) | security04_brand_update + boundaries |
| Authenticated users can update documents | UPDATE | authenticated | (bucket_id = 'documents'::text) | (bucket_id = 'documents'::text) | security04_documents_update + boundaries |
| Authenticated users can upload brand assets | INSERT | authenticated | NULL | (bucket_id = 'brand-assets'::text) | security04_brand_insert + boundaries |
| Authenticated users can upload documents | INSERT | authenticated | NULL | (bucket_id = 'documents'::text) | security04_documents_insert + boundaries |
| Authenticated users can view documents | SELECT | authenticated | (bucket_id = 'documents'::text) | NULL | security04_documents_select + boundaries |
| Public can view brand assets | SELECT | public | (bucket_id = 'brand-assets'::text) | NULL | security04_brand_select + boundaries |
| Users can view documents | SELECT | authenticated | (bucket_id = 'documents'::text) | NULL | security04_documents_select + boundaries |

Las dos SELECT de documents eran equivalentes (authenticated + bucket_id únicamente), confirmadas por comando/roles/predicados. Las mutaciones tampoco verificaban tenant ni rol. No se elimina ninguna política desconocida de otros buckets; las restrictivas protegen los dos buckets aunque exista una permisiva amplia adicional.

## Frontend después de 04

- Nuevo storageDocuments.js centraliza extracción de path de URLs públicas/firmadas/authenticated antiguas y genera URLs firmadas **300 segundos**. No sigue el host de una URL almacenada: usa el cliente configurado y el path del bucket documents. Rechaza rutas inválidas y otros buckets; maneja espacios/% escapados sin convertir literalmente un %20 de un file_path canónico.
- Clients/Incomes/Expenses/Services abren una URL firmada nueva por acción, sin fallback a file_url pública. Se abre la ventana sincrónicamente para evitar bloqueo de popups; error de permisos cierra la ventana vacía y muestra el mensaje.
- Documents conserva su visor y descarga con firma, centralizados y reducidos de 3600 a 300 segundos.
- Los cinco uploads documentales conservan los paths existentes para compatibilidad, pero dejan file_url vacío y guardan file_path. Nunca se persiste una URL firmada.
- Si Storage rechaza remove, el frontend ya no continúa borrando la metadata y dejando un huérfano. No se cambia UI ni el modelo de permisos documental aprobado.
- Los cinco uploads públicos Website cambian a brand-assets, con el mismo namespace website. Configuration/Quotations/QuickQuoteModal conservan getPublicUrl de brand-assets; no hay getPublicUrl de documents en código productivo.

Formato futuro recomendado: O/{clients|services|documents}/entity_uuid/archivo. Se adopta solo en una fase posterior con IDs preasignados/relaciones verificables; no se renombran masivamente las seis rutas documentales válidas ni se finge que ya se migraron los 35 objetos.

## Plan exacto por objeto productivo (35)

**Plan, no ejecución.** O = `11111111-1111-1111-1111-111111111111`. En las rutas siguientes O se sustituye literalmente por ese UUID. Los originales se conservan, sin borrar ni mover. Para las imágenes activas, el destino propuesto es bucket brand-assets con el mismo name completo; copiar bytes mediante Storage API en una futura ventana autorizada, no INSERT SQL de metadata. Nunca convertir todo documents en público para resolver imágenes.

| Objeto id | Path actual en documents | Referencia confirmada | Acción/destino propuesto |
|---|---|---|---|
| 494cccc4-7a5e-48e5-8561-c09ee23d96d1 | `O/clientes/21b92057-0f98-4dcf-a9b9-c4e923d8e04a/ingresos/249ca3d5-8178-420a-b6bd-27750341e95a/factura/FACTURA_BLAIRE_MICHEL` | documents[6bc32ad4-0866-405b-a1b4-8518c9c6387a].file_url | Conservar documents/O/clientes/21b92057-0f98-4dcf-a9b9-c4e923d8e04a/ingresos/249ca3d5-8178-420a-b6bd-27750341e95a/factura/FACTURA_BLAIRE_MICHEL sin rename; acceso firmado desde file_path. URL pública antigua deja de usarse. |
| ce013fbd-32ea-4b11-b43f-64e1437ceefc | `O/clientes/8b563595-4d73-499e-873b-40cb93b9cced/factura/78408672.pdf` | documents[be9efd74-28a6-4b03-8d87-82b3b341e8c6].file_url | Conservar documents/O/clientes/8b563595-4d73-499e-873b-40cb93b9cced/factura/78408672.pdf sin rename; acceso firmado desde file_path. URL pública antigua deja de usarse. |
| 77c454bd-d73d-4dfe-a4fe-6f339a42eba5 | `O/clientes/8b563595-4d73-499e-873b-40cb93b9cced/ingresos/46d64d5c-4c42-4e0f-bd47-e5c712691f78/factura/comprobante_165995347512_(1).pdf` | documents[6f9b74f4-f6c5-4f62-958b-5248f2677321].file_url | Conservar documents/O/clientes/8b563595-4d73-499e-873b-40cb93b9cced/ingresos/46d64d5c-4c42-4e0f-bd47-e5c712691f78/factura/comprobante_165995347512_(1).pdf sin rename; acceso firmado desde file_path. URL pública antigua deja de usarse. |
| bfbbb0b1-5827-4899-b426-862643ac5343 | `O/proveedores/general/gastos/57644725-91c1-49c2-9f6f-e111dc5f15d4/factura/comprobante_000e09f7be.pdf` | documents[7de77e52-f892-4011-9fae-aa9ec6564fcc].file_url | Conservar documents/O/proveedores/general/gastos/57644725-91c1-49c2-9f6f-e111dc5f15d4/factura/comprobante_000e09f7be.pdf sin rename; acceso firmado desde file_path. URL pública antigua deja de usarse. |
| 2862e0d9-67c0-4d68-83e5-2ae1e5de6a72 | `O/proveedores/general/gastos/7f784b1a-56a5-4e3c-b356-75975104122d/boleta/Captura_de_pantalla_2026-06-27_191648.png` | documents[fba07f78-94f7-4408-9a09-8bf857990b74].file_url | Conservar documents/O/proveedores/general/gastos/7f784b1a-56a5-4e3c-b356-75975104122d/boleta/Captura_de_pantalla_2026-06-27_191648.png sin rename; acceso firmado desde file_path. URL pública antigua deja de usarse. |
| 4956aece-ca9b-4877-8a67-760322f2943d | `O/proveedores/general/gastos/97c22a42-099e-4c09-8a01-f8af1fbf33a3/comprobante de pago/declaracion_junio.pdf` | documents[e14db4b7-3f8e-4e5e-bb92-25fe3f643b0c].file_url | Conservar documents/O/proveedores/general/gastos/97c22a42-099e-4c09-8a01-f8af1fbf33a3/comprobante de pago/declaracion_junio.pdf sin rename; acceso firmado desde file_path. URL pública antigua deja de usarse. |
| e6e6f5e0-3981-4004-84b2-a08501a0a29f | `O/website/covers/1784144293596_cover.png` | website_books[131a4e4e-1669-4e60-ae77-9db547a9e3e3].cover_image_url; website_books[131a4e4e-1669-4e60-ae77-9db547a9e3e3].cover_url | Copiar a brand-assets/O/website/covers/1784144293596_cover.png; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| 21ee6a8f-ce26-4f32-9a38-d51da40d7afc | `O/website/covers/1784769356827_cover.png` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/covers/1784769356827_cover.png. No borrar. |
| c9a5c184-a0ac-4d86-b306-203c3549717e | `O/website/covers/1786680828701_cover.jpg` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/covers/1786680828701_cover.jpg. No borrar. |
| 7181fc32-e482-4050-8b33-b669e7f98e07 | `O/website/covers/1786681486676_cover.jpg` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/covers/1786681486676_cover.jpg. No borrar. |
| d6ab7594-c599-4566-9b3e-a537fd400413 | `O/website/covers/1786681848285_cover.jpg` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/covers/1786681848285_cover.jpg. No borrar. |
| 4a73785a-1c73-497d-87ad-bfdc35a7303d | `O/website/hero/1784219076909_hero_side.jpg` | website_hero_settings[e8193e0a-4247-422f-8542-4737525329d8].side_image_url | Copiar a brand-assets/O/website/hero/1784219076909_hero_side.jpg; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| 5c344271-0d0d-4290-9e93-51492d694f84 | `O/website/identity/1784225374100_identity_main.png` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/identity/1784225374100_identity_main.png. No borrar. |
| a59974e3-fc61-432c-baa3-7bc0b26a2e0b | `O/website/identity/1784225459905_identity_main.png` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/identity/1784225459905_identity_main.png. No borrar. |
| 5e84d978-2daa-4e34-ab43-ea559755b3b5 | `O/website/identity/1784521668999_identity_main.png` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/identity/1784521668999_identity_main.png. No borrar. |
| ed0b1b35-1dc0-4141-b8df-424d018d78ad | `O/website/identity/1784521681484_identity_light.png` | website_settings[3a170b5c-4382-4271-830c-abd7e14dae79].logo_light_url | Copiar a brand-assets/O/website/identity/1784521681484_identity_light.png; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| 3ec0f015-9116-47b2-9c11-bb3d795bb838 | `O/website/identity/1784521689999_identity_dark.png` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/identity/1784521689999_identity_dark.png. No borrar. |
| 85266554-6520-4b67-8488-2d971e10b4c5 | `O/website/identity/1784521718347_identity_favicon.png` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/identity/1784521718347_identity_favicon.png. No borrar. |
| 1aec1992-552a-4c6e-be14-e733cf449a88 | `O/website/identity/1784584032191_identity_dark.png` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/identity/1784584032191_identity_dark.png. No borrar. |
| dde809e9-51a9-48a0-a05a-7391407352a0 | `O/website/identity/1784587416452_identity_favicon.png` | website_settings[3a170b5c-4382-4271-830c-abd7e14dae79].favicon_url | Copiar a brand-assets/O/website/identity/1784587416452_identity_favicon.png; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| ada5591f-9b4c-4a9d-b7c9-1250689effae | `O/website/identity/1784588773387_identity_dark.png` | website_settings[3a170b5c-4382-4271-830c-abd7e14dae79].logo_dark_url; website_settings[3a170b5c-4382-4271-830c-abd7e14dae79].logo_url | Copiar a brand-assets/O/website/identity/1784588773387_identity_dark.png; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| 704c84f6-baf3-43c2-b385-a5508685df5a | `O/website/identity/1784588829857_identity_main.png` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/identity/1784588829857_identity_main.png. No borrar. |
| e75cc85b-aaf9-422a-949e-0a538514e8d0 | `O/website/services/1784181586003_service_image.jpg` | website_services[98487ada-28ac-484c-9913-6d553ddfacd7].image_url | Copiar a brand-assets/O/website/services/1784181586003_service_image.jpg; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| 23c1b9fc-7ed2-4c12-aff4-ea63d21fb92e | `O/website/services/1784181646932_service_image.jpg` | website_services[4ee92c55-e749-4e0d-90f5-23fe7cf3ca8d].image_url | Copiar a brand-assets/O/website/services/1784181646932_service_image.jpg; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| c341b238-3c10-479d-9725-4c09a58524a0 | `O/website/services/1784181722985_service_image.jpg` | website_services[8169d44e-695f-4855-b895-ced2c8fe41f4].image_url | Copiar a brand-assets/O/website/services/1784181722985_service_image.jpg; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| 9198ee53-afc2-4bd7-9069-93233f9f5781 | `O/website/services/1784181797567_service_image.jpg` | website_services[a96a1cfd-cef8-471a-8949-dfd3361df652].image_url | Copiar a brand-assets/O/website/services/1784181797567_service_image.jpg; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| c2258da6-70db-4695-a723-6f712169846b | `O/website/services/1784181901425_service_image.png` | website_services[1eb6739f-b962-4fc7-95fa-3c06c1fbb6ef].image_url | Copiar a brand-assets/O/website/services/1784181901425_service_image.png; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| ab1b8549-061d-48aa-8983-9930abca02f5 | `O/website/services/1784181976971_service_image.jpg` | website_services[d3cdd616-8288-4396-a639-bd4ee6dd9d1c].image_url | Copiar a brand-assets/O/website/services/1784181976971_service_image.jpg; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| 95364c5c-13bf-49f3-a570-80a01686c9f1 | `O/website/services/1784182150752_service_image.png` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/services/1784182150752_service_image.png. No borrar. |
| 20d6a644-7f8d-443b-92c0-d6227d13ecd7 | `O/website/services/1784182173883_service_image.png` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/services/1784182173883_service_image.png. No borrar. |
| 766b4187-d066-414a-81d9-2a7dbc0c4260 | `O/website/services/1784182252609_service_image.jpg` | Sin referencia SQL encontrada | Conservar original privado en cuarentena; confirmar consumidores externos antes de copiar a brand-assets/O/website/services/1784182252609_service_image.jpg. No borrar. |
| cf9ffa51-9572-45ca-af95-5ce97edcc0a7 | `O/website/services/1784182265927_service_image.jpg` | website_services[3e0b638b-258b-46a4-9027-058af3ae3e22].image_url | Copiar a brand-assets/O/website/services/1784182265927_service_image.jpg; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| 49c6409d-3b38-46a2-8f4b-f374dd23842d | `O/website/services/1784248572046_service_image.jpg` | website_services[270da2af-8d27-441f-952f-ca99ef20b1e5].image_url | Copiar a brand-assets/O/website/services/1784248572046_service_image.jpg; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| 3368a1b6-01f2-44ae-b24e-d4b8239f4988 | `O/website/services/1784248631302_service_image.jpg` | website_services[4108c53d-3693-47c6-834f-b144f11257b9].image_url | Copiar a brand-assets/O/website/services/1784248631302_service_image.jpg; actualizar los campos indicados y verificar acceso anon. Conservar original privado. |
| e6a2506c-a78a-4268-a9d2-146c084b2d19 | `default-org/proveedores/general/gastos/a0bff6fd-9dac-46f7-a521-c3493eefa9b8/comprobante de pago/Captura_de_pantalla_2026-06-27_191648.png` | Sin referencia SQL encontrada | Bloquear acceso por path inválido. Asociación confirmada con gasto a0bff6fd-9dac-46f7-a521-c3493eefa9b8 (tenant O); pendiente copiar a documents/O/expenses/a0bff6fd-9dac-46f7-a521-c3493eefa9b8/e6a2506c-a78a-4268-a9d2-146c084b2d19_legacy.png y crear metadata revisada. Conservar original. |

## Default-org: bloqueo productivo pendiente

Objeto `e6a2506c-a78a-4268-a9d2-146c084b2d19`, path:

```text
default-org/proveedores/general/gastos/a0bff6fd-9dac-46f7-a521-c3493eefa9b8/comprobante de pago/Captura_de_pantalla_2026-06-27_191648.png
```

Asociación confirmada por el usuario mediante consulta read-only de producción: gasto `a0bff6fd-9dac-46f7-a521-c3493eefa9b8`, tenant `11111111-1111-1111-1111-111111111111`, categoría `publicidad`, importe `13000 CLP`, fecha `2026-06-05`, notas `publicidad Instagram`. Registro y objeto fueron creados prácticamente al mismo tiempo. La asociación técnica es inequívoca. No se abrió ni descargó contenido. El destino tenant-aware y expense_id deben conservar esa asociación; queda pendiente ejecutar/verificar la copia y metadata, sin cambios remotos en esta fase. El manifiesto de 14 imágenes excluye este adjunto legacy.

04B exige un destino existente con el ID del objeto origen en su nombre y una fila documents vinculada al gasto del mismo tenant. Es un gate técnico, no una sustitución de la validación humana. El original se conserva y quedará inaccesible por ruta inválida tras B. La reconciliación que hace el test es solo sobre un objeto/gasto sintéticos.

## Validación reproducible y evidencia

Comandos y orden completos en el runbook. Resumen de ejecución:

| Prueba | Resultado |
|---|---|
| Reset local hasta 04A | PASS |
| SQL 01 / 02 / 03A / 03B / 03C / 04 en A | PASS: 49 / 274 / 316 / 989 / 1.041 / 225 avisos PASS |
| API Storage en A | PASS: 130 comprobaciones; URL pública antigua funciona y firmas/listados respetan RLS |
| Unit tests del script | PASS: seis escenarios (dry-run, idempotencia, drift, colisión, CAS/reanudación, scope) |
| Dry-run con 35 fuentes sintéticas | 14 copias/16 referencias pendientes; 0 copias y 0 cambios realizados |
| Apply local | 14 copias verificadas, exactamente 16 campos actualizados |
| Verify local y segundo apply | PASS; segundo apply: 0 copias, 0 cambios |
| Fuentes preservadas | Seis adjuntos, catorce sin referencia, legacy y catorce originales activos conservados |
| Gate 04B URLs antiguas | Bloquea y deja documents público |
| Gate 04B destino faltante | Bloquea y deja documents público |
| Gate 04B default-org | Bloquea y deja documents público |
| Transición A → B | PASS: 32 comprobaciones con fixtures 100% sintéticos |
| Regresión final B / frontend / lint | PASS: reset completo; SQL 49 / 274 / 316 / 989 / 1.041 / 225; HTTP 130; JavaScript 15/15; build 422 módulos; lint 402 errores/22 avisos históricos, 0 nuevos |

No se usan IDs/nombres/bytes productivos para crear fixtures. El driver crea un tenant aleatorio, 35 fuentes y cinco assets previos, catorce destinos y dieciséis referencias nuevas, junto a un gasto/legacy sintéticos. Comprueba que el CLI rechace una referencia adicional antes de copiar. Solo aplica B después de migrar/verificar y simular la reconciliación aprobada del legacy sintético. Prueba URLs antiguas en A, imágenes públicas nuevas en B, los seis paths iguales y firmas. Limpia exclusivamente sus propios fixtures mediante API local.

La evidencia original monolítica no se pierde: se conservan las 225 comprobaciones SQL de Storage y 130 HTTP, nueve tests frontend de roles/paths y las suites anteriores. Se adapta el estado de public/private en A y el inventario de funciones al nuevo RPC; no se relajan expectativas de tenant/rol del estado final. El trigger administrado protect_delete no se desactiva: el SQL de prueba usa solo su GUC transaccional nativo para metadata sintética sin bytes.

## Riesgos y límites pendientes

- A no da confidencialidad de bytes a documents: bucket público hasta D. No presentar la preparación de signed URLs como privacidad ya desplegada.
- El tenant y gasto de default-org están confirmados; su copia tenant-aware y metadata siguen pendientes. No se copió, enlazó ni habilitó. 04B sigue bloqueado hasta ejecutar/verificar esa reconciliación autorizada.
- Los catorce objetos sin referencia no se borran/mueven. Tras B quedarán privados; una limpieza futura requiere probar que realmente son huérfanos y observar retención/consumidores externos.
- La web real, sus cachés e integraciones externas deben coordinarse en producción; las pruebas locales verifican API/refs/bytes HEAD, no un E2E de navegador del sitio productivo.
- Copias y dieciséis PATCH no son una sola transacción; compare-and-swap y logs permiten detectar/reanudar, no garantizar ausencia de carreras si editores siguen cambiando las referencias. Coordinar ventana de edición y repetir verify inmediatamente antes de B.
- Signed URLs son bearer tokens válidos por 300 segundos aunque después cambie la sesión/membresía. No se persisten ni se imprimen sus tokens.
- El modelo documental sigue siendo por tenant, no por clasificación financiera de cada archivo. activity_log/campos comerciales pueden contener datos económicos: esta fase no rediseña esos permisos.
- No hay transacción única entre upload y fila documents; un fallo puede dejar objetos sin metadata. No hay borrado automático como compensación.
- Mantener originales y revisar snapshots; no reabrir documents como rollback automático porque volvería a exponer archivos privados.

Ni producción ni historial remoto fueron modificados. No se ejecutó push, repair, reset linked, copia/UPDATE/DELETE remoto. No se hizo commit de esta refactorización.

### Cierre de la ejecución escalonada

Estado A y Estado B validados. Conteos finales: 46 tablas públicas, 13 funciones públicas, 306 políticas públicas (126 restrictivas), 16 políticas storage.objects (8 restrictivas), ninguna tabla pública con RLS deshabilitado. documents privado y brand-assets público en B. Baseline SHA256 c41d2d67c856f1d50cdff9a27a739d8655f93844a7876301795ac0aff1b42620; migraciones 01–03C sin cambios. La migración monolítica original no existe en migrations ni en el historial local reconstruido.

Incidencia de infraestructura local: tras el reset final la primera creación de usuario HTTP agotó el timeout y un segundo intento falló. Se reiniciaron exclusivamente los contenedores locales Auth, REST y gateway; después las 130 comprobaciones HTTP pasaron y limpiaron sus fixtures. No se relajó ninguna aserción. Build conserva avisos de sourcemap Tailwind y tamaño de chunk. Lint diagnóstico conserva 402 errores y 22 advertencias, sin mensajes nuevos frente al estado previo de esta refactorización.
