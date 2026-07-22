const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://cogniqai.bothost.tech';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const SUPPORT_OWNER_ID = process.env.SUPPORT_OWNER_ID || '';

if (!BOT_TOKEN) { console.error('BOT_TOKEN is not set'); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const pool = new Pool({ connectionString: DATABASE_URL, ssl: false });

pool.query(`CREATE TABLE IF NOT EXISTS user_langs (user_id BIGINT PRIMARY KEY, lang VARCHAR(5))`);
pool.query(`CREATE TABLE IF NOT EXISTS user_avatars (user_id BIGINT PRIMARY KEY, first_name TEXT, tg_photo_file_id TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())`);
pool.query(`CREATE TABLE IF NOT EXISTS support_tickets (id SERIAL PRIMARY KEY, user_id BIGINT, message TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);

const SYSTEM_PROMPT_SUPPORT = `You are COGNIQ AI Support for the NEURON blockchain gaming ecosystem. This is a Telegram Mini App on TON blockchain. Answer in the user's language. Be warm and helpful.

FULL PROJECT FACTS:

TOKEN: COGNIQ (Jetton on TON). Total supply: 5 billion.

QUIZ: 10 questions per game, 2 COGNIQ per correct answer. 10 free games daily. Super Game: x15 rewards, costs 100 Stars or 1 USDT. Streak bonuses: 3 days +20, 7 days +70, 14 days +150, 30 days +350. Daily Question +20 COGNIQ. Channel bonus +50 COGNIQ.

IMPULSE: Gaming hub with IMPULSE currency (1 COGNIQ = 5 IMPULSE). Games: FORTUNA (roulette), SPARK (slots), XXI (blackjack), KRASH (crash), MINES (minesweeper). Daily bonus 500 IMPULSE.

BANK: Staking 30/60/90 days (5/12/20%). USDT→COGNIQ exchange (1 USDT = 200 COGNIQ). Player transfers (1% fee).

EXCHANGE: Crypto pairs (TON, USDT, BTC, XAUt0/Gold). xStocks (AAPLx, NVDAx, TSLAx, AMZNx, SPYx). Gas fee: 5 COGNIQ.

SHOP: Basic pack (+10 games). VIP 7 days (+10 games/day, VIP frame). PREMIUM 30 days (+10 games/day, PREMIUM frame). Avatar frames: Basic, Cartier, Cartier Gold.

BETA PROGRAM: First 100 testers get 1000 COGNIQ. Join via https://neuron1.bothost.tech/beta.html

BOT: @NeuronGame_bot
CHANNEL: @neuron_game_club
WHITEPAPER: https://neuron1.bothost.tech/whitepaper.html
SUPPORT OWNER: @brotherly_heart1`;

const SYSTEM_PROMPT_CHAT = `You are a friendly and warm conversational partner. You can talk about anything: life, love, space, science, cooking, movies, music. Be kind, supportive, and keep responses to 2-3 sentences. Answer in the user's language.`;

const LANG = {
  ru: { welcome: (name) => `🛟 Привет, ${name}! Я поддержка NEURON.`, support_btn: '🛟 Открыть центр поддержки' },
  en: { welcome: (name) => `🛟 Hi, ${name}! I'm NEURON support.`, support_btn: '🛟 Open Support Center' },
  fr: { welcome: (name) => `🛟 Salut, ${name}! Je suis le support NEURON.`, support_btn: '🛟 Ouvrir le centre de support' },
  es: { welcome: (name) => `🛟 ¡Hola, ${name}! Soy el soporte de NEURON.`, support_btn: '🛟 Abrir centro de soporte' }
};

async function askAI(question, mode) {
  const systemPrompt = mode === 'chat' ? SYSTEM_PROMPT_CHAT : SYSTEM_PROMPT_SUPPORT;
  
  // Уровень 1: OpenRouter
  if (OPENROUTER_API_KEY) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://cogniqai.bothost.tech',
          'X-Title': 'COGNIQ Support Bot'
        },
        body: JSON.stringify({
          model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
          ]
        })
      });
      const data = await response.json();
      if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    } catch(e) {}
  }
  
  // Уровень 2: YandexGPT
  const apiKey = process.env.YANDEXGPT_API_KEY || '';
  const folderId = process.env.YANDEX_FOLDER_ID || process.env.YANDEXGPT_FOLDER_ID || '';
  
  if (apiKey && folderId) {
    try {
      const response = await fetch('https://ai.api.cloud.yandex.net/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`,
          'OpenAI-Project': folderId
        },
        body: JSON.stringify({
          model: `gpt://${folderId}/yandexgpt-5-lite/latest`,
          instructions: systemPrompt,
          input: question,
          temperature: 0.3,
          max_output_tokens: 500
        })
      });
      const data = await response.json();
      if (data.output?.[0]?.content?.[0]?.text) return data.output[0].content[0].text;
    } catch(e) {}
  }
  
  return null;
}

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name || ctx.from.username || 'User';
  
  let langCode = 'en';
  let strings = LANG['en'];
  try {
    const { rows } = await pool.query('SELECT lang FROM user_langs WHERE user_id = $1', [userId]);
    if (rows[0]?.lang && LANG[rows[0].lang]) {
      langCode = rows[0].lang;
      strings = LANG[rows[0].lang];
    }
  } catch(e) {}

  await ctx.replyWithPhoto({ source: './support_avatar.png' }, {
    caption: strings.welcome(firstName),
    reply_markup: { inline_keyboard: [[{ text: strings.support_btn, web_app: { url: `${WEBAPP_URL}?lang=${langCode}&user_id=${userId}` } }]] }
  });
});

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.url.startsWith('/api/user-info') && req.method === 'GET') {
    const urlParams = new URL(req.url, 'http://localhost');
    const userId = urlParams.searchParams.get('user_id');
    if (!userId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'No user_id' })); }
    try {
      const photos = await bot.telegram.getUserProfilePhotos(userId, { limit: 1 });
      const fileId = photos?.photos?.[0]?.[0]?.file_id || null;
      let firstName = 'User';
      try { const chat = await bot.telegram.getChat(userId); firstName = chat.first_name || chat.username || 'User'; } catch(e) {}
      await pool.query(
        `INSERT INTO user_avatars (user_id, first_name, tg_photo_file_id, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (user_id) DO UPDATE SET first_name = $2, tg_photo_file_id = $3, updated_at = NOW()`,
        [userId, firstName, fileId]
      );
      let avatarUrl = null;
      if (fileId) { try { const file = await bot.telegram.getFile(fileId); avatarUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`; } catch(e) {} }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ name: firstName, avatar: avatarUrl }));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: 'Server error' })); }
    return;
  }

  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const reply = await askAI(data.message || '', data.mode || 'support');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: reply || 'Извините, я не смог ответить. Попробуйте позже.' }));
      } catch(e) { res.writeHead(500); res.end(JSON.stringify({ reply: 'Ошибка сервера.' })); }
    });
    return;
  }

  if (req.url === '/api/ticket' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (data.user_id && data.message) {
          await pool.query('INSERT INTO support_tickets (user_id, message) VALUES ($1, $2)', [data.user_id, data.message]);
          if (SUPPORT_OWNER_ID) {
            bot.telegram.sendMessage(SUPPORT_OWNER_ID, `📩 Новый тикет от ${data.user_id}:\n\n${data.message}`);
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) { res.writeHead(500); res.end(JSON.stringify({ ok: false })); }
    });
    return;
  }

  if (req.url === '/' || req.url.startsWith('/?') || req.url === '/support.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'support.html')));
  } else if (req.url === '/support_avatar.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_avatar.png')));
  } else if (req.url === '/support_bg.webp') {
    res.writeHead(200, { 'Content-Type': 'image/webp' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_bg.webp')));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('COGNIQ AI Support');
  }
}).listen(3000, () => console.log('HTTP on 3000'));

bot.launch();
console.log('Support bot started');
