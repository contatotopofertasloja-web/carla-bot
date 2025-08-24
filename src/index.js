// src/index.js
import 'dotenv/config';
import express from 'express';
import { withRateLimit } from './middlewares/rateLimit.js';
import { bot } from './bot.js';
import { startBaileys, getQrDataURL, isWppReady } from './wpp.js';
// --- QR support (coloque perto das outras imports) ---



const app = express();

// Middlewares básicos
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// QR do WhatsApp (HTML simples) — opcional token via query (?token=...)
app.get('/wpp/qr', async (req, res) => {
  try {
    const token = process.env.WEBHOOK_TOKEN || '';
    if (token && req.query.token !== token) {
      res.status(401).send('unauthorized');
      return;
    }

    if (isWppReady()) {
      res.type('text').send('WPP já conectado ✅');
      return;
    }

    const dataUrl = await getQrDataURL();
    if (!dataUrl) {
      res.type('text').send('Aguardando QR ser gerado... atualize em 2–3s');
      return;
    }

    const html = `
      <html><body>
        <h3>Escaneie o QR no WhatsApp &gt; Dispositivos conectados</h3>
        <img src="${dataUrl}" style="width:300px;height:300px" />
      </body></html>`;
    res.type('html').send(html);
  } catch (e) {
    console.error('[WPP][QR][ERR]', e);
    res.status(500).send('erro ao gerar QR');
  }
});

// Webhook universal (compatível com seu formato e Meta-like)
app.post('/webhook', withRateLimit({ windowMs: 3000 }), async (req, res) => {
  const started = Date.now();
  try {
    let userId, text;
    const context = req.body?.context || {};

    // Formato “nosso”
    if (req.body?.userId && typeof req.body?.text === 'string') {
      userId = String(req.body.userId);
      text = String(req.body.text || '');
    }
    // Formato Meta-like
    else if (Array.isArray(req.body?.entry)) {
      const entry = req.body.entry[0];
      const change = entry?.changes?.[0];
      const m = change?.value?.messages?.[0];
      userId = m?.from;
      text = m?.text?.body || '';
    }

    if (!userId || !String(text).trim()) {
      res.status(400).json({ error: 'invalid payload', got: req.body });
      return;
    }

    const reply = await bot.handleMessage({ userId, text, context });
    res.json({ reply, took_ms: Date.now() - started });
  } catch (err) {
    console.error('[WEBHOOK][ERR]', err);
    res.json({
      reply: 'Tivemos uma instabilidade rápida aqui. Posso te ajudar por aqui mesmo? 😊',
      fallback: true
    });
  }
});

// Start HTTP (local: 127.0.0.1; na Railway use HOST=0.0.0.0)
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => {
  console.log(`[HTTP] Listening on ${host}:${port}`);
});

// Start Baileys (WhatsApp)
startBaileys({
  onMessage: async ({ from, text }) => {
    const reply = await bot.handleMessage({ userId: from, text, context: {} });
    return reply;
  }
}).catch(err => console.error('[WPP][BOOT][ERR]', err));

server.on('error', (err) => console.error('[HTTP][ERROR]', err?.message || err));
process.on('uncaughtException', (err) => console.error('[UNCAUGHT]', err));
process.on('unhandledRejection', (r) => console.error('[UNHANDLED]', r));
