# K4Bot

Veja [recursos atuais, comandos curtos e limitações](PUBLICACAO.md). O bot também aceita `!K4p nome ou link`, fila e controles interativos. Ative **Message Content Intent** e permita **Anexar arquivos** para o player visual.

Bot Discord para anunciar lives, entrar em canal de voz e tocar o áudio de vídeos do YouTube.

## Configuração

1. Crie uma aplicação em <https://discord.com/developers/applications> e adicione um bot.
2. No convite, selecione os escopos `bot` e `applications.commands`.
3. Dê ao bot as permissões `View Channel`, `Connect`, `Speak` e `Send Messages`.
4. Copie `.env.example` para `.env` e preencha os IDs e o token.
5. Instale as dependências: `npm install`.
6. Registre os comandos: `npm run register`.
7. Rode em desenvolvimento: `npm run dev`.

## Comandos

- `/live url:` anuncia que a live está aberta.
- `/join` entra no canal de voz do usuário.
- `/play url:` toca o áudio de um vídeo público do YouTube.
- `/stop` para o áudio.
- `/leave` sai da call.

## Limitação do vídeo

Bots oficiais do Discord não podem transmitir vídeo/tela para uma call como um usuário comum. Por isso, o MVP reproduz o áudio do YouTube. A transmissão de vídeo exigiria uma arquitetura separada, como OBS ou outro emissor autorizado, e não deve usar automação de conta de usuário/self-bot.
