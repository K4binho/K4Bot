import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './commands.js';
import { env } from './env.js';

const rest = new REST({ version: '10' }).setToken(env.token);
try {
  await rest.put(Routes.applicationGuildCommands(env.clientId, env.guildId), { body: commands });
  console.log(`Comandos registrados no servidor ${env.guildId}.`);
} catch (error: any) {
  if (error?.status === 401) {
    throw new Error('Token inválido. Gere um novo token na aba Bot da aplicação Discord e atualize DISCORD_TOKEN no .env.');
  }
  if (error?.status === 403 || error?.code === 50001) {
    throw new Error('Acesso negado ao servidor. Convide o bot para o servidor informado em DISCORD_GUILD_ID usando os escopos bot e applications.commands.');
  }
  throw error;
}
