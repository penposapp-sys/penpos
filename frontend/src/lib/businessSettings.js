export const defaultBusinessSettings = {
  business: {
    businessName: '',
    companyName: '',
    authorizedName: '',
    closingTime: '',
    serviceFee: 0,
    serviceFeeText: '',
  },
  logo: {
    url: '',
    fileName: '',
    mimeType: '',
    size: 0,
  },
  general: {
    disableCreditAccounts: false,
    saveCancelledOrders: true,
    hideTodoList: false,
    staffCannotOrderForOthers: false,
    requireCancelReasonForProduct: false,
    askGuestCountWhenOpeningTable: false,
    trackCashInDrawer: false,
  },
  notifications: {
    language: 'tr',
    accountPaymentSound: 'MONEY',
    orderSound: 'none',
    packageServiceSound: 'BEEPS',
    qrMenuOrderSound: 'none',
    repeatPackageServiceAlert: false,
    voiceAlertsEnabled: false,
  },
  authorizedBranches: {
    branchIds: [],
  },
  appearance: {
    fontSize: 'medium',
    darkMode: false,
    colorfulProducts: false,
    animationsEnabled: true,
    themeId: 'default',
  },
  order: {
    confirmBeforeAddingToCart: false,
    returnToOpenTablesAfterOrder: false,
    addToCartWithoutOptionQuestion: false,
    askGuestCountInQuickOrder: true,
  },
  automation: {
    autoClosePackageOrdersAfterPayment: false,
    autoCloseUnpaidPackageOrders: false,
    autoClosePaidTables: false,
  },
  catalogView: {
    categoryViewMode: 'card',
    productViewMode: 'grid',
    categorySortMode: 'manual',
    productSortMode: 'category',
    manualCategorySort: true,
    sortProductsInsideCategory: true,
    moveOutOfStockToEnd: false,
    hidePassiveProducts: true,
    showCategoryHeaders: true,
    showLargePrice: true,
    showProductImage: false,
    showProductDescription: false,
  },
  qrMenu: {
    enabled: true,
    showLogo: true,
    showCoverImage: true,
    showPrices: true,
    showDescriptions: true,
    themeMode: 'light',
    waiterCall: false,
    multiLanguage: false,
    tableQrEnabled: false,
  },
}

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

const sanitizeBranchIds = (input, fallback = []) => {
  const raw = Array.isArray(input) ? input : Array.isArray(fallback) ? fallback : []
  return Array.from(new Set(raw.map((value) => String(value || '').trim()).filter(Boolean)))
}

const withLegacyAliases = (settings) => {
  const next = {
    ...settings,
    general: { ...(settings?.general || {}) },
    notifications: { ...(settings?.notifications || {}) },
    appearance: { ...(settings?.appearance || {}) },
    order: { ...(settings?.order || {}) },
    automation: { ...(settings?.automation || {}) },
  }

  next.general.closeCustomerAccounts = next.general.disableCreditAccounts
  next.general.preventStaffOrderingForOthers = next.general.staffCannotOrderForOthers
  next.general.requireCancelReason = next.general.requireCancelReasonForProduct
  next.general.askGuestCountOnTableOpen = next.general.askGuestCountWhenOpeningTable
  next.general.trackCashDrawer = next.general.trackCashInDrawer
  next.general.companyName = next.business.companyName
  next.general.authorizedName = next.business.authorizedName
  next.general.closingTime = next.business.closingTime
  next.general.serviceFee = next.business.serviceFee
  next.general.serviceFeeLabel = next.business.serviceFeeText

  next.notifications.paymentSound = next.notifications.accountPaymentSound
  next.notifications.deliverySound = next.notifications.packageServiceSound
  next.notifications.qrOrderSound = next.notifications.qrMenuOrderSound
  next.notifications.loopDeliverySound = next.notifications.repeatPackageServiceAlert
  next.notifications.voiceWarnings = next.notifications.voiceAlertsEnabled

  next.appearance.animations = next.appearance.animationsEnabled
  next.appearance.themeName = next.appearance.themeId

  next.order.confirmBeforeAddToCart = next.order.confirmBeforeAddingToCart
  next.order.returnToOpenTablesAfterConfirm = next.order.returnToOpenTablesAfterOrder
  next.order.addWithoutAskingOptions = next.order.addToCartWithoutOptionQuestion
  next.order.askPersonCountOnQuickOrder = next.order.askGuestCountInQuickOrder

  next.automation.autoCloseDeliveryAfterPayment = next.automation.autoClosePackageOrdersAfterPayment
  next.automation.autoCloseUnpaidPackageOrders = next.automation.autoClosePackageOrdersAfterPayment
  next.automation.autoCloseTablesAfterPayment = next.automation.autoClosePaidTables

  next.qrMenuEnabled = next.qrMenu?.enabled === true
  return next
}

export function mergeBusinessSettings(existingSettings = {}) {
  const safeExisting = isPlainObject(existingSettings) ? existingSettings : {}
  const general = isPlainObject(safeExisting.general) ? safeExisting.general : {}
  const notifications = isPlainObject(safeExisting.notifications) ? safeExisting.notifications : {}
  const appearance = isPlainObject(safeExisting.appearance) ? safeExisting.appearance : {}
  const order = isPlainObject(safeExisting.order) ? safeExisting.order : {}
  const automation = isPlainObject(safeExisting.automation) ? safeExisting.automation : {}
  const business = isPlainObject(safeExisting.business) ? safeExisting.business : {}
  const authorizedBranches = isPlainObject(safeExisting.authorizedBranches) ? safeExisting.authorizedBranches : {}

  const merged = {
    ...defaultBusinessSettings,
    ...safeExisting,
    business: {
      ...defaultBusinessSettings.business,
      ...business,
      companyName: business.companyName ?? general.companyName ?? defaultBusinessSettings.business.companyName,
      authorizedName: business.authorizedName ?? general.authorizedName ?? defaultBusinessSettings.business.authorizedName,
      closingTime: business.closingTime ?? general.closingTime ?? defaultBusinessSettings.business.closingTime,
      serviceFee: business.serviceFee ?? general.serviceFee ?? defaultBusinessSettings.business.serviceFee,
      serviceFeeText: business.serviceFeeText ?? general.serviceFeeText ?? general.serviceFeeLabel ?? defaultBusinessSettings.business.serviceFeeText,
    },
    logo: {
      ...defaultBusinessSettings.logo,
      ...(isPlainObject(safeExisting.logo) ? safeExisting.logo : {}),
    },
    general: {
      ...defaultBusinessSettings.general,
      ...general,
      disableCreditAccounts: general.disableCreditAccounts ?? general.closeCustomerAccounts ?? defaultBusinessSettings.general.disableCreditAccounts,
      staffCannotOrderForOthers: general.staffCannotOrderForOthers ?? general.preventStaffOrderingForOthers ?? defaultBusinessSettings.general.staffCannotOrderForOthers,
      requireCancelReasonForProduct: general.requireCancelReasonForProduct ?? general.requireCancelReason ?? defaultBusinessSettings.general.requireCancelReasonForProduct,
      askGuestCountWhenOpeningTable: general.askGuestCountWhenOpeningTable ?? general.askGuestCountOnTableOpen ?? defaultBusinessSettings.general.askGuestCountWhenOpeningTable,
      trackCashInDrawer: general.trackCashInDrawer ?? general.trackCashDrawer ?? defaultBusinessSettings.general.trackCashInDrawer,
    },
    notifications: {
      ...defaultBusinessSettings.notifications,
      ...notifications,
      accountPaymentSound: notifications.accountPaymentSound ?? notifications.paymentSound ?? defaultBusinessSettings.notifications.accountPaymentSound,
      packageServiceSound: notifications.packageServiceSound ?? notifications.deliverySound ?? defaultBusinessSettings.notifications.packageServiceSound,
      qrMenuOrderSound: notifications.qrMenuOrderSound ?? notifications.qrOrderSound ?? defaultBusinessSettings.notifications.qrMenuOrderSound,
      repeatPackageServiceAlert: notifications.repeatPackageServiceAlert ?? notifications.loopDeliverySound ?? defaultBusinessSettings.notifications.repeatPackageServiceAlert,
      voiceAlertsEnabled: notifications.voiceAlertsEnabled ?? notifications.voiceWarnings ?? defaultBusinessSettings.notifications.voiceAlertsEnabled,
    },
    authorizedBranches: {
      branchIds: sanitizeBranchIds(authorizedBranches.branchIds, safeExisting.allowedBranchIds),
    },
    appearance: {
      ...defaultBusinessSettings.appearance,
      ...appearance,
      animationsEnabled: appearance.animationsEnabled ?? appearance.animations ?? defaultBusinessSettings.appearance.animationsEnabled,
      themeId: appearance.themeId ?? appearance.themeName ?? defaultBusinessSettings.appearance.themeId,
    },
    order: {
      ...defaultBusinessSettings.order,
      ...order,
      confirmBeforeAddingToCart: order.confirmBeforeAddingToCart ?? order.confirmBeforeAddToCart ?? defaultBusinessSettings.order.confirmBeforeAddingToCart,
      returnToOpenTablesAfterOrder: order.returnToOpenTablesAfterOrder ?? order.returnToOpenTablesAfterConfirm ?? defaultBusinessSettings.order.returnToOpenTablesAfterOrder,
      addToCartWithoutOptionQuestion: order.addToCartWithoutOptionQuestion ?? order.addWithoutAskingOptions ?? defaultBusinessSettings.order.addToCartWithoutOptionQuestion,
      askGuestCountInQuickOrder: order.askGuestCountInQuickOrder ?? order.askPersonCountOnQuickOrder ?? defaultBusinessSettings.order.askGuestCountInQuickOrder,
    },
    automation: {
      ...defaultBusinessSettings.automation,
      ...automation,
      autoClosePackageOrdersAfterPayment:
        automation.autoClosePackageOrdersAfterPayment ??
        automation.autoCloseUnpaidPackageOrders ??
        automation.autoCloseDeliveryAfterPayment ??
        defaultBusinessSettings.automation.autoClosePackageOrdersAfterPayment,
      autoClosePaidTables: automation.autoClosePaidTables ?? automation.autoCloseTablesAfterPayment ?? defaultBusinessSettings.automation.autoClosePaidTables,
    },
    catalogView: {
      ...defaultBusinessSettings.catalogView,
      ...(isPlainObject(safeExisting.catalogView) ? safeExisting.catalogView : {}),
    },
    qrMenu: {
      ...defaultBusinessSettings.qrMenu,
      ...(isPlainObject(safeExisting.qrMenu) ? safeExisting.qrMenu : {}),
      enabled:
        typeof safeExisting.qrMenu?.enabled === 'boolean'
          ? safeExisting.qrMenu.enabled
          : typeof safeExisting.qrMenuEnabled === 'boolean'
            ? safeExisting.qrMenuEnabled
            : defaultBusinessSettings.qrMenu.enabled,
    },
  }

  if (!merged.logo.url && typeof safeExisting.logoUrl === 'string') {
    merged.logo.url = String(safeExisting.logoUrl || '').trim()
  }

  return withLegacyAliases(merged)
}

export function buildSafeBusinessSettings(currentSettings = {}, form = {}) {
  const mergedCurrent = mergeBusinessSettings(currentSettings)
  const safeForm = isPlainObject(form) ? form : {}
  return mergeBusinessSettings({
    ...mergedCurrent,
    ...safeForm,
    business: {
      ...mergedCurrent.business,
      ...(safeForm.business || {}),
    },
    logo: {
      ...mergedCurrent.logo,
      ...(safeForm.logo || {}),
    },
    general: {
      ...mergedCurrent.general,
      ...(safeForm.general || {}),
    },
    notifications: {
      ...mergedCurrent.notifications,
      ...(safeForm.notifications || {}),
    },
    authorizedBranches: {
      branchIds: sanitizeBranchIds(
        safeForm.authorizedBranches?.branchIds,
        mergedCurrent.authorizedBranches?.branchIds
      ),
    },
    appearance: {
      ...mergedCurrent.appearance,
      ...(safeForm.appearance || {}),
    },
    order: {
      ...mergedCurrent.order,
      ...(safeForm.order || {}),
    },
    automation: {
      ...mergedCurrent.automation,
      ...(safeForm.automation || {}),
    },
    catalogView: {
      ...mergedCurrent.catalogView,
      ...(safeForm.catalogView || {}),
    },
    qrMenu: {
      ...mergedCurrent.qrMenu,
      ...(safeForm.qrMenu || {}),
    },
  })
}
