// src/middlewares/rateLimit.js
const hits = new Map();

export function withRateLimit({ windowMs = 3000, max = 5 } = {}) {
  return (req, res, next) => {
    try {
      const key = req.body?.userId || req.ip || 'anon';
      const now = Date.now();
      const arr = hits.get(key) || [];
      const recent = arr.filter((t) => now - t < windowMs);
      recent.push(now);
      hits.set(key, recent);
      if (recent.length > max) {
        return res.json({ reply: 'Rapidinho: só me manda uma mensagem por vez 😉', rate_limited: true });
      }
    } catch (_) {
      // Se algo der errado, não bloqueia o fluxo
    }
    next();
  };
}
