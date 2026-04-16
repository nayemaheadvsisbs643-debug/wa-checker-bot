const { Client, LocalAuth } = require('whatsapp-web.js');
const { Telegraf, Markup } = require('telegraf');

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
let waitingForPhone = false;

const mainMenu = (userId) => {
    const buttons = [
        ['🔍 Check Number'],
        ['📖 How to Use', '👤 Support']
    ];
    if (userId.toString() === ADMIN_ID) {
        buttons.push(['⚙️ Admin Panel']);
    }
    return Markup.keyboard(buttons).resize();
};

const adminMenu = () => {
    return Markup.keyboard([
        ['🔌 WA Status'],
        ['🔑 Link Account'],
        ['👥 User Count'],
        ['🔙 Back to Menu']
    ]).resize();
};

client.on('ready', () => {
    console.log('WhatsApp Client is Ready!');
    bot.telegram.sendMessage(ADMIN_ID, 'WhatsApp connected successfully! 🎉');
});

bot.start((ctx) => {
    users.add(ctx.from.id);
    ctx.reply(`Welcome ${ctx.from.first_name}! Use the menu below:`, mainMenu(ctx.from.id));
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    if (text === '⚙️ Admin Panel') {
        if (userId.toString() === ADMIN_ID) {
            return ctx.reply('🛠 Admin Panel:', adminMenu());
        }
        return ctx.reply('You are not authorized! ❌');
    }

    if (text === '🔙 Back to Menu') {
        return ctx.reply('Main Menu:', mainMenu(userId));
    }

    if (userId.toString() === ADMIN_ID) {
        if (text === '🔌 WA Status') {
            const status = client.getState() === 'CONNECTED' ? 'Connected ✅' : 'Disconnected ❌';
            return ctx.reply(`WhatsApp Status: ${status}`);
        }
        if (text === '👥 User Count') {
            return ctx.reply(`Total Users: ${users.size}`);
        }
        if (text === '🔑 Link Account') {
            waitingForPhone = true;
            return ctx.reply('Please send your WhatsApp number with country code.\nExample: +8801700000000');
        }
    }

    if (waitingForPhone && userId.toString() === ADMIN_ID) {
        if (text.startsWith('+')) {
            waitingForPhone = false;
            try {
                const code = await client.requestPairingCode(text);
                return ctx.reply(`Your Pairing Code is: ${code}\n\nHow to use:\n1. Open WhatsApp $\rightarrow$ Linked Devices\n2. Link a Device $\rightarrow$ Link with phone number instead\n3. Enter this code.`, mainMenu(userId));
            } catch (e) {
                return ctx.reply('Error getting code. Please try again.', mainMenu(userId));
            }
        } else {
            return ctx.reply('Invalid format! Send number as: +8801700000000');
        }
    }

    if (text === '🔍 Check Number') {
        return ctx.reply('Please send the number to check.\nExample: +8801700000000');
    }
    if (text === '📖 How to Use') {
        return ctx.reply('1. Click "Check Number"\n2. Send number with + country code\n3. Bot will check if it is on WhatsApp.', mainMenu(userId));
    }
    if (text === '👤 Support') {
        return ctx.reply('Contact: @YourUsername', mainMenu(userId));
    }

    if (text.startsWith('+')) {
        try {
            const isRegistered = await client.isRegisteredUser(text);
            if (isRegistered) {
                ctx.reply('✅ This number is registered on WhatsApp.', mainMenu(userId));
            } else {
                ctx.reply('❌ This number is NOT registered on WhatsApp.', mainMenu(userId));
            }
        } catch (error) {
            ctx.reply('⚠️ System error. Please try again later.', mainMenu(userId));
        }
    } else {
        ctx.reply('Please use the menu or send a number in format: +8801700000000', mainMenu(userId));
    }
});

client.initialize();
bot.launch();
