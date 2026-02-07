export const PERMISSION_LABELS = {
  canteen_pos_access: 'Kasa (POS)',

  canteen_customers_view: 'Cariler Görüntüle',
  canteen_customers_manage: 'Cariler Yönet',
  canteen_customers_create: 'Cari Oluştur',
  canteen_customers_edit: 'Cari Düzenle',
  canteen_customer_payment_delete: 'Cari Tahsilat Sil',

  canteen_reports_view: 'Raporlar',
  canteen_reports_export: 'Raporları Excel İndir',
  canteen_sales_view: 'Satış Raporları',

  canteen_stock_manage: 'Stok Hareketleri',
  canteen_stock_count: 'Stok Sayım',
  canteen_stock_count_view: 'Sayım Geçmişi',

  canteen_billing_view: 'Üyelik Talepleri',
  canteen_billing_manage: 'Üyelik Talebi Yönet',

  canteen_settings_manage: 'Ayarlar',
  canteen_catalog_manage: 'Katalog',
  canteen_products_view: 'Ürünleri Gör',
  canteen_staff_manage: 'Personel'
}

export const getPermissionLabel = (key) => PERMISSION_LABELS[String(key || '')] || String(key || '')
