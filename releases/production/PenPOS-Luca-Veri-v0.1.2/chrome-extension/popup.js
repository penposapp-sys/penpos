const $ = (id) => document.getElementById(id);

const loginView = $('loginView');
const connectedView = $('connectedView');
const message = $('message');

function showMessage(text, success = false) {
  message.textContent = text || '';
  message.style.color = success ? '#087443' : '#bd362f';
}

function send(type, payload = {}) {
  return new Promise((resolve) => chrome.runtime.sendMessage({ type, ...payload }, resolve));
}

function formatLastSeen(value) {
  if (value === null || value === undefined || value === '') return 'Az önce';

  let timestamp = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    timestamp = value < 1e12 ? value * 1000 : value;
  } else if (value instanceof Date) {
    timestamp = value.getTime();
  } else if (typeof value === 'string') {
    const numericValue = Number(value);
    timestamp = Number.isFinite(numericValue)
      ? (numericValue < 1e12 ? numericValue * 1000 : numericValue)
      : Date.parse(value);
  }

  if (!Number.isFinite(timestamp)) return 'Az önce';

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 10) return 'Az önce';
  if (elapsedSeconds < 60) return `${elapsedSeconds} sn önce`;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes} dk önce`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} sa önce`;
  return `${Math.floor(elapsedHours / 24)} gün önce`;
}

function renderStatus(data) {
  const connected = Boolean(data?.connected && data?.device);
  loginView.classList.toggle('hidden', connected);
  connectedView.classList.toggle('hidden', !connected);
  if (!connected) return;
  $('connectedDevice').textContent = data.device.deviceName || 'PenPOS Luca Cihazı';
  $('lastSeen').textContent = formatLastSeen(data.device.lastSeen);
  const task = Boolean(data.task);
  $('statusText').textContent = task ? 'Luca görevi çalışıyor' : 'Bağlı';
  $('taskInfo').classList.toggle('hidden', !task);
}

async function refresh() {
  const result = await send('PENPOS_DEVICE_STATUS');
  renderStatus(result);
}

$('loginButton').addEventListener('click', async () => {
  const button = $('loginButton');
  button.disabled = true;
  showMessage('Bağlanıyor...');
  try {
    const result = await send('PENPOS_DEVICE_LOGIN', {
      identifier: $('email').value.trim(),
      password: $('password').value,
      deviceName: $('deviceName').value.trim() || 'PenPOS Luca Cihazı'
    });
    $('password').value = '';
    if (!result?.ok) throw new Error(result?.error || 'Bağlantı kurulamadı.');
    showMessage('Cihaz bağlandı.', true);
    renderStatus({ connected: true, device: result.device });
  } catch (error) {
    showMessage(error.message || 'Bağlantı kurulamadı.');
  } finally {
    button.disabled = false;
  }
});

$('logoutButton').addEventListener('click', async () => {
  $('logoutButton').disabled = true;
  const result = await send('PENPOS_DEVICE_LOGOUT');
  if (result?.ok) {
    renderStatus({ connected: false });
    showMessage('Cihaz bağlantısı kesildi.', true);
  }
  $('logoutButton').disabled = false;
});

refresh();
