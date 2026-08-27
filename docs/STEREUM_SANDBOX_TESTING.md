# Stereum Sandbox — Guia de Testing Onramp

## Datos de Cuenta Sandbox

```
API Key:        ccc04e49-5306-4201-a1b6-5f7d79310319
Base URL:       https://api.stereum.tech
Console:        https://console.stereum.tech
```

## Estado de APIs Verificadas (20/08/2026)

| API | Endpoint | Estado | Notas |
|-----|----------|--------|-------|
| Bancos | `GET /api/v1/banks?country=BO` | OK 200 | 57 entidades |
| SEGIP | `POST /api/v1/segip/validate` | OK 200 | Validacion identidad |
| Customer | `POST /api/v1/customers/create` | OK 201 | Registro KYC |
| Quote | `POST /api/v1/otc/quotes` | OK 201 | Cotizacion BUY |
| Order | `POST /api/v1/otc/orders` | OK 201 | Ricardo fixed INTERNAL_ERROR on TestNet (25/08/2026) |
| Balance | `GET /api/v1/business-accounts/{ID}/balance` | 404 | Necesita ACCOUNT_ID real |
| Webhook | `POST /api/webhook/stereum` | OK | HMAC-SHA256 validation |

## Flujo Completo de Testing

### Paso 1: Registrar Cliente (KYC)

```bash
curl -X POST https://api.stereum.tech/api/v1/customers/create \
  -H "x-api-key: ccc04e49-5306-4201-a1b6-5f7d79310319" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NOMBRE",
    "lastname": "APELLIDO",
    "document_type": "CI",
    "document_number": "1234567",
    "country": "BO",
    "state_of_residence": "BO_S",
    "economic_activity": "Tecnologia y software",
    "source_of_funds": "Ahorro personal",
    "destination_of_funds": "Inversion",
    "income_level": "$500 - $1,000",
    "doc_provider_id": "SEIP-003",
    "idempotency_key": "wallet-address"
  }'
```

Response 201:
```json
{
  "id": "UUID-DEL-CLIENTE",
  "name": "NOMBRE",
  "contracted_services": "QR"
}
```

### Paso 2: Validar SEGIP (Opcional en mock)

```bash
curl -X POST https://api.stereum.tech/api/v1/segip/validate \
  -H "x-api-key: ccc04e49-5306-4201-a1b6-5f7d79310319" \
  -H "Content-Type: application/json" \
  -d '{
    "givenNames": "NOMBRE",
    "surname1": "APELLIDO",
    "birthdate": "15/03/1990",
    "dniType": "CI",
    "documentNumber": "1234567"
  }'
```

Response 200:
```json
{
  "status": "VERIFIED",
  "fields": { "givenNames": "CORRECT", "surname1": "CORRECT", ... },
  "validationId": 12345
}
```

### Paso 3: Crear Cotizacion (Quote)

```bash
curl -X POST https://api.stereum.tech/api/v1/otc/quotes \
  -H "x-api-key: ccc04e49-5306-4201-a1b6-5f7d79310319" \
  -H "Content-Type: application/json" \
  -d '{
    "externalUserId": "wallet-address-o-customer-id",
    "side": "BUY",
    "inputAmount": 100.00,
    "inputCurrency": "BOB",
    "outputCurrency": "USDC",
    "country": "BO"
  }'
```

Response 201:
```json
{
  "id": "QUOTE-UUID",
  "pair": "BOB_USDC",
  "side": "BUY",
  "inputAmount": 100.00,
  "outputAmount": 8.43,
  "outputCurrency": "USDC",
  "exchangeRate": 11.65,
  "serviceFee": 1.80,
  "expiresInSeconds": 59
}
```

**IMPORTANTE:** La cotizacion expira en 59 segundos. Confirmar inmediatamente.

### Paso 4: Confirmar Orden (Genera QR)

```bash
curl -X POST https://api.stereum.tech/api/v1/otc/orders \
  -H "x-api-key: ccc04e49-5306-4201-a1b6-5f7d79310319" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "unique-order-id",
    "quoteId": "QUOTE-UUID",
    "outputNetwork": "POLYGON",
    "outputAccountAddress": "0xWALLET_ADDRESS"
  }'
```

Response 201:
```json
{
  "id": "ORDER-UUID",
  "status": "PENDIENTE",
  "outputAmount": 8.43,
  "paymentInstructions": {
    "amount": 100.00,
    "currency": "BOB",
    "network": "CSL",
    "qrBase64": "...",
    "expiresAt": 1787241932429
  }
}
```

**NOTA:** Orders ahora funciona en TestNet. Ricardo (Stereum CTO) corrigio el INTERNAL_ERROR el 25/08/2026.

### Paso 5: Webhook (Stereum notifica pago)

Stereum envia POST a tu webhook con:

```json
{
  "notification_type": "order",
  "id": "ORDER-UUID",
  "timestamp": 1787241932429,
  "order": {
    "id": "ORDER-UUID",
    "status": "COMPLETADA",
    "side": "BUY",
    "input_amount": 100,
    "output_amount": 8.43,
    "exchange_rate": 11.65,
    "pair": "BOB_USDC"
  }
}
```

Headers de seguridad:
- `x-signature`: HMAC-SHA256(apiKey, timestamp.body)
- `x-timestamp`: Unix timestamp (segundos)

Validar:
1. Verificar firma HMAC
2. Verificar timestamp < 2 minutos
3. Si `notification_type == "test"`, responder 200 sin procesar

## Cuentas de Test Documentadas

### Cliente Registrado
```
Customer ID:     e691a5b4-30d0-483b-ac60-efe04f5d779d
Nombre:          ERNESTO MAMANI
CI:              9876543
Idempotency Key: onramp-ernesto-001
```

### Wallet de Test
```
Direccion:       0xB141d6c0a380D852DE407fD5860646F4e488E9A6
Red:             Polygon Amoy (80002)
Contrato:        0xAB9f59F88A8762698486aeEBf775cb15C11ad36D
```

## Cuentas Pendientes de Obtener de Stereum

- [ ] **ACCOUNT_ID** de la cuenta empresarial (para consultar saldo)
- [ ] **Cuenta con saldo BOB** en sandbox (para que orders funcione)
- [ ] **Webhook URL** configurada en consola Stereum
- [x] **SECRET_KEY** para validacion HMAC del webhook → `STEREUM_WEBHOOK_SECRET` en .env

## Error Comun

### INTERNAL_ERROR en /api/v1/otc/orders (RESUELTO 25/08/2026)
```
{"code":"INTERNAL_ERROR","message":"La transaccion fallo debido a un error interno"}
```
**Causa original:** La cuenta empresarial no tenia saldo BOB, o la wallet no estaba habilitada para POLYGON.
**Estado:** Ricardo (Stereum CTO) corrigio el problema en TestNet. Orders ahora funciona correctamente.

### USER_KYC_REQUIRED en /api/v1/otc/orders
```
{"code":"USER_KYC_REQUIRED","message":"Informacion de cumplimiento no completado"}
```
**Causa:** El externalUserId no tiene cliente registrado.
**Solucion:** Ejecutar Paso 1 (registrar cliente) antes de crear orden.
