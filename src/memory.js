// src/memory.js
// Armazenamento em memória com TTL (para MVP). Em produção, trocar por Redis.

const TTL_MS = Number(process.env.MEMORY_TTL_DAYS || 7) * 24 * 60 * 60 * 1000;
const store = new Map();

/**
 * Lê a memória do usuário (se expirar, apaga).
 */
export async function getMemory(userId) {
  const item = store.get(userId);
  if (!item) return null;
  if (Date.now() - item.savedAt > TTL_MS) {
    store.delete(userId);
    return null;
  }
  return item.data;
}

/**
 * Grava a memória do usuário.
 */
export async function setMemory(userId, data) {
  store.set(userId, { data, savedAt: Date.now() });
}
