/**
 * Share Templates untuk CLIENT dan WORKER
 * Sesuai dengan tipe member (grup, channel, atau keduanya)
 */

const SHARE_TEMPLATES = {
  client: {
    grup: `🚀 Aku baru buka reward baru di Haraheta!

Kalau lagi cari cuan dari Telegram, gas ikutan sebelum slotnya habis.

💰 Reward: {TOTAL_REWARD}
👥 Slot: {TOTAL_SLOTS}
🪙 Per User: {REWARD_PER_USER}

🎯 Misi:
👥 Join Grup {TARGET_GROUP_USERNAME}

🎁 Gas ambil reward di sini!
{TASK_SHARE_URL}`,

    channel: `🚀 Aku baru buka reward baru di Haraheta!

Kalau lagi cari cuan dari Telegram, gas ikutan sebelum slotnya habis.

💰 Reward: {TOTAL_REWARD}
👥 Slot: {TOTAL_SLOTS}
🪙 Per User: {REWARD_PER_USER}

🎯 Misi:
📢 Join Channel {TARGET_CHANNEL_USERNAME}

🎁 Gas ambil reward di sini!
{TASK_SHARE_URL}`,

    both: `🚀 Aku baru buka reward baru di Haraheta!

Kalau lagi cari cuan dari Telegram, gas ikutan sebelum slotnya habis.

💰 Reward: {TOTAL_REWARD}
👥 Slot: {TOTAL_SLOTS}
🪙 Per User: {REWARD_PER_USER}

🎯 Misi:
📢 Join Channel {TARGET_CHANNEL_USERNAME}
👥 Join Grup {TARGET_GROUP_USERNAME}

🎁 Gas ambil reward di sini!
{TASK_SHARE_URL}`
  },

  worker: {
    channel: `🔥 Baru nemu reward ini di Haraheta!

Lumayan gampang, siapa tahu kamu juga mau.

💰 Reward: {TOTAL_REWARD}
👥 Slot: {TOTAL_SLOTS}
🪙 Per User: {REWARD_PER_USER}

🎯 Misi:
📢 Join Channel {TARGET_CHANNEL_USERNAME}

🎁 Gas ambil reward di sini!
{TASK_SHARE_URL}`,

    grup: `🔥 Baru nemu reward ini di Haraheta!

Lumayan gampang, siapa tahu kamu juga mau.

💰 Reward: {TOTAL_REWARD}
👥 Slot: {TOTAL_SLOTS}
🪙 Per User: {REWARD_PER_USER}

🎯 Misi:
👥 Join Grup {TARGET_GROUP_USERNAME}

🎁 Gas ambil reward di sini!
{TASK_SHARE_URL}`,

    both: `🔥 Baru nemu reward ini di Haraheta!

Lumayan gampang, siapa tahu kamu juga mau.

💰 Reward: {TOTAL_REWARD}
👥 Slot: {TOTAL_SLOTS}
🪙 Per User: {REWARD_PER_USER}

🎯 Misi:
📢 Join Channel {TARGET_CHANNEL_USERNAME}
👥 Join Grup {TARGET_GROUP_USERNAME}

🎁 Gas ambil reward di sini!
{TASK_SHARE_URL}`
  }
};

/**
 * Generate share text berdasarkan role, tipe member, dan data
 */
function generateShareText(role, targetType, data) {
  const template = SHARE_TEMPLATES[role]?.[targetType];
  if (!template) return '';

  let text = template;
  
  // Replace placeholders
  text = text.replace('{TOTAL_REWARD}', data.totalReward || '0');
  text = text.replace('{TOTAL_SLOTS}', data.totalSlots || '0');
  text = text.replace('{REWARD_PER_USER}', data.rewardPerUser || '0');
  text = text.replace('{TARGET_GROUP_USERNAME}', data.targetGroupUsername || '');
  text = text.replace('{TARGET_CHANNEL_USERNAME}', data.targetChannelUsername || '');
  text = text.replace('{TASK_SHARE_URL}', data.taskShareUrl || '');

  return text;
}

/**
 * Share ke Telegram (membuka Telegram dengan text sudah siap)
 */
function shareToTelegram(text) {
  const encodedText = encodeURIComponent(text);
  // Buka Telegram share dialog
  window.open(`https://t.me/share/url?url=&text=${encodedText}`, '_blank', 'width=600,height=600');
}

/**
 * Copy text ke clipboard
 */
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('✅ Copied to clipboard!');
    }).catch(() => {
      // Fallback untuk browser yang tidak support Clipboard API
      fallbackCopyToClipboard(text);
    });
  } else {
    fallbackCopyToClipboard(text);
  }
}

/**
 * Fallback copy ke clipboard (untuk browser lama)
 */
function fallbackCopyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
    showToast('✅ Copied to clipboard!');
  } catch (err) {
    console.error('Fallback copy failed:', err);
    showToast('❌ Copy failed');
  }
  
  document.body.removeChild(textarea);
}

/**
 * Show toast notification
 */
function showToast(message) {
  const toast = document.getElementById('jobToast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
