import { Events, PermissionsBitField, type Client, type Message } from 'discord.js';
import { AudioPlayerStatus, StreamType, VoiceConnectionStatus, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { youtubeDl } from 'youtube-dl-exec';
import { normalize, selectTrack } from './search.js';
import { lookup } from './lookup.js';
import { showPanel } from './panel.js';

type Track = { title: string; url: string; duration?: number; artist?: string; request: Message };
const aliases = new Map([
  ['p', 'play'], ['s', 'stop'], ['a', 'avancar'], ['skip', 'avancar'],
  ['next', 'avancar'], ['avançar', 'avancar'], ['f', 'fila'], ['q', 'fila'],
  ['h', 'ajuda'], ['help', 'ajuda'], ['c', 'comando'],
]);
export function installPrefix(client: Client) {
  const sessions = new Map<string, { queue: Track[]; player: ReturnType<typeof createAudioPlayer>; process?: ReturnType<typeof youtubeDl.exec>; generation: number }>();
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot || !message.guild) return;
    const match = /^!k4(\S*)\s*(.*)$/i.exec(message.content.trim());
    if (!match) return;
    const name = match[1].toLowerCase();
    const command = aliases.get(name) ?? name;
    const reply = (content: string) => message.reply({ content, allowedMentions: { parse: [], repliedUser: false } });
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
        'Spotify: reprodução por link ainda não disponível; use nome + artista ou um link do YouTube.',
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
          if (!track) return;
          const proc = youtubeDl.exec(track.url, { format: 'bestaudio[acodec=opus][ext=webm]', output: '-', noPlaylist: true, quiet: true }, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
          s.process = proc;
          proc.catch(() => { if (s.process === proc && !proc.killed) { void reply('Falha ao obter o áudio. Pulando a faixa.'); s.player.stop(); } });
          if (!proc.stdout) { proc.kill(); return; }
          s.player.play(createAudioResource(proc.stdout, { inputType: StreamType.WebmOpus }));
          showPanel(client, track.request, s.player, track, () => s.queue.length, () => { s.generation++; s.queue.length = 0; s.process?.kill(); s.player.stop(); });
        };
        s.player.on(AudioPlayerStatus.Idle, () => { s.process?.kill(); s.process = undefined; next(); });
        s.player.on('error', () => { void reply('Falha na reprodução.'); s.player.stop(); });
        // Queue starts through a synthetic idle transition only when no audio is active.
        (s as typeof s & { next: () => void }).next = next;
      }
      if (command === 'fila') { await reply(session.queue.map((t, i) => `${i + 1}. ${t.title}`).join('\n').slice(0, 1900) || 'Fila vazia.'); return; }
      if (command === 'stop') { session.generation++; session.queue.length = 0; session.process?.kill(); session.player.stop(); await reply('⏹️ Reprodução parada e fila limpa.'); return; }
      if (command === 'avancar') { session.process?.kill(); session.player.stop(); await reply('⏭️ Avançando para a próxima faixa disponível.'); return; }
      const generation = session.generation;
      const text = match[2].trim().replace(/^<|>$/g, '');
      if (!text) throw new Error('Informe o nome ou link. Exemplo: !K4play rap do minecraft');
      const input = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? new URL(text) : null;
      const query = input ? input.href : `ytsearch5:${normalize(text)}`;
      if (input?.hostname === 'open.spotify.com') {
        const id = /\/track\/([a-zA-Z0-9]+)/.exec(input.pathname)?.[1];
        if (!id) throw new Error('Por enquanto, envie um link de faixa individual do Spotify.');
        const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Não consegui ler essa faixa do Spotify.');
        const data = await response.json() as { title?: string };
        if (!data.title) throw new Error('Spotify não informou o título da faixa.');
        // oEmbed does not reliably provide artist/duration: require confirmation instead of guessing.
        throw new Error(`Faixa Spotify: ${data.title}. Para evitar tocar uma versão errada, envie o link correspondente do YouTube. A correspondência automática ainda não está disponível.`);
      }
      if (input && (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(input.hostname) || input.protocol !== 'https:')) throw new Error('Use um link HTTPS do YouTube ou de uma faixa do Spotify.');
      await reply('Preparando a faixa…');
      const result = await lookup(query);
      let info = input ? result : selectTrack(text, result.entries ?? []);
      if (!input && !info) {
        const fallback = await lookup(`ytsearch5:${normalize(text)} song`);
        info = selectTrack(text, fallback.entries ?? []);
        if (!info && normalize(text).split(' ').length >= 3) {
          const broader = normalize(text).split(' ').slice(0, -1).join(' ');
          const candidates = await lookup(`ytsearch10:${broader}`);
          info = selectTrack(text, candidates.entries ?? []);
        }
      }
      if (!info?.webpage_url) throw new Error('Não encontrei uma música para essa busca. Tente incluir o artista.');
      if (session.generation !== generation) return;
      const permissions = channel.permissionsFor(message.guild.members.me!);
      if (!permissions?.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) throw new Error('Preciso das permissões Conectar e Falar nessa call.');
      const voice = connection ?? joinVoiceChannel({ guildId: message.guild.id, channelId: channel.id, adapterCreator: message.guild.voiceAdapterCreator, daveEncryption: true });
      await entersState(voice, VoiceConnectionStatus.Ready, 20000);
      if (session.generation !== generation) return;
      voice.subscribe(session.player);
      session.queue.push({ title: info.title, url: info.webpage_url, duration: info.duration, artist: info.artist || (info.channel || info.uploader ? `Canal: ${info.channel || info.uploader}` : undefined), request: message });
      if (session.player.state.status === AudioPlayerStatus.Idle) (session as typeof session & { next: () => void }).next();
      else await reply(`Adicionada à fila: ${info.title}`);
    } catch (error) { await reply(error instanceof Error ? error.message : 'Não consegui executar o comando.'); }
  });
}
