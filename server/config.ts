import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  HOST: process.env.HOST || '0.0.0.0',
  JWT_SECRET: process.env.JWT_SECRET || 'nabiz-secret-super-key-2026-secure',
  DATA_DIR: process.env.DATA_DIR || path.resolve(process.cwd(), 'data'),
  DB_FILE: process.env.DB_FILE || path.resolve(process.cwd(), 'data', 'nabiz.db'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  PUBLIC_URL: process.env.PUBLIC_URL || 'https://nabiz.thedemir.com',
};
