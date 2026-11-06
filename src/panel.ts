import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, escapeMarkdown, Events, MessageFlags, type Client, type Message } from 'discord.js';
import { coverImage, playerImage } from './player-image.js';
import { AudioPlayerStatus, getVoiceConnection, type AudioPlayer } from '@discordjs/voice';
const messages = new Map<string, Promise<Message>>();
const owners = new Map<string, symbol>();

export function showPanel(client: Client, request: Message, player: AudioPlayer, track: { title: string; url: string; duration?: number; artist?: string }, size: () => number, stop: () => void) {
  const key = `${request.guildId}:${request.channelId}`;
  const owner = Symbol();
  owners.set(key, owner);
  let panel: Message | undefined;
  let closed = false;
  let editing = false;
  const resource = 'resource' in player.state ? player.state.resource : undefined;
  let lastPayload = '';
  const videoId = new URL(track.url).searchParams.get('v');
  const cover = videoId && /^[\w-]{11}$/.test(videoId) ? coverImage(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`) : Promise.resolve(undefined);
  const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const render = () => {
    const state = player.state;
    const elapsed = Math.min(resource ? resource.playbackDuration / 1000 : 0, track.duration || Infinity);
    const paused = state.status === AudioPlayerStatus.Paused;
    const position = track.duration ? Math.min(20, Math.floor(elapsed / track.duration * 20)) : 0;
    const bar = track.duration ? '▰'.repeat(position) + '▱'.repeat(20 - position) : 'Duração indisponível';
    const status = closed ? 'Encerrado' : paused ? 'Pausado' : state.status === AudioPlayerStatus.Playing ? 'Tocando agora' : 'Preparando áudio';
    const container = new ContainerBuilder().setAccentColor(closed ? 0x58616e : paused ? 0x9b5cff : 0x5865f2)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${status}\n-# K4 MUSIC · YouTube`))
      .addSeparatorComponents(new SeparatorBuilder());
    const title = track.title.length > 160 ? track.title.slice(0, 157) + '…' : track.title;
    const details = new TextDisplayBuilder().setContent(`**[${escapeMarkdown(title)}](${track.url})**\n${escapeMarkdown(track.artist || 'Artista não informado')}\nPedido por <@${request.author.id}>`);
    const id = new URL(track.url).searchParams.get('v');
    if (id && /^[\w-]{11}$/.test(id)) container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(details).setThumbnailAccessory(new ThumbnailBuilder().setURL(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`).setDescription('Capa da faixa')));
    else container.addTextDisplayComponents(details);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Voz: <#${getVoiceConnection(request.guildId!)?.joinConfig.channelId ?? request.member?.voice.channelId}> · Fila: ${size()}\n\`${bar}\`\n**${time(elapsed)}** / ${track.duration ? time(track.duration) : '—'}`));
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('k4panel:pause').setLabel(paused ? '▶ Continuar' : '⏸ Pausar').setStyle(ButtonStyle.Primary).setDisabled(closed),
      new ButtonBuilder().setCustomId('k4panel:skip').setLabel('⏭ Avançar').setStyle(ButtonStyle.Secondary).setDisabled(closed),
      new ButtonBuilder().setCustomId('k4panel:stop').setLabel('⏹ Parar').setStyle(ButtonStyle.Secondary).setDisabled(closed),
    );
    container.addSeparatorComponents(new SeparatorBuilder()).addActionRowComponents(row);
    return { flags: MessageFlags.IsComponentsV2 as const, components: [container], allowedMentions: { parse: [] as [] } };
  };
  const visual = async () => {
    const base = render();
    const elapsed = Math.min(resource ? resource.playbackDuration / 1000 : 0, track.duration || Infinity);
    const status = closed ? 'Reprodução encerrada' : player.state.status === AudioPlayerStatus.Paused ? 'Pausado' : player.state.status === AudioPlayerStatus.Playing ? 'Tocando agora' : 'Preparando áudio';
    const image = await playerImage({ title: track.title, artist: track.artist || 'Artista não informado', user: request.member?.displayName || request.author.username, channel: request.member?.voice.channel?.name || 'Canal de voz', status, elapsed, duration: track.duration, queue: size() }, await cover);
    const old = base.components[0];
    const row = old.components[old.components.length - 1] as ActionRowBuilder<ButtonBuilder>;
    const card = new ContainerBuilder().setAccentColor(0x5865f2)
      .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://player.png').setDescription(`${status}: ${track.title}`)))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# [Abrir faixa no YouTube](${track.url}) · Pedido por <@${request.author.id}>`))
      .addActionRowComponents(row);
    return { ...base, components: [card], attachments: [], files: [{ attachment: image, name: 'player.png' }] };
  };
  const update = async () => {
    if (!panel || editing || owners.get(key) !== owner) return;
    const payload = render();
    const serialized = JSON.stringify(payload);
    if (serialized === lastPayload) return;
    editing = true;
    try { const imagePayload = await visual(); if (owners.get(key) === owner) await panel.edit(imagePayload); lastPayload = serialized; } catch (error) { console.error('Falha ao atualizar painel:', error instanceof Error ? error.message : 'erro'); } finally {
      editing = false;
      if (closed && serialized !== JSON.stringify(render())) void update();
    }
  };
  const listener = async (interaction: import('discord.js').Interaction) => {
    if (!interaction.isButton() || interaction.message.id !== panel?.id || owners.get(key) !== owner) return;
    try {
      const channel = request.guild?.voiceStates.cache.get(interaction.user.id)?.channelId;
      if (!channel || channel !== getVoiceConnection(request.guildId!)?.joinConfig.channelId) { await interaction.reply({ content: 'Entre na mesma call do bot para usar os controles.', flags: MessageFlags.Ephemeral }); return; }
      await interaction.deferUpdate();
      if (closed) return;
      if (interaction.customId === 'k4panel:pause') player.state.status === AudioPlayerStatus.Paused ? player.unpause() : player.pause();
      if (interaction.customId === 'k4panel:skip') player.stop();
      if (interaction.customId === 'k4panel:stop') stop();
      await update();
    } catch { /* An expired interaction must not crash playback. */ }
  };
  client.on(Events.InteractionCreate, listener);
  const timer = setInterval(() => void update(), 1000);
  timer.unref();
  player.once(AudioPlayerStatus.Idle, () => { closed = true; clearInterval(timer); client.off(Events.InteractionCreate, listener); void update(); });
  const previous = messages.get(key);
  const creation = (async () => {
    if (previous) { try { const existing = await previous; return await existing.edit(await visual()); } catch {} }
    return request.reply(await visual());
  })();
  messages.set(key, creation);
  void creation.then(m => { panel = m; if (closed) void update(); }).catch(() => { if (owners.get(key) === owner) messages.delete(key); clearInterval(timer); client.off(Events.InteractionCreate, listener); });
}
