const { Telegraf } = require('telegraf');
const { Pool } = require('pg');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const SUPPORT_OWNER_ID = process.env.SUPPORT_OWNER_ID || '638242293';

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is not set');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const pool = new Pool({ connectionString: DATABASE_URL, ssl: false });

pool.query(`CREATE TABLE IF NOT EXISTS user_langs (user_id BIGINT PRIMARY KEY, lang VARCHAR(5))`);

async function getUserLang(userId) {
  try {
    const { rows } = await pool.query('SELECT lang FROM user_langs WHERE user_id = $1', [userId]);
    return rows[0]?.lang || null;
  } catch(e) { return null; }
}

async function saveUserLang(userId, lang) {
  try {
    await pool.query('INSERT INTO user_langs (user_id, lang) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET lang = $2', [userId, lang]);
  } catch(e) {}
}

const LANG = {
  ru: {
    welcome: (name) => `🛟 Привет, ${name}!\n\nЯ — COGNIQ AI Support, официальная поддержка экосистемы **NEURON**.\n\nВыбери вопрос или напиши свой — я помогу!`,
    btn_play: '🎮 Как играть?',
    btn_cogniq: '🪙 Что такое COGNIQ?',
    btn_exchange: '💱 Как работает биржа?',
    btn_impulse: '⚡ Что такое IMPULSE?',
    btn_contact: '📞 Связаться с командой',
    faq_play: '🎮 **Как играть в NEURON?**\n\n1️⃣ Открой Mini App через кнопку "Играть"\n2️⃣ Отвечай на вопросы викторины\n3️⃣ Зарабатывай COGNIQ\n\n🎁 +500 IMPULSE ежедневно!\n\n🔗 https://neuron1.bothost.tech',
    faq_cogniq: '🪙 **Что такое COGNIQ?**\n\nCOGNIQ — токен экосистемы NEURON на блокчейне TON.\n\n🔹 Зарабатывай в викторине\n🔹 Обменивай на IMPULSE\n🔹 Используй в бирже и банке\n🔹 Выводи на TON кошелёк\n\n📄 Whitepaper: https://neuron1.bothost.tech/whitepaper.html',
    faq_exchange: '💱 **NEURON EXCHANGE**\n\nТоргуй:\n🔹 Криптой: TON, BTC, USDT\n🔹 Акциями: Apple, Tesla, NVIDIA\n🔹 Золотом: XAUt0\n\n🔗 https://neuron1.bothost.tech/exchange.html',
    faq_impulse: '⚡ **Что такое IMPULSE?**\n\nИгровая валюта:\n🎡 FORTUNA\n🎰 SPARK\n📈 CRASH\n🃏 XXI\n💣 MINES\n\n🎁 +500 IMPULSE/день!\n\n🔗 https://neuron1.bothost.tech/casino',
    contact: '📞 **Связь с командой**\n\nНапиши свой вопрос — я передам его разработчикам. Ответим в ближайшее время! 💬',
    forwarded: '✅ Я передал твоё сообщение команде NEURON. Мы ответим в ближайшее время!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Сообщение от ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  en: {
    welcome: (name) => `🛟 Hi, ${name}!\n\nI'm COGNIQ AI Support for the **NEURON** ecosystem.\n\nChoose a question or write your own — I'll help!`,
    btn_play: '🎮 How to play?',
    btn_cogniq: '🪙 What is COGNIQ?',
    btn_exchange: '💱 How does exchange work?',
    btn_impulse: '⚡ What is IMPULSE?',
    btn_contact: '📞 Contact the team',
    faq_play: '🎮 **How to play NEURON?**\n\n1️⃣ Open Mini App via "Play"\n2️⃣ Answer quiz questions\n3️⃣ Earn COGNIQ\n\n🎁 +500 IMPULSE daily!\n\n🔗 https://neuron1.bothost.tech',
    faq_cogniq: '🪙 **What is COGNIQ?**\n\nCOGNIQ is the NEURON token on TON blockchain.\n\n🔹 Earn in quiz\n🔹 Exchange for IMPULSE\n🔹 Use in exchange & bank\n🔹 Withdraw to TON wallet\n\n📄 Whitepaper: https://neuron1.bothost.tech/whitepaper.html',
    faq_exchange: '💱 **NEURON EXCHANGE**\n\nTrade:\n🔹 Crypto: TON, BTC, USDT\n🔹 Stocks: Apple, Tesla, NVIDIA\n🔹 Gold: XAUt0\n\n🔗 https://neuron1.bothost.tech/exchange.html',
    faq_impulse: '⚡ **What is IMPULSE?**\n\nGaming currency:\n🎡 FORTUNA\n🎰 SPARK\n📈 CRASH\n🃏 XXI\n💣 MINES\n\n🎁 +500 IMPULSE/day!\n\n🔗 https://neuron1.bothost.tech/casino',
    contact: '📞 **Contact the team**\n\nWrite your question — I\'ll forward it to the developers. We\'ll reply soon! 💬',
    forwarded: '✅ Message forwarded to NEURON team. We\'ll reply soon!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Message from ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  fr: {
    welcome: (name) => `🛟 Salut, ${name}!\n\nJe suis COGNIQ AI Support pour l'écosystème **NEURON**.\n\nChoisis une question ou écris la tienne!`,
    btn_play: '🎮 Comment jouer?',
    btn_cogniq: '🪙 Qu\'est-ce que COGNIQ?',
    btn_exchange: '💱 Comment fonctionne l\'échange?',
    btn_impulse: '⚡ Qu\'est-ce que IMPULSE?',
    btn_contact: '📞 Contacter l\'équipe',
    faq_play: '🎮 **Comment jouer?**\n\n1️⃣ Ouvre Mini App\n2️⃣ Réponds aux questions\n3️⃣ Gagne des COGNIQ\n\n🎁 +500 IMPULSE/jour!\n\n🔗 https://neuron1.bothost.tech',
    faq_cogniq: '🪙 **COGNIQ?**\n\nToken NEURON sur TON.\n\n🔹 Gagne dans le quiz\n🔹 Échange contre IMPULSE\n🔹 Retire vers TON\n\n📄 https://neuron1.bothost.tech/whitepaper.html',
    faq_exchange: '💱 **NEURON EXCHANGE**\n\nTrade:\n🔹 Crypto: TON, BTC, USDT\n🔹 Actions: Apple, Tesla\n🔹 Or: XAUt0\n\n🔗 https://neuron1.bothost.tech/exchange.html',
    faq_impulse: '⚡ **IMPULSE?**\n\nMonnaie de jeu:\n🎡 FORTUNA\n🎰 SPARK\n📈 CRASH\n🃏 XXI\n💣 MINES\n\n🎁 +500/jour!\n\n🔗 https://neuron1.bothost.tech/casino',
    contact: '📞 **Contacter l\'équipe**\n\nÉcris ta question — je la transmettrai. Réponse bientôt! 💬',
    forwarded: '✅ Message transmis à l\'équipe NEURON.',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Message de ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  es: {
    welcome: (name) => `🛟 ¡Hola, ${name}!\n\nSoy COGNIQ AI Support para el ecosistema **NEURON**.\n\n¡Elige una pregunta o escribe la tuya!`,
    btn_play: '🎮 ¿Cómo jugar?',
    btn_cogniq: '🪙 ¿Qué es COGNIQ?',
    btn_exchange: '💱 ¿Cómo funciona el intercambio?',
    btn_impulse: '⚡ ¿Qué es IMPULSE?',
    btn_contact: '📞 Contactar al equipo',
    faq_play: '🎮 **¿Cómo jugar?**\n\n1️⃣ Abre Mini App\n2️⃣ Responde preguntas\n3️⃣ Gana COGNIQ\n\n🎁 +500 IMPULSE/día!\n\n🔗 https://neuron1.bothost.tech',
    faq_cogniq: '🪙 **¿COGNIQ?**\n\nToken NEURON en TON.\n\n🔹 Gana en quiz\n🔹 Intercambia por IMPULSE\n🔹 Retira a TON\n\n📄 https://neuron1.bothost.tech/whitepaper.html',
    faq_exchange: '💱 **NEURON EXCHANGE**\n\nOpera:\n🔹 Crypto: TON, BTC, USDT\n🔹 Acciones: Apple, Tesla\n🔹 Oro: XAUt0\n\n🔗 https://neuron1.bothost.tech/exchange.html',
    faq_impulse: '⚡ **¿IMPULSE?**\n\nMoneda de juego:\n🎡 FORTUNA\n🎰 SPARK\n📈 CRASH\n🃏 XXI\n💣 MINES\n\n🎁 +500/día!\n\n🔗 https://neuron1.bothost.tech/casino',
    contact: '📞 **Contactar al equipo**\n\nEscribe tu pregunta — la enviaré. ¡Responderemos pronto! 💬',
    forwarded: '✅ Mensaje enviado al equipo NEURON.',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Mensaje de ${userName}** (ID: ${userId})\n\n${msg}`,
  }
};

async function getLang(ctx) {
  const userId = ctx.from?.id;
  if (userId) {
    const saved = await getUserLang(userId);
    if (saved && LANG[saved]) return LANG[saved];
  }
  const langCode = ctx.from?.language_code || 'en';
  return LANG[langCode] || LANG['en'];
}

function getMenuKeyboard(t) {
  return {
    inline_keyboard: [
      [{ text: '🛟 Открыть центр поддержки', web_app: { url: 'https://cogniqai.bothost.tech' } }],
      [{ text: '🌐 EN | RU | FR | ES', callback_data: 'lang_menu' }],
      [{ text: t.btn_play, callback_data: 'faq_play' }],
      [{ text: t.btn_cogniq, callback_data: 'faq_cogniq' }],
      [{ text: t.btn_exchange, callback_data: 'faq_exchange' }],
      [{ text: t.btn_impulse, callback_data: 'faq_impulse' }],
      [{ text: t.btn_contact, callback_data: 'contact' }]
    ]
  };
}

bot.start(async (ctx) => {
  const t = await getLang(ctx);
  const userName = ctx.from.first_name || 'friend';
  await ctx.replyWithPhoto(
    { source: './support_avatar.png' },
    {
      caption: t.welcome(userName),
      parse_mode: 'Markdown',
      reply_markup: getMenuKeyboard(t)
    }
  );
});

bot.action('lang_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🌐 Select language:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🇷🇺 Русский', callback_data: 'set_lang_ru' }],
        [{ text: '🇬🇧 English', callback_data: 'set_lang_en' }],
        [{ text: '🇫🇷 Français', callback_data: 'set_lang_fr' }],
        [{ text: '🇪🇸 Español', callback_data: 'set_lang_es' }],
      ]
    }
  });
});

['ru', 'en', 'fr', 'es'].forEach(lang => {
  bot.action(`set_lang_${lang}`, async (ctx) => {
    await ctx.answerCbQuery();
    await saveUserLang(ctx.from.id, lang);
    const t = LANG[lang];
    const userName = ctx.from.first_name || 'friend';
    await ctx.replyWithPhoto(
      { source: './support_avatar.png' },
      {
        caption: t.welcome(userName),
        parse_mode: 'Markdown',
        reply_markup: getMenuKeyboard(t)
      }
    );
  });
});

['faq_play', 'faq_cogniq', 'faq_exchange', 'faq_impulse'].forEach(action => {
  bot.action(action, async (ctx) => {
    await ctx.answerCbQuery();
    const t = await getLang(ctx);
    await ctx.reply(t[action], { parse_mode: 'Markdown' });
  });
});

bot.action('contact', async (ctx) => {
  await ctx.answerCbQuery();
  const t = await getLang(ctx);
  await ctx.reply(t.contact, { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
  const t = await getLang(ctx);
  const userMsg = ctx.message.text;
  const user = ctx.from;
  const userName = user.username ? `@${user.username}` : user.first_name || 'User';
  
  await ctx.reply(t.forwarded);
  
  try {
    await bot.telegram.sendMessage(
      SUPPORT_OWNER_ID,
      t.forwarded_to_owner(userName, user.id, userMsg),
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('Failed to forward message:', e);
  }
});

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/support.html') {
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
server.listen(3000, () => console.log('HTTP server on port 3000'));

bot.launch();
console.log('COGNIQ AI Support бот запущен');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
