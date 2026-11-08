const $ = id => document.getElementById(id);
let data, token, dirty = false, busy = false;
const format = value => Number.isFinite(value) ? Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0') : '—';
const selected = () => data?.guilds.find(g => g.id === $('guild').value);
function render() {
  const guild = selected();
  const active = !!guild?.current;
  $('track').textContent = guild?.current?.title ?? 'Nenhuma música ativa';
  $('artist').textContent = guild?.current?.artist ?? '';
  $('voice').textContent = guild?.channel ? 'Canal de voz · ' + guild.channel : 'Fora da call';
  $('progress').max = guild?.current?.duration || 1;
  $('progress').value = guild?.elapsed || 0;
  $('elapsed').textContent = format(guild?.elapsed || 0);
  $('duration').textContent = format(guild?.current?.duration);
  $('pause').textContent = guild?.state === 'paused' ? 'Continuar' : 'Pausar';
  $('pause').dataset.action = guild?.state === 'paused' ? 'resume' : 'pause';
  for (const button of document.querySelectorAll('[data-action]')) button.disabled = busy || !data?.available || !data?.ready || !guild ||
    (['pause','resume','skip','stop'].includes(button.dataset.action) && !active) ||
    (button.dataset.action === 'disconnect' && !guild.channel) || (button.dataset.action === 'clear' && !guild.queue.length);
  $('count').textContent = guild?.queue.length ?? 0;
  $('queue').replaceChildren();
  if (!guild?.queue.length) { const empty = document.createElement('li'); empty.textContent = 'Fila vazia. Peça uma música no Discord.'; empty.className = 'empty'; $('queue').append(empty); }
  for (const [index, track] of (guild?.queue ?? []).entries()) {
    const item = document.createElement('li'); const text = document.createElement('span'); text.textContent = (index + 1) + '. ' + track.title;
    const details = document.createElement('small'); details.textContent = [track.artist, format(track.duration)].filter(Boolean).join(' · '); text.append(details);
    const remove = document.createElement('button'); remove.textContent = 'Remover'; remove.disabled = busy; remove.onclick = () => control('remove', index); item.append(text,remove); $('queue').append(item);
  }
}
async function refresh() {
  try {
    const response = await fetch('/api/dashboard', {cache:'no-store'}); if (!response.ok) throw Error('Servidor indisponível.');
    data = await response.json(); token = data.token;
    $('connection').textContent = data.available ? (data.ready ? '● Discord conectado' : '○ Discord desconectado') : '○ Bot indisponível';
    const ids = data.guilds.map(g => g.id).join(',');
    if ($('guild').dataset.ids !== ids) {
      const old = $('guild').value; $('guild').replaceChildren();
      for (const guild of data.guilds) { const option = document.createElement('option'); option.value = guild.id; option.textContent = guild.name; $('guild').append(option); }
      if (data.guilds.some(g => g.id === old)) $('guild').value = old; $('guild').dataset.ids = ids;
    }
    $('settings').querySelectorAll('input,button').forEach(el => el.disabled = !data.available || !data.ready || busy);
    if (!dirty && data.settings) { $('volume').value = data.settings.volume; $('volume-label').textContent = data.settings.volume + '%'; $('idle').value = data.settings.idleMinutes; $('delete').checked = data.settings.deleteCommands; }
    render();
    if (!data.available) $('feedback').textContent = 'Inicie o K4Bot para acessar os controles e as configurações. Esta página está aberta sem a sessão do bot.';
  } catch { $('connection').textContent = '○ Sem conexão'; document.querySelectorAll('button').forEach(button => button.disabled = true); }
}
async function post(path, body) {
  const response = await fetch(path, {method:'POST',headers:{'Content-Type':'application/json','X-K4-Token':token},body:JSON.stringify(body)});
  const result = await response.json(); if (!response.ok) throw Error(result.error || 'Não foi possível executar.');
}
async function control(action, index) {
  if (busy || !selected()) return; busy = true; render();
  try { await post('/api/control',{guildId:$('guild').value,action,index}); $('feedback').textContent = 'Ação aplicada.'; }
  catch(error) { $('feedback').textContent = error.message; }
  finally { busy = false; await refresh(); }
}
$('guild').onchange = render;
for (const button of document.querySelectorAll('[data-action]')) button.onclick = () => control(button.dataset.action);
$('volume').oninput = () => { dirty = true; $('volume-label').textContent = $('volume').value + '%'; };
$('idle').oninput = $('delete').onchange = () => {dirty = true;};
$('settings').onsubmit = async event => {
  event.preventDefault(); if (busy) return; busy = true;
  try { await post('/api/settings',{volume:Number($('volume').value),idleMinutes:Number($('idle').value),deleteCommands:$('delete').checked}); dirty=false; $('feedback').textContent='Configurações salvas e aplicadas.'; }
  catch(error) { $('feedback').textContent = error.message; }
  finally { busy=false; await refresh(); }
};
async function poll() { await refresh(); setTimeout(poll,3000); }
poll();
