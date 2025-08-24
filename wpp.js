// src/wpp.js — Node 18 compat (WebCrypto) + Baileys + typing + readMessages
import { webcrypto } from 'crypto';
import qrcode from 'qrcode';
import fs from 'fs';

// ---- Typing helpers ----
const msPerChar = Number(process.env.TYPING_MS_PER_CHAR || 35); // ms por caractere
const minMs = Number(process.env.TYPING_MIN_MS || 800);         // mínimo
const maxMs = Number(process.env.TYPING_MAX_MS || 5000);        // máximo
function calcTypingMs(text) {
  const len = Math.max(1, String(text || '').length);
  return Math.min(maxMs, Math.max(minMs, len * msPerChar));
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// WebCrypto no Node 18
if (!globalThis.crypto) globalThis.crypto = webcrypto;

// Import dinâmico do Baileys (robusto a variações de export)
const m = await import('@whiskeysockets/baileys');
const makeWASocket =
  (m && (m.default?.default || m.default)) || // alguns empacotamentos expõem default.default
  m.makeWASocket ||                           // nomeado
  m.default;                                  // fallback
const { useMultiFileAuthState, fetchLatestBaileysVersion } = m;

const AUTH_DIR = process.env.WPP_AUTH_DIR || '/app/baileys-auth';

// Extrai texto de diferentes tipos de mensagem
function extractText(msgWrap) {
  const msg = msgWrap?.message || {};
  return (
    msg.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    ''
  );
}

let sock = null;
let qrCodeData = null;
let wppReady = false;

export function isWppReady() { return wppReady; }
export async function getQrDataURL() { return qrCodeData ? qrcode.toDataURL(qrCodeData) : null; }
export function getSock() { return sock; }

async function simulateTyping(socket, to, text) {
  try {
    await socket.presenceSubscribe(to);
    await socket.sendPresenceUpdate('composing', to);
    await delay(calcTypingMs(text));
    await socket.sendPresenceUpdate('paused', to);
  } catch (e) {
    console.warn('[WPP][typing][warn]', e?.message || e);
  }
}

export async function startBaileys({ onMessage }) {
  try { fs.mkdirSync(AUTH_DIR, { recursive: true }); } catch {}

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('connection.update', (update) => {
    const { qr, connection, lastDisconnect } = update || {};
    if (qr) { qrCodeData = qr; wppReady = false; console.log('[WPP] QRCode gerado'); }
    if (connection === 'open') { qrCodeData = null; wppReady = true; console.log('[WPP] Conectado com sucesso'); }
    if (connection === 'close') {
      console.log('[WPP] Conexão fechada, tentando reconectar...', lastDisconnect?.error?.message || '');
      setTimeout(() => startBaileys({ onMessage }).catch(console.error), 2000);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ÚNICO handler de mensagens (sem duplicatas)
  sock.ev.on('messages.upsert', async (packet) => {
    try {
      if (packet?.type !== 'notify') return;

      for (const m of packet.messages || []) {
        try {
          if (!m?.message || m?.key?.fromMe) continue;

          const from = m.key.remoteJid;
          const text = extractText(m).trim();
          if (!text) continue;

          console.log(`[MSG] ${from}: ${text}`);

          // marca como lida (quando aplicável)
          try { await sock.readMessages([m.key]); } catch {}

          if (typeof onMessage === 'function') {
            const reply = await onMessage({ from, text, raw: m });
            if (reply && sock) {
              await simulateTyping(sock, from, reply);
              await sock.sendMessage(from, { text: String(reply) });
            }
          }
        } catch (innerErr) {
          console.error('[WPP][ERR][per-message]', innerErr);
        }
      }
    } catch (err) {
      console.error('[WPP][ERR][messages.upsert]', err);
    }
  });

  return sock;
}
