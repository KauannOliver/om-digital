import dotenv from 'dotenv';

export function loadBackendEnv() {
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: '.env' });
}
