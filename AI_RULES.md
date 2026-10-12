# Project: Shopify COD & WhatsApp Verification SaaS
## Tech Stack:
- Framework: Remix (Shopify App Official Template)
- Language: TypeScript (Strict mode, no 'any')
- Database: SQLite (Local Dev) / PostgreSQL via Prisma ORM
- APIs: Shopify Admin GraphQL API, Meta WhatsApp Cloud API

## Coding Standards & Architectural Boundaries:
1. NEVER use the deprecated Shopify REST API. Exclusively use GraphQL Admin API.
2. Webhooks must ALWAYS return HTTP 200 within 2 seconds. Any heavy lifting or third-party API calls must happen asynchronously.
3. Modular service architecture: Keep code clean inside `app/services/` (e.g., `shopify.server.ts`, `whatsapp.server.ts`).
4. Handle phone number normalization strictly (E.164 format with country code) before passing to WhatsApp API.