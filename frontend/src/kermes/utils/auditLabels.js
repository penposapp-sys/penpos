export const auditActionLabel = (a) => {
  const t = String(a || '').toLowerCase()
  const map = {
    order_pay: 'Ödeme Alındı',
    odeme_ekle: 'Ödeme Eklendi',
    odeme_modal_acildi: 'Ödeme Ekranı Açıldı',
    table_close: 'Masa Kapatıldı',
    order_send: 'Mutfağa Gönderildi',
    hizli_urun_ekleme: 'Hızlı Ürün Eklendi',
    order_create: 'Sipariş Açıldı',
    order_cancel: 'Sipariş İptal',
    item_add: 'Ürün Eklendi',
    item_remove: 'Ürün Silindi',
    item_qty_change: 'Adet Değişti'
  }
  if (map[t]) return map[t]
  const raw = String(a || '').trim()
  if (!raw) return ''
  const spaced = raw
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/([a-zığüşöç])([A-ZİĞÜŞÖÇ])/g, '$1 $2')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  if (!spaced) return raw
  return spaced
    .split(' ')
    .map(w => (w ? `${w[0].toUpperCase()}${w.slice(1)}` : ''))
    .join(' ')
}

export const auditEntityLabel = (e) => {
  const t = String(e || '').toLowerCase()
  const map = {
    order: 'Sipariş',
    table: 'Masa',
    customer: 'Müşteri',
    payment: 'Ödeme',
    stock: 'Stok'
  }
  if (map[t]) return map[t]
  const raw = String(e || '').trim()
  if (!raw) return ''
  const spaced = raw
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/([a-zığüşöç])([A-ZİĞÜŞÖÇ])/g, '$1 $2')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  if (!spaced) return raw
  return spaced
    .split(' ')
    .map(w => (w ? `${w[0].toUpperCase()}${w.slice(1)}` : ''))
    .join(' ')
}
