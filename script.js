// Konfigurasi Harga per 1 Robux
const RATES = {
    pending: 110, 
    instant: 130, 
    gift: 140     
};

const MIN_ROBUX = 100; 

// LINK PROFIL AKUN ADMIN UNTUK VIA GIFT (BENAR & FINAL)
const ROBLOX_GIFT_PROFILE = "https://www.roblox.com/share?code=908ad5f1a397a740a50e295f4e48d8c8&type=Profile&source=ProfileShare&stamp=1781198347089";

let currentMode = 'pending';
let selectedRobux = 0;
let currentPrice = 0;

let usernameCheckTimeout = null;
let isUsernameValid = false;
let verifiedUserId = null;
let verifiedUsername = null;
let buktiFile = null;

let KazeCart = JSON.parse(localStorage.getItem('kazecart_data')) || [];
let KazeHistory = JSON.parse(localStorage.getItem('kazehistory_data')) || [];
let checkoutContext = { type: 'direct', data: null };

const packages = [
    100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000
];

function formatRupiah(angka) {
    return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* --- CEK USERNAME ROBLOX VIA API --- */
async function checkRobloxUsername(username) {
    const statusEl = document.getElementById('username-status');
    if (!username || username.trim() === '') {
        statusEl.innerHTML = '';
        isUsernameValid = false;
        verifiedUserId = null;
        return;
    }

    statusEl.innerHTML = `<span class="status-loading"><i class="fas fa-spinner fa-spin"></i> Mengecek...</span>`;

    try {
        const response = await fetch('/api/check-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.trim() })
        });
        const data = await response.json();

        if (data.exists === true) {
            verifiedUserId = data.userId;
            verifiedUsername = data.username;
            isUsernameValid = true;

            const avatarHtml = data.avatarUrl
                ? `<img src="${data.avatarUrl}" alt="avatar" class="roblox-avatar" onerror="this.style.display='none'">`
                : '';

            statusEl.innerHTML = `
                <div class="status-valid">
                    ${avatarHtml}
                    <div class="status-info">
                        <span class="status-name"><i class="fas fa-check-circle"></i> ${data.username}</span>
                        <span class="status-id">ID: ${data.userId}</span>
                    </div>
                </div>`;
        } else {
            isUsernameValid = false;
            statusEl.innerHTML = `<span class="status-invalid"><i class="fas fa-times-circle"></i> ${data.error || 'User tidak ada'}</span>`;
        }
    } catch (err) {
        isUsernameValid = false;
        statusEl.innerHTML = `<span class="status-error"><i class="fas fa-exclamation-triangle"></i> Gagal terhubung</span>`;
    }
}

function onUsernameInput() {
    clearTimeout(usernameCheckTimeout);
    isUsernameValid = false;
    verifiedUserId = null;

    const val = document.getElementById('username').value;
    const statusEl = document.getElementById('username-status');

    if (!val || val.trim() === '') {
        statusEl.innerHTML = '';
        return;
    }

    statusEl.innerHTML = `<span class="status-loading"><i class="fas fa-spinner fa-spin"></i> Mengetik...</span>`;
    usernameCheckTimeout = setTimeout(() => { checkRobloxUsername(val); }, 800);
}

/* --- MODE TABS SELECTION --- */
function setMode(mode) {
    currentMode = mode;
    document.getElementById('tab-pending').classList.remove('active');
    document.getElementById('tab-instant').classList.remove('active');
    document.getElementById('tab-gift').classList.remove('active');
    document.getElementById(`tab-${mode}`).classList.add('active');

    document.getElementById('warning-instant').style.display = mode === 'instant' ? 'block' : 'none';
    document.getElementById('warning-gift').style.display = mode === 'gift' ? 'block' : 'none';
    
    renderGrid();
    calculateCustomPrice();
}

function renderGrid() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = '';

    packages.forEach(amount => {
        const price = amount * RATES[currentMode];
        const card = document.createElement('div');
        card.className = `product-card ${selectedRobux === amount ? 'selected' : ''}`;
        card.onclick = () => selectPackage(amount, price);
        card.innerHTML = `
            <div class="rbx-amount"><i class="fas fa-gem"></i> ${amount}</div>
            <div class="price">${formatRupiah(price)}</div>
        `;
        grid.appendChild(card);
    });
}

function selectPackage(amount, price) {
    selectedRobux = amount;
    currentPrice = price;
    document.getElementById('custom-robux').value = '';
    document.getElementById('custom-price').innerText = 'Rp 0';
    updateBottomPrice();
    renderGrid();
}

function calculateCustomPrice() {
    const inputVal = document.getElementById('custom-robux').value;
    if (inputVal && inputVal > 0) {
        selectedRobux = 0;
        renderGrid();
        let amount = parseInt(inputVal);
        
        if (currentMode === 'gift' && amount > 5000) {
            amount = 5000;
            document.getElementById('custom-robux').value = 5000;
            alert('Maksimal pembelian via Gift adalah 5000 Robux per transaksi.');
        } else if (amount > 5000) {
            amount = 5000;
            document.getElementById('custom-robux').value = 5000;
            alert('Maksimal pembelian adalah 5000 Robux per transaksi.');
        }
        
        currentPrice = amount * RATES[currentMode];
        document.getElementById('custom-price').innerText = formatRupiah(currentPrice);
    } else {
        if (selectedRobux === 0) currentPrice = 0;
        document.getElementById('custom-price').innerText = 'Rp 0';
    }
    updateBottomPrice();
}

function updateBottomPrice() {
    document.getElementById('bottom-total-price').innerText = formatRupiah(currentPrice);
}

function getActiveRobuxAmount() {
    if (selectedRobux > 0) return selectedRobux;
    const inputVal = document.getElementById('custom-robux').value;
    return inputVal ? parseInt(inputVal) : 0;
}

/* --- CART SYSTEM --- */
function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    badge.innerText = KazeCart.length;
    badge.style.display = KazeCart.length > 0 ? 'block' : 'none';
}

function getModeText(mode) {
    if (mode === 'pending') return '5-7 Hari';
    if (mode === 'instant') return 'Instant';
    if (mode === 'gift') return 'Via Gift';
    return mode;
}

function tambahKeKeranjang() {
    const username = document.getElementById('username').value.trim();
    if (!username || !isUsernameValid) {
        alert("Silakan masukkan Username Roblox yang terverifikasi dahulu!");
        return;
    }
    
    const robuxAmount = getActiveRobuxAmount();
    if (robuxAmount === 0) {
        alert("Pilih nominal paket atau masukkan jumlah Robux dahulu!");
        return;
    }
    
    if (robuxAmount < MIN_ROBUX) {
        alert(`Maaf, minimal top up adalah ${MIN_ROBUX} Robux!`);
        return;
    }

    const item = {
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        username: verifiedUsername || username,
        userId: verifiedUserId || '-',
        mode: currentMode,
        modeText: getModeText(currentMode),
        robux: robuxAmount,
        price: currentPrice
    };

    if (currentMode === 'gift') {
        item.profileLink = ROBLOX_GIFT_PROFILE;
    }

    KazeCart.push(item);
    localStorage.setItem('kazecart_data', JSON.stringify(KazeCart));
    updateCartBadge();
    alert(`Berhasil memasukkan ${item.robux} Robux untuk user ${item.username} ke keranjang.`);
}

function openKeranjang() {
    renderCartList();
    document.getElementById('modal-keranjang').style.display = 'flex';
}

function closeKeranjang() {
    document.getElementById('modal-keranjang').style.display = 'none';
}

function renderCartList() {
    const container = document.getElementById('cart-items-list');
    container.innerHTML = '';
    let total = 0;

    if (KazeCart.length === 0) {
        container.innerHTML = `<p style="color: #8b949e; text-align: center; padding: 20px 0; font-size: 13px;">Keranjang kosong.</p>`;
        document.getElementById('cart-total-price').innerText = 'Rp 0';
        document.getElementById('cart-total-items').innerText = '0';
        return;
    }

    KazeCart.forEach((item) => {
        total += item.price;
        const div = document.createElement('div');
        div.className = 'cart-item-card';
        
        let giftBadgeHtml = item.mode === 'gift' ? ` <span style="background:#8b5cf6; color:#fff; font-size:9px; padding:1px 4px; border-radius:4px; margin-left:4px;">+Link Friend</span>` : '';
        
        div.innerHTML = `
            <div class="cart-item-details">
                <h4>${item.robux} Robux (${item.modeText})${giftBadgeHtml}</h4>
                <p><i class="fas fa-user"></i> ${item.username} | ${formatRupiah(item.price)}</p>
            </div>
            <button class="cart-item-remove-btn" onclick="hapusItemKeranjang('${item.id}')" title="Hapus">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        container.appendChild(div);
    });

    document.getElementById('cart-total-price').innerText = formatRupiah(total);
    document.getElementById('cart-total-items').innerText = KazeCart.length;
}

function hapusItemKeranjang(id) {
    KazeCart = KazeCart.filter(item => item.id !== id);
    localStorage.setItem('kazecart_data', JSON.stringify(KazeCart));
    updateCartBadge();
    renderCartList();
}

/* --- HISTORY TRANSAKSI --- */
function openRiwayat() {
    renderRiwayatList();
    document.getElementById('modal-riwayat').style.display = 'flex';
}

function closeRiwayat() {
    document.getElementById('modal-riwayat').style.display = 'none';
}

function renderRiwayatList() {
    const container = document.getElementById('riwayat-items-list');
    container.innerHTML = '';

    if (KazeHistory.length === 0) {
        container.innerHTML = `<p style="color: #8b949e; text-align: center; padding: 20px 0; font-size: 13px;">Belum ada riwayat pembelian.</p>`;
        return;
    }

    [...KazeHistory].reverse().forEach(data => {
        const div = document.createElement('div');
        div.className = 'riwayat-card';
        
        let itemSummary = '';
        if (data.items && Array.isArray(data.items)) {
            itemSummary = data.items.map(i => {
                let linkAppend = i.mode === 'gift' ? ' *(Via Gift)*' : '';
                return `- ${i.robux} Rbx (${i.modeText}) untuk ${i.username}${linkAppend}`;
            }).join('<br>');
        } else {
            let linkAppend = data.metode === 'Via Gift' ? ' *(Via Gift)*' : '';
            itemSummary = `- ${data.jumlahRobux} Rbx (${data.metode}) untuk ${data.username}${linkAppend}`;
        }

                div.innerHTML = `
            <div class="riwayat-date">${data.waktu}</div>
            <div style="margin-bottom: 6px; font-weight: 600; color: #fff;">Invoice Belanja:</div>
            <div style="color: #c9d1d9; margin-bottom: 6px; line-height: 1.4; font-size: 12px;">${itemSummary}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #21262d; padding-top: 5px;">
                <span style="color: #8b949e;">Total Bayar:</span>
                <strong style="color: #2ea043;">${data.totalHarga}</strong>
            </div>
        `;
        container.appendChild(div);
    });
}

/* --- CHECKOUT MANAGEMENT --- */
function beliSekarangDirect() {
    const username = document.getElementById('username').value.trim();
    if (!username || !isUsernameValid) {
        alert("Silakan masukkan Username Roblox yang terverifikasi terlebih dahulu!");
        return;
    }
    
    const robuxAmount = getActiveRobuxAmount();
    if (robuxAmount === 0) {
        alert("Silakan pilih paket produk terlebih dahulu.");
        return;
    }

    if (robuxAmount < MIN_ROBUX) {
        alert(`Maaf, minimal top up adalah ${MIN_ROBUX} Robux!`);
        return;
    }

    const typeName = getModeText(currentMode);

    checkoutContext.type = 'direct';
    checkoutContext.data = {
        username: verifiedUsername || username,
        userId: verifiedUserId,
        metode: typeName,
        jumlahRobux: robuxAmount,
        totalHarga: currentPrice
    };

    let invoiceHtml = `
        <div class="invoice-row-item"><span>Username</span><span>${verifiedUsername || username}</span></div>
        <div class="invoice-row-item"><span>Layanan</span><span>${typeName}</span></div>
        <div class="invoice-row-item"><span>Jumlah</span><span>${robuxAmount} Robux</span></div>
    `;

    if (currentMode === 'gift') {
        checkoutContext.data.profileLink = ROBLOX_GIFT_PROFILE;
        invoiceHtml += `
            <div class="invoice-row-item" style="border-top: 1px dashed #30363d; padding-top: 6px;">
                <span style="color: #8b5cf6; font-weight: bold;">Info Gift Admin</span>
                <span style="color: #8b5cf6; font-size: 11px;">Tersedia di WA</span>
            </div>
        `;
    }

    openQrisModal(formatRupiah(currentPrice), invoiceHtml);
}

function checkoutDariKeranjang() {
    if (KazeCart.length === 0) {
        alert("Keranjang kamu kosong.");
        return;
    }

    let total = 0;
    let htmlDetails = '';
    KazeCart.forEach(item => {
        total += item.price;
        let styleGift = item.mode === 'gift' ? 'style="color: #8b5cf6; font-weight: bold;"' : '';
        htmlDetails += `<div class="invoice-row-item"><span ${styleGift}>${item.robux} Rbx (${item.modeText})</span><span style="color:#8b949e;">${item.username}</span></div>`;
    });

    checkoutContext.type = 'cart';
    checkoutContext.data = {
        items: [...KazeCart],
        totalHarga: total
    };

    closeKeranjang();
    openQrisModal(formatRupiah(total), htmlDetails);
}

function openQrisModal(totalFormatted, detailsHtml) {
    document.getElementById('qris-details-container').innerHTML = detailsHtml;
    document.getElementById('qris-total-price').innerText = totalFormatted;

    buktiFile = null;
    document.getElementById('bukti-input').value = '';
    document.getElementById('bukti-preview').style.display = 'none';
    document.getElementById('bukti-upload-area').style.display = 'flex';
    
    const btn = document.getElementById('sudah-bayar-btn');
    btn.disabled = false;
    btn.innerText = 'Sudah Membayar';

    document.getElementById('modal-qris').style.display = 'flex';
}

function closeQris() {
    document.getElementById('modal-qris').style.display = 'none';
}

function hapusBukti() {
    buktiFile = null;
    document.getElementById('bukti-input').value = '';
    document.getElementById('bukti-preview').style.display = 'none';
    document.getElementById('bukti-upload-area').style.display = 'flex';
}

/* --- SEND WEBHOOK & WHATSAPP REDIRECT --- */
async function konfirmasiWhatsApp() {
    if (!buktiFile) {
        alert('Mohon upload bukti foto transfer/scan yang sah terlebih dahulu!');
        return;
    }

    const btn = document.getElementById('sudah-bayar-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

    const timestamp = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    let totalBayarStr = formatRupiah(checkoutContext.data.totalHarga);
    let orderLog = {};

    let pesanWA = `Halo Admin KazeRoblox, saya sudah membayar TopUp Robux.%0A%0A*Detail Pesanan:*%0A`;
    let payloadPayload = {};

    if (checkoutContext.type === 'direct') {
        const d = checkoutContext.data;
        pesanWA += `- Username: ${d.username}%0A- Layanan: ${d.metode}%0A- Jumlah: ${d.jumlahRobux} Rbx%0A`;
        
        if (d.profileLink) {
            pesanWA += `- Link Add Friend Admin: ${d.profileLink}%0A*(Harap add akun admin di atas agar gift proses lancar)*%0A`;
        }

        orderLog = {
            waktu: timestamp,
            username: d.username,
            jumlahRobux: d.jumlahRobux,
            metode: d.metode,
            totalHarga: totalBayarStr
        };

        if (d.profileLink) orderLog.profileLink = d.profileLink;

        payloadPayload = {
            username: d.username,
            userId: d.userId || '-',
            metode: d.metode,
            jumlahRobux: d.jumlahRobux,
            totalHarga: totalBayarStr,
            status: 'PENDING (Check Bukti)'
        };

        if (d.profileLink) payloadPayload.profileLink = d.profileLink;
    } else {
        pesanWA += `*Checkout Multi-Item (Keranjang):*%0A`;
        let containsGift = false;
        
        checkoutContext.data.items.forEach((item, idx) => {
            pesanWA += `${idx+1}. ${item.robux} Rbx (${item.modeText}) -> User: ${item.username}%0A`;
            if (item.mode === 'gift') containsGift = true;
        });
        
        if (containsGift) {
            pesanWA += `- Link Add Friend Admin (Gift Item): ${ROBLOX_GIFT_PROFILE}%0A*(Harap add akun admin di atas agar gift proses lancar)*%0A`;
        }
        
        orderLog = {
            waktu: timestamp,
            items: checkoutContext.data.items,
            totalHarga: totalBayarStr
        };

        const summaryUsernames = checkoutContext.data.items.map(i => i.username).join(', ');
        const summaryRobux = checkoutContext.data.items.reduce((acc, curr) => acc + curr.robux, 0);
        const summaryModes = checkoutContext.data.items.map(i => i.modeText).join(', ');

        payloadPayload = {
            username: `[Keranjang] ${summaryUsernames}`,
            userId: 'Multi-ID',
            metode: `Multi: ${summaryModes}`,
            jumlahRobux: summaryRobux,
            totalHarga: totalBayarStr,
            status: 'PENDING (Keranjang Belanja)'
        };

        if (containsGift) payloadPayload.profileLink = ROBLOX_GIFT_PROFILE;
    }

    pesanWA += `- Total Bayar: ${totalBayarStr}%0A- Metode: QRIS%0A%0ABerikut saya lampirkan bukti pembayaran digital saya.`;

    try {
        const base64Raw = await fileToBase64(buktiFile);
        const cleanBase64 = base64Raw.split(',')[1];

        payloadPayload.buktiBase64 = cleanBase64;
        payloadPayload.buktiMimeType = buktiFile.type;

        await fetch('/api/send-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadPayload)
        });
    } catch (err) {
        console.warn('Webhook gagal dikirim ke endpoint backend.', err);
    }

    KazeHistory.push(orderLog);
    localStorage.setItem('kazehistory_data', JSON.stringify(KazeHistory));

    if (checkoutContext.type === 'cart') {
        KazeCart = [];
        localStorage.setItem('kazecart_data', JSON.stringify(KazeCart));
        updateCartBadge();
    }

    const nomorWA = "6282241515939";
    window.open(`https://wa.me/${nomorWA}?text=${pesanWA}`, '_blank');
    closeQris();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/* --- INITIALIZE COMPONENT LIFE-CYCLE --- */
document.addEventListener('DOMContentLoaded', () => {
    renderGrid();
    updateCartBadge();

    const buktiInput = document.getElementById('bukti-input');
    const buktiPreview = document.getElementById('bukti-preview');
    const buktiPreviewImg = document.getElementById('bukti-preview-img');
    const buktiUploadArea = document.getElementById('bukti-upload-area');

    if (buktiInput) {
        buktiInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                alert('Hanya file gambar yang diperbolehkan!');
                buktiInput.value = '';
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                alert('Ukuran file maksimal 5MB.');
                buktiInput.value = '';
                return;
            }

            buktiFile = file;
            const reader = new FileReader();
            reader.onload = (ev) => {
                buktiPreviewImg.src = ev.target.result;
                buktiPreview.style.display = 'block';
                buktiUploadArea.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }
});

function openCaraBeli() { document.getElementById('modal-cara-beli').style.display = 'flex'; }
function closeCaraBeli() { document.getElementById('modal-cara-beli').style.display = 'none'; }

window.onclick = function (event) {
    const mc = document.getElementById('modal-cara-beli');
    const mq = document.getElementById('modal-qris');
    const mk = document.getElementById('modal-keranjang');
    const mr = document.getElementById('modal-riwayat');

    if (event.target == mc) mc.style.display = "none";
    if (event.target == mq) mq.style.display = "none";
    if (event.target == mk) mk.style.display = "none";
    if (event.target == mr) mr.style.display = "none";
};
