const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://cogniqai.bothost.tech';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

if (!BOT_TOKEN) { console.error('BOT_TOKEN is not set'); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const pool = new Pool({ connectionString: DATABASE_URL, ssl: false });

pool.query(`CREATE TABLE IF NOT EXISTS user_langs (user_id BIGINT PRIMARY KEY, lang VARCHAR(5))`);

const LANG = {
  ru: { welcome: (name) => `🛟 Привет, ${name}! Я поддержка NEURON.`, support_btn: '🛟 Открыть центр поддержки' },
  en: { welcome: (name) => `🛟 Hi, ${name}! I'm NEURON support.`, support_btn: '🛟 Open Support Center' },
  fr: { welcome: (name) => `🛟 Salut, ${name}! Je suis le support NEURON.`, support_btn: '🛟 Ouvrir le centre de support' },
  es: { welcome: (name) => `🛟 ¡Hola, ${name}! Soy el soporte de NEURON.`, support_btn: '🛟 Abrir centro de soporte' }
};

async function askAI(question) {
  if (!OPENROUTER_API_KEY) { console.log('No OPENROUTER_API_KEY'); return null; }
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
        model: 'google/gemma-4-31b:free',
        messages: [
          { role: 'system', content: 'You are COGNIQ AI Support for NEURON ecosystem. Answer in user\'s language. Be helpful and concise.' },
          { role: 'user', content: question }
        ]
      })
    });
    const data = await response.json();
    console.log('OpenRouter response:', JSON.stringify(data).substring(0, 200));
    return data.choices?.[0]?.message?.content || null;
  } catch(e) { console.log('Fetch error:', e.message); return null; }
}

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const langCode = 'en';
  const strings = LANG['en'];
  try {
    const { rows } = await pool.query('SELECT lang FROM user_langs WHERE user_id = $1', [userId]);
    if (rows[0]?.lang && LANG[rows[0].lang]) {
      langCode = rows[0].lang;
      strings = LANG[rows[0].lang];
    }
  } catch(e) {}
  await ctx.replyWithPhoto({ source: './support_avatar.png' }, {
    caption: strings.welcome(ctx.from.first_name || 'friend'),
    reply_markup: { inline_keyboard: [[{ text: strings.support_btn, web_app: { url: `${WEBAPP_URL}?lang=${langCode}` } }]] }
  });
});

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body);
        const reply = await askAI(data.message || '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: reply || 'Извините, я не смог ответить.' }));
      } catch(e) {
        res.writeHead(500);
        res.end(JSON.stringify({ reply: 'Ошибка сервера.' }));
      }
    });
    return;
  }

  if (req.url === '/' || req.url.startsWith('/?') || req.url === '/support.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'support.html')));
  } else if (req.url === '/support_avatar.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(fs.readFileSync(path.join(__dirname, 'support_avatar.png')));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('COGNIQ AI Support');
  }
}).listen(3000, function() { console.log('HTTP on 3000'); });

bot.launch();
console.log('Support bot started');
