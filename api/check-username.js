module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { username } = req.body;

    if (!username || username.trim().length === 0) {
        return res.status(400).json({ error: "Username is required", exists: false });
    }

    const cleanUsername = username.trim();
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(cleanUsername)) {
        return res.status(400).json({
            error: "Username tidak valid. Harus 3-20 karakter, hanya huruf, angka, dan underscore.",
            exists: false
        });
    }

    try {
        const response = await fetch(
            `https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(cleanUsername)}`
        );
        const data = await response.json();

        if (data.Id) {
            let avatarUrl = null;
            try {
                const avatarResponse = await fetch(
                    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${data.Id}&size=48x48&format=Png&isCircular=false`
                );
                const avatarData = await avatarResponse.json();
                if (avatarData.data && avatarData.data.length > 0) {
                    avatarUrl = avatarData.data[0].imageUrl;
                }
            } catch (_) {}

            return res.status(200).json({
                exists: true,
                userId: data.Id,
                username: data.Username,
                avatarUrl: avatarUrl,
                message: "Username ditemukan!"
            });
        } else {
            return res.status(404).json({
                exists: false,
                error: "Username tidak ditemukan di Roblox"
            });
        }

    } catch (error) {
        try {
            const fallbackResponse = await fetch("https://users.roblox.com/v1/usernames/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usernames: [cleanUsername], excludeBannedUsers: false })
            });
            const fallbackData = await fallbackResponse.json();

            if (fallbackData.data && fallbackData.data.length > 0) {
                const user = fallbackData.data[0];
                let avatarUrl = null;
                try {
                    const avatarResponse = await fetch(
                        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=48x48&format=Png&isCircular=false`
                    );
                    const avatarData = await avatarResponse.json();
                    if (avatarData.data && avatarData.data.length > 0) {
                        avatarUrl = avatarData.data[0].imageUrl;
                    }
                } catch (_) {}

                return res.status(200).json({
                    exists: true,
                    userId: user.id,
                    username: user.name,
                    avatarUrl: avatarUrl,
                    message: "Username ditemukan!"
                });
            } else {
                return res.status(404).json({
                    exists: false,
                    error: "Username tidak ditemukan di Roblox"
                });
            }
        } catch (fallbackError) {
            return res.status(500).json({
                error: "Gagal memeriksa username. Coba lagi nanti.",
                exists: null
            });
        }
    }
};
