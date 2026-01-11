const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// --- CẤU HÌNH BẢO MẬT ---
const TOKEN = '8519714140:AAHuUH0VRtDvFOQKPeP_Rdd-qc30jQLq9vM'; // Token Bot
const ADMIN_ID = 8144161968;             // ID Telegram Admin
const API_SECRET = "ALEX_PRO_SECRET_@NGUYENDUVIPAA"; // MÃ BÍ MẬT CHỐNG CRACK API
const DB_FILE = './database.json';

const bot = new TelegramBot(TOKEN, {polling: true});

// Quản lý Database
const loadDB = () => {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE));
    return { keys: {} };
};
const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
let db = loadDB();

// --- [API XÁC THỰC BẢO MẬT] ---
app.post('/api/verify', (req, res) => {
    const { key, deviceId, secret } = req.body;

    // 1. Chống Crack API (Chỉ Tool chính chủ mới có Secret này)
    if (secret !== API_SECRET) {
        return res.status(403).json({ success: false, msg: "CẢNH BÁO: TRUY CẬP TRÁI PHÉP!" });
    }

    const keyData = db.keys[key];
    if (!keyData) return res.json({ success: false, msg: "MÃ KEY KHÔNG TỒN TẠI!" });
    if (keyData.isLocked) return res.json({ success: false, msg: "KEY ĐÃ BỊ ADMIN KHÓA!" });
    if (Date.now() > keyData.expireAt) return res.json({ success: false, msg: "KEY ĐÃ HẾT HẠN!" });

    // 2. Chống dùng chung (Khóa máy)
    if (keyData.deviceId === null) {
        keyData.deviceId = deviceId;
        saveDB(db);
    }

    if (keyData.deviceId === deviceId) {
        res.json({ success: true });
    } else {
        res.json({ success: false, msg: "KEY ĐÃ ĐƯỢC DÙNG TRÊN MÁY KHÁC!" });
    }
});

// --- [BOT TELEGRAM QUẢN LÝ] ---
bot.onText(/\/gen (\d+)([hd])/, (msg, match) => {
    if (msg.from.id !== ADMIN_ID) return;
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    let ms = unit === 'h' ? val * 3600000 : val * 86400000;

    const newKey = `ALEX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    db.keys[newKey] = { deviceId: null, expireAt: Date.now() + ms, isLocked: false };
    saveDB(db);
    
    bot.sendMessage(msg.chat.id, `✅ **KEY MỚI:** \`${newKey}\`\n⏳ **HẠN:** ${val}${unit}`, {parse_mode: "Markdown"});
});

bot.onText(/\/lock (.*)/, (msg, match) => {
    if (msg.from.id !== ADMIN_ID) return;
    const k = match[1].trim().toUpperCase();
    if (db.keys[k]) { db.keys[k].isLocked = true; saveDB(db); bot.sendMessage(msg.chat.id, `🔒 Đã khóa Key: ${k}`); }
});

bot.onText(/\/reset (.*)/, (msg, match) => {
    if (msg.from.id !== ADMIN_ID) return;
    const k = match[1].trim().toUpperCase();
    if (db.keys[k]) { db.keys[k].deviceId = null; saveDB(db); bot.sendMessage(msg.chat.id, `🔄 Đã reset máy cho: ${k}`); }
});

app.get('/', (req, res) => res.send('SERVER LIVE'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API đang chạy trên Port ${PORT}`));
