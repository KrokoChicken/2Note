import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
export const db = drizzle(neon(process.env.DATABASE_URL));