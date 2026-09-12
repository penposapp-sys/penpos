export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export const DEFAULT_YEAR_START = '2026-09'
export const DEFAULT_PERIODS = ['2023-09', '2024-09', '2025-09', '2026-09', '2027-09', '2028-09']

export function getYearStart(state) {
  const s = state?.settings || {}
  return s.yearStart || s.donem || DEFAULT_YEAR_START
}

export function periodsOfYear(yearStart = DEFAULT_YEAR_START) {
  const a = []
  let y = Number(yearStart.slice(0, 4))
  let m = Number(yearStart.slice(5, 7))
  for (let i = 0; i < 12; i++) {
    a.push(y + '-' + String(m).padStart(2, '0'))
    m++
    if (m > 12) { m = 1; y++ }
  }
  return a
}

export function periodName(p) {
  if (!p) return ''
  const y = p.slice(0, 4)
  const m = Number(p.slice(5, 7))
  return MONTHS[m - 1] + ' ' + y
}

export function addMonths(p, n) {
  let y = Number(p.slice(0, 4))
  let m = Number(p.slice(5, 7))
  m += n
  y += Math.floor((m - 1) / 12)
  m = ((m - 1) % 12) + 1
  return y + '-' + String(m).padStart(2, '0')
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

export function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function money(n) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 2
  }).format(Number(n) || 0)
}

export function trDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR')
}

export function addMonthsToDate(dateStr, n) {
  if (!dateStr) return ''
  let y = Number(dateStr.slice(0, 4))
  let m = Number(dateStr.slice(5, 7)) - 1
  let d = dateStr.length >= 10 ? (Number(dateStr.slice(8, 10)) || 15) : 15

  const dt = new Date(y, m + n, d)
  const targetMonth = (m + n) % 12
  const normalizedTarget = targetMonth < 0 ? targetMonth + 12 : targetMonth
  if (dt.getMonth() !== normalizedTarget) {
    dt.setDate(0)
  }

  const resY = dt.getFullYear()
  const resM = String(dt.getMonth() + 1).padStart(2, '0')
  const resD = String(dt.getDate()).padStart(2, '0')
  return `${resY}-${resM}-${resD}`
}

export function formatTrFullDate(dateStr) {
  if (!dateStr) return '—'
  const clean = dateStr.slice(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) {
    const day = Number(parts[2])
    const monthIdx = Number(parts[1]) - 1
    const year = parts[0]
    return `${day} ${MONTHS[monthIdx] || ''} ${year}`
  }
  return dateStr
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export function getStudent(state, id) {
  return (state?.students || []).find(s => String(s.id || s._id) === String(id))
}

export function itemMonths(it, yearStart = DEFAULT_YEAR_START) {
  const a = []
  const start = it.start || yearStart
  for (let i = 0; i < it.installments; i++) a.push(addMonths(start, i))
  return a
}

export function expectedFor(state, sid, period) {
  const s = getStudent(state, sid)
  if (!s) return 0
  const ys = getYearStart(state)
  let t = 0
  ;(s.items || []).forEach(it => {
    itemMonths(it, ys).forEach(m => {
      if (m === period) {
        t += Number(it.total || 0) / Math.max(1, Number(it.installments) || 1)
      }
    })
  })
  return round2(t)
}

export function expectedTotalFor(state, sid) {
  const s = getStudent(state, sid)
  if (!s) return 0
  return round2((s.items || []).reduce((a, i) => a + i.total, 0))
}

export function collectedFor(state, sid, period) {
  return round2((state?.collections || []).filter(c =>
    (sid == null || String(c.studentId) === String(sid)) &&
    (!period || (c.date || '').slice(0, 7) === period)
  ).reduce((a, c) => a + c.amount, 0))
}

export function collectedAll(state, sid) {
  return collectedFor(state, sid, null)
}

export function balanceFor(state, sid) {
  return round2(expectedTotalFor(state, sid) - collectedAll(state, sid))
}

export function expectedAllActive(state) {
  return round2((state?.students || []).filter(s => s.active).reduce((a, s) => a + expectedTotalFor(state, s.id), 0))
}

export function invoiceFor(state, sid, period) {
  return (state?.invoices || []).find(i => i.period === period && String(i.studentId) === String(sid))
}

export function invStatus(state, sid, period) {
  const exp = expectedFor(state, sid, period)
  const inv = invoiceFor(state, sid, period)
  if (!inv) return exp > 0 ? 'none' : 'na'
  return inv.diff ? 'diff' : 'ok'
}

export function curPeriod(state) {
  const now = new Date()
  const p = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  const ys = getYearStart(state)
  return periodsOfYear(ys).includes(p) ? p : ys
}

export function uuidLike(seed) {
  let h = hash(seed).toString(16).padStart(8, '0')
  const r = () => Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')
  return h + '-4' + r().slice(0, 3) + '-' + r() + '-' + r() + '-' + r() + r() + r()
}

export function makeInvoice(state, s, period, total, forceDiff) {
  const vatRate = Number(state?.settings?.vat || state?.settings?.vergiOrani || 0)
  const base = round2(total / (1 + vatRate / 100))
  const vat = round2(total - base)
  const seq = 100000 + (hash(String(s.id) + 'x' + period) % 899999)
  return {
    uuid: uuidLike(String(s.id) + period),
    no: 'E-' + period.slice(0, 4) + '-' + seq,
    date: period + '-05',
    taxId: s.tax || '',
    buyer: s.parent || '',
    base, vat,
    total: round2(total),
    type: (String(s.tax || '').length === 11 ? 'e-Arşiv' : 'e-Fatura'),
    status: 'Kesildi',
    pdf: true, xml: true,
    period,
    studentId: s.id,
    diff: !!forceDiff
  }
}

// Bir tahsilatın faturalı / KDV'ye tabi olup olmadığını kontrol eder:
// 1. Öğrenci faturalı olmalı (student.invoiced !== false)
// 2. Kalem / plan faturalı olmalı (plan.invoiced !== false ve feeCategory.invoiced !== false)
export function isCollectionInvoiced(state, col, studentObj) {
  const s = studentObj || (col?.studentId ? getStudent(state, col.studentId) : null)
  if (!s || s.invoiced === false) return false

  const itemName = (col?.item || col?.planName || '').trim().toLowerCase()
  if (!itemName) return s.invoiced !== false

  // Öğrenciye atanmış plan kontrolü
  const studentPlan = (s.items || []).find(it => (it.name || '').trim().toLowerCase() === itemName)
  if (studentPlan && studentPlan.invoiced === false) return false

  // Ayarlar altındaki genel ücret kategorisi kontrolü
  const feeCategories = state?.settings?.feeCategories || []
  const feeCat = feeCategories.find(fc => (fc.name || '').trim().toLowerCase() === itemName)
  if (feeCat && feeCat.invoiced === false) return false

  return true
}

// Gerçekleşen tahsilatlardan Faturalar sayfasına yansıması gerekenleri filtreler:
// Şart 1: Öğrenci aktif ve Faturalı olmalı (invoiced !== false)
// Şart 2: Tahsilatın ait olduğu ücret kalemi Faturalı olmalı (invoiced !== false)
// Şart 3: Tahsilat fiilen gerçekleşmiş olmalı (amount > 0)
export function getInvoicableCollections(state, period = 'all') {
  const students = state?.students || []
  const collections = state?.collections || []

  return collections.filter(col => {
    const amt = Number(col.amount) || 0
    if (amt <= 0) return false

    // 1. Öğrenci kontrolü
    const student = students.find(s => String(s.id || s._id) === String(col.studentId))
    if (!student || student.active === false) return false

    // 2. Faturalı olma kontrolü (öğrenci + ücret kalemi)
    if (!isCollectionInvoiced(state, col, student)) return false

    // 3. Dönem kontrolü
    if (period && period !== 'all') {
      const colPeriod = (col.date || '').slice(0, 7)
      if (colPeriod && colPeriod !== period) return false
    }

    return true
  }).map(col => {
    const student = students.find(s => String(s.id || s._id) === String(col.studentId))
    return {
      ...col,
      student
    }
  })
}

// Faturalar sayfası için her ayın taksitlerini listeler:
// Tahsilatı yapılmış veya yapılmamış olsun, faturalı öğrenci ve faturalı ücret kalemine ait o ayın taksitini getirir.
export function getMonthlyInvoicableInstallments(state, period = 'all') {
  const students = state?.students || []
  const collections = state?.collections || []
  const invoices = state?.invoices || []
  const feeCategories = state?.settings?.feeCategories || []
  const vatRate = Number(state?.settings?.vat || state?.settings?.vergiOrani || 10)
  const defaultYearStart = getYearStart(state)

  const result = []

  students.forEach(student => {
    // 1. Öğrenci kontrolü: Aktif olmalı ve Faturalı olmalı (invoiced !== false)
    if (student.active === false || student.invoiced === false) return

    const items = student.items || []
    items.forEach((plan, planIdx) => {
      const planKey = plan?.id || plan?._id || `${(plan?.name || 'plan').replace(/\s+/g, '-').toLowerCase()}-${planIdx}`
      // 2. Ücret kalemi kontrolü: Plan ve genel kategori faturalı olmalı
      if (plan.invoiced === false) return
      const feeCat = feeCategories.find(fc => (fc.name || '').trim().toLowerCase() === (plan.name || '').trim().toLowerCase())
      if (feeCat && feeCat.invoiced === false) return

      const count = Math.max(1, Number(plan.installments) || 1)
      const total = Number(plan.total) || 0
      const downPayment = round2(Math.max(0, Number(plan.downPayment) || 0))
      const perInstallment = round2(total / count)
      const startDate = plan.start
        ? (plan.start.length === 7 ? `${plan.start}-15` : plan.start)
        : `${defaultYearStart}-15`

      // Devamsızlık / skipped installments kontrolü
      const skippedSet = {}
      if (Array.isArray(plan.skippedInstallments)) {
        plan.skippedInstallments.forEach(s => { skippedSet[s.no] = s })
      }

      // Bu öğrenci ve bu planın tahsilatları
      const planCols = collections.filter(c =>
        String(c.studentId) === String(student.id || student._id) &&
        (!c.item || c.item.trim().toLowerCase() === plan.name.trim().toLowerCase())
      )

      const explicitCols = {}
      const unassignedCols = []
      planCols.forEach(c => {
        const instNo = Number(c.installmentNo)
        if (instNo && instNo >= 1 && instNo <= count) {
          if (!explicitCols[instNo]) explicitCols[instNo] = []
          explicitCols[instNo].push(c)
        } else if (instNo === 0) {
          if (!explicitCols[0]) explicitCols[0] = []
          explicitCols[0].push(c)
        } else if (instNo !== 0) {
          unassignedCols.push(c)
        }
      })
      let unassignedPool = unassignedCols.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
      const downPaymentPaid = round2((explicitCols[0] || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0))
      const downPaymentCredit = round2(downPaymentPaid / count)

      for (let i = 0; i < count; i++) {
        const installmentNo = i + 1
        const dueDate = addMonthsToDate(startDate, i)
        const installmentPeriod = dueDate.slice(0, 7)

        // Dönem filtresi: Eğer spesifik bir ay seçildiyse sadece o ayın taksitleri gelir
        if (period && period !== 'all' && installmentPeriod !== period) {
          continue
        }

        // Tutar hesaplama (Devamsızlık kontrolü)
        let installmentAmount = perInstallment
        let isSkipped = false
        const skipInfo = skippedSet[installmentNo]
        if (skipInfo) {
          const isFull = (skipInfo.period || 'full') === 'full'
          const deductedAmount = Number(skipInfo.deductedAmount) != null
            ? Number(skipInfo.deductedAmount)
            : (isFull ? perInstallment : round2(perInstallment / 2))
          if (isFull || deductedAmount >= perInstallment) {
            installmentAmount = 0
            isSkipped = true
          } else {
            installmentAmount = round2(Math.max(0, perInstallment - deductedAmount))
          }
        }

        // Eğer taksit devamsızlıkla tamamen sıfırlandıysa (0 TL) listelemeyebiliriz
        if (installmentAmount <= 0 && isSkipped) {
          continue
        }

        // Tahsilat eşleştirme
        const directMatches = explicitCols[installmentNo] || []
        let paid = downPaymentCredit
        let collectionDates = []
        let paymentMethods = []

        if (directMatches.length > 0) {
          paid = directMatches.reduce((s, c) => s + (Number(c.amount) || 0), 0)
          collectionDates = directMatches.map(c => c.date).filter(Boolean)
          paymentMethods = [downPaymentPaid > 0 ? 'Peşin İşlem' : '', ...directMatches.map(c => c.payment).filter(Boolean)].filter(Boolean)
        } else if (unassignedPool > 0) {
          if (unassignedPool >= installmentAmount) {
            paid = installmentAmount
            unassignedPool = round2(unassignedPool - installmentAmount)
          } else {
            paid = unassignedPool
            unassignedPool = 0
          }
        }

        paid = round2(paid)
        const remaining = round2(Math.max(0, installmentAmount - paid))
        const isPaid = paid >= installmentAmount && installmentAmount > 0
        const isPartial = paid > 0 && paid < installmentAmount
        const collectionStatus = isPaid ? 'paid' : (isPartial ? 'partial' : 'unpaid')

        // Fatura eşleştirme
        const inv = invoices.find(iv =>
          String(iv.studentId) === String(student.id || student._id) &&
          (
            Number(iv.installmentNo) === installmentNo ||
            (iv.period === installmentPeriod && (!iv.planName || iv.planName.trim().toLowerCase() === plan.name.trim().toLowerCase())) ||
            (directMatches.some(dm => String(iv.collectionId) === String(dm.id || dm._id)))
          )
        )

        const invoiceStatus = inv ? 'billed' : 'unbilled'

        // Matrah ve KDV
        const baseAmount = round2(installmentAmount / (1 + vatRate / 100))
        const vatAmount = round2(installmentAmount - baseAmount)
        const invoiceTotal = inv ? round2(Number(inv.total) || 0) : 0
        const diff = inv ? round2(invoiceTotal - installmentAmount) : 0
        const hasDiff = Boolean(inv && Math.abs(diff) >= 0.01)
        const isUnderInvoiced = Boolean(inv && diff < -0.01)
        const isOverInvoiced = Boolean(inv && diff > 0.01)

        result.push({
          id: `${student.id || student._id}-${planKey}-${installmentNo}-${installmentPeriod}`,
          student,
          studentId: student.id || student._id,
          schoolName: student._schoolName || '',
          schoolId: student._schoolId || '',
          studentName: student.name || '—',
          parent: student.parent || '—',
          tax: student.tax || '—',
          plan,
          planName: plan.name || 'Genel',
          installmentNo,
          dueDate,
          dueDateFormatted: formatTrFullDate(dueDate),
          period: installmentPeriod,
          amount: installmentAmount,
          paid,
          remaining,
          collectionStatus,
          collectionDate: collectionDates.join(', ') || '',
          paymentMethod: paymentMethods.join(', ') || '',
          matchedCollections: directMatches,
          invoiceStatus,
          invoice: inv || null,
          invoiceNo: inv ? inv.no : '',
          invoiceDate: inv ? inv.date : '',
          invoiceTotal,
          diff,
          hasDiff,
          isUnderInvoiced,
          isOverInvoiced,
          vatRate,
          baseAmount,
          vatAmount
        })
      }
    })
  })

  // Sıralama: Vade tarihi, sonra öğrenci adı
  result.sort((a, b) => {
    const dDiff = (a.dueDate || '').localeCompare(b.dueDate || '')
    if (dDiff !== 0) return dDiff
    return (a.studentName || '').localeCompare(b.studentName || '', 'tr')
  })

  return result
}

export function simulate(state, period) {
  // Sahte fatura uydurma kaldırıldı. Yalnızca gerçek entegrasyondan gelen veya manuel faturalar kullanılır.
  return []
}

export function inPeriod(d, base, p) {
  if (p === 'all') return true
  const x = new Date(d + 'T00:00:00')
  const b = new Date(base + 'T00:00:00')
  if (p === 'day') return d === base
  if (p === 'month') return x.getFullYear() === b.getFullYear() && x.getMonth() === b.getMonth()
  if (p === 'year') return x.getFullYear() === b.getFullYear()
  if (p === 'week') {
    const day = (b.getDay() + 6) % 7
    const start = new Date(b); start.setDate(b.getDate() - day)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return x >= start && x <= end
  }
  return true
}

export function periodLabel(p) {
  const map = { day: 'Günlük', week: 'Haftalık', month: 'Aylık', year: 'Yıllık', all: 'Tüm zamanlar' }
  return map[p] || p
}

export function planTableFor(state, s) {
  const ys = getYearStart(state)
  const ps = periodsOfYear(ys)
  const items = s.items || []
  const rows = items.map(it => {
    const mm = itemMonths(it, ys)
    const per = it.total / it.installments
    return {
      item: it,
      months: ps.map(p => mm.includes(p) ? per : null),
      perMonth: per
    }
  })
  const monthTotals = ps.map(p => expectedFor(state, s.id, p))
  const monthCollected = ps.map(p => collectedFor(state, s.id, p))
  const monthRemaining = ps.map((p, i) => round2(monthTotals[i] - monthCollected[i]))
  return {
    periods: ps,
    rows,
    monthTotals,
    monthCollected,
    monthRemaining,
    totalExpected: expectedTotalFor(state, s.id),
    totalCollected: collectedAll(state, s.id),
    totalRemaining: balanceFor(state, s.id)
  }
}

export function getDashboardStats(state) {
  const students = state?.students || []
  const collections = state?.collections || []
  const checks = state?.checks || []
  const active = students.filter(s => s.active)
  const planned = expectedAllActive(state)
  const collected = round2(collections.reduce((a, c) => a + c.amount, 0))
  const remaining = round2(planned - collected)
  const cur = curPeriod(state)
  const currentMonthCollected = collectedFor(state, null, cur)
  const recent = collections.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6)
  let ok = 0, none = 0, diff = 0, exp = 0
  active.forEach(s => {
    const e = expectedFor(state, s.id, cur)
    if (e <= 0) return
    exp += e
    const stt = invStatus(state, s.id, cur)
    if (stt === 'ok') ok++
    else if (stt === 'diff') diff++
    else if (stt === 'none') none++
  })
  const last = checks.filter(c => c.period === cur).slice(-1)[0]
  return {
    activeCount: active.length,
    planned,
    collected,
    remaining,
    currentPeriod: cur,
    currentPeriodName: periodName(cur),
    currentMonthCollected,
    recent,
    invoiceOk: ok,
    invoiceNone: none,
    invoiceDiff: diff,
    invoiceExpected: round2(exp),
    lastCheckDate: last ? new Date(last.at).toLocaleString('tr-TR') : 'hiç yapılmadı'
  }
}

export function exportDataJSON(state) {
  const data = {
    settings: state?.settings || {},
    students: state?.students || [],
    collections: state?.collections || [],
    invoices: state?.invoices || [],
    checks: state?.checks || []
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const el = document.createElement('a')
  el.href = URL.createObjectURL(blob)
  el.download = 'anaokulu_yedek.json'
  el.click()
}

export function exportCSV(state, periodType = 'all', baseDate = new Date().toISOString().slice(0, 10)) {
  const a = (state?.collections || []).filter(c => inPeriod(c.date, baseDate, periodType))
    .sort((x, y) => (y.date || '').localeCompare(x.date || ''))
  const head = ['Tarih', 'Ogrenci', 'Kalem', 'Tutar', 'KDV', 'KDV Haric', 'Odeme', 'Fatura No', 'Aciklama']
  const lines = [head.join(';')].concat(a.map(c => [
    c.date, getStudent(state, c.studentId)?.name || '', c.item, c.amount, c.vat,
    round2((c.amount || 0) - (c.vat || 0)), c.payment, c.invoiceNo || '',
    String(c.note || '').replace(/;/g, ',')
  ].join(';')))
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const el = document.createElement('a')
  el.href = URL.createObjectURL(blob)
  el.download = 'tahsilat_raporu.csv'
  el.click()
  return a.length
}

export const MONTHS_TR = [
  { key: '01', name: 'Ocak', short: 'Oca' },
  { key: '02', name: 'Şubat', short: 'Şub' },
  { key: '03', name: 'Mart', short: 'Mar' },
  { key: '04', name: 'Nisan', short: 'Nis' },
  { key: '05', name: 'Mayıs', short: 'May' },
  { key: '06', name: 'Haziran', short: 'Haz' },
  { key: '07', name: 'Temmuz', short: 'Tem' },
  { key: '08', name: 'Ağustos', short: 'Ağu' },
  { key: '09', name: 'Eylül', short: 'Eyl' },
  { key: '10', name: 'Ekim', short: 'Eki' },
  { key: '11', name: 'Kasım', short: 'Kas' },
  { key: '12', name: 'Aralık', short: 'Ara' }
]

// Okul Süper Admin / Bölge Yöneticisi için tüm okulların geçmiş öğrenci alacaklarını ay ay hesaplar
export function calculateSchoolsDebtReport(schools = [], selectedYear = '2026') {
  const yearStr = String(selectedYear || '2026')
  const months = MONTHS_TR.map(m => ({
    period: `${yearStr}-${m.key}`,
    monthNo: m.key,
    name: m.name,
    short: m.short
  }))

  let grandAccrued = 0
  let grandPaid = 0
  let grandDebt = 0
  let grandDebtStudentsCount = 0
  let totalStudentsCount = 0
  const grandMonthlyDebts = {}
  months.forEach(m => { grandMonthlyDebts[m.period] = 0 })

  const schoolReports = (schools || []).map(school => {
    const schoolName = school.name || school.detail?.settings?.school || 'İsimsiz Okul'
    const schoolId = school.id || school._id
    const students = school.detail?.students || []
    const collections = school.detail?.collections || []
    const settings = school.detail?.settings || {}
    const defaultYearStart = settings.yearStart || `${yearStr}-09`

    let schoolAccrued = 0
    let schoolPaid = 0
    let schoolDebt = 0
    const schoolMonthlyDebts = {}
    months.forEach(m => { schoolMonthlyDebts[m.period] = 0 })

    const studentRows = []

    students.forEach(student => {
      totalStudentsCount++
      const studentId = student.id || student._id
      const items = student.items || []

      // 1. Öğrencinin tüm taksitlerini hesapla
      const allInstallments = []
      items.forEach(plan => {
        const count = Math.max(1, Number(plan.installments) || 1)
        const total = Number(plan.total) || 0
        const downPayment = round2(Math.max(0, Number(plan.downPayment) || 0))
        const perInstallment = round2(total / count)
        const startDate = plan.start
          ? (plan.start.length === 7 ? `${plan.start}-15` : plan.start)
          : `${defaultYearStart}-15`

        const skippedSet = {}
        if (Array.isArray(plan.skippedInstallments)) {
          plan.skippedInstallments.forEach(s => { skippedSet[s.no] = s })
        }

        for (let i = 0; i < count; i++) {
          const installmentNo = i + 1
          const dueDate = addMonthsToDate(startDate, i)
          const installmentPeriod = dueDate.slice(0, 7)

          let instAmt = perInstallment
          const skipInfo = skippedSet[installmentNo]
          if (skipInfo) {
            const isFull = (skipInfo.period || 'full') === 'full'
            const deducted = Number(skipInfo.deductedAmount) != null
              ? Number(skipInfo.deductedAmount)
              : (isFull ? perInstallment : round2(perInstallment / 2))
            if (isFull || deducted >= perInstallment) instAmt = 0
            else instAmt = round2(Math.max(0, perInstallment - deducted))
          }

          if (instAmt > 0) {
            allInstallments.push({
              planName: plan.name,
              installmentNo,
              period: installmentPeriod,
              amount: instAmt,
              dueDate
            })
          }
        }
      })

      // Taksitleri tarihe göre sırala
      allInstallments.sort((a, b) => a.dueDate.localeCompare(b.dueDate))

      // 2. Tahsilatları eşleştir
      const studentCols = collections.filter(c => String(c.studentId) === String(studentId))
      const explicitCols = {}
      const unassignedCols = []

      studentCols.forEach(c => {
        const instNo = Number(c.installmentNo)
        const itName = (c.item || '').trim().toLowerCase()
        if (instNo && instNo >= 1) {
          const key = `${itName}_${instNo}`
          if (!explicitCols[key]) explicitCols[key] = 0
          explicitCols[key] = round2(explicitCols[key] + (Number(c.amount) || 0))
        } else if (instNo === 0) {
          const key = `${itName}_0`
          explicitCols[key] = round2((explicitCols[key] || 0) + (Number(c.amount) || 0))
        } else if (instNo !== 0) {
          unassignedCols.push(Number(c.amount) || 0)
        }
      })

      let unassignedPool = round2(unassignedCols.reduce((sum, a) => sum + a, 0))

      const installmentDebts = allInstallments.map(inst => {
        const key = `${(inst.planName || '').trim().toLowerCase()}_${inst.installmentNo}`
        const downPaymentCredit = round2((explicitCols[`${(inst.planName || '').trim().toLowerCase()}_0`] || 0) / Math.max(1, Number(items.find(item => item.name === inst.planName)?.installments) || 1))
        let paid = round2((explicitCols[key] || 0) + downPaymentCredit)
        let debt = round2(Math.max(0, inst.amount - paid))

        if (debt > 0 && unassignedPool > 0) {
          if (unassignedPool >= debt) {
            paid = round2(paid + debt)
            unassignedPool = round2(unassignedPool - debt)
            debt = 0
          } else {
            paid = round2(paid + unassignedPool)
            debt = round2(debt - unassignedPool)
            unassignedPool = 0
          }
        }

        return {
          ...inst,
          paid,
          debt
        }
      })

      // 3. Her ay için borçları topla
      const monthlyDebts = {}
      const monthlyDues = {}
      const monthlyPaids = {}
      let studentTotalDebt = 0
      let studentTotalAccrued = 0
      let studentTotalPaid = 0

      months.forEach(m => {
        const instsForMonth = installmentDebts.filter(inst => inst.period === m.period)
        const dueForMonth = round2(instsForMonth.reduce((sum, inst) => sum + inst.amount, 0))
        const paidForMonth = round2(instsForMonth.reduce((sum, inst) => sum + inst.paid, 0))
        const debtForMonth = round2(instsForMonth.reduce((sum, inst) => sum + inst.debt, 0))

        monthlyDues[m.period] = dueForMonth
        monthlyPaids[m.period] = paidForMonth
        monthlyDebts[m.period] = debtForMonth

        studentTotalAccrued = round2(studentTotalAccrued + dueForMonth)
        studentTotalPaid = round2(studentTotalPaid + paidForMonth)
        studentTotalDebt = round2(studentTotalDebt + debtForMonth)

        schoolMonthlyDebts[m.period] = round2(schoolMonthlyDebts[m.period] + debtForMonth)
      })

      if (studentTotalDebt > 0) {
        grandDebtStudentsCount++
      }

      schoolAccrued = round2(schoolAccrued + studentTotalAccrued)
      schoolPaid = round2(schoolPaid + studentTotalPaid)
      schoolDebt = round2(schoolDebt + studentTotalDebt)

      studentRows.push({
        studentId,
        studentName: student.name,
        studentClass: student.class || '—',
        parentName: student.parent || '—',
        parentPhone: student.phone || '—',
        active: student.active !== false,
        monthlyDebts,
        monthlyDues,
        monthlyPaids,
        totalDebt: studentTotalDebt,
        totalAccrued: studentTotalAccrued,
        totalPaid: studentTotalPaid
      })
    })

    months.forEach(m => {
      grandMonthlyDebts[m.period] = round2(grandMonthlyDebts[m.period] + schoolMonthlyDebts[m.period])
    })

    grandAccrued = round2(grandAccrued + schoolAccrued)
    grandPaid = round2(grandPaid + schoolPaid)
    grandDebt = round2(grandDebt + schoolDebt)

    return {
      schoolId,
      schoolName,
      totalStudents: students.length,
      debtStudentsCount: studentRows.filter(s => s.totalDebt > 0).length,
      accrued: schoolAccrued,
      paid: schoolPaid,
      debt: schoolDebt,
      monthlyDebts: schoolMonthlyDebts,
      students: studentRows.sort((a, b) => b.totalDebt - a.totalDebt)
    }
  })

  return {
    year: yearStr,
    months,
    totalSchools: (schools || []).length,
    totalStudentsCount,
    grandAccrued,
    grandPaid,
    grandDebt,
    grandDebtStudentsCount,
    grandMonthlyDebts,
    schools: schoolReports
  }
}

// Raporu profesyonel ay ay matris Excel (.xls) formatında indirir
export function exportSchoolsDebtReportToExcel(reportData, onlyWithDebt = true) {
  if (!reportData) return

  const year = reportData.year || '2026'
  const months = reportData.months || []
  const nowStr = new Date().toLocaleString('tr-TR')

  let rowsHtml = ''

  reportData.schools.forEach(school => {
    const list = onlyWithDebt ? school.students.filter(s => s.totalDebt > 0) : school.students
    const totalCols = 7 + months.length + 1

    // Okul Başlığı Satırı
    rowsHtml += `
      <tr style="background-color: #4338ca; color: #ffffff; font-weight: bold; font-size: 13px;">
        <td colspan="${totalCols}" style="padding: 10px; border: 1px solid #312e81;">
          OKUL: ${school.schoolName} — Toplam ${school.totalStudents} Öğrenci | Borçlu: ${school.debtStudentsCount} Öğrenci | Toplam Alacak: ₺${school.debt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </td>
      </tr>
      <tr style="background-color: #f1f5f9; color: #334155; font-weight: bold; font-size: 11px;">
        <th style="border: 1px solid #cbd5e1; padding: 6px;">#</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px;">Öğrenci No</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px;">Öğrenci Adı Soyadı</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px;">Sınıf</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px;">Veli Adı</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px;">Veli Telefon</th>
        <th style="border: 1px solid #cbd5e1; padding: 6px;">Durum</th>
        ${months.map(m => `<th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; background-color: #e2e8f0;">${m.name}</th>`).join('')}
        <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; background-color: #fee2e2; color: #991b1b;">Toplam Borç (₺)</th>
      </tr>
    `

    if (list.length === 0) {
      rowsHtml += `
        <tr>
          <td colspan="${totalCols}" style="text-align: center; padding: 8px; color: #64748b; border: 1px solid #e2e8f0;">
            Bu okulda ${year} yılı için borcu olan öğrenci bulunmamaktadır.
          </td>
        </tr>
      `
    } else {
      list.forEach((s, idx) => {
        rowsHtml += `
          <tr style="font-size: 11px; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center;">${s.studentId}</td>
            <td style="border: 1px solid #e2e8f0; padding: 6px; font-weight: bold;">${s.studentName}</td>
            <td style="border: 1px solid #e2e8f0; padding: 6px;">${s.studentClass}</td>
            <td style="border: 1px solid #e2e8f0; padding: 6px;">${s.parentName}</td>
            <td style="border: 1px solid #e2e8f0; padding: 6px;">${s.parentPhone}</td>
            <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center;">${s.active ? 'Aktif' : 'Pasif'}</td>
            ${months.map(m => {
              const d = s.monthlyDebts[m.period] || 0
              if (d > 0) {
                return `<td style="border: 1px solid #e2e8f0; padding: 6px; text-align: right; font-weight: bold; color: #dc2626; background-color: #fff1f2;">${d.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>`
              }
              return `<td style="border: 1px solid #e2e8f0; padding: 6px; text-align: center; color: #94a3b8;">—</td>`
            }).join('')}
            <td style="border: 1px solid #e2e8f0; padding: 6px; text-align: right; font-weight: bold; color: #dc2626; background-color: #fee2e2;">
              ${s.totalDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        `
      })
    }

    // Okul Alt Toplam
    rowsHtml += `
      <tr style="background-color: #fef3c7; font-weight: bold; font-size: 11px;">
        <td colspan="7" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">
          ${school.schoolName} Ara Toplam:
        </td>
        ${months.map(m => {
          const d = school.monthlyDebts[m.period] || 0
          return `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; ${d > 0 ? 'color: #dc2626; font-weight: bold;' : 'color: #64748b;'}">
            ${d > 0 ? d.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '—'}
          </td>`
        }).join('')}
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #dc2626; background-color: #fee2e2; font-size: 12px;">
          ₺${school.debt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </td>
      </tr>
      <tr><td colspan="${totalCols}" style="height: 12px; background-color: #f8fafc; border: none;"></td></tr>
    `
  })

  // Genel Toplam Satırı
  const totalCols = 7 + months.length + 1
  rowsHtml += `
    <tr style="background-color: #dc2626; color: #ffffff; font-weight: bold; font-size: 12px;">
      <td colspan="7" style="border: 2px solid #b91c1c; padding: 10px; text-align: right;">
        GENEL TOPLAM (${reportData.totalSchools} Okul | ${reportData.grandDebtStudentsCount} Borçlu Öğrenci):
      </td>
      ${months.map(m => {
        const d = reportData.grandMonthlyDebts[m.period] || 0
        return `<td style="border: 2px solid #b91c1c; padding: 10px; text-align: right; background-color: #b91c1c;">
          ${d > 0 ? d.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '—'}
        </td>`
      }).join('')}
      <td style="border: 2px solid #b91c1c; padding: 10px; text-align: right; background-color: #991b1b; font-size: 13px;">
        ₺${reportData.grandDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
      </td>
    </tr>
  `

  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Ay Ay Alacak Raporu</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <style>
        body { font-family: Calibri, Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
      </style>
    </head>
    <body>
      <table border="0" cellpadding="4" cellspacing="0">
        <tr>
          <td colspan="${totalCols}" style="font-size: 16px; font-weight: bold; color: #1e1b4b; padding: 10px 0;">
            PENPOS ANAOKULU — TÜM OKULLAR AY BAZLI ÖĞRENCİ ALACAK RAPORU (${year})
          </td>
        </tr>
        <tr>
          <td colspan="${totalCols}" style="font-size: 12px; color: #475569; padding-bottom: 12px;">
            Rapor Yılı: <strong>${year} Yılı (Ocak - Aralık)</strong> | Alınma Tarihi: ${nowStr}
          </td>
        </tr>
        ${rowsHtml}
      </table>
    </body>
    </html>
  `

  const blob = new Blob(['\ufeff' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Ogrenci_Alacak_Raporu_' + year + '.xls'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
