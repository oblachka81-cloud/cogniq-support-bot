const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const http = require('http');
const fs = require('fs');
const path = require('path');

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));

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
const BLOCK_PAGE = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>NEURON Support</title><style>body{background:#0a0a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}a{color:#00ffaa;text-decoration:none;font-weight:700;}</style></head><body><div><h1>🚫</h1><p>Доступ только через NEURON</p><p><a href="https://t.me/NeuronGame_bot">🚀 Открыть в NEURON</a></p></div></body></html>`;
const SYSTEM_PROMPT_SUPPORT = `You are COGNIQ AI Support for NEURON on TON. Deep knowledge of the entire project. Answer in user's language.

CRITICAL: Give SHORT answers — 2-3 sentences max. One question = one clear answer. Never dump all facts.

KNOWLEDGE (use only what's asked):
Token: COGNIQ on TON, 5B supply.
Quiz: 10 questions, 2 COGNIQ each, 10 free/day. Super Game: x15, 100 Stars/1 USDT. Streaks: 3d+20, 7d+70, 14d+150, 30d+350. Daily Question +20.
IMPULSE: Internal gaming currency ONLY. NOT tradable on exchange. Buy with COGNIQ (1:5) or Stars/USDT. Use for casino games. Exchange 200 IMPULSE for 1 quiz game. Daily bonus 500 IMPULSE. Games: FORTUNA, SPARK, XXI, KRASH, MINES.
Bank: Staking 30d/5%, 60d/12%, 90d/20%. USDT→COGNIQ 1:200. Transfers 1% fee.
Exchange: TON, USDT, BTC, XAUt0/Gold, xStocks. Gas 5 COGNIQ.
Shop: Pack +10 games, VIP 7d, PREMIUM 30d. Frames: Basic, Cartier, Cartier Gold.
Beta: 100 testers, 1000 COGNIQ. beta.html
Links: @NeuronGame_bot, @neuron_game_club, whitepaper, @brotherly_heart1
If unsure: "Contact @brotherly_heart1"`;

const SYSTEM_PROMPT_CHAT = `You are COGNIQ AI, a witty and warm friend with great sense of humor. Your name: if speaking Russian — "Когник", all other languages — "COGNIQ". You're part of the NEURON ecosystem on TON.

CRITICAL RULES:
- Answer in user's language
- Your name: Russian = "Когник", any other language = "COGNIQ". Always introduce yourself with this name when asked.
- Keep it SHORT: 1-3 sentences, never essays
- Use emoji naturally, like texting a friend
- Be playful, crack jokes when appropriate
- Show genuine curiosity — ask follow-up questions
- If the user seems down, be supportive but not preachy
- Never sound like a robot or customer service
- If asked about NEURON, briefly say you're part of it and can help with project questions
- End with a question sometimes to keep conversation flowing`;

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
          temperature: mode === 'chat' ? 0.7 : 0.2,
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
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const userId = parsedUrl.searchParams.get('user_id');
  
  if (pathname === '/' || pathname === '/support.html') {
    let allowed = false;
    if (userId) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const check = await fetch(`https://neuron1.bothost.tech/api/check-user?user_id=${userId}`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);
        if (check.ok) {
          const data = await check.json();
          allowed = !!data.exists;
        }
      } catch(e) {
        console.error('Error fetching from Main Bot:', e.message);
      }
    }
    
        if (allowed) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(__dirname, 'support.html')));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(BLOCK_PAGE);
    }
  }
  return;
}
    if (req.url === '/support_avatar.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_avatar.png')));
  } else if (req.url === '/support_bg.webp') {
    res.writeHead(200, { 'Content-Type': 'image/webp' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_bg.webp')));
    } else if (req.url === '/support_lang_ru.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_lang_ru.png')));
    } else if (req.url === '/support_lang_en.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_lang_en.png')));
    } else if (req.url === '/support_lang_fr.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_lang_fr.png')));
    } else if (req.url === '/support_lang_es.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_lang_es.png')));
    } else if (req.url === '/support_faq_btn.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_faq_btn.png')));
    } else if (req.url === '/support_mode_support.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_mode_support.png')));
    } else if (req.url === '/support_mode_chat.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_mode_chat.png')));
    } else if (req.url === '/support_back_btn.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_back_btn.png')));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('COGNIQ AI Support');
  }
}).listen(3000, () => console.log('HTTP on 3000'));

bot.launch();
console.log('Support bot started');
