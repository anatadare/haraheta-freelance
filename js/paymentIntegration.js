/**
 * Payment Integration Handler
 * Menghubungkan payment callback dengan deposit success modal
 */

/**
 * Handle payment success dari callback
 * Dipanggil saat query parameter deposit=success terdeteksi
 */
function handlePaymentSuccess() {
  // Cek apakah ada parameter deposit=success di URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('deposit') === 'success') {
    // Get data dari localStorage (set oleh payment form sebelum redirect)
    const depositData = JSON.parse(localStorage.getItem('lastDeposit') || '{}');
    
    // Show modal dengan data
    showDepositSuccess({
      amount: depositData.amount || 0,
      totalBalance: depositData.totalBalance || 0,
      targetType: depositData.targetType || 'grup',
      taskData: {
        totalReward: depositData.totalReward || 'Rp 0',
        totalSlots: depositData.totalSlots || '0',
        rewardPerUser: depositData.rewardPerUser || 'Rp 0',
        targetGroupUsername: depositData.targetGroupUsername || '',
        targetChannelUsername: depositData.targetChannelUsername || '',
        taskShareUrl: depositData.taskShareUrl || window.location.origin
      }
    });

    // Clear localStorage
    localStorage.removeItem('lastDeposit');

    // Clean URL (remove query parameter)
    setTimeout(() => {
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 100);
  }
}

/**
 * Store deposit data sebelum redirect ke payment
 * Call ini saat user akan melakukan deposit
 */
function storeDepositData(data) {
  localStorage.setItem('lastDeposit', JSON.stringify({
    amount: data.amount || 0,
    totalBalance: data.totalBalance || 0,
    targetType: data.targetType || 'grup',
    totalReward: data.totalReward || 'Rp 0',
    totalSlots: data.totalSlots || '0',
    rewardPerUser: data.rewardPerUser || 'Rp 0',
    targetGroupUsername: data.targetGroupUsername || '',
    targetChannelUsername: data.targetChannelUsername || '',
    taskShareUrl: data.taskShareUrl || window.location.href
  }));
}

/**
 * Trigger deposit success modal untuk testing
 * (Hapus function ini di production)
 */
function testDepositSuccess() {
  showDepositSuccess({
    amount: 100000,
    totalBalance: 250000,
    targetType: 'both',
    taskData: {
      totalReward: 'Rp 100.000',
      totalSlots: '100',
      rewardPerUser: 'Rp 1.000',
      targetGroupUsername: 'nama_grup_kamu',
      targetChannelUsername: 'nama_channel_kamu',
      taskShareUrl: 'https://haraheta-freelance.vercel.app/task/123'
    }
  });
}

// Initialize handler saat page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handlePaymentSuccess);
} else {
  handlePaymentSuccess();
}
