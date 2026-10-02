# Checklist de Producción — Bolramp (MainNet)

Antes de mover dinero real, verificar cada punto.

## 1. Stereum (consola MainNet)
- [ ] API key **"Bolramp"** activa (MainNet).
- [ ] Webhook de la key = `https://bolramp.onrender.com/api/webhook/stereum`
      (validación `test` responde `200 application/json`).
- [ ] Scopes habilitados: **API FX**, **API Transacciones**, **API Banks**.
- [ ] Entrega de USDC en **POLYGON mainnet** confirmada con Stereum.
- [ ] Notificación de **`COMPLETADA`** de prueba solicitada a Stereum/Ricardo.
- [ ] Algoritmo/clave de firma de las notificaciones `order` confirmado por Stereum.

## 2. Render (backend)
- [ ] `STEREUM_API_KEY` = key de MainNet.
- [ ] `STEREUM_WEBHOOK_SECRET` = SecretKey de MainNet.
- [ ] `STEREUM_WEBHOOK_INSECURE` = `false`  ⚠️ (estricto en producción)
- [ ] `NODE_ENV` = `production`
- [ ] `STEREUM_MOCK_KYC` = `false`
- [ ] `CHAIN_ID` = `137`
- [ ] `POLYGON_RPC_URL` = RPC de Polygon mainnet
- [ ] `API_KEY` y `JWT_SECRET` = cadenas aleatorias fuertes
- [ ] `OPERATOR_PRIVATE_KEY` rotada
- [ ] `CORS_ORIGINS` = dominio(s) de producción
- [ ] `DATABASE_URL` = base de producción (idealmente nueva)

## 3. Base de datos (Neon)
- [ ] Decidir: misma DB o nueva para producción.
- [ ] Si es nueva: crear proyecto/branch en Neon y setear `DATABASE_URL`.
- [ ] Crear el esquema (`prisma db push` o aplicar migraciones).
- [ ] Ejecutar `backend/prisma/manual/20261002_reset_kyc_for_mainnet.sql`
      (los `stereumCustomerId` de TestNet no valen en MainNet).

## 4. Frontend (Vercel)
- [ ] `NEXT_PUBLIC_CHAIN_ID` = `137`
- [ ] `NEXT_PUBLIC_API_URL` = URL del backend
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` configurado
- [ ] Redeploy con el build nuevo (sin USDT/LP del demo viejo)
- [ ] Links de explorer apuntan a Polygonscan mainnet

## 5. Seguridad
- [ ] Secretos rotados (los que se compartieron por chat/repo).
- [ ] `simulate-payment` deshabilitado en producción.
- [ ] Confirmar que `/api/webhook/stereum` valida firma (no `insecure`).
- [ ] `JWT_SECRET` y `API_KEY` fuera del repo.

## 6. Prueba con dinero real (monto mínimo)
- [ ] Hacer UNA compra pequeña real.
- [ ] Verificar: QR → pago → webhook `COMPLETADA` → USDC en wallet.
- [ ] Verificar en `GET /api/webhook/stereum/logs` que la firma **validó**.
- [ ] Verificar que el trade quedó `released` en la DB/UI.

## 7. Redes de seguridad
- [ ] Expiración local activa (job cada 2 min) — trades no quedan `pending`.
- [ ] Monitoreo de errores (Sentry) y alertas de balance.
- [ ] Keep-alive de Render activo (GitHub Actions cada 5 min).
