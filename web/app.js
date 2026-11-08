for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const value = button.dataset.copy;
    try {
      await navigator.clipboard.writeText(value);
      document.querySelector('#feedback').textContent = 'Comando copiado. Cole no chat do Discord.';
    } catch {
      window.prompt('Copie o comando para usar no Discord', value);
    }
  });
}
if (location.hostname === 'k4binho.js' || location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
  fetch('/api/status').then(r => r.ok ? r.json() : Promise.reject()).then(data => {
    document.querySelector('#runtime').textContent = data.ready ? 'Conectado ao Discord · Kubinho.Js' : 'Página local ativa · bot desconectado';
  }).catch(() => {});
}
