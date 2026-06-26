/**
 * Worker Share Handler
 * Menampilkan share text untuk worker di halaman job
 */

/**
 * Create dan show worker share modal
 */
function showWorkerShareModal(taskData) {
  const targetType = taskData.targetType || 'grup';
  
  // Generate share text untuk worker
  const shareText = generateShareText('worker', targetType, {
    totalReward: taskData.totalReward || 'Rp 0',
    totalSlots: taskData.totalSlots || '0',
    rewardPerUser: taskData.rewardPerUser || 'Rp 0',
    targetGroupUsername: taskData.targetGroupUsername || '',
    targetChannelUsername: taskData.targetChannelUsername || '',
    taskShareUrl: taskData.taskShareUrl || window.location.href
  });

  if (!shareText) return;

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.style.zIndex = '9998';
  modal.innerHTML = `
    <div class="modal-sheet">
      <h3>📢 Share Tugas Ini</h3>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">Copy text ini dan share ke teman-teman kamu di Telegram!</p>
      
      <div class="worker-share-text-box">
        <pre id="shareTextContent">${shareText}</pre>
      </div>

      <button class="confirm-btn" id="workerCopyBtn" style="margin-bottom: 8px;">
        📋 Copy Text
      </button>
      <button class="confirm-btn" id="workerShareTelegramBtn" style="background: #0088cc; margin-bottom: 8px;">
        📱 Share ke Telegram
      </button>
      <button class="cancel-btn" onclick="this.closest('.modal-overlay').remove()">Tutup</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Setup event listeners
  document.getElementById('workerCopyBtn').addEventListener('click', () => {
    copyToClipboard(shareText);
    modal.remove();
  });

  document.getElementById('workerShareTelegramBtn').addEventListener('click', () => {
    shareToTelegram(shareText);
    modal.remove();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

/**
 * Add share button ke task card
 * Call dari halaman job worker
 */
function addShareButtonToTaskCard(taskCardElement, taskData) {
  // Cari button ambil atau buat container untuk share button
  const footer = taskCardElement.querySelector('.task-footer');
  if (!footer) return;

  // Cek apakah sudah ada share button
  if (footer.querySelector('.btn-share')) return;

  // Create share button
  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn-ambil btn-share';
  shareBtn.style.marginLeft = '8px';
  shareBtn.textContent = '📢 Share';
  shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showWorkerShareModal(taskData);
  });

  footer.appendChild(shareBtn);
}

/**
 * Setup share buttons untuk semua task cards
 * Call ini setelah render task list
 */
function setupWorkerShareButtons() {
  const taskCards = document.querySelectorAll('.task-card');
  
  taskCards.forEach(card => {
    // Get task data dari card attributes atau dari data-task attribute
    const taskId = card.getAttribute('data-task-id');
    const targetType = card.getAttribute('data-target-type') || 'grup';
    const totalReward = card.getAttribute('data-total-reward') || 'Rp 0';
    const totalSlots = card.getAttribute('data-total-slots') || '0';
    const rewardPerUser = card.getAttribute('data-reward-per-user') || 'Rp 0';
    const targetGroupUsername = card.getAttribute('data-target-group') || '';
    const targetChannelUsername = card.getAttribute('data-target-channel') || '';
    const taskShareUrl = card.getAttribute('data-share-url') || window.location.href;

    const taskData = {
      taskId,
      targetType,
      totalReward,
      totalSlots,
      rewardPerUser,
      targetGroupUsername,
      targetChannelUsername,
      taskShareUrl
    };

    addShareButtonToTaskCard(card, taskData);
  });
}

// Initialize share buttons saat page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupWorkerShareButtons, 500);
  });
} else {
  setTimeout(setupWorkerShareButtons, 500);
}
