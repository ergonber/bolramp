# Diagnóstico del webhook de Stereum

Guía para responder una sola pregunta: **¿Stereum realmente está enviando las
notificaciones?** Y separar el problema en dos mitades:

```
Stereum  ──POST──▶  [ ¿llega al endpoint? ]  ──▶  Bolramp (Render)
```

## Causa más probable en pruebas: cold start de Render

El backend en Render (free tier) **duerme el proceso** tras ~15 min sin tráfico.
El primer request luego de dormir tarda **~20-25 segundos**. Si Stereum valida o
envía el webhook en ese momento, **corta por timeout** y la notificación se
pierde (o la URL no se llega a guardar en la consola).

El keep-alive interno (`setInterval` en `index.ts`) **no sirve**: Render detiene
el contenedor entero, así que el temporizador no corre. Se necesita un ping
**externo**.

**Solución:** un monitor externo (UptimeRobot, cron-job.org, Better Stack)
haciendo `GET https://bolramp.onrender.com/health` cada **5 minutos**. O pasar
Render a plan always-on.

## Paso 1 — Confirmar que Stereum envía algo (desde su lado)

Usa un inspector temporal para descartar Stereum:

1. Entra a https://webhook.site y copia la URL única que te da.
2. En la consola de Stereum, **cambia temporalmente** la URL del webhook por esa.
3. Genera un movimiento de prueba (una orden que quede `Cancelada`).
4. Mira el panel de webhook.site:
   - **Llegan requests** → Stereum sí envía. El problema está en Bolramp
     (URL no guardada, timeout, o ruta distinta). Ve al Paso 2.
   - **No llega nada** → el problema está en la configuración de Stereum
     (URL no guardada o webhook deshabilitado para ese API key). Escala con su
     equipo mostrando la captura.

## Paso 2 — Ver si el webhook pega al backend

### 2.1 Logs de Render
En Render → tu servicio → **Logs**. El código actual registra `"Webhook received"`
con el `notification_type`. Si no aparece esa línea cuando Stereum dispara un
evento, el request nunca llegó al backend.

### 2.2 Guardar la URL correctamente
En la consola de Stereum, la URL debe ser exactamente:

```
https://bolramp.onrender.com/api/webhook/stereum
```

La consola hace una validación: envía un `notification_type: "test"` y espera
**HTTP 200**. Si Render está dormido, esa validación falla y **la URL no se
guarda**. Asegúrate de tener el pinger externo activo antes de guardarla.

### 2.3 Inspección con Postman
Importa `docs/stereum-webhook.postman_collection.json` y configura las variables:

| Variable | Valor |
|---|---|
| `baseUrl` | `https://bolramp.onrender.com` |
| `webhookSecret` | tu `STEREUM_WEBHOOK_SECRET` (o el API key) |
| `apiKey` | tu `API_KEY` del backend |
| `signVariant` | `timestamp.body` (default) o `body` |

La colección firma cada POST con HMAC-SHA256 y setea `x-signature`/`x-timestamp`.
Request 5 simula el **CANCELADA**; el 6 prueba el tipo `transaction`.

## Paso 3 — Leer lo que llegó

Con el PR de hardening desplegado, cada request queda en la tabla `WebhookLog`.
Consulta:

```
GET {{baseUrl}}/api/webhook/stereum/logs
Header: x-api-key: {{apiKey}}
```

Verás por cada webhook: `notificationType`, `payload`, `signature` (truncada),
`processed` y `error` (p. ej. `HMAC mismatch`, `Timestamp expired`).

## Firma HMAC — FORMATO CONFIRMADO

Comprobado empíricamente el 2026-09-21 capturando el `test` que envía Stereum:

```
x-signature = HMAC-SHA256(API_KEY, rawBody)
```

- La clave del HMAC es el **API KEY** (el mismo valor de `x-api-key`), **no** un
  `SECRET_KEY` separado.
- Se firma el **body crudo en bytes**, sin el timestamp.
- El backend, por compatibilidad, sigue aceptando también la variante
  `HMAC(secret, ${timestamp}.${rawBody})` y respeta `STEREUM_WEBHOOK_SECRET` si
  existe.

### La consola valida el Content-Type de la respuesta
La validación de la URL **falla si el endpoint responde `text/html`**. Debe
responder `200` con `Content-Type: application/json`. El backend ya lo hace
(`res.json`), pero si Render está dormido el timeout también hace fallar la
validación. Mantén el pinger externo activo.

## Prueba local rápida

```bash
# backend corriendo en local
npx tsx backend/scripts/test-webhook.ts order
```

## Checklist

- [ ] Pinger externo activo contra `/health` cada 5 min.
- [ ] URL `.../api/webhook/stereum` guardada en la consola Stereum (validación test = 200).
- [ ] Evento real en Stereum visible en webhook.site o en `WebhookLog`.
- [ ] `WebhookLog` sin `HMAC mismatch` ni `Timestamp expired`.
- [ ] El estado `CANCELADA` actualiza el trade a `expired` en la DB.
