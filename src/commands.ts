import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('live')
    .setDescription('Anuncia que a live está aberta')
    .addStringOption((option) =>
      option.setName('url').setDescription('Link da live').setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Entra no seu canal de voz'),
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Toca o áudio de um vídeo do YouTube')
    .addStringOption((option) =>
      option.setName('url').setDescription('URL do vídeo ou música').setRequired(true),
    ),
  new SlashCommandBuilder().setName('skip').setDescription('Avança para a próxima música da fila'),
  new SlashCommandBuilder().setName('fila').setDescription('Mostra as músicas na fila'),
  new SlashCommandBuilder().setName('help').setDescription('Mostra os comandos do bot'),
  new SlashCommandBuilder().setName('stop').setDescription('Para o áudio atual'),
  new SlashCommandBuilder().setName('leave').setDescription('Sai do canal de voz'),
].map((command) => command.toJSON());
