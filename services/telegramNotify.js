const https = require('https');

function sendMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const DRY = process.env.NOTIFY_DRY_RUN === '1';

  if (!token || !chatId) {
    console.warn('[telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return Promise.resolve({ ok: false, reason: 'CONFIG_MISSING' });
  }
  if (DRY) {
    console.log('[telegram][DRY_RUN] skip send:', text);
    return Promise.resolve({ ok: true, dryRun: true });
  }

  const payload = new URLSearchParams({ chat_id: chatId, text });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload.toString()) },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.ok) resolve({ ok: true });
          else resolve({ ok: false, response: json });
        } catch (e) {
          resolve({ ok: false, response: data });
        }
      });
    });
    req.on('error', (err) => {
      console.warn('[telegram] sendMessage error', err.message);
      reject(err);
    });
    req.write(payload.toString());
    req.end();
  });
}

function formatSaleMessage(sale) {
  const total = sale?.totals?.grandTotal ?? 0;
  const method = sale?.method || 'cash';
  const loc = sale?.locationId ? String(sale.locationId) : '—';
  const cash = sale?.cashRegisterId ? String(sale.cashRegisterId) : '—';
  const itemCount = Array.isArray(sale?.items) ? sale.items.reduce((acc, it) => acc + Number(it.qty || 0), 0) : 0;
  return `🛒 Новая продажа #${sale?._id}\nСумма: ${total} ₽\nПозиции: ${itemCount}\nМетод: ${method}\nЛокация: ${loc}\nКасса: ${cash}${sale?.note ? `\nЗаметка: ${sale.note}` : ''}`;
}

async function sendSaleAlert(sale) {
  const text = formatSaleMessage(sale);
  return sendMessage(text);
}

module.exports = {
  sendMessage,
  sendSaleAlert,
};
