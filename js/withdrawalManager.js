// ============================================================
// Withdrawal UI Handler
// Manage withdrawal modals & forms untuk xRocket & E-wallet
// ============================================================

class WithdrawalManager {
    constructor() {
        this.currentMethod = 'xrocket'; // default method
        this.selectedEwalletMethod = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-withdrawal-tab]')) {
                const tab = e.target.closest('[data-withdrawal-tab]').getAttribute('data-withdrawal-tab');
                this.switchTab(tab);
            }
        });

        // xRocket form
        const xrocketAmountInput = document.getElementById('xrocketAmountInput');
        const xrocketAddressInput = document.getElementById('xrocketAddressInput');
        if (xrocketAmountInput) xrocketAmountInput.addEventListener('input', () => this.updateXrocketEstimate());
        if (xrocketAddressInput) xrocketAddressInput.addEventListener('input', () => this.validateXrocketAddress());

        // E-wallet method selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-ewallet-method]')) {
                const method = e.target.closest('[data-ewallet-method]').getAttribute('data-ewallet-method');
                this.selectEwalletMethod(method);
            }
        });

        // E-wallet amount input
        const ewalletAmountInput = document.getElementById('ewalletAmountInput');
        if (ewalletAmountInput) ewalletAmountInput.addEventListener('input', () => this.updateEwalletEstimate());

        // Withdraw buttons
        document.getElementById('btnXrocketWithdraw')?.addEventListener('click', () => this.processXrocketWithdraw());
        document.getElementById('btnEwalletWithdraw')?.addEventListener('click', () => this.processEwalletWithdraw());

        // Close modals
        document.getElementById('closeWithdrawalModal')?.addEventListener('click', () => this.closeModal());
    }

    switchTab(tab) {
        this.currentMethod = tab;
        
        // Update tab buttons
        document.querySelectorAll('[data-withdrawal-tab]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-withdrawal-tab') === tab);
        });

        // Update content visibility
        document.getElementById('xrocketWithdrawContent').style.display = tab === 'xrocket' ? 'block' : 'none';
        document.getElementById('ewalletWithdrawContent').style.display = tab === 'ewallet' ? 'block' : 'none';
    }

    selectEwalletMethod(method) {
        this.selectedEwalletMethod = method;
        document.querySelectorAll('[data-ewallet-method]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-ewallet-method') === method);
        });
        this.updateEwalletEstimate();
    }

    updateXrocketEstimate() {
        const amountInput = document.getElementById('xrocketAmountInput');
        const estimateDisplay = document.getElementById('xrocketUsdtEstimate');
        
        if (!amountInput || !estimateDisplay) return;

        const amount = parseInt(amountInput.value) || 0;
        const usdt = (amount / 16300).toFixed(2);
        
        estimateDisplay.textContent = `${usdt} USDT (~Rp ${amount.toLocaleString('id-ID')})`;
    }

    validateXrocketAddress() {
        const addressInput = document.getElementById('xrocketAddressInput');
        const addressError = document.getElementById('xrocketAddressError');
        
        if (!addressInput || !addressError) return;

        const address = addressInput.value.trim();
        const isValid = address.length >= 20; // basic validation

        if (address && !isValid) {
            addressError.textContent = 'Address harus minimal 20 karakter';
            addressError.classList.add('show');
        } else {
            addressError.classList.remove('show');
        }
    }

    updateEwalletEstimate() {
        const amountInput = document.getElementById('ewalletAmountInput');
        const estimateDisplay = document.getElementById('ewalletFeeEstimate');
        
        if (!amountInput || !estimateDisplay) return;

        const amount = parseInt(amountInput.value) || 0;
        const fee = 10000;
        const total = amount + fee;
        
        estimateDisplay.innerHTML = `
            Rp ${amount.toLocaleString('id-ID')} + Rp ${fee.toLocaleString('id-ID')} (biaya) = <strong>Rp ${total.toLocaleString('id-ID')}</strong>
        `;
    }

    async processXrocketWithdraw() {
        const amount = parseInt(document.getElementById('xrocketAmountInput')?.value) || 0;
        const address = document.getElementById('xrocketAddressInput')?.value.trim() || '';

        if (amount < 50000) {
            alert('Minimal withdraw Rp 50.000');
            return;
        }

        if (address.length < 20) {
            alert('Address tidak valid');
            return;
        }

        const btn = document.getElementById('btnXrocketWithdraw');
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
            const response = await fetch('/api/payment/withdraw', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-key': 'your-internal-key' // Sesuaikan dengan env var
                },
                body: JSON.stringify({
                    method: 'xrocket',
                    amount,
                    address,
                    telegram_id: window.telegramId // Pastikan global var sudah ada
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(`Error: ${data.error}`);
                btn.disabled = false;
                btn.textContent = 'Withdraw Sekarang';
                return;
            }

            // Success
            this.showSuccessMessage(
                `✅ Withdrawal xRocket Diproses!\n\nRp ${amount.toLocaleString('id-ID')} sedang dikirim ke wallet TON/USDT kamu.\n\nSaldo baru: Rp ${data.new_balance.toLocaleString('id-ID')}`
            );

            // Reset form
            document.getElementById('xrocketAmountInput').value = '';
            document.getElementById('xrocketAddressInput').value = '';
            this.updateXrocketEstimate();

            // Close modal after 2 seconds
            setTimeout(() => this.closeModal(), 2000);

        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Withdraw Sekarang';
        }
    }

    async processEwalletWithdraw() {
        const amount = parseInt(document.getElementById('ewalletAmountInput')?.value) || 0;
        const phone = document.getElementById('ewalletPhoneInput')?.value.trim() || '';
        const method = this.selectedEwalletMethod;

        if (amount < 50000) {
            alert('Minimal withdraw Rp 50.000');
            return;
        }

        if (!phone) {
            alert('Nomor telepon wajib diisi');
            return;
        }

        if (!method) {
            alert('Pilih metode e-wallet terlebih dahulu');
            return;
        }

        const btn = document.getElementById('btnEwalletWithdraw');
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
            const response = await fetch('/api/payment/withdraw-ewallet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-key': 'your-internal-key' // Sesuaikan dengan env var
                },
                body: JSON.stringify({
                    method,
                    amount,
                    phone,
                    telegram_id: window.telegramId // Pastikan global var sudah ada
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(`Error: ${data.error || data.detail}`);
                btn.disabled = false;
                btn.textContent = 'Withdraw Sekarang';
                return;
            }

            // Success
            this.showSuccessMessage(
                `✅ Withdrawal E-Wallet Diproses!\n\nRp ${amount.toLocaleString('id-ID')} sedang dikirim ke ${method.toUpperCase()}.\n\nSaldo baru: Rp ${data.new_balance.toLocaleString('id-ID')}`
            );

            // Reset form
            document.getElementById('ewalletAmountInput').value = '';
            document.getElementById('ewalletPhoneInput').value = '';
            this.selectedEwalletMethod = null;
            document.querySelectorAll('[data-ewallet-method]').forEach(btn => btn.classList.remove('active'));
            this.updateEwalletEstimate();

            // Close modal after 2 seconds
            setTimeout(() => this.closeModal(), 2000);

        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Withdraw Sekarang';
        }
    }

    showSuccessMessage(text) {
        const toast = document.getElementById('withdrawalToast');
        if (toast) {
            toast.textContent = text;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }
    }

    closeModal() {
        const modal = document.getElementById('withdrawalModal');
        if (modal) modal.classList.remove('active');
    }

    openModal() {
        const modal = document.getElementById('withdrawalModal');
        if (modal) modal.classList.add('active');
    }
}

// Initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.withdrawalManager = new WithdrawalManager();
    });
} else {
    window.withdrawalManager = new WithdrawalManager();
}

// Export untuk diakses dari luar
window.openWithdrawalModal = () => window.withdrawalManager?.openModal();
