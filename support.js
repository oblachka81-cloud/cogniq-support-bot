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

// Системный промт для AI — полная база знаний о NEURON
const SYSTEM_PROMPT = `You are COGNIQ AI Support for the NEURON blockchain gaming ecosystem. This is a Telegram Mini App on TON blockchain, NOT a PC game, NOT on Arbitrum, NOT $NEURON token.

OUR PROJECT FACTS:
- Token: COGNIQ (Jetton on TON). NOT $NRN, NOT $NEURON. Total supply: 5 billion.
- Quiz: 10 questions per game, 2 COGNIQ per correct answer. 10 free games daily. 4 languages (RU, EN, FR, ES).
- Super Game: x15 rewards, costs 100 Telegram Stars or 1 USDT. Gives 1 withdrawal ticket. Once per day.
- Replay: 50 COGNIQ to replay Super Game. Once per session.
- Streaks: bonuses for consecutive days. 3 days: +20, 7: +70, 14: +150, 30: +350 COGNIQ.
- IMPULSE gaming hub: 5 games with IMPULSE currency (1 COGNIQ = 5 IMPULSE).
  - FORTUNA: roulette with 9 bet types, bets 10-500 IMPULSE.
  - SPARK: 5-reel slot machine, jackpot x50.
  - XXI: classic blackjack, bets 10-500 IMPULSE.
  - KRASH: crash game with auto-cashout, bets 10-100 IMPULSE.
  - MINES: 5x5 minefield, bets 10-100 IMPULSE.
- Bank: COGNIQ staking (30/60/90 days, 5/12/20% APY), USDT→COGNIQ exchange (1 USDT = 200 COGNIQ), player-to-player transfers (1% fee burned).
- NEURON Exchange: crypto pairs (TON, USDT, BTC, XAUt0/Gold) and xStocks (AAPLx, NVDAx, TSLAx, AMZNx, SPYx). Gas fee: 5 COGNIQ. Powered by STON.fi.
- Shop: Basic pack (+10 games, 150 COGNIQ/100 Stars/1 USDT), VIP (7 days, +10 games/day, 3 USDT/300 Stars), PREMIUM (30 days, +10 games/day, 8 USDT/800 Stars), avatar frames (Basic, Cartier, Cartier Gold for weekly #1).
- Profile: nickname, avatar emoji, privacy mode, achievements (10 types), ranks (Novice to Legend), Telegram photo.
- Wallet: TON Connect, TON/USDT balances, deposit/withdraw/send.
- Referrals: +50 COGNIQ for inviter, +10 for new user.
- Beta program: first 100 testers get 1000 COGNIQ. Join via https://neuron1.bothost.tech/beta.html.
- Channel: @neuron_game_club, daily question, weekly top, PNG cards.
- Whitepaper: https://neuron1.bothost.tech/whitepaper.html.
- Support owner: @brotherly_heart1.
- Bot: @NeuronGame_bot.

Use these facts when answering about NEURON. For other topics, chat freely.`;
const LANG = {
  ru: { welcome: (name) => `🛟 Привет, ${name}! Я поддержка NEURON.`, support_btn: '🛟 Открыть центр поддержки' },
  en: { welcome: (name) => `🛟 Hi, ${name}! I'm NEURON support.`, support_btn: '🛟 Open Support Center' },
  fr: { welcome: (name) => `🛟 Salut, ${name}! Je suis le support NEURON.`, support_btn: '🛟 Ouvrir le centre de support' },
  es: { welcome: (name) => `🛟 ¡Hola, ${name}! Soy el soporte de NEURON.`, support_btn: '🛟 Abrir centro de soporte' }
};

async function askAI(question) {
  if (!OPENROUTER_API_KEY) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
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
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: question }
          ]
        })
      });
      const data = await response.json();
      if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
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
        `INSERT INTO user_avatars (user_id, first_name, tg_photo_file_id, updated_at)
         VALUES ($1, $2, $3, NOW()) ON CONFLICT (user_id) DO UPDATE SET first_name = $2, tg_photo_file_id = $3, updated_at = NOW()`,
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
        const reply = await askAI(data.message || '');
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
