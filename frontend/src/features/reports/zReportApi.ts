import { api } from '../../lib/apiClient.js'

export type ZReportVatRow = {
  rate: number
  amount: number
  vat: number
}

export type ZReportPaymentBreakdownRow = {
  methodId: string
  methodName: string
  methodType: string
  totalAmount: number
  count: number
}

export type ZReportCollectionBreakdownRow = {
  methodId: string
  methodName: string
  totalAmount: number
  count: number
}

export type ZReportSummary = {
  orderCount: number
  productCount: number
  grossSales: number
  discountTotal: number
  cancelTotal: number
  netSales: number
  payments: {
    cash: number
    card: number
    mealCard: number
    online: number
    credit: number
  }
  paymentBreakdown?: ZReportPaymentBreakdownRow[]
  collectionsTotal?: number
  collectionBreakdown?: ZReportCollectionBreakdownRow[]
  salesChannels: {
    qr: number
    cashier: number
  }
  vatBreakdown: ZReportVatRow[]
}

export type ZReportTopProduct = {
  name: string
  quantity: number
  total: number
}

export type ZReportStaffTotal = {
  staffName: string
  orderCount: number
  total: number
}

export type ZReportBranchTotal = {
  branchName: string
  orderCount: number
  netSales: number
}

export type ZReportThermalVariant = {
  paperWidth: number
  text: string
  raw: string
}

export type ZReportThermalPayload = {
  encoding: string
  font: string
  align: string
  variants: {
    chars48: ZReportThermalVariant
    chars32: ZReportThermalVariant
  }
}

export type ZReportData = {
  date: string
  branchId: string
  branchName: string
  businessName: string
  generatedAt: string
  summary: ZReportSummary
  topProducts: ZReportTopProduct[]
  staffTotals: ZReportStaffTotal[]
  branchTotals: ZReportBranchTotal[]
  thermal?: ZReportThermalPayload
}

export async function fetchZReport(date: string, branchId: string) {
  const params = new URLSearchParams()
  params.set('date', String(date || '').trim())
  params.set('branchId', String(branchId || '').trim() || 'all')

  const res = await api(`/api/reports/z-report?${params.toString()}`, {
    silent: true,
    skipBranchHeader: true,
    suppressBranchModal: true
  })

  if (!res?.ok) {
    throw new Error(String(res?.message || 'Z raporu alınamadı'))
  }

  return res as ZReportData & { ok: true }
}
