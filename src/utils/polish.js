// src/utils/polish.js — versão refinada (variações naturais + 1 pergunta + SEM pedir link)

// ----------------- Config -----------------
const EMOJI_REGEX =
  /([\u203C-\u3299]|\u00A9|\u00AE|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

// pools de perguntas de encerramento (sem falar de link)
const CLOSINGS = {
  default: [
    'Posso te ajudar em mais alguma coisa? 💕',
    'Ficou com alguma dúvida que eu possa esclarecer?',
    'Quer que eu detalhe mais algum ponto pra você ficar tranquila?',
    'Me diz, ficou algo em aberto que eu posso explicar melhor?',
    'Te ajudo em algo mais antes de seguir?',
    'Quer mais algum detalhe sobre o produto?',
    'Precisa que eu explique algo a mais?😉',
    'Posso te contar mais alguma coisa pra te deixar segura?',
    'Tem mais alguma perguntinha que eu possa responder?',
    'Caso precise de mais alguma informação sobre o produto, estou à disposição?',

  ],
  need_name: [
    'E o seu nome, qual é?',
    'Como posso te chamar?',
    'Qual é o seu nome pra eu te atender melhor?'
  ],
  hair_type: [
    'Seu cabelo é liso, ondulado, cacheado ou crespo?',
    'Me conta: liso, ondulado, cacheado ou crespo?',
    'Qual é o seu tipo de cabelo hoje?'
  ],
  pain: [
    'Qual a maior dificuldade hoje: frizz, volume ou alinhamento?',
    'O que mais te incomoda: frizz, volume ou alinhamento?',
    'Quer focar em frizz, volume ou alinhamento?'
  ],
  // “offer” e “close” ficam neutros (sem mencionar link)
  offer: [
    'Quer que eu detalhe como funciona na prática?',
    'Te explico mais algum ponto antes de decidir?',
    'Posso te orientar no passo a passo?'
  ],
  close: [
    'Te ajudo com mais alguma dúvida antes de concluir?',
    'Quer que eu recapitule os pontos principais?',
    'Ficou tudo claro ou prefere que eu detalhe mais um pouco?'
  ],
  postsale: [
    'Quer que eu te avise quando sair para entrega?',
    'Prefere que eu acompanhe e te atualize do status?',
    'Te notifico quando estiver a caminho, combinado?'
  ]
};

// termos proibidos em perguntas de encerramento
const BAN_WORDS = /\b(link|checkout|finalizar|pagar|pagamento|comprar|adquirir)\b/i;

// ----------------- Helpers -----------------
function rand(arr = []) {
  if (!arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function clampEmojis(str, max = 2) {
  const all = [...str.matchAll(EMOJI_REGEX)];
  if (all.length <= max) return str;
  let kept = 0;
  return str.replace(EMOJI_REGEX, () => (++kept <= max ? '$$KEEP$$' : ''));
}
function restoreKeep(str) {
  return str.replace(/\$\$KEEP\$\$/g, (m) => m && m.replace('$$KEEP$$', ''));
}

function limitSentences(str, max = 2) {
  const parts = str
    .split(/(?<=[\.\!\?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = parts.slice(0, max).join(' ');
  return out || str.trim();
}

function oneQuestionOnly(str = '') {
  const s = String(str || '');
  const q = s.split('?');
  if (q.length <= 2) return s.trim();
  return (q.slice(0, 2).join('?') + (s.endsWith('?') ? '?' : '')).trim();
}

// seleciona um fechamento aleatório seguro (sem palavras banidas)
export function getRandomClosingQuestion(hint = 'default') {
  const key = (hint || 'default').toLowerCase();
  const pool = Array.isArray(CLOSINGS[key]) && CLOSINGS[key].length ? CLOSINGS[key] : CLOSINGS.default;

  // tenta até achar um que não contenha termos banidos
  for (let i = 0; i < 5; i++) {
    const c = rand(pool);
    if (!BAN_WORDS.test(c)) return c;
  }
  // fallback absoluto
  return 'Quer que eu te ajude com mais alguma dúvida?';
}

// pequena variação de frases de abertura comuns para evitar repetição literal
function varyCommonOpenings(text = '') {
  const variants = [
    { re: /\bPode ficar tranquila\b/gi, alts: ['Fica sossegada', 'Pode ficar de boas', 'Relaxa, tá tudo certo'] },
    { re: /\bTudo bem\b/gi, alts: ['Tudo certo', 'Suave', 'De boa'] }
  ];
  let out = text;
  for (const v of variants) {
    if (v.re.test(out)) out = out.replace(v.re, rand(v.alts));
  }
  return out;
}

// ----------------- Polimento principal -----------------
export function polishReply(
  text,
  { maxSentences = 2, maxEmojis = 2, forceOneQuestion = true, closingHint = 'default' } = {}
) {
  if (!text) return '';

  // normalização básica
  let out = text.replace(/\s+/g, ' ').replace(/\s([!?.,;:])/g, '$1').trim();

  // micro-variação pra não soar repetido
  out = varyCommonOpenings(out);

  // limitar frases
  out = limitSentences(out, maxSentences);

  // garantir 1 pergunta
  if (forceOneQuestion) out = oneQuestionOnly(out);

  // limitar emojis
  out = clampEmojis(out, maxEmojis);
  out = restoreKeep(out);

  // se não terminar com interrogação, acrescenta pergunta de fechamento segura (sem “link”)
  if (!/[!?]\s*$/.test(out)) {
    const q = getRandomClosingQuestion(closingHint);
    if (out.endsWith('.') || out.endsWith('!')) out = out.slice(0, -1);
    out = `${out}. ${q}`;
  }

  // nunca permitir fechamento que peça link explicitamente
  if (BAN_WORDS.test(out)) {
    const q = getRandomClosingQuestion('default');
    out = out.replace(BAN_WORDS, '').trim();
    if (!/[!?]\s*$/.test(out)) out = `${out} ${q}`;
  }

  return out.trim();
}
