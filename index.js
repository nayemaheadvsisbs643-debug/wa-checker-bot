const { Client, LocalAuth } = require('whatsapp-web.js');
const { Telegraf, Markup } = require('telegraf');
const qrcode = require('qrcode');

const BOT_TOKEN = '8635650479:AAEU8UCfEZWkpDkw7ZKhavyod-ogY3t7hmc';
const ADMIN_ID = '7414899469';

const bot = new Telegraf(BOT_TOKEN);
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

let users = new Set();

const mainMenu = (userId) => {
    const buttons = [
        [Markup.button.callback('🔍 Check Number', 'check_num')],
        [Markup.button.callback('📖 How to Use', 'help'), Markup.button.callback('👤 Support', 'support')],
    ];
    if (userId.toString() === ADMIN_ID) {
        buttons.push([Markup.button.callback('⚙️ Admin Panel', 'admin_panel')]);
    }
    return Markup.inlineKeyboard(buttons);
};

const adminMenu = () => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🔌 WA Status', 'wa_status')],
        [Markup.button.callback('🔑 Get QR Code', 'get_qr')],
        [Markup.button.callback('👥 User Count', 'user_count')],
        [Markup.button.callback('🔙 Back to Menu', 'main_menu')],
    ]);
};

client.on('qr', (qr) => {
    qrcode.toDataURL(qr, async (err, url) => {
        if (err) return console.log(err);
        await bot.telegram.sendPhoto(ADMIN_ID, { source: url, caption: 'Boss, please scan this QR code to login WhatsApp! ✅' });
    });
});

client.on('ready', () => {
    console.log('WhatsApp Client is Ready!');
    bot.telegram.sendMessage(ADMIN_ID, 'WhatsApp has been successfully connected! 🎉');
});

bot.start((ctx) => {
    users.add(ctx.from.id);
    ctx.reply(`Welcome ${ctx.from.first_name}! Welcome to the WhatsApp Checker Bot.`, mainMenu(ctx.from.id));
});

bot.action('main_menu', (ctx) => {
    ctx.editMessageText('Main Menu:', mainMenu(ctx.from.id));
});

bot.action('check_num', (ctx) => {
    ctx.reply('Please send the number you want to check.\nExample: +8801700000000');
});

bot.action('help', (ctx) => {
    ctx.reply('How to Use:\n1. Click on "Check Number" button.\n2. Send the number with country code (e.g., +88017...).\n3. The bot will tell you if the number is registered on WhatsApp.', mainMenu(ctx.from.id));
});

bot.action('support', (ctx) => {
    ctx.reply('Contact for support: @YourUsername', mainMenu(ctx.from.id));
});

bot.action('admin_panel', (ctx) => {
    if (ctx.from.id.toString() === ADMIN_ID) {
        ctx.editMessageText('🛠 Welcome to Admin Panel, Boss!', adminMenu());
    } else {
        ctx.answerCbQuery('You are not authorized to access this panel! ❌');
    }
});

bot.action('wa_status', (ctx) => {
    const status = client.getState() === 'CONNECTED' ? 'Connected ✅' : 'Disconnected ❌';
    ctx.answerCbQuery(`WhatsApp Status: ${status}`);
});

bot.action('get_qr', (ctx) => {
    ctx.reply('Generating new QR code, please wait...');
    client.initialize(); 
});

bot.action('user_count', (ctx) => {
    ctx.answerCbQuery(`Total Users: ${users.size}`);
});

bot.on('text', async (ctx) => {
    const number = ctx.message.text;
    if (number.startsWith('+')) {
        try {
            const isRegistered = await client.isRegisteredUser(number);
            if (isRegistered) {
                ctx.reply('✅ This number is registered on WhatsApp.', mainMenu(ctx.from.id));
            } else {
                ctx.reply('❌ This number is NOT registered on WhatsApp.', mainMenu(ctx.from.id));
            }
        } catch (error) {
            ctx.reply('⚠️ Invalid number or system error. Please use correct format.', mainMenu(ctx.from.id));
        }
    } else {
        ctx.reply('Please send the number in correct format (Example: +8801700000000)', mainMenu(ctx.from.id));
    }
});

client.initialize();
bot.launch();
