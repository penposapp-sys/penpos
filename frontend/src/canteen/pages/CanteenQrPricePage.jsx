import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import { useBodyLayoutMode } from '../../hooks/useBodyLayoutMode.js'
import { qrThemes } from '../components/CanteenQrPreview.jsx'
import ProductImage from '../../components/ProductImage.jsx'
import { resolveApiOrigin } from '../../lib/runtimeApi.js'

const CUSTOMER_FORM = { name: '', phone: '', location: '', address: '', note: '' }
const LOGIN_FORM = { phone: '', password: '' }
const REGISTER_FORM = { name: '', phone: '', password: '', passwordRepeat: '', location: '', address: '' }
const PROFILE_FORM = { name: '', phone: '', location: '', address: '' }
const IMAGE_PLACEHOLDER = '/images/product-placeholder.png'
const API_ORIGIN = resolveApiOrigin()
const PUBLIC_QR_THEME_STYLES = {
  light: {
    appBg: '#f3f4f6',
    surface: '#ffffff',
    surfaceSoft: '#f5f5f5',
    surfaceElevated: '#eeeeee',
    panel: '#ffffff',
    panelStrong: '#f7f7f7',
    border: 'rgba(17,17,17,.10)',
    text: '#111111',
    textSecondary: '#525252',
    muted: '#737373',
    accent: '#111111',
    accentContrast: '#ffffff',
    link: '#111111',
    shellShadow: '0 18px 54px rgba(15,23,42,.12)',
    surfaceShadow: '0 12px 23px rgba(15,23,42,.08)',
    heroOverlay: 'linear-gradient(180deg,rgba(17,17,17,.10) 0%,rgba(17,17,17,.22) 42%,rgba(17,17,17,.58) 100%)',
    menuButtonBg: '#ffffff',
    menuButtonText: '#111111',
    branchPillBg: 'rgba(255,255,255,.78)',
    branchPillText: '#111111',
    topbarBg: 'rgba(17,17,17,.04)',
    menuPopupBg: 'rgba(255,255,255,.98)',
    bottomNavBg: 'rgba(255,255,255,.98)',
    bottomNavText: '#111111',
    countBg: '#111111',
    countText: '#ffffff',
    accountBoxText: '#111111',
    accountBoxSubtle: '#525252',
    placeholder: '#6b7280',
    subduedButtonText: '#111111',
    logoPlaceholderText: '#111111'
  },
  dark: {
    appBg: '#1c1c1c',
    surface: '#232323',
    surfaceSoft: '#292929',
    surfaceElevated: '#343434',
    panel: '#262626',
    panelStrong: '#2d2d2d',
    border: 'rgba(255,255,255,.09)',
    text: '#f5f5f5',
    textSecondary: '#d4d4d4',
    muted: '#b5b5b5',
    accent: '#3a3a3a',
    accentContrast: '#ffffff',
    link: '#f1f1f1',
    shellShadow: '0 18px 54px rgba(0,0,0,.36)',
    surfaceShadow: '0 12px 23px rgba(0,0,0,.28)',
    heroOverlay: 'linear-gradient(180deg,rgba(0,0,0,.14) 0%,rgba(0,0,0,.34) 42%,rgba(0,0,0,.72) 100%)',
    menuButtonBg: '#343434',
    menuButtonText: '#f5f5f5',
    branchPillBg: 'rgba(28,28,28,.58)',
    branchPillText: '#f5f5f5',
    topbarBg: 'rgba(255,255,255,.04)',
    menuPopupBg: 'rgba(35,35,35,.98)',
    bottomNavBg: 'rgba(28,28,28,.98)',
    bottomNavText: '#f5f5f5',
    countBg: '#f5f5f5',
    countText: '#1c1c1c',
    accountBoxText: '#f5f5f5',
    accountBoxSubtle: '#d4d4d4',
    placeholder: '#b5b5b5',
    subduedButtonText: '#d4d4d4',
    logoPlaceholderText: '#f5f5f5'
  }
}
const TEXT = {
  product: 'Ürün',
  order: 'Sipariş',
  home: 'Ana Sayfa',
  favorites: 'Favoriler',
  contact: 'İletişim',
  account: 'Hesabım',
  pastOrders: 'Eski Siparişlerim',
  orderDetails: 'Sipariş Detayı',
  repeatOrder: 'Eski Siparişi Tekrarla',
  repeatAdded: 'Uygun ürünler sepete eklendi',
  repeatUnavailable: 'Bazı ürünler artık sistemde yok veya stokta kalmamış',
  repeatNoItems: 'Tekrar eklenebilecek uygun ürün bulunamadı',
  orderStatus: 'Sipariş Durumu',
  paymentStatusLabel: 'Ödeme Durumu',
  orderItems: 'Ürünler',
  unavailableTag: 'Eklenemedi',
  guestCustomer: 'Misafir Müşteri',
  searchPlaceholder: 'Ürün, kategori ara...',
  categories: 'Kategoriler',
  showAll: 'Tümünü Gör',
  noCategory: 'Uygun kategori bulunamadı.',
  noProduct: 'Bu kategoride ürün bulunamadı.',
  detailHint: 'Detaylar için dokunun.',
  details: 'Detayları Gör',
  addToCart: 'Sepete Ekle',
  favoritesHelp: 'Favori ürünlerinizi buradan hızlıca sepete ekleyebilirsiniz.',
  noFavorites: 'Henüz favori ürününüz yok.',
  contactHelp: 'İletişim bilgileri sistem ayarlarından gelir.',
  noContact: 'İletişim bilgisi henüz tanımlanmamış.',
  workingHours: 'Çalışma Saatleri',
  cart: 'Sepetim',
  cartHelp: 'Sipariş sadece bu ekrandan tamamlanır.',
  cartEmpty: 'Sepetiniz boş.',
  total: 'Genel Toplam',
  linkedAccountOrder: 'Sipariş kaydı hesabınıza bağlanacak',
  fallbackLocation: 'Lokasyon hesap bilgisinden alınacak',
  locationPlaceholder: 'Lokasyon / Sınıf / Masa',
  addressPlaceholder: 'Adres',
  orderNote: 'Sipariş notu',
  creatingOrder: 'Sipariş oluşturuluyor...',
  completeOrder: 'Siparişi Tamamla',
  successTitle: 'Siparişiniz alındı',
  successHelp: 'Sipariş sistemde QR Siparişleri sayfasına düştü.',
  orderNo: 'Sipariş No',
  openAccount: 'Hesap Aç ve Takip Et',
  backToMenu: 'Menüye Dön',
  logout: 'Çıkış',
  existingAccount: 'Mevcut Hesap',
  createAccount: 'Yeni Hesap Oluştur',
  loginNote: 'Mevcut hesapta sadece telefon ve şifre ile giriş yapılır. Başarılı girişte eski QR siparişleri ve cari borç durumu görünür.',
  registerNote: 'Yeni hesapta ad soyad, telefon, şifre ve şifre tekrar zorunludur. Kayıtlı telefon varsa mevcut hesap ile giriş yapın.',
  passwordPlaceholder: 'Şifre *',
  passwordRepeatPlaceholder: 'Şifre Tekrar *',
  login: 'Giriş Yap',
  register: 'Hesap Oluştur',
  debtStatus: 'Borç Durumu:',
  noOldOrders: 'Eski QR siparişi bulunamadı.',
  productDetail: 'Ürün Detayı',
  otherProducts: 'Diğer Ürünler',
  noDescription: 'Açıklama bulunmuyor.',
  canteenProduct: 'Mağaza Ürünü',
  removeFromFavorites: 'Favorilerden Çıkar',
  addToFavorites: 'Favoriye Ekle',
  loading: 'QR sipariş sayfası yükleniyor...',
  loadError: 'QR sipariş sayfası açılmadı',
  phone: 'Telefon',
  whatsapp: 'WhatsApp',
  email: 'E-posta',
  address: 'Adres',
  delete: 'Sil',
  noBranchMix: 'Sepette tek şube ürünleri olmalı',
  emptyCartToast: 'Sepet boş',
  loginSuccess: 'Hesabınıza giriş yapıldı',
  logoutSuccess: 'Müşteri oturumu kapatıldı',
  orderFailed: 'Sipariş oluşturulamadı',
  accountRequired: 'Ad soyad, telefon, şifre ve şifre tekrar zorunlu',
  passwordRequired: 'Telefon ve şifre zorunlu',
  registerFailed: 'Hesap oluşturulamadı',
  passwordMismatch: 'Şifreler aynı değil',
  registerSuccess: 'Hesap açıldı ve carilere kaydedildi',
  profileSaved: 'Hesap bilgileri güncellendi'
}
const ICON_MARKUP = {
  menu: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2"/><path d="m20 20-4.2-4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  heartFilled: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.6 4h3l1.2 4.1-1.8 1.8a14.8 14.8 0 0 0 5.1 5.1l1.8-1.8L20 14.4v3A2.6 2.6 0 0 1 17.4 20C10.6 20 5 14.4 5 7.6A2.6 2.6 0 0 1 7.6 5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16v10H4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m4 8 8 6 8-6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="2"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/><path d="M12 8v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="2"/><path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6h14l-1.2 6.5a1 1 0 0 1-1 .8H8.2a1 1 0 0 1-1-.8L5.5 4H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="18" r="1.4" fill="currentColor"/><circle cx="17" cy="18" r="1.4" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12 4 4 8-8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'
}

function formatMoneyLegacy(value) {
  const amount = Number(value || 0)
  return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function safeText(value, fallback = '') {
  const text = fixMojibake(String(value || '')).trim()
  return text || fallback
}

function resolvePublicQrAssetUrl(value, fallback = '') {
  const raw = safeText(value)
  if (!raw) return fallback
  if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//')) {
    try {
      const parsed = new URL(raw, API_ORIGIN || window.location.origin)
      const apiOrigin = API_ORIGIN || parsed.origin
      if (parsed.origin === apiOrigin && parsed.pathname.startsWith('/uploads/')) {
        return `${apiOrigin}/api${parsed.pathname}${parsed.search || ''}${parsed.hash || ''}`
      }
      return raw
    } catch {
      return raw
    }
  }
  if (!API_ORIGIN) return raw
  if (raw.startsWith('/api/uploads/')) return `${API_ORIGIN}${raw}`
  if (raw.startsWith('/uploads/')) return `${API_ORIGIN}/api${raw}`
  if (raw.startsWith('/')) return `${API_ORIGIN}${raw}`
  return raw
}

function normalizePhone(value) {
  return String(value || '').trim().replace(/\s+/g, '').replace(/[^0-9+]/g, '')
}

function getPublicQrThemeStyle(themeId) {
  return PUBLIC_QR_THEME_STYLES[String(themeId || '').trim()] || PUBLIC_QR_THEME_STYLES.light
}

const MOJIBAKE_REPLACEMENTS = [
  ['\u00c3\u0192\u00e2\u20ac\u00a1', '\u00c7'],
  ['\u00c3\u0192\u00c5\u201c', '\u00dc'],
  ['\u00c3\u0192\u00c5\u00b8', '\u015e'],
  ['\u00c3\u0192\u00c2\u00a7', '\u00e7'],
  ['\u00c3\u0192\u00c2\u00b6', '\u00f6'],
  ['\u00c3\u0192\u00c2\u00bc', '\u00fc'],
  ['\u00c3\u2021', '\u00c7'],
  ['\u00c3\u00a7', '\u00e7'],
  ['\u00c3\u2013', '\u00d6'],
  ['\u00c3\u00b6', '\u00f6'],
  ['\u00c3\u0153', '\u00dc'],
  ['\u00c3\u00bc', '\u00fc'],
  ['\u00c4\u00b0', '\u0130'],
  ['\u00c4\u00b1', '\u0131'],
  ['\u00c5\u017e', '\u015e'],
  ['\u00c5\u00b8', '\u015f'],
  ['\u00c4\u017e', '\u011e'],
  ['\u00c4\u00b8', '\u011f'],
  ['\u00e2\u201a\u00ba', '\u20ba'],
  ['\u00e2\u20ac\u00a2', '\u2022'],
  ['\u00e2\u02c6\u2019', '\u2212'],
  ['\u00e2\u201e\u00a2\u00c2\u00a5', '\u2665'],
  ['\u00e2\u201e\u00a2\u00c2\u00a1', '\u2661'],
  ['\u00e2\u0152\u201a', '\u2302'],
  ['\u00e2\u02dc\u008f', '\u2706'],
  ['\u00e2\u0153\u2020', '\u2706'],
  ['\u00e2\u0153\u2030', '\u2709'],
  ['\u00e2\u0152\u2013', '\u2316'],
  ['\u00e2\u20ac\u201d\u00b7', '\u25f7'],
  ['\u00e2\u20ac\u00b0\u00a1', '\u2261'],
  ['\u011f\u0178\u2018\u00a4', '\ud83d\udc64'],
  ['\u011f\u0178\u203a\u2019', '\ud83d\uded2'],
  ['\u011f\u0178\u201d\u008e', '\ud83d\udd0e'],
  ['Detaylar i\u00c3\u0192\u00c2\u00a7in dokunun.', 'Detaylar i\u00e7in dokunun.'],
  ['Detaylar iÃƒÆ’Ã‚Â§in dokunun.', 'Detaylar için dokunun.'],
  ['Detaylar\u00c4\u00b1 G\u00c3\u00b6r', 'Detaylar\u0131 G\u00f6r'],
  ['DetaylarÃƒâ€Ã‚Â± GÃƒÆ’Ã‚Â¶r', 'Detayları Gör'],
  ['QR sipari\u00c5\u0178 sayfas\u00c4\u00b1 a\u00c3\u00a7\u00c4\u00b1lamad\u00c4\u00b1', 'QR sipari\u015f sayfas\u0131 a\u00e7\u0131lamad\u0131'],
  ['QR sipariÃ…Å¸ sayfasÃ„Â± aÃƒÂ§Ã„Â±lamadÃ„Â±', 'QR sipariş sayfası açılamadı'],
  ['Sipari\u00c5\u0178', 'Sipari\u015f'],
  ['SipariÃ…Å¸', 'Sipariş'],
  ['\u00c3\u015cr\u00c3\u00bcn', '\u00dcr\u00fcn'],
  ['ÃƒÅ“rÃƒÂ¼n', 'Ürün'],
  ['\u00c3\u015cr\u00c3\u00bcn sepetten kald\u00c4\u00b1r\u00c4\u00b1ld\u00c4\u00b1', '\u00dcr\u00fcn sepetten kald\u0131r\u0131ld\u0131'],
  ['ÃƒÅ“rÃƒÂ¼n sepetten kaldÃ„Â±rÃ„Â±ldÃ„Â±', 'Ürün sepetten kaldırıldı'],
  ['favorilerden \u00c3\u00a7\u00c4\u00b1kar\u00c4\u00b1ld\u00c4\u00b1', 'favorilerden \u00e7\u0131kar\u0131ld\u0131'],
  ['favorilerden ÃƒÂ§Ã„Â±karÃ„Â±ldÃ„Â±', 'favorilerden çıkarıldı'],
  ['Telefon ve \u00c5\u0178ifre zorunlu', 'Telefon ve \u015fifre zorunlu'],
  ['Giri\u00c5\u0178 yap\u00c4\u00b1lamad\u00c4\u00b1', 'Giri\u015f yap\u0131lamad\u0131'],
  ['Hesab?n?za giri? yap?ld?', 'Hesab\u0131n\u0131za giri\u015f yap\u0131ld\u0131'],
  ['Ad soyad, telefon, ?ifre ve ?ifre tekrar zorunlu', 'Ad soyad, telefon, \u015fifre ve \u015fifre tekrar zorunlu'],
  ['Hesap olu?turulamad?', 'Hesap olu\u015fturulamad\u0131'],
  ['M\u00c3\u00bc\u00c5\u0178teri oturumu kapat\u00c4\u00b1ld\u00c4\u00b1', 'M\u00fc\u015fteri oturumu kapat\u0131ld\u0131'],
  ['Hesab?n?za giri? yap?ld?', 'Hesabınıza giriş yapıldı'],
  ['Sepette tek \u00c5\u0178ube \u00c3\u00bcr\u00c3\u00bcnleri olmal\u00c4\u00b1', 'Sepette tek \u015fube \u00fcr\u00fcnleri olmal\u0131'],
  ['Sepette tek Ã…Å¸ube ÃƒÂ¼rÃƒÂ¼nleri olmalÃ„Â±', 'Sepette tek şube ürünleri olmalı'],
  ['Sipari\u00c5\u0178 olu\u00c5\u0178turulamad\u00c4\u00b1', 'Sipari\u015f olu\u015fturulamad\u0131'],
  ['SipariÃ…Å¸ oluÃ…Å¸turulamadÃ„Â±', 'Sipariş oluşturulamadı'],
  ['QR sipari\u00c5\u0178 sayfas\u00c4\u00b1 y\u00c3\u00bckleniyor...', 'QR sipari\u015f sayfas\u0131 y\u00fckleniyor...'],
  ['QR sipariÃ…Å¸ sayfasÃ„Â± yÃƒÂ¼kleniyor...', 'QR sipariş sayfası yükleniyor...'],
  ['\u00c4\u00b0leti\u00c5\u0178im', '\u0130leti\u015fim'],
  ['Ãƒâ€Ã‚Â°letiÃƒâ€¦Ã…Â¸im', 'İletişim'],
  ['Misafir M\u00c3\u00bc\u00c5\u0178teri', 'Misafir M\u00fc\u015fteri'],
  ['Misafir MÃƒÂ¼Ã…Å¸teri', 'Misafir Müşteri'],
  ['T\u00c3\u00bcm\u00c3\u00bcn\u00c3\u00bc G\u00c3\u00b6r', 'T\u00fcm\u00fcn\u00fc G\u00f6r'],
  ['TÃƒÆ’Ã‚Â¼mÃƒÆ’Ã‚Â¼nÃƒÆ’Ã‚Â¼ GÃƒÆ’Ã‚Â¶r', 'Tümünü Gör'],
  ['Uygun kategori bulunamad\u00c4\u00b1.', 'Uygun kategori bulunamad\u0131.'],
  ['Uygun kategori bulunamadÃƒâ€Ã‚Â±.', 'Uygun kategori bulunamadı.'],
  ['Bu kategoride \u00c3\u00bcr\u00c3\u00bcn bulunamad\u00c4\u00b1.', 'Bu kategoride \u00fcr\u00fcn bulunamad\u0131.'],
  ['Bu kategoride ÃƒÆ’Ã‚Â¼rÃƒÆ’Ã‚Â¼n bulunamadÃƒâ€Ã‚Â±.', 'Bu kategoride ürün bulunamadı.'],
  ['Favori \u00c3\u00bcr\u00c3\u00bcnlerinizi buradan h\u00c4\u00b1zl\u00c4\u00b1ca sepete ekleyebilirsiniz.', 'Favori \u00fcr\u00fcnlerinizi buradan h\u0131zl\u0131ca sepete ekleyebilirsiniz.'],
  ['Favori ÃƒÂ¼rÃƒÂ¼nlerinizi buradan hÃ„Â±zlÃ„Â±ca sepete ekleyebilirsiniz.', 'Favori ürünlerinizi buradan hızlıca sepete ekleyebilirsiniz.'],
  ['Hen\u00c3\u00bcz favori \u00c3\u00bcr\u00c3\u00bcn\u00c3\u00bcn\u00c3\u00bcz yok.', 'Hen\u00fcz favori \u00fcr\u00fcn\u00fcn\u00fcz yok.'],
  ['\u00c3\u2021al\u00c4\u00b1\u00c5\u0178ma Saatleri', '\u00c7al\u0131\u015fma Saatleri'],
  ['\u00c4\u00b0leti\u00c5\u0178im bilgisi hen\u00c3\u00bcz tan\u00c4\u00b1mlanmam\u00c4\u00b1\u00c5\u0178.', '\u0130leti\u015fim bilgisi hen\u00fcz tan\u0131mlanmam\u0131\u015f.'],
  ['Ãƒâ€Ã‚Â°letiÃƒâ€¦Ã…Â¸im bilgisi henÃƒÆ’Ã‚Â¼z tanÃƒâ€Ã‚Â±mlanmamÃƒâ€Ã‚Â±Ãƒâ€¦Ã…Â¸.', 'İletişim bilgisi henüz tanımlanmamış.'],
  ['Sipari? sadece bu ekrandan tamamlan?r.', 'Sipari\u015f sadece bu ekrandan tamamlan\u0131r.'],
  ['Sepetiniz boÃ…Å¸.', 'Sepetiniz boş.'],
  ['Sepetiniz bo\u00c5\u0178.', 'Sepetiniz bo\u015f.'],
  ['Sipari\u00c5\u0178 kay\u00c4\u00b1tl\u00c4\u00b1 hesab\u00c4\u00b1n\u00c4\u00b1za ba\u00c4\u0178lanacak', 'Sipari\u015f kay\u0131tl\u0131 hesab\u0131n\u0131za ba\u011flanacak'],
  ['SipariÃ…Å¸ kayÃ„Â±tlÃ„Â± hesabÃ„Â±nÃ„Â±za baÃ„Å¸lanacak', 'Sipariş kayıtlı hesabınıza bağlanacak'],
  ['Lokasyon hesap bilgisinden al\u00c4\u00b1nacak', 'Lokasyon hesap bilgisinden al\u0131nacak'],
  ['Lokasyon / S?n?f / Masa *', 'Lokasyon / S\u0131n\u0131f / Masa *'],
  ['Sipari\u00c5\u0178 notu', 'Sipari\u015f notu'],
  ['Sipari? olu?turuluyor...', 'Sipari\u015f olu\u015fturuluyor...'],
  ['Sipari?i Tamamla', 'Sipari\u015fi Tamamla'],
  ['Sipari?iniz al?nd?', 'Sipari\u015finiz al\u0131nd\u0131'],
  ['Sipari? sistemde QR Sipari?leri sayfas?na d??t?.', 'Sipari\u015f sistemde QR Sipari\u015fleri sayfas\u0131na d\u00fc\u015ft\u00fc.'],
  ['Sipari? No', 'Sipari\u015f No'],
  ['Hesap A? ve Takip Et', 'Hesap A\u00e7 ve Takip Et'],
  ['Men?ye D?n', 'Men\u00fcye D\u00f6n'],
  ['Hesab?m', 'Hesab\u0131m'],
  ['??k??', '\u00c7\u0131k\u0131\u015f'],
  ['Yeni Hesap Olu?tur', 'Yeni Hesap Olu\u015ftur'],
  ['?ifre', '\u015eifre'],
  ['Giri? Yap', 'Giri\u015f Yap'],
  ['Kay?tl? telefon varsa mevcut hesap ile giri? yap?n.', 'Kay\u0131tl\u0131 telefon varsa mevcut hesap ile giri\u015f yap\u0131n.'],
  ['Lokasyon / S?n?f / B?l?m', 'Lokasyon / S\u0131n\u0131f / B\u00f6l\u00fcm'],
  ['Bor? Durumu:', 'Bor\u00e7 Durumu:'],
  ['Eski QR sipari\u00c5\u0178i bulunamad\u00c4\u00b1.', 'Eski QR sipari\u015fi bulunamad\u0131.'],
  ['Eski QR sipariÃ…Å¸i bulunamadÃ„Â±.', 'Eski QR siparişi bulunamadı.'],
  ['?r?n Detay?', '\u00dcr\u00fcn Detay\u0131'],
  ['HesabÃ„Â±m', 'Hesabım'],
  ['Kantin ?r?n?', 'Mağaza Ürünü'],
  ['Di?er ?r?nler', 'Diğer Ürünler'],
  ['A??klama bulunmuyor.', 'Açıklama bulunmuyor.'],
  ['Di?er ?r?nler', 'Di\u011fer \u00dcr\u00fcnler'],
  ['A??klama bulunmuyor.', 'A\u00e7\u0131klama bulunmuyor.'],
  ['Kantin ?r?n?', 'Mağaza Ürünü'],
  ['Favorilerden ??kar', 'Favorilerden \u00c7\u0131kar'],
  ['ÃƒÂ¢Ã…â€™Ã¢â‚¬Å¡', '⌂'],
  ['ÃƒÂ¢Ã¢â€Â¢Ã‚Â¡', '♡'],
  ['Ã„Å¸Ã…Â¸Ã¢â‚¬ÂºÃ¢â‚¬â„¢', '🛒'],
  ['ÃƒÂ¢Ã‹Å“Ã‚Â', '☎'],
  ['Ã„Å¸Ã…Â¸Ã¢â‚¬ËœÃ‚Â¤', '👤'],
  ['ÃƒÂ¢Ã‹Å“Ã‚Â', '☎'],
  ['ÃƒÂ¢Ã…â€œÃ¢â‚¬Â ', '✆'],
  ['ÃƒÂ¢Ã…â€œÃ¢â‚¬Â°', '✉'],
  ['ÃƒÂ¢Ã…â€™Ã¢â‚¬â€œ', '⌖'],
  ['ÃƒÂ¢Ã¢â‚¬â€Ã‚Â·', '◷']
]

function fixMojibake(value) {
  let text = String(value ?? '')
  for (let index = 0; index < 3; index += 1) {
    let next = text
    for (const [search, replacement] of MOJIBAKE_REPLACEMENTS) {
      next = next.split(search).join(replacement)
    }
    if (next === text) break
    text = next
  }
  return text
}

function formatMoney(value) {
  const amount = Number(value || 0)
  return `\u20BA${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function translateOrderStatus(value) {
  const key = String(value || '').trim().toLowerCase()
  if (key === 'new') return 'Yeni'
  if (key === 'preparing') return 'Hazırlanıyor'
  if (key === 'ready') return 'Hazır'
  if (key === 'delivered') return 'Teslim Edildi'
  if (key === 'cancelled') return 'İptal Edildi'
  return String(value || '-')
}

function translatePaymentStatus(value) {
  const key = String(value || '').trim().toLowerCase()
  if (key === 'pending') return 'Ödeme Bekleniyor'
  if (key === 'unpaid') return 'Ödenmedi'
  if (key === 'paid') return 'Ödendi'
  if (key === 'cari') return 'Cariye Yazıldı'
  return String(value || '-')
}

function QrIcon({ name, size = 18, stroke = 2 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' }
  if (name === 'menu') return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" /></svg>
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth={stroke} /><path d="m20 20-4.2-4.2" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" /></svg>
  if (name === 'home') return <svg {...common}><path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" /></svg>
  if (name === 'heart') return <svg {...common}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" /></svg>
  if (name === 'heartFilled') return <svg {...common} fill="currentColor"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" /></svg>
  if (name === 'phone') return <svg {...common}><path d="M6.6 4h3l1.2 4.1-1.8 1.8a14.8 14.8 0 0 0 5.1 5.1l1.8-1.8L20 14.4v3A2.6 2.6 0 0 1 17.4 20C10.6 20 5 14.4 5 7.6A2.6 2.6 0 0 1 7.6 5Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" /></svg>
  if (name === 'mail') return <svg {...common}><path d="M4 7h16v10H4z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" /><path d="m4 8 8 6 8-6" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" /></svg>
  if (name === 'pin') return <svg {...common}><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" /><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth={stroke} /></svg>
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={stroke} /><path d="M12 8v5l3 2" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" /></svg>
  if (name === 'user') return <svg {...common}><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth={stroke} /><path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" /></svg>
  if (name === 'cart') return <svg {...common}><path d="M6 6h14l-1.2 6.5a1 1 0 0 1-1 .8H8.2a1 1 0 0 1-1-.8L5.5 4H3" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="18" r="1.4" fill="currentColor" /><circle cx="17" cy="18" r="1.4" fill="currentColor" /></svg>
  if (name === 'check') return <svg {...common}><path d="m6 12 4 4 8-8" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" /></svg>
  if (name === 'minus') return <svg {...common}><path d="M6 12h12" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" /></svg>
  return null
}

function applyIconMarkup(element, name) {
  if (!element || !name) return
  const markup = ICON_MARKUP[name]
  if (!markup) return
  if (element.dataset.qrIconName === name) return
  element.dataset.qrIconName = name
  element.innerHTML = markup
  const svg = element.querySelector('svg')
  if (svg) {
    svg.style.width = '1em'
    svg.style.height = '1em'
    svg.style.display = 'block'
  }
}

function getProductAvailableStock(product) {
  if (product?.stockTrackingEnabled !== true) return Number.POSITIVE_INFINITY
  return Math.max(0, Number(product?.stockQty || 0))
}

function isProductOutOfStock(product) {
  return product?.stockTrackingEnabled === true && getProductAvailableStock(product) <= 0
}

function getProductStockLabel(product) {
  if (product?.stockTrackingEnabled !== true) return 'Stok takibi yok'
  const qty = getProductAvailableStock(product)
  if (qty <= 0) return 'Stokta yok'
  return `Stok: ${qty}`
}

function ProductCard({ product, favoriteIds, onToggleFavorite, onOpenDetail, onAddToCart }) {
  const isFavorite = favoriteIds.includes(String(product.id))
  const outOfStock = isProductOutOfStock(product)
  const openDetail = () => onOpenDetail(product)
  const handleCopyKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDetail()
    }
  }

  return (
    <article className="qr-ref-product">
      <button type="button" className="qr-ref-product-image-button qr-ref-product-media" onClick={openDetail}>
        <ProductImage
          product={product}
          alt={product.name}
          width={90}
          height={90}
          style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover', background: 'transparent' }}
        />
      </button>
      <div className="qr-ref-product-body">
        <div
          className="qr-ref-product-copy"
          tabIndex={0}
          onClick={openDetail}
          onKeyDown={handleCopyKeyDown}
        >
          <div className="qr-ref-product-topline">
            <h3>{product.name}</h3>
          </div>
          <p>{safeText(product.description, 'Detaylar için dokunun.')}</p>
          <div className={`qr-ref-stock-pill${outOfStock ? ' is-empty' : ''}`}>{getProductStockLabel(product)}</div>
        </div>
      </div>
      <div className="qr-ref-product-side">
        <div className="qr-ref-product-side-top">
          <strong className="qr-ref-price-pill">{formatMoney(product.price)}</strong>
          <button type="button" className={`qr-ref-heart${isFavorite ? ' is-active' : ''}`} onClick={() => onToggleFavorite(product)}>
            {isFavorite ? '♥' : '♡'}
          </button>
        </div>
        <div className="qr-ref-product-actions">
          <button type="button" className="qr-ref-round-cta qr-ref-add-btn" onClick={() => onAddToCart(product)} disabled={outOfStock}>{outOfStock ? 'Stokta Yok' : 'Sepete Ekle'}</button>
        </div>
      </div>
    </article>
  )
}

export default function CanteenQrPricePage() {
  const { slug } = useParams()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)
  const [view, setView] = useState('home')
  const [query, setQuery] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [categoryMode, setCategoryMode] = useState('grid')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [cart, setCart] = useState([])
  const [customerForm, setCustomerForm] = useState(CUSTOMER_FORM)
  const [accountMode, setAccountMode] = useState('login')
  const [loginForm, setLoginForm] = useState(LOGIN_FORM)
  const [registerForm, setRegisterForm] = useState(REGISTER_FORM)
  const [customerSession, setCustomerSession] = useState(null)
  const [customerProfile, setCustomerProfile] = useState(null)
  const [profileForm, setProfileForm] = useState(PROFILE_FORM)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [successOrder, setSuccessOrder] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState('')
  const pageRootRef = useRef(null)
  const categoryScrollRef = useRef(null)
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 })
  const selectedBranchId = useMemo(() => {
    const params = new URLSearchParams(location.search || '')
    return String(params.get('branchId') || '').trim()
  }, [location.search])
  const selectedBranchName = useMemo(() => {
    const params = new URLSearchParams(location.search || '')
    return String(params.get('branch') || params.get('branchName') || '').trim()
  }, [location.search])

  useBodyLayoutMode('public-site-layout')

  const tenantId = String(payload?.tenant?.id || '')
  const sessionStorageKey = `canteen_qr_customer_${tenantId}`
  const favoriteStorageKey = `canteen_qr_favorites_${tenantId}`
  const cartStorageKey = `canteen_qr_cart_${String(slug || '').trim()}`

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      const params = new URLSearchParams()
      params.set('slug', String(slug || ''))
      if (selectedBranchId) params.set('branchId', selectedBranchId)
      else if (selectedBranchName) params.set('branch', selectedBranchName)
      const response = await api(`/api/public/qr?${params.toString()}`, {
        silent: true,
        portalOverride: 'restaurant',
        skipBranchHeader: true,
        suppressAuthRedirect: true
      })
      if (!response?.success) {
        setPayload(null)
        setError(response?.message || TEXT.loadError)
        setLoading(false)
        return
      }
      setPayload(response)
      setLoading(false)
    }

    load()
  }, [selectedBranchId, selectedBranchName, slug])

  useEffect(() => {
    if (!tenantId) return
    try {
      const rawSession = localStorage.getItem(sessionStorageKey)
      const rawFavorites = localStorage.getItem(favoriteStorageKey)
      if (rawSession) setCustomerSession(JSON.parse(rawSession))
      if (rawFavorites) setFavoriteIds(JSON.parse(rawFavorites))
    } catch {}
  }, [tenantId, sessionStorageKey, favoriteStorageKey])

  useEffect(() => {
    try {
      const rawCart = localStorage.getItem(cartStorageKey)
      if (!rawCart) return
      const parsed = JSON.parse(rawCart)
      if (Array.isArray(parsed)) setCart(parsed)
    } catch {}
  }, [cartStorageKey])

  useEffect(() => {
    if (!tenantId) return
    try {
      localStorage.setItem(favoriteStorageKey, JSON.stringify(favoriteIds))
    } catch {}
  }, [favoriteIds, tenantId, favoriteStorageKey])

  useEffect(() => {
    if (!customerSession || !tenantId) return
    try {
      localStorage.setItem(sessionStorageKey, JSON.stringify(customerSession))
    } catch {}
  }, [customerSession, tenantId, sessionStorageKey])

  useEffect(() => {
    try {
      if (!Array.isArray(cart) || cart.length === 0) {
        localStorage.removeItem(cartStorageKey)
        return
      }
      localStorage.setItem(cartStorageKey, JSON.stringify(cart))
    } catch {}
  }, [cart, cartStorageKey])

  const loadCustomerProfile = async (session) => {
    if (!tenantId || !session?.customerId) return
    const response = await api(`/api/public/qr-customer/profile?tenantId=${encodeURIComponent(tenantId)}&customerId=${encodeURIComponent(String(session.customerId))}`, {
      silent: true,
      portalOverride: 'restaurant',
      skipBranchHeader: true,
      suppressAuthRedirect: true
    })
    if (!response?.success) return

    setCustomerProfile(response)
    if (Array.isArray(response.favoriteProductIds)) setFavoriteIds(response.favoriteProductIds.map(String))
    if (response.customer) {
      const nextProfileForm = {
        name: response.customer.name || session.name || '',
        phone: response.customer.phone || session.phone || '',
        location: response.customer.note || session.location || '',
        address: response.customer.address || session.address || ''
      }
      setCustomerSession({
        customerId: response.customer.id,
        name: response.customer.name,
        phone: response.customer.phone,
        location: nextProfileForm.location,
        address: nextProfileForm.address
      })
      setProfileForm(nextProfileForm)
    }
  }

  useEffect(() => {
    if (!customerSession?.customerId || !tenantId) return
    loadCustomerProfile(customerSession)
  }, [customerSession?.customerId, tenantId])

  useEffect(() => {
    const root = pageRootRef.current
    if (!root) return

    const normalizeNodeText = (node) => {
      if (!node || !node.nodeValue) return
      const normalized = fixMojibake(node.nodeValue)
      if (normalized !== node.nodeValue) node.nodeValue = normalized
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) normalizeNodeText(walker.currentNode)

    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach((element) => {
      ;['placeholder', 'title', 'aria-label'].forEach((attr) => {
        const value = element.getAttribute(attr)
        if (!value) return
        const normalized = fixMojibake(value)
        if (normalized !== value) element.setAttribute(attr, normalized)
      })
    })

    root.querySelectorAll('.qr-ref-search span, .qr-ref-desktop-search span').forEach((element) => applyIconMarkup(element, 'search'))
    root.querySelectorAll('.qr-ref-menu-btn').forEach((element) => applyIconMarkup(element, 'menu'))
    root.querySelectorAll('.qr-ref-center-cart').forEach((element) => {
      const countNode = element.querySelector('.qr-ref-center-count')
      const countMarkup = countNode ? countNode.outerHTML : ''
      if (element.dataset.qrIconName !== 'cart') {
        element.dataset.qrIconName = 'cart'
        element.innerHTML = `${ICON_MARKUP.cart}${countMarkup}`
      } else if (countNode && !element.querySelector('.qr-ref-center-count')) {
        element.insertAdjacentHTML('beforeend', countMarkup)
      }
    })

    root.querySelectorAll('.qr-ref-heart').forEach((element) => {
      applyIconMarkup(element, element.classList.contains('is-active') ? 'heartFilled' : 'heart')
    })
    root.querySelectorAll('.qr-ref-success-mark').forEach((element) => applyIconMarkup(element, 'check'))
    root.querySelectorAll('.qr-ref-qty button:first-child').forEach((element) => applyIconMarkup(element, 'minus'))

    root.querySelectorAll('.qr-ref-desktop-nav button, .qr-ref-bottom-nav .qr-ref-nav-btn').forEach((button) => {
      const label = fixMojibake(button.textContent || '')
      const icon = label.includes(TEXT.home)
        ? 'home'
        : label.includes(TEXT.favorites)
          ? 'heart'
          : label.includes(TEXT.contact)
            ? 'phone'
            : label.includes(TEXT.account)
              ? 'user'
              : ''
      const iconElement = button.querySelector('.qr-ref-desktop-nav-icon, .qr-ref-nav-icon')
      if (iconElement && icon) applyIconMarkup(iconElement, icon)
    })

    const desktopNavButtons = root.querySelectorAll('.qr-ref-desktop-nav button')
    if (desktopNavButtons[2]) {
      const label = desktopNavButtons[2].querySelector('span:first-child')
      if (label) label.textContent = TEXT.contact
    }

    const bottomNavButtons = root.querySelectorAll('.qr-ref-bottom-nav .qr-ref-nav-btn')
    if (bottomNavButtons[2]) {
      const label = bottomNavButtons[2].querySelector('span:last-child')
      if (label) label.textContent = TEXT.contact
    }

    const menuButtons = root.querySelectorAll('.qr-ref-menu button')
    if (menuButtons[3]) menuButtons[3].textContent = TEXT.contact

    root.querySelectorAll('.qr-ref-contact').forEach((element) => {
      const label = fixMojibake(element.textContent || '')
      const iconElement = element.querySelector('.qr-ref-contact-icon')
      if (!iconElement) return
      if (label.includes(TEXT.phone) || label.includes(TEXT.whatsapp)) applyIconMarkup(iconElement, 'phone')
      else if (label.includes(TEXT.email)) applyIconMarkup(iconElement, 'mail')
      else if (label.includes(TEXT.address)) applyIconMarkup(iconElement, 'pin')
      else if (label.includes(TEXT.workingHours)) applyIconMarkup(iconElement, 'clock')
    })

    if (view === 'contact') {
      const panel = root.querySelector('.qr-ref-panel')
      const title = panel?.querySelector('h2')
      const muted = panel?.querySelector('.qr-ref-muted')
      const empty = panel?.querySelector('.qr-ref-empty')
      if (title) title.textContent = TEXT.contact
      if (muted) muted.textContent = TEXT.contactHelp
      if (empty) empty.textContent = TEXT.noContact
      panel?.querySelectorAll('strong').forEach((strong) => {
        const label = fixMojibake(strong.textContent || '')
        if (label.includes('al') && label.includes('Saat')) strong.textContent = TEXT.workingHours
      })
    }
  }, [loading, error, payload, view, categoryMode, activeCategoryId, favoriteIds, cart.length, selectedProduct, successOrder, menuOpen, accountMode, query])

  const categories = useMemo(() => Array.isArray(payload?.categories) ? payload.categories : [], [payload])
  const products = useMemo(() => Array.isArray(payload?.products) ? payload.products : [], [payload])
  const branches = useMemo(() => Array.isArray(payload?.branches) ? payload.branches : [], [payload])
  const branchNameById = useMemo(() => new Map(branches.map((branch) => [String(branch.id), String(branch.name || '')])), [branches])

  const filteredBySearch = useMemo(() => {
    const normalizedQuery = safeText(query).toLocaleLowerCase('tr-TR')
    if (!normalizedQuery) return products
    return products.filter((product) => {
      const text = `${product.name || ''} ${product.categoryName || ''} ${product.description || ''}`.toLocaleLowerCase('tr-TR')
      return text.includes(normalizedQuery)
    })
  }, [products, query])

  const visibleCategories = useMemo(() => {
    const ids = new Set(filteredBySearch.map((product) => String(product.categoryId || '')))
    return categories.filter((category) => ids.has(String(category.id || '')))
  }, [categories, filteredBySearch])

  const visibleProducts = useMemo(() => {
    if (!activeCategoryId) return []
    return filteredBySearch.filter((product) => String(product.categoryId || '') === String(activeCategoryId))
  }, [filteredBySearch, activeCategoryId])

  const favoriteProducts = useMemo(() => {
    const ids = new Set(favoriteIds.map(String))
    return products.filter((product) => ids.has(String(product.id)))
  }, [products, favoriteIds])
  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products])

  useEffect(() => {
    if (productById.size === 0) return
    setCart((current) => current
      .map((item) => {
        const product = productById.get(String(item.productId || ''))
        if (!product) return null
        const quantity = Math.max(1, Math.floor(Number(item.quantity || 0)))
        const cappedQuantity = product.stockTrackingEnabled === true
          ? Math.min(quantity, getProductAvailableStock(product))
          : quantity
        if (product.stockTrackingEnabled === true && cappedQuantity <= 0) return null
        return {
          productId: String(product.id),
          branchId: String(product.branchId || ''),
          productName: String(product.name || ''),
          categoryName: String(product.categoryName || ''),
          imageUrl: String(product.imageUrl || ''),
          quantity: cappedQuantity,
          unitPrice: Number(product.price || 0),
          totalPrice: Number((Number(product.price || 0) * cappedQuantity).toFixed(2)),
          note: String(item.note || '')
        }
      })
      .filter(Boolean))
  }, [productById])

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [cart])
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0), [cart])
  const cartBranchIds = useMemo(() => Array.from(new Set(cart.map((item) => String(item.branchId || '')).filter(Boolean))), [cart])
  const activeCartBranchId = cartBranchIds.length === 1 ? cartBranchIds[0] : ''

  const title = safeText(payload?.settings?.qrTitle, payload?.tenant?.name || 'Sipariş')
  const activeBranchName = safeText(payload?.branch?.name)
  const coverUrl = resolvePublicQrAssetUrl(payload?.settings?.qrCoverImageUrl, IMAGE_PLACEHOLDER)
  const qrPhone = safeText(payload?.settings?.qrPhone)
  const qrWhatsapp = safeText(payload?.settings?.qrWhatsapp)
  const qrEmail = safeText(payload?.settings?.qrEmail)
  const qrAddress = safeText(payload?.settings?.qrAddress)
  const qrWorkingHours = safeText(payload?.settings?.qrWorkingHours)
  const selectedQrTheme = String(payload?.settings?.qrTheme || 'light').trim()
  const previewTheme = qrThemes.find((item) => item.id === selectedQrTheme) || qrThemes[0]
  const publicTheme = getPublicQrThemeStyle(selectedQrTheme)
  const pageThemeVars = {
    '--app-bg': publicTheme.appBg,
    '--app-surface': publicTheme.surface,
    '--app-surface-soft': publicTheme.surfaceSoft,
    '--app-surface-elevated': publicTheme.surfaceElevated,
    '--app-panel': publicTheme.panel,
    '--app-panel-strong': publicTheme.panelStrong,
    '--app-border': publicTheme.border,
    '--app-text': publicTheme.text,
    '--app-text-secondary': publicTheme.textSecondary,
    '--app-muted': publicTheme.muted,
    '--theme-accent': publicTheme.accent,
    '--theme-accent-contrast': publicTheme.accentContrast,
    '--theme-link': publicTheme.link,
    '--theme-logo-bg': previewTheme.colors.logoBg,
    '--theme-logo-text': previewTheme.colors.logoText,
    '--theme-shell-shadow': publicTheme.shellShadow,
    '--theme-surface-shadow': publicTheme.surfaceShadow,
    '--theme-hero-overlay': publicTheme.heroOverlay,
    '--theme-menu-btn-bg': publicTheme.menuButtonBg,
    '--theme-menu-btn-text': publicTheme.menuButtonText,
    '--theme-branch-pill-bg': publicTheme.branchPillBg,
    '--theme-branch-pill-text': publicTheme.branchPillText,
    '--theme-topbar-bg': publicTheme.topbarBg,
    '--theme-menu-popup-bg': publicTheme.menuPopupBg,
    '--theme-bottom-nav-bg': publicTheme.bottomNavBg,
    '--theme-bottom-nav-text': publicTheme.bottomNavText,
    '--theme-count-bg': publicTheme.countBg,
    '--theme-count-text': publicTheme.countText,
    '--theme-account-box-text': publicTheme.accountBoxText,
    '--theme-account-box-subtle': publicTheme.accountBoxSubtle,
    '--theme-placeholder': publicTheme.placeholder,
    '--theme-subdued-button-text': publicTheme.subduedButtonText,
    '--theme-logo-placeholder-text': publicTheme.logoPlaceholderText
  }

  const openHome = () => {
    setView('home')
    setCategoryMode('grid')
    setActiveCategoryId('')
    setSelectedProduct(null)
    setMenuOpen(false)
  }

  const chooseCategory = (categoryId) => {
    setActiveCategoryId(String(categoryId))
    setCategoryMode('tabs')
    setView('home')
  }

  const addToCart = (product, quantity = 1, options = {}) => {
    const requestedQty = Math.max(1, Math.floor(Number(quantity || 0)))
    const availableStock = getProductAvailableStock(product)
    const currentItem = cart.find((item) => String(item.productId) === String(product.id))
    const currentQty = Number(currentItem?.quantity || 0)
    if (product?.stockTrackingEnabled === true && availableStock < requestedQty) {
      if (options?.silent !== true) toast.error(`${product.name || 'Ürün'} stokta yok`)
      return false
    }
    if (product?.stockTrackingEnabled === true && (currentQty + requestedQty) > availableStock) {
      if (options?.silent !== true) toast.error(`${product.name || 'Ürün'} için yeterli stok yok`)
      return false
    }
    setCart((current) => {
      const index = current.findIndex((item) => String(item.productId) === String(product.id))
      if (index === -1) {
        return current.concat([{
          productId: String(product.id),
          branchId: String(product.branchId || ''),
          productName: String(product.name || ''),
          categoryName: String(product.categoryName || ''),
          imageUrl: String(product.imageUrl || ''),
          quantity: requestedQty,
          unitPrice: Number(product.price || 0),
          totalPrice: Number((Number(product.price || 0) * requestedQty).toFixed(2)),
          note: ''
        }])
      }

      return current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const nextQty = Number(item.quantity || 0) + requestedQty
        return { ...item, quantity: nextQty, totalPrice: Number((Number(item.unitPrice || 0) * nextQty).toFixed(2)) }
      })
    })
    if (options?.silent !== true) toast.success(`${product.name || 'Ürün'} sepete eklendi`, { duration: 1800 })
    return true
  }

  const updateCartQuantity = (productId, delta) => {
    setCart((current) => current
      .map((item) => {
        if (String(item.productId) !== String(productId)) return item
        const product = productById.get(String(productId))
        const nextQty = Number(item.quantity || 0) + delta
        if (delta > 0 && product?.stockTrackingEnabled === true && nextQty > getProductAvailableStock(product)) {
          return item
        }
        return { ...item, quantity: nextQty, totalPrice: Number((Number(item.unitPrice || 0) * nextQty).toFixed(2)) }
      })
      .filter((item) => Number(item.quantity || 0) > 0))
  }

  const removeCartItem = (productId) => {
    setCart((current) => current.filter((item) => String(item.productId) !== String(productId)))
    toast.success('Ürün sepetten kaldırıldı', { duration: 1500 })
  }

  const persistFavorites = async (nextIds) => {
    setFavoriteIds(nextIds)
    if (!customerSession?.customerId || !tenantId) return
    await api('/api/public/qr-customer/favorites', {
      method: 'PUT',
      body: JSON.stringify({
        tenantId,
        customerId: customerSession.customerId,
        favoriteProductIds: nextIds
      }),
      silent: true,
      portalOverride: 'restaurant',
      skipBranchHeader: true,
      suppressAuthRedirect: true
    })
  }

  const toggleFavorite = async (product) => {
    const id = String(product.id)
    const exists = favoriteIds.includes(id)
    const nextIds = exists ? favoriteIds.filter((item) => item !== id) : favoriteIds.concat(id)
    await persistFavorites(nextIds)
    toast.success(exists ? `${product.name} favorilerden çıkarıldı` : `${product.name} favorilere eklendi`, { duration: 1800 })
  }

  const applyCustomerSession = async (customer, fallback = {}) => {
    const session = {
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      location: customer.location || fallback.location || '',
      address: customer.address || fallback.address || ''
    }
    setCustomerSession(session)
    await loadCustomerProfile(session)
    setView('account')
  }

  const submitLogin = async () => {
    if (!tenantId) return
    if (!normalizePhone(loginForm.phone) || !safeText(loginForm.password)) {
      toast.error('Telefon ve şifre zorunlu')
      return
    }

    const response = await api('/api/public/qr-customer/login', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        phone: loginForm.phone,
        password: loginForm.password
      }),
      silent: true,
      portalOverride: 'restaurant',
      skipBranchHeader: true,
      suppressAuthRedirect: true
    })

    if (!response?.success || !response?.customer) {
        toast.error(response?.message || 'Giriş yapılamadı')
        return
      }

      await applyCustomerSession(response.customer)
      setLoginForm(LOGIN_FORM)
      toast.success('Hesabınıza giriş yapıldı')
  }

  const submitRegister = async () => {
    if (!tenantId) return
    if (!safeText(registerForm.name) || !normalizePhone(registerForm.phone) || !safeText(registerForm.password) || !safeText(registerForm.passwordRepeat)) {
      toast.error('Ad soyad, telefon, şifre ve şifre tekrar zorunlu')
      return
    }
    if (String(registerForm.password) !== String(registerForm.passwordRepeat)) {
      toast.error('Şifreler aynı değil')
      return
    }

    const response = await api('/api/public/qr-customer/register', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        name: registerForm.name,
        phone: registerForm.phone,
        password: registerForm.password,
        passwordRepeat: registerForm.passwordRepeat,
        location: registerForm.location,
        address: registerForm.address
      }),
      silent: true,
      portalOverride: 'restaurant',
      skipBranchHeader: true,
      suppressAuthRedirect: true
    })

    if (!response?.success || !response?.customer) {
      toast.error(response?.message || 'Hesap oluşturulamadı')
      return
    }

    await applyCustomerSession(response.customer, { location: registerForm.location, address: registerForm.address })
    setRegisterForm(REGISTER_FORM)
    setAccountMode('login')
    toast.success('Hesap açıldı ve carilere kaydedildi')
  }

  const logoutAccount = () => {
    setCustomerSession(null)
    setCustomerProfile(null)
    setProfileForm(PROFILE_FORM)
    setProfileEditing(false)
    setExpandedOrderId('')
    setLoginForm(LOGIN_FORM)
    try { localStorage.removeItem(sessionStorageKey) } catch {}
    toast.success('Müşteri oturumu kapatıldı')
  }

  const submitProfileUpdate = async () => {
    if (!tenantId || !customerSession?.customerId) return
    if (!safeText(profileForm.name) || !normalizePhone(profileForm.phone)) {
      toast.error('Ad soyad ve telefon zorunlu')
      return
    }

    setProfileSaving(true)
    const response = await api('/api/public/qr-customer/profile', {
      method: 'PUT',
      body: JSON.stringify({
        tenantId,
        customerId: customerSession.customerId,
        name: profileForm.name,
        phone: profileForm.phone,
        location: profileForm.location,
        address: profileForm.address
      }),
      silent: true,
      portalOverride: 'restaurant',
      skipBranchHeader: true,
      suppressAuthRedirect: true
    })
    setProfileSaving(false)

    if (!response?.success || !response?.customer) {
      toast.error(response?.message || 'Hesap güncellenemedi')
      return
    }

    const nextSession = {
      customerId: customerSession.customerId,
      name: response.customer.name,
      phone: response.customer.phone,
      location: response.customer.location || response.customer.note || '',
      address: response.customer.address || ''
    }
    setCustomerSession(nextSession)
    setCustomerProfile((current) => current ? {
      ...current,
      customer: {
        ...(current.customer || {}),
        ...response.customer,
        balance: current.customer?.balance ?? response.customer.balance ?? 0
      }
    } : current)
    setProfileForm({
      name: nextSession.name,
      phone: nextSession.phone,
      location: nextSession.location,
      address: nextSession.address
    })
    setProfileEditing(false)
    toast.success(TEXT.profileSaved)
  }

  const repeatPastOrder = (order) => {
    const items = Array.isArray(order?.items) ? order.items : []
    if (items.length === 0) {
      toast.error(TEXT.repeatNoItems)
      return
    }

    const available = []
    const unavailable = []
    for (const item of items) {
      const product = productById.get(String(item.productId || ''))
      const requestedQty = Math.max(1, Math.floor(Number(item.quantity || 0)))
      if (!product) {
        unavailable.push(String(item.productName || 'Ürün'))
        continue
      }
      if (product.stockTrackingEnabled === true && Number(product.stockQty || 0) < requestedQty) {
        unavailable.push(String(item.productName || product.name || 'Ürün'))
        continue
      }
      available.push({ product, quantity: requestedQty })
    }

    if (available.length === 0) {
      toast.error(TEXT.repeatNoItems)
      if (unavailable.length > 0) toast.error(`${TEXT.repeatUnavailable}: ${unavailable.join(', ')}`, { duration: 3500 })
      return
    }

    for (const entry of available) addToCart(entry.product, entry.quantity, { silent: true })
    toast.success(TEXT.repeatAdded)
    if (unavailable.length > 0) toast.error(`${TEXT.repeatUnavailable}: ${unavailable.join(', ')}`, { duration: 3500 })
    setView('cart')
  }

  const completeOrder = async () => {
    if (cart.length === 0) {
      toast.error('Sepet boş')
      return
    }
    if (!activeCartBranchId) {
      toast.error('Sepette tek şube ürünleri olmalı')
      return
    }
    if (!customerSession?.customerId && (!safeText(customerForm.name) || !normalizePhone(customerForm.phone))) {
      toast.error('Ad soyad ve telefon zorunlu')
      return
    }

    setSubmitting(true)
    const response = await api('/api/public/qr-orders', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        branchId: activeCartBranchId,
        customerId: customerSession?.customerId || undefined,
        customerName: customerSession?.name || customerForm.name,
        customerPhone: customerSession?.phone || customerForm.phone,
        customerLocation: customerSession?.location || customerForm.location,
        customerAddress: customerSession?.address || customerForm.address,
        customerNote: customerForm.note,
        paymentMethod: customerSession?.customerId ? 'cari' : 'none',
        paymentStatus: customerSession?.customerId ? 'cari' : 'pending',
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          note: item.note
        })),
        subtotal: cartTotal,
        total: cartTotal
      }),
      silent: true,
      portalOverride: 'restaurant',
      skipBranchHeader: true,
      suppressAuthRedirect: true
    })
    setSubmitting(false)

    if (!response?.success || !response?.order) {
      toast.error(response?.message || 'Sipariş oluşturulamadı')
      return
    }

    setSuccessOrder(response.order)
    setCart([])
    setCustomerForm(CUSTOMER_FORM)
    setView('success')
    if (customerSession?.customerId) await loadCustomerProfile(customerSession)
  }

  const startDrag = (event) => {
    const el = categoryScrollRef.current
    if (!el) return
    dragRef.current = {
      isDown: true,
      startX: event.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft
    }
  }

  const moveDrag = (event) => {
    const el = categoryScrollRef.current
    if (!el || !dragRef.current.isDown) return
    event.preventDefault()
    const x = event.pageX - el.offsetLeft
    const walk = (x - dragRef.current.startX) * 1.2
    el.scrollLeft = dragRef.current.scrollLeft - walk
  }

  const stopDrag = () => {
    dragRef.current.isDown = false
  }

  if (loading) return <div className="card">{TEXT.loading}</div>
  if (error || !payload) return <div className="card">{error || TEXT.loadError}</div>

  return (
    <div ref={pageRootRef} className="qr-ref-page" style={pageThemeVars}>
      <style>{`
        .qr-ref-page{
          min-height:100vh;background:
          radial-gradient(circle at top center, color-mix(in srgb, var(--theme-accent, #c68454) 18%, transparent), transparent 24%),
          radial-gradient(circle at 50% 62%, color-mix(in srgb, var(--theme-accent, #c68454) 26%, transparent), transparent 34%),
          linear-gradient(180deg,var(--app-bg, #221d1a) 0%,color-mix(in srgb, var(--app-bg, #221d1a) 82%, black) 100%);
          padding:0;color:var(--app-text, #fff)}
        .qr-ref-shell{position:relative;width:min(100%,380px);min-height:100vh;margin:0 auto;background:var(--app-surface, #141c2c);overflow:hidden;box-shadow:var(--theme-shell-shadow, 0 18px 54px rgba(0,0,0,.28))}
        .qr-ref-hero{position:relative;height:214px;padding:34px 14px 24px;display:flex;flex-direction:column;justify-content:space-between;background:var(--app-surface-soft, #1f2937)}
        .qr-ref-hero::before{content:"";position:absolute;inset:0;background-image:url("${coverUrl}");background-size:cover;background-position:center}
        .qr-ref-hero::after{content:"";position:absolute;inset:0;background:var(--theme-hero-overlay, linear-gradient(180deg,rgba(6,10,18,.26) 0%,rgba(8,12,22,.5) 42%,rgba(14,18,32,.92) 100%))}
        .qr-ref-hero-top{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start}
        .qr-ref-logo,.qr-ref-logo--placeholder{width:42px;height:42px;border-radius:14px;object-fit:cover;background:var(--theme-logo-bg, #ffffff);border:3px solid rgba(255,255,255,.95);box-shadow:0 10px 24px rgba(0,0,0,.24)}
        .qr-ref-logo--placeholder{display:grid;place-items:center;font-size:16px;font-weight:900;color:var(--theme-logo-placeholder-text, #fff)}
        .qr-ref-menu-btn{width:42px;height:42px;border:1px solid var(--app-border, rgba(255,255,255,.12));border-radius:14px;background:var(--theme-menu-btn-bg, #fff);color:var(--theme-menu-btn-text, #0f1726);font-size:22px;font-weight:900;box-shadow:0 10px 24px rgba(0,0,0,.18)}
        .qr-ref-brand{position:relative;z-index:1;text-align:center;padding:0 22px 20px;transform:translateY(-10px)}
        .qr-ref-branch-pill{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:7px 14px;border-radius:999px;margin-top:12px;background:var(--theme-branch-pill-bg, rgba(12,16,28,.42));border:1px solid var(--app-border, rgba(255,255,255,.14));color:var(--theme-branch-pill-text, rgba(255,255,255,.92));font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 10px 22px rgba(0,0,0,.18)}
        .qr-ref-brand h1{margin:0;font-size:clamp(28px,8vw,33px);line-height:.94;font-weight:900;fontStyle:italic;letter-spacing:-.05em;text-shadow:0 8px 26px rgba(0,0,0,.3);overflow-wrap:anywhere;color:#ffffff}
        .qr-ref-brand p{margin:10px 0 0;font-size:12px;font-weight:900;letter-spacing:.36em;text-transform:uppercase;color:rgba(255,255,255,.92)}
        .qr-ref-desktop-sidebar,.qr-ref-desktop-topbar{display:none}
        .qr-ref-content{padding:0 8px 96px}
        .qr-ref-search{margin-top:10px;height:48px;border-radius:16px;background:var(--app-surface-elevated, #2b3343);border:1px solid var(--app-border, rgba(255,255,255,.12));display:flex;align-items:center;gap:10px;padding:0 14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
        .qr-ref-search span{font-size:16px;color:var(--app-muted, #8ea0bb)}
        .qr-ref-search input{width:100%;border:0;outline:0;background:transparent;color:var(--app-text, #e5e7eb);font:inherit;font-size:15px}
        .qr-ref-search input::placeholder{color:var(--theme-placeholder, var(--app-muted, #98a5b9))}
        .qr-ref-section-title{display:flex;justify-content:space-between;align-items:center;margin:18px 0 12px}
        .qr-ref-section-title h2{margin:0;font-size:13px;font-weight:900;color:var(--app-text, #fff)}
        .qr-ref-link{border:0;background:none !important;color:var(--theme-link, #ffcb54) !important;font-size:12px;font-weight:700;border-color:transparent !important;box-shadow:none !important}
        .qr-ref-category-grid{display:grid;grid-template-columns:repeat(3,minmax(74px,101px));gap:8px;justify-content:start}
        .qr-ref-category{position:relative;width:100%;aspect-ratio:1 / 1;border:0;border-radius:18px;overflow:hidden;padding:0;background:var(--app-surface-soft, #20293a);color:#fff}
        .qr-ref-category img{width:100%;height:100%;object-fit:cover}
        .qr-ref-category::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.06),rgba(0,0,0,.7))}
        .qr-ref-category-label{position:absolute;left:8px;right:8px;bottom:8px;z-index:2;display:block;width:fit-content;max-width:calc(100% - 16px);padding:4px 0;border-radius:10px;background:transparent;text-align:left;color:#ffffff !important;font-size:11px;font-weight:900 !important;line-height:1.2;letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.48);overflow-wrap:break-word;word-break:normal;backdrop-filter:none;box-shadow:none;border-color:transparent}
        .qr-ref-tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;cursor:grab}
        .qr-ref-tabs::-webkit-scrollbar{display:none}
        .qr-ref-tab{border:0;border-radius:999px;padding:9px 13px;white-space:nowrap;background:var(--app-surface-elevated, #263246) !important;color:var(--app-text-secondary, #d3d8e4) !important;font-size:12px;font-weight:800;border-color:transparent !important;box-shadow:none !important}
        .qr-ref-tab.is-active{background:var(--theme-accent, #ff6a00) !important;color:var(--theme-accent-contrast, #fff) !important}
        .qr-ref-panel{margin-top:12px;background:linear-gradient(180deg,var(--app-panel-strong, #262626),var(--app-panel, #232323));color:var(--app-text, #f8fafc);border:1px solid var(--app-border, rgba(255,255,255,.08));border-radius:22px;padding:14px;display:grid;gap:12px;box-shadow:var(--theme-surface-shadow, 0 22px 40px rgba(0,0,0,.18))}
        .qr-ref-panel h2{margin:0;font-size:22px;font-weight:900;color:var(--app-text, #f8fafc)}
        .qr-ref-muted{margin:0;color:var(--app-muted, #93a4bd);font-size:12px;line-height:1.45}
        .qr-ref-product-grid{display:grid;gap:14px}
        .qr-ref-product{position:relative;display:grid;grid-template-columns:90px minmax(0,1fr);grid-template-areas:"media body" "media side";column-gap:12px;row-gap:10px;padding:13px 14px;border:1px solid var(--app-border, rgba(255,255,255,.08));border-radius:17px;background:linear-gradient(180deg,var(--app-surface-soft, #18243a) 0%,var(--app-surface, #121d32) 100%);box-shadow:var(--theme-surface-shadow, 0 12px 23px rgba(0,0,0,.24));align-items:start}
        .qr-ref-heart{width:17px;height:17px;border:0;border-radius:999px;background:rgba(255,255,255,.06);color:#a5b4cb;font-size:8px;display:grid;place-items:center;flex-shrink:0}
        .qr-ref-heart.is-active{background:#ef4444;color:#fff}
        .qr-ref-product-image-button,.qr-ref-product-copy{border:0;background:none;padding:0;text-align:left;appearance:none;-webkit-appearance:none;box-shadow:none}
        .qr-ref-product-image-button{grid-area:media}
        .qr-ref-product-media{width:90px;height:90px;border-radius:26px;background:linear-gradient(180deg,#ffffff 0%,#f3f5fb 100%);display:grid;place-items:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 9px 18px rgba(7,10,18,.18)}
        .qr-ref-product-body{grid-area:body;display:grid;gap:8px;min-width:0;align-content:start;background:transparent !important;background-color:transparent !important}
        .qr-ref-product-copy{display:grid;gap:6px;width:100%;min-width:0;background:transparent !important;background-color:transparent !important;border-radius:0 !important;box-shadow:none !important;color:inherit;cursor:pointer}
        .qr-ref-product-copy:focus-visible{outline:2px solid color-mix(in srgb, var(--theme-accent, #ff6a00) 72%, white);outline-offset:4px}
        .qr-ref-product-side{grid-area:side;display:grid;gap:8px;min-width:0;align-self:start}
        .qr-ref-product-side-top{display:flex;justify-content:flex-start;align-items:center;gap:8px;flex-wrap:wrap}
        .qr-ref-product-category{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--theme-link, #ffcb54)}
        .qr-ref-product-topline{display:block;min-width:0;background:transparent !important;background-color:transparent !important}
        .qr-ref-product-copy h3{margin:0;font-size:14px;line-height:1.24;font-weight:900;color:var(--app-text, #111111);min-width:0;max-width:none;overflow-wrap:anywhere;word-break:break-word;letter-spacing:-.02em;text-wrap:balance;background:transparent !important;background-color:transparent !important}
        .qr-ref-product-copy p{margin:0;font-size:12px;line-height:1.42;color:var(--app-text-secondary, #525252);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;word-break:break-word;background:transparent !important;background-color:transparent !important}
        .qr-ref-stock-pill{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:fit-content;max-width:100%;padding:7px 12px;border-radius:999px;background:color-mix(in srgb, var(--theme-accent, #ff6a00) 14%, transparent);color:var(--app-text, #f8fafc);font-size:11px;line-height:1.2;font-weight:800;text-align:center;border:1px solid color-mix(in srgb, var(--theme-accent, #ff6a00) 24%, var(--app-border, rgba(255,255,255,.08)))}
        .qr-ref-stock-pill.is-empty{background:rgba(239,68,68,.12);color:#fca5a5;border-color:rgba(239,68,68,.28)}
        .qr-ref-price-pill{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;background:var(--app-surface-elevated, rgba(7,10,18,.96));color:var(--app-text, #fff);font-size:11px;font-weight:900;white-space:nowrap;flex-shrink:0;max-width:100%;border:1px solid var(--app-border, rgba(255,255,255,.08))}
        .qr-ref-product-footer{display:grid;grid-template-columns:minmax(0,1fr);align-items:center;gap:10px}
        .qr-ref-product-actions{display:flex;justify-content:flex-start;align-items:center;gap:10px;flex-wrap:wrap}
        .qr-ref-detail-link{border:0;background:none;padding:0;color:var(--theme-link, #ffcb54);font-size:12px;font-weight:900;justify-self:start;text-align:left}
        .qr-ref-round-cta{min-height:38px;border:0;border-radius:999px;background:linear-gradient(180deg,color-mix(in srgb, var(--theme-accent, #ff6a00) 76%, white), var(--theme-accent, #ff6a00));color:var(--theme-accent-contrast, #fff);font-size:11px;line-height:1;font-weight:900;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;padding:0 14px;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.28)}
        .qr-ref-round-cta:disabled,.qr-ref-primary:disabled,.qr-ref-qty button:disabled{cursor:not-allowed;opacity:.55;box-shadow:none}
        .qr-ref-add-btn{min-width:140px}
        .qr-ref-ghost,.qr-ref-primary,.qr-ref-full{border:0;border-radius:13px;padding:9px 12px;font-size:11px;font-weight:900}
        .qr-ref-ghost{background:var(--app-surface-elevated, #243047);color:var(--app-text, #e2e8f0)}
        .qr-ref-primary,.qr-ref-full{background:var(--theme-accent, #ff6a00);color:var(--theme-accent-contrast, #fff)}
        .qr-ref-full{width:100%;padding:15px 16px;font-size:14px;border-radius:16px}
        .qr-ref-full:disabled{background:#334155;color:#93a4bd}
        .qr-ref-field{display:grid;gap:6px}
        .qr-ref-field input,.qr-ref-field textarea{width:100%;border:1px solid var(--app-border, rgba(255,255,255,.1));border-radius:14px;background:var(--app-surface-elevated, #1d2739);padding:13px 14px;font:inherit;color:var(--app-text, #f8fafc);outline:0}
        .qr-ref-field textarea{min-height:92px;resize:vertical}
        .qr-ref-field input::placeholder,.qr-ref-field textarea::placeholder{color:var(--theme-placeholder, #93a4bd)}
        .qr-ref-empty{padding:18px;border-radius:18px;border:1px dashed var(--app-border, rgba(255,255,255,.14));text-align:center;color:var(--app-text-secondary, #b9a79a);background:var(--app-surface-soft, #26201d)}
        .qr-ref-cart-item{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border-radius:18px;background:var(--app-surface-soft, #26201d);border:1px solid var(--app-border, rgba(255,255,255,.06))}
        .qr-ref-cart-meta h3{margin:0 0 4px;font-size:13px;overflow-wrap:anywhere}
        .qr-ref-cart-meta p{margin:0;color:var(--app-muted, #93a4bd);font-size:12px}
        .qr-ref-cart-meta button{border:0;background:none;padding:0;margin-top:4px;color:#dc2626;font-size:12px;font-weight:900}
        .qr-ref-qty{display:flex;align-items:center;gap:8px}
        .qr-ref-qty button{width:30px;height:30px;border-radius:999px;border:0;background:var(--app-surface-elevated, #243047);color:var(--app-text, #f8fafc);font-weight:900}
        .qr-ref-summary{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
        .qr-ref-summary strong:last-child{font-size:26px;color:var(--theme-link, #ff6a00)}
        .qr-ref-account-box{padding:14px;border-radius:16px;background:color-mix(in srgb, var(--theme-accent, #c68454) 16%, var(--app-surface-soft, #26201d));color:var(--theme-account-box-text, var(--app-text, #f6e6d8));overflow-wrap:anywhere;border:1px solid color-mix(in srgb, var(--theme-accent, #c68454) 26%, var(--app-border, rgba(198,132,84,.2)))}
        .qr-ref-account-box small,.qr-ref-account-box div,.qr-ref-account-box span{color:var(--theme-account-box-subtle, inherit)}
        .qr-ref-contact{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:18px;border:1px solid var(--app-border, rgba(255,255,255,.08));background:var(--app-surface-soft, #26201d);text-decoration:none;color:inherit;overflow-wrap:anywhere}
        .qr-ref-contact-icon{width:40px;height:40px;border-radius:14px;background:var(--app-surface-elevated, #243047);display:grid;place-items:center;flex-shrink:0}
        .qr-ref-order{display:grid;gap:8px;padding:14px;border-radius:18px;border:1px solid var(--app-border, rgba(255,255,255,.08));background:var(--app-surface-soft, #26201d)}
        .qr-ref-order.is-clickable{cursor:pointer}
        .qr-ref-order-detail{display:grid;gap:10px;padding-top:8px;border-top:1px solid color-mix(in srgb, var(--app-border, rgba(255,255,255,.08)) 88%, transparent)}
        .qr-ref-order-items{display:grid;gap:8px}
        .qr-ref-order-item{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:14px;background:color-mix(in srgb, var(--app-surface) 90%, transparent)}
        .qr-ref-order-item.is-unavailable{border:1px solid rgba(239,68,68,.28)}
        .qr-ref-order-row{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
        .qr-ref-badges{display:flex;gap:8px;flex-wrap:wrap}
        .qr-ref-badge{padding:6px 10px;border-radius:999px;background:var(--app-surface-elevated, #243047);color:var(--app-text, #e2e8f0);font-size:11px;font-weight:900}
        .qr-ref-success{text-align:center}
        .qr-ref-success-mark{width:82px;height:82px;margin:0 auto 10px;border-radius:999px;display:grid;place-items:center;background:color-mix(in srgb, var(--theme-accent, #10b981) 18%, white);color:var(--theme-accent, #10b981);font-size:40px;font-weight:900}
        .qr-ref-switch{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:6px;border-radius:16px;background:var(--app-surface-soft, #26201d)}
        .qr-ref-switch button{border:0;border-radius:12px;padding:11px 10px;background:transparent;color:var(--theme-subdued-button-text, #cbd5e1);font-size:12px;font-weight:900}
        .qr-ref-switch button.is-active{background:var(--theme-accent, #ff6a00);color:var(--theme-accent-contrast, #fff)}
        .qr-ref-note{padding:12px 14px;border-radius:14px;background:var(--app-surface-soft, #26201d);color:var(--app-text-secondary, #b9a79a);font-size:12px;line-height:1.5}
        .qr-ref-sheet{position:fixed;inset:0;background:rgba(15,23,42,.56);display:flex;align-items:flex-end;justify-content:center;z-index:90;padding:0}
        .qr-ref-sheet-body{width:min(100%,560px);max-height:92vh;overflow:auto;background:linear-gradient(180deg,var(--app-surface, #131c2d) 0%,var(--app-surface-soft, #172134) 100%);border:1px solid var(--app-border, rgba(255,255,255,.08));border-radius:24px 24px 0 0;padding:16px;color:var(--app-text, #f8fafc)}
        .qr-ref-sheet-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
        .qr-ref-sheet-head h2{margin:0;font-size:22px;font-weight:900;color:var(--app-text, #f8fafc)}
        .qr-ref-sheet-close{width:38px;height:38px;border-radius:999px;border:0;background:var(--app-surface-elevated, #243047);color:var(--app-text, #f8fafc);font-size:18px}
        .qr-ref-sheet-media{width:min(500px,calc(100vw - 48px));height:min(500px,calc(100vw - 48px));aspect-ratio:1 / 1;border-radius:22px;overflow:hidden;background:var(--app-surface-elevated, #243047);margin:0 auto}
        .qr-ref-bottom-nav{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,380px);height:70px;background:var(--theme-bottom-nav-bg, rgba(7,10,16,.98));display:grid;grid-template-columns:repeat(5,1fr);align-items:center;padding:0 8px;z-index:80}
        .qr-ref-nav-btn{border:0;background:none;color:var(--theme-bottom-nav-text, #fff);font-size:10px;font-weight:700;display:grid;gap:4px;justify-items:center;opacity:.88}
        .qr-ref-nav-btn.is-active{color:var(--theme-link, #ffcb54)}
        .qr-ref-nav-icon{font-size:18px;line-height:1}
        .qr-ref-center-cart{position:relative;margin-top:-22px;width:58px;height:58px;border-radius:999px;border:4px solid var(--app-surface, #141c2c);background:var(--theme-accent, #ff6a00);color:var(--theme-accent-contrast, #fff);font-size:22px;font-weight:900;overflow:visible}
        .qr-ref-center-count{position:absolute;right:-10px;top:-12px;min-width:24px;height:24px;padding:0 6px;border-radius:999px;background:var(--theme-count-bg, #fff);color:var(--theme-count-text, var(--theme-accent, #ff6a00));display:grid;place-items:center;font-size:11px;font-weight:900;line-height:1;border:2px solid var(--app-surface, #141c2c);box-shadow:0 8px 16px rgba(0,0,0,.22);z-index:2}
        .qr-ref-menu{position:absolute;right:14px;top:84px;z-index:4;width:188px;padding:10px;border-radius:18px;background:var(--theme-menu-popup-bg, rgba(20,28,44,.96));border:1px solid var(--app-border, rgba(255,255,255,.08));box-shadow:0 18px 40px rgba(0,0,0,.32);display:grid;gap:8px}
        .qr-ref-menu button{border:0;border-radius:12px;padding:12px 14px;background:var(--app-surface-soft, #1f2937);color:var(--app-text, #fff);text-align:left;font-size:13px;font-weight:800}
        @media (min-width:900px){
          .qr-ref-page{padding:28px 24px}
          .qr-ref-shell{width:min(1320px,100%);height:calc(100vh - 56px);min-height:calc(100vh - 56px);border-radius:36px;background:linear-gradient(180deg,var(--app-surface, #131c2d) 0%,var(--app-surface-soft, #172134) 100%);display:grid;grid-template-columns:360px minmax(0,1fr);box-shadow:var(--theme-shell-shadow, 0 28px 80px rgba(0,0,0,.34));overflow:hidden}
          .qr-ref-hero,.qr-ref-bottom-nav{display:none}
          .qr-ref-desktop-sidebar{display:grid;grid-template-rows:auto 1fr;gap:18px;padding:22px;background:
            linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,.01)),
            var(--app-surface, #121b2a);border-right:1px solid var(--app-border, rgba(255,255,255,.06));height:100%;min-height:0;overflow:hidden}
          .qr-ref-desktop-hero{position:relative;min-height:280px;padding:20px;border-radius:28px;overflow:hidden;background:var(--app-surface-soft, #1f2937);display:flex;flex-direction:column;justify-content:space-between}
          .qr-ref-desktop-hero::before{content:"";position:absolute;inset:0;background-image:url("${coverUrl}");background-size:cover;background-position:center}
          .qr-ref-desktop-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,9,16,.18) 0%,rgba(7,10,18,.42) 44%,rgba(10,14,24,.92) 100%)}
          .qr-ref-desktop-hero > *{position:relative;z-index:1}
          .qr-ref-desktop-hero-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
          .qr-ref-desktop-hero-status{padding:9px 14px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);font-size:11px;font-weight:900;letter-spacing:.24em;text-transform:uppercase;color:#ffffff}
          .qr-ref-desktop-brand h1{margin:0;font-size:44px;line-height:.94;font-weight:900;font-style:italic;letter-spacing:-.05em;color:#ffffff}
          .qr-ref-desktop-brand p{margin:10px 0 0;font-size:12px;font-weight:900;letter-spacing:.34em;text-transform:uppercase;color:rgba(255,255,255,.88)}
          .qr-ref-desktop-nav{display:grid;gap:10px;align-content:start;min-height:0;overflow-y:auto;padding-right:4px}
          .qr-ref-desktop-nav button{display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:18px;padding:14px 16px;background:var(--app-surface-elevated, #1c273a);color:var(--app-text, #e5e7eb);font-size:14px;font-weight:800;text-align:left}
          .qr-ref-desktop-nav button.is-active{background:var(--theme-accent, #ff6a00);color:var(--theme-accent-contrast, #fff)}
          .qr-ref-desktop-nav-icon{font-size:22px;line-height:1}
          .qr-ref-desktop-nav-count{display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:rgba(255,255,255,.14);font-size:12px;font-weight:900}
          .qr-ref-content{padding:22px 22px 22px;display:grid;grid-template-rows:auto minmax(0,1fr);gap:18px;height:100%;min-height:0;overflow:hidden}
          .qr-ref-search{display:none}
          .qr-ref-desktop-topbar{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:24px;background:var(--theme-topbar-bg, rgba(255,255,255,.05));border:1px solid var(--app-border, rgba(255,255,255,.06))}
          .qr-ref-desktop-search{flex:1;height:54px;border-radius:18px;background:var(--app-surface-elevated, #263246);border:1px solid var(--app-border, rgba(255,255,255,.08));display:flex;align-items:center;gap:12px;padding:0 16px}
          .qr-ref-desktop-search span{font-size:16px;color:var(--app-muted, #8ea0bb)}
          .qr-ref-desktop-search input{width:100%;border:0;outline:0;background:transparent;color:var(--app-text, #e5e7eb);font:inherit;font-size:15px}
          .qr-ref-desktop-search input::placeholder{color:var(--theme-placeholder, var(--app-muted, #8ea0bb))}
          .qr-ref-desktop-topbar-card{display:flex;align-items:center;gap:12px;padding:0 18px;height:54px;border-radius:18px;background:var(--app-surface-elevated, #1b2537);border:1px solid var(--app-border, rgba(255,255,255,.06));color:var(--app-text, #e5e7eb);font-weight:800}
          .qr-ref-panels{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;align-items:start;min-height:0;overflow-y:auto;padding-right:6px}
          .qr-ref-panel{margin-top:0;border-radius:28px;padding:20px}
          .qr-ref-category-grid{grid-template-columns:repeat(auto-fill,minmax(96px,96px));gap:10px}
          .qr-ref-category{aspect-ratio:1 / 1;border-radius:20px}
          .qr-ref-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
          .qr-ref-product{grid-template-columns:88px minmax(0,1fr);grid-template-areas:"media body" "media side";min-height:120px;padding:16px 16px;border-radius:20px;box-shadow:0 13px 27px rgba(0,0,0,.26)}
          .qr-ref-product-media{width:88px;height:88px;border-radius:24px}
          .qr-ref-product-image-button img{width:100%!important;height:100%!important;border-radius:inherit!important}
          .qr-ref-product-body{gap:8px;padding-right:0}
          .qr-ref-product-side{gap:10px;align-self:start}
          .qr-ref-product-side-top{justify-content:flex-start}
          .qr-ref-product-category{font-size:11px}
          .qr-ref-product-topline{display:block}
          .qr-ref-product-copy h3{font-size:18px;line-height:1.18}
          .qr-ref-product-copy p{font-size:12px;line-height:1.5;-webkit-line-clamp:3;max-width:none}
          .qr-ref-price-pill{padding:7px 12px;font-size:12px;min-width:88px;min-height:42px;border-radius:999px}
          .qr-ref-detail-link{font-size:12px}
          .qr-ref-round-cta{min-height:40px;font-size:11px;padding:0 16px}
          .qr-ref-add-btn{min-width:160px}
          .qr-ref-heart{width:40px;height:40px;border-radius:999px;font-size:14px}
          .qr-ref-ghost,.qr-ref-primary{padding:11px 15px;font-size:12px;border-radius:14px}
          .qr-ref-sheet{padding:20px}
          .qr-ref-sheet-body{width:min(760px,100%);border-radius:30px;padding:18px 18px 22px}
          .qr-ref-sheet-head{margin-bottom:14px}
          .qr-ref-sheet-head h2{font-size:22px}
          .qr-ref-sheet-media{width:500px;height:500px;margin:0 auto;aspect-ratio:1 / 1;border-radius:22px}
        }
        @media (min-width:900px) and (max-width:1120px){
          .qr-ref-product-grid{grid-template-columns:1fr}
        }
        @media (min-width:1200px){
          .qr-ref-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
      `}</style>

      <div className="qr-ref-shell">
        <aside className="qr-ref-desktop-sidebar">
          <div className="qr-ref-desktop-hero">
            <div className="qr-ref-desktop-hero-top">
            </div>
            <div className="qr-ref-desktop-brand">
              <h1>{title.split(' ').map((part, index) => <React.Fragment key={`desktop-${part}-${index}`}>{index > 0 ? <br /> : null}{part}</React.Fragment>)}</h1>
            </div>
          </div>

          <div className="qr-ref-desktop-nav">
            <button type="button" className={view === 'home' ? 'is-active' : ''} onClick={openHome}><span>Ana Sayfa</span><span className="qr-ref-desktop-nav-icon">⌂</span></button>
            <button type="button" className={view === 'favorites' ? 'is-active' : ''} onClick={() => setView('favorites')}><span>Favoriler</span><span className="qr-ref-desktop-nav-icon">♡</span></button>
            <button type="button" className={view === 'contact' ? 'is-active' : ''} onClick={() => setView('contact')}><span>İletişim</span><span className="qr-ref-desktop-nav-icon">✉</span></button>
            <button type="button" className={view === 'account' ? 'is-active' : ''} onClick={() => setView('account')}><span>Hesabım</span><span className="qr-ref-desktop-nav-icon">👤</span></button>
            <button type="button" className={view === 'cart' ? 'is-active' : ''} onClick={() => setView('cart')}>
              <span>Sepetim</span>
              <span className="qr-ref-desktop-nav-count">{cartCount}</span>
            </button>
          </div>
        </aside>

        <header className="qr-ref-hero">
          <div className="qr-ref-hero-top">
          </div>
          <div className="qr-ref-brand">
            <h1>{title.split(' ').map((part, index) => <React.Fragment key={`${part}-${index}`}>{index > 0 ? <br /> : null}{part}</React.Fragment>)}</h1>
          </div>
          {menuOpen ? (
            <div className="qr-ref-menu">
              <button type="button" onClick={openHome}>Ana Sayfa</button>
              <button type="button" onClick={() => { setView('favorites'); setMenuOpen(false) }}>Favoriler</button>
              <button type="button" onClick={() => { setView('cart'); setMenuOpen(false) }}>Sepetim</button>
              <button type="button" onClick={() => { setView('contact'); setMenuOpen(false) }}>İletişim</button>
              <button type="button" onClick={() => { setView('account'); setMenuOpen(false) }}>Hesabım</button>
            </div>
          ) : null}
        </header>

        <main className="qr-ref-content">
          <div className="qr-ref-desktop-topbar">
            <div className="qr-ref-desktop-search">
              <span>🔍</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ürün, kategori ara..." />
            </div>
            <div className="qr-ref-desktop-topbar-card">
              <span>{customerSession?.customerId ? customerSession.name : "Misafir M\u00fc\u015fteri"}</span>
            </div>
            <div className="qr-ref-desktop-topbar-card">
              <span>Sepet</span>
              <strong>{cartCount}</strong>
            </div>
          </div>

          {view !== 'success' ? (
            <div className="qr-ref-search">
              <span>🔍</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ürün, kategori ara..." />
            </div>
          ) : null}

          <div className="qr-ref-panels">
          <div>
          {view === 'home' ? (
            <>
              <div className="qr-ref-section-title">
                <h2>Kategoriler</h2>
                {categoryMode === 'tabs'
                  ? <button type="button" className="qr-ref-link" onClick={openHome}>Ana Sayfa</button>
                  : <button type="button" className="qr-ref-link" onClick={() => setCategoryMode('grid')}>Tümünü Gör</button>}
              </div>

              {categoryMode === 'grid' ? (
                <>
                  <div className="qr-ref-category-grid">
                    {visibleCategories.map((category) => (
                      <button key={category.id} type="button" className="qr-ref-category" onClick={() => chooseCategory(category.id)}>
                        <img src={String(category.imageUrl || IMAGE_PLACEHOLDER)} alt={category.name} onError={(event) => { event.currentTarget.src = IMAGE_PLACEHOLDER }} />
                        <span className="qr-ref-category-label">{category.name}</span>
                      </button>
                    ))}
                  </div>
                  {visibleCategories.length === 0 ? <div className="qr-ref-empty" style={{ marginTop: 12 }}>Uygun kategori bulunamadı.</div> : null}
                </>
              ) : (
                <>
                  <div
                    ref={categoryScrollRef}
                    className="qr-ref-tabs"
                    onMouseDown={startDrag}
                    onMouseMove={moveDrag}
                    onMouseUp={stopDrag}
                    onMouseLeave={stopDrag}
                    style={{ marginBottom: 12 }}
                  >
                    {visibleCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className={`qr-ref-tab${String(activeCategoryId) === String(category.id) ? ' is-active' : ''}`}
                        onClick={() => chooseCategory(category.id)}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                  <div className="qr-ref-product-grid">
                    {visibleProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={{ ...product, branchName: branchNameById.get(String(product.branchId || '')) || '' }}
                        favoriteIds={favoriteIds}
                        onToggleFavorite={toggleFavorite}
                        onOpenDetail={setSelectedProduct}
                        onAddToCart={addToCart}
                      />
                    ))}
                  </div>
                  {visibleProducts.length === 0 ? <div className="qr-ref-empty">Bu kategoride ürün bulunamadı.</div> : null}
                </>
              )}
            </>
          ) : null}

          {view === 'favorites' ? (
            <section className="qr-ref-panel">
              <h2>Favoriler</h2>
              <p className="qr-ref-muted">Favori ürünlerinizi buradan hızlıca sepete ekleyebilirsiniz.</p>
              <div className="qr-ref-product-grid">
                {favoriteProducts.map((product) => (
                  <ProductCard key={product.id} product={product} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} onOpenDetail={setSelectedProduct} onAddToCart={addToCart} />
                ))}
              </div>
              {favoriteProducts.length === 0 ? <div className="qr-ref-empty">Henüz favori ürününüz yok.</div> : null}
            </section>
          ) : null}

          {view === 'contact' ? (
            <section className="qr-ref-panel">
              <h2>İletişim</h2>
              <p className="qr-ref-muted">İletişim bilgileri sistem ayarlarından gelir.</p>
              <div className="order-cart-scroll scrollbar-hidden" style={{ display: 'grid', gap: 10 }}>
                {qrPhone ? <a className="qr-ref-contact" href={`tel:${qrPhone}`}><span className="qr-ref-contact-icon">📞</span><div><strong>Telefon</strong><div>{qrPhone}</div></div></a> : null}
                {qrWhatsapp ? <a className="qr-ref-contact" href={`https://wa.me/${qrWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"><span className="qr-ref-contact-icon">💬</span><div><strong>WhatsApp</strong><div>{qrWhatsapp}</div></div></a> : null}
                {qrEmail ? <a className="qr-ref-contact" href={`mailto:${qrEmail}`}><span className="qr-ref-contact-icon">✉</span><div><strong>E-posta</strong><div>{qrEmail}</div></div></a> : null}
                {qrAddress ? <div className="qr-ref-contact"><span className="qr-ref-contact-icon">📍</span><div><strong>Adres</strong><div>{qrAddress}</div></div></div> : null}
                {qrWorkingHours ? <div className="qr-ref-contact"><span className="qr-ref-contact-icon">⏰</span><div><strong>Çalışma Saatleri</strong><div>{qrWorkingHours}</div></div></div> : null}
              </div>
              {!qrPhone && !qrWhatsapp && !qrEmail && !qrAddress && !qrWorkingHours ? <div className="qr-ref-empty">İletişim bilgisi henüz tanımlanmamış.</div> : null}
            </section>
          ) : null}

          {view === 'cart' ? (
            <section className="qr-ref-panel">
              <h2>Sepetim</h2>
              <p className="qr-ref-muted">Sipariş sadece bu ekrandan tamamlanır.</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {cart.map((item) => (
                  <div key={item.productId} className="qr-ref-cart-item">
                    <ProductImage product={item} alt={item.productName} width={64} height={64} style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover' }} />
                    <div className="qr-ref-cart-meta">
                      <h3>{item.productName}</h3>
                      <p>{formatMoney(item.totalPrice)}</p>
                      <div className={`qr-ref-stock-pill${isProductOutOfStock(productById.get(String(item.productId || ''))) ? ' is-empty' : ''}`} style={{ marginTop: 6 }}>
                        {getProductStockLabel(productById.get(String(item.productId || '')))}
                      </div>
                      <button type="button" onClick={() => removeCartItem(item.productId)}>Sil</button>
                    </div>
                    <div className="qr-ref-qty">
                      <button type="button" onClick={() => updateCartQuantity(item.productId, -1)}>−</button>
                      <strong>{item.quantity}</strong>
                      <button
                        type="button"
                        disabled={(() => {
                          const product = productById.get(String(item.productId || ''))
                          return product?.stockTrackingEnabled === true && Number(item.quantity || 0) >= getProductAvailableStock(product)
                        })()}
                        onClick={() => updateCartQuantity(item.productId, 1)}
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>
              {cart.length === 0 ? <div className="qr-ref-empty">Sepetiniz boş.</div> : null}
              <div className="qr-ref-summary">
                <strong>Genel Toplam</strong>
                <strong>{formatMoney(cartTotal)}</strong>
              </div>
              {customerSession?.customerId ? (
                <div className="qr-ref-account-box">
                  <strong>Sipariş kayıtlı hesabınıza bağlanacak</strong>
                  <div>{customerSession.name} • {customerSession.phone}</div>
                  <div>{customerSession.location || customerSession.address || 'Lokasyon hesap bilgisinden alınacak'}</div>
                </div>
              ) : (
                <>
                  <label className="qr-ref-field"><input value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ad Soyad *" /></label>
                  <label className="qr-ref-field"><input value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon *" /></label>
                  <label className="qr-ref-field"><input value={customerForm.location} onChange={(event) => setCustomerForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lokasyon / Sınıf / Masa" /></label>
                  <label className="qr-ref-field"><input value={customerForm.address} onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))} placeholder="Adres" /></label>
                </>
              )}
              <label className="qr-ref-field"><textarea value={customerForm.note} onChange={(event) => setCustomerForm((current) => ({ ...current, note: event.target.value }))} placeholder="Sipariş notu" /></label>
              <button type="button" className="qr-ref-full" disabled={cart.length === 0 || submitting} onClick={completeOrder}>
                {submitting ? 'Sipariş oluşturuluyor...' : 'Siparişi Tamamla'}
              </button>
            </section>
          ) : null}

          {view === 'success' ? (
            <section className="qr-ref-panel qr-ref-success">
              <div className="qr-ref-success-mark">✔</div>
              <h2>Siparişiniz alındı</h2>
              <p className="qr-ref-muted">Sipariş sistemde QR Siparişleri sayfasına düştü.</p>
              <div className="qr-ref-order">
                <div className="qr-ref-order-row"><strong>Sipariş No</strong><strong>{successOrder?.orderNumber}</strong></div>
                <div className="qr-ref-order-row"><strong>Toplam</strong><strong>{formatMoney(successOrder?.total)}</strong></div>
              </div>
              {!customerSession?.customerId ? <button type="button" className="qr-ref-full" onClick={() => setView('account')}>Hesap Aç ve Takip Et</button> : null}
              <button type="button" className="qr-ref-full" onClick={openHome}>Menüye Dön</button>
            </section>
          ) : null}

          {view === 'account' ? (
            <section className="qr-ref-panel">
              <div className="qr-ref-section-title" style={{ marginTop: 0 }}>
                <h2 style={{ color: 'var(--app-text)', fontSize: 22 }}>{"Hesab\u0131m"}</h2>
                {customerSession?.customerId ? <button type="button" className="qr-ref-link" onClick={logoutAccount}>{"\u00c7\u0131k\u0131\u015f"}</button> : null}
              </div>
              {!customerSession?.customerId ? (
                <>
                  <div className="qr-ref-switch">
                    <button type="button" className={accountMode === 'login' ? ' is-active' : ''} onClick={() => setAccountMode('login')}>Mevcut Hesap</button>
                    <button type="button" className={accountMode === 'register' ? ' is-active' : ''} onClick={() => setAccountMode('register')}>{"Yeni Hesap Olu\u015ftur"}</button>
                  </div>
                  {accountMode === 'login' ? (
                    <>
                      <div className="qr-ref-note">{"Mevcut hesapta sadece telefon ve \u015fifre ile giri\u015f yap\u0131l\u0131r. Ba\u015far\u0131l\u0131 giri\u015fte eski QR sipari\u015fleri ve cari bor\u00e7 durumu g\u00f6r\u00fcn\u00fcr."}</div>
                      <label className="qr-ref-field"><input value={loginForm.phone} onChange={(event) => setLoginForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon *" /></label>
                      <label className="qr-ref-field"><input type="password" value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} placeholder={"\u015eifre *"} /></label>
                      <button type="button" className="qr-ref-full" onClick={submitLogin}>{"Giri\u015f Yap"}</button>
                    </>
                  ) : (
                    <>
                      <div className="qr-ref-note">{"Yeni hesapta ad soyad, telefon, \u015fifre ve \u015fifre tekrar zorunludur. Kay\u0131tl\u0131 telefon varsa mevcut hesap ile giri\u015f yap\u0131n."}</div>
                      <label className="qr-ref-field"><input value={registerForm.name} onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ad Soyad *" /></label>
                      <label className="qr-ref-field"><input value={registerForm.phone} onChange={(event) => setRegisterForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon *" /></label>
                      <label className="qr-ref-field"><input type="password" value={registerForm.password} onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))} placeholder={"\u015eifre *"} /></label>
                      <label className="qr-ref-field"><input type="password" value={registerForm.passwordRepeat} onChange={(event) => setRegisterForm((current) => ({ ...current, passwordRepeat: event.target.value }))} placeholder={"\u015eifre Tekrar *"} /></label>
                      <label className="qr-ref-field"><input value={registerForm.location} onChange={(event) => setRegisterForm((current) => ({ ...current, location: event.target.value }))} placeholder={"Lokasyon / S\u0131n\u0131f / B\u00f6l\u00fcm"} /></label>
                      <label className="qr-ref-field"><input value={registerForm.address} onChange={(event) => setRegisterForm((current) => ({ ...current, address: event.target.value }))} placeholder="Adres" /></label>
                      <button type="button" className="qr-ref-full" onClick={submitRegister}>{"Hesap Olu\u015ftur"}</button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="qr-ref-account-box">
                    <strong>{customerSession.name}</strong>
                    <div>{customerSession.phone}</div>
                    <div>{"Bor\u00e7 Durumu:"} {formatMoney(customerProfile?.balance || customerProfile?.customer?.balance || 0)}</div>
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div className="qr-ref-section-title" style={{ marginTop: 0 }}>
                      <strong style={{ color: 'var(--app-text)', fontSize: 18 }}>Hesap Bilgileri</strong>
                      <button
                        type="button"
                        className="qr-ref-link"
                        onClick={() => {
                          if (profileEditing) {
                            setProfileForm({
                              name: customerSession?.name || '',
                              phone: customerSession?.phone || '',
                              location: customerSession?.location || '',
                              address: customerSession?.address || ''
                            })
                          }
                          setProfileEditing((current) => !current)
                        }}
                      >
                        {profileEditing ? 'Vazgeç' : 'Düzenle'}
                      </button>
                    </div>
                    {profileEditing ? (
                      <>
                        <label className="qr-ref-field"><input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ad Soyad *" /></label>
                        <label className="qr-ref-field"><input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon *" /></label>
                        <label className="qr-ref-field"><input value={profileForm.location} onChange={(event) => setProfileForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lokasyon / Sınıf / Bölüm" /></label>
                        <label className="qr-ref-field"><input value={profileForm.address} onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))} placeholder="Adres" /></label>
                        <button type="button" className="qr-ref-full" onClick={submitProfileUpdate} disabled={profileSaving}>
                          {profileSaving ? 'Kaydediliyor...' : 'Bilgileri Kaydet'}
                        </button>
                      </>
                    ) : (
                      <div className="qr-ref-note">
                        <strong>{customerSession.name}</strong><br />
                        {customerSession.phone || '-'}<br />
                        {customerSession.location || 'Lokasyon girilmemiş'}<br />
                        {customerSession.address || 'Adres girilmemiş'}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <strong>{TEXT.pastOrders}</strong>
                    {Array.isArray(customerProfile?.qrOrders) && customerProfile.qrOrders.length > 0 ? customerProfile.qrOrders.map((order) => {
                      const isExpanded = String(expandedOrderId) === String(order.id)
                      const orderItems = Array.isArray(order.items) ? order.items : []
                      return (
                        <div
                          key={order.id}
                          className="qr-ref-order is-clickable"
                          onClick={() => setExpandedOrderId((current) => current === String(order.id) ? '' : String(order.id))}
                        >
                          <div className="qr-ref-order-row"><strong>{order.orderNumber}</strong><strong>{formatMoney(order.total)}</strong></div>
                          <div className="qr-ref-muted">{order.createdAt ? new Date(order.createdAt).toLocaleString('tr-TR') : '-'}</div>
                          <div className="qr-ref-badges">
                            <span className="qr-ref-badge">{translateOrderStatus(order.orderStatus)}</span>
                            <span className="qr-ref-badge">{translatePaymentStatus(order.paymentStatus)}</span>
                          </div>
                          {isExpanded ? (
                            <div className="qr-ref-order-detail" onClick={(event) => event.stopPropagation()}>
                              <div className="qr-ref-summary">
                                <strong>{TEXT.orderStatus}</strong>
                                <span>{translateOrderStatus(order.orderStatus)}</span>
                              </div>
                              <div className="qr-ref-summary">
                                <strong>{TEXT.paymentStatusLabel}</strong>
                                <span>{translatePaymentStatus(order.paymentStatus)}</span>
                              </div>
                              <div style={{ display: 'grid', gap: 8 }}>
                                <strong>{TEXT.orderItems}</strong>
                                <div className="qr-ref-order-items">
                                  {orderItems.map((item, index) => {
                                    const currentProduct = productById.get(String(item.productId || ''))
                                    const requestedQty = Math.max(1, Math.floor(Number(item.quantity || 0)))
                                    const unavailable = !currentProduct || (currentProduct.stockTrackingEnabled === true && Number(currentProduct.stockQty || 0) < requestedQty)
                                    return (
                                      <div key={`${order.id}-${item.productId || index}`} className={`qr-ref-order-item${unavailable ? ' is-unavailable' : ''}`}>
                                        <div style={{ display: 'grid', gap: 4 }}>
                                          <strong>{item.productName || 'Ürün'}</strong>
                                          <div className="qr-ref-muted">{requestedQty} adet{item.note ? ` • ${item.note}` : ''}</div>
                                        </div>
                                        <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                                          <strong>{formatMoney(item.totalPrice)}</strong>
                                          {unavailable ? <span className="qr-ref-badge">{TEXT.unavailableTag}</span> : null}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                              <button type="button" className="qr-ref-full" onClick={() => repeatPastOrder(order)}>{TEXT.repeatOrder}</button>
                            </div>
                          ) : null}
                        </div>
                      )
                    }) : <div className="qr-ref-empty">{"Eski QR sipari\u015fi bulunamad\u0131."}</div>}
                  </div>
                </>
              )}
            </section>
          ) : null}
          </div>
          </div>
        </main>

        {selectedProduct ? (
          <div className="qr-ref-sheet">
            <div className="qr-ref-sheet-body">
              <div className="qr-ref-sheet-head">
                <h2>Ürün Detayı</h2>
                <button type="button" className="qr-ref-sheet-close" onClick={() => setSelectedProduct(null)}>×</button>
              </div>
              <div className="qr-ref-sheet-media">
                <ProductImage product={selectedProduct} alt={selectedProduct.name} width={500} height={500} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                <div className="qr-ref-product-category">{selectedProduct.categoryName || 'Diğer Ürünler'}</div>
                <h3 style={{ margin: 0, color: 'var(--app-text)', fontSize: 22, fontWeight: 900 }}>{selectedProduct.name}</h3>
                <p className="qr-ref-muted">{safeText(selectedProduct.description, 'Açıklama bulunmuyor.')}</p>
                <div className="qr-ref-summary">
                  <strong>{selectedProduct.branchName || 'Mağaza Ürünü'}</strong>
                  <strong>{formatMoney(selectedProduct.price)}</strong>
                </div>
                <div className={`qr-ref-stock-pill${isProductOutOfStock(selectedProduct) ? ' is-empty' : ''}`}>{getProductStockLabel(selectedProduct)}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="qr-ref-ghost" onClick={() => toggleFavorite(selectedProduct)}>
                    {favoriteIds.includes(String(selectedProduct.id)) ? 'Favorilerden Çıkar' : 'Favoriye Ekle'}
                  </button>
                  <button
                    type="button"
                    className="qr-ref-primary"
                    disabled={isProductOutOfStock(selectedProduct)}
                    onClick={() => {
                      const added = addToCart(selectedProduct)
                      if (added) setSelectedProduct(null)
                    }}
                  >
                    {isProductOutOfStock(selectedProduct) ? 'Stokta Yok' : 'Sepete Ekle'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <nav className="qr-ref-bottom-nav">
          <button type="button" className={`qr-ref-nav-btn${view === 'home' ? ' is-active' : ''}`} onClick={openHome}><span className="qr-ref-nav-icon">⌂</span><span>Ana Sayfa</span></button>
          <button type="button" className={`qr-ref-nav-btn${view === 'favorites' ? ' is-active' : ''}`} onClick={() => setView('favorites')}><span className="qr-ref-nav-icon">♡</span><span>Favoriler</span></button>
          <button type="button" className="qr-ref-center-cart" onClick={() => setView('cart')}>
            🛒
            {cartCount > 0 ? <span className="qr-ref-center-count">{cartCount}</span> : null}
          </button>
          <button type="button" className={`qr-ref-nav-btn${view === 'contact' ? ' is-active' : ''}`} onClick={() => setView('contact')}><span className="qr-ref-nav-icon">✉</span><span>İletişim</span></button>
          <button type="button" className={`qr-ref-nav-btn${view === 'account' ? ' is-active' : ''}`} onClick={() => setView('account')}><span className="qr-ref-nav-icon">👤</span><span>Hesabım</span></button>
        </nav>
      </div>
    </div>
  )
}
