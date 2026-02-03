# Bot Warhammer 40k — workspace local (WSL2)

## Prérequis
- Node.js 20+, npm 10 (ou nvm pour gérer les versions)
- Docker + docker compose v2
- WSL2 (Ubuntu) avec accès réseau

## Démarrage rapide (dev)
```bash
cp .env.example .env   # renseigner les tokens Discord + DB/Redis si custom
npm install            # installe les deps workspaces
docker compose -f docker-compose.dev.yml up -d postgres redis
npm run prisma:migrate # crée le schéma Postgres local (prérequis API)
npm run dev:bot        # lance le bot en local (hot reload)
npm run dev:api        # lance l'API (optionnelle) sur :3000
npm run dev --workspace apps/ui   # lance l'UI mock sur :5173 (ou docker compose ui)
```

## Structure
- `apps/bot` : code du bot Discord (discord.js, TS)
- `apps/api` : API/admin Fastify (mock maintenant branché sur Postgres via Prisma)
- `apps/ui` : UI mock React/Vite pour tester flux tournois sans Discord
- `packages/core` : types et logique métier partagée (Swiss minimal)
- `prisma/schema.prisma` : schéma initial (Guild, Tournament) à enrichir
- `docker-compose.dev.yml` : stack Postgres + Redis + services bot/api pour le dev
- `scripts/setup.sh` : bootstrap VPS (outils/hardening)

## Notes
- En dev, les commandes slash sont enregistrées soit globalement soit sur la guild `DEV_GUILD_ID` si définie.
- Pense à lancer `npx prisma generate` après avoir installé Prisma et configuré `DATABASE_URL`.
