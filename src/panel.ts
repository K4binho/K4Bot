import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, escapeMarkdown, Events, MessageFlags, type Client, type Message } from 'discord.js';
import { coverImage, playerImage } from './player-image.js';
import { AudioPlayerStatus, getVoiceConnection, type AudioPlayer } from '@discordjs/voice';
const messages = new Map<string, Promise<Message>>();
const owners = new Map<string, symbol>();

function hasPanelButton(component: unknown): boolean {
  if (!component || typeof component !== 'object') return false;
  if ('type' in component && component.type === 2 && 'custom_id' in component &&
    typeof component.custom_id === 'string' && component.custom_id.startsWith('k4panel:')) return true;
  return 'components' in component && Array.isArray(component.components) && component.components.some(hasPanelButton);
}

const queueViews = new Map<string, number>();
export function installPanelCleanup(client: Client, guildId: string) {
  client.once(Events.ClientReady, async () => {
    const cutoff = Date.now();
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    for (const channel of guild.channels.cache.values()) {
      if (!channel.isTextBased() || !guild.members.me ||
          !channel.permissionsFor(guild.members.me)?.has(['ViewChannel', 'ReadMessageHistory'])) continue;
      try {
        const recent = await channel.messages.fetch({ limit: 100, cache: false });
        for (const msg of recent.values()) {
          if (msg.createdTimestamp >= cutoff || msg.author.id !== client.user?.id ||
              !msg.components.some(c => hasPanelButton(c.toJSON()))) continue;
          await msg.delete();
        }
      } catch (error) { console.warn('Revisão inicial dos painéis:', (error as {code?: unknown}).code); }
    }
  });
  client.on(Events.VoiceStateUpdate, async (previous, current) => {
    if (current.id !== client.user?.id || !previous.channelId || current.channelId) return;
    for (const [key, pending] of [...messages]) {
      if (!key.startsWith(current.guild.id + ':')) continue;
      try {
        const msg = await pending;
        if (messages.get(key) !== pending || current.guild.members.me?.voice.channelId) continue;
        owners.delete(key);
        messages.delete(key);
        queueViews.delete(key);
        await msg.delete();
      } catch (error) { console.warn('Limpeza ao sair da call:', (error as {code?: unknown}).code); }
    }
  });
}
export function showPanel(client: Client, request: Message, player: AudioPlayer, track: { title: string; url: string; duration?: number; artist?: string }, queue: () => readonly {title: string}[], stop: () => void) {
  const size = () => queue().length;
  const nextTitle = () => queue()[0]?.title;
  const channel = request.channel;
  if (!channel?.isSendable() || !client.channels.cache.has(channel.id)) return;
  let lastMove = 0;
  const key = `${request.guildId}:${request.channelId}`;
  const owner = Symbol();
  owners.set(key, owner);
  let panel: Message | undefined;
  async function cleanOlderPanels(current: Message) {
    try {
      const older = await current.channel.messages.fetch({ before: current.id, limit: 100, cache: false });
      for (const message of older.values()) {
        if (owners.get(key) !== owner || panel?.id !== current.id) return;
        if (message.author.id !== client.user?.id || !message.components.some(c => hasPanelButton(c.toJSON()))) continue;
        try { await message.delete(); } catch (error) {
          if (Number((error as {code?: unknown}).code) !== 10008) throw error;
        }
      }
    } catch (error) { console.warn('Limpeza de painéis antigos:', (error as {code?: unknown}).code); }
  }
  let closed = false;
  let removeAfter = 0;
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
      new ButtonBuilder().setCustomId('k4panel:queue').setLabel('Ver fila').setStyle(ButtonStyle.Secondary).setDisabled(closed),
    );
    container.addSeparatorComponents(new SeparatorBuilder()).addActionRowComponents(row);
    return { flags: MessageFlags.IsComponentsV2 as const, components: [container], allowedMentions: { parse: [] as [] } };
  };
  let savedImage: { signature: string; url: string; id: string } | undefined;
  const imageSignature = () => JSON.stringify([closed, player.state.status, size(), nextTitle()]);
  const visual = async (reuse = false) => {
    const base = render();
    if (!closed && queueViews.has(key)) {
      const tracks = queue();
      const pages = Math.max(1, Math.ceil(tracks.length / 8));
      const page = Math.min(pages - 1, Math.max(0, queueViews.get(key)!));
      queueViews.set(key, page);
      const lines = tracks.slice(page * 8, page * 8 + 8).map((t, i) => `**${page * 8 + i + 1}.** ${escapeMarkdown(t.title.slice(0, 150))}`);
      const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('k4panel:back').setLabel('Voltar ao player').setStyle(ButtonStyle.Primary));
      if (pages > 1) controls.addComponents(new ButtonBuilder().setCustomId('k4panel:prevpage').setLabel('Anterior').setStyle(ButtonStyle.Secondary).setDisabled(!page), new ButtonBuilder().setCustomId('k4panel:nextpage').setLabel('Próxima página').setStyle(ButtonStyle.Secondary).setDisabled(page === pages - 1));
      const card = new ContainerBuilder().setAccentColor(0x5865f2).addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Fila de músicas\nAgora: **${escapeMarkdown(track.title.slice(0, 150))}**\n\n${lines.join('\n') || 'Fila vazia'}\n\n-# ${tracks.length} na fila · Página ${page + 1} de ${pages}`)).addActionRowComponents(controls);
      return { ...base, components: [card], attachments: [], files: [] };
    }
    const elapsed = Math.min(resource ? resource.playbackDuration / 1000 : 0, track.duration || Infinity);
    const status = closed ? 'Reprodução encerrada' : player.state.status === AudioPlayerStatus.Paused ? 'Pausado' : player.state.status === AudioPlayerStatus.Playing ? 'Tocando agora' : 'Preparando áudio';
    const retained = reuse && savedImage?.signature === imageSignature() ? savedImage : undefined;
    const start = time(elapsed);
    const end = track.duration ? time(track.duration) : '?:??';
    // Reserva os tempos dentro da largura útil do bloco no Discord Desktop.
    const cells = 65 - start.length - end.length - 2;
    const position = track.duration ? Math.round((cells - 1) * elapsed / track.duration) : 0;
    const line = start + ' ' + '\u2501'.repeat(position) + '\u25cf' + '\u2500'.repeat(cells - position - 1) + ' ' + end;
    const old = base.components[0];
    const row = old.components[old.components.length - 1] as ActionRowBuilder<ButtonBuilder>;
    const filename = `player-${request.id}-${Date.now()}.png`;
    const card = new ContainerBuilder().setAccentColor(0x5865f2)
      .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(retained?.url || `attachment://${filename}`).setDescription(`${status}: ${track.title}`)))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(['```', line, '```'].join('\n')));
    card.addActionRowComponents(row);
    if (retained) return { ...base, components: [card], attachments: [{ id: retained.id }] };
    const image = await playerImage({ title: track.title, artist: track.artist || 'Artista não informado', user: request.member?.displayName || request.author.username, channel: request.member?.voice.channel?.name || 'Canal de voz', status, elapsed, duration: track.duration, queue: size(), next: nextTitle(), externalProgress: true }, await cover);
    return { ...base, components: [card], attachments: [], files: [{ attachment: image, name: filename }] };
  };
  const update = async () => {
    if (owners.get(key) !== owner) { dispose(); return; }
    if (!panel || editing) return;
    if (!client.channels.cache.has(channel.id)) { dispose(); return; }
    if (closed) {
      if (Date.now() < removeAfter) return;
      editing = true;
      queueViews.delete(key);
      // Detach this message before deleting it so a new track creates its own panel.
      dispose();
      try {
        await panel.delete();
      } catch (error) {
        const code = Number((error as { code?: unknown }).code);
        if (code !== 10008 && code !== 10003) console.warn('Falha ao apagar painel encerrado:', code);
      }
      return;
    }
    const serialized = !closed && queueViews.has(key) ? JSON.stringify(['fila', queueViews.get(key), queue().map(t => t.title)]) : JSON.stringify([imageSignature(), Math.floor((resource?.playbackDuration ?? 0) / 1000)]);
    const move = !closed && channel.lastMessageId && BigInt(channel.lastMessageId) > BigInt(panel.id) && Date.now() - lastMove >= 3000;
    if (serialized === lastPayload && !move) return;
    editing = true;
    const signatureAtStart = imageSignature();
    try {
      const signature = signatureAtStart;
      const imagePayload = await visual(!move);
      if (owners.get(key) !== owner) return;
      if (move) {
        lastMove = Date.now();
        const old = panel;
        const fresh = await channel.send(imagePayload);
        if (owners.get(key) !== owner) { await fresh.delete().catch(() => {}); return; }
        panel = fresh;
        messages.set(key, Promise.resolve(fresh));
        await old.delete().catch(() => cleanOlderPanels(fresh));
      } else panel = await panel.edit(imagePayload);
      if ('files' in imagePayload) {
        const gallery = panel.components.map(c => c.toJSON()).flatMap(c => c.type === 17 ? c.components : []).find(c => c.type === 12);
        const media = gallery?.items[0]?.media;
        const attachment = panel.attachments.find(a => a.name.startsWith('player-'));
        const url = attachment?.url ?? media?.url;
        const id = attachment?.id ?? media?.attachment_id;
        savedImage = id && url?.startsWith('https://') ? { signature, url, id } : undefined;
      }
      lastPayload = serialized;
    } catch (error) { if (Number((error as {code?: unknown}).code) === 10003 || !client.channels.cache.has(channel.id)) dispose(); else console.error('Falha ao atualizar painel:', error instanceof Error ? error.message : 'erro'); } finally {
      editing = false;
      if (closed && signatureAtStart !== imageSignature()) void update();
    }
  };
  const listener = async (interaction: import('discord.js').Interaction) => {
    if (!interaction.isButton() || interaction.message.id !== panel?.id || owners.get(key) !== owner) return;
    try {
      const channel = request.guild?.voiceStates.cache.get(interaction.user.id)?.channelId;
      if (!channel || channel !== getVoiceConnection(request.guildId!)?.joinConfig.channelId) { await interaction.reply({ content: 'Entre na mesma call do bot para usar os controles.', flags: MessageFlags.Ephemeral }); return; }
      if (closed) { await interaction.deferUpdate(); return; }
      if (['queue','back','prevpage','nextpage'].some(action => interaction.customId === 'k4panel:' + action)) {
        await interaction.deferUpdate();
        if (interaction.customId === 'k4panel:back') queueViews.delete(key);
        else queueViews.set(key, interaction.customId === 'k4panel:queue' ? 0 : (queueViews.get(key) ?? 0) + (interaction.customId === 'k4panel:nextpage' ? 1 : -1));
        lastPayload = '';
        await update();
        return;
      }
      if (interaction.customId === 'k4panel:pause') {
        if (player.state.status === AudioPlayerStatus.Paused) player.unpause(); else player.pause();
        const components = interaction.message.components.map(c => c.toJSON());
        for (const c of components) if (c.type === 17) for (const row of c.components) if (row.type === 1) for (const b of row.components) if (b.type === 2 && 'custom_id' in b && b.custom_id === 'k4panel:pause') b.label = player.state.status === AudioPlayerStatus.Paused ? '▶ Continuar' : '⏸ Pausar';
        await interaction.update({ components });
      } else await interaction.deferUpdate();
      if (interaction.customId === 'k4panel:skip') player.stop();
      if (interaction.customId === 'k4panel:stop') stop();
      await update();
    } catch { /* An expired interaction must not crash playback. */ }
  };
  client.on(Events.InteractionCreate, listener);
  const timer = setInterval(() => void update(), 1000);
  timer.unref();
  function dispose() {
    clearInterval(timer);
    client.off(Events.InteractionCreate, listener);
    if (owners.get(key) === owner) { owners.delete(key); messages.delete(key); }
  }
  player.once(AudioPlayerStatus.Idle, () => {
    closed = true;
    removeAfter = Date.now() + 2000;
  });
  const previous = messages.get(key);
  const creation = (async () => {
    if (previous) { try { const existing = await previous; return await existing.edit(await visual()); } catch {} }
    return channel.send(await visual());
  })();
  messages.set(key, creation);
  void creation.then(m => { panel = m; if (owners.get(key) === owner) void cleanOlderPanels(m); if (closed) void update(); }).catch(dispose);
}
