# Despliegue por etapas: Seguridad 04A / 04B

Estado: **runbook preparado; ninguna fase productiva ejecutada**. No constituye
autorización para desplegar. Evidencia local e inventario individual de los 35
objetos: [security-04-storage-validation.md](security-04-storage-validation.md).

## Condiciones y artefactos

- Checkpoint previo 03C: `77c4067b23b26c8e289a7db62a39a0531965decd`.
- Preparación: `20261016013219_harden_security_04a_storage_prepare.sql`.
- Cierre: `20261016013221_harden_security_04b_storage_lockdown.sql`.
- Script: `scripts/noveli-2/migrate-storage-assets.mjs`.
- Manifiesto: `scripts/noveli-2/storage-assets-manifest.json`, 14 fuentes y 16
  referencias, exclusivamente imágenes públicas bajo `website/`.
- SHA-256 del manifiesto revisado:
  `36a3645ae746d6451ec6029c6bbd88ce5a08947696a389c0c784c6a50f2bfd1a`.
- La migración monolítica `20261016001336_harden_security_04_storage.sql` fue
  retirada y no debe incluirse en ningún paquete de despliegue.

El inventario productivo anterior a esta refactorización contiene documents
público con 35 objetos y brand-assets público con 5. Revalidar el inventario antes
de operar: no se consultó producción durante esta refactorización.

**No ejecutar un despliegue genérico de todas las migraciones del repositorio:**
aplicaría también 04B. Fase A requiere un artefacto/proceso revisado que contenga
solo migraciones hasta `20261016013219`; 04B se entrega separadamente en Fase D.
No se inventa una opción de CLI para limitar versiones productivas. Este runbook
no proporciona comandos automáticos de push/reset/repair ni borrado de objetos.

## Fase A — Backup, preflight, preparación y frontend compatible

1. Confirmar proyecto, commit y hash del manifiesto. Preparar backup/restauración
   de DB y Storage mediante el proceso de respaldo existente, sin borrar ni
   renombrar originales. Guardar snapshot de buckets, políticas, object IDs,
   nombres, tamaño/ETag/MIME y las 16 referencias originales.
2. Revalidar que las 14 fuentes/IDs y 16 campos coinciden con el manifiesto.
   Si hay nuevas referencias a documents/website, detenerse y volver a auditar;
   no ampliar la lista automáticamente. Registrar consumidores externos/cachés.
3. Revisar si 01–03C ya están desplegadas y desplegar solo las migraciones
   pendientes **hasta 04A**, usando el paquete limitado revisado. No reeditar
   migraciones anteriores ni reparar historial como parte de este runbook.
4. Confirmar `documents.public=true`, `brand-assets.public=true`, helpers y
   dieciséis políticas Storage instalados; las 126 restrictivas anteriores siguen.
   La preparación nunca reabre un documents ya privado al reejecutarse.
5. Desplegar el frontend compatible: imágenes nuevas del CMS a brand-assets;
   adjuntos guardan file_path y se abren con firma de 300 segundos, sin nuevos
   getPublicUrl(documents). Las URLs públicas antiguas siguen funcionando porque
   documents **todavía es público**. Ningún documento nuevo es confidencial por
   pertenecer a ese bucket antes de Fase D; mantener corta esta transición.
6. Smoke tests: web anónima, seis adjuntos, uploads autorizados de CMS, identidad
   admin-only, visor y descarga autenticados. No modificar todavía los 35 paths.

## Fase B — Migración controlada de las 14 imágenes

Las siguientes invocaciones están documentadas para una futura ventana
autorizada. **No se ejecutaron contra producción.** Usar un job confiable con
`NOVELI_SUPABASE_URL` y `NOVELI_SUPABASE_SERVICE_ROLE_KEY` inyectados desde su
gestor de secretos. La clave no va en argumentos, repositorio, capturas ni logs.
El URL debe coincidir exactamente con el manifiesto y el proyecto revisado.

```text
node scripts/noveli-2/migrate-storage-assets.mjs --dry-run
```

Revisar salida JSONL: 14 assets, 16 referencias. En primera ejecución deben
aparecer 14 copias/16 actualizaciones pendientes y **0 copias/0 actualizaciones
ejecutadas**. Si ya se migraron, se aceptan estados origen/destino esperados y se
verifica identidad de las copias. Cualquier referencia inesperada, fuente
reemplazada, cambio de tenant, colisión o destino no verificable aborta.

Tras revisar el plan, ejecutar explícitamente:

```text
node scripts/noveli-2/migrate-storage-assets.mjs --apply --confirm-project bdxlzhpmifxwmqjnnmxa
node scripts/noveli-2/migrate-storage-assets.mjs --verify
```

El script realiza copias server-side a brand-assets con el mismo path estable;
preserva nombre/extensión y originales. Compara ID de origen, tamaño, ETag y MIME;
verifica HEAD público del destino sin descargar cuerpos. Solo después de copiar
y verificar las catorce imágenes actualiza los dieciséis campos permitidos.

Cada UPDATE usa compare-and-swap de id, organization_id y URL anterior. Guardar la
salida JSONL origen → destino → tabla/id/columna. No escribir logs de autenticación
ni descargar archivos. Repetir `--apply` debe dar 0 copias y 0 cambios cuando todo
esté migrado; `--verify` no modifica nada.

No existe una transacción única entre Storage y los dieciséis PATCH de DB. Ante
un fallo/concurrencia, **detenerse y revisar el log**; puede haber copias o parte de
las referencias ya migradas. Ambas ubicaciones siguen públicas en esta fase.
Reejecutar solo después de resolver el conflicto: el script reconoce estados
origen/destino y no sobrescribe valores ajenos ni destinos diferentes. No hace
rollback automático que pueda pisar cambios concurrentes.

Los seis adjuntos, catorce imágenes sin referencia y default-org quedan fuera
del manifiesto. El script no ofrece opciones de borrar/mover ni de migrar legacy.
Los manifiestos alternativos son admitidos únicamente para endpoints locales.

## Fase C — Bloqueo default-org y comprobación de compatibilidad

**BLOQUEO EXPLÍCITO para pasar a Fase D:**

| Dato | Valor auditado |
|---|---|
| Objeto Storage | `e6a2506c-a78a-4268-a9d2-146c084b2d19` |
| Bucket/path | `documents/default-org/proveedores/general/gastos/a0bff6fd-9dac-46f7-a521-c3493eefa9b8/comprobante de pago/Captura_de_pantalla_2026-06-27_191648.png` |
| Gasto existente | `a0bff6fd-9dac-46f7-a521-c3493eefa9b8` |
| Organization esperado | `11111111-1111-1111-1111-111111111111` |
| Metadata documents | No había fila vinculada al objeto en el inventario |

Asociación confirmada por el usuario mediante consulta productiva read-only: el UUID del path coincide exactamente con public.expenses.id, organization_id es `11111111-1111-1111-1111-111111111111`, category `publicidad`, amount `13000 CLP`, date `2026-06-05`, notes `publicidad Instagram`. Gasto y objeto se crearon prácticamente al mismo tiempo. La asociación técnica al gasto y al tenant Noveli queda confirmada inequívocamente, sin abrir ni descargar el archivo.

El bloqueo pendiente es ejecutar y verificar la reconciliación, no identificar su tenant. Cuando se autorice esa operación, conservar la asociación al gasto y copiar a esta ruta tenant-aware, manteniendo el original:

```text
documents/11111111-1111-1111-1111-111111111111/expenses/a0bff6fd-9dac-46f7-a521-c3493eefa9b8/e6a2506c-a78a-4268-a9d2-146c084b2d19_legacy.png
```

La reconciliación debe conservar el original y verificar la copia por metadata,
crear/vincular una fila public.documents del mismo tenant con expense_id real y
file_path del destino, y registrar el responsable/evidencia. El nombre incluye el
ID del objeto origen para conservar trazabilidad. No se incluyen comandos que
automaticen esa operación: el script de assets no la realiza ni la habilita.

04B valida que cada default-org tenga metadata de destino existente, asociación
con gasto del mismo tenant y trazabilidad al object ID original; esto es un
control técnico adicional, **no ejecuta la reconciliación pendiente**.

Además:

- `--verify` de las 14 imágenes debe finalizar correctamente; comprobar sus
  dieciséis campos y la web pública real, incluyendo cachés y clientes externos.
- Confirmar que no quedan URLs documents/website en consumidores públicos. Un
  frontend antiguo aún podría crear otra referencia; coordinar una ventana corta
  sin edición CMS y detenerse ante cambios concurrentes.
- Los seis adjuntos conservan paths; probar generación de firmas de 300 segundos
  bajo sesión. No guardar tokens en file_url ni sustituirlos por URLs públicas.
- Registrar los catorce objetos sin referencia como candidatos a limpieza
  posterior; su futura pérdida de acceso público es intencional y aceptada.

## Fase D — Storage lockdown

Solo tras aprobar A/B/C y sus evidencias, entregar/aplicar el artefacto exclusivo
de `20261016013221_harden_security_04b_storage_lockdown.sql` mediante el proceso
de despliegue revisado. No aplicar la migración monolítica retirada.

La migración aborta sin cerrar el bucket si:

1. Hay referencias públicas website todavía apuntando a documents.
2. Falta metadata de algún destino brand-assets referenciado.
3. Hay un default-org no reconciliado conforme a la asociación técnica anterior.

Si pasa, reinstala las políticas finales validadas y pone documents privado;
brand-assets sigue público. Validar:

- documents privado; brand-assets público; dieciséis políticas Storage, ocho
  restrictivas. Las 306 políticas public y los 126 guards anteriores conservados.
- Web anónima muestra las catorce imágenes migradas desde brand-assets.
- Anon no lista/lee/firma documents; las antiguas URLs públicas no sirven bytes.
- Admin y escritores operan solo su tenant; viewer solo lee; desconocido/inactivo
  no acceden por una membresía inválida. Identidad de marca solo admin; CMS writer.
- Firmas de 300 segundos funcionan y no se persisten; los seis paths siguen
  iguales. Probar aislamiento A/B y que una firma expirada se rechaza.
- Fuente default-org original y catorce candidatos sin referencia permanecen
  almacenados, pero ya no son públicamente accesibles.

Ante un fallo, detener el despliegue, conservar todos los objetos y evaluar una
corrección hacia delante. No reabrir documents automáticamente: volver a público
reexpondría archivos privados. No hay rollback automático destructivo ni limpieza.

## Fase E — Observación y eventual limpieza

Mantener un periodo de observación acordado, logs de acceso/error y soporte de
usuarios. Solo después evaluar las copias antiguas y los huérfanos reales con
inventario actualizado, retención y autorización específica. Este runbook no
incluye DELETE, movimientos ni limpieza programada.

## Reproducción local de la evidencia

Con Docker/Supabase local disponibles y sin usar datos productivos:

```text
supabase db reset --local --version 20261016013219
python supabase/tests/security_04_regressions.py --prepare
python supabase/tests/security_04_storage_api.py --prepare
python supabase/tests/security_04_transition.py
```

La prueba de transición genera IDs/rutas/bytes nuevos, crea 35 fuentes sintéticas,
prueba dry-run, copia/actualización/repetición/verificación y los bloqueos de 04B.
Solo reconcilia un default-org **sintético** para poder probar B; no decide nada
sobre la reconciliación productiva pendiente. Sus fixtures se limpian mediante APIs locales.

Después puede reproducirse desde cero el esquema final y toda la regresión:

```text
supabase db reset --local
python supabase/tests/security_04_regressions.py
python supabase/tests/security_04_storage_api.py
node --test src/utils/roles.test.js src/utils/storageDocuments.test.js scripts/noveli-2/migrate-storage-assets.test.mjs
npm run build
npm run lint
```

Lint es diagnóstico; separar errores históricos de cualquier diagnóstico nuevo.
Un reset final vacío verifica reproducción del esquema; **no sustituye** la prueba
de transición con archivos y referencias presentes antes de ejecutar 04B.
