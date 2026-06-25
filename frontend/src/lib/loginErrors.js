const readErrorCode = (error) => {
  const raw =
    error?.code ||
    error?.response?.data?.code ||
    error?.response?.data?.error ||
    error?.message ||
    ''
  return String(raw || '').trim()
}

const readErrorStatus = (error) => {
  const raw = error?.response?.status ?? error?.status ?? 0
  const status = Number(raw)
  return Number.isFinite(status) ? status : 0
}

export const getFriendlyLoginError = (error, options = {}) => {
  const code = readErrorCode(error)
  const status = readErrorStatus(error)

  if (code === 'account_disabled') {
    return options.accountDisabledMessage || 'Hesabiniz devre disi. Lutfen yetkilinizle iletisime gecin.'
  }

  if (code === 'wrong_portal') {
    return options.wrongPortalMessage || 'Bu hesap bu giris ekrani icin uygun degil.'
  }

  if (code === 'tenant_inactive') {
    return 'Isletme hesabi aktif degil. Lutfen yetkilinizle iletisime gecin.'
  }

  if (code === 'network_error' || status === 0) {
    return options.networkMessage || 'Sunucuya ulasilamadi. Ayni Wi-Fi, backend 4000 portu ve Windows guvenlik duvarini kontrol edin.'
  }

  if (status === 429) {
    return 'Cok fazla giris denemesi yapildi. Lutfen 1 dakika bekleyip tekrar deneyin.'
  }

  if (code === 'internal_error' || status >= 500) {
    return options.serverMessage || 'Sunucu hatasi olustu. Backend veya MongoDB baglantisini kontrol edin.'
  }

  return options.invalidCredentialsMessage || 'Giris basarisiz. E-posta/kullanici adi veya sifre hatali.'
}
