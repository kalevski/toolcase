# server/

Server-side layering for Perch (mirrors TaskForge). Request flow, top to bottom:

```
app/api/**/route.ts   thin HTTP handlers — authorize(minRole) then call a service
  └─ server/services/        policy / business rules (server-only)
       └─ server/data/repositories/   raw-SQL access, one file per table (server-only)
            └─ server/data/db.ts       single cached node:sqlite connection (WAL + migrations)
server/domain/         pure shared types — safe to import from client AND server
```

Rules:

- Every module under `services/` and `data/` begins with `import 'server-only'` so
  it can never be bundled into a client component.
- `domain/` holds **pure** types only — no `server-only`, no I/O — so client code
  may import them too.
- `data/db.ts` is the single owner of the `node:sqlite` `DatabaseSync` handle
  (cached on `globalThis`, WAL mode, append-only ordered `MIGRATIONS[]`), ported
  from TaskForge with a fresh §12 schema as migration `v1`. No services, auth, or
  repositories exist yet. See `notes/static-hosting-app-design.md` §3, §5, §12 for
  the target architecture.
