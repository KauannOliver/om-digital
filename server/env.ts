import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let loaded = false;

export function loadBackendEnv() {
  if (loaded) return;
  loaded = true;

  const serverEnvPath = path.resolve(__dirname, '.env');
  const rootEnvPath = path.resolve(__dirname, '..', '.env');

  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
  }

  if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath, override: true });
  }
}