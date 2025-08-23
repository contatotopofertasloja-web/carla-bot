import 'dotenv/config';
import express from 'express';
import { bot } from './bot.js';
import { withRateLimit } from './middlewares/rateLimit.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (_, res) => res.type('text').send('OK'));
app.get('/health', (_, res) => res.json({ ok: true }));

// Webhook que seu conector de WhatsApp chamará
app.post('/webhook', withRateLimit({ windowMs: 3000 }), async (req, res) => {
  const started = Date.now();
  try {
    const { userId = 'unknown', text = '', context = {} } = req.body || {};
    const reply = await bot.handleMessage({ userId, text, context });
    const ms = Date.now() - started;
    return res.json({ reply, took_ms: ms });
  } catch (err) {
    console.error('[WEBHOOK][ERR]', err);
    return res.json({
      reply: 'Tivemos uma instabilidade rápida aqui. Posso te ajudar por aqui mesmo? 😊',
      fallback: true
    });
  }
});
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`[HTTP] Listening on ${host}:${port}`);
});
