const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ================= CẤU HÌNH =================
const TOKEN = '8519714140:AAHn9nsKQ7sGOq4R11xEchE1IeyvYiNiYPI'; 
const ADMIN_ID = 8144161968;             // ID Telegram của bạn
const API_SECRET = "ALEX_SECRET_999";   // Mã bí mật (phải khớp với file HTML)
const DB_FILE = './database.json';
const PORT = 3000;
// ============================================

// Khởi tạo Bot và xử lý lỗi xung đột (409)
const bot = new TelegramBot(TOKEN, { polling: false });

bot.deleteWebHook().then(() => {
    console.log("🛠 Đã xóa Webhook cũ. Đang khởi động Polling...");
    bot.startPolling();
});

// Quản lý Database bền vững trên VPS
const loadDB = () => {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE));
    return { keys: {} };
};
const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
let db = loadDB();

// --- API XÁC THỰC ---
app.post('/api/verify', (req, res) => {
    const { key, deviceId, secret } = req.body;

    if (secret !== API_SECRET) {
        return res.status(403).json({ success: false, msg: "SECRET SAI!" });
    }

    const keyData = db.keys[key];
    if (!keyData) return res.json({ success: false, msg: "KEY KHÔNG TỒN TẠI!" });
    if (keyData.isLocked) return res.json({ success: false, msg: "KEY ĐÃ BỊ KHÓA!" });
    if (Date.now() > keyData.expireAt) return res.json({ success: false, msg: "KEY HẾT HẠN!" });

    if (keyData.deviceId === null) {
        keyData.deviceId = deviceId;
        saveDB(db);
    }

    if (keyData.deviceId === deviceId) {
        res.json({ success: true });
    } else {
        res.json({ success: false, msg: "KEY ĐÃ KÍCH HOẠT MÁY KHÁC!" });
    }
});

// --- LỆNH BOT QUẢN LÝ ---
// Tạo Key: /gen 1h, /gen 12h, /gen 1d...
bot.onText(/\/gen (\d+)([hd])/, (msg, match) => {
    if (msg.from.id !== ADMIN_ID) return;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    let ms = unit === 'h' ? value * 3600000 : value * 86400000;

    const newKey = `ALEX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    db.keys[newKey] = { deviceId: null, expireAt: Date.now() + ms, isLocked: false };
    saveDB(db);

    bot.sendMessage(msg.chat.id, `✅ **KEY MỚI:** \`${newKey}\`\n⏳ **HẠN:** ${value}${unit}`, { parse_mode: "Markdown" });
});

bot.onText(/\/lock (.*)/, (msg, match) => {
    if (msg.from.id !== ADMIN_ID) return;
    const k = match[1].trim().toUpperCase();
    if (db.keys[k]) { db.keys[k].isLocked = true; saveDB(db); bot.sendMessage(msg.chat.id, `🔒 Đã khóa Key: ${k}`); }
});

bot.onText(/\/reset (.*)/, (msg, match) => {
    if (msg.from.id !== ADMIN_ID) return;
    const k = match[1].trim().toUpperCase();
    if (db.keys[k]) { db.keys[k].deviceId = null; saveDB(db); bot.sendMessage(msg.chat.id, `🔄 Đã Reset máy cho: ${k}`); }
});

bot.onText(/\/list/, (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    let list = "📋 **DANH SÁCH KEY:**\n";
    for (const k in db.keys) {
        const item = db.keys[k];
        const status = item.isLocked ? "❌" : (item.deviceId ? "📱" : "🟢");
        list += `\n${status} \`${k}\``;
    }
    bot.sendMessage(msg.chat.id, list, { parse_mode: "Markdown" });
});

// Lỗi Polling
bot.on('polling_error', (err) => {
    if (err.message.includes('409 Conflict')) {
        console.log("⚠️ Xung đột Token! Vui lòng kiểm tra có bản bot nào khác đang chạy không.");
    }
});

app.listen(PORT, () => console.log(`API đang chạy tại Port ${PORT}`));
