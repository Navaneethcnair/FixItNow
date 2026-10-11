/**
 * Persistent user store for local/mock mode.
 * Users are written to a JSON file on disk so they survive Next.js hot-reloads and restarts.
 * Pre-seeded accounts are always merged in on first read.
 */
import fs from 'fs';
import path from 'path';

const STORE_PATH = path.join(process.cwd(), '.local-users.json');

const SEED_USERS: Record<string, any> = {
  'customer@example.com': {
    id: 'local-user',
    email: 'customer@example.com',
    password: 'password',
    full_name: 'Local User',
    role: 'customer',
    phone: '+91 98765 43210',
  },
  'worker@example.com': {
    id: 'w1',
    email: 'worker@example.com',
    password: 'password',
    full_name: 'Rajesh Kumar',
    role: 'worker',
    phone: '+91 98765 11111',
  },
};

function readStore(): Record<string, any> {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      // Always make sure seed accounts exist
      return { ...SEED_USERS, ...parsed };
    }
  } catch {
    // If file is corrupt just reset
  }
  return { ...SEED_USERS };
}

function writeStore(data: Record<string, any>): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[userStore] Failed to write user store:', e);
  }
}

export function getUser(email: string): any | null {
  const store = readStore();
  return store[email] ?? null;
}

export function userExists(email: string): boolean {
  const store = readStore();
  return !!store[email];
}

export function createUser(user: {
  id: string;
  email: string;
  password: string;
  full_name: string;
  role: string;
  phone?: string;
}): void {
  const store = readStore();
  store[user.email] = user;
  writeStore(store);
}

export function getAllUsers(): any[] {
  const store = readStore();
  return Object.values(store);
}
