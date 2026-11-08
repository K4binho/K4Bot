import { startWebsite } from './website.js';
import 'dotenv/config';
import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionsBitField,
  type ChatInputCommandInteraction,
} from 'discord.js';
import {
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
  getVoiceConnection,
  type VoiceConnection,
} from '@discordjs/voice';
import { env } from './env.js';
import { installPrefix } from './prefix.js';
import { installPanelCleanup } from './panel.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const handleMusicCommand = installPrefix(client);
installPanelCleanup(client, env.guildId);
startWebsite(client);
const connections = new Map<string, VoiceConnection>();

function getVoiceChannel(interaction: ChatInputCommandInteraction) {
  const channel = interaction.guild?.voiceStates.cache.get(interaction.user.id)?.channel;
  if (!channel || !channel.isVoiceBased()) return null;
  return channel;
}

async function connect(interaction: ChatInputCommandInteraction) {
  const channel = getVoiceChannel(interaction);
  if (!channel || !interaction.guild) {
    await interaction.editReply('Entre em um canal de voz primeiro.');
    return null;
  }

  const botMember = interaction.guild.members.me;
  const permissions = botMember ? channel.permissionsFor(botMember) : null;
  const missing = permissions?.missing([
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
  ]) ?? ['Ver canal', 'Conectar', 'Falar'];
  if (missing.length > 0) {
    await interaction.editReply({
      content: `Não tenho estas permissões neste canal: **${missing.join(', ')}**.`,
    });
    return null;
  }

  const connection = getVoiceConnection(interaction.guild.id) ?? joinVoiceChannel({
    channelId: channel.id,
    guildId: interaction.guild.id,
    adapterCreator: interaction.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
    daveEncryption: true,
  });
  connection.on('stateChange', (oldState, newState) => {
    console.log(`Voz: ${oldState.status} -> ${newState.status}`);
    if ('closeCode' in newState) console.log(`Código de encerramento de voz: ${newState.closeCode}`);
  });
  connection.on('error', error => console.error('Falha de voz:', error.message));
  connections.set(interaction.guild.id, connection);
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  } catch (error) {
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    connections.delete(interaction.guild.id);
    throw error;
  }
  console.log(`Conexão de voz pronta no servidor ${interaction.guild.id}.`);
  return connection;
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) return interaction.reply({ content: 'Esse comando só funciona dentro de um servidor.', flags: MessageFlags.Ephemeral });

  if (interaction.commandName === 'live') {
    const url = interaction.options.getString('url') ?? process.env.DEFAULT_LIVE_URL;
    if (!url) return interaction.reply({ content: 'Informe o link da live ou configure DEFAULT_LIVE_URL.', flags: MessageFlags.Ephemeral });
    const name = process.env.STREAMER_NAME ?? 'a live';
    return interaction.reply(`🔴 **${name} está ao vivo!**\n\nEntra aí: ${url}`);
  }

  if (interaction.commandName === 'join') {
    await interaction.deferReply();
    try {
      if (!await connect(interaction)) return;
      return interaction.editReply('Entrei na call. Use `/play url:` para tocar o áudio de um vídeo.');
    } catch {
      return interaction.editReply('A conexão de áudio não ficou pronta dentro do prazo. Entrar na lista da call não confirma a conexão de áudio.');
    }
  }

  if (['play', 'stop', 'skip', 'avancar', 'fila', 'help'].includes(interaction.commandName)) {
    return handleMusicCommand(interaction);
  }

  if (interaction.commandName === 'leave') {
    // Stop the shared queue before disconnecting.
    handleMusicCommand.stop(guildId);
    await interaction.deferReply();

    const connection = getVoiceConnection(guildId) ?? connections.get(guildId);
    if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    connections.delete(guildId);
    const guild = interaction.guild!;
    // A restarted process can have no local connection while still appearing in voice.
    guild.shard.send({ op: 4, d: { guild_id: guildId, channel_id: null, self_mute: false, self_deaf: false } });
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      if (!guild.members.me?.voice.channelId) return interaction.editReply('👋 Saída da call confirmada.');
    }
    return interaction.editReply('Enviei o pedido de saída, mas o Discord ainda não confirmou.');
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`K4Bot conectado como ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.deferred || interaction.replied) await interaction.editReply('Ocorreu um erro inesperado.');
    else await interaction.reply({ content: 'Ocorreu um erro inesperado.', flags: MessageFlags.Ephemeral });
  }
});

client.login(env.token).catch((error) => {
  if (error?.code === 'TokenInvalid') {
    console.error('Token inválido. Atualize DISCORD_TOKEN no arquivo .env com o token da aba Bot do Discord Developer Portal.');
    process.exitCode = 1;
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
