# Bot Discord Tournoi Warhammer 40 000 — Étude et Plan

Date : 2 février 2026  
Périmètre : application conteneurisée (Docker) fournissant un bot Discord pour l’organisation et le suivi de tournois Warhammer 40 000.

---

## Partie A — Cadre & conception (théorique)

### 1) Objectifs et valeur
- Interface Discord-first pour créer, paramétrer et piloter des tournois (Maelstrom/ITC/WTC, 1v1).
- Automatisation des appariements, saisie/validation des scores, classements, annonces de round.
- Mini back-office web optionnel pour l’administration avancée et les exports (CSV/ITS).

### 2) Faisabilité
- **Technique :** faisable via API Discord (slash commands + components). Pairings Swiss/round-robin + persistance classiques. Rate limits gérables via queue/cache.
- **Opérationnelle :** configuration par serveur (guild), droits « Manage Guild ». Besoin d’hébergement en ligne + monitoring.
- **Juridique :** ToS Discord, RGPD (IDs/pseudos, éventuels emails), consentement, purge des données. Hébergement UE recommandé.
- **Coût MVP :** 1 host 2 vCPU / 2–4 Go RAM + Postgres + Redis. ~15–40 $/mois.

### 3) Contraintes clés
- Rate limits Discord, intents Gateway (GUILDS, GUILD_MESSAGES, GUILD_MEMBERS partiel).
- Résilience WS (heartbeat/reconnect), idempotence commandes.
- Cohérence forte pour rounds/pairings (transactions).
- UTC + TZ tournoi pour horaires/rappels.
- Principe du moindre privilège (scopes, permissions).

### 4) Organisation projet
- Phases : Découverte & modèle → POC bot+DB → MVP Swiss+annonces → Beta privée → Prod + observabilité.
- Rôles : dev backend/bot, QA/testeur, référent règles; UX optionnel.
- Cadre : Git/PR, CI lint/test, release par tags Docker, SemVer.

### 5) Stack recommandée
- Node.js 20 LTS + TypeScript 5.x.
- SDK : `discord.js` v14+ (slash/embeds/components).
- HTTP : Fastify (ou Express minimal) pour API/admin.
- DB : PostgreSQL 15+, ORM Prisma (+ migrations).
- Cache/queue : Redis + BullMQ.
- Tests : Vitest/Jest, supertest/Pact pour API, sandbox Discord pour intégration.
- Observabilité : pino/Winston JSON, prom-client, Grafana/Prometheus, traces OTEL optionnelles.

### 6) Architecture (vue d’ensemble)
- Composants : Bot Worker (Gateway), API/Admin (optionnelle), Postgres, Redis (cache/queue), Scheduler.
- Flux : Interaction → validation → traitement transactionnel → events internes → réponses embeds/threads.
- Modèle MVP : Guild, Tournament, Player, Round, Pairing, Standing, Table, Mission, AuditLog.
- Scalabilité : bot stateless + locks Redis ; sharding si >2 500 guilds; backups réguliers.

### 7) Scénarios métier (nomenclature et données manipulées)
1. **CréationTournoi** — nom, dates (début/fin), fuseau horaire, lieu, capacité, format (solo/équipe), lien règlement, rounds (code GW/mission/déploiement), planning, frais.  
2. **PublicationTournoi** — canaux (Discord/embed/annonce), visibilité, lien d’inscription, code d’accès éventuel.  
3. **InscriptionJoueur** — joueur (pseudo+ID Discord), nom, faction, email (opt), statut inscription (pending/validée), paiement (montant/statut), contraintes (équipe/club), commentaire.  
4. **ValidationPaiement** — réf paiement, statut, validateur, horodatage.  
5. **SoumissionListe** — lien/fichier liste, format, statut (soumise/acceptée/refusée), motif refus, version, horodatage.  
6. **GelListes** — date/heure de gel, portée, verrouillage modifs, publication listes validées.  
7. **GestionCapacité** — nb max, liste d’attente, auto-promotion, délais de réponse.  
8. **CheckInJourJ** — présence, heure d’arrivée, table initiale (opt), remarques.  
9. **GénérationRounds** — round courant, joueurs actifs, seed, règles pairing (suisse/évitements/club/déjà rencontrés), tables.  
10. **PublicationPairings** — round, pairings (table, joueur A/B), canaux de diffusion, horaires.  
11. **SaisieScores** — scores primaires/secondaires, W/D/L, validation double, horodatage.  
12. **ClassementIntermediaire** — standings round N, tie-breakers (SoS, VP, BP, peinture), exports.  
13. **AppelArbitre** — round, table, motif, statut, décision, pénalités.  
14. **GestionPénalités** — joueur, type (warning/game loss/DQ), motif, round, historique.  
15. **GestionForfaits** — drop avant/après round, impact pairings suivants (bye/removal), impact classement.  
16. **PrixEtRécompenses** — podium, prix peinture/fun, lots, critères, montants.  
17. **ClôtureTournoi** — validation finale, publication résultats, archivage listes, exports finaux.  
18. **StatistiquesPostEvent** — stats faction, taux de victoire, perfs par ronde, temps moyen, retours joueurs.  
19. **NotificationsEtRappels** — rappels deadlines, annonces pairings, changements de table, appels arbitre, push Discord.  
20. **AdministrationUtilisateurs** — rôles staff (orga/arbitre/scorekeeper), droits par scénario, audit log.  

**Répartition par profil**
- Scénarios destinés aux admins (orga/arbitres) : CréationTournoi, PublicationTournoi, ValidationPaiement, GelListes, GestionCapacité, CheckInJourJ, GénérationRounds, PublicationPairings, SaisieScores (mode staff), ClassementIntermediaire, AppelArbitre (traitement), GestionPénalités, GestionForfaits, PrixEtRécompenses, ClôtureTournoi, StatistiquesPostEvent, NotificationsEtRappels (paramétrage), AdministrationUtilisateurs.
- Scénarios utilisables par les joueurs (les admins y ont aussi accès) : InscriptionJoueur, SoumissionListe, SaisieScores (auto-saisie si autorisée), AppelArbitre (ouverture d’un ticket), Consultation des pairings/standings via NotificationsEtRappels.
### 7) Risques, parades, plans et comparaisons
- **Policies Discord / intents**  
  - S1 Intents minimaux + mode dégradé : limiter à GUILDS/GUILD_MESSAGES (+MEMBERS partiel), flag fallback REST, tests intents réduits. Gain : moins exposé aux changements.  
  - S2 Veille + tests e2e Gateway : job hebdo changelog/status, suite e2e shard test, revue trimestrielle scopes. Gain : détection précoce, dépend veille.
- **Tie-breakers spécifiques**  
  - S1 Règles configurables : table `tiebreak_rule`, service paramétré, fixtures ITC/WTC, commande `/tournament set-tiebreakers`. Gain : simplicité cas courants.  
  - S2 Plugins/config tournoi : loader d’extensions JS/TS validé schema, tests scénarios arbitres. Gain : extensibilité forte, plus de maintenance.
- **Pairings drop/bye & cas hors scope**  
  - S1 Support natif drop/bye : règle bye, flag `dropped_at`, tests impairs. Gain : automatisation cas fréquents.  
  - S2 Override manuel loggé : commande `/round override`, UI admin, verrous. Gain : couvre cas exotiques (teams/2v2) sans bloquer.
- **Rappels horaires**  
  - S1 Jobs BullMQ + watchdog : jobs répétés UTC, dédup, métriques délais. Gain : autosuffisant in-cluster.  
  - S2 Timers systemd/cron hôte : timer qui ping l’API, alerting syslog/mail. Gain : horloge hôte stable, hors Docker.
- **Perte/corruption données**  
  - S1 Backups pg_dump chiffrés + restore test mensuel. Gain : rapide à mettre, restauration simple.  
  - S2 WAL archiving + observabilité DB : wal_level=replica, archive_command, alertes. Gain : RPO/RTO courts, plus complexe.
- **Performance en pic**  
  - S1 Queue interactions + cache état tournoi : worker async, réponses différées, cache standings/round. Gain : traite le goulot directement.  
  - S2 Charge tests + métriques/alertes : k6/Artillery, prom P95/99, alertes Grafana. Gain : prévention/régression, ne suffit pas seul.

---

## Partie B — Mise en œuvre pratique

### B0) Préparation espace de travail (VPS OVH + Saltbox)
- OS à jour, cgroup v2, swap 2–4 Go, kernel ≥ 5.10.
- Toolbox : Docker Engine ≥24 + compose v2, git, make/just, jq, curl, rsync, htop, lsof, direnv (ou doppler/1password-cli), python3-pip/pipx, trivy, skopeo, buildx. Proxy : Caddy/Traefik ou proxy Saltbox + réseau `bot_proxy`.
- Sécurité rapide : ufw/nftables (si compatible Saltbox), fail2ban SSH, unattended-upgrades, rotation logs Docker (json-file 10m x3).
- Répertoires : `/opt/bot-warhammer/{bot,api}/`, `/opt/bot-warhammer/data/{postgres,redis,backups}/`. Séparer du stack Saltbox.
- Observabilité locale : cAdvisor/node-exporter si Prometheus déjà présent; sinon petit stack prometheus+grafana ou dozzle pour logs.

### B0bis) Référentiel GitHub
- Créer un repo GitHub privé (ex. `github.com/<org>/bot-warhammer`) et y pousser le monorepo actuel.
- Activer protections de branche sur `main` (PR obligatoires, CI verte, pas de force-push).
- Secrets GitHub Actions (si CI) : `DISCORD_TOKEN`, `APP_ID`, `PUBLIC_KEY`, `DATABASE_URL`, `REDIS_URL`, `OPENSSL_LEGACY_PROVIDER=1` si nécessaire.
- Ignorer `node_modules`, `dist`, `.env*` (déjà couvert par `.gitignore`).
- Option : labels/Projects pour suivre la checklist B6 et la roadmap MVP.

### B1) Dockerisation (esquisse)
- Monorepo avec workspaces `bot`, `api`, `ui`, `packages/core`.
- `docker-compose.dev.yml` (dev) : services `bot`, `api`, `ui`, `postgres`, `redis` ; `api`/`ui` consomment `packages/core` buildé dans l’image.
- Images Node 20-slim avec `openssl` installé et Prisma `binaryTargets ["native","debian-openssl-1.1.x","debian-openssl-3.0.x"]`.
- `.dockerignore` pour exclure `node_modules`, `dist`, `.git` afin de réduire le contexte et le temps de build.

### B2) Sécurité
- Secrets : variables d’env (.env ignoré ou secrets manager), rotation périodique tokens Discord.
- Trafic : TLS via reverse proxy; filtrage IP optionnel pour l’admin.
- WAF : Nginx + ModSecurity/CRS ou Traefik + plugin WAF pour toute surface HTTP publique (API/admin/webhook). Pour endpoint Discord seul : signature + rate limit IP peuvent suffire.
- Réseau Docker : réseau dédié `bot_proxy`; ne pas exposer Postgres/Redis.
- Hardening hôte : fail2ban SSH, ufw/nftables si compatible Saltbox, rotation logs Docker, mises à jour auto.
- Application : scopes/permissions minimaux, validation stricte, rate limiting user/guild, idempotence commandes.
- Sauvegardes : pg_dump chiffré + tests de restore; WAL archiving optionnel pour RPO court.

### B3) Conformité & données
- RGPD : minimiser PII (IDs Discord, pseudos), message d’information/consentement, commande de purge.
- Localisation : hébergement UE/FR (OVH), volumes chiffrés au repos.
- Journalisation : logs sans données sensibles, rétention configurable.

### B4) Tests & qualité
- Lint ESLint + format Prettier.
- Unitaires pairings/standings; fixtures WTC/ITC.
- Intégration sandbox Discord (guild de staging) avec commandes mockées.
- CI : npm ci → lint → test → build → image Docker → scan Trivy → push registry.

### B5) Roadmap MVP (indicative)
- S1 : setup repo, docker-compose, app Discord, `/ping`, modèle de données, migrations.
- S2 : création tournoi, inscriptions, Round 1 Swiss simple, saisie scores, classement; UI mock pour valider les flux sans Discord.
- S3 : annonces auto, rappels, exports CSV, observabilité de base.
- S4 : bêta privée, feedback, durcissement rate limits, doc utilisateur.

### B6) Prochaines actions recommandées (checklist livrables)
- [ ] Créer l’application Discord et récupérer `APP_ID`, `PUBLIC_KEY`, `BOT_TOKEN`.
- [ ] Pousser le monorepo sur GitHub privé avec protections de branche et secrets Actions.
- [x] Écrire le schéma Prisma et exécuter les migrations initiales.
- [x] Mettre en place `docker-compose.dev` avec Postgres + Redis + API/UI/Bot.
- [x] Implémenter `/tournament create` + génération Swiss et UI mock pour saisie rapide.
- [ ] Scénarios e2e Discord (guild de staging) + alerting basique.

### B7) État actuel (dev Docker) et données de test
- Nom du bot : **Cogitator**.
- Services : `docker compose -f docker-compose.dev.yml up -d postgres redis api ui bot` (ports : API 3000, UI 5173, Postgres 5432, Redis 6379). 
- Exemple front : bouton « Charger l’exemple week-end » remplit le formulaire avec le scénario fourni (5 rounds + planning + règlement).
- Données déjà injectées via l’API (IDs utilisables pour tests de mise à jour) :
  - SCENARIO DU WEEKEND — `88612991-e775-48f7-b6e1-914d68e33403`
  - Beta interne — `db08dc1b-0b0a-4c8f-a9c8-c6e6a458fc63`
  - Draft ITC — `0360c611-c280-4967-9023-e762ee4012c9`
- Secrets à renseigner pour Discord (env ou secrets CI/CD) : `DISCORD_TOKEN`, `APP_ID`, `PUBLIC_KEY`, `DEV_GUILD_ID`.
