import { getSettings, saveSettings } from './settings.js';
import { resolveSpotifyTrack } from './spotify.js';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { Events, PermissionsBitField, type Client, type Message, type ChatInputCommandInteraction } from 'discord.js';
import { AudioPlayerStatus, StreamType, VoiceConnectionStatus, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { normalize, selectTrack, searchVariants } from './search.js';
import { lookup } from './lookup.js';
import { showPanel } from './panel.js';

type Track = { title: string; url: string; duration?: number; artist?: string; request: Message };
const require = createRequire(import.meta.url);
const ytDlpPath = (require('youtube-dl-exec') as { constants: { YOUTUBE_DL_PATH: string } }).constants.YOUTUBE_DL_PATH;
const aliases = new Map([
  ['p', 'play'], ['s', 'stop'], ['a', 'avancar'], ['skip', 'avancar'],
  ['next', 'avancar'], ['avançar', 'avancar'], ['f', 'fila'], ['q', 'fila'],
  ['h', 'ajuda'], ['help', 'ajuda'], ['c', 'comando'],
]);
export function installPrefix(client: Client) {
  const sessions = new Map<string, { queue: Track[]; player: ReturnType<typeof createAudioPlayer>; process?: ChildProcess; generation: number; idleTimer?: ReturnType<typeof setTimeout>; current?: Track; idleSince?: number }>();
  function scheduleIdle(guildId: string) {
    const session = sessions.get(guildId);
    if (!session) return;
    clearTimeout(session.idleTimer);
    session.idleSince ??= Date.now();
    session.idleTimer = setTimeout(() => {
      if (session.queue.length || session.player.state.status !== AudioPlayerStatus.Idle) return;
      getVoiceConnection(guildId)?.destroy();
      sessions.delete(guildId);
    }, Math.max(1, session.idleSince + getSettings().idleMinutes * 60000 - Date.now()));
    session.idleTimer.unref();
  }
  const handleMessage = async (message: Message) => {
    if (message.author.bot || !message.guild) return;
    const match = /^!k4(\S*)\s*(.*)$/i.exec(message.content.trim());
    if (!match) return;
    const name = match[1].toLowerCase();
    const command = aliases.get(name) ?? name;
    const reply = async (content: string) => {
      if (!client.channels.cache.has(message.channelId)) return;
      try { await message.reply({ content, allowedMentions: { parse: [], repliedUser: false } }); }
      catch (error) { console.warn('Resposta indisponível:', (error as {code?: unknown}).code); }
    };
    if (command === 'comando' || command === 'ajuda') {
      await reply([
        '**🎵 Kubinho.Js — Lista de comandos**',
        '',
        '**▶️ Tocar ou adicionar à fila**',
        '`!K4play nome ou link` • Atalho: `!K4p`',
        '**⏹️ Parar e limpar a fila**',
        '`!K4stop` • Atalho: `!K4s`',
        '**⏭️ Pular para a próxima música**',
        '`!K4avancar` • Atalhos: `!K4a`, `!K4skip`, `!K4next`',
        '**📋 Ver as próximas músicas**',
        '`!K4fila` • Atalhos: `!K4f`, `!K4q`',
        '**❓ Abrir esta ajuda**',
        '`!K4help` • Também: `!K4h`, `!K4ajuda`, `!K4comando`, `!K4c`',
        '',
        '**Exemplos**',
        '`!k4p black hole we came as romans`',
        '`!k4p young medicine shinju`',
        '`!k4p https://www.youtube.com/watch?v=rQzSiiRe6YM`',
        '',
        '**Como usar**',
        'Entre em uma call e envie o comando no chat. Se já houver uma música tocando, a nova entra na fila.',
        'Inclua o artista para melhorar a busca. Pequenos erros e diferenças de acento são tolerados, mas o resultado pode variar.',
        'Maiúsculas e minúsculas funcionam igualmente. Para controlar a reprodução, fique na mesma call do bot.',
        'Spotify: envie o link de uma faixa para buscar a versão correspondente no YouTube.',
      ].join('\n')); return;
    }
    if (!['play', 'stop', 'avancar', 'fila'].includes(command)) return;
    try {
      const channel = message.member?.voice.channel;
      if (!channel) throw new Error('Entre em um canal de voz primeiro.');
      const connection = getVoiceConnection(message.guild.id);
      if (connection && connection.joinConfig.channelId !== channel.id) throw new Error('Entre na mesma call do bot.');
      let session = sessions.get(message.guild.id);
      if (!session) {
        session = { queue: [], player: createAudioPlayer(), generation: 0 };
        sessions.set(message.guild.id, session);
        const s = session;
        const next = () => {
          const track = s.queue.shift();
          if (!track) {
            s.current = undefined;
            scheduleIdle(message.guild!.id);
            return;
          }
          clearTimeout(s.idleTimer);
          s.idleSince = undefined;
          s.current = track;
          // Spawn yt-dlp directly for audio: youtube-dl-exec/tinyspawn buffers
          // every stdout chunk to build its resolved Promise value, even while piping.
          const proc = spawn(ytDlpPath, ['--format', 'bestaudio[acodec=opus][ext=webm]', '--output', '-', '--no-playlist', '--quiet', '--', track.url], {
            stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true,
          });
          s.process = proc;
          proc.once('error', error => {
            if (s.process !== proc) return;
            console.error('Falha ao iniciar yt-dlp:', error.message);
            void reply('Falha ao obter o áudio. Pulando a faixa.');
            s.player.stop();
          });
          proc.once('close', (code, signal) => {
            if (s.process !== proc || code === 0) return;
            console.warn('yt-dlp encerrou a faixa com erro:', { code, signal });
            s.player.stop();
          });
          s.player.play(createAudioResource(proc.stdout, { inputType: StreamType.WebmOpus, inlineVolume: true }));
          if ('resource' in s.player.state) s.player.state.resource.volume?.setVolume(getSettings().volume / 100);
          showPanel(client, track.request, s.player, track, () => s.queue, () => { s.generation++; s.queue.length = 0; s.process?.kill(); s.player.stop(); });
        };
        s.player.on(AudioPlayerStatus.Idle, () => { s.process?.kill(); s.process = undefined; next(); });
        s.player.on('error', () => { void reply('Falha na reprodução.'); s.player.stop(); });
        // Queue starts through a synthetic idle transition only when no audio is active.
        (s as typeof s & { next: () => void }).next = next;
      }
      if (command === 'fila') { await reply(session.queue.map((t, i) => `${i + 1}. ${t.title}`).join('\n').slice(0, 1900) || 'Fila vazia.'); return; }
      if (command === 'stop') { clearTimeout(session.idleTimer); session.generation++; session.queue.length = 0; session.process?.kill(); session.player.stop(); if (session.player.state.status === AudioPlayerStatus.Idle) scheduleIdle(message.guild.id); await reply('⏹️ Reprodução parada e fila limpa.'); return; }
      if (command === 'avancar') { session.process?.kill(); session.player.stop(); await reply('⏭️ Avançando para a próxima faixa disponível.'); return; }
      const generation = session.generation;
      const text = match[2].trim().replace(/^<|>$/g, '');
      if (!text) throw new Error('Informe o nome ou link. Exemplo: !K4play rap do minecraft');
      const input = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? new URL(text) : null;
      if (input?.protocol === 'http:') input.protocol = 'https:';
      const query = input ? input.href : `ytsearch15:${normalize(text)}`;
      if (input && (!['open.spotify.com', 'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(input.hostname) || input.protocol !== 'https:')) throw new Error('Use um link HTTPS do YouTube ou de uma faixa do Spotify.');
      if (message.channel.isSendable()) void message.channel.sendTyping().catch(() => {});
      const result = input?.hostname === 'open.spotify.com' ? await resolveSpotifyTrack(input) : await lookup(query);
      let info = input ? result : selectTrack(text, result.entries ?? []);
      if (!input && !info) {
        const alternatives = await Promise.allSettled(searchVariants(text).map(async variant =>
          (await lookup(`ytsearch10:${variant}`)).entries ?? []));
        const entries = [...(result.entries ?? []), ...alternatives.flatMap(result => result.status === 'fulfilled' ? result.value : [])];
        info = selectTrack(text, entries);
      }
      if (!info?.webpage_url) throw new Error('Não encontrei uma música para essa busca. Tente incluir o artista.');
      if (session.generation !== generation) return;
      if (session.queue.length >= 50) throw new Error('A fila chegou ao limite de 50 músicas. Aguarde ou remova algumas faixas.');
      const permissions = channel.permissionsFor(message.guild.members.me!);
      if (!permissions?.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) throw new Error('Preciso das permissões Conectar e Falar nessa call.');
      const voice = connection ?? joinVoiceChannel({ guildId: message.guild.id, channelId: channel.id, adapterCreator: message.guild.voiceAdapterCreator, daveEncryption: true });
      await entersState(voice, VoiceConnectionStatus.Ready, 20000);
      if (session.generation !== generation) return;
      voice.subscribe(session.player);
      clearTimeout(session.idleTimer);
      session.queue.push({ title: info.title, url: info.webpage_url, duration: info.duration, artist: info.artist || (info.channel || info.uploader ? `Canal: ${info.channel || info.uploader}` : undefined), request: message });
      if (session.player.state.status === AudioPlayerStatus.Idle) (session as typeof session & { next: () => void }).next();
      try {
        if (getSettings().deleteCommands || message.interactionMetadata) await message.delete();
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
        if (code === 10008) return; // O pedido já foi apagado.
        console.warn('Falha ao apagar pedido aceito', { canal: message.channelId, mensagem: message.id, code });
        if ((code === 50013 || code === 50001) && message.channel.isSendable()) {
          const notice = await message.channel.send('Pedido aceito. Para apagar o comando, preciso da permissão **Gerenciar mensagens** neste canal de texto.');
          setTimeout(() => void notice.delete().catch(() => {}), 12000).unref();
        }
      }
    } catch (error) { await reply(error instanceof Error ? error.message : 'Não consegui executar o comando.'); }
  };
  client.on(Events.MessageCreate, handleMessage);
  const handleSlash = async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.inCachedGuild() || !interaction.channel?.isSendable()) return;
    await interaction.deferReply({ flags: 64 });
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const command = interaction.commandName === 'skip' ? 'avancar' : interaction.commandName === 'help' ? 'ajuda' : interaction.commandName;
    const input = interaction.commandName === 'play' ? interaction.options.getString('url', true) : '';
    // Both entry points invoke the same handler and its single session map.
    const request = {
      id: interaction.id,
      interactionMetadata: { id: interaction.id },
      author: interaction.user,
      guild: interaction.guild,
      guildId: interaction.guildId,
      channel: interaction.channel,
      channelId: interaction.channelId,
      member,
      content: `!k4${command} ${input}`,
      reply: async (payload: {content: string}) => {
        await interaction.editReply({ content: payload.content, allowedMentions: { parse: [] } });
      },
      delete: async () => { await interaction.deleteReply(); },
    } as unknown as Message;
    await handleMessage(request);
  };
  function stop(guildId: string) {
    const session = sessions.get(guildId);
    if (!session) return;
    session.generation++;
    session.queue.length = 0;
    session.process?.kill();
    session.player.stop();
    session.current = undefined;
    if (session.player.state.status === AudioPlayerStatus.Idle) scheduleIdle(guildId);
  }
  return Object.assign(handleSlash, {
    stop,
    snapshot: () => ({
      ready: client.isReady(), settings: getSettings(),
      guilds: [...client.guilds.cache.values()].map(guild => {
        const session = sessions.get(guild.id);
        const channelId = getVoiceConnection(guild.id)?.joinConfig.channelId;
        const resource = session && 'resource' in session.player.state ? session.player.state.resource : undefined;
        const summarize = (track: Track) => ({ title: track.title, url: track.url, artist: track.artist, duration: track.duration });
        return { id: guild.id, name: guild.name, channel: channelId ? guild.channels.cache.get(channelId)?.name : null,
          state: session?.player.state.status ?? 'idle', elapsed: resource ? resource.playbackDuration / 1000 : 0,
          current: session?.current ? summarize(session.current) : null, queue: session?.queue.map(summarize) ?? [] };
      }),
    }),
    configure: (input: unknown) => {
      const next = saveSettings(input);
      for (const [id, session] of sessions) {
        if ('resource' in session.player.state) session.player.state.resource.volume?.setVolume(next.volume / 100);
        if (session.idleSince) scheduleIdle(id);
      }
      return next;
    },
    control: (guildId: string, action: string, index?: number) => {
      if (!client.guilds.cache.has(guildId)) throw new Error('Servidor não encontrado.');
      const session = sessions.get(guildId);
      if (action === 'disconnect') { stop(guildId); getVoiceConnection(guildId)?.destroy(); return; }
      if (!session) throw new Error('Nenhuma sessão ativa neste servidor.');
      if (action === 'stop') { stop(guildId); return; }
      if (action === 'clear') { session.queue.length = 0; return; }
      if (action === 'remove') {
        if (!Number.isInteger(index) || index! < 0 || index! >= session.queue.length) throw new Error('Faixa não encontrada na fila.');
        session.queue.splice(index!, 1); return;
      }
      if (!session.current) throw new Error('Nenhuma música ativa.');
      if (action === 'pause') { session.player.pause(); return; }
      if (action === 'resume') { session.player.unpause(); return; }
      if (action === 'skip') { session.process?.kill(); session.player.stop(); return; }
      throw new Error('Ação inválida.');
    },
  });
}
