const FormData = require('form-data');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1500071491868557385/oNqFL7VZNjVjTFRAWVKdn_KmcePyd9bQkB6-EtjjHbzdfsnU-hINY2bnSm6yQK7iaIT0';

    try {
        const { username, userId, metode, jumlahRobux, totalHarga, status, buktiBase64, buktiMimeType } = req.body;

        if (!username || !jumlahRobux || !totalHarga) {
            return res.status(400).json({ error: 'Data tidak lengkap' });
        }

        const embed = {
            title: '🎮 Transaksi Baru - KazeRoblox',
            color: 0x4CAF50,
            fields: [
                { name: '👤 Username',     value: String(username),              inline: true },
                { name: '🆔 User ID',      value: userId ? String(userId) : '-', inline: true },
                { name: '\u200B',          value: '\u200B',                      inline: false },
                { name: '⚡ Metode',       value: metode || '-',                 inline: true },
                { name: '💎 Jumlah Robux', value: `${jumlahRobux} Rbx`,         inline: true },
                { name: '💰 Total Harga',  value: String(totalHarga),            inline: true },
                { name: '✅ Status Pembayaran',       value: status || 'SELESAI',           inline: true },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'KazeRoblox TopUp System' }
        };

        let webhookRes;

        if (buktiBase64 && buktiMimeType) {
            const imageBuffer = Buffer.from(buktiBase64, 'base64');
            const ext = buktiMimeType.includes('png') ? 'png'
                      : buktiMimeType.includes('jpg') || buktiMimeType.includes('jpeg') ? 'jpg'
                      : 'png';
            const filename = `bukti_transfer_${Date.now()}.${ext}`;

            const form = new FormData();
            form.append('payload_json', JSON.stringify({
                embeds: [embed],
                attachments: [{ id: 0, filename }]
            }));
            form.append('files[0]', imageBuffer, { filename, contentType: buktiMimeType });

            webhookRes = await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: form.getHeaders(),
                body: form.getBuffer()
            });
        } else {
            webhookRes = await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });
        }

        if (!webhookRes.ok) {
            const errText = await webhookRes.text();
            console.error('Discord webhook error:', webhookRes.status, errText);
            return res.status(500).json({
                error: 'Gagal kirim ke Discord',
                discordStatus: webhookRes.status,
                detail: errText
            });
        }

        return res.status(200).json({ success: true, message: 'Webhook terkirim' });

    } catch (err) {
        console.error('send-webhook error:', err);
        return res.status(500).json({ error: 'Internal server error', detail: err.message });
    }
};
