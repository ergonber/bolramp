# Backup: Pre-Stereum Files

This directory contains backup copies of the original (non-Stereum) implementation.

## Files Backed Up

| Original Path | Backup |
|---|---|
| `backend/src/routes/quote.ts` | `backend_quote.ts` |
| `backend/src/routes/qr.ts` | `backend_qr.ts` |
| `backend/src/routes/confirm.ts` | `backend_confirm.ts` |
| `backend/src/routes/index.ts` | `backend_index.ts` |
| `frontend/src/hooks/useQR.ts` | `frontend_hooks_useQR.ts` |
| `frontend/src/lib/api.ts` | `frontend_lib_api.ts` |
| `frontend/src/app/comprar/page.tsx` | `frontend_page.tsx` |
| `frontend/src/components/QRDisplay.tsx` | `frontend_QRDisplay.tsx` |

## Restore Instructions

To revert to the pre-Stereum implementation:

1. Copy the backup files back to their original locations
2. Restore `backend/src/services/openbcb.ts` (if deleted)
3. Restore `backend/src/services/merchant.ts` (if deleted)
4. Restore `backend/src/middleware/auth.ts` (re-add `webhookAuthMiddleware`)
5. Update `backend/src/config/env.ts` (re-add `OPENBCB_*` env vars)
6. Restore `backend/.env` entries (OPENBCB keys)
7. Run `npm run build` in both backend and frontend
8. Run tests: `npm test` (backend)
