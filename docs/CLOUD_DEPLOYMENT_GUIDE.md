# Cloud Production Deployment Guide
## SwiftCOD: WhatsApp Verify

This guide provides a turnkey 3-step walkthrough to permanently deploy the application to cloud infrastructure (Render.com or Fly.io) and link the production URLs to your Shopify Partners Dashboard.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    Shopify Stores (Buyer Checkouts)  │
                      └──────────────────┬───────────────────┘
                                         │ Orders Webhook (HMAC)
                                         ▼
                      ┌──────────────────────────────────────┐
                      │    Cloud Host (Render / Fly.io)      │
                      │    Node.js 20 Multi-Stage Docker     │
                      │    Port 3000 • Healthcheck /api/health│
                      └──────────┬────────────────┬──────────┘
                                 │                │
            Prisma Connection    │                │ Graph API v21.0
                                 ▼                ▼
┌──────────────────────────────────────┐    ┌──────────────────────────────────┐
│   PostgreSQL (Supabase / Neon DB)    │    │    Meta WhatsApp Cloud API       │
│   Sessions, Orders, Multi-market i18n│    │    Interactive Outbound Messages │
└──────────────────────────────────────┘    └──────────────────────────────────┘
```

---

## Step 1: Connect GitHub & Launch Cloud Web Service

The repository is synchronized at [`currencypanda/shopify-cod-whatsapp`](https://github.com/currencypanda/shopify-cod-whatsapp).

### Option A: Render.com (Recommended)
1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint** (or **Web Service**).
3. Connect repository `currencypanda/shopify-cod-whatsapp` with branch `main`.
4. Render will automatically detect [`render.yaml`](file:///e:/cod-whatsapp-verify/render.yaml).
5. The build and pre-deploy migrations run automatically:
   - Build Command: `npm install && npx prisma generate --schema=prisma/schema.postgresql.prisma && npm run build`
   - Pre-deploy Command: `npx prisma db push --schema=prisma/schema.postgresql.prisma`

### Option B: Fly.io
1. Install Fly CLI: `powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"`
2. Authenticate: `fly auth login`
3. Launch container from workspace:
   ```bash
   fly launch --config fly.toml --copy-config
   fly deploy
   ```

---

## Step 2: Configure Environment Variables

Populate the production environment variables in your cloud provider's dashboard:

| Variable Name | Description | Example / Reference |
|---|---|---|
| `DATABASE_URL` | PostgreSQL pooled connection URL | `postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Direct PostgreSQL connection URL (for migrations) | `postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres` |
| `SHOPIFY_API_KEY` | Shopify App Client ID | `4fcb316262573e0f882e29d1d8013cb0` |
| `SHOPIFY_API_SECRET` | Shopify App Secret Key | `your_shopify_app_secret_here` |
| `SHOPIFY_APP_URL` | Your live custom production domain | `https://swiftcod-whatsapp.onrender.com` |
| `SCOPES` | Required Shopify access scopes | `write_products,read_orders,write_orders,read_customers` |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Business Phone Number ID | `1421299311065349` |
| `WHATSAPP_ACCESS_TOKEN` | Permanent Meta System User Token | `EAA...` (From Meta Business Manager) |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification handshake secret | `my_whatsapp_webhook_verify_token_123` |
| `WHATSAPP_APP_SECRET` | Meta App Secret for HMAC signature check | (From Meta App Dashboard > Basic Settings) |
| `CRON_SECRET` | Secret token to authenticate order expiry cron | `my_cron_secret_token_123` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Listening server port | `3000` |

---

## Step 3: Link Production URL to Shopify Partners & Meta

Once the cloud deployment status is **Active** and passing health check on `/api/health`:

### 1. Update Shopify App Configuration
Update your remote Shopify App registration in one automated command:
```bash
npx shopify app config use
npx shopify app deploy --force
```
Or update `shopify.app.toml`:
```toml
application_url = "https://swiftcod-whatsapp.onrender.com"

[auth]
redirect_urls = [
  "https://swiftcod-whatsapp.onrender.com/api/auth"
]
```
Run `npx shopify app config push` to synchronize URLs directly with the Partners Dashboard.

### 2. Configure Meta Webhook URL
1. Navigate to [Meta for Developers](https://developers.facebook.com) → Your App → **WhatsApp** → **Configuration**.
2. Set Callback URL:
   ```
   https://swiftcod-whatsapp.onrender.com/api/whatsapp/webhook
   ```
3. Set Verify Token: matches `WHATSAPP_VERIFY_TOKEN`.
4. Click **Verify and Save**.
5. Subscribe to Webhook fields: `messages`.

---

## Monitoring & Health Verification

- **Liveness Probe:** `GET https://[YOUR_APP_URL]/api/health` returns HTTP 200:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-13T17:15:00.000Z",
    "version": "1.0.0",
    "service": "cod-whatsapp-verify"
  }
  ```
- **Automated Order Expiration Job:** Set up an external cron ping (e.g. Cron-Job.org, BetterStack, or Render Cron) every 15 minutes:
  ```bash
  curl -X POST https://[YOUR_APP_URL]/api/cron/expire-orders \
    -H "Authorization: Bearer my_cron_secret_token_123"
  ```
