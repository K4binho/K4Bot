function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('cole_') || value.startsWith('id_')) {
    throw new Error(`Configure ${name} no arquivo .env com o valor real do Discord.`);
  }
  return value;
}

export const env = {
  token: required('DISCORD_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  guildId: required('DISCORD_GUILD_ID'),
};

if (!/^\d{17,20}$/.test(env.clientId)) {
  throw new Error('DISCORD_CLIENT_ID precisa ser o ID numérico da aplicação.');
}

if (!/^\d{17,20}$/.test(env.guildId)) {
  throw new Error('DISCORD_GUILD_ID precisa ser o ID numérico do servidor Discord, não a chave pública.');
}
