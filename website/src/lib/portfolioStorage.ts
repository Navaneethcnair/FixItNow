/**
 * portfolioStorage.ts
 * Cross-browser resilient storage for worker portfolio data.
 * Falls back: localStorage -> sessionStorage -> IndexedDB -> in-memory Map
 * Compatible with Edge (Tracking Prevention), Brave, Chrome, Firefox, Safari.
 */

// In-memory fallback for when all persistent storage is blocked
const memoryStore = new Map<string, string>();

// Detect if storage is available and not blocked (Edge Tracking Prevention can block it)
function isStorageAvailable(type: 'localStorage' | 'sessionStorage'): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__fixitnow_storage_test__';
    const storage = window[type];
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

let _localStorageOk: boolean | null = null;
let _sessionStorageOk: boolean | null = null;

function localStorageOk(): boolean {
  if (_localStorageOk === null) _localStorageOk = isStorageAvailable('localStorage');
  return _localStorageOk;
}
function sessionStorageOk(): boolean {
  if (_sessionStorageOk === null) _sessionStorageOk = isStorageAvailable('sessionStorage');
  return _sessionStorageOk;
}

// IndexedDB helper (async, works in Edge even with Tracking Prevention)
const IDB_DB = 'fixitnow_idb';
const IDB_STORE = 'portfolio';

let _idb: IDBDatabase | null = null;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (_idb) return resolve(_idb);
    if (typeof indexedDB === 'undefined') return reject(new Error('No IDB'));

    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => {
      _idb = req.result;
      resolve(_idb);
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

/**
 * Save portfolio data for a worker (resilient across all browsers).
 */
export async function savePortfolio(workerId: string, portfolio: any[]): Promise<void> {
  const key = `fixitnow_portfolio_${workerId}`;
  const json = JSON.stringify(portfolio);

  // Try localStorage
  if (localStorageOk()) {
    try {
      window.localStorage.setItem(key, json);
    } catch {}
  }

  // Also write to sessionStorage as cross-tab backup
  if (sessionStorageOk()) {
    try {
      window.sessionStorage.setItem(key, json);
    } catch {}
  }

  // Write to IndexedDB (works even when Edge blocks localStorage)
  await idbSet(key, json);

  // Write to memory store as last resort
  memoryStore.set(key, json);
}

/**
 * Load portfolio data for a worker. Returns null if not found anywhere.
 */
export async function loadPortfolio(workerId: string): Promise<any[] | null> {
  const key = `fixitnow_portfolio_${workerId}`;

  // 1. Try localStorage (fastest)
  if (localStorageOk()) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }

  // 2. Try sessionStorage
  if (sessionStorageOk()) {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }

  // 3. Try IndexedDB (Edge-compatible even with Tracking Prevention on)
  try {
    const raw = await idbGet(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Back-fill faster stores
        if (localStorageOk()) {
          try { window.localStorage.setItem(key, raw); } catch {}
        }
        if (sessionStorageOk()) {
          try { window.sessionStorage.setItem(key, raw); } catch {}
        }
        return parsed;
      }
    }
  } catch {}

  // 4. In-memory fallback
  const memRaw = memoryStore.get(key);
  if (memRaw) {
    try {
      const parsed = JSON.parse(memRaw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return null;
}
