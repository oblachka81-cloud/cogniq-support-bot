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
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false
});

pool.query(`CREATE TABLE IF NOT EXISTS user_langs (user_id BIGINT PRIMARY KEY, lang VARCHAR(5))`);

// Хранилище истории диалогов (юзер → массив сообщений)
const dialogs = new Map();
const DIALOG_TTL = 30 * 60 * 1000; // 30 минут

const SYSTEM_PROMPT = `You are COGNIQ AI Support, the official support bot for the NEURON ecosystem.
Ecosystem includes: COGNIQ token on TON blockchain, quiz games, IMPULSE gaming currency, FORTUNA/SPARK/CRASH/XXI/MINES games, NEURON EXCHANGE (crypto, stocks, gold).
Answer in the user's language. Be helpful, friendly, and concise.
If you don't know the answer, say so and suggest contacting human support.`;

const LANG = {
  ru: {
    welcome: (name) => `🛟 Привет, ${name}!\n\nЯ — COGNIQ AI Support, официальная поддержка экосистемы **NEURON**.\n\nВыбери вопрос или напиши свой — я помогу!`,
    support_btn: '🛟 Открыть центр поддержки',
    thinking: '🤔 Думаю над ответом...',
    error: '⚠️ Что-то пошло не так. Попробуй позже или напиши "оператор" для связи с человеком.',
    operator: '📞 Переключаю на оператора. Напиши свой вопрос — я передам его разработчикам.',
    forwarded: '✅ Я передал твоё сообщение команде NEURON. Мы ответим в ближайшее время!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Сообщение от ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  en: {
    welcome: (name) => `🛟 Hi, ${name}!\n\nI'm COGNIQ AI Support, official support for **NEURON** ecosystem.\n\nWrite your question — I'll help!`,
    support_btn: '🛟 Open Support Center',
    thinking: '🤔 Thinking...',
    error: '⚠️ Something went wrong. Try again later or type "operator" to contact a human.',
    operator: '📞 Switching to human operator. Write your question and I\'ll forward it.',
    forwarded: '✅ Message forwarded to NEURON team. We\'ll reply soon!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Message from ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  fr: {
    welcome: (name) => `🛟 Salut, ${name}!\n\nJe suis COGNIQ AI Support, support officiel de **NEURON**.\n\nÉcris ta question — je t'aiderai!`,
    support_btn: '🛟 Ouvrir le centre de support',
    thinking: '🤔 Je réfléchis...',
    error: '⚠️ Quelque chose a mal tourné. Réessayez ou écrivez "opérateur".',
    operator: '📞 Transfert vers un opérateur. Écrivez votre question.',
    forwarded: '✅ Message transmis à l\'équipe NEURON.',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Message de ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  es: {
    welcome: (name) => `🛟 ¡Hola, ${name}!\n\nSoy COGNIQ AI Support, soporte oficial de **NEURON**.\n\n¡Escribe tu pregunta!`,
    support_btn: '🛟 Abrir centro de soporte',
    thinking: '🤔 Pensando...',
    error: '⚠️ Algo salió mal. Intenta de nuevo o escribe "operador".',
    operator: '📞 Cambiando a operador humano. Escribe tu pregunta.',
    forwarded: '✅ Mensaje enviado al equipo NEURON.',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Mensaje de ${userName}** (ID: ${userId})\n\n${msg}`,
  }
};

async function getLang(ctx) {
  const userId = ctx.from?.id;
  if (userId) {
    try {
      const { rows } = await pool.query('SELECT lang FROM user_langs WHERE user_id = $1', [userId]);
      if (rows[0]?.lang && LANG[rows[0].lang]) return { langCode: rows[0].lang, strings: LANG[rows[0].lang] };
    } catch(e) { console.error('DB error in getLang:', e.message); }
  }
  return { langCode: 'en', strings: LANG['en'] };
}

// Запрос к DeepSeek API
async function askDeepSeek(userMessage, history, langCode) {
  if (!DEEPSEEK_API_KEY) return null;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    console.error('DeepSeek API error:', response.status, await response.text());
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

// Очистка старых диалогов
function cleanDialogs() {
  const now = Date.now();
  for (const [userId, dialog] of dialogs) {
    if (now - dialog.lastActivity > DIALOG_TTL) {
      dialogs.delete(userId);
    }
  }
}
setInterval(cleanDialogs, 10 * 60 * 1000);

// /start
bot.start(async (ctx) => {
  const { langCode, strings } = await getLang(ctx);
  const userName = ctx.from.first_name || 'friend';
  const webAppUrl = `${WEBAPP_URL}?lang=${langCode}`;

  await ctx.replyWithPhoto(
    { source: './support_avatar.png' },
    {
      caption: strings.welcome(userName),
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: strings.support_btn, web_app: { url: webAppUrl } }]]
      }
    }
  );
});

// web_app_data
bot.on('web_app_data', async (ctx) => {
  try {
    const data = JSON.parse(ctx.webAppData.data);
    if (data.action === 'set_lang' && data.lang) {
      await pool.query(
        'INSERT INTO user_langs (user_id, lang) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET lang = $2',
        [ctx.from.id, data.lang]
      );
    }
  } catch(e) { console.error('web_app_data error:', e.message); }
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const { langCode, strings } = await getLang(ctx);
  const userMsg = ctx.message.text;
  const userId = ctx.from.id;
  const user = ctx.from;
  const userName = user.username ? `@${user.username}` : user.first_name || 'User';

  // Ключевые слова для переключения на оператора
  const operatorKeywords = ['оператор', 'operator', 'opérateur', 'operador', 'человек', 'human', 'человека', 'live agent'];
  const isOperatorRequest = operatorKeywords.some(kw => userMsg.toLowerCase().includes(kw));

  if (isOperatorRequest) {
    // Переключение на человека
    await ctx.reply(strings.operator);
    try {
      await bot.telegram.sendMessage(
        SUPPORT_OWNER_ID,
        strings.forwarded_to_owner(userName, userId, userMsg),
        { parse_mode: 'Markdown' }
      );
    } catch(e) { console.error('Forward error:', e.message); }
    return;
  }

  // Пробуем DeepSeek
  if (DEEPSEEK_API_KEY) {
    await ctx.reply(strings.thinking);

    if (!dialogs.has(userId)) {
      dialogs.set(userId, { messages: [], lastActivity: Date.now() });
    }
    const dialog = dialogs.get(userId);
    dialog.lastActivity = Date.now();

    const reply = await askDeepSeek(userMsg, dialog.messages, langCode);

    if (reply) {
      dialog.messages.push({ role: 'user', content: userMsg });
      dialog.messages.push({ role: 'assistant', content: reply });
      // Держим историю в пределах 20 сообщений
      if (dialog.messages.length > 20) {
        dialog.messages = dialog.messages.slice(-20);
      }
      await ctx.reply(reply);
      return;
    }
  }

  // Fallback: пересылка владельцу
  await ctx.reply(strings.forwarded);
  try {
    await bot.telegram.sendMessage(
      SUPPORT_OWNER_ID,
      strings.forwarded_to_owner(userName, userId, userMsg),
      { parse_mode: 'Markdown' }
    );
  } catch(e) { console.error('Forward error:', e.message); }
});

// HTTP-сервер
const server = http.createServer((req, res) => {
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
});

server.listen(3000, () => console.log('HTTP on 3000'));
bot.launch();
console.log('Support bot started');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
