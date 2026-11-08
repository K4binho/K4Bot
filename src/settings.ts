import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type BotSettings = { volume: number; idleMinutes: number; deleteCommands: boolean };
const directory = fileURLToPath(new URL('../.local/', import.meta.url));
const file = directory + '/settings.json';
let settings: BotSettings = { volume: 100, idleMinutes: 3, deleteCommands: true };
function validate(input: unknown): BotSettings {
  const data = input as BotSettings;
  if (!data || !Number.isInteger(data.volume) || data.volume < 0 || data.volume > 150 ||
      !Number.isInteger(data.idleMinutes) || data.idleMinutes < 1 || data.idleMinutes > 60 || typeof data.deleteCommands !== 'boolean') {
    throw new Error('Volume deve ser de 0 a 150, inatividade de 1 a 60 minutos e exclusão deve ser sim ou não.');
  }
  return { volume: data.volume, idleMinutes: data.idleMinutes, deleteCommands: data.deleteCommands };
}
try { if (existsSync(file)) settings = validate(JSON.parse(readFileSync(file, 'utf8'))); }
catch { console.warn('Configuração local inválida. Usando os valores padrão.'); }
export const getSettings = () => ({ ...settings });
export function saveSettings(input: unknown) {
  const next = validate(input);
  mkdirSync(directory, { recursive: true });
  writeFileSync(file + '.tmp', JSON.stringify(next, null, 2), 'utf8');
  renameSync(file + '.tmp', file);
  settings = next;
  return getSettings();
}
