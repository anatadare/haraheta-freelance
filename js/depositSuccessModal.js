/**
 * Success Deposit Modal Handler
 * Menampilkan popup 5 detik setelah pembayaran QRIS sukses
 */

class DepositSuccessModal {
  constructor() {
    this.modal = null;
    this.timeoutId = null;
  }

  /**
   * Create modal HTML
   */
  createModal() {
    const modal = document.createElement('div');
    modal.className = 'deposit-success-modal';
    modal.id = 'depositSuccessModal';
    modal.innerHTML = `
      <div class="deposit-success-card">
        <div class="success-icon">🎉</div>
        <div class="success-title">Deposit Berhasil!</div>
        <div class="success-subtitle">Wah, saldo kamu sudah bertambah. Sekarang waktunya untuk mulai berbisnis! 💪</div>
        
        <div class="success-content" id="successContent">
          <div class="success-row">
            <span class="success-label">💰 Saldo Ditambah:</span>
            <span class="success-value" id="depositAmount">Rp 0</span>
          </div>
          <div class="success-row">
            <span class="success-label">📊 Total Saldo:</span>
            <span class="success-value" id="totalBalance">Rp 0</span>
          </div>
          <div class="success-row">
            <span class="success-label">⏰ Waktu:</span>
            <span class="success-value" id="depositTime">--:--</span>
          </div>
        </div>

        <div class="share-buttons">
          <button class="share-btn share-btn-telegram" id="shareToTelegramBtn">
            <span>📱</span> Share ke Telegram
          </button>
          <button class="share-btn share-btn-copy" id="copyLinkJobBtn">
            <span>📋</span> Copy Link Job
          </button>
        </div>

        <button class="close-deposit-btn" id="closeDepositBtn">Tutup</button>
        <div class="timer-bar"></div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modal = modal;
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const shareToTelegramBtn = document.getElementById('shareToTelegramBtn');
    const copyLinkJobBtn = document.getElementById('copyLinkJobBtn');
    const closeBtn = document.getElementById('closeDepositBtn');

    shareToTelegramBtn?.addEventListener('click', () => this.handleShareTelegram());
    copyLinkJobBtn?.addEventListener('click', () => this.handleCopyLink());
    closeBtn?.addEventListener('click', () => this.close());
  }

  /**
   * Show modal with data
   */
  show(data = {}) {
    if (!this.modal) {
      this.createModal();
    }

    // Update data
    const amount = data.amount || 0;
    const totalBalance = data.totalBalance || 0;
    const targetType = data.targetType || 'grup';
    const taskData = data.taskData || {};

    // Store untuk digunakan di share buttons
    this.shareData = {
      amount,
      totalBalance,
      targetType,
      taskData
    };

    // Update UI dengan data
    document.getElementById('depositAmount').textContent = `Rp ${amount.toLocaleString('id-ID')}`;
    document.getElementById('totalBalance').textContent = `Rp ${totalBalance.toLocaleString('id-ID')}`;
    document.getElementById('depositTime').textContent = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Show modal
    this.modal.classList.add('show');

    // Auto-close setelah 5 detik
    this.autoClose();
  }

  /**
   * Auto-close modal setelah 5 detik
   */
  autoClose() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    
    this.timeoutId = setTimeout(() => {
      this.close();
    }, 5000);
  }

  /**
   * Close modal
   */
  close() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.modal) {
      this.modal.classList.remove('show');
    }
  }

  /**
   * Handle share ke Telegram
   */
  handleShareTelegram() {
    const { targetType, taskData } = this.shareData;

    // Generate share text untuk client
    const shareText = generateShareText('client', targetType, {
      totalReward: taskData.totalReward || 'Rp 0',
      totalSlots: taskData.totalSlots || '0',
      rewardPerUser: taskData.rewardPerUser || 'Rp 0',
      targetGroupUsername: taskData.targetGroupUsername || '',
      targetChannelUsername: taskData.targetChannelUsername || '',
      taskShareUrl: taskData.taskShareUrl || window.location.href
    });

    if (shareText) {
      shareToTelegram(shareText);
      showToast('📱 Membuka Telegram...');
    }
  }

  /**
   * Handle copy link job
   */
  handleCopyLink() {
    const { targetType, taskData } = this.shareData;

    // Generate share text untuk client
    const shareText = generateShareText('client', targetType, {
      totalReward: taskData.totalReward || 'Rp 0',
      totalSlots: taskData.totalSlots || '0',
      rewardPerUser: taskData.rewardPerUser || 'Rp 0',
      targetGroupUsername: taskData.targetGroupUsername || '',
      targetChannelUsername: taskData.targetChannelUsername || '',
      taskShareUrl: taskData.taskShareUrl || window.location.href
    });

    if (shareText) {
      copyToClipboard(shareText);
    }
  }
}

// Global instance
let depositSuccessModal = null;

/**
 * Initialize deposit success modal (call once on page load)
 */
function initDepositSuccessModal() {
  if (!depositSuccessModal) {
    depositSuccessModal = new DepositSuccessModal();
  }
}

/**
 * Show deposit success popup (call from payment callback)
 */
function showDepositSuccess(data) {
  if (!depositSuccessModal) {
    initDepositSuccessModal();
  }
  depositSuccessModal.show(data);
}

// Auto-initialize saat page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDepositSuccessModal);
} else {
  initDepositSuccessModal();
}
