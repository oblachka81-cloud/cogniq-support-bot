const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPPORT_OWNER_ID = process.env.SUPPORT_OWNER_ID || '5116812153';

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is not set');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const LANG = {
  ru: {
    welcome: (name) => `🛟 Привет, ${name}!\n\nЯ — COGNIQ AI Support, официальная поддержка экосистемы **NEURON**.\n\nВыбери вопрос или напиши свой — я помогу!`,
    btn_play: '🎮 Как играть?',
    btn_cogniq: '🪙 Что такое COGNIQ?',
    btn_exchange: '💱 Как работает биржа?',
    btn_impulse: '⚡ Что такое IMPULSE?',
    btn_contact: '📞 Связаться с командой',
    faq_play: '🎮 **Как играть в NEURON?**\n\n1️⃣ Открой Mini App через кнопку "Играть"\n2️⃣ Отвечай на вопросы викторины\n3️⃣ Зарабатывай COGNIQ за правильные ответы\n4️⃣ Используй COGNIQ в бирже и банке\n\n🎁 Ежедневно получай бесплатные IMPULSE для игр!',
    faq_cogniq: '🪙 **Что такое COGNIQ?**\n\nCOGNIQ — это токен экосистемы NEURON на блокчейне TON.\n\n🔹 Зарабатывай в викторине\n🔹 Обменивай на IMPULSE для игр\n🔹 Используй в бирже и банке\n🔹 Выводи на TON кошелёк\n\n📄 Подробнее: https://neuron1.bothost.tech/whitepaper.html',
    faq_exchange: '💱 **NEURON EXCHANGE**\n\nНа бирже можно торговать:\n🔹 Криптовалютой: TON, BTC, USDT\n🔹 Акциями: Apple, Tesla, NVIDIA (xStocks)\n🔹 Золотом: XAUt0\n\n🔗 Открыть биржу: https://neuron1.bothost.tech/exchange.html',
    faq_impulse: '⚡ **Что такое IMPULSE?**\n\nIMPULSE — игровая валюта для развлечений:\n🎡 FORTUNA (рулетка)\n🎰 SPARK (слоты)\n📈 CRASH\n🃏 XXI (блэкджек)\n💣 MINES\n\n🎁 +500 IMPULSE бесплатно каждый день!',
    contact: '📞 **Связь с командой**\n\nНапиши свой вопрос прямо сюда — я передам его разработчикам.\nОни ответят в ближайшее время! 💬',
    forwarded: '✅ Я передал твоё сообщение команде NEURON. Мы ответим в ближайшее время!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Сообщение от ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  en: {
    welcome: (name) => `🛟 Hi, ${name}!\n\nI'm COGNIQ AI Support, official support for the **NEURON** ecosystem.\n\nChoose a question or write your own — I'll help!`,
    btn_play: '🎮 How to play?',
    btn_cogniq: '🪙 What is COGNIQ?',
    btn_exchange: '💱 How does the exchange work?',
    btn_impulse: '⚡ What is IMPULSE?',
    btn_contact: '📞 Contact the team',
    faq_play: '🎮 **How to play NEURON?**\n\n1️⃣ Open Mini App via "Play" button\n2️⃣ Answer quiz questions\n3️⃣ Earn COGNIQ for correct answers\n4️⃣ Use COGNIQ in exchange and bank\n\n🎁 Get free IMPULSE daily!',
    faq_cogniq: '🪙 **What is COGNIQ?**\n\nCOGNIQ is the NEURON ecosystem token on TON blockchain.\n\n🔹 Earn in quiz\n🔹 Exchange for IMPULSE\n🔹 Use in exchange and bank\n🔹 Withdraw to TON wallet\n\n📄 More: https://neuron1.bothost.tech/whitepaper.html',
    faq_exchange: '💱 **NEURON EXCHANGE**\n\nTrade:\n🔹 Crypto: TON, BTC, USDT\n🔹 Stocks: Apple, Tesla, NVIDIA (xStocks)\n🔹 Gold: XAUt0\n\n🔗 Open exchange: https://neuron1.bothost.tech/exchange.html',
    faq_impulse: '⚡ **What is IMPULSE?**\n\nIMPULSE is the gaming currency for:\n🎡 FORTUNA (roulette)\n🎰 SPARK (slots)\n📈 CRASH\n🃏 XXI (blackjack)\n💣 MINES\n\n🎁 +500 IMPULSE free daily!',
    contact: '📞 **Contact the team**\n\nWrite your question here — I\'ll forward it to the developers.\nThey\'ll reply soon! 💬',
    forwarded: '✅ I\'ve forwarded your message to the NEURON team. We\'ll reply soon!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Message from ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  fr: {
    welcome: (name) => `🛟 Salut, ${name}!\n\nJe suis COGNIQ AI Support, le support officiel de l'écosystème **NEURON**.\n\nChoisis une question ou écris la tienne — je t'aiderai!`,
    btn_play: '🎮 Comment jouer?',
    btn_cogniq: '🪙 Qu\'est-ce que COGNIQ?',
    btn_exchange: '💱 Comment fonctionne l\'échange?',
    btn_impulse: '⚡ Qu\'est-ce que IMPULSE?',
    btn_contact: '📞 Contacter l\'équipe',
    faq_play: '🎮 **Comment jouer à NEURON?**\n\n1️⃣ Ouvre Mini App via le bouton "Jouer"\n2️⃣ Réponds aux questions du quiz\n3️⃣ Gagne des COGNIQ pour les bonnes réponses\n4️⃣ Utilise COGNIQ dans l\'échange et la banque\n\n🎁 Reçois des IMPULSE gratuits chaque jour!',
    faq_cogniq: '🪙 **Qu\'est-ce que COGNIQ?**\n\nCOGNIQ est le token de l\'écosystème NEURON sur la blockchain TON.\n\n🔹 Gagne dans le quiz\n🔹 Échange contre IMPULSE\n🔹 Utilise dans l\'échange et la banque\n🔹 Retire vers le portefeuille TON\n\n📄 Plus: https://neuron1.bothost.tech/whitepaper.html',
    faq_exchange: '💱 **NEURON EXCHANGE**\n\nTrade:\n🔹 Crypto: TON, BTC, USDT\n🔹 Actions: Apple, Tesla, NVIDIA (xStocks)\n🔹 Or: XAUt0\n\n🔗 Ouvrir l\'échange: https://neuron1.bothost.tech/exchange.html',
    faq_impulse: '⚡ **Qu\'est-ce que IMPULSE?**\n\nIMPULSE est la monnaie de jeu pour:\n🎡 FORTUNA (roulette)\n🎰 SPARK (machines à sous)\n📈 CRASH\n🃏 XXI (blackjack)\n💣 MINES\n\n🎁 +500 IMPULSE gratuits chaque jour!',
    contact: '📞 **Contacter l\'équipe**\n\nÉcris ta question ici — je la transmettrai aux développeurs.\nIls répondront bientôt! 💬',
    forwarded: '✅ J\'ai transmis ton message à l\'équipe NEURON. Nous répondrons bientôt!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Message de ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  es: {
    welcome: (name) => `🛟 ¡Hola, ${name}!\n\nSoy COGNIQ AI Support, soporte oficial del ecosistema **NEURON**.\n\n¡Elige una pregunta o escribe la tuya — te ayudaré!`,
    btn_play: '🎮 ¿Cómo jugar?',
    btn_cogniq: '🪙 ¿Qué es COGNIQ?',
    btn_exchange: '💱 ¿Cómo funciona el intercambio?',
    btn_impulse: '⚡ ¿Qué es IMPULSE?',
    btn_contact: '📞 Contactar al equipo',
    faq_play: '🎮 **¿Cómo jugar a NEURON?**\n\n1️⃣ Abre Mini App con el botón "Jugar"\n2️⃣ Responde preguntas del quiz\n3️⃣ Gana COGNIQ por respuestas correctas\n4️⃣ Usa COGNIQ en el intercambio y banco\n\n🎁 ¡Recibe IMPULSE gratis cada día!',
    faq_cogniq: '🪙 **¿Qué es COGNIQ?**\n\nCOGNIQ es el token del ecosistema NEURON en la blockchain TON.\n\n🔹 Gana en el quiz\n🔹 Intercambia por IMPULSE\n🔹 Usa en el intercambio y banco\n🔹 Retira a la billetera TON\n\n📄 Más: https://neuron1.bothost.tech/whitepaper.html',
    faq_exchange: '💱 **NEURON EXCHANGE**\n\nOpera:\n🔹 Crypto: TON, BTC, USDT\n🔹 Acciones: Apple, Tesla, NVIDIA (xStocks)\n🔹 Oro: XAUt0\n\n🔗 Abrir intercambio: https://neuron1.bothost.tech/exchange.html',
    faq_impulse: '⚡ **¿Qué es IMPULSE?**\n\nIMPULSE es la moneda de juego para:\n🎡 FORTUNA (ruleta)\n🎰 SPARK (tragamonedas)\n📈 CRASH\n🃏 XXI (blackjack)\n💣 MINES\n\n🎁 +500 IMPULSE gratis cada día!',
    contact: '📞 **Contactar al equipo**\n\nEscribe tu pregunta aquí — la enviaré a los desarrolladores.\n¡Responderán pronto! 💬',
    forwarded: '✅ He enviado tu mensaje al equipo NEURON. ¡Responderemos pronto!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Mensaje de ${userName}** (ID: ${userId})\n\n${msg}`,
  }
};

function getLang(ctx) {
  const langCode = ctx.from?.language_code || 'en';
  return LANG[langCode] || LANG['en'];
}

bot.start(async (ctx) => {
  const t = getLang(ctx);
  const userName = ctx.from.first_name || 'friend';
  await ctx.replyWithPhoto(
    { source: './support_avatar.png' },
    {
      caption: t.welcome(userName),
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: t.btn_play, callback_data: 'faq_play' }],
          [{ text: t.btn_cogniq, callback_data: 'faq_cogniq' }],
          [{ text: t.btn_exchange, callback_data: 'faq_exchange' }],
          [{ text: t.btn_impulse, callback_data: 'faq_impulse' }],
          [{ text: t.btn_contact, callback_data: 'contact' }]
        ]
      }
    }
  );
});

['faq_play', 'faq_cogniq', 'faq_exchange', 'faq_impulse'].forEach(action => {
  bot.action(action, async (ctx) => {
    await ctx.answerCbQuery();
    const t = getLang(ctx);
    await ctx.reply(t[action], { parse_mode: 'Markdown' });
  });
});

bot.action('contact', async (ctx) => {
  await ctx.answerCbQuery();
  const t = getLang(ctx);
  await ctx.reply(t.contact, { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
  const t = getLang(ctx);
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
// HTTP сервер для Bothost (чтобы домен отвечал)
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('COGNIQ AI Support Bot is running');
});
server.listen(3000, () => {
  console.log('HTTP server listening on port 3000');
});

bot.launch();
console.log('COGNIQ AI Support бот запущен');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
