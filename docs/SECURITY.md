# Security Documentation — Onramp BOB→USDC

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Threat Model](#threat-model)
3. [Backend Security](#backend-security)
4. [Frontend Security](#frontend-security)
5. [Emergency Procedures](#emergency-procedures)
6. [Key Management](#key-management)
7. [Monitoring & Alerts](#monitoring-alerts)
8. [Changelog](#changelog)

---

## Architecture Overview

```
User (Browser)
    ↓ HTTPS
Frontend (Next.js)
    ↓ API calls + x-api-key
Backend (Node.js + Express)
    ↓ Stereum API
Stereum (KYC + Payments)
    ↓ Polygon RPC
USDC on Polygon
```

**Trust boundaries:**
- Frontend ↔ Backend: API key or JWT authentication
- Backend ↔ Stereum: HMAC webhook signature + API key
- Backend ↔ Polygon: OPERATOR private key signs transactions

---

## Threat Model

### Actors
| Actor | Access | Incentive |
|-------|--------|-----------|
| User | Frontend only | Buy USDC at fair rate |
| OPERATOR | Backend | Earn platform fee |
| Admin | Backend + auth | System administration |
| Attacker | Any | Steal funds, grief users |

### Assets
- OPERATOR private key
- User PII (KYC data)
- Stereum API key
- JWT secret

---

## Backend Security

### Authentication
| Mechanism | Usage | Notes |
|-----------|-------|-------|
| API key (`x-api-key`) | All protected endpoints | Compared with `crypto.timingSafeEqual` |
| JWT (`Authorization: Bearer`) | User actions (KYC reset) | HMAC-SHA256 signed, 32+ char secret |
| HMAC signature | Stereum webhook | `HMAC-SHA256(secret, rawBody)` with timestamp freshness check |

### Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 60/min | Per IP |
| Quote | 30/min | Per IP |
| QR Generate | 10/min | Per IP |
| KYC validate/register | 10/min | Per IP |
| KYC reset | 3/min | Per IP |
| Webhook | 100/min | Per IP |

### Endpoint Protection
| Endpoint | Auth | Rate Limit | Notes |
|----------|------|------------|-------|
| `POST /api/trade/:id/simulate-payment` | API key/JWT | General | Disabled in prod unless `SIMULATE_PAYMENTS=true` |
| `POST /api/kyc/reset` | API key/JWT + wallet ownership | 3/min | Requires JWT wallet match or API key |
| `POST /api/kyc/validate` | None (public) | 10/min | Zod validated |
| `POST /api/kyc/register` | None (public) | 10/min | Zod validated |
| `POST /api/webhook/stereum` | HMAC signature | 100/min | Raw body capture for HMAC |
| `GET /api/admin/status` | API key/JWT | General | Admin only |

### Data Validation
- Zod schemas for ALL inputs (body, query, params)
- SQL injection prevented by Prisma ORM
- No raw SQL queries

### Secrets Management
| Secret | Required | Notes |
|--------|----------|-------|
| `JWT_SECRET` | Always | Min 32 chars, no default — server fails to start if missing |
| `API_KEY` | Always | No default |
| `OPERATOR_PRIVATE_KEY` | Always | Min 64 chars |
| `STEREUM_API_KEY` | Always | Redacted in all docs |
| `STEREUM_WEBHOOK_SECRET` | Optional | For HMAC validation |

### Error Handling
- Production: generic error messages only (no stack traces, no internal details)
- Development: full error messages for debugging
- All errors logged server-side with `pino`

### CORS
- Restricted to `CORS_ORIGINS` env var (comma-separated origins)
- Default: `http://localhost:3000` (development only)
- Production: must be explicitly set to frontend domain

---

## Frontend Security

### Input Validation
- Client-side validation before API calls
- Server-side validation (defense in depth)
- Amount limits: min 1 USDC, max 100,000 USDC

### Wallet Security
- RainbowKit handles wallet connection
- No private keys stored in frontend
- Verify chain ID matches Polygon

---

## Emergency Procedures

### KYC Reset
1. User requests reset via `POST /api/kyc/reset`
2. Requires authentication (JWT wallet match or API key)
3. KYC status set to "pending"
4. User must re-validate identity

### Key Rotation
1. Generate new secrets
2. Update environment variables
3. Restart backend
4. Update webhook secret in Stereum dashboard

---

## Key Management

### OPERATOR Key
- **Purpose:** Signs release transactions on Polygon
- **Storage:** Environment variable
- **Rotation:** After any suspected compromise

### JWT Secret
- **Purpose:** Signs user JWT tokens
- **Storage:** Environment variable
- **Minimum:** 32 characters
- **Rotation:** Quarterly

### API Key
- **Purpose:** Backend authentication
- **Storage:** Environment variable
- **Rotation:** After any suspected compromise

---

## Monitoring Checklist

### Backend
- [ ] API response times
- [ ] Error rates (5xx)
- [ ] Failed auth attempts
- [ ] Rate limit hits
- [ ] Webhook delivery success

### Business
- [ ] Daily trading volume
- [ ] KYC completion rate
- [ ] Average trade size

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-15 | Initial security review |
| 2025-01-15 | Added LP_ADMIN_ROLE to depositUSDT |
| 2025-01-15 | Restricted expireTrade to OPERATOR |
| 2025-01-15 | Added idempotency to webhook |
| 2026-09-21 | **Security hardening:** timingSafeEqual for API key/JWT |
| 2026-09-21 | **JWT_SECRET mandatory** — no insecure default, min 32 chars |
| 2026-09-21 | **simulate-payment** protected — auth required, disabled in prod by default |
| 2026-09-21 | **kyc/reset** protected — auth + wallet ownership required |
| 2026-09-21 | **KYC rate limiting** — validate/register 10/min, reset 3/min |
| 2026-09-21 | **Error messages** sanitized in production — no stack leaks |
| 2026-09-21 | **Webhook HMAC** — raw body capture, two-variant tolerance, timestamp freshness |
| 2026-09-21 | **CORS** restricted to explicit origins via CORS_ORIGINS env |
