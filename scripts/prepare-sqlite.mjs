import 'dotenv/config';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith('file:')) {
  throw new Error('Set DATABASE_URL to a local SQLite file URL in .env.');
}

const configuredPath = decodeURIComponent(databaseUrl.slice('file:'.length).split('?')[0]);
if (!configuredPath || configuredPath === ':memory:') {
  throw new Error('DATABASE_URL must point to a persistent local SQLite file.');
}

// Prisma 7 resolves this project's relative SQLite URL from the project root.
// Creating the empty file first avoids a schema-engine error on a fresh checkout.
const databasePath = resolve(configuredPath);
mkdirSync(dirname(databasePath), { recursive: true });
try {
  const descriptor = openSync(databasePath, 'wx');
  closeSync(descriptor);
  console.log('Created the local SQLite file.');
} catch (error) {
  // Exclusive creation preserves existing data, including when two setups race.
  if (error.code !== 'EEXIST') throw error;
}
