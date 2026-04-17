require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = '7414899469';

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'main-session'
    }),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--no-zygote',
            '--single-process'
        ]
    },
    webVersionCache: {
        type: 'remote'
    }
});

let users = new Set();
let waitingForPhone = false;

function cleanPhoneNumber(input = '') {
    return String(input).replace(/[^\d]/g, '');
}

function isValidPhoneNumber(input = '') {
    const cleaned = cleanPhoneNumber(input);
    return cleaned.length >= 8 && cleaned.length <= 15;
}

function mainMenu(userId) {
    const buttons = [
        ['🔍 Check Number'],
        ['📖 How to Use', '👤 Support']
    ];

    if (String(userId) === ADMIN_ID) {
        buttons.push(['⚙️ Admin Panel']);
    }

    return Markup.keyboard(buttons).resize();
}

function adminMenu() {
    return Markup.keyboard([
        ['🔌 WA Status'],
        ['🔑 Link Account'],
        ['👥 User Count'],
        ['🔙 Back to Menu']
    ]).resize();
}

client.on('loading_screen', (percent, message) => {
    console.log(`Loading... ${percent}% ${message}`);
});

client.on('qr', () => {
    console.log('QR event received');
});

client.on('code', (code) => {
    console.log('Pairing code event:', code);
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp authenticated');
});

client.on('ready', async () => {
    console.log('✅ WhatsApp Client Ready!');
    try {
        await bot.telegram.sendMessage(
            ADMIN_ID,
            '✅ WhatsApp connected successfully!'
        );
    } catch (err) {
        console.error('Admin notify failed:', err.message);
    }
});

client.on('auth_failure', (msg) => {
    console.error('❌ Auth failure:', msg);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ WhatsApp disconnected:', reason);
});

bot.start((ctx) => {
    users.add(ctx.from.id);
    return ctx.reply(
        `👋 Welcome ${ctx.from.first_name || 'User'}!\nUse the menu below:`,
        mainMenu(ctx.from.id)
    );
});

bot.on('text', async (ctx) => {
    const text = (ctx.message.text || '').trim();
    const userId = String(ctx.from.id);

    users.add(ctx.from.id);

    if (text === '⚙️ Admin Panel') {
        if (userId === ADMIN_ID) {
            return ctx.reply('🛠 Admin Panel', adminMenu());
        }
        return ctx.reply('❌ You are not authorized.');
    }

    if (text === '🔙 Back to Menu') {
        waitingForPhone = false;
        return ctx.reply('🏠 Main Menu', mainMenu(userId));
    }

    if (userId === ADMIN_ID) {
        if (text === '🔌 WA Status') {
            try {
                const state = await client.getState();
                return ctx.reply(`📡 WhatsApp Status: ${state}`);
            } catch (err) {
                return ctx.reply('❌ WhatsApp Status: Disconnected');
            }
        }

        if (text === '👥 User Count') {
            return ctx.reply(`👤 Total Users: ${users.size}`);
        }

        if (text === '🔑 Link Account') {
            waitingForPhone = true;
            return ctx.reply(
                '📲 Send your WhatsApp number with country code.\n\nExamples:\n+8801700000000\n+919876543210\n+12025550108'
            );
        }
    }

    if (waitingForPhone && userId === ADMIN_ID) {
        const phoneNumber = cleanPhoneNumber(text);

        if (!isValidPhoneNumber(phoneNumber)) {
            return ctx.reply(
                '❌ Invalid number format.\nSend a valid number with country code.\nExample: +8801700000000'
            );
        }

        waitingForPhone = false;

        try {
            const code = await client.requestPairingCode(phoneNumber);

            return ctx.reply(
                `🔑 Pairing Code: ${code}\n\n📌 Use it in WhatsApp:\n1. Open WhatsApp\n2. Linked Devices\n3. Link with phone number instead\n4. Enter this code`,
                mainMenu(userId)
            );
        } catch (err) {
            console.error('Pairing error:', err);
            return ctx.reply(
                '❌ Failed to get pairing code.\nMake sure WhatsApp client is ready and try again.',
                mainMenu(userId)
            );
        }
    }

    if (text === '🔍 Check Number') {
        return ctx.reply(
            '📲 Send the number you want to check.\n\nExamples:\n+8801700000000\n+919876543210\n+12025550108'
        );
    }

    if (text === '📖 How to Use') {
        return ctx.reply(
            '1️⃣ Click "Check Number"\n2️⃣ Send number with country code\n3️⃣ Bot will tell you whether it is on WhatsApp',
            mainMenu(userId)
        );
    }

    if (text === '👤 Support') {
        return ctx.reply('📞 Contact: @YourUsername', mainMenu(userId));
    }

    const cleaned = cleanPhoneNumber(text);

    if (isValidPhoneNumber(cleaned)) {
        try {
            const jid = `${cleaned}@c.us`;
            const isRegistered = await client.isRegisteredUser(jid);

            if (isRegistered) {
                return ctx.reply(
                    `✅ This number is registered on WhatsApp.\n📱 Number: +${cleaned}`,
                    mainMenu(userId)
                );
            } else {
                return ctx.reply(
                    `❌ This number is NOT registered on WhatsApp.\n📱 Number: +${cleaned}`,
                    mainMenu(userId)
                );
            }
        } catch (err) {
            console.error('Check number error:', err);
            return ctx.reply(
                '⚠️ System error. Please try again later.',
                mainMenu(userId)
            );
        }
    }

    return ctx.reply(
        '⚠️ Please use the menu or send a valid number with country code.\nExample: +8801700000000',
        mainMenu(userId)
    );
});

(async () => {
    try {
        await client.initialize();
        await bot.launch();
        console.log('🤖 Telegram bot started');
    } catch (err) {
        console.error('Startup error:', err);
        process.exit(1);
    }
})();

process.once('SIGINT', async () => {
    try {
        await bot.stop('SIGINT');
        await client.destroy();
    } catch (e) {}
    process.exit(0);
});

process.once('SIGTERM', async () => {
    try {
        await bot.stop('SIGTERM');
        await client.destroy();
    } catch (e) {}
    process.exit(0);
});
