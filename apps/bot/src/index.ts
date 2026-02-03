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
  new SlashCommandBuilder().setName('cog_ping').setDescription('Répond pong'),
  new SlashCommandBuilder()
    .setName('cog_tournoi_creer')
    .setDescription('Créer un tournoi (modèle week-end optionnel)')
    .addStringOption((o) => o.setName('nom').setDescription('Nom du tournoi').setRequired(false))
    .addBooleanOption((o) => o.setName('modele_weekend').setDescription('Charger le modèle week-end'))
    .addIntegerOption((o) => o.setName('capacite').setDescription('Capacité max').setRequired(false)),
  new SlashCommandBuilder()
    .setName('cog_round_generer')
    .setDescription('Générer un round Swiss pour un tournoi')
    .addStringOption((o) => o.setName('tournoi_id').setDescription('ID du tournoi').setRequired(true)),
  new SlashCommandBuilder()
    .setName('cog_tournoi_inscription')
    .setDescription("S'inscrire à un tournoi (opt-in joueur)")
    .addStringOption((o) => o.setName('tournoi_id').setDescription('ID du tournoi').setRequired(true))
    .addStringOption((o) => o.setName('faction').setDescription('Faction/armée (optionnel)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('cog_tournois')
    .setDescription('Lister les tournois')
    .addStringOption((o) =>
      o
        .setName('filtre')
        .setDescription('Filtrer par inscription')
        .addChoices(
          { name: 'Tous les tournois à venir', value: 'tous' },
          { name: 'Ceux où je suis inscrit', value: 'inscrit' },
          { name: "Ceux où je ne suis pas encore inscrit (à venir)", value: 'disponible' }
        )
        .setRequired(false)
    )
    .addBooleanOption((o) => o.setName('avenir_uniquement').setDescription('Limiter aux tournois à venir')),
  new SlashCommandBuilder()
    .setName('cog_tournoi_publier')
    .setDescription('Publier un tournoi')
    .addStringOption((o) => o.setName('tournoi_id').setDescription('ID du tournoi').setRequired(true)),
  new SlashCommandBuilder()
    .setName('cog_capacite')
    .setDescription('Mettre à jour la capacité d’un tournoi')
    .addStringOption((o) => o.setName('tournoi_id').setDescription('ID du tournoi').setRequired(true))
    .addIntegerOption((o) => o.setName('capacite').setDescription('Capacité max').setRequired(true)),
  new SlashCommandBuilder()
    .setName('cog_pairings')
    .setDescription('Lister les pairings d’un round')
    .addStringOption((o) => o.setName('tournoi_id').setDescription('ID du tournoi').setRequired(true))
    .addIntegerOption((o) => o.setName('round').setDescription('Numéro de round').setRequired(false)),
  new SlashCommandBuilder()
    .setName('cog_scores')
    .setDescription('Enregistrer un score de table')
    .addStringOption((o) => o.setName('pairing_id').setDescription('ID du pairing/table').setRequired(true))
    .addIntegerOption((o) => o.setName('score_a').setDescription('Score joueur A').setRequired(true))
    .addIntegerOption((o) => o.setName('score_b').setDescription('Score joueur B').setRequired(true)),
  new SlashCommandBuilder()
    .setName('cog_classement')
    .setDescription('Voir le classement courant')
    .addStringOption((o) => o.setName('tournoi_id').setDescription('ID du tournoi').setRequired(true)),
  new SlashCommandBuilder()
    .setName('cog_tournoi_fermer')
    .setDescription('Clôturer un tournoi')
    .addStringOption((o) => o.setName('tournoi_id').setDescription('ID du tournoi').setRequired(true))
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
    if (interaction.commandName === 'cog_ping') {
      await interaction.reply({ content: 'Pong!', ephemeral: true });
      return;
    }

    if (interaction.commandName === 'cog_tournoi_creer') {
      await interaction.deferReply({ ephemeral: true });
      const usePreset = interaction.options.getBoolean('modele_weekend') ?? false;
      const name = interaction.options.getString('nom') ?? sampleTournament.name;
      const payload = usePreset ? { ...sampleTournament, name } : { name, timezone: 'UTC' };
      const capacity = interaction.options.getInteger('capacite') ?? undefined;
      if (capacity) payload.capacity = capacity;
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

    if (interaction.commandName === 'cog_round_generer') {
      await interaction.deferReply({ ephemeral: true });
      const tId = interaction.options.getString('tournoi_id', true);
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

    if (interaction.commandName === 'cog_tournoi_inscription') {
      await interaction.deferReply({ ephemeral: true });
      const tId = interaction.options.getString('tournoi_id', true);
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
          body: JSON.stringify({ name, pseudo, faction, discordId: interaction.user.id })
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

    if (interaction.commandName === 'cog_tournois') {
      await interaction.deferReply({ ephemeral: true });
      const filtre = interaction.options.getString('filtre') ?? 'tous';
      const userId = interaction.user.id;
      const futureOnly = interaction.options.getBoolean('avenir_uniquement') ?? true;
      let url = `${apiBase}/tournaments${futureOnly ? '?future=true' : ''}`;
      if (filtre === 'inscrit') url = `${apiBase}/tournaments?registeredDiscordId=${userId}`;
      if (filtre === 'disponible') url = `${apiBase}/tournaments?notRegisteredDiscordId=${userId}&future=true`;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          await interaction.editReply(`Erreur API: ${res.status} ${text}`);
          return;
        }
        const data = (await res.json()) as any[];
        if (!data.length) {
          await interaction.editReply('Aucun tournoi trouvé pour ce filtre.');
          return;
        }
        const lines = data
          .map((t) => {
            const date = t.startDate ? new Date(t.startDate).toLocaleDateString('fr-FR') : 'date ?';
            return `• ${t.name} (début ${date}) — id: \`${t.id}\` — ${t.playersCount ?? 0} inscrits`;
          })
          .join('\n');
        await interaction.editReply(lines);
      } catch (err: any) {
        await interaction.editReply(`Erreur: ${err.message}`);
      }
      return;
    }

    if (interaction.commandName === 'cog_tournoi_publier') {
      await interaction.deferReply({ ephemeral: true });
      const tId = interaction.options.getString('tournoi_id', true);
      try {
        const res = await fetch(`${apiBase}/tournaments/${tId}/publish`, { method: 'PATCH' });
        if (!res.ok) return interaction.editReply(`Erreur API: ${res.status}`);
        await interaction.editReply(`Tournoi publié: ${tId}`);
      } catch (err: any) {
        await interaction.editReply(`Erreur: ${err.message}`);
      }
      return;
    }

    if (interaction.commandName === 'cog_capacite') {
      await interaction.deferReply({ ephemeral: true });
      const tId = interaction.options.getString('tournoi_id', true);
      const cap = interaction.options.getInteger('capacite', true);
      try {
        const res = await fetch(`${apiBase}/tournaments/${tId}/capacity`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capacity: cap })
        });
        if (!res.ok) return interaction.editReply(`Erreur API: ${res.status}`);
        await interaction.editReply(`Capacité mise à jour à ${cap} places.`);
      } catch (err: any) {
        await interaction.editReply(`Erreur: ${err.message}`);
      }
      return;
    }

    if (interaction.commandName === 'cog_pairings') {
      await interaction.deferReply({ ephemeral: true });
      const tId = interaction.options.getString('tournoi_id', true);
      const rNum = interaction.options.getInteger('round') ?? undefined;
      const url = rNum
        ? `${apiBase}/tournaments/${tId}/pairings?round=${rNum}`
        : `${apiBase}/tournaments/${tId}/pairings`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          return interaction.editReply(`Erreur API: ${res.status} ${text}`);
        }
        const data = (await res.json()) as any;
        const lines = data.pairings
          .map(
            (p: any) =>
              `Table ${p.table}: ${p.playerAId} vs ${p.playerBId ?? 'Bye'}${
                p.scoreA != null ? ` — ${p.scoreA}-${p.scoreB}` : ''
              }`
          )
          .join('\n');
        await interaction.editReply(`Round ${data.number}:\n${lines}`);
      } catch (err: any) {
        await interaction.editReply(`Erreur: ${err.message}`);
      }
      return;
    }

    if (interaction.commandName === 'cog_scores') {
      await interaction.deferReply({ ephemeral: true });
      const pid = interaction.options.getString('pairing_id', true);
      const scoreA = interaction.options.getInteger('score_a', true);
      const scoreB = interaction.options.getInteger('score_b', true);
      try {
        const res = await fetch(`${apiBase}/pairings/${pid}/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scoreA, scoreB })
        });
        if (!res.ok) {
          const text = await res.text();
          return interaction.editReply(`Erreur API: ${res.status} ${text}`);
        }
        const data = (await res.json()) as any;
        await interaction.editReply(
          `Score enregistré pour table ${data.table}: ${data.playerAId} ${data.scoreA}-${data.scoreB} ${data.playerBId ?? 'Bye'}`
        );
      } catch (err: any) {
        await interaction.editReply(`Erreur: ${err.message}`);
      }
      return;
    }

    if (interaction.commandName === 'cog_classement') {
      await interaction.deferReply({ ephemeral: true });
      const tId = interaction.options.getString('tournoi_id', true);
      try {
        const res = await fetch(`${apiBase}/tournaments/${tId}/standings`);
        if (!res.ok) {
          const text = await res.text();
          return interaction.editReply(`Erreur API: ${res.status} ${text}`);
        }
        const data = (await res.json()) as any[];
        const top = data.slice(0, 10);
        const lines = top
          .map(
            (p, idx) =>
              `${idx + 1}. ${p.name}${p.pseudo ? ` (${p.pseudo})` : ''} — ${p.points} pts (W${p.wins}/D${p.draws}/L${p.losses}, VPΔ ${p.vpDiff})`
          )
          .join('\n');
        await interaction.editReply(lines || 'Aucun score enregistré.');
      } catch (err: any) {
        await interaction.editReply(`Erreur: ${err.message}`);
      }
      return;
    }

    if (interaction.commandName === 'cog_tournoi_fermer') {
      await interaction.deferReply({ ephemeral: true });
      const tId = interaction.options.getString('tournoi_id', true);
      try {
        const res = await fetch(`${apiBase}/tournaments/${tId}/close`, { method: 'POST' });
        if (!res.ok) return interaction.editReply(`Erreur API: ${res.status}`);
        await interaction.editReply(`Tournoi clôturé.`);
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
