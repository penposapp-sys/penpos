export const PERMISSIONS = {
  HOME_PAGE_VIEW: 'home_page_view',
  REPORTS_DASHBOARD_VIEW: 'reports_dashboard_view',
  CLOSED_TABLES_PAGE_VIEW: 'closed_tables_page_view',
  CLOSED_TABLES_VIEW: 'closed_tables_view',
  CLOSED_TABLES_DETAIL_VIEW: 'closed_tables_detail_view',
  CLOSED_TABLES_REOPEN: 'closed_tables_reopen',
  POS_ACCESS: 'pos_access',
  TAKE_PAYMENT: 'take_payment',
  CREATE_VERESIYE: 'create_veresiye',
  KITCHEN_ACCESS: 'kitchen_access',
  MANAGE_TABLES: 'manage_tables',
  VIEW_REPORTS: 'view_reports',
  VIEW_CLOSED_TABLES: 'view_closed_tables',
  VIEW_ACCOUNTS: 'view_accounts',
  MANAGE_ACCOUNTS: 'manage_accounts',
  COLLECT_DEBT: 'collect_debt',
  CARI_TAHSILAT_SIL: 'cari_tahsilat_sil',
  VIEW_DELIVERY: 'view_delivery',
  MANAGE_DELIVERY: 'manage_delivery',
  WALKIN_ACCESS: 'walkin_access',
  MANAGE_MENU: 'manage_menu',
  MANAGE_SETTINGS: 'manage_settings',

  CANTEEN_POS_ACCESS: 'canteen_pos_access',
  CANTEEN_SETTINGS_MANAGE: 'canteen_settings_manage',
  CANTEEN_CATALOG_MANAGE: 'canteen_catalog_manage',
  CANTEEN_PRODUCTS_VIEW: 'canteen_products_view',
  CANTEEN_STAFF_MANAGE: 'canteen_staff_manage',
  CANTEEN_CUSTOMERS_VIEW: 'canteen_customers_view',
  CANTEEN_CUSTOMERS_MANAGE: 'canteen_customers_manage',
  CANTEEN_CUSTOMERS_CREATE: 'canteen_customers_create',
  CANTEEN_CUSTOMERS_EDIT: 'canteen_customers_edit',
  CANTEEN_CUSTOMER_PAYMENT_DELETE: 'canteen_customer_payment_delete',
  CANTEEN_REPORTS_VIEW: 'canteen_reports_view',
  CANTEEN_REPORTS_EXPORT: 'canteen_reports_export',
  CANTEEN_BILLING_VIEW: 'canteen_billing_view',
  CANTEEN_BILLING_MANAGE: 'canteen_billing_manage',
  CANTEEN_SALES_VIEW: 'canteen_sales_view',
  CANTEEN_STOCK_MANAGE: 'canteen_stock_manage',
  CANTEEN_STOCK_COUNT: 'canteen_stock_count',
  CANTEEN_STOCK_COUNT_VIEW: 'canteen_stock_count_view'
}

export const PERMISSION_ALIASES = {
  table_access: [PERMISSIONS.MANAGE_TABLES],
  reports_view: [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.REPORTS_DASHBOARD_VIEW],
  accounts_view: [PERMISSIONS.VIEW_ACCOUNTS],
  accounts_manage: [PERMISSIONS.MANAGE_ACCOUNTS],
  package_orders_view: [PERMISSIONS.VIEW_DELIVERY],
  package_orders_manage: [PERMISSIONS.MANAGE_DELIVERY],
  walkin_sale: [PERMISSIONS.WALKIN_ACCESS],

  settings_manage: [PERMISSIONS.MANAGE_SETTINGS],
  menu_manage: [PERMISSIONS.MANAGE_MENU],
  manage_products: [PERMISSIONS.MANAGE_MENU],
  urun_kategori_yonetimi: [PERMISSIONS.MANAGE_MENU],
  cari_hesaplar_yonet: [PERMISSIONS.MANAGE_ACCOUNTS],

  [PERMISSIONS.MANAGE_ACCOUNTS]: [PERMISSIONS.VIEW_ACCOUNTS],

  [PERMISSIONS.CANTEEN_SETTINGS_MANAGE]: [PERMISSIONS.MANAGE_SETTINGS],
  [PERMISSIONS.CANTEEN_CATALOG_MANAGE]: [PERMISSIONS.MANAGE_MENU],
  [PERMISSIONS.CANTEEN_STOCK_MANAGE]: [PERMISSIONS.MANAGE_MENU],
  [PERMISSIONS.CANTEEN_CUSTOMERS_VIEW]: [PERMISSIONS.VIEW_ACCOUNTS],
  [PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE]: [PERMISSIONS.MANAGE_ACCOUNTS],

  [PERMISSIONS.VIEW_REPORTS]: [PERMISSIONS.REPORTS_DASHBOARD_VIEW],
  [PERMISSIONS.VIEW_CLOSED_TABLES]: [
    PERMISSIONS.CLOSED_TABLES_PAGE_VIEW,
    PERMISSIONS.CLOSED_TABLES_VIEW,
    PERMISSIONS.CLOSED_TABLES_DETAIL_VIEW
  ]
}

export const PERMISSION_LABELS_TR = {
  [PERMISSIONS.HOME_PAGE_VIEW]: 'Anasayfa Erişimi',
  [PERMISSIONS.REPORTS_DASHBOARD_VIEW]: 'Gösterge Paneli Görüntüleme',
  [PERMISSIONS.CLOSED_TABLES_PAGE_VIEW]: 'Kapanan Masalar Sayfası',
  [PERMISSIONS.CLOSED_TABLES_VIEW]: 'Kapanan Masalar Liste Görüntüleme',
  [PERMISSIONS.CLOSED_TABLES_DETAIL_VIEW]: 'Kapanan Masa Detay Görüntüleme',
  [PERMISSIONS.CLOSED_TABLES_REOPEN]: 'Kapanan Masa Geri Açma',
  [PERMISSIONS.POS_ACCESS]: 'POS Erişimi',
  [PERMISSIONS.TAKE_PAYMENT]: 'Sipariş Ödemesi Alabilme (Kasa Yetkisi)',
  [PERMISSIONS.CREATE_VERESIYE]: 'Veresiye İşlemi Yapabilme (Cariye Borç Yazma)',
  [PERMISSIONS.KITCHEN_ACCESS]: 'Mutfak Erişimi',
  [PERMISSIONS.MANAGE_TABLES]: 'Masa Yönetimi',
  [PERMISSIONS.VIEW_REPORTS]: 'Rapor Görüntüleme',
  [PERMISSIONS.VIEW_CLOSED_TABLES]: 'Kapanan Masalar',
  [PERMISSIONS.VIEW_ACCOUNTS]: 'Cari Hesaplar Görüntüleme',
  [PERMISSIONS.MANAGE_ACCOUNTS]: 'Cari Hesaplar Yönetim',
  [PERMISSIONS.COLLECT_DEBT]: 'Cari Tahsilatı Yapabilme',
  [PERMISSIONS.CARI_TAHSILAT_SIL]: 'Cari Tahsilat Silme',
  [PERMISSIONS.VIEW_DELIVERY]: 'Paket Siparişleri Görüntüleme',
  [PERMISSIONS.MANAGE_DELIVERY]: 'Paket Sipariş Yönetimi (Onay/İptal/Teslim)',
  [PERMISSIONS.WALKIN_ACCESS]: 'Masasız Satış Yapabilme',
  [PERMISSIONS.MANAGE_MENU]: 'Ürün/Kategori Yönetimi',
  [PERMISSIONS.MANAGE_SETTINGS]: 'Ayarlar Yönetimi',
  [PERMISSIONS.CANTEEN_CUSTOMERS_VIEW]: 'Kantin Carileri Görüntüleme',
  [PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE]: 'Kantin Carileri Yönetim',
  [PERMISSIONS.CANTEEN_CUSTOMERS_CREATE]: 'Kantin Cari Oluşturma',
  [PERMISSIONS.CANTEEN_CUSTOMERS_EDIT]: 'Kantin Cari Düzenleme',
  [PERMISSIONS.CANTEEN_CUSTOMER_PAYMENT_DELETE]: 'Kantin Cari Tahsilat Silme'
}

export const PERMISSION_GROUPS_TR = [
  {
    title: 'Ödeme & Kasa',
    items: [
      {
        permission: PERMISSIONS.TAKE_PAYMENT,
        label: 'Sipariş Ödemesi Alabilme (Kasa Yetkisi)',
        description: 'Ödeme Al, çoklu ödeme, indirim uygulama, ödeme silme (varsa yetkiye göre)'
      },
      {
        permission: PERMISSIONS.CREATE_VERESIYE,
        label: 'Veresiye İşlemi Yapabilme (Cariye Borç Yazma)',
        description: 'Siparişi cariye borç yazma (veresiye)'
      },
      {
        permission: PERMISSIONS.COLLECT_DEBT,
        label: 'Cari Tahsilatı Yapabilme',
        description: 'Cari hesaptan tahsilat alma'
      },
      {
        permission: PERMISSIONS.CARI_TAHSILAT_SIL,
        label: 'Cari Tahsilat Silme',
        description: 'Hatalı girilen tahsilatı silme (borç hareketleri silinmez)'
      }
    ]
  },
  {
    title: 'POS & Satış Erişimi',
    items: [
      {
        permission: PERMISSIONS.POS_ACCESS,
        label: 'POS Erişimi',
        description: 'POS ekranlarına giriş (kategori/ürün listeleme dahil)'
      },
      {
        permission: PERMISSIONS.WALKIN_ACCESS,
        label: 'Masasız Satış Yapabilme',
        description: 'Walk-in / hızlı satış ekranına giriş ve sipariş oluşturma'
      }
    ]
  },
  {
    title: 'Paket Servis (Delivery)',
    items: [
      {
        permission: PERMISSIONS.VIEW_DELIVERY,
        label: 'Paket Siparişleri Görüntüleme',
        description: 'Paket sipariş listesini görür (aktif/teslim edilenler)'
      },
      {
        permission: PERMISSIONS.MANAGE_DELIVERY,
        label: 'Paket Sipariş Yönetimi (Onay/İptal/Teslim)',
        description: 'Teslim edildi, onaylandı, iptal gibi aksiyonlar yapar'
      }
    ]
  },
  {
    title: 'Mutfak',
    items: [
      {
        permission: PERMISSIONS.KITCHEN_ACCESS,
        label: 'Mutfak Erişimi',
        description: 'Mutfak ekranını görür ve ürün durumlarını yönetir'
      }
    ]
  },
  {
    title: 'Masa Yönetimi',
    items: [
      {
        permission: PERMISSIONS.MANAGE_TABLES,
        label: 'Masa Yönetimi',
        description: 'Masalara girer, sipariş başlatır, masa kapat/taşı/merge (yetkiye göre)'
      }
    ]
  },
  {
    title: 'Raporlar',
    items: [
      {
        permission: PERMISSIONS.REPORTS_DASHBOARD_VIEW,
        label: 'Gösterge Paneli Görüntüleme',
        description: 'Anasayfa dashboard kartlarını ve rapor özetlerini görür'
      },
      {
        permission: PERMISSIONS.CLOSED_TABLES_PAGE_VIEW,
        label: 'Kapanan Masalar Sayfası',
        description: 'Kapanan masalar sayfasına giriş'
      },
      {
        permission: PERMISSIONS.CLOSED_TABLES_VIEW,
        label: 'Kapanan Masalar Liste Görüntüleme',
        description: 'Kapanan masalar/kapanan siparişler listesini görür'
      },
      {
        permission: PERMISSIONS.CLOSED_TABLES_DETAIL_VIEW,
        label: 'Kapanan Masa Detay Görüntüleme',
        description: 'Kapanan sipariş detayı açar'
      },
      {
        permission: PERMISSIONS.CLOSED_TABLES_REOPEN,
        label: 'Kapanan Masa Geri Açma',
        description: 'Kapalı siparişi geri açma işlemi yapar'
      }
    ]
  },
  {
    title: 'Cari Hesaplar',
    items: [
      {
        permission: PERMISSIONS.VIEW_ACCOUNTS,
        label: 'Cari Hesaplar Görüntüleme',
        description: 'Cari listesi ve hareketleri görüntüler'
      },
      {
        permission: PERMISSIONS.MANAGE_ACCOUNTS,
        label: 'Cari Hesaplar Yönetimi',
        description: 'Cari oluştur/düzenle, hareket yönetimi (silme/geri alma dahil)'
      }
    ]
  },
  {
    title: 'Yönetim (Opsiyonel)',
    items: [
      {
        permission: PERMISSIONS.MANAGE_MENU,
        label: 'Ürün & Kategori Yönetimi',
        description: 'Ürün/kategori ekleme-silme-düzenleme (admin değilse opsiyonel)'
      },
      {
        permission: PERMISSIONS.MANAGE_SETTINGS,
        label: 'Ayarlar Yönetimi',
        description: 'Sistem/şube/personel ayarlarına erişim'
      }
    ]
  }
]

export const normalizePermissions = (perms) => {
  const list = Array.isArray(perms) ? perms : []
  const set = new Set()
  for (const p of list) {
    if (!p) continue
    set.add(p)
    const aliased = PERMISSION_ALIASES[p]
    if (Array.isArray(aliased)) {
      for (const a of aliased) if (a) set.add(a)
    } else if (aliased) {
      set.add(aliased)
    }
  }
  return Array.from(set)
}

export const canonicalizePermissions = (perms) => {
  const list = Array.isArray(perms) ? perms : []
  const set = new Set()
  const canonicalValues = new Set(Object.values(PERMISSIONS))
  for (const p of list) {
    if (!p) continue
    if (canonicalValues.has(p)) {
      set.add(p)
      continue
    }
    const aliased = PERMISSION_ALIASES[p]
    if (Array.isArray(aliased)) {
      set.add(aliased[0] || p)
    } else {
      set.add(aliased || p)
    }
  }
  return Array.from(set)
}
