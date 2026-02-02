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
