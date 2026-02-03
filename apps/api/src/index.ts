// @ts-nocheck
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { Player, Round, generateSwissRound } from '@bot-warhammer/core';
import { prisma } from './prisma';

const port = parseInt(process.env.API_PORT ?? '3000', 10);
const host = process.env.API_HOST ?? '0.0.0.0';

const app = Fastify({ logger: true });
app.register(cors, { origin: true });

const tournamentSchema = z.object({
  name: z.string().min(1),
  timezone: z.string().min(1),
  rulesUrl: z.string().url().optional(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  rounds: z
    .array(
      z.object({
        round: z.number().int().positive(),
        code: z.string(),
        primary: z.string(),
        deployment: z.string()
      })
    )
    .optional(),
  schedule: z.any().optional()
});

app.get('/health', async () => ({ status: 'ok' }));

app.post('/tournaments', async (req, reply) => {
  const parsed = tournamentSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send(parsed.error);

  const data = parsed.data;
  const t = await prisma.tournament.create({
    data: {
      name: data.name,
      timezone: data.timezone,
      rulesUrl: data.rulesUrl,
      location: data.location,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      capacity: data.capacity,
      roundsJson: data.rounds ? data.rounds : undefined,
      scheduleJson: data.schedule ? data.schedule : undefined
    }
  });
  return t;
});

app.post('/tournaments/:id/players', async (req, reply) => {
  const tId = req.params['id'];
  const body = z
    .object({
      name: z.string().min(1),
      faction: z.string().optional(),
      pseudo: z.string().optional(),
      discordId: z.string().optional(),
      status: z.enum(['PENDING', 'VALIDATED']).optional(),
      listStatus: z.enum(['LIST_WAITING', 'LIST_ACCEPTED', 'LIST_REFUSED', 'LIST_NOT_SUBMITTED']).optional(),
      paymentStatus: z.enum(['PAYMENT_PENDING', 'PAYMENT_ACCEPTED']).optional()
    })
    .safeParse(req.body);
  if (!body.success) return reply.code(400).send(body.error);

  const tournament = await prisma.tournament.findUnique({ where: { id: tId } });
  if (!tournament) return reply.code(404).send({ message: 'Tournament not found' });

  await prisma.player.create({
    data: {
      name: body.data.name,
      faction: body.data.faction,
      pseudo: body.data.pseudo,
      discordId: body.data.discordId,
      status: body.data.status ?? 'PENDING',
      listStatus: body.data.listStatus ?? 'LIST_NOT_SUBMITTED',
      paymentStatus: body.data.paymentStatus ?? 'PAYMENT_PENDING',
      tournamentId: tId
    }
  });

  const players = await prisma.player.findMany({ where: { tournamentId: tId }, orderBy: { createdAt: 'asc' } });
  return players;
});

// inscription self-service (opt-in joueur)
app.post('/tournaments/:id/register', async (req, reply) => {
  const tId = req.params['id'];
  const body = z
    .object({
      name: z.string().min(1),
      discordId: z.string().optional(),
      pseudo: z.string().optional(),
      faction: z.string().optional()
    })
    .safeParse(req.body);
  if (!body.success) return reply.code(400).send(body.error);

  const tournament = await prisma.tournament.findUnique({ where: { id: tId } });
  if (!tournament) return reply.code(404).send({ message: 'Tournament not found' });

  const player = await prisma.player.create({
    data: {
      name: body.data.name,
      pseudo: body.data.pseudo,
      faction: body.data.faction,
      discordId: body.data.discordId,
      status: 'PENDING',
      listStatus: 'LIST_NOT_SUBMITTED',
      paymentStatus: 'PAYMENT_PENDING',
      tournamentId: tId
    }
  });

  return player;
});

app.post('/tournaments/:id/rounds/generate', async (req, reply) => {
  const tId = req.params['id'];
  const tournament = await prisma.tournament.findUnique({
    where: { id: tId },
    include: {
      players: { where: { active: true }, orderBy: { createdAt: 'asc' } },
      rounds: true
    }
  });
  if (!tournament) return reply.code(404).send({ message: 'Tournament not found' });

  const roundData = generateSwissRound({
    id: tournament.id,
    name: tournament.name,
    timezone: tournament.timezone,
    players: tournament.players as Player[],
    rounds: tournament.rounds.map(
      (r): Round => ({
        number: r.number,
        pairings: []
      })
    )
  });

  const createdRound = await prisma.round.create({
    data: {
      tournamentId: tId,
      number: roundData.number,
      pairings: {
        create: roundData.pairings.map((p) => ({
          table: p.table,
          playerAId: p.playerA,
          playerBId: p.playerB ?? null
        }))
      }
    },
    include: { pairings: true }
  });

  return createdRound;
});

// listing des tournois avec filtres (inscrit / non inscrit et à venir)
app.get('/tournaments', async (req, reply) => {
  const now = new Date();
  const q = req.query as Record<string, string | undefined>;

  const where: any = {};

  if (q.future === 'true') {
    where.startDate = { gte: now };
  }

  if (q.registeredDiscordId) {
    where.players = { some: { discordId: q.registeredDiscordId } };
  } else if (q.notRegisteredDiscordId) {
    where.players = { none: { discordId: q.notRegisteredDiscordId } };
  }

  const tournaments = await prisma.tournament.findMany({
    where,
    orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      players: {
        select: { id: true, discordId: true }
      }
    }
  });

  return tournaments.map((t) => ({
    id: t.id,
    name: t.name,
    startDate: t.startDate,
    endDate: t.endDate,
    capacity: t.capacity,
    timezone: t.timezone,
    playersCount: t.players.length
  }));
});

// publier un tournoi (flag published)
app.patch('/tournaments/:id/publish', async (req, reply) => {
  const tId = req.params['id'];
  const tournament = await prisma.tournament.update({
    where: { id: tId },
    data: { published: true, status: 'published' }
  });
  return tournament;
});

// mise à jour capacité
app.patch('/tournaments/:id/capacity', async (req, reply) => {
  const tId = req.params['id'];
  const body = z.object({ capacity: z.number().int().positive() }).safeParse(req.body);
  if (!body.success) return reply.code(400).send(body.error);
  const tournament = await prisma.tournament.update({
    where: { id: tId },
    data: { capacity: body.data.capacity }
  });
  return tournament;
});

// pairings d'un round
app.get('/tournaments/:id/pairings', async (req, reply) => {
  const tId = req.params['id'];
  const roundNumber = req.query['round'] ? Number(req.query['round']) : undefined;
  const round = await prisma.round.findFirst({
    where: { tournamentId: tId, ...(roundNumber ? { number: roundNumber } : {}) },
    orderBy: { number: 'desc' },
    include: { pairings: true }
  });
  if (!round) return reply.code(404).send({ message: 'Round not found' });
  return round;
});

// saisie des scores sur une table
app.post('/pairings/:id/scores', async (req, reply) => {
  const pId = req.params['id'];
  const body = z
    .object({
      scoreA: z.number().int(),
      scoreB: z.number().int()
    })
    .safeParse(req.body);
  if (!body.success) return reply.code(400).send(body.error);

  const pairing = await prisma.pairing.findUnique({ where: { id: pId } });
  if (!pairing) return reply.code(404).send({ message: 'Pairing not found' });

  const scoreA = body.data.scoreA;
  const scoreB = body.data.scoreB;
  const resultA = scoreA > scoreB ? 'WIN' : scoreA < scoreB ? 'LOSS' : 'DRAW';
  const resultB = resultA === 'WIN' ? 'LOSS' : resultA === 'LOSS' ? 'WIN' : 'DRAW';

  const updated = await prisma.pairing.update({
    where: { id: pId },
    data: { scoreA, scoreB, resultA, resultB }
  });
  return updated;
});

// standings calculés (3/1/0)
app.get('/tournaments/:id/standings', async (req, reply) => {
  const tId = req.params['id'];
  const tournament = await prisma.tournament.findUnique({
    where: { id: tId },
    include: {
      players: true,
      rounds: {
        include: { pairings: true }
      }
    }
  });
  if (!tournament) return reply.code(404).send({ message: 'Tournament not found' });

  const scores = new Map<
    string,
    { wins: number; draws: number; losses: number; points: number; vpDiff: number }
  >();

  tournament.players.forEach((p) => {
    scores.set(p.id, { wins: 0, draws: 0, losses: 0, points: 0, vpDiff: 0 });
  });

  for (const r of tournament.rounds) {
    for (const p of r.pairings) {
      if (p.scoreA == null || p.scoreB == null) continue;
      const a = scores.get(p.playerAId);
      const b = p.playerBId ? scores.get(p.playerBId) : undefined;
      if (!a) continue;

      if (p.resultA === 'WIN') {
        a.wins += 1;
        a.points += 3;
        if (b) {
          b.losses += 1;
        }
      } else if (p.resultA === 'LOSS') {
        a.losses += 1;
        if (b) {
          b.wins += 1;
          b.points += 3;
        }
      } else if (p.resultA === 'DRAW') {
        a.draws += 1;
        a.points += 1;
        if (b) {
          b.draws += 1;
          b.points += 1;
        }
      }
      a.vpDiff += p.scoreA - p.scoreB;
      if (b) {
        b.vpDiff += p.scoreB - p.scoreA;
      }
    }
  }

  const table = tournament.players
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      pseudo: p.pseudo,
      wins: scores.get(p.id)?.wins ?? 0,
      draws: scores.get(p.id)?.draws ?? 0,
      losses: scores.get(p.id)?.losses ?? 0,
      points: scores.get(p.id)?.points ?? 0,
      vpDiff: scores.get(p.id)?.vpDiff ?? 0
    }))
    .sort((a, b) => b.points - a.points || b.vpDiff - a.vpDiff);

  return table;
});

// clôture d’un tournoi
app.post('/tournaments/:id/close', async (req, reply) => {
  const tId = req.params['id'];
  const t = await prisma.tournament.update({
    where: { id: tId },
    data: { status: 'closed' }
  });
  return t;
});

async function start() {
  try {
    await app.listen({ port, host });
    app.log.info(`API listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
