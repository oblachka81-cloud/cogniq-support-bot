const { Telegraf } = require('telegraf');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPPORT_OWNER_ID = process.env.SUPPORT_OWNER_ID || '638242293';

if (!BOT_TOKEN) { console.error('BOT_TOKEN is not set'); process.exit(1); }

const bot = new Telegraf(BOT_TOKEN);

const LANG = {
  ru: {
    welcome: (name) => `🛟 Привет, ${name}!\n\nЯ — COGNIQ AI Support, официальная поддержка экосистемы **NEURON**.\n\nВыбери вопрос или напиши свой — я помогу!`,
    support_btn: '🛟 Открыть центр поддержки',
    contact_btn: '💬 Написать в поддержку',
    contact: '📞 Напиши свой вопрос — я передам его разработчикам. Ответим в ближайшее время! 💬',
    forwarded: '✅ Я передал твоё сообщение команде NEURON. Мы ответим в ближайшее время!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Сообщение от ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  en: {
    welcome: (name) => `🛟 Hi, ${name}!\n\nI'm COGNIQ AI Support, official support for **NEURON** ecosystem.\n\nWrite your question — I'll help!`,
    support_btn: '🛟 Open Support Center',
    contact_btn: '💬 Contact Support',
    contact: '📞 Write your question — I\'ll forward it to the developers. We\'ll reply soon! 💬',
    forwarded: '✅ Message forwarded to NEURON team. We\'ll reply soon!',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Message from ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  fr: {
    welcome: (name) => `🛟 Salut, ${name}!\n\nJe suis COGNIQ AI Support, support officiel de **NEURON**.\n\nÉcris ta question — je t'aiderai!`,
    support_btn: '🛟 Ouvrir le centre de support',
    contact_btn: '💬 Contacter le support',
    contact: '📞 Écris ta question — je la transmettrai. Réponse bientôt! 💬',
    forwarded: '✅ Message transmis à l\'équipe NEURON.',
    forwarded_to_owner: (userName, userId, msg) => `📩 **Message de ${userName}** (ID: ${userId})\n\n${msg}`,
  },
  es: {
    welcome: (name) => `🛟 ¡Hola, ${name}!\n\nSoy COGNIQ AI Support, soporte oficial de **NEURON**.\n\n¡Escribe tu pregunta!`,
    support_btn: '🛟 Abrir centro de soporte',
    contact_btn: '💬 Contactar soporte',
    contact: '📞 Escribe tu pregunta — la enviaré. ¡Responderemos pronto! 💬',
    forwarded: '✅ Mensaje enviado al equipo NEURON.',
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
        inline_keyboard: [[{ text: t.support_btn, web_app: { url: 'https://cogniqai.bothost.tech' } }]]
      }
    }
  );
});

bot.on('text', async (ctx) => {
  const t = getLang(ctx);
  const userMsg = ctx.message.text;
  const user = ctx.from;
  const userName = user.username ? `@${user.username}` : user.first_name || 'User';
  await ctx.reply(t.forwarded);
  try {
    await bot.telegram.sendMessage(SUPPORT_OWNER_ID, t.forwarded_to_owner(userName, user.id, userMsg), { parse_mode: 'Markdown' });
  } catch (e) {}
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
server.listen(3000, () => console.log('HTTP on 3000'));

bot.launch();
console.log('Support bot started');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
