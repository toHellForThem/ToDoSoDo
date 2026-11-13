/**
 * Проверяет, что типы и имена событий фронтенда соответствуют
 * экспортированному контракту бэкенда (`backend/contracts`).
 *
 * Запуск: `npm run contract:check`.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contractsDir = resolve(root, '..', 'backend', 'contracts');

const readJson = (name) =>
  JSON.parse(readFileSync(resolve(contractsDir, name), 'utf8'));

const eventsJson = readJson('events.json');
const eventsTs = readFileSync(resolve(root, 'src', 'contract', 'events.ts'), 'utf8');
const typesTs = readFileSync(resolve(root, 'src', 'contract', 'types.ts'), 'utf8');

const extractEventValues = (name) => {
  const match = eventsTs.match(
    new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\} as const;`)
  );
  if (!match) {
    throw new Error(`Не найден блок ${name} в src/contract/events.ts`);
  }
  return [...match[1].matchAll(/:\s*'([^']+)'/g)].map((item) => item[1]);
};

const compare = (actual, expected, label) => {
  const missing = expected.filter((value) => !actual.includes(value));
  const extra = actual.filter((value) => !expected.includes(value));
  if (missing.length || extra.length) {
    console.error(`${label}: missing=[${missing.join(', ')}] extra=[${extra.join(', ')}]`);
    return false;
  }
  return true;
};

let ok = true;
ok = compare(
  extractEventValues('ClientEvent'),
  Object.values(eventsJson.client_events),
  'client_events'
) && ok;
ok = compare(
  extractEventValues('ServerEvent'),
  Object.values(eventsJson.server_events),
  'server_events'
) && ok;

const ackMatch = eventsTs.match(/export const ACK_STATUSES = \[([\s\S]*?)\] as const;/);
const ackStatuses = ackMatch
  ? [...ackMatch[1].matchAll(/'([^']+)'/g)].map((item) => item[1])
  : [];
ok = compare(ackStatuses, eventsJson.ack_statuses, 'ack_statuses') && ok;

const checkFields = (schemaFile, typeName) => {
  const schema = readJson(schemaFile);
  const fields = Object.keys(schema.properties || {});
  const missing = fields.filter(
    (field) => !new RegExp(`\\b${field}\\b`).test(typesTs)
  );
  if (missing.length) {
    console.error(`${typeName}: missing fields [${missing.join(', ')}]`);
    return false;
  }
  return true;
};

ok = checkFields('todo.schema.json', 'Todo') && ok;
ok = checkFields('daily_history.schema.json', 'DailyHistory') && ok;
ok = checkFields('user_settings.schema.json', 'UserSettings') && ok;

if (!ok) {
  process.exit(1);
}

console.log('Контракт фронтенда соответствует backend/contracts.');
