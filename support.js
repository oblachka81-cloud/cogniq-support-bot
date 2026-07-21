const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const SUPPORT_OWNER_ID = process.env.SUPPORT_OWNER_ID || '638242293';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://cogniqai.bothost.tech';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

if (!BOT_TOKEN) { console.error('BOT_TOKEN is not set'); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);
const pool = new Pool({ connectionString: DATABASE_URL, ssl: false });

pool.query(`CREATE TABLE IF NOT EXISTS user_langs (user_id BIGINT PRIMARY KEY, lang VARCHAR(5))`);

const dialogs = new Map();
const DIALOG_TTL = 30 * 60 * 1000;

const SYSTEM_PROMPT = `You are COGNIQ AI Support, official support for NEURON ecosystem.
Ecosystem: COGNIQ token (TON blockchain), quiz games, IMPULSE gaming currency, FORTUNA/SPARK/CRASH/XXI/MINES games, NEURON EXCHANGE (crypto, stocks, gold).
Answer in user's language. Be helpful, friendly, concise. If unsure, suggest contacting human operator.`;

const LANG = {
  ru: {
    welcome: (name) => `🛟 Привет, ${name}!\n\nЯ — COGNIQ AI Support, официальная поддержка экосистемы **NEURON**.\n\nНапиши свой вопрос — я помогу!`,
    support_btn: '🛟 Открыть центр поддержки',
    thinking: '🤔 Думаю над ответом...',
    forwarded: '✅ Я передал твоё сообщение команде NEURON. Мы ответим в ближайшее время!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Сообщение от ${userName}** (ID: ${userId})\n\n${msg}`,
    operator_called: '📞 Вызов оператора. Напиши свой вопрос — я передам его разработчикам.',
  },
  en: {
    welcome: (name) => `🛟 Hi, ${name}!\n\nI'm COGNIQ AI Support, official support for **NEURON** ecosystem.\n\nWrite your question — I'll help!`,
    support_btn: '🛟 Open Support Center',
    thinking: '🤔 Thinking...',
    forwarded: '✅ Message forwarded to NEURON team. We\'ll reply soon!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Message from ${userName}** (ID: ${userId})\n\n${msg}`,
    operator_called: '📞 Calling operator. Write your question — I\'ll forward it.',
  },
  fr: {
    welcome: (name) => `🛟 Salut, ${name}!\n\nJe suis COGNIQ AI Support, support officiel de **NEURON**.\n\nÉcris ta question — je t'aiderai!`,
    support_btn: '🛟 Ouvrir le centre de support',
    thinking: '🤔 Je réfléchis...',
    forwarded: '✅ Message transmis à l\'équipe NEURON.',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Message de ${userName}** (ID: ${userId})\n\n${msg}`,
    operator_called: '📞 Appel opérateur. Écrivez votre question.',
  },
  es: {
    welcome: (name) => `🛟 ¡Hola, ${name}!\n\nSoy COGNIQ AI Support, soporte oficial de **NEURON**.\n\n¡Escribe tu pregunta!`,
    support_btn: '🛟 Abrir centro de soporte',
    thinking: '🤔 Pensando...',
    forwarded: '✅ Mensaje enviado al equipo NEURON.',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Mensaje de ${userName}** (ID: ${userId})\n\n${msg}`,
    operator_called: '📞 Llamando operador. Escribe tu pregunta.',
  }
};

async function getLang(ctx) {
  const userId = ctx.from?.id;
  if (userId) {
    try {
      const { rows } = await pool.query('SELECT lang FROM user_langs WHERE user_id = $1', [userId]);
      if (rows[0]?.lang && LANG[rows[0].lang]) return { langCode: rows[0].lang, strings: LANG[rows[0].lang] };
    } catch(e) {}
  }
  return { langCode: 'en', strings: LANG['en'] };
}

async function askDeepSeek(userMessage, history) {
  if (!DEEPSEEK_API_KEY) return null;
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: userMessage }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch(e) { return null; }
}

async function processMessage(ctx, userMsg, isOperator) {
  const { strings } = await getLang(ctx);
  const userId = ctx.from.id;
  const user = ctx.from;
  const userName = user.username ? `@${user.username}` : user.first_name || 'User';

  // Оператор
  if (isOperator) {
    await ctx.reply(strings.operator_called);
    try {
      await bot.telegram.sendMessage(SUPPORT_OWNER_ID, strings.forwarded_to_owner(userName, userId, userMsg), { parse_mode: 'Markdown' });
    } catch(e) {}
    return;
  }

  // DeepSeek
  if (DEEPSEEK_API_KEY) {
    await ctx.reply(strings.thinking);
    if (!dialogs.has(userId)) dialogs.set(userId, { messages: [], lastActivity: Date.now() });
    const dialog = dialogs.get(userId);
    dialog.lastActivity = Date.now();

    const reply = await askDeepSeek(userMsg, dialog.messages);
    if (reply) {
      dialog.messages.push({ role: 'user', content: userMsg }, { role: 'assistant', content: reply });
      if (dialog.messages.length > 20) dialog.messages = dialog.messages.slice(-20);
      await ctx.reply(reply);
      return;
    }
  }

  // Fallback: пересылка владельцу
  await ctx.reply(strings.forwarded);
  try {
    await bot.telegram.sendMessage(SUPPORT_OWNER_ID, strings.forwarded_to_owner(userName, userId, userMsg), { parse_mode: 'Markdown' });
  } catch(e) {}
}

bot.start(async (ctx) => {
  const { langCode, strings } = await getLang(ctx);
  const userName = ctx.from.first_name || 'friend';
  await ctx.replyWithPhoto({ source: './support_avatar.png' }, {
    caption: strings.welcome(userName),
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: strings.support_btn, web_app: { url: `${WEBAPP_URL}?lang=${langCode}` } }]] }
  });
});

bot.on('web_app_data', async (ctx) => {
  try {
    const data = JSON.parse(ctx.webAppData.data);
    if (data.action === 'set_lang' && data.lang) {
      await pool.query('INSERT INTO user_langs (user_id, lang) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET lang = $2', [ctx.from.id, data.lang]);
    }
    if (data.action === 'ask' && data.message) {
      await processMessage(ctx, data.message, false);
    }
    if (data.action === 'operator') {
      await processMessage(ctx, 'Вызов оператора из Mini App', true);
    }
  } catch(e) { console.error('web_app_data:', e.message); }
});

bot.on('text', async (ctx) => {
  await processMessage(ctx, ctx.message.text, false);
});

setInterval(() => {
  const now = Date.now();
  for (const [id, d] of dialogs) { if (now - d.lastActivity > DIALOG_TTL) dialogs.delete(id); }
}, 10 * 60 * 1000);

http.createServer(function(req, res) {
  if (req.url === '/api' && req.method === 'POST') {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try {
        var data = JSON.parse(body);
        if (data.user_id) {
          var chatId = data.user_id;
          if (data.action === 'set_lang' && data.lang) {
            pool.query('INSERT INTO user_langs (user_id, lang) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET lang = $2', [chatId, data.lang]).catch(function(){});
          }
          if (data.action === 'ask' && data.message) {
            var fakeCtx = { from: { id: chatId, first_name: 'User', username: null }, reply: function(text) { return bot.telegram.sendMessage(chatId, text); } };
            processMessage(fakeCtx, data.message, false);
          }
          if (data.action === 'operator') {
            var fakeCtx2 = { from: { id: chatId, first_name: 'User', username: null }, reply: function(text) { return bot.telegram.sendMessage(chatId, text); } };
            processMessage(fakeCtx2, 'Вызов оператора из Mini App', true);
          }
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      } catch(e) {
        res.writeHead(500);
        res.end('error');
      }
    });
  } else if (req.url === '/' || req.url.startsWith('/?') || req.url === '/support.html') {
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

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
