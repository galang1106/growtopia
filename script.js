// Konfigurasi Harga
const RATES = {
    pending: 110, // 5-7 Hari -> 110 Rupiah per 1 Robux
    instant: 130, // Langsung Masuk -> 130 Rupiah per 1 Robux
    gift: 140     // Via Gift Robux -> 140 Rupiah per 1 Robux
};

const MIN_ROBUX = 100; // Batas Minimal Top Up

let currentMode = 'pending';
let selectedRobux = 0;
let currentPrice = 0;

/* --- LOGIKA STATE SELLER --- */
let usernameCheckTimeout = null;
let isUsernameValid = false;
let verifiedUserId = null;
let verifiedUsername = null;
let buktiFile = null;

// Keranjang & Riwayat Storage Setup
let KazeCart = JSON.parse(localStorage.getItem('kazecart_data')) || [];
let KazeHistory = JSON.parse(localStorage.getItem('kazehistory_data')) || [];
let checkoutContext = { type: 'direct', data: null }; // 'direct' atau 'cart'

// Array Paket Default (Semua di atas atau sama dengan 100 Robux)
const packages = [
    100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000
];

function formatRupiah(angka) {
    return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* --- CEK USERNAME ROBLOX --- */
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

/* --- SELECTION & CALCULATION CONTROLLERS --- */
function setMode(mode) {
    currentMode = mode;
    document.getElementById('tab-pending').classList.remove('active');
    document.getElementById('tab-instant').classList.remove('active');
    document.getElementById('tab-gift').classList.remove('active');
    document.getElementById(`tab-${mode}`).classList.add('active');

    document.getElementById('warning-instant').style.display = mode === 'instant' ? 'block' : 'none';
    document.getElementById('warning-gift').style.display = mode === 'gift' ? 'block' : 'none';
    
    // Jika ada nilai di input custom saat ganti mode, kalkulasi ulang harganya
    const inputVal = document.getElementById('custom-robux').value;
    if (inputVal && inputVal > 0) {
        calculateCustomPrice();
    } else if (selectedRobux > 0) {
        // Jika sedang memilih paket grid, sesuaikan harga paket dengan rate mode baru
        currentPrice = selectedRobux * RATES[currentMode];
        updateBottomPrice();
    }

    renderGrid();
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

/* --- FITUR: KERANJANG BELANJA (CART SYSTEM) --- */
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
        div.innerHTML = `
            <div class="cart-item-details">
                <h4>${item.robux} Robux (${item.modeText})</h4>
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

/* --- FITUR: RIWAYAT PEMBELIAN (HISTORY SYSTEM) --- */
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
            itemSummary = data.items.map(i => `- ${i.robux} Rbx (${i.modeText}) untuk ${i.username}`).join('<br>');
        } else {
            itemSummary = `- ${data.jumlahRobux} Rbx (${data.metode}) untuk ${data.username}`;
        }

        div.innerHTML = `
            <div class="riwayat-date">${data.waktu}</div>
            <div style="margin-bottom: 6px; font-weight: 600; color: #fff;">Invoice Belanja:</div>
            <div style="color: #c9d1d9; margin-bottom: 6px; line-height: 1.4;">${itemSummary}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #21262d; padding-top: 5px;">
                <span style="color: #8b949e;">Total Bayar:</span>
                <strong style="color: #2ea043;">${data.totalHarga}</strong>
            </div>
        `;
        container.appendChild(div);
    });
}

/* --- LOGIKA CHECKOUT & TAMPILAN QRIS --- */
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

    openQrisModal(formatRupiah(currentPrice), `
        <div class="invoice-row-item"><span>Username</span><span>${verifiedUsername || username}</span></div>
        <div class="invoice-row-item"><span>Layanan</span><span>${typeName}</span></div>
        <div class="invoice-row-item"><span>Jumlah</span><span>${robuxAmount} Robux</span></div>
    `);
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
        htmlDetails += `<div class="invoice-row-item"><span>${item.robux} Rbx (${item.modeText})</span><span style="color:#8b949e;">${item.username}</span></div>`;
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

/* --- KONFIRMASI PEMBAYARAN & DISCORD WEBHOOK REDIRECT --- */
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
        
        orderLog = {
            waktu: timestamp,
            username: d.username,
            jumlahRobux: d.jumlahRobux,
            metode: d.metode,
            totalHarga: totalBayarStr
        };

        payloadPayload = {
            username: d.username,
            userId: d.userId || '-',
            metode: d.metode,
            jumlahRobux: d.jumlahRobux,
            totalHarga: totalBayarStr,
            status: 'PENDING (Check Bukti)'
        };
    } else {
        pesanWA += `*Checkout Multi-Item (Keranjang):*%0A`;
        checkoutContext.data.items.forEach((item, idx) => {
            pesanWA += `${idx+1}. ${item.robux} Rbx (${item.modeText}) -> User: ${item.username}%0A`;
        });
        
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

/* --- EVENT LISTENERS INITIALIZATION --- */
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

/* --- POP-UP CLOSER HANDLING --- */
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
