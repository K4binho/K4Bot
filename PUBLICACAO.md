# K4Bot · Kubinho.Js

Bot Discord em desenvolvimento: TypeScript, busca no YouTube por nome ou link, tolerância a erros, fila por servidor e controles Pausar/Continuar, Avançar e Parar. Player renderizado com Sharp e botões nativos.

![Captura real de uma versão anterior do player](docs/discord-player.png)

## Uso

Node.js 24. Copie `.env.example` para `.env` e preencha suas credenciais. Ative Message Content Intent no Developer Portal. Permita enviar mensagens, incorporar links, anexar arquivos, conectar e falar. Execute `npm install`, `npm run build` e `npm start`. Nunca publique `.env`.

- `!K4p nome ou link`: tocar/adicionar à fila.
- `!K4s`: parar e limpar fila.
- `!K4a`: próxima faixa.
- `!K4f`: fila.
- `!K4help`: ajuda.

Spotify automático, AutoPlay, favoritos, repetição e dashboard ainda não estão disponíveis. Fila e estado ficam em memória. A captura mostra o bot real antes do último redesign; o player atual usa uma imagem dinâmica. As edições estão sujeitas aos limites do Discord. Use conteúdo autorizado.
