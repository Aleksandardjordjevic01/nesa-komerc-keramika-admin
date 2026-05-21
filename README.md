# apps/admin — Marketplace Admin Panel

Placeholder for the operator-facing admin panel.

## Purpose

This app will provide the admin and moderator interface:
- User management (roles, bans, account lookup)
- Category and attribute management
- Moderation queue (reports, decisions)
- Analytics dashboard
- Promotions management

## Status

**Placeholder — implemented in ETAPA 12 (Admin & Moderation).**

This app exists now to:
1. Reserve `admin` as a separate `apps/` workspace entry.
2. Establish that admin is a distinct app with its own deployment target.
3. Allow independent development and deployment of the admin UI.

## Running

```bash
# From the monorepo root:
npm run dev:admin

# From this directory:
npm run dev
```

The admin panel runs on **http://localhost:3002**.

## What Is Intentionally Not Implemented Yet

- Everything. This is a scaffold placeholder.
- Admin API routes in `apps/api` (ETAPA 12).
- All admin UI pages (ETAPA 12).
