# Somos Noveli Editorial - CRM Administrativo

¡Bienvenido al CRM Administrativo de **Somos Noveli Editorial**! Esta aplicación web está desarrollada con **React, Vite y Tailwind CSS** y soporta integración completa con **Supabase** para Autenticación, Base de datos y Políticas de Seguridad a Nivel de Fila (Row Level Security - RLS).

## Características

1. **Dashboard Financiero**: Resumen del mes actual de ingresos, egresos, utilidades estimadas, IVA débito/crédito y estado de operaciones (clientes activos, prospectos, servicios, pagos pendientes). Incluye un balance anual e indicador visual.
2. **Base de Datos de Clientes (CRUD)**: Fichas detalladas con nombres, correos, Instagram, teléfonos, países, estados del flujo de clientes y notas internas.
3. **Pipeline de Prospectos (CRUD)**: Seguimiento de interesados, origen del lead (Instagram, web, referido, etc.), interés de servicio, probabilidad de cierre (alta, media, baja) y la acción de "Convertir en Cliente" automatizada.
4. **Servicios Editoriales**: Seguimiento de procesos vinculados a un cliente (corrección, maquetación, diseño de portada, ebooks, impresiones, etc.), plazos estipulados y visualizador gráfico de progreso.
5. **Ingresos y Facturación**: Registro de cobros a autores, división automática de neto e IVA (19%), y estados de cobro (pendiente, parcial, pagado).
6. **Egresos y Gastos**: Clasificación de gastos (software, diseño, impresión, etc.), vinculación a proveedores y cálculo de IVA crédito si el gasto es deducible tributariamente.
7. **Directorio de Proveedores (CRUD)**: Control de diseñadores, correctores externos, imprentas, contadores y abogados.
8. **Planilla de Impuestos**: Detalle de IVA Débito vs IVA Crédito estimado a pagar, ingresos sin IVA (exento/boletas honorarios), balance neto comercial y cálculo de utilidades.

---

## Cómo Empezar (Modo Demo Local)

El sistema cuenta con un **motor de base de datos Mock persistido en `localStorage`**. Esto permite que la aplicación funcione al 100% de manera interactiva de inmediato, sin necesidad de configurar credenciales.

1. Instalar dependencias del proyecto:
   ```bash
   npm install
   ```
2. Iniciar el servidor de desarrollo local:
   ```bash
   npm run dev
   ```
3. Haz clic en el botón de **"Acceso Rápido Demo"** en la pantalla de inicio de sesión.
4. Explora, añade registros, edita e interactúa con los datos cargados de prueba. Todo se guardará localmente en tu navegador.

---

## Integración con Supabase Real

Para conectar la aplicación a tu base de datos de producción en Supabase, sigue estos pasos:

### 1. Crear las Tablas en Supabase
Copia todo el contenido del archivo `schema.sql` y pégalo en el editor de consultas SQL (**SQL Editor**) en tu panel de control de Supabase, luego haz clic en **Run**. 

Este script creará:
* Las tablas necesarias (`clients`, `prospects`, `services`, `incomes`, `expenses`, `providers`).
* Las claves foráneas y restricciones necesarias.
* Los índices de rendimiento.
* Habilitará la seguridad a nivel de fila (**RLS - Row Level Security**).
* Creará las políticas que garantizan que cada usuario registrado vea únicamente sus propios datos.

### 2. Configurar Variables de Entorno
Crea un archivo llamado `.env` en la carpeta raíz del proyecto (al lado de `package.json`) y agrega tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=tu_supabase_project_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_public_key
```

Una vez que reinicies el servidor de desarrollo (`npm run dev`), la aplicación detectará las variables de entorno y se conectará directamente a tu servidor de base de datos real.

---

## Reglas de Negocio Tributario (Chile / CLP)

* **Moneda de Cálculo**: La planilla tributaria consolida todo en Pesos Chilenos (CLP) usando una tasa estimada de conversión para transacciones en USD (`$930 CLP / 1 USD`).
* **IVA Débito**: Si el ingreso incluye IVA, se calcula el neto dividiendo por 1.19. El IVA débito es el 19% restante.
* **IVA Crédito**: Si el gasto incluye IVA y se marca como deducible, se calcula el crédito fiscal. Si no es deducible, el IVA no se puede rebajar y el total del gasto se asume como costo.
* **Utilidad Estimada**: Se calcula sumando los ingresos netos (sin impuestos) y restando todos los gastos netos operativos.
