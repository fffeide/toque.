# Toque — puesta en marcha (Cloudflare Workers + D1 + KV)

## 1. Crear la base y el KV (una sola vez)
```
npx wrangler login
npx wrangler d1 create toque-db        # copiá el database_id a wrangler.jsonc
npx wrangler kv namespace create KV    # copiá el id a wrangler.jsonc
npm run db:migrate:remote              # crea las tablas
```

## 2. Secretos y variables
```
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GEMINI_API_KEY      # opcional
```
Variable `PUBLIC_BASE_URL` (en wrangler.jsonc > vars): tu dominio, ej. `https://toque.com.ar`.

**Google OAuth** (console.cloud.google.com > APIs y servicios > Credenciales > ID de cliente OAuth, tipo "Aplicación web"):
URI de redirección autorizada: `https://TU-DOMINIO/api/auth/google/callback`

## 3. Publicar
- Con GitHub conectado a Cloudflare: comando de build `npm run build`, comando de deploy `npx wrangler deploy`.
- Variables de build: `VITE_PUBLIC_SHORT_BASE=https://TU-DOMINIO`.
- Cada cambio de esquema = un archivo nuevo en `migrations/` + `npm run db:migrate:remote`.

## 4. Desarrollo local
```
npm run db:migrate:local
npm run build && npm run dev:api      # Worker + panel en http://localhost:8787
```
