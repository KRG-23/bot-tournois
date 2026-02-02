// @ts-nocheck
import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const appId = process.env.APP_ID;
const guildId = process.env.DEV_GUILD_ID; // optional, for faster deploy of commands in dev
const apiBase = process.env.API_BASE ?? 'http://api:3000';

if (!token || !appId) {
  throw new Error('Missing DISCORD_TOKEN or APP_ID in environment.');
}

const sampleTournament = {
  name: 'SCENARIO DU WEEKEND',
  timezone: 'Europe/Paris',
  rulesUrl: 'https://docs.google.com/document/d/13Xyl7rr8isFkhXLvkG5t7QrBMCulDJC3cpmWdJX6aDo/edit?usp=sharing',
  location: 'Rue Henri Gandon, 49430 Huillé-Lézigné',
  startDate: '2025-12-06',
  endDate: '2025-12-07',
  capacity: 40,
  rounds: [
    { round: 1, code: 'A', primary: 'Take and Hold', deployment: 'Tipping Point' },
    { round: 2, code: 'K', primary: 'Scorched Earth', deployment: 'Search and Destroy' },
    { round: 3, code: 'N', primary: 'Hidden Supplies', deployment: 'Crucible Of Battle' },
    { round: 4, code: 'G', primary: 'Purge the Foe', deployment: 'Hammer and Anvil' },
    { round: 5, code: 'O', primary: 'Terraform', deployment: 'Crucible of Battle' }
  ],
  schedule: {
    freeze: '2025-11-16',
    inscriptions_close: '2025-11-23',
    lists_due: '2025-12-01',
    lists_publish: '2025-12-05',
    event: '2025-12-06 to 2025-12-07',
    saturday: [
      '08:00 Accueil et petit déjeuner',
      '08:30 - 12:00 Première partie',
      '12:00 - 13:00 Repas',
      '13:00 - 16:30 Seconde partie',
      '17:00 - 20:30 Troisième partie'
    ],
    sunday: [
      '08:00 Accueil et petit déjeuner',
      '08:30 - 12:00 Première partie',
      '12:00 - 13:00 Repas',
      '13:00 - 16:30 Seconde partie',
      '16:30 - 17:00 Remise des trophées'
    ]
  }
};

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Répond pong'),
  new SlashCommandBuilder()
    .setName('tournament_create')
    .setDescription('Crée un tournoi (option modèle week-end)')
    .addStringOption((o) => o.setName('name').setDescription('Nom du tournoi').setRequired(false))
    .addBooleanOption((o) => o.setName('preset_weekend').setDescription('Charger le modèle week-end')),
  new SlashCommandBuilder()
    .setName('round_generate')
    .setDescription('Génère un round Swiss pour un tournoi')
    .addStringOption((o) => o.setName('tournament_id').setDescription('ID du tournoi').setRequired(true)),
  new SlashCommandBuilder()
    .setName('tournament_register')
    .setDescription("S'inscrire à un tournoi (opt-in joueur)")
    .addStringOption((o) => o.setName('tournament_id').setDescription('ID du tournoi').setRequired(true))
    .addStringOption((o) => o.setName('faction').setDescription('Faction/armée (optionnel)').setRequired(false))
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
    console.log('✅ Slash commands registered (guild scoped)');
  } else {
    await rest.put(Routes.applicationCommands(appId), { body: commands });
    console.log('✅ Slash commands registered (global)');
  }
}

async function main() {
  await registerCommands();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once('ready', () => console.log(`🤖 Bot connecté en tant que ${client.user?.tag}`));

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'ping') {
      await interaction.reply({ content: 'Pong!', ephemeral: true });
      return;
    }

    if (interaction.commandName === 'tournament_create') {
      await interaction.deferReply({ ephemeral: true });
      const usePreset = interaction.options.getBoolean('preset_weekend') ?? false;
      const name = interaction.options.getString('name') ?? sampleTournament.name;
      const payload = usePreset ? { ...sampleTournament, name } : { name, timezone: 'UTC' };
      try {
        const res = await fetch(`${apiBase}/tournaments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const text = await res.text();
          await interaction.editReply(`Erreur API: ${res.status} ${text}`);
          return;
        }
        const data = (await res.json()) as any;
        await interaction.editReply(`Tournoi créé: \`${data.id}\` (${data.name})`);
      } catch (err: any) {
        await interaction.editReply(`Erreur: ${err.message}`);
      }
      return;
    }

    if (interaction.commandName === 'round_generate') {
      await interaction.deferReply({ ephemeral: true });
      const tId = interaction.options.getString('tournament_id', true);
      try {
        const res = await fetch(`${apiBase}/tournaments/${tId}/rounds/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}' // Fastify refuse un body vide quand content-type est JSON
        });
        if (!res.ok) {
          const text = await res.text();
          await interaction.editReply(`Erreur API: ${res.status} ${text}`);
          return;
        }
        const data = (await res.json()) as any;
        const lines = data.pairings
          .map((p: any) => `Table ${p.table}: ${p.playerAId} vs ${p.playerBId ?? 'Bye'}`)
          .join('\n');
        await interaction.editReply(`Round ${data.number} généré:\n${lines}`);
      } catch (err: any) {
        await interaction.editReply(`Erreur: ${err.message}`);
      }
      return;
    }

    if (interaction.commandName === 'tournament_register') {
      await interaction.deferReply({ ephemeral: true });
      const tId = interaction.options.getString('tournament_id', true);
      const faction = interaction.options.getString('faction') ?? undefined;
      const name =
        interaction.user.globalName ??
        interaction.user.username ??
        interaction.user.tag ??
        `User-${interaction.user.id}`;
      const pseudo = interaction.user.tag;
      try {
        const res = await fetch(`${apiBase}/tournaments/${tId}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, pseudo, faction })
        });
        if (!res.ok) {
          const text = await res.text();
          await interaction.editReply(`Erreur API: ${res.status} ${text}`);
          return;
        }
        const data = (await res.json()) as any;
        await interaction.editReply(
          `Inscription enregistrée: ${data.name} (${data.pseudo ?? '—'}) — statut PENDING / liste non soumise / paiement en attente`
        );
      } catch (err: any) {
        await interaction.editReply(`Erreur: ${err.message}`);
      }
      return;
    }
  });

  await client.login(token);
}

main().catch((err) => {
  console.error('Bot failed to start', err);
  process.exit(1);
});
