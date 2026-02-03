# API mock (Prisma + Postgres)

Endpoints:
- `POST /tournaments` {name, timezone}
- `POST /tournaments/:id/players` {name, faction?}
- `POST /tournaments/:id/rounds/generate`
- `GET /health`

Pré-requis : Postgres dispo (voir docker-compose.dev.yml) et migrations appliquées.

Run dev :
```bash
npm install
npm run prisma:migrate   # à la racine, une fois
npm run dev --workspace apps/api
```
