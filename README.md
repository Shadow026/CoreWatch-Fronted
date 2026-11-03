# 📋 Changelog — CoreWatch Backend

## 🚀 Fase 2: Rediseño del Backend
### *(Transacciones ACID)*

---

## 📖 Contexto

Con la normalización del esquema de base de datos (separación en `equipos`, `metricas`,
`gpu_metricas`, `procesos`, `discos`, `interfaces_red`, `hardware`,
`network_scans`, `network_scan_hosts`, `perifericos_usb`, `alertas`, etc.),
cualquier operación que escriba en más de una tabla relacionada necesita garantías
de **atomicidad**.

> 💡 **Objetivo**
>
> Si una operación falla a mitad del proceso, **no deben quedar registros huérfanos o inconsistentes**. Todas las escrituras relacionadas deben completarse correctamente o revertirse por completo.

---

# 🔒 1. Gestor de Transacciones ACID

**Archivo afectado**

```text
database.js
```

Se agregó el método:

```javascript
withTransaction(work)
```

### ✅ Funcionalidades

- Abre la transacción mediante `BEGIN`.
- Ejecuta la función `work(client)` recibida.
- Realiza `COMMIT` si todo finaliza correctamente.
- Ejecuta `ROLLBACK` automáticamente si ocurre un error.
- Libera siempre el cliente (`client.release()`) dentro de un bloque `finally`.

> 📌 El método se expone tanto como:
>
> - `pool.withTransaction`
> - `pool.transaction`

Listo para envolver cualquier secuencia de escrituras relacionadas dentro del backend.

---

# 🔌 2. Inventario de Periféricos USB

**Endpoint**

```http
POST /perifericos/usb
```

El endpoint inserta el listado de periféricos detectados en la tabla:

```text
perifericos_usb
```

Toda la operación se ejecuta mediante:

```javascript
pool.withTransaction(...)
```

### Beneficios

- ✅ Inserción atómica.
- ✅ Protección frente a errores parciales.
- ✅ Evita registros incompletos cuando se detectan múltiples dispositivos USB.

---

# 🚨 3. Limpieza de Alertas

**Endpoint**

```http
PUT /alertas/limpiar
```

La actualización del estado de las alertas ahora se realiza dentro de una transacción utilizando:

```javascript
pool.withTransaction(...)
```

Con esto se evita dejar alertas en estados intermedios si la operación es interrumpida.

---

# 🖥️ 4. Detalle Completo de Equipo

El endpoint:

```http
GET /equipos/:id/detalle-completo
```

fue ampliado para incluir, además de la información existente (`hardware`, `discos`,
`gpu_metricas`, `procesos`, `interfaces_red`, `vulnerabilidades`,
`historial_hardware`, `red_general`, `analisis_ia`), los siguientes elementos:

### Información agregada

- 🔌 `perifericos_usb`
  - Histórico de periféricos USB asociados al equipo.

- 🌐 `network_scan` / `network_scan_hosts`
  - Último escaneo de red disponible (generado externamente).
  - Proporciona contexto adicional sobre la conectividad del entorno donde se encuentra el equipo.

---

# 🎨 5. Frontend

**Archivo afectado**

```text
main.js
```

El modal de detalle del equipo (`modal-detalle-equipo`) fue actualizado para mostrar la nueva información incorporada.

### Nuevos bloques visuales

- 🔌 Tabla de periféricos USB.
- 🌐 Tabla de puertos abiertos.
- 📊 Resumen del último escaneo de red.
- 🖥️ Información del dispositivo que realizó el escaneo.
- 📋 Listado completo de `network_scan_hosts`.

---

# 🧹 Limpieza de Código

## ❌ Eliminación de `monitoreoController.js`

Se identificó que `monitoreoController.js` correspondía a una implementación **anterior y obsoleta** del controlador, previa al rediseño de la Fase 2.

### Motivos

- Correspondía a un esquema más simple.
- No contemplaba:
  - `cliente_id`
  - `hardware`
  - `perifericos_usb`
  - `network_scans`
- Calculaba `activo` como una columna fija en `equipos`, en lugar de derivarlo dinámicamente mediante `buildActiveCase()`.

### Verificaciones realizadas

Se confirmó que:

- ✅ `server.js` nunca lo importaba (`require('./monitoreo')`).
- ✅ Ningún otro archivo del proyecto hacía referencia a él.

> **Resultado:** el archivo fue eliminado por tratarse de código legado sin uso.

---

# ℹ️ Fuera del Alcance de este Backend

Este servicio (`server.js`, `monitoreo.js` y `database.js`) funciona, por diseño, como una **capa de lectura**.

Su responsabilidad consiste en consultar las tablas ya pobladas en PostgreSQL (Railway) y exponer la información mediante una API REST para el frontend.

La recolección activa de datos corresponde exclusivamente al **Agente CoreWatch**, ejecutado en cada equipo monitoreado (PC o Raspberry Pi), el cual:

### El agente es responsable de:

- Insertar directamente en PostgreSQL las tablas:
  - `metricas`
  - `procesos`
  - `gpu_metricas`
  - `discos`
  - `interfaces_red`
  - `hardware`

- Ejecutar los escaneos de red dentro de la LAN.

- Insertar los resultados en:
  - `network_scans`
  - `network_scan_hosts`

> 💡 Este backend **no ejecuta escaneos de red** por cuenta propia.

### Motivo

Al encontrarse desplegado en Railway (nube pública), no posee conectividad directa hacia las direcciones IP privadas de la red local donde residen los equipos monitoreados.

Su única responsabilidad respecto a esa información es **consultarla y exponerla** para su visualización.

---

# 📂 Resumen de Archivos Afectados

| Archivo | Estado |
|:---------|:-------|
| 🟢 `database.js` | Gestor de transacciones ACID |
| 🟢 `monitoreo.js` | Inserciones transaccionales (`perifericos_usb`, `alertas`) + detalle de equipo ampliado |
| 🟢 `main.js` | Modal avanzado con periféricos USB y último escaneo de red |
| 🔴 `monitoreoController.js` | Eliminado por tratarse de código obsoleto |
| ⚪ `server.js` | Sin cambios; continúa montando únicamente `monitoreo.js` |

---

---

**✔️ Estado de la Fase 2:** Completada

---