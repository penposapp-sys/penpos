import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  CreditCard,
  FileCheck2,
  FilePlus2,
  FileText,
  Hourglass,
  Receipt,
  UserPlus,
  Users,
  Wallet,
  X
} from 'lucide-react'
import { useAnaokuluData } from '../context/AnaokuluDataContext.jsx'
import {
  addMonths,
  getDashboardStats,
  getYearStart,
  getMonthlyInvoicableInstallments,
  getPlanInstallmentAmount,
  getPlanInstallmentSchedule,
  getInstallmentPaid,
  getStudent,
  money,
  planTableFor,
  periodName,
  round2,
  trDate
} from '../utils/calculations.js'

const panelStyle = {
  background: '#fff',
  border: '1px solid #e6ebf3',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
  minWidth: 0
}

const monthLabel = (period) => {
  const [year, month] = String(period || '').split('-').map(Number)
  if (!year || !month) return period || '—'
  return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

const getInvoiceWorkflow = (invoice) => {
  const workflow = String(invoice?.lifecycleStatus || '').toLowerCase()
  const status = String(invoice?.status || '').toLocaleLowerCase('tr-TR')
  if (['draft_created', 'awaiting_approval', 'creating', 'checking', 'pending'].includes(workflow) || /bekliyor|taslak|onay/.test(status)) {
    return 'pending'
  }
  if (['failed', 'cancelled', 'draft_missing'].includes(workflow)) return 'unissued'
  return invoice ? 'issued' : 'unissued'
}

const invoiceStatusLabel = (invoice) => {
  if (!invoice) return 'Kesilmedi'
  const workflow = getInvoiceWorkflow(invoice)
  if (workflow === 'pending') return 'Bekliyor'
  if (workflow === 'unissued') return 'Kesilmedi'
  return invoice.status || 'Kesildi'
}

function getMonthInstallmentRows(state, period) {
  const students = (state?.students || []).filter(student => student.active !== false)
  const collections = state?.collections || []
  const defaultYearStart = state?.settings?.yearStart || '2026-09'
  const rows = []

  students.forEach(student => {
    ;(student.items || []).forEach((plan, planIndex) => {
      const count = Math.max(1, Number(plan.installments) || 1)
      const downPayment = round2(Math.max(0, Number(plan.downPayment) || 0))
      const startDate = plan.start
        ? (plan.start.length === 7 ? `${plan.start}-15` : plan.start)
        : `${defaultYearStart}-15`
      const schedule = getPlanInstallmentSchedule(plan, startDate)
      const scheduleTotal = round2(schedule.reduce((sum, installment) => sum + installment.amount, 0))
      const recordedDiscount = round2((Array.isArray(plan.discounts) ? plan.discounts : [])
        .reduce((sum, discount) => sum + (Number(discount.amount) || 0), 0))
      const totalDiscount = round2(Math.max(
        0,
        (Number(plan.basePrice) || 0) - (Number(plan.total) || 0),
        recordedDiscount
      ))
      const planCollections = collections.filter(collection =>
        String(collection.studentId) === String(student.id || student._id) &&
        (!collection.item || collection.item.trim().toLocaleLowerCase('tr-TR') === String(plan.name || '').trim().toLocaleLowerCase('tr-TR'))
      )
      const explicitCollections = new Map()
      const unassignedCollections = []

      planCollections.forEach(collection => {
        const installmentNo = Number(collection.installmentNo)
        if (Number.isInteger(installmentNo) && installmentNo > 0 && installmentNo <= count) {
          const matches = explicitCollections.get(installmentNo) || []
          matches.push(collection)
          explicitCollections.set(installmentNo, matches)
        } else if (Number.isInteger(installmentNo) && installmentNo === 0 && downPayment > 0) {
          const matches = explicitCollections.get(0) || []
          matches.push(collection)
          explicitCollections.set(0, matches)
        } else {
          unassignedCollections.push(collection)
        }
      })

      let unassignedPool = round2(unassignedCollections.reduce((sum, collection) => sum + (Number(collection.amount) || 0), 0))
      const downPaymentPaid = round2((explicitCollections.get(0) || []).reduce((sum, collection) => sum + (Number(collection.amount) || 0), 0))
      const downPaymentCredit = round2(downPaymentPaid / count)

      schedule.forEach(installment => {
        if (installment.dueDate.slice(0, 7) !== period) return
        const amount = getPlanInstallmentAmount(plan, installment.no)
        const scheduledAmount = round2(installment.amount)
        const discount = scheduleTotal > 0
          ? round2(totalDiscount * scheduledAmount / scheduleTotal)
          : 0
        const attendanceDeduction = round2(Math.max(0, scheduledAmount - amount))
        const isSkipped = (plan.skippedInstallments || []).some(skip => Number(skip?.no) === Number(installment.no))

        const directMatches = explicitCollections.get(installment.no) || []
        const directPaid = directMatches.length > 0
          ? directMatches.reduce((sum, collection) => sum + (Number(collection.amount) || 0), 0)
          : null
        const installmentPayment = getInstallmentPaid(amount, downPaymentCredit, directPaid, unassignedPool)
        const paid = installmentPayment.paid
        unassignedPool = round2(unassignedPool - installmentPayment.unassignedApplied)

        const remaining = round2(Math.max(0, amount - paid))

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const due = new Date(`${installment.dueDate}T00:00:00`)
        const daysOverdue = due < today ? Math.floor((today - due) / 86400000) : 0
        rows.push({
          student,
          studentId: student.id || student._id,
          plan,
          planIndex,
          planName: plan.name,
          installmentNo: installment.no,
          dueDate: installment.dueDate,
          amount,
          discount,
          attendanceDeduction,
          paid: round2(paid),
          downPaymentApplied: downPaymentCredit,
          unassignedApplied: installmentPayment.unassignedApplied,
          directPaid: round2(directPaid || 0),
          remaining,
          isSkipped,
          daysOverdue,
          collections: directMatches
        })
      })
    })
  })

  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || String(a.student.name || '').localeCompare(String(b.student.name || ''), 'tr'))
}

function getMonthlyStudentRows(state, period) {
  const collections = state?.collections || []
  const defaultYearStart = getYearStart(state)

  return (state?.students || []).map(student => {
    const planTable = planTableFor(state, student)
    const monthIndex = planTable.periods.indexOf(period)
    if (monthIndex < 0) return null

    const installments = planTable.rows.flatMap((planRow, planIndex) => {
      if (planRow.months[monthIndex] == null) return []
      const schedule = getPlanInstallmentSchedule(
        planRow.item,
        planRow.item.start || `${defaultYearStart}-15`
      )
      const installment = schedule.find(item => item.dueDate.slice(0, 7) === period)
      if (!installment) return []

      const scheduleTotal = round2(schedule.reduce((sum, item) => sum + item.amount, 0))
      const recordedDiscount = round2((Array.isArray(planRow.item.discounts) ? planRow.item.discounts : [])
        .reduce((sum, discount) => sum + (Number(discount.amount) || 0), 0))
      const totalDiscount = round2(Math.max(
        0,
        (Number(planRow.item.basePrice) || 0) - (Number(planRow.item.total) || 0),
        recordedDiscount
      ))
      const amount = round2(planRow.months[monthIndex])

      return [{
        plan: planRow.item,
        planIndex: (student.items || []).indexOf(planRow.item),
        planName: planRow.item.name || '—',
        installmentNo: installment.no,
        dueDate: installment.dueDate,
        amount,
        discount: scheduleTotal > 0 ? round2(totalDiscount * installment.amount / scheduleTotal) : 0,
        attendanceDeduction: round2(Math.max(0, installment.amount - amount))
      }]
    })
    const studentCollections = collections.filter(collection =>
      String(collection.studentId) === String(student.id) &&
      String(collection.date || '').slice(0, 7) === period
    )

    return {
      student,
      studentId: student.id || student._id,
      installments,
      amount: round2(planTable.monthTotals[monthIndex]),
      paid: round2(planTable.monthCollected[monthIndex]),
      remaining: round2(planTable.monthRemaining[monthIndex]),
      collections: studentCollections
    }
  }).filter(Boolean)
}

function DashboardOverviewPage() {
  const navigate = useNavigate()
  const { state } = useAnaokuluData()
  const students = state?.students || []
  const invoices = state?.invoices || []
  const dashboardStats = getDashboardStats(state)
  const schoolYearStart = getYearStart(state)
  const schoolYearPeriods = useMemo(() => Array.from({ length: 12 }, (_, index) => addMonths(schoolYearStart, index)), [schoolYearStart])
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200)
  const [selectedPeriod, setSelectedPeriod] = useState(dashboardStats.currentPeriod)
  const [detailsType, setDetailsType] = useState(null)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!schoolYearPeriods.includes(selectedPeriod)) {
      setSelectedPeriod(schoolYearPeriods.includes(dashboardStats.currentPeriod) ? dashboardStats.currentPeriod : schoolYearPeriods[0])
    }
  }, [dashboardStats.currentPeriod, schoolYearPeriods, selectedPeriod])

  const schoolYearStartYear = Number(schoolYearStart.slice(0, 4))
  const schoolYearEnd = schoolYearPeriods[schoolYearPeriods.length - 1]
  const schoolYearEndYear = Number(schoolYearEnd.slice(0, 4))
  const schoolYearTitle = `${schoolYearStartYear}-${schoolYearEndYear} Eğitim Dönemi (${periodName(schoolYearStart)} - ${periodName(schoolYearEnd)})`

  const isMobile = windowWidth <= 768
  const isTablet = windowWidth < 1120
  const activeStudents = useMemo(() => students.filter(student => student.active !== false), [students])
  const installmentRows = useMemo(() => getMonthInstallmentRows(state, selectedPeriod), [state, selectedPeriod])
  const monthlyStudentRows = useMemo(() => getMonthlyStudentRows(state, selectedPeriod), [state, selectedPeriod])

  const monthExpected = useMemo(() => round2(monthlyStudentRows.reduce((sum, row) => sum + row.amount, 0)), [monthlyStudentRows])
  const monthCollected = useMemo(() => round2(monthlyStudentRows.reduce((sum, row) => sum + row.paid, 0)), [monthlyStudentRows])
  const collectionRate = monthExpected > 0 ? Math.min(100, Math.round(monthCollected / monthExpected * 100)) : 0
  const invoiceRows = useMemo(() => getMonthlyInvoicableInstallments(state, selectedPeriod), [state, selectedPeriod])
  const invoiceCounts = useMemo(() => invoiceRows.reduce((counts, row) => {
    const workflow = getInvoiceWorkflow(row.invoice)
    counts[workflow] += 1
    counts[`${workflow}Amount`] = round2(counts[`${workflow}Amount`] + (row.invoice ? Number(row.invoice.total) || row.amount : row.amount))
    return counts
  }, { issued: 0, pending: 0, unissued: 0, issuedAmount: 0, pendingAmount: 0, unissuedAmount: 0 }), [invoiceRows])
  const invoiceRate = invoiceRows.length > 0 ? Math.round(invoiceCounts.issued / invoiceRows.length * 100) : 0

  const recentInvoices = useMemo(() => invoices
    .filter(invoice => String(invoice.period || invoice.date || '').slice(0, 7) === selectedPeriod)
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 5), [invoices, selectedPeriod])

  const chartPeriods = schoolYearPeriods
  const chartRows = useMemo(() => chartPeriods.map(period => {
    const rows = period === selectedPeriod ? monthlyStudentRows : getMonthlyStudentRows(state, period)
    return {
      period,
      expected: round2(rows.reduce((sum, row) => sum + row.amount, 0)),
      collected: round2(rows.reduce((sum, row) => sum + row.paid, 0))
    }
  }), [chartPeriods, monthlyStudentRows, selectedPeriod, state])
  const chartMax = Math.max(1, ...chartRows.flatMap(row => [row.expected, row.collected]))

  const pastPeriods = useMemo(() => Array.from({ length: 5 }, (_, index) => addMonths(selectedPeriod, -(index + 1))), [selectedPeriod])
  const pastMonthRows = useMemo(() => pastPeriods.map(period => {
    const rows = getMonthlyStudentRows(state, period)
    const expected = round2(rows.reduce((sum, row) => sum + row.amount, 0))
    const collected = round2(rows.reduce((sum, row) => sum + row.paid, 0))
    return {
      period,
      expected,
      collected,
      remaining: round2(rows.reduce((sum, row) => sum + row.remaining, 0)),
      rate: expected > 0 ? Math.min(100, Math.round(collected / expected * 100)) : 0
    }
  }), [pastPeriods, state])

  const allMonthInstallments = installmentRows
  const installmentDetailRows = useMemo(() => allMonthInstallments.map(row => {
    const remaining = round2(row.amount - row.paid)
    const status = remaining < 0
      ? 'Fazla tahsilat / mahsup'
      : remaining === 0
        ? 'Tamamlandı'
        : row.paid > 0
          ? 'Kısmi tahsil edildi'
          : 'Tahsil edilmedi'
    return {
      ...row,
      remaining,
      status,
      studentName: row.student.name || '—',
      feeItem: row.planName || '—',
      installmentAmount: row.amount,
      collectedAmount: row.paid,
      discountAmount: row.discount,
      detailKey: `${row.studentId}-${row.planIndex}-${row.installmentNo}-${row.dueDate}`
    }
  }), [allMonthInstallments])
  const allUnpaidInstallments = installmentDetailRows.filter(row => row.remaining > 0)
  const monthUncollected = round2(allUnpaidInstallments.reduce((sum, row) => sum + row.remaining, 0))
  const unpaidRows = allUnpaidInstallments.slice(0, 5)
  const totalMonthInstallments = allMonthInstallments.length
  const paidMonthInstallments = installmentDetailRows.filter(row => row.remaining <= 0).length
  const remainingMonthInstallments = totalMonthInstallments - paidMonthInstallments

  const changeMonth = (amount) => setSelectedPeriod(current => {
    const currentIndex = schoolYearPeriods.indexOf(current)
    const nextIndex = (Math.max(0, currentIndex) + amount + schoolYearPeriods.length) % schoolYearPeriods.length
    return schoolYearPeriods[nextIndex]
  })
  const monthShort = (period) => {
    const [year, month] = period.split('-').map(Number)
    return `${new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(new Date(year, month - 1, 1)).replace('.', '')}\n${String(year).slice(-2)}`
  }

  const navigateToCollection = (row) => navigate('/anaokulu/ucret-taksit', {
    state: {
      dashboardCollection: {
        studentId: row.studentId,
        planName: row.planName,
        planIndex: row.planIndex,
        installmentNo: row.installmentNo,
        dueDate: row.dueDate,
        dueAmount: row.amount,
        remaining: row.remaining,
        collections: row.collections
      }
    }
  })

  const card = (label, value, sub, Icon, tone, onClick) => {
    const Card = onClick ? 'button' : 'div'
    return (
    <Card type={onClick ? 'button' : undefined} onClick={onClick} style={{ ...panelStyle, width: '100%', boxSizing: 'border-box', padding: isMobile ? '10px 11px' : '14px 16px', display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ width: isMobile ? 36 : 46, height: isMobile ? 36 : 46, flex: '0 0 auto', borderRadius: 11, display: 'grid', placeItems: 'center', background: tone.soft, color: tone.main }}>
        <Icon size={isMobile ? 18 : 22} strokeWidth={2.4} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: isMobile ? 15 : 21, lineHeight: 1.15, fontWeight: 850, color: tone.main, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        <div style={{ marginTop: 3, fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
      {!isMobile && <ChevronRight size={16} color="#94a3b8" />}
    </Card>
    )
  }

  const panelHeader = (title, action, onAction, Icon) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {Icon && <Icon size={17} color="#2563eb" strokeWidth={2.5} />}
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{title}</h2>
      </div>
      {action && (
        <button type="button" onClick={onAction} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: '0 0 auto', border: 0, background: '#eff6ff', color: '#2563eb', padding: '5px 8px', borderRadius: 7, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          {action} <ArrowRight size={13} />
        </button>
      )}
    </div>
  )

  const statusColors = {
    issued: { bg: '#dcfce7', color: '#15803d', label: 'Kesildi' },
    pending: { bg: '#fef3c7', color: '#b45309', label: 'Bekliyor' },
    unissued: { bg: '#fee2e2', color: '#b91c1c', label: 'Kesilmedi' }
  }

  const financialDetails = detailsType === 'expected'
    ? {
        title: `${monthLabel(selectedPeriod)} Beklenen`,
        description: 'Öğrenci Detayı > Plan aylık tablosuyla aynı öğrenci ve taksit tutarlarıdır.',
        rows: installmentDetailRows.filter(row => row.amount > 0),
        total: round2(installmentDetailRows
          .filter(row => row.amount > 0)
          .reduce((sum, row) => sum + row.remaining, 0))
      }
    : detailsType === 'collected'
      ? {
          title: `${monthLabel(selectedPeriod)} Tahsil Edilen`,
          description: 'Öğrenci Detayı > Plan kaynağındaki gibi, seçili ayda kaydedilen tahsilatların öğrenci bazındaki toplamıdır.',
          rows: installmentDetailRows.filter(row => row.paid > 0 || row.remaining < 0),
          total: round2(installmentDetailRows
            .filter(row => row.paid > 0 || row.remaining < 0)
            .reduce((sum, row) => sum + row.remaining, 0))
        }
      : detailsType === 'uncollected'
        ? {
            title: `${monthLabel(selectedPeriod)} Tahsil Edilmeyen`,
            description: 'Öğrenci Detayı > Plan aylık “Kalan” hesabıdır. Fazla tahsilat bulunan öğrenci ayları negatif bakiye olarak toplama dahil edilir.',
            rows: allUnpaidInstallments,
            total: monthUncollected
          }
        : null

  return (
    <div style={{ width: '100%', maxWidth: 1550, margin: '0 auto', boxSizing: 'border-box', display: 'grid', gap: 10, minWidth: 0, overflowX: 'hidden', padding: '0 4px 8px', fontSize: 12, lineHeight: 1.4, color: '#0f172a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, padding: '2px 4px 3px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: 22, fontWeight: 850 }}>Genel Bakış</h1>
          <div style={{ marginTop: 3, color: '#64748b', fontSize: 12 }}>{schoolYearTitle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: 4, border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff' }}>
          <button type="button" aria-label="Önceki ay" onClick={() => changeMonth(-1)} style={{ border: 0, background: 'transparent', color: '#475569', width: 29, height: 29, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><ChevronLeft size={17} /></button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155', fontSize: 12, fontWeight: 800 }}>
            <CalendarDays size={14} color="#2563eb" />
            <select aria-label="Özet ayı" value={selectedPeriod} onChange={event => setSelectedPeriod(event.target.value)} style={{ maxWidth: 132, border: 0, outline: 0, background: 'transparent', color: '#334155', fontSize: 12, fontWeight: 800 }}>
              {schoolYearPeriods.map(period => <option key={period} value={period}>{monthLabel(period)}</option>)}
            </select>
          </label>
          <button type="button" aria-label="Sonraki ay" onClick={() => changeMonth(1)} style={{ border: 0, background: 'transparent', color: '#475569', width: 29, height: 29, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><ChevronRight size={17} /></button>
        </div>
      </div>

      <section style={{ ...panelStyle, padding: '9px 10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))', gap: 7, minWidth: 0 }}>
          {[
            { label: 'Tahsilat Ekle', detail: 'Hızlı tahsilat kaydı', Icon: Wallet, color: '#059669', bg: '#ecfdf5', to: '/anaokulu/ucret-taksit' },
            { label: 'Fatura Oluştur', detail: `${monthLabel(selectedPeriod)} faturalarını oluştur`, Icon: FilePlus2, color: '#7c3aed', bg: '#f5f3ff', to: '/anaokulu/faturalar' },
            { label: 'Yeni Öğrenci', detail: 'Öğrenci kaydı ekle', Icon: UserPlus, color: '#2563eb', bg: '#eff6ff', to: '/anaokulu/ogrenciler' },
            { label: 'Gecikme Listesi', detail: 'Ödenmeyen taksitler', Icon: Clock3, color: '#c2410c', bg: '#fff7ed', to: '/anaokulu/ucret-taksit', state: { dashboardOpenOverdue: true } },
            { label: 'Aylık Rapor', detail: `${monthLabel(selectedPeriod)} raporu`, Icon: BarChart3, color: '#2563eb', bg: '#eff6ff', to: '/anaokulu/raporlar' },
            { label: 'Tüm Raporlar', detail: 'Detaylı raporlar', Icon: Receipt, color: '#2563eb', bg: '#f1f5f9', to: '/anaokulu/raporlar' }
          ].map(action => (
            <button key={action.label} type="button" onClick={() => navigate(action.to, action.state ? { state: action.state } : undefined)} style={{ display: 'flex', alignItems: 'center', textAlign: 'left', gap: 7, width: '100%', minWidth: 0, padding: isMobile ? '8px 7px' : '8px 10px', border: '1px solid transparent', borderRadius: 9, background: action.bg, color: action.color, cursor: 'pointer' }}>
              <span style={{ width: isMobile ? 27 : 32, height: isMobile ? 27 : 32, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 8, background: '#fff' }}><action.Icon size={16} /></span>
              <span style={{ minWidth: 0, overflow: 'hidden' }}><strong style={{ display: 'block', fontSize: 12, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{action.label}</strong><small style={{ display: 'block', marginTop: 2, fontSize: 10, lineHeight: 1.2, color: '#64748b', overflowWrap: 'anywhere' }}>{action.detail}</small></span>
            </button>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: windowWidth < 380 ? 'minmax(0, 1fr)' : windowWidth < 980 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 8, minWidth: 0 }}>
        {card('Toplam Öğrenci', students.length, `${activeStudents.length} aktif · ${students.length - activeStudents.length} pasif`, Users, { main: '#0f172a', soft: '#eff6ff' })}
        {card(`${monthLabel(selectedPeriod)} Tahsil Edilen`, money(monthCollected), `${collectionRate}% tahsilat oranı`, Wallet, { main: '#059669', soft: '#dcfce7' }, () => setDetailsType('collected'))}
        {card(`${monthLabel(selectedPeriod)} Beklenen`, money(monthExpected), `${monthlyStudentRows.reduce((count, row) => count + row.installments.length, 0)} taksit`, Hourglass, { main: '#7c3aed', soft: '#f3e8ff' }, () => setDetailsType('expected'))}
        {card(`${monthLabel(selectedPeriod)} Tahsil Edilmeyen`, money(monthUncollected), `${allUnpaidInstallments.length} açık taksit`, CircleAlert, { main: '#dc2626', soft: '#fee2e2' }, () => setDetailsType('uncollected'))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1.08fr) minmax(0, 1fr) minmax(290px, 0.92fr)', gap: 8, alignItems: 'stretch' }}>
        <section style={{ ...panelStyle, padding: 14 }}>
          {panelHeader(`${monthLabel(selectedPeriod)} Özeti`, null, null, CalendarDays)}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '130px minmax(0, 1fr)', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 126, height: 126, margin: isMobile ? '0 auto' : 0, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `conic-gradient(#10b981 ${collectionRate}%, #bfdbfe 0 ${Math.min(100, collectionRate + Math.round((100 - collectionRate) * 0.72))}%, #fecaca 0)` }}>
              <div style={{ width: 92, height: 92, borderRadius: '50%', background: '#fff', display: 'grid', alignContent: 'center', justifyItems: 'center' }}>
                <strong style={{ fontSize: 20, color: '#0f172a' }}>%{collectionRate}</strong>
                <span style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>Tahsilat<br />Oranı</span>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                { label: 'Tahsil Edilen', value: monthCollected, color: '#059669', dot: '#10b981' },
                { label: 'Beklenen', value: monthExpected, color: '#2563eb', dot: '#93c5fd' },
                { label: 'Tahsil Edilmeyen', value: monthUncollected, color: '#dc2626', dot: '#fca5a5' }
              ].map(row => (
                <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '8px minmax(0, 1fr) auto', alignItems: 'center', gap: 7, fontSize: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: row.dot }} />
                  <span style={{ color: '#475569' }}>{row.label}</span>
                  <strong style={{ color: row.color, fontSize: 11 }}>{money(row.value)}</strong>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {[
              { label: 'Toplam Taksit', value: totalMonthInstallments, Icon: CalendarDays, color: '#2563eb' },
              { label: 'Ödenen Taksit', value: paidMonthInstallments, Icon: CircleCheck, color: '#059669' },
              { label: 'Kalan Taksit', value: remainingMonthInstallments, Icon: Clock3, color: '#dc2626' }
            ].map(row => (
              <div key={row.label} style={{ minWidth: 0, background: '#f8fafc', borderRadius: 8, padding: '7px 6px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <row.Icon size={17} color={row.color} />
                <div style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 13, color: row.color }}>{row.value}</strong><span style={{ display: 'block', fontSize: 10, color: '#64748b' }}>{row.label}</span></div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...panelStyle, padding: 14 }}>
          {panelHeader('Eğitim Dönemi Tahsilat Grafiği', null, null, BarChart3)}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, color: '#64748b', fontSize: 11, marginBottom: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ width: 7, height: 7, borderRadius: 2, background: '#10b981' }} />Tahsil Edilen</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ width: 7, height: 7, borderRadius: 2, background: '#bfdbfe' }} />Beklenen</span>
          </div>
          <div style={{ height: 154, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', alignItems: 'end', borderBottom: '1px solid #cbd5e1', background: 'repeating-linear-gradient(to bottom, transparent 0, transparent 36px, #f1f5f9 37px)' }}>
            {chartRows.map(row => {
              const collectedHeight = Math.max(row.collected > 0 ? 3 : 0, Math.round(row.collected / chartMax * 112))
              const expectedHeight = Math.max(row.expected > 0 ? 3 : 0, Math.round(row.expected / chartMax * 112))
              const selected = row.period === selectedPeriod
              return (
                <div key={row.period} style={{ height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4, padding: '0 1px 4px', background: selected ? 'rgba(99,102,241,0.08)' : 'transparent', borderRadius: '7px 7px 0 0' }}>
                  <div style={{ height: 122, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 2 }}>
                    <div title={`Tahsil edilen: ${money(row.collected)}`} style={{ width: '34%', maxWidth: 12, height: collectedHeight, borderRadius: '4px 4px 0 0', background: '#10b981' }} />
                    <div title={`Beklenen: ${money(row.expected)}`} style={{ width: '34%', maxWidth: 12, height: expectedHeight, borderRadius: '4px 4px 0 0', background: selected ? '#7c3aed' : '#bfdbfe' }} />
                  </div>
                  <span style={{ fontSize: 10, lineHeight: 1.05, whiteSpace: 'pre-line', textAlign: 'center', color: selected ? '#4f46e5' : '#64748b', fontWeight: selected ? 800 : 600 }}>{monthShort(row.period)}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section style={{ ...panelStyle, padding: 12, gridColumn: isTablet ? '1 / -1' : 'auto' }}>
          {panelHeader('Fatura Durumu', null, null, FileCheck2)}
          <div style={{ padding: 10, borderRadius: 9, background: 'linear-gradient(120deg,#f5f3ff,#eff6ff)', marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', flex: '0 0 auto', borderRadius: 9, background: '#ede9fe', color: '#7c3aed' }}><FileText size={21} /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Bu Ay Faturalar · {monthLabel(selectedPeriod)}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}><strong style={{ fontSize: 17, color: '#312e81' }}>{invoiceCounts.issued} / {invoiceRows.length}</strong><span style={{ fontSize: 11, color: '#64748b' }}>%{invoiceRate}</span></div>
                <div style={{ height: 5, marginTop: 4, overflow: 'hidden', borderRadius: 5, background: '#ddd6fe' }}><div style={{ width: `${invoiceRate}%`, height: '100%', background: '#7c3aed', borderRadius: 5 }} /></div>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 5, marginBottom: 10 }}>
            {[
              { key: 'issued', label: 'Kesilen', value: invoiceCounts.issued, bg: '#ecfdf5', fg: '#047857', Icon: CircleCheck },
              { key: 'pending', label: 'Bekleyen', value: invoiceCounts.pending, bg: '#fffbeb', fg: '#b45309', Icon: Clock3 },
              { key: 'unissued', label: 'Kesilmeyen', value: invoiceCounts.unissued, bg: '#fff1f2', fg: '#be123c', Icon: CircleAlert }
            ].map(item => (
              <div key={item.label} style={{ minWidth: 0, padding: '7px 5px', borderRadius: 8, background: item.bg, textAlign: 'center' }}>
                <item.Icon size={15} color={item.fg} style={{ marginBottom: 2 }} />
                <strong style={{ display: 'block', fontSize: 14, lineHeight: 1.1, color: item.fg }}>{item.value}</strong>
                <span style={{ display: 'block', fontSize: 10, color: item.fg }}>{item.label}</span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 10, fontWeight: 700, color: item.fg }}>{money(invoiceCounts[`${item.key}Amount`] || 0)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <strong style={{ fontSize: 12, color: '#334155' }}>Son Faturalar</strong>
            <button type="button" onClick={() => navigate('/anaokulu/faturalar')} style={{ border: 0, background: 'transparent', color: '#2563eb', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Tümü →</button>
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            {!isMobile && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(65px,1fr) minmax(60px,1fr) auto auto auto', gap: 5, padding: '4px 2px', color: '#64748b', fontSize: 11, fontWeight: 800 }}>
                <span>Fatura No</span><span>Öğrenci</span><span>Tutar</span><span>Tarih</span><span>Durum</span>
              </div>
            )}
            {recentInvoices.length === 0 ? (
              <div style={{ padding: '14px 6px', color: '#94a3b8', textAlign: 'center', fontSize: 12 }}>Bu ay fatura kaydı yok.</div>
            ) : recentInvoices.map((invoice, index) => {
              const student = getStudent(state, invoice.studentId)
              const workflow = getInvoiceWorkflow(invoice)
              const tone = statusColors[workflow]
              if (isMobile) {
                return (
                  <div key={invoice.uuid || invoice._id || `${invoice.no}-${index}`} style={{ display: 'grid', gap: 5, padding: 8, border: '1px solid #f1f5f9', borderRadius: 8, fontSize: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>{invoice.no || invoice.invoiceNo || '—'}</strong>
                      <span style={{ flex: '0 0 auto', background: tone.bg, color: tone.color, borderRadius: 5, padding: '3px 6px', fontSize: 11, fontWeight: 800 }}>{invoiceStatusLabel(invoice)}</span>
                    </div>
                    <span style={{ color: '#64748b', overflowWrap: 'anywhere' }}>{student?.name || invoice.buyer || '—'}</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, color: '#64748b' }}>
                      <span>{trDate(invoice.date)}</span><strong style={{ color: '#0f172a' }}>{money(invoice.total)}</strong>
                    </div>
                  </div>
                )
              }
              return (
                <div key={invoice.uuid || invoice._id || `${invoice.no}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(65px,1fr) minmax(60px,1fr) auto auto auto', alignItems: 'center', gap: 5, padding: '5px 2px', borderBottom: '1px solid #f1f5f9', fontSize: 11 }}>
                  <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invoice.no || invoice.invoiceNo || '—'}</span>
                  <span style={{ color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student?.name || invoice.buyer || '—'}</span>
                  <strong style={{ color: '#0f172a', whiteSpace: 'nowrap' }}>{money(invoice.total)}</strong>
                  <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{trDate(invoice.date)}</span>
                  <span style={{ background: tone.bg, color: tone.color, borderRadius: 5, padding: '3px 5px', fontWeight: 800, whiteSpace: 'nowrap' }}>{invoiceStatusLabel(invoice)}</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0,1fr)' : 'minmax(0,1.08fr) minmax(0,1.42fr)', gap: 8, alignItems: 'stretch' }}>
        <section style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px 8px' }}>{panelHeader(`${monthLabel(selectedPeriod)} Tahsil Edilmeyenler`, null, null, CircleAlert)}</div>
          {isMobile ? (
            <div style={{ display: 'grid', gap: 7, padding: '0 9px 10px' }}>
              {unpaidRows.length === 0 ? (
                <div style={{ padding: 18, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>Seçili ay için tahsil edilmeyen taksit yok.</div>
              ) : unpaidRows.map(row => (
                <div key={`${row.studentId}-${row.planName}-${row.installmentNo}`} style={{ display: 'grid', gap: 6, padding: 10, border: '1px solid #eef2f7', borderRadius: 9, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}><strong style={{ display: 'block', color: '#334155', fontSize: 12, overflowWrap: 'anywhere' }}>{row.student.name}</strong><span style={{ color: '#64748b', fontSize: 11 }}>{row.planName}</span></div>
                    <strong style={{ color: '#dc2626', fontSize: 12, whiteSpace: 'nowrap' }}>{money(row.remaining)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 10 }}>
                    <span>Vade {trDate(row.dueDate)}</span>
                    <span style={{ color: row.daysOverdue > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>{row.daysOverdue > 0 ? `${row.daysOverdue} gün gecikme` : 'Gecikmedi'}</span>
                  </div>
                  <button type="button" onClick={() => navigateToCollection(row)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, width: '100%', border: 0, borderRadius: 7, padding: '8px 10px', background: '#fee2e2', color: '#b91c1c', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}><CreditCard size={14} />Tahsil Et</button>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  {['Öğrenci', 'Kalem', 'Tutar', 'Vade', 'Gün', ''].map(label => <th key={label} style={{ textAlign: 'left', padding: '7px 8px', color: '#64748b', fontSize: 12, fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>{label}</th>)}
                </tr></thead>
                <tbody>
                  {unpaidRows.length === 0 ? <tr><td colSpan={6} style={{ padding: 22, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>Seçili ay için tahsil edilmeyen taksit yok.</td></tr> : unpaidRows.map(row => (
                    <tr key={`${row.studentId}-${row.planName}-${row.installmentNo}`}>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere' }}>{row.student.name}</td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: 12, overflowWrap: 'anywhere' }}>{row.planName}</td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9', color: '#dc2626', fontSize: 12, fontWeight: 800 }}>{money(row.remaining)}</td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9', color: '#475569', fontSize: 12 }}>{trDate(row.dueDate)}</td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9', color: row.daysOverdue > 0 ? '#dc2626' : '#64748b', fontSize: 12, fontWeight: 700 }}>{row.daysOverdue > 0 ? `${row.daysOverdue} gün` : '—'}</td>
                      <td style={{ padding: '5px 7px', borderBottom: '1px solid #f1f5f9' }}><button type="button" onClick={() => navigateToCollection(row)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, borderRadius: 6, padding: '5px 7px', background: '#fee2e2', color: '#b91c1c', fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}><CreditCard size={12} />Tahsil Et</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ ...panelStyle, padding: 14 }}>
          {panelHeader('Geçmiş Aylara Ait Durum', null, null, CalendarClock)}
          {isMobile ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {pastMonthRows.map(row => (
                <div key={row.period} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '7px 10px', padding: 9, border: '1px solid #eef2f7', borderRadius: 8, minWidth: 0 }}>
                  <strong style={{ color: '#334155', fontSize: 12 }}>{periodName(row.period)}</strong>
                  <span style={{ justifySelf: 'end', padding: '3px 7px', borderRadius: 20, background: row.rate >= 70 ? '#dcfce7' : '#fef3c7', color: row.rate >= 70 ? '#15803d' : '#b45309', fontSize: 10, fontWeight: 800 }}>%{row.rate}</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>Beklenen <strong style={{ color: '#475569' }}>{money(row.expected)}</strong></span>
                  <span style={{ justifySelf: 'end', color: '#059669', fontSize: 11 }}>Tahsil <strong>{money(row.collected)}</strong></span>
                  <span style={{ gridColumn: '1 / -1', color: '#dc2626', fontSize: 11 }}>Kalan <strong>{money(row.remaining)}</strong></span>
                </div>
              ))}
            </div>
          ) : (
            <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                {['Ay', 'Beklenen', 'Tahsil Edilen', 'Kalan', 'Oran'].map(label => <th key={label} style={{ textAlign: label === 'Ay' ? 'left' : 'right', padding: '8px 7px', color: '#64748b', fontSize: 12, fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>{label}</th>)}
              </tr></thead>
              <tbody>
                {pastMonthRows.map(row => (
                  <tr key={row.period}>
                    <td style={{ padding: '8px 7px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{periodName(row.period)}</td>
                    <td style={{ padding: '8px 7px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: '#475569', fontSize: 12, whiteSpace: 'nowrap' }}>{money(row.expected)}</td>
                    <td style={{ padding: '8px 7px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: '#059669', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{money(row.collected)}</td>
                    <td style={{ padding: '8px 7px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: row.remaining > 0 ? '#dc2626' : '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{money(row.remaining)}</td>
                    <td style={{ padding: '8px 7px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}><span style={{ display: 'inline-block', minWidth: 34, textAlign: 'center', padding: '3px 5px', borderRadius: 20, background: row.rate >= 70 ? '#dcfce7' : '#fef3c7', color: row.rate >= 70 ? '#15803d' : '#b45309', fontSize: 10, fontWeight: 800 }}>%{row.rate}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>
      </div>

      {financialDetails && (
        <div
          role="presentation"
          onClick={() => setDetailsType(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 14, background: 'rgba(15,23,42,0.48)' }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-financial-details-title"
            onClick={event => event.stopPropagation()}
            style={{ width: 'min(1200px, 100%)', maxHeight: 'min(88vh, 900px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(15,23,42,0.25)' }}
          >
            <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h2 id="dashboard-financial-details-title" style={{ margin: 0, color: '#0f172a', fontSize: 17, fontWeight: 850 }}>{financialDetails.title}</h2>
                <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 12 }}>{financialDetails.description}</p>
              </div>
              <button type="button" aria-label="Detay penceresini kapat" onClick={() => setDetailsType(null)} style={{ display: 'grid', placeItems: 'center', flex: '0 0 auto', width: 32, height: 32, border: 0, borderRadius: 8, background: '#f1f5f9', color: '#475569', cursor: 'pointer' }}>
                <X size={17} />
              </button>
            </header>
            <div style={{ overflow: 'auto', padding: '0 14px 14px' }}>
              <table style={{ width: '100%', minWidth: 970, borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>
                  <tr>
                    {['Öğrenci', 'Ücret kalemi', 'Taksit no / vade', 'Taksit tutarı', 'Tahsil edilen (ay)', 'İndirim / devamsızlık', 'Kalan', 'Durum', ''].map(label => (
                      <th key={label} style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: label.startsWith('Taksit tutarı') || label.startsWith('Tahsil edilen') || label === 'Kalan' ? 'right' : 'left', whiteSpace: 'nowrap' }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {financialDetails.rows.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: 26, textAlign: 'center', color: '#64748b' }}>Bu ay için gösterilecek taksit kaydı yok.</td></tr>
                  ) : financialDetails.rows.map(row => {
                    const appliedDiscounts = [
                      row.discount > 0 ? `İndirim ${money(row.discount)}` : '',
                      row.attendanceDeduction > 0 ? `Devamsızlık ${money(row.attendanceDeduction)}` : ''
                    ].filter(Boolean).join(' · ') || '—'
                    const paymentBreakdown = [
                      row.downPaymentApplied > 0 ? `Peşinat payı ${money(row.downPaymentApplied)}` : '',
                      row.directPaid > 0 ? `Bu taksit ${money(row.directPaid)}` : '',
                      row.unassignedApplied > 0 ? `Legacy tahsilat ${money(row.unassignedApplied)}` : ''
                    ].filter(Boolean).join(' · ')
                    return (
                      <tr
                        key={row.detailKey}
                        tabIndex={0}
                        role="button"
                        onClick={() => navigateToCollection(row)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            navigateToCollection(row)
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 750 }}>{row.student.name || '—'}</td>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>{row.planName || '—'}</td>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>#{row.installmentNo} · {trDate(row.dueDate)}</td>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', whiteSpace: 'nowrap' }}>{money(row.amount)}</td>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <strong>{money(row.paid)}</strong>
                          {paymentBreakdown && <small style={{ display: 'block', maxWidth: 240, marginTop: 2, color: '#64748b', whiteSpace: 'normal' }}>{paymentBreakdown}</small>}
                        </td>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>{appliedDiscounts}</td>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: row.remaining > 0 ? '#dc2626' : row.remaining < 0 ? '#2563eb' : '#475569', fontWeight: 750, whiteSpace: 'nowrap' }}>{money(row.remaining)}</td>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f1f5f9', color: row.remaining > 0 ? (row.paid > 0 ? '#b45309' : '#dc2626') : row.remaining < 0 ? '#2563eb' : '#15803d', whiteSpace: 'nowrap' }}>{row.status}</td>
                        <td style={{ padding: '9px 8px', borderBottom: '1px solid #f1f5f9', color: '#2563eb', fontWeight: 750, whiteSpace: 'nowrap' }}>Detaya git →</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 850 }}>
                    <td colSpan={3} style={{ padding: '11px 8px', textAlign: 'right', color: '#334155' }}>Toplam ({financialDetails.rows.length} taksit)</td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{money(round2(financialDetails.rows.reduce((sum, row) => sum + row.amount, 0)))}</td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{money(round2(financialDetails.rows.reduce((sum, row) => sum + row.paid, 0)))}</td>
                    <td style={{ padding: '11px 8px' }}>—</td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{money(round2(financialDetails.rows.reduce((sum, row) => sum + row.remaining, 0)))}</td>
                    <td colSpan={2} style={{ padding: '11px 8px', color: '#334155' }}>Kart toplamı: {money(financialDetails.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      )}

    </div>
  )
}

export default DashboardOverviewPage
