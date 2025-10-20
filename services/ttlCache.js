const caches = new Map();

function getDefaultTTL() {
  const v = Number(process.env.CACHE_TTL_SECS || 60);
  if (!Number.isFinite(v) || v <= 0) return 60;
  return v;
}

function createCache(name) {
  const store = new Map(); // key -> { value, expiresAt }
  let hits = 0;
  let misses = 0;

  return {
    get(key) {
      const now = Date.now();
      const ent = store.get(key);
      if (ent && ent.expiresAt > now) {
        hits += 1;
        console.log(`[cache:${name}] hit key=${key} hits=${hits} misses=${misses}`);
        return ent.value;
      }
      misses += 1;
      console.log(`[cache:${name}] miss key=${key} hits=${hits} misses=${misses}`);
      return null;
    },
    set(key, value, ttlSecs) {
      const ttl = Number.isFinite(ttlSecs) && ttlSecs > 0 ? ttlSecs : getDefaultTTL();
      store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
      console.log(`[cache:${name}] set key=${key} ttl=${ttl}s size=${store.size}`);
    },
    invalidateKey(key) {
      store.delete(key);
      console.log(`[cache:${name}] invalidate key=${key}`);
    },
    invalidateAll() {
      store.clear();
      console.log(`[cache:${name}] invalidateAll`);
    },
    stats() {
      return { hits, misses, size: store.size };
    },
  };
}

function getCache(name) {
  let c = caches.get(name);
  if (!c) {
    c = createCache(name);
    caches.set(name, c);
  }
  return c;
}

function resetAll() {
  caches.clear();
}

module.exports = { getCache, resetAll, getDefaultTTL };