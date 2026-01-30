import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const appId = process.env.APP_ID;
const guildId = process.env.DEV_GUILD_ID; // optional, for faster deploy of commands in dev

if (!token || !appId) {
  throw new Error('Missing DISCORD_TOKEN or APP_ID in environment.');
}

// Minimal slash command `/ping`
const commands = [new SlashCommandBuilder().setName('ping').setDescription('Répond pong').toJSON()];

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
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  client.once('ready', () => console.log(`🤖 Bot connecté en tant que ${client.user?.tag}`));

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'ping') {
      await interaction.reply({ content: 'Pong!', ephemeral: true });
    }
  });

  await client.login(token);
}

main().catch((err) => {
  console.error('Bot failed to start', err);
  process.exit(1);
});
