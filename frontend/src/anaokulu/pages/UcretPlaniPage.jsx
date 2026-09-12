import React, { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useAnaokuluData } from '../context/AnaokuluDataContext.jsx'
import {
  money, expectedTotalFor, collectedAll, getStudent,
  periodName, periodsOfYear, getYearStart, planTableFor, round2, isCollectionInvoiced
} from '../utils/calculations.js'

const Btn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 10, fontWeight: 600,
  cursor: 'pointer', border: 'none', fontSize: 13,
  transition: 'all 0.15s ease'
}

const InputCls = {
  padding: '9px 12px', borderRadius: 10,
  border: '1px solid #cbd5e1', background: '#fff',
  fontSize: 13, outline: 'none', width: '100%',
  boxSizing: 'border-box'
}

// Add months to full date (YYYY-MM-DD or YYYY-MM)
function addMonthsToDate(dateStr, n) {
  if (!dateStr) return ''
  let y = Number(dateStr.slice(0, 4))
  let m = Number(dateStr.slice(5, 7)) - 1
  let d = dateStr.length >= 10 ? (Number(dateStr.slice(8, 10)) || 15) : 15

  const dt = new Date(y, m + n, d)
  // Check month overflow (e.g. Feb 30 -> Feb 28)
  const targetMonth = (m + n) % 12
  const normalizedTarget = targetMonth < 0 ? targetMonth + 12 : targetMonth
  if (dt.getMonth() !== normalizedTarget) {
    dt.setDate(0) // Last day of previous month
  }

  const resY = dt.getFullYear()
  const resM = String(dt.getMonth() + 1).padStart(2, '0')
  const resD = String(dt.getDate()).padStart(2, '0')
  return `${resY}-${resM}-${resD}`
}

const MONTH_NAMES_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

// Format date to Turkish readable format (DD MMMM YYYY)
function formatTrFullDate(dateStr) {
  if (!dateStr) return '—'
  const clean = dateStr.slice(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) {
    const day = Number(parts[2])
    const monthIdx = Number(parts[1]) - 1
    const year = parts[0]
    return `${day} ${MONTH_NAMES_TR[monthIdx] || ''} ${year}`
  }
  return dateStr
}

export default function UcretPlaniPage() {
  const { isAdminPanelMode, accessibleTenants } = useAuth()
  const { state, actions } = useAnaokuluData()
  const students = state?.students || []
  const collections = state?.collections || []
  const ys = getYearStart(state)
  const feeCategories = Array.isArray(state?.settings?.feeCategories) ? state.settings.feeCategories : []
  const discountDefs = Array.isArray(state?.settings?.discounts) ? state.settings.discounts : []

  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selStudentId, setSelStudentId] = useState(null)
  const [selectedPlanIdx, setSelectedPlanIdx] = useState(0)
  const [studentSearch, setStudentSearch] = useState('')
  const [planSearch, setPlanSearch] = useState('')
  const [planSortKey, setPlanSortKey] = useState('name')
  const [planSortDir, setPlanSortDir] = useState('asc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItemIdx, setEditItemIdx] = useState(null)
  const [toastMsg, setToastMsg] = useState('')
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const [showStudentListMobile, setShowStudentListMobile] = useState(false)
  const [overdueModalOpen, setOverdueModalOpen] = useState(false)
  const [skipModalOpen, setSkipModalOpen] = useState(false)
  const [skipForm, setSkipForm] = useState({
    installmentNo: 1,
    reason: 'Devamsızlık',
    date: new Date().toISOString().slice(0, 10),
    period: 'half', // 'full' or 'half'
    dueDate: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    monthDays: 30,
    startDate: '',
    endDate: '',
    absentDays: 15,
    perInst: 0,
    deduction: 0
  })

  // New collection modal state
  const [collectModalOpen, setCollectModalOpen] = useState(false)
  const [collectForm, setCollectForm] = useState({
    studentId: null,
    planName: '',
    installmentNo: 1,
    dueDate: '',
    dueAmount: 0,
    amount: 0,
    collections: [],
    date: new Date().toISOString().slice(0, 10),
    payment: 'Nakit',
    note: ''
  })

  // Edit / Delete existing collection modal state
  const [editCollectionModalOpen, setEditCollectionModalOpen] = useState(false)
  const [editCollectionForm, setEditCollectionForm] = useState({
    id: null,
    installmentNo: 1,
    planName: '',
    dueDate: '',
    collections: [],
    date: '',
    amount: 0,
    payment: 'Nakit',
    note: ''
  })

  // Track window resizing for responsive layout
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isCompact = windowWidth < 1120

  // Standard full date default (YYYY-MM-15)
  const defaultFullDate = useMemo(() => {
    if (ys && ys.length === 7) return `${ys}-15`
    return new Date().toISOString().slice(0, 10)
  }, [ys])

  // Multi-discount item form (start is full exact date)
  const [itemForm, setItemForm] = useState({
    categoryId: '',
    name: '',
    basePrice: 0,
    downPayment: 0,
    discountIds: [],
    installments: 10,
    start: defaultFullDate
  })

  const orderedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const nameDiff = String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')
      if (nameDiff !== 0) return nameDiff
      const classDiff = String(a?.class || '').localeCompare(String(b?.class || ''), 'tr')
      if (classDiff !== 0) return classDiff
      return String(a?._schoolName || '').localeCompare(String(b?._schoolName || ''), 'tr')
    })
  }, [students])

  // Auto-select first student if none selected
  useEffect(() => {
    if (!selStudentId && orderedStudents.length > 0) {
      setSelStudentId(String(orderedStudents[0].id))
    }
  }, [orderedStudents, selStudentId])

  // Reset selected plan to first item when switching student
  useEffect(() => {
    setSelectedPlanIdx(0)
  }, [selStudentId])

  const selStudent = useMemo(() =>
    orderedStudents.find(s => String(s.id) === String(selStudentId)) || null,
    [orderedStudents, selStudentId]
  )

  const activePlan = useMemo(() => {
    if (!selStudent || !Array.isArray(selStudent.items) || selStudent.items.length === 0) return null
    return selStudent.items[selectedPlanIdx] || selStudent.items[0] || null
  }, [selStudent, selectedPlanIdx])

  const filteredStudents = useMemo(() => {
    let list = orderedStudents
    if (selectedSchoolId) {
      list = list.filter(s => String(s._schoolId) === String(selectedSchoolId))
    }
    if (!studentSearch.trim()) return list
    const q = studentSearch.toLowerCase().trim()
    return list.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.class || '').toLowerCase().includes(q) ||
      (s.parent || '').toLowerCase().includes(q) ||
      (s._schoolName || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.tax || '').toLowerCase().includes(q)
    )
  }, [orderedStudents, studentSearch, selectedSchoolId])

  const togglePlanSort = (key) => {
    if (planSortKey === key) {
      if (planSortDir === 'asc') {
        setPlanSortDir('desc'); return
      }
      if (planSortDir === 'desc') {
        setPlanSortKey('name'); setPlanSortDir('asc'); return
      }
    }
    setPlanSortKey(key)
    setPlanSortDir('asc')
  }

  const visiblePlans = useMemo(() => {
    if (!selStudent || !Array.isArray(selStudent.items)) return []
    const needle = planSearch.toLowerCase().trim()
    const filtered = selStudent.items.filter((it) => {
      if (!needle) return true
      const text = [it.name, it.start, String(it.installments || ''), String(it.total || ''), String(it.basePrice || ''), (it.discounts || []).map(d => d?.name || d?.discountName || '').join(' ')].join(' ').toLowerCase()
      return text.includes(needle)
    })

    return [...filtered].sort((a, b) => {
      const aValue = (() => {
        switch (planSortKey) {
          case 'name': return String(a.name || '').toLocaleLowerCase('tr')
          case 'basePrice': return Number(a.basePrice || 0)
          case 'total': return Number(a.total || 0)
          case 'installments': return Number(a.installments || 0)
          case 'month': return Number((Number(a.total || 0) / Math.max(1, Number(a.installments || 1))) || 0)
          case 'start': return new Date(a.start || '1970-01-01').getTime()
          default: return String(a.name || '').toLocaleLowerCase('tr')
        }
      })()
      const bValue = (() => {
        switch (planSortKey) {
          case 'name': return String(b.name || '').toLocaleLowerCase('tr')
          case 'basePrice': return Number(b.basePrice || 0)
          case 'total': return Number(b.total || 0)
          case 'installments': return Number(b.installments || 0)
          case 'month': return Number((Number(b.total || 0) / Math.max(1, Number(b.installments || 1))) || 0)
          case 'start': return new Date(b.start || '1970-01-01').getTime()
          default: return String(b.name || '').toLocaleLowerCase('tr')
        }
      })()

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return planSortDir === 'asc' ? aValue - bValue : bValue - aValue
      }

      const comparison = String(aValue).localeCompare(String(bValue), 'tr')
      return planSortDir === 'asc' ? comparison : -comparison
    })
  }, [selStudent, planSearch, planSortKey, planSortDir])

  const toast = (m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 2800) }

  const discountBadgeText = (d) => {
    if (!d) return ''
    if (d.type === 'percent') return `-%${d.value}`
    return `-${money(d.value)}`
  }

  // Multi-discount sequential calculation
  const calculateMultiDiscounts = (basePrice, discountIds = []) => {
    const base = Number(basePrice) || 0
    let cur = base
    const applied = []

    discountIds.forEach((dId, idx) => {
      if (!dId) return
      const d = discountDefs.find(x => String(x.id) === String(dId))
      if (!d) return

      let amt = 0
      if (d.type === 'percent') {
        amt = round2(cur * ((Number(d.value) || 0) / 100))
      } else if (d.type === 'fixed') {
        amt = round2(Math.min(cur, Number(d.value) || 0))
      }
      const prev = cur
      cur = round2(Math.max(0, cur - amt))
      applied.push({
        order: idx + 1,
        id: String(d.id),
        name: d.name,
        type: d.type,
        value: Number(d.value),
        prevPrice: prev,
        amount: amt,
        newPrice: cur,
        label: d.type === 'percent' ? `-%${d.value}` : `-${money(d.value)}`
      })
    })

    const finalPrice = cur
    const totalDiscount = round2(base - finalPrice)
    return {
      basePrice: base,
      applied,
      finalPrice,
      totalDiscount
    }
  }

  // Resolve discounts for any item
  const resolveItemDiscounts = (it) => {
    let base = Number(it?.basePrice) || 0
    if (!base || base <= 0) {
      const matchCat = feeCategories.find(c => (c.name || '').toLowerCase() === (it?.name || '').toLowerCase())
      if (matchCat && matchCat.defaultPrice) {
        base = Number(matchCat.defaultPrice)
      } else {
        base = Number(it?.total) || 0
      }
    }

    let discountIds = []
    if (Array.isArray(it?.discounts) && it.discounts.length > 0) {
      discountIds = it.discounts.map(d => String(d.id || d.discountId)).filter(Boolean)
    } else if (it?.discountId) {
      discountIds = [String(it.discountId)]
    } else if (base > Number(it?.total || 0) && base > 0) {
      const diff = round2(base - Number(it?.total || 0))
      const diffPct = round2((diff / base) * 100)
      const matched = discountDefs.find(d => {
        if (d.type === 'percent') return Math.abs(Number(d.value) - diffPct) < 0.5
        if (d.type === 'fixed') return Math.abs(Number(d.value) - diff) < 1
        return false
      })
      if (matched) discountIds = [String(matched.id)]
    }

    const calc = calculateMultiDiscounts(base, discountIds)
    return { ...calc, discountIds }
  }

  // Handle category button selection in modal
  const handleCategorySelect = (catId) => {
    const cat = feeCategories.find(c => String(c.id) === String(catId))
    if (!cat) return
    const base = Number(cat.defaultPrice) || 0
    setItemForm(prev => ({
      ...prev,
      categoryId: String(cat.id),
      name: cat.name,
      basePrice: base
    }))
  }

  const addDiscountRow = () => {
    const unused = discountDefs.find(d => !itemForm.discountIds.includes(String(d.id)))
    const pickId = unused ? String(unused.id) : (discountDefs[0] ? String(discountDefs[0].id) : '')
    setItemForm(prev => ({
      ...prev,
      discountIds: [...prev.discountIds, pickId]
    }))
  }

  const updateDiscountRow = (index, newDId) => {
    setItemForm(prev => {
      const next = [...prev.discountIds]
      next[index] = String(newDId)
      return { ...prev, discountIds: next }
    })
  }

  const removeDiscountRow = (index) => {
    setItemForm(prev => ({
      ...prev,
      discountIds: prev.discountIds.filter((_, i) => i !== index)
    }))
  }

  const openAdd = () => {
    if (!selStudent) return
    const firstCat = feeCategories[0]
    const base = firstCat ? (Number(firstCat.defaultPrice) || 0) : 0
    setItemForm({
      categoryId: firstCat ? String(firstCat.id) : '',
      name: firstCat ? firstCat.name : '',
      basePrice: base,
      downPayment: 0,
      discountIds: [],
      installments: 10,
      start: defaultFullDate
    })
    setEditItemIdx(null)
    setModalOpen(true)
  }

  const openEdit = (idx) => {
    if (!selStudent) return
    const it = selStudent.items?.[idx]
    if (!it) return

    const res = resolveItemDiscounts(it)
    const catMatch = feeCategories.find(c => (c.name || '').toLowerCase() === (it.name || '').toLowerCase())

    let resolvedStart = it.start || defaultFullDate
    if (resolvedStart.length === 7) resolvedStart = `${resolvedStart}-15`

    setItemForm({
      categoryId: catMatch ? String(catMatch.id) : '',
      name: it.name || '',
      basePrice: res.basePrice,
      downPayment: Math.max(0, Number(it.downPayment) || 0),
      discountIds: res.discountIds,
      installments: Number(it.installments) || 10,
      start: resolvedStart
    })
    setEditItemIdx(idx)
    setModalOpen(true)
  }

  const currentModalCalc = useMemo(() => {
    return calculateMultiDiscounts(itemForm.basePrice, itemForm.discountIds)
  }, [itemForm.basePrice, itemForm.discountIds, discountDefs])

  const saveItem = () => {
    if (!selStudent) return
    if (!itemForm.name.trim()) { toast('Kalem adı boş olamaz.'); return }
    if (Number(currentModalCalc.finalPrice) <= 0) { toast('Tutar sıfırdan büyük olmalı.'); return }
    if (!itemForm.start) { toast('Vade başlangıç tarihi seçiniz.'); return }
    const downPayment = round2(Number(itemForm.downPayment) || 0)
    if (downPayment < 0 || downPayment >= Number(currentModalCalc.finalPrice)) {
      toast('Peşinat, net tutardan küçük olmalıdır.'); return
    }

    const applied = currentModalCalc.applied
    const names = applied.map(a => a.name).join(' + ')
    const labels = applied.map(a => a.label).join(' + ')

    const newItem = {
      name: itemForm.name.trim(),
      total: Number(currentModalCalc.finalPrice) || 0,
      basePrice: Number(itemForm.basePrice) || Number(currentModalCalc.finalPrice) || 0,
      downPayment,
      discountId: applied[0]?.id || '',
      discountName: names,
      discountLabel: labels,
      discounts: applied.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        value: a.value,
        amount: a.amount
      })),
      installments: Math.max(1, Number(itemForm.installments) || 1),
      start: itemForm.start
    }

    const items = [...(selStudent.items || [])]
    if (editItemIdx !== null) {
      items[editItemIdx] = newItem
    } else {
      items.push(newItem)
    }

    actions.updateStudentAndSave({ id: selStudent.id, items })
    setModalOpen(false)
    toast(editItemIdx !== null ? 'Ücret planı güncellendi.' : 'Ücret planı eklendi.')
  }

  const delItem = (idx) => {
    if (!selStudent) return
    const it = selStudent.items?.[idx]
    if (!it) return
    if (!window.confirm(`"${it.name}" kalemi silinsin mi?`)) return
    const items = [...selStudent.items]
    items.splice(idx, 1)
    actions.updateStudent({ id: selStudent.id, items })
    if (selectedPlanIdx >= items.length) setSelectedPlanIdx(Math.max(0, items.length - 1))
    toast('Kalem silindi.')
  }

  // =========================================================================
  // STRICT 1-TO-1 INSTALLMENT COLLECTION MATCHING (NO DOUBLE-COUNTING BUG)
  // =========================================================================
  const installmentList = useMemo(() => {
    if (!selStudent || !activePlan) return []
    const count = Math.max(1, Number(activePlan.installments) || 1)
    const total = Number(activePlan.total) || 0
    const downPayment = round2(Math.max(0, Number(activePlan.downPayment) || 0))
    const perInstallment = round2(total / count)
    const startDate = activePlan.start
      ? (activePlan.start.length === 7 ? `${activePlan.start}-15` : activePlan.start)
      : defaultFullDate
    const today = new Date().toISOString().slice(0, 10)

    // Skipped installments (devamsızlık)
    const skippedSet = {}
    if (Array.isArray(activePlan.skippedInstallments)) {
      activePlan.skippedInstallments.forEach(s => { skippedSet[s.no] = s })
    }

    // Filter collections strictly for this student and this plan
    const planCols = collections.filter(c =>
      String(c.studentId) === String(selStudent.id) &&
      (!c.item || c.item.trim().toLowerCase() === activePlan.name.trim().toLowerCase())
    )

    // Map collections with an explicit installmentNo
    const explicitCols = {}
    const unassignedCols = []

    planCols.forEach(c => {
      const instNo = Number(c.installmentNo)
      if (Number.isInteger(instNo) && instNo <= count && (instNo > 0 || (downPayment > 0 && instNo === 0))) {
        if (!explicitCols[instNo]) explicitCols[instNo] = []
        explicitCols[instNo].push(c)
      } else {
        unassignedCols.push(c)
      }
    })

    // Unassigned pool for legacy collections that had NO installmentNo
    let unassignedPool = unassignedCols.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
    const downPaymentPaid = round2((explicitCols[0] || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0))
    const downPaymentCredit = round2(downPaymentPaid / count)

    const list = []
    for (let i = 0; i < count; i++) {
      const installmentNo = i + 1
      const dueDate = addMonthsToDate(startDate, i)
      const skipInfo = skippedSet[installmentNo] || null

      if (skipInfo) {
        const isFull = (skipInfo.period || 'full') === 'full'
        const deductedAmount = Number(skipInfo.deductedAmount) != null
          ? Number(skipInfo.deductedAmount)
          : (isFull ? perInstallment : round2(perInstallment / 2))

        // Eğer tam ay ise VEYA düşülen tutar taksitin tamamını karşılıyorsa
        if (isFull || deductedAmount >= perInstallment) {
          list.push({
            installmentNo,
            dueDate,
            dueDateFormatted: formatTrFullDate(dueDate),
            amount: 0,
            originalAmount: perInstallment,
            paid: 0,
            remaining: 0,
            isPaid: true,
            isSkipped: true,
            isPartialSkip: false,
            skipReason: skipInfo.reason || 'Devamsızlık',
            skipPeriod: 'full',
            skipDate: skipInfo.date || '',
            deductedAmount,
            isOverdue: false,
            isDueToday: false,
            daysOverdue: 0,
            collectionDate: '',
            paymentMethod: '',
            collections: []
          })
          continue
        }

        // Kısmi (Yarım Ay / Gün bazlı) devamsızlık: kalan tutar veli tarafından ödenir!
        const effectiveAmount = round2(Math.max(0, perInstallment - deductedAmount))
        const directMatches = explicitCols[installmentNo] || []
        let paid = downPaymentCredit
        let collectionDate = ''
        let paymentMethod = ''
        let matchedCollections = []

        if (directMatches.length > 0) {
          paid = directMatches.reduce((s, c) => s + (Number(c.amount) || 0), 0)
          collectionDate = directMatches[0].date || ''
          paymentMethod = [downPaymentPaid > 0 ? 'Peşin İşlem' : '', directMatches.map(c => c.payment).filter(Boolean).join(' / ')].filter(Boolean).join(' / ') || 'Nakit'
          matchedCollections = directMatches
        } else if (unassignedPool > 0) {
          if (unassignedPool >= effectiveAmount) {
            paid = effectiveAmount
            unassignedPool = round2(unassignedPool - effectiveAmount)
          } else {
            paid = unassignedPool
            unassignedPool = 0
          }
          collectionDate = unassignedCols[0]?.date || ''
          paymentMethod = [downPaymentPaid > 0 ? 'Peşin İşlem' : '', unassignedCols[0]?.payment].filter(Boolean).join(' / ') || 'Nakit'
          matchedCollections = unassignedCols
        }

        const remaining = round2(Math.max(0, effectiveAmount - paid))
        const isPaid = remaining <= 0
        const isOverdue = !isPaid && dueDate < today
        const isDueToday = !isPaid && dueDate === today
        let daysOverdue = 0
        if (isOverdue) {
          const d1 = new Date(today)
          const d2 = new Date(dueDate)
          daysOverdue = Math.max(1, Math.floor((d1 - d2) / (1000 * 60 * 60 * 24)))
        }

        list.push({
          installmentNo,
          dueDate,
          dueDateFormatted: formatTrFullDate(dueDate),
          amount: effectiveAmount,
          originalAmount: perInstallment,
          paid,
          remaining,
          isPaid,
          isSkipped: true,
          isPartialSkip: true,
          skipReason: skipInfo.reason || 'Devamsızlık',
          skipPeriod: 'half',
          skipDate: skipInfo.date || '',
          startDate: skipInfo.startDate,
          endDate: skipInfo.endDate,
          absentDays: skipInfo.absentDays,
          monthDays: skipInfo.monthDays,
          deductedAmount,
          isOverdue,
          isDueToday,
          daysOverdue,
          collectionDate,
          paymentMethod,
          collections: matchedCollections
        })
        continue
      }

      const directMatches = explicitCols[installmentNo] || []
      let paid = downPaymentCredit
      let collectionDate = ''
      let paymentMethod = ''
      let matchedCollections = []

      // 1. Direct match by installmentNo (PRIMARY & STRICT)
      if (directMatches.length > 0) {
        paid = directMatches.reduce((s, c) => s + (Number(c.amount) || 0), 0)
        collectionDate = directMatches[0].date || ''
        paymentMethod = [downPaymentPaid > 0 ? 'Peşin İşlem' : '', directMatches.map(c => c.payment).filter(Boolean).join(' / ')].filter(Boolean).join(' / ') || 'Nakit'
        matchedCollections = directMatches
      }
      // 2. Only unassigned legacy collections can fill unassigned slots (NO double-counting!)
      else if (unassignedPool > 0) {
        if (unassignedPool >= perInstallment) {
          paid = perInstallment
          unassignedPool = round2(unassignedPool - perInstallment)
        } else {
          paid = unassignedPool
          unassignedPool = 0
        }
        collectionDate = unassignedCols[0]?.date || ''
        paymentMethod = [downPaymentPaid > 0 ? 'Peşin İşlem' : '', unassignedCols[0]?.payment].filter(Boolean).join(' / ') || 'Nakit'
        matchedCollections = unassignedCols
      }

      const remaining = round2(Math.max(0, perInstallment - paid))
      const isPaid = remaining <= 0

      // Overdue calculation based on exact date
      const isOverdue = !isPaid && dueDate < today
      const isDueToday = !isPaid && dueDate === today
      let daysOverdue = 0
      if (isOverdue) {
        const d1 = new Date(today)
        const d2 = new Date(dueDate)
        daysOverdue = Math.max(1, Math.floor((d1 - d2) / (1000 * 60 * 60 * 24)))
      }

      list.push({
        installmentNo,
        dueDate,
        dueDateFormatted: formatTrFullDate(dueDate),
        amount: perInstallment,
        paid,
        remaining,
        isPaid,
        isSkipped: false,
        isOverdue,
        isDueToday,
        daysOverdue,
        collectionDate,
        paymentMethod,
        collections: matchedCollections
      })
    }
    return list
  }, [selStudent, activePlan, collections, defaultFullDate])

  const downPaymentInfo = useMemo(() => {
    if (!selStudent || !activePlan) return null
    const amount = round2(Math.max(0, Number(activePlan.downPayment) || 0))
    if (amount <= 0) return null
    const paymentCollections = collections.filter(c =>
      String(c.studentId) === String(selStudent.id) &&
      (!c.item || c.item.trim().toLowerCase() === activePlan.name.trim().toLowerCase()) &&
      Number(c.installmentNo) === 0
    )
    const paid = round2(paymentCollections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0))
    return {
      amount,
      paid: Math.min(amount, paid),
      remaining: round2(Math.max(0, amount - paid)),
      collections: paymentCollections
    }
  }, [selStudent, activePlan, collections])

  // =========================================================================
  // ALL OVERDUE INSTALLMENTS ACROSS ALL STUDENTS AND PLANS
  // =========================================================================
  const allOverdueInstallments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const result = []

    students.forEach(student => {
      const items = student.items || []
      items.forEach(plan => {
        const count = Math.max(1, Number(plan.installments) || 1)
        const total = Number(plan.total) || 0
        const downPayment = round2(Math.max(0, Number(plan.downPayment) || 0))
        const perInstallment = round2(total / count)
        const startDate = plan.start
          ? (plan.start.length === 7 ? `${plan.start}-15` : plan.start)
          : defaultFullDate

        // Filter collections for this student + plan
        const planCols = collections.filter(c =>
          String(c.studentId) === String(student.id) &&
          (!c.item || c.item.trim().toLowerCase() === plan.name.trim().toLowerCase())
        )

        const explicitCols = {}
        const unassignedCols = []
        planCols.forEach(c => {
          const instNo = Number(c.installmentNo)
          if (Number.isInteger(instNo) && instNo <= count && (instNo > 0 || (downPayment > 0 && instNo === 0))) {
            if (!explicitCols[instNo]) explicitCols[instNo] = []
            explicitCols[instNo].push(c)
          } else {
            unassignedCols.push(c)
          }
        })
        let unassignedPool = unassignedCols.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
        const downPaymentPaid = round2((explicitCols[0] || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0))
        const downPaymentCredit = round2(downPaymentPaid / count)

        for (let i = 0; i < count; i++) {
          const installmentNo = i + 1
          const dueDate = addMonthsToDate(startDate, i)

          const directMatches = explicitCols[installmentNo] || []
          let paid = downPaymentCredit
          if (directMatches.length > 0) {
            paid = directMatches.reduce((s, c) => s + (Number(c.amount) || 0), 0)
          } else if (unassignedPool > 0) {
            if (unassignedPool >= perInstallment) {
              paid = perInstallment
              unassignedPool = round2(unassignedPool - perInstallment)
            } else {
              paid = unassignedPool
              unassignedPool = 0
            }
          }

          const remaining = round2(Math.max(0, perInstallment - paid))
          const isPaid = remaining <= 0
          const isOverdue = !isPaid && dueDate < today

          if (isOverdue) {
            const d1 = new Date(today)
            const d2 = new Date(dueDate)
            const daysOverdue = Math.max(1, Math.floor((d1 - d2) / (1000 * 60 * 60 * 24)))
            result.push({
              student,
              planName: plan.name,
              installmentNo,
              dueDate,
              dueDateFormatted: formatTrFullDate(dueDate),
              amount: perInstallment,
              paid,
              remaining,
              collections: directMatches,
              daysOverdue
            })
          }
        }
      })
    })

    // Sort: most overdue first, then by student name
    result.sort((a, b) => {
      if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue
      return (a.student.name || '').localeCompare(b.student.name || '', 'tr')
    })
    return result
  }, [students, collections, defaultFullDate])

  // Open the collection modal to collect an unpaid installment
  const openCollectModal = (inst) => {
    if (!selStudent || !activePlan) return
    setCollectForm({
      studentId: selStudent.id,
      planName: activePlan.name,
      installmentNo: inst.installmentNo,
      dueDate: inst.dueDate,
      dueAmount: inst.amount,
      amount: inst.remaining > 0 ? inst.remaining : inst.amount,
      collections: inst.collections || [],
      date: new Date().toISOString().slice(0, 10),
      payment: 'Nakit',
      note: `${activePlan.name} ${inst.installmentNo}. Taksit Tahsilatı`
    })
    setCollectModalOpen(true)
  }

  const openDownPaymentModal = () => {
    if (!selStudent || !activePlan || !downPaymentInfo) return
    if (downPaymentInfo.remaining <= 0 && downPaymentInfo.collections.length > 0) {
      openEditCollectionModal({
        installmentNo: 0,
        dueDateFormatted: 'Peşin İşlem',
        amount: downPaymentInfo.amount,
        collections: downPaymentInfo.collections
      })
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    setCollectForm({
      studentId: selStudent.id,
      planName: activePlan.name,
      installmentNo: 0,
      dueDate: today,
      dueAmount: downPaymentInfo.amount,
      amount: downPaymentInfo.remaining,
      collections: downPaymentInfo.collections,
      date: today,
      payment: 'Nakit',
      note: `${activePlan.name} Peşin İşlem Tahsilatı`
    })
    setCollectModalOpen(true)
  }

  // Navigate from overdue modal row → select student+plan → open collect modal
  const openCollectModalFromOverdue = (row) => {
    const student = row.student
    const planIdx = (student.items || []).findIndex(
      it => (it.name || '').trim().toLowerCase() === (row.planName || '').trim().toLowerCase()
    )
    const resolvedPlanIdx = planIdx >= 0 ? planIdx : 0

    // 1. Close overdue modal
    setOverdueModalOpen(false)

    // 2. Select student and plan
    setSelStudentId(String(student.id))
    setSelectedPlanIdx(resolvedPlanIdx)

    // 3. Open collect modal with a short delay so state settles
    setTimeout(() => {
      const plan = (student.items || [])[resolvedPlanIdx]
      if (!plan) return
      setCollectForm({
        studentId: student.id,
        planName: plan.name,
        installmentNo: row.installmentNo,
        dueDate: row.dueDate,
        dueAmount: row.amount,
        amount: row.remaining > 0 ? row.remaining : row.amount,
        collections: row.collections || [],
        date: new Date().toISOString().slice(0, 10),
        payment: 'Nakit',
        note: `${plan.name} ${row.installmentNo}. Taksit Tahsilatı`
      })
      setCollectModalOpen(true)
    }, 80)
  }


  // Save new installment collection
  const saveInstallmentCollection = () => {
    const amt = Number(collectForm.amount) || 0
    if (amt <= 0) { toast('Geçerli bir tahsilat tutarı giriniz.'); return }
    if (!collectForm.date) { toast('Tahsilat tarihi seçiniz.'); return }

    const currentInstallment = installmentList.find(i => Number(i.installmentNo) === Number(collectForm.installmentNo))
    const maxCollectable = Number(collectForm.installmentNo) === 0
      ? Number(downPaymentInfo?.remaining || 0)
      : (Number(currentInstallment?.remaining ?? collectForm.dueAmount) || 0)
    if (amt > maxCollectable + 0.01) {
      toast(`Fazla tahsilat yapılamaz. En fazla ${money(maxCollectable)} alabilirsiniz.`)
      return
    }

    const vatEligible = isCollectionInvoiced(state, { item: collectForm.planName }, selStudent)
    const vatRate = vatEligible ? Number(state?.settings?.vat || 0) : 0
    const vat = vatEligible ? round2(amt * (vatRate / (100 + vatRate))) : 0

    const newCol = {
      id: Date.now(),
      studentId: selStudent.id,
      date: collectForm.date,
      item: collectForm.planName,
      amount: amt,
      vatRate,
      vat,
      payment: collectForm.payment || 'Nakit',
      installmentNo: collectForm.installmentNo,
      note: collectForm.note || (Number(collectForm.installmentNo) === 0
        ? `${collectForm.planName} Peşin İşlem Tahsilatı`
        : `${collectForm.planName} ${collectForm.installmentNo}. Taksit Tahsilatı`)
    }

    actions.addCollection(newCol)
    setCollectModalOpen(false)
    toast(Number(collectForm.installmentNo) === 0
      ? '🎉 Peşin işlem tahsilatı başarıyla kaydedildi.'
      : `🎉 ${collectForm.installmentNo}. Taksit tahsilatı başarıyla kaydedildi.`)
  }

  // Open edit / delete modal for an existing collected installment
  const openEditCollectionModal = (inst, selectedCollection = null) => {
    const collectionsForInstallment = Array.isArray(inst.collections) ? inst.collections : []
    const col = selectedCollection || collectionsForInstallment[0]
    if (!col) return
    setEditCollectionForm({
      id: col.id || col._id,
      installmentNo: inst.installmentNo,
      planName: activePlan.name,
      dueDate: inst.dueDateFormatted,
      collections: collectionsForInstallment,
      date: col.date || new Date().toISOString().slice(0, 10),
      amount: Number(col.amount) || inst.amount,
      payment: col.payment || 'Nakit',
      note: col.note || ''
    })
    setEditCollectionModalOpen(true)
  }

  const openPreviousCollectionForEdit = (collection) => {
    setCollectModalOpen(false)
    openEditCollectionModal({
      installmentNo: collectForm.installmentNo,
      dueDateFormatted: formatTrFullDate(collectForm.dueDate),
      amount: collectForm.dueAmount,
      collections: collectForm.collections
    }, collection)
  }

  const selectCollectionForEdit = (collection) => {
    setEditCollectionForm(prev => ({
      ...prev,
      id: collection.id || collection._id,
      date: collection.date || new Date().toISOString().slice(0, 10),
      amount: Number(collection.amount) || 0,
      payment: collection.payment || 'Nakit',
      note: collection.note || ''
    }))
  }

  // Save edited collection details (e.g. change Nakit to Havale/EFT or fix date)
  const saveEditedCollection = () => {
    if (!editCollectionForm.id) return
    const amt = Number(editCollectionForm.amount) || 0
    if (amt <= 0) { toast('Tutar sıfırdan büyük olmalıdır.'); return }
    if (!editCollectionForm.date) { toast('Tahsilat tarihi seçiniz.'); return }

    const vatEligible = isCollectionInvoiced(state, { item: editCollectionForm.planName }, selStudent)
    const vatRate = vatEligible ? Number(state?.settings?.vat || 0) : 0
    const vat = vatEligible ? round2(amt * (vatRate / (100 + vatRate))) : 0

    actions.updateCollection({
      id: editCollectionForm.id,
      date: editCollectionForm.date,
      amount: amt,
      payment: editCollectionForm.payment,
      note: editCollectionForm.note,
      vatRate,
      vat
    })
    setEditCollectionModalOpen(false)
    toast('✓ Tahsilat bilgileri başarıyla güncellendi.')
  }

  // Delete an existing collection (undo / delete payment)
  const deleteExistingCollection = () => {
    if (!editCollectionForm.id) return
    if (!window.confirm(`${editCollectionForm.installmentNo}. taksite ait bu tahsilatı silmek istediğinize emin misiniz?\n\nTaksit tekrar 'Ödenmedi' durumuna dönecektir.`)) return

    actions.deleteCollection(editCollectionForm.id)
    setEditCollectionModalOpen(false)
    toast('🗑️ Tahsilat silindi. Taksit tekrar tahsilata açıldı.')
  }

  // Open skip (devamsızlık) modal for an unpaid installment
  const openSkipModal = (inst) => {
    let y = new Date().getFullYear()
    let m = new Date().getMonth() + 1
    if (inst?.dueDate && typeof inst.dueDate === 'string' && inst.dueDate.includes('-')) {
      const parts = inst.dueDate.split('-')
      if (parts.length >= 2) {
        y = parseInt(parts[0], 10) || y
        m = parseInt(parts[1], 10) || m
      }
    }
    const daysInMonth = new Date(y, m, 0).getDate()
    const padM = String(m).padStart(2, '0')
    const defStart = `${y}-${padM}-01`
    const defEnd = `${y}-${padM}-15`

    const count = Math.max(1, Number(activePlan?.installments) || 1)
    const total = Number(activePlan?.total) || 0
    const perInst = round2(total / count)
    const absentDays = 15
    const deduction = round2((perInst / daysInMonth) * absentDays)

    setSkipForm({
      installmentNo: inst.installmentNo,
      reason: 'Devamsızlık',
      date: new Date().toISOString().slice(0, 10),
      period: 'half', // Kullanıcı yarım ay takvimini hemen görsün veya toggle ile seçsin
      dueDate: inst.dueDate,
      year: y,
      month: m,
      monthDays: daysInMonth,
      startDate: defStart,
      endDate: defEnd,
      absentDays,
      perInst,
      deduction
    })
    setSkipModalOpen(true)
  }

  // Tarih aralığı değiştikçe gün sayısını ve kesintiyi güncelleyen yardımcı fonksiyon
  const handleSkipDateChange = (newStart, newEnd) => {
    setSkipForm(prev => {
      const s = newStart || prev.startDate
      const e = newEnd || prev.endDate
      const sDate = new Date(s + 'T00:00:00')
      const eDate = new Date(e + 'T00:00:00')
      let absentDays = 0
      if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime()) && eDate >= sDate) {
        absentDays = Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      }
      const daysInMonth = prev.monthDays || 30
      const perInst = prev.perInst || 0
      const clampedDays = Math.min(daysInMonth, Math.max(1, absentDays))
      const deduction = round2((perInst / daysInMonth) * clampedDays)
      return {
        ...prev,
        startDate: s,
        endDate: e,
        absentDays: clampedDays,
        deduction
      }
    })
  }

  // Save skip: stores {no, reason, date, period, startDate, endDate, absentDays, monthDays, deductedAmount}
  const saveSkipInstallment = () => {
    if (!selStudent || !activePlan) return
    const items = selStudent.items ? [...selStudent.items] : []
    const planIdx = selectedPlanIdx
    const plan = { ...items[planIdx] }

    const count = Math.max(1, Number(plan.installments) || 1)
    const total = Number(plan.total) || 0
    const perInst = round2(total / count)
    const daysInMonth = skipForm.monthDays || 30

    let deduction = perInst
    let absentDays = daysInMonth
    if (skipForm.period === 'half') {
      absentDays = Math.max(1, Math.min(daysInMonth, skipForm.absentDays || 1))
      deduction = round2((perInst / daysInMonth) * absentDays)
      deduction = Math.min(perInst, deduction)
    }

    const skipped = Array.isArray(plan.skippedInstallments) ? [...plan.skippedInstallments] : []
    const filtered = skipped.filter(s => s.no !== skipForm.installmentNo)
    filtered.push({
      no: skipForm.installmentNo,
      reason: skipForm.reason,
      date: skipForm.date,
      period: skipForm.period,
      startDate: skipForm.startDate,
      endDate: skipForm.endDate,
      absentDays,
      monthDays: daysInMonth,
      deductedAmount: deduction,
      originalAmount: perInst
    })
    plan.skippedInstallments = filtered

    // Bakiyeden düş
    plan.total = round2(Math.max(0, Number(plan.total) - deduction))

    items[planIdx] = plan
    actions.updateStudent({ id: selStudent.id, items })
    setSkipModalOpen(false)

    const label = skipForm.period === 'half'
      ? `Yarım ay (${absentDays} gün, -${money(deduction)})`
      : `Tam ay (-${money(deduction)})`
    toast(`✓ ${skipForm.installmentNo}. taksit için ${label} devamsızlık uygulandı ve bakiyeden düşüldü.`)
  }

  // Unskip: restore a previously skipped installment
  const unskipInstallment = (installmentNo) => {
    if (!selStudent || !activePlan) return
    if (!window.confirm(`${installmentNo}. taksit devamsızlık kaydı kaldırılsın mı?\n\nTaksit yeniden ödeme listesine eklenecek ve bakiyeye geri yansıyacaktır.`)) return

    const items = selStudent.items ? [...selStudent.items] : []
    const planIdx = selectedPlanIdx
    const plan = { ...items[planIdx] }

    const skipped = Array.isArray(plan.skippedInstallments) ? plan.skippedInstallments : []
    const skipRecord = skipped.find(s => s.no === installmentNo)
    plan.skippedInstallments = skipped.filter(s => s.no !== installmentNo)

    // Restore the exact deducted amount (or fallback) back to total
    const originalPerInst = round2(Number(activePlan.basePrice || activePlan.total) / Math.max(1, Number(activePlan.installments)))
    const restore = skipRecord?.deductedAmount != null
      ? Number(skipRecord.deductedAmount)
      : (skipRecord?.period === 'half' ? round2(originalPerInst / 2) : originalPerInst)

    plan.total = round2(Number(plan.total) + restore)

    items[planIdx] = plan
    actions.updateStudent({ id: selStudent.id, items })
    toast(`↩ ${installmentNo}. taksit devamsızlık kaydı kaldırıldı (+${money(restore)} iade edildi).`)
  }

  const pt = selStudent ? planTableFor(state, selStudent) : null

  // Styles
  const th = {
    padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#475569',
    background: '#f8fafc', borderBottom: '1px solid #e6ebf3', textAlign: 'left'
  }
  const td = {
    padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle'
  }
  const tbl = { width: '100%', borderCollapse: 'collapse' }

  // Student Card component (for sidebar and compact dropdown list)
  const renderStudentCard = (s) => {
    const planned = expectedTotalFor(state, s.id)
    const collected = collectedAll(state, s.id)
    const remaining = planned - collected
    const isSelected = String(selStudentId) === String(s.id)

    return (
      <div
        key={s.id}
        onClick={() => {
          setSelStudentId(String(s.id))
          if (isCompact) setShowStudentListMobile(false)
        }}
        style={{
          padding: '10px 12px',
          cursor: 'pointer',
          borderRadius: 12,
          border: isSelected ? '2px solid #6366f1' : '1px solid #f1f5f9',
          background: isSelected ? 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.04))' : '#fff',
          transition: 'all 0.15s ease',
          boxShadow: isSelected ? '0 2px 8px rgba(99,102,241,0.12)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: isSelected ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#e2e8f0',
            color: isSelected ? '#fff' : '#475569',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 13
          }}>
            {(s.name || 'Ö')[0]?.toUpperCase()}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontWeight: 700, fontSize: 13,
              color: isSelected ? '#4338ca' : '#0f172a',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {s.name}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
              {s.class ? `Sınıf: ${s.class}` : 'Sınıf belirtilmemiş'}
            </div>
            {s._schoolName && (
              <span style={{
                display: 'inline-block',
                fontSize: 10,
                fontWeight: 700,
                marginTop: 3,
                padding: '1px 6px',
                borderRadius: 6,
                background: 'rgba(99,102,241,0.08)',
                color: '#4f46e5',
                border: '1px solid rgba(99,102,241,0.2)'
              }}>
                🏫 {s._schoolName}
              </span>
            )}
          </div>
        </div>

        <div style={{
          marginTop: 6, paddingTop: 6, borderTop: '1px dashed #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>Kalan:</span>
          <span style={{
            fontSize: 12, fontWeight: 800,
            color: remaining > 0 ? '#e11d48' : '#059669'
          }}>
            {remaining === 0 && planned > 0 ? '✓ Tamamlandı' : money(remaining)}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
      
      {/* Page Title */}
      <div className="ak-page-header" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 22, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>💳</span> Ücret &amp; Taksit Yönetimi
        </h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
          Planlara tıklayarak alt alta taksit dökümünü görüntüleyin, vade gecikmelerini takip edin, tahsilat yapın veya eski tahsilatları düzenleyin
        </p>
      </div>

      {isAdminPanelMode && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 14,
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.2)',
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span style={{ fontSize: 18 }}>🏢</span>
          <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>
            Süper Admin Paneli modundasınız. Tüm okulların ücret ve taksit planları listelenmektedir. Belirli bir okul için sağdaki listeden veya üstten filtreleme yapabilirsiniz.
          </div>
        </div>
      )}

      {/* COMPACT SCREEN: Quick Student Switcher Bar */}
      {isCompact && (
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
          padding: '10px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
              👤 Seçili Öğrenci:
            </span>
            <select
              style={{
                ...InputCls,
                padding: '7px 10px',
                fontSize: 13,
                fontWeight: 700,
                color: '#1e293b',
                background: '#f8fafc',
                flex: 1
              }}
              value={selStudentId || ''}
              onChange={e => setSelStudentId(e.target.value)}
            >
              {orderedStudents.map(s => (
                <option key={s.id} value={String(s.id)}>
                  {s.name} {s.class ? `(${s.class})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowStudentListMobile(v => !v)}
            style={{
              ...Btn,
              background: showStudentListMobile ? '#e0e7ff' : '#f1f5f9',
              color: showStudentListMobile ? '#4338ca' : '#475569',
              padding: '7px 12px', fontSize: 12, fontWeight: 700, border: '1px solid #cbd5e1'
            }}
          >
            👥 {showStudentListMobile ? 'Listeyi Gizle ▲' : `Tüm Öğrenciler (${students.length}) ▼`}
          </button>
        </div>
      )}

      {/* COMPACT SCREEN: Expanded Student List Panel */}
      {isCompact && showStudentListMobile && (
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
          padding: '14px', marginBottom: 16, boxShadow: '0 4px 14px rgba(15,23,42,0.08)'
        }}>
          {(isAdminPanelMode || (accessibleTenants && accessibleTenants.length > 0)) && (
            <div style={{ marginBottom: 10 }}>
              <select
                value={selectedSchoolId}
                onChange={e => setSelectedSchoolId(e.target.value)}
                style={{ ...InputCls, padding: '7px 10px', fontSize: 12, background: '#fff', cursor: 'pointer' }}
              >
                <option value="">🏫 Tüm Okullar ({accessibleTenants?.length || 'Tümü'})</option>
                {accessibleTenants?.map(t => (
                  <option key={t.id || t._id} value={t.id || t._id}>🏫 {t.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>👥 Öğrenci Listesi ({filteredStudents.length})</div>
            <input
              type="text"
              placeholder="🔍 Ara..."
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              style={{ ...InputCls, width: 180, padding: '5px 10px', fontSize: 12 }}
            />
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8,
            maxHeight: 300, overflowY: 'auto', padding: 2
          }}>
            {filteredStudents.map(renderStudentCard)}
          </div>
        </div>
      )}

      {/* Responsive layout */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ============================================================ */}
        {/* MAIN DETAIL AREA                                             */}
        {/* ============================================================ */}
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          {!selStudent ? (
            <div style={{
              background: '#fff', borderRadius: 16, border: '1px solid #e6ebf3',
              padding: '70px 20px', textAlign: 'center', color: '#94a3b8',
              boxShadow: '0 1px 4px rgba(15,23,42,0.04)'
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💳</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#334155', marginBottom: 6 }}>
                Öğrenci Seçiniz
              </div>
              <div style={{ fontSize: 13, color: '#64748b', maxWidth: 420, margin: '0 auto' }}>
                Öğrenci listesinden bir öğrenci seçerek eğitim ve taksit planını görüntüleyin.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Student Header Card */}
              <div style={{
                background: '#fff', borderRadius: 16, border: '1px solid #e6ebf3',
                boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
                padding: '16px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 17, boxShadow: '0 4px 10px rgba(99,102,241,0.25)'
                  }}>
                    {(selStudent.name || 'Ö')[0]?.toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                        {selStudent.name}
                      </h3>
                      {selStudent.class && (
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: '#e0e7ff', color: '#4338ca'
                        }}>
                          {selStudent.class}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 12, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {selStudent.parent && <span>👤 Veli: <strong>{selStudent.parent}</strong></span>}
                      {selStudent.phone && <span>📞 Tel: <strong>{selStudent.phone}</strong></span>}
                      {selStudent.tax && <span>🆔 TC: <strong>{selStudent.tax}</strong></span>}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                  {allOverdueInstallments.length > 0 && (
                    <button
                      id="btn-vadesi-gecmis"
                      onClick={() => setOverdueModalOpen(true)}
                      style={{
                        ...Btn,
                        background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                        color: '#fff',
                        padding: '9px 16px',
                        fontSize: 13,
                        boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
                        position: 'relative'
                      }}
                    >
                      <span style={{ fontSize: 15 }}>⚠️</span>
                      Vadesi Geçmiş
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: '#fff', color: '#dc2626', borderRadius: '50%',
                        width: 18, height: 18, fontSize: 10, fontWeight: 900, marginLeft: 2
                      }}>
                        {allOverdueInstallments.length}
                      </span>
                    </button>
                  )}
                  <button
                    id="btn-ucret-plani-ekle"
                    onClick={openAdd}
                    style={{
                      ...Btn,
                      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      color: '#fff',
                      padding: '9px 16px',
                      fontSize: 13,
                      boxShadow: '0 4px 14px rgba(99,102,241,0.3)'
                    }}
                  >
                    <span style={{ fontSize: 15 }}>+</span> Ücret Planı Ekle
                  </button>
                </div>
              </div>

              {/* Summary 4-Box Cards */}
              <div className="ak-stats-grid" style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10
              }}>
                {[
                  { label: 'Toplam Planlanan', val: money(pt?.totalExpected || 0), color: '#0f172a' },
                  { label: 'Tahsil Edilen', val: money(pt?.totalCollected || 0), color: '#059669' },
                  { label: 'Kalan Bakiye', val: money(pt?.totalRemaining || 0), color: (pt?.totalRemaining || 0) > 0 ? '#e11d48' : '#059669' },
                  { label: 'Kayıtlı Plan', val: `${(selStudent.items || []).length} Plan`, color: '#6366f1' }
                ].map(({ label, val, color }) => (
                  <div key={label} style={{
                    background: '#fff', borderRadius: 14, border: '1px solid #e6ebf3',
                    padding: '12px 14px', boxShadow: '0 1px 3px rgba(15,23,42,0.03)'
                  }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* ============================================================ */}
              {/* SECTION 1: CLICKABLE PLAN LIST                               */}
              {/* ============================================================ */}
              <div style={{
                background: '#fff', borderRadius: 16, border: '1px solid #e6ebf3',
                boxShadow: '0 1px 4px rgba(15,23,42,0.04)', overflow: 'hidden'
              }}>
                <div style={{
                  padding: '12px 18px', borderBottom: '1px solid #e6ebf3',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', gap: 12, flexWrap: 'wrap'
                }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
                      📋 Öğrencinin Ücret Planları
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                      (Taksitlerini görmek için plana tıklayın)
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {(selStudent.items || []).length} kayıtlı plan
                  </div>
                </div>

                <div style={{ padding: '12px 18px 0', display: 'flex', justifyContent: 'flex-end' }}>
                  <input
                    type="text"
                    placeholder="🔍 Plan ara: ad, başlangıç, tutar, taksit..."
                    value={planSearch}
                    onChange={e => setPlanSearch(e.target.value)}
                    style={{ ...InputCls, maxWidth: 300, background: '#fff' }}
                  />
                </div>

                <div className="ak-table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                  <table style={{ ...tbl, minWidth: 620 }}>
                    <thead>
                      <tr>
                        <th style={th}>
                          <button type="button" onClick={() => togglePlanSort('name')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                            Plan Adı {planSortKey === 'name' ? (planSortDir === 'asc' ? '↑' : '↓') : ''}
                          </button>
                        </th>
                        <th style={{ ...th, textAlign: 'right' }}>
                          <button type="button" onClick={() => togglePlanSort('basePrice')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                            Baz Fiyat {planSortKey === 'basePrice' ? (planSortDir === 'asc' ? '↑' : '↓') : ''}
                          </button>
                        </th>
                        <th style={th}>İndirim Durumu</th>
                        <th style={{ ...th, textAlign: 'right' }}>
                          <button type="button" onClick={() => togglePlanSort('total')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                            Net Tutar {planSortKey === 'total' ? (planSortDir === 'asc' ? '↑' : '↓') : ''}
                          </button>
                        </th>
                        <th style={{ ...th, textAlign: 'center' }}>
                          <button type="button" onClick={() => togglePlanSort('installments')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                            Taksit {planSortKey === 'installments' ? (planSortDir === 'asc' ? '↑' : '↓') : ''}
                          </button>
                        </th>
                        <th style={{ ...th, textAlign: 'right' }}>
                          <button type="button" onClick={() => togglePlanSort('month')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                            Aylık Tutar {planSortKey === 'month' ? (planSortDir === 'asc' ? '↑' : '↓') : ''}
                          </button>
                        </th>
                        <th style={th}>
                          <button type="button" onClick={() => togglePlanSort('start')} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
                            Başlangıç {planSortKey === 'start' ? (planSortDir === 'asc' ? '↑' : '↓') : ''}
                          </button>
                        </th>
                        <th style={{ ...th, textAlign: 'center', width: 130 }}>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selStudent.items || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '32px 12px' }}>
                            <div style={{ fontSize: 26, marginBottom: 6 }}>📝</div>
                            <div>Bu öğrenciye henüz bir ücret planı eklenmemiş.</div>
                            <div style={{ marginTop: 4, fontSize: 11 }}>
                              Sağ üstteki <strong>"+ Ücret Planı Ekle"</strong> butonuna tıklayarak yeni plan ekleyebilirsiniz.
                            </div>
                          </td>
                        </tr>
                      ) : visiblePlans.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '32px 12px' }}>
                            Plan ara sonuçlarına uygun kayıt bulunamadı.
                          </td>
                        </tr>
                      ) : visiblePlans.map((it) => {
                        const idx = selStudent.items.findIndex(p => p === it)
                        const itemCalc = resolveItemDiscounts(it)
                        const perMonth = round2(Number(it.total) / Math.max(1, it.installments))
                        const isSelectedPlan = selectedPlanIdx === idx

                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedPlanIdx(idx)}
                            style={{
                              cursor: 'pointer',
                              background: isSelectedPlan ? 'linear-gradient(135deg,rgba(99,102,241,0.07),rgba(139,92,246,0.03))' : 'transparent',
                              borderLeft: isSelectedPlan ? '4px solid #6366f1' : '4px solid transparent',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <td style={td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 800, color: isSelectedPlan ? '#4338ca' : '#0f172a', fontSize: 13 }}>
                                  {it.name}
                                </span>
                                {isSelectedPlan && (
                                  <span style={{
                                    padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800,
                                    background: '#e0e7ff', color: '#4338ca'
                                  }}>
                                    Seçili Plan
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ ...td, textAlign: 'right', color: '#64748b', fontSize: 13 }}>
                              {money(itemCalc.basePrice)}
                            </td>
                            <td style={td}>
                              {itemCalc.applied.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {itemCalc.applied.map((app, i) => (
                                      <span key={i} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 3,
                                        padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                        background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a'
                                      }}>
                                        🏷️ {app.name} ({app.label})
                                      </span>
                                    ))}
                                  </div>
                                  {itemCalc.applied.length > 1 && (
                                    <div style={{ fontSize: 11, color: '#b91c1c', fontWeight: 700 }}>
                                      Toplam: -{money(itemCalc.totalDiscount)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: 12 }}>— İndirim yok —</span>
                              )}
                            </td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: 13 }}>
                              {money(it.total)}
                            </td>
                            <td style={{ ...td, textAlign: 'center', color: '#334155', fontWeight: 700 }}>
                              {it.installments}
                            </td>
                            <td style={{ ...td, textAlign: 'right', color: '#4f46e5', fontWeight: 700 }}>
                              {money(perMonth)}
                            </td>
                            <td style={{ ...td, color: '#475569', fontSize: 12 }}>
                              {formatTrFullDate(it.start || ys)}
                            </td>
                            <td style={td} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button
                                  onClick={() => openEdit(idx)}
                                  style={{
                                    ...Btn, background: '#eef2ff', color: '#4338ca',
                                    padding: '4px 8px', fontSize: 11
                                  }}
                                >
                                  ✏️ Düzenle
                                </button>
                                <button
                                  onClick={() => delItem(idx)}
                                  style={{
                                    ...Btn, background: '#fee2e2', color: '#991b1b',
                                    padding: '4px 8px', fontSize: 11
                                  }}
                                >
                                  🗑️ Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ============================================================ */}
              {/* SECTION 2: VERTICAL INSTALLMENT LIST FOR SELECTED PLAN       */}
              {/* ============================================================ */}
              {activePlan && (
                <div style={{
                  background: '#fff', borderRadius: 16, border: '1px solid #e6ebf3',
                  boxShadow: '0 2px 8px rgba(15,23,42,0.06)', overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '14px 20px', borderBottom: '1px solid #e6ebf3',
                    background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>📅</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                          {activePlan.name} — Taksit Dökümü
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                          Toplam: {money(activePlan.total)} · {installmentList.length} Taksit · Vade Başlangıcı: {formatTrFullDate(activePlan.start || ys)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        background: installmentList.every(i => i.isPaid) ? '#dcfce7' : '#fee2e2',
                        color: installmentList.every(i => i.isPaid) ? '#15803d' : '#b91c1c'
                      }}>
                        {installmentList.filter(i => i.isPaid).length} / {installmentList.length} Taksit Tahsil Edildi
                      </div>
                    </div>
                  </div>

                  {downPaymentInfo && (
                    <div style={{
                      margin: '12px 20px 0', padding: '10px 12px', borderRadius: 10,
                      border: '1px solid #fde68a', background: '#fffbeb',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: 12, flexWrap: 'wrap'
                    }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e' }}>💰 Peşin İşlem</div>
                        <div style={{ fontSize: 11, color: '#78350f', marginTop: 2 }}>
                          Tutar: {money(downPaymentInfo.amount)} · Tahsil Edilen: {money(downPaymentInfo.paid)} · Kalan: {money(downPaymentInfo.remaining)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={openDownPaymentModal}
                        style={{
                          ...Btn, padding: '6px 10px', fontSize: 11,
                          background: downPaymentInfo.remaining > 0 ? '#f59e0b' : '#fef3c7',
                          color: downPaymentInfo.remaining > 0 ? '#fff' : '#92400e',
                          border: '1px solid #fcd34d'
                        }}
                      >
                        {downPaymentInfo.remaining > 0 ? '💰 Peşin Tahsil Et' : '🔍 Peşin İşlem Detayı'}
                      </button>
                    </div>
                  )}

                  <div className="ak-table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                    <table style={{ ...tbl, minWidth: 680 }}>
                      <thead>
                        <tr>
                          <th style={{ ...th, width: 80 }}>Taksit No</th>
                          <th style={th}>Vade Tarihi</th>
                          <th style={{ ...th, textAlign: 'right' }}>Tutar</th>
                          <th style={th}>Vade Durumu</th>
                          <th style={th}>Tahsilat Bilgisi</th>
                          <th style={{ ...th, textAlign: 'center', width: 140 }}>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installmentList.map(inst => (
                          <tr
                            key={inst.installmentNo}
                            style={{
                              background: inst.isSkipped
                                ? 'linear-gradient(135deg,#f8f9fa,#f1f5f9)'
                                : inst.isPaid
                                ? '#fcfdfc'
                                : inst.isOverdue
                                ? '#fffbfb'
                                : '#fff',
                              opacity: inst.isSkipped ? 0.75 : 1,
                              transition: 'background 0.1s'
                            }}
                          >
                            {/* Taksit No */}
                            <td style={td}>
                              <span style={{
                                fontWeight: 800,
                                color: inst.isSkipped ? '#94a3b8' : '#4f46e5',
                                background: inst.isSkipped ? '#f1f5f9' : '#eef2ff',
                                padding: '3px 8px', borderRadius: 6, fontSize: 12,
                                textDecoration: inst.isSkipped ? 'line-through' : 'none'
                              }}>
                                {inst.installmentNo}. Taksit
                              </span>
                            </td>

                            {/* Vade Tarihi */}
                            <td style={td}>
                              <div style={{ fontWeight: 700, color: inst.isSkipped ? '#94a3b8' : '#0f172a', fontSize: 13 }}>
                                {inst.dueDateFormatted}
                              </div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                {inst.dueDate}
                              </div>
                            </td>

                            {/* Taksit Tutarı */}
                            <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                              {inst.isSkipped ? (
                                inst.isPartialSkip ? (
                                  <div>
                                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13 }}>
                                      {money(inst.amount)}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#d97706', fontWeight: 700 }}>
                                      (-{money(inst.deductedAmount)} indirim)
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'line-through' }}>
                                    Muaf (₺0)
                                  </span>
                                )
                              ) : (
                                money(inst.amount)
                              )}
                            </td>

                            {/* Vade Durumu */}
                            <td style={td}>
                              {inst.isSkipped ? (
                                inst.isPartialSkip ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                                      background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a'
                                    }}>
                                      🚫 Yarım Ay ({inst.absentDays} Gün)
                                    </span>
                                    {inst.isPaid ? (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                                        background: '#dcfce7', color: '#15803d'
                                      }}>
                                        ✓ Kalan Ödendi
                                      </span>
                                    ) : inst.isOverdue ? (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                                        background: '#fee2e2', color: '#b91c1c'
                                      }}>
                                        ⚠️ Vadesi Geçti ({inst.daysOverdue}g)
                                      </span>
                                    ) : (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                                        background: '#f1f5f9', color: '#475569'
                                      }}>
                                        ⏳ Ödeme Bekliyor
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                                    background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0'
                                  }}>
                                    🚫 Tam Ay Devamsızlık
                                  </span>
                                )
                              ) : inst.isPaid ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                                  background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0'
                                }}>
                                  ✓ Tahsil Edildi
                                </span>
                              ) : inst.isOverdue ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                                  background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca'
                                }}>
                                  ⚠️ Vadesi Geçti ({inst.daysOverdue} gün)
                                </span>
                              ) : inst.isDueToday ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                                  background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a'
                                }}>
                                  ⚡ Vadesi Bugün
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                  background: '#f1f5f9', color: '#475569'
                                }}>
                                  ⏳ Vadesi Gelmedi
                                </span>
                              )}
                            </td>

                            {/* Tahsilat Bilgisi */}
                            <td style={td}>
                              {inst.isSkipped && !inst.isPartialSkip ? (
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                                    🚫 {inst.skipReason}
                                  </div>
                                  {inst.skipDate && (
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                                      Kayıt: {formatTrFullDate(inst.skipDate)}
                                    </div>
                                  )}
                                </div>
                              ) : inst.isPaid ? (
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: '#059669' }}>
                                      {money(inst.paid)} Ödendi
                                    </span>
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                      background: inst.paymentMethod === 'Nakit' ? '#fef3c7' : '#e0e7ff',
                                      color: inst.paymentMethod === 'Nakit' ? '#92400e' : '#4338ca'
                                    }}>
                                      {inst.paymentMethod}
                                    </span>
                                  </div>
                                  {inst.collectionDate && (
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                                      Tarih: {formatTrFullDate(inst.collectionDate)}
                                    </div>
                                  )}
                                </div>
                              ) : inst.paid > 0 ? (
                                <div>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>
                                    Kısmi: {money(inst.paid)}
                                  </span>
                                  <div style={{ fontSize: 11, color: '#ef4444' }}>
                                    Kalan: {money(inst.remaining)}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Ödeme bekleniyor</span>
                                  {inst.isPartialSkip && (
                                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                      ({inst.absentDays} gün devamsızlık düşüldü)
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* İşlem Butonları */}
                            <td style={td}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {inst.isSkipped ? (
                                  inst.isPartialSkip ? (
                                    <>
                                      {!inst.isPaid && (
                                        <button
                                          onClick={() => openCollectModal(inst)}
                                          style={{
                                            ...Btn,
                                            background: inst.isOverdue
                                              ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                                              : 'linear-gradient(135deg,#10b981,#059669)',
                                            color: '#fff',
                                            padding: '6px 11px',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            borderRadius: 8,
                                            boxShadow: '0 2px 8px rgba(16,185,129,0.25)'
                                          }}
                                          title="Kalan taksit tutarını tahsil et"
                                        >
                                          💰 Tahsil Et
                                        </button>
                                      )}
                                      {inst.collections && inst.collections.length > 0 && (
                                        <button
                                          onClick={() => openEditCollectionModal(inst)}
                                          style={{
                                            ...Btn,
                                            background: '#f8fafc',
                                            color: '#334155',
                                            border: '1px solid #cbd5e1',
                                            padding: '5px 9px',
                                            fontSize: 11,
                                            fontWeight: 700,
                                            borderRadius: 7
                                          }}
                                          title="Tahsilat detayını gör / sil / düzenle"
                                        >
                                          🔍 Detay / Düzenle
                                        </button>
                                      )}
                                      <button
                                        onClick={() => unskipInstallment(inst.installmentNo)}
                                        style={{
                                          ...Btn,
                                          background: '#f1f5f9',
                                          color: '#475569',
                                          border: '1px solid #cbd5e1',
                                          padding: '5px 9px',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          borderRadius: 7
                                        }}
                                        title="Devamsızlığı iptal et ve bakiyeyi geri yükle"
                                      >
                                        ↩ Geri Al
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => unskipInstallment(inst.installmentNo)}
                                      style={{
                                        ...Btn,
                                        background: '#f1f5f9',
                                        color: '#475569',
                                        border: '1px solid #cbd5e1',
                                        padding: '5px 10px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        borderRadius: 7
                                      }}
                                      title="Devamsızlık kaydını kaldır"
                                    >
                                      ↩ Geri Al
                                    </button>
                                  )
                                ) : !inst.isPaid ? (
                                  <>
                                    <button
                                      onClick={() => openCollectModal(inst)}
                                      style={{
                                        ...Btn,
                                        background: inst.isOverdue
                                          ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                                          : 'linear-gradient(135deg,#10b981,#059669)',
                                        color: '#fff',
                                        padding: '6px 12px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        borderRadius: 8,
                                        boxShadow: '0 2px 8px rgba(16,185,129,0.25)'
                                      }}
                                    >
                                      💰 Tahsil Et
                                    </button>
                                    <button
                                      onClick={() => openSkipModal(inst)}
                                      style={{
                                        ...Btn,
                                        background: '#f8fafc',
                                        color: '#64748b',
                                        border: '1px solid #e2e8f0',
                                        padding: '6px 10px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        borderRadius: 8
                                      }}
                                      title="Bu taksiti devamsızlık olarak işaretle ve bakiyeden düş"
                                    >
                                      🚫 Atla
                                    </button>
                                    {inst.collections && inst.collections.length > 0 && (
                                      <button
                                        onClick={() => openEditCollectionModal(inst)}
                                        style={{
                                          ...Btn,
                                          background: '#eff6ff',
                                          color: '#1d4ed8',
                                          border: '1px solid #bfdbfe',
                                          padding: '5px 9px',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          borderRadius: 7
                                        }}
                                        title="Yapılan tahsilatları gör, düzenle veya sil"
                                      >
                                        🔍 Detay / Düzenle
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    onClick={() => openEditCollectionModal(inst)}
                                    style={{
                                      ...Btn,
                                      background: '#f0fdf4',
                                      color: '#15803d',
                                      border: '1px solid #bbf7d0',
                                      padding: '5px 10px',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      borderRadius: 7
                                    }}
                                    title="Tahsilat detayını gör, ödeme yöntemini/tarihini düzelt veya tahsilatı sil"
                                  >
                                    🔍 Detay / Düzenle
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* DESKTOP RIGHT COLUMN - STUDENT LIST                          */}
        {/* ============================================================ */}
        {!isCompact && (
          <div style={{
            width: 290, flexShrink: 0,
            background: '#fff', borderRadius: 16, border: '1px solid #e6ebf3',
            boxShadow: '0 1px 4px rgba(15,23,42,0.04)', overflow: 'hidden',
            position: 'sticky', top: 78, maxHeight: 'calc(100vh - 94px)',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* List Header */}
            <div style={{
              padding: '12px 14px', borderBottom: '1px solid #e6ebf3',
              background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>👥 Öğrenci Listesi</div>
                <span style={{
                  background: '#e0e7ff', color: '#4338ca', fontSize: 11,
                  fontWeight: 700, padding: '2px 7px', borderRadius: 10
                }}>
                  {students.length} Kayıt
                </span>
              </div>

              {/* Quick Search */}
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(isAdminPanelMode || (accessibleTenants && accessibleTenants.length > 0)) && (
                  <select
                    value={selectedSchoolId}
                    onChange={e => setSelectedSchoolId(e.target.value)}
                    style={{
                      ...InputCls,
                      padding: '6px 9px',
                      fontSize: 12,
                      background: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">🏫 Tüm Okullar ({accessibleTenants?.length || 'Tümü'})</option>
                    {accessibleTenants?.map(t => (
                      <option key={t.id || t._id} value={t.id || t._id}>🏫 {t.name}</option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  placeholder="🔍 Öğrenci veya sınıf ara..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  style={{
                    ...InputCls,
                    padding: '6px 9px',
                    fontSize: 12,
                    background: '#fff'
                  }}
                />
              </div>
            </div>

            {/* Student Cards List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: 6 }}>
              {filteredStudents.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                  {studentSearch ? 'Aramaya uygun öğrenci bulunamadı.' : 'Henüz öğrenci kaydı yok.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredStudents.map(renderStudentCard)}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ============================================================ */}
      {/* ADD / EDIT FEE ITEM MODAL                                    */}
      {/* ============================================================ */}
      {modalOpen && selStudent && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: 'min(640px, 100%)',
            maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(15,23,42,0.3)'
          }} onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e6ebf3',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>
                  {editItemIdx !== null ? '✏️ Ücret Planını Düzenle' : '+ Ücret Planı Ekle'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                  Öğrenci: <strong>{selStudent.name}</strong> {selStudent.class ? `(${selStudent.class})` : ''}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} style={{
                padding: '5px 9px', borderRadius: 8, border: 'none',
                background: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 15, color: '#fff', fontWeight: 700
              }}>✕</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'grid', gap: 14 }}>

              {/* Predefined Categories Buttons */}
              {feeCategories.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                    📌 Tanımlı Ücret Kalemini Seçin
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {feeCategories.map(fc => {
                      const isCatActive = itemForm.name.toLowerCase() === fc.name.toLowerCase() || itemForm.categoryId === String(fc.id)
                      return (
                        <button
                          key={fc.id}
                          type="button"
                          onClick={() => handleCategorySelect(fc.id)}
                          style={{
                            padding: '7px 12px', borderRadius: 8, border: '2px solid',
                            borderColor: isCatActive ? '#6366f1' : '#e2e8f0',
                            background: isCatActive ? '#eef2ff' : '#fff',
                            color: isCatActive ? '#4338ca' : '#0f172a',
                            cursor: 'pointer', fontWeight: isCatActive ? 700 : 500, fontSize: 12,
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>{fc.name}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: isCatActive ? '#6366f1' : '#64748b',
                            background: isCatActive ? '#e0e7ff' : '#f1f5f9',
                            padding: '1px 5px', borderRadius: 6
                          }}>
                            {money(fc.defaultPrice)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {/* Kalem Adı */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>
                    Kalem Adı *
                  </label>
                  <input
                    style={InputCls}
                    value={itemForm.name}
                    onChange={e => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ör: 2026 - 2027 Eğitim"
                  />
                </div>

                {/* Baz Fiyat - STRICTLY READONLY */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                      Baz Fiyat (₺)
                    </label>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#64748b',
                      background: '#f1f5f9', padding: '1px 5px', borderRadius: 4
                    }}>
                      🔒 Sabit
                    </span>
                  </div>
                  <input
                    style={{
                      ...InputCls,
                      background: '#f8fafc',
                      color: '#334155',
                      fontWeight: 700,
                      cursor: 'not-allowed',
                      border: '1px solid #cbd5e1'
                    }}
                    value={money(itemForm.basePrice)}
                    readOnly
                  />
                </div>
              </div>

              {/* Multi-Discount Section */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '12px 14px'
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: itemForm.discountIds.length > 0 ? 10 : 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#334155' }}>🏷️ İndirimler</span>
                    {itemForm.discountIds.length > 0 && (
                      <span style={{
                        background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 700,
                        padding: '1px 6px', borderRadius: 6, border: '1px solid #fde68a'
                      }}>
                        {itemForm.discountIds.length} Kademeli İndirim
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={addDiscountRow}
                    style={{
                      ...Btn,
                      background: '#e0e7ff',
                      color: '#4338ca',
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      border: '1px solid #c7d2fe'
                    }}
                  >
                    + İndirim Ekle
                  </button>
                </div>

                {itemForm.discountIds.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                    Henüz indirim eklenmedi. Birden fazla indirim uygulamak için <strong>+ İndirim Ekle</strong> butonuna basın.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {itemForm.discountIds.map((dId, idx) => {
                      const step = currentModalCalc.applied[idx]

                      return (
                        <div key={idx} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
                          padding: '6px 10px'
                        }}>
                          <span style={{
                            fontSize: 10, fontWeight: 800, color: '#4f46e5',
                            background: '#eef2ff', padding: '2px 6px', borderRadius: 4, flexShrink: 0
                          }}>
                            {idx + 1}. İndirim
                          </span>

                          <select
                            style={{
                              ...InputCls,
                              padding: '5px 8px',
                              fontSize: 12,
                              flex: 1
                            }}
                            value={dId}
                            onChange={e => updateDiscountRow(idx, e.target.value)}
                          >
                            <option value="">— İndirim Seçiniz —</option>
                            {discountDefs.map(d => (
                              <option key={d.id} value={String(d.id)}>
                                {d.name} ({d.type === 'percent' ? `%${d.value}` : money(d.value)})
                              </option>
                            ))}
                          </select>

                          {step ? (
                            <div style={{
                              fontSize: 11, fontWeight: 800, color: '#dc2626',
                              flexShrink: 0, whiteSpace: 'nowrap'
                            }}>
                              {step.label} (-{money(step.amount)})
                            </div>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => removeDiscountRow(idx)}
                            title="Bu indirimi kaldır"
                            style={{
                              ...Btn,
                              background: '#fee2e2',
                              color: '#991b1b',
                              padding: '4px 7px',
                              fontSize: 11,
                              borderRadius: 6
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {/* Peşinat */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>
                    Peşinat (₺)
                  </label>
                  <input
                    style={InputCls}
                    type="number"
                    min="0"
                    max={Math.max(0, Number(currentModalCalc.finalPrice) - 0.01)}
                    step="0.01"
                    value={itemForm.downPayment}
                    onChange={e => setItemForm(prev => ({ ...prev, downPayment: e.target.value }))}
                  />
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                    Kayıt tarihi vadesiyle ayrı bir peşinat satırı oluşturur.
                  </div>
                </div>
                {/* Taksit Sayısı */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>
                    Taksit Sayısı
                  </label>
                  <input
                    style={InputCls}
                    type="number"
                    min="1"
                    max="24"
                    value={itemForm.installments}
                    onChange={e => setItemForm(prev => ({
                      ...prev,
                      installments: Math.max(1, Number(e.target.value) || 1)
                    }))}
                  />
                </div>

                {/* Vade Başlangıç Tarihi */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>
                    Vade Başlangıç Tarihi *
                    <span style={{ fontSize: 10, color: '#6366f1', marginLeft: 4, fontWeight: 600 }}>(Tam Gün / Ay / Yıl)</span>
                  </label>
                  <input
                    style={{ ...InputCls, fontWeight: 700 }}
                    type="date"
                    value={itemForm.start}
                    onChange={e => setItemForm(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
              </div>

              {/* Price Calculation Summary Box */}
              <div style={{
                padding: '14px 18px', background: 'linear-gradient(135deg,#f8faff,#eef2ff)',
                borderRadius: 12, border: '1px solid #c7d2fe'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>Planlanan Baz Fiyat</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{money(currentModalCalc.basePrice)}</div>
                    </div>

                    {currentModalCalc.applied.map((app, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 10, color: '#b91c1c', fontWeight: 600 }}>
                          {i + 1}. İndirim ({app.name})
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>
                          {app.label} (-{money(app.amount)})
                        </div>
                      </div>
                    ))}

                    {currentModalCalc.applied.length > 1 && (
                      <div>
                        <div style={{ fontSize: 10, color: '#b91c1c', fontWeight: 700 }}>
                          Toplam İndirim
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#b91c1c' }}>
                          -{money(currentModalCalc.totalDiscount)}
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize: 10, color: '#4338ca', fontWeight: 700 }}>Net Tutar</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#4f46e5' }}>
                        {money(currentModalCalc.finalPrice)}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#047857', fontWeight: 600 }}>Aylık Taksit</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#059669' }}>
                      {money(round2(currentModalCalc.finalPrice / Math.max(1, itemForm.installments)))}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                      {itemForm.installments} ay vade
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #e6ebf3',
              display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  ...Btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '7px 14px'
                }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                id="btn-save-item"
                onClick={saveItem}
                style={{
                  ...Btn, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                  boxShadow: '0 4px 12px rgba(99,102,241,0.25)', padding: '7px 16px'
                }}
              >
                {editItemIdx !== null ? 'Planı Güncelle' : 'Plana Ekle'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* COLLECT INSTALLMENT MODAL (Yeni Tahsilat Yapma)               */}
      {/* ============================================================ */}
      {collectModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: 'min(480px, 100%)',
            boxShadow: '0 24px 60px rgba(15,23,42,0.3)', overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{
              padding: '16px 20px', background: 'linear-gradient(135deg,#10b981,#059669)',
              color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  💰 Taksit Tahsilatı Yap
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.9 }}>
                  {collectForm.planName} · <strong>{Number(collectForm.installmentNo) === 0 ? 'Peşin İşlem' : `${collectForm.installmentNo}. Taksit`}</strong>
                </p>
              </div>
              <button
                onClick={() => setCollectModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                  padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 800
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Info banner */}
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
                padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12
              }}>
                <div>
                  <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Taksit Vadesi</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#14532d' }}>
                    {formatTrFullDate(collectForm.dueDate)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Bu Taksit Tutarı</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#15803d' }}>
                    {money(collectForm.dueAmount)}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #bbf7d0', paddingTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>
                    Daha önce tahsil edilen: {money(Number(collectForm.installmentNo) === 0
                      ? Number(downPaymentInfo?.paid || 0)
                      : Math.max(0, Number(collectForm.dueAmount) - (Number(installmentList.find(i => Number(i.installmentNo) === Number(collectForm.installmentNo))?.remaining) || 0)))}
                  </span>
                  <span style={{ fontSize: 11, color: '#b45309', fontWeight: 800 }}>
                    Kalan: {money(Number(collectForm.installmentNo) === 0
                      ? Number(downPaymentInfo?.remaining || 0)
                      : installmentList.find(i => Number(i.installmentNo) === Number(collectForm.installmentNo))?.remaining || 0)}
                  </span>
                </div>
              </div>

              {collectForm.collections.length > 0 && (
                <div style={{
                  border: '1px solid #dbeafe', borderRadius: 10, background: '#f8fbff', padding: '9px 11px'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', marginBottom: 6 }}>
                    Önceki Tahsilatlar
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {collectForm.collections.map((collection, index) => (
                      <button
                        key={collection.id || collection._id || index}
                        type="button"
                        onClick={() => openPreviousCollectionForEdit(collection)}
                        title="Bu tahsilatı düzenle"
                        style={{
                          width: '100%', textAlign: 'left', cursor: 'pointer',
                        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8,
                        alignItems: 'center', padding: '6px 7px', background: '#fff',
                        border: '1px solid #e0e7ff', borderRadius: 6
                      }}>
                        <span style={{ fontSize: 10, color: '#475569' }}>
                          {index + 1}. {formatTrFullDate(collection.date)}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8' }}>
                          {money(collection.amount)}
                        </span>
                        <span style={{ fontSize: 10, color: '#64748b' }}>
                          {collection.payment || '—'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tahsilat Tarihi */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  📅 Tahsilat Tarihi *
                </label>
                <input
                  style={{ ...InputCls, fontWeight: 700, borderColor: '#10b981' }}
                  type="date"
                  value={collectForm.date}
                  onChange={e => setCollectForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              {/* Tahsil Edilen Tutar */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  💵 Tahsil Edilen Tutar (₺) *
                </label>
                <input
                  style={{ ...InputCls, fontSize: 15, fontWeight: 800, color: '#0f172a' }}
                  type="number"
                  step="0.01"
                  value={collectForm.amount}
                  onChange={e => setCollectForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              {/* Ödeme Türü */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  💳 Ödeme Türü
                </label>
                <select
                  style={InputCls}
                  value={collectForm.payment}
                  onChange={e => setCollectForm(prev => ({ ...prev, payment: e.target.value }))}
                >
                  <option value="Nakit">Nakit</option>
                  <option value="Havale/EFT">Havale / EFT</option>
                  <option value="Kredi Kartı">Kredi Kartı</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>

              {/* Not / Açıklama */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  📝 Açıklama / Makbuz Notu
                </label>
                <input
                  style={InputCls}
                  type="text"
                  placeholder="Örn: 1. taksit veli tarafından ödendi"
                  value={collectForm.note}
                  onChange={e => setCollectForm(prev => ({ ...prev, note: e.target.value }))}
                />
              </div>

            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #e6ebf3',
              display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => setCollectModalOpen(false)}
                style={{
                  ...Btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '7px 14px'
                }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={saveInstallmentCollection}
                style={{
                  ...Btn, background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.25)', padding: '7px 16px'
                }}
              >
                Tahsilatı Kaydet
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* EDIT / DELETE EXISTING COLLECTION MODAL                      */}
      {/* (Tahsilatı İnceleme, Ödeme Türü/Tarih Düzeltme & Silme)       */}
      {/* ============================================================ */}
      {editCollectionModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: 'min(500px, 100%)',
            boxShadow: '0 24px 60px rgba(15,23,42,0.3)', overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{
              padding: '16px 20px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
              color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  🔍 Tahsilat Detayı &amp; Düzenle
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.9 }}>
                  {editCollectionForm.planName} · <strong>{Number(editCollectionForm.installmentNo) === 0 ? 'Peşin İşlem' : `${editCollectionForm.installmentNo}. Taksit`}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditCollectionModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                  padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 800
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>Taksit Vadesi</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a8a' }}>
                    {editCollectionForm.dueDate}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>Kayıtlı Tahsilat Durumu</div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: '#15803d',
                    background: '#dcfce7', padding: '2px 8px', borderRadius: 6
                  }}>
                    ✓ Tahsil Edilmiş
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 7 }}>
                  Yapılan Tahsilatlar ({editCollectionForm.collections.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {editCollectionForm.collections.map((collection, index) => {
                    const collectionId = collection.id || collection._id
                    const isSelected = String(editCollectionForm.id) === String(collectionId)
                    return (
                      <button
                        key={collectionId || index}
                        type="button"
                        onClick={() => selectCollectionForEdit(collection)}
                        style={{
                          width: '100%', textAlign: 'left', cursor: 'pointer',
                          padding: '9px 11px', borderRadius: 8,
                          border: `1px solid ${isSelected ? '#60a5fa' : '#dbeafe'}`,
                          background: isSelected ? '#eff6ff' : '#fff',
                          display: 'grid', gridTemplateColumns: '1fr auto', gap: 4,
                          color: '#334155'
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700 }}>
                          {index + 1}. {formatTrFullDate(collection.date)}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 900, color: '#2563eb' }}>
                          {money(collection.amount)}
                        </span>
                        <span style={{ fontSize: 10, color: '#64748b' }}>
                          {collection.payment || 'Ödeme türü belirtilmedi'}
                        </span>
                        {collection.note && (
                          <span style={{ fontSize: 10, color: '#64748b', textAlign: 'right' }}>
                            {collection.note}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tahsilat Tarihi */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  📅 Tahsilat Tarihi *
                </label>
                <input
                  style={{ ...InputCls, fontWeight: 700 }}
                  type="date"
                  value={editCollectionForm.date}
                  onChange={e => setEditCollectionForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              {/* Tahsil Edilen Tutar */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  💵 Tahsil Edilen Tutar (₺) *
                </label>
                <input
                  style={{ ...InputCls, fontSize: 15, fontWeight: 800, color: '#0f172a' }}
                  type="number"
                  step="0.01"
                  value={editCollectionForm.amount}
                  onChange={e => setEditCollectionForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              {/* Ödeme Türü (Banka / Nakit / Kart değiştirilebilir) */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  💳 Ödeme Türü *
                  <span style={{ fontSize: 11, color: '#6366f1', marginLeft: 6, fontWeight: 500 }}>(Nakit yerine Havale vb. seçebilirsiniz)</span>
                </label>
                <select
                  style={{ ...InputCls, fontWeight: 700, borderColor: '#3b82f6', background: '#f8faff' }}
                  value={editCollectionForm.payment}
                  onChange={e => setEditCollectionForm(prev => ({ ...prev, payment: e.target.value }))}
                >
                  <option value="Nakit">Nakit</option>
                  <option value="Havale/EFT">Havale / EFT (Banka)</option>
                  <option value="Kredi Kartı">Kredi Kartı</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>

              {/* Açıklama */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                  📝 Açıklama / Makbuz Notu
                </label>
                <input
                  style={InputCls}
                  type="text"
                  value={editCollectionForm.note}
                  onChange={e => setEditCollectionForm(prev => ({ ...prev, note: e.target.value }))}
                />
              </div>

            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #e6ebf3',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc'
            }}>
              {/* Delete button (Silme) */}
              <button
                type="button"
                onClick={deleteExistingCollection}
                style={{
                  ...Btn, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5',
                  padding: '7px 12px', fontSize: 12
                }}
              >
                🗑️ Tahsilatı Sil
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditCollectionModalOpen(false)}
                  style={{
                    ...Btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '7px 14px'
                  }}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={saveEditedCollection}
                  style={{
                    ...Btn, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)', padding: '7px 16px'
                  }}
                >
                  💾 Değişiklikleri Kaydet
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Toast Notification */}
      {/* ============================================================ */}
      {/* SKIP INSTALLMENT MODAL (Devamsızlık / Takvim & Gün Hesabı)   */}
      {/* ============================================================ */}
      {skipModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16
          }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 20, width: 'min(540px, 100%)',
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(15,23,42,0.3)', overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '16px 22px', borderBottom: '1px solid #e6ebf3',
              background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>🚫 Devamsızlık — Taksiti Atla</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {activePlan?.name} · <strong>{skipForm.installmentNo}. Taksit</strong>
                </div>
              </div>
              <button
                onClick={() => setSkipModalOpen(false)}
                style={{
                  padding: '5px 10px', borderRadius: 8, border: 'none',
                  background: '#f1f5f9', color: '#475569', cursor: 'pointer', fontSize: 14, fontWeight: 800
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Bilgilendirme Notu */}
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef3c7', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>⚠️ Bilgi</div>
                <div style={{ fontSize: 12, color: '#78350f', marginTop: 2 }}>
                  Öğrencinin gelmediği günlerin tutarı hesaplanarak öğrenci bakiyesinden düşülecektir. İstediğiniz zaman "↩ Geri Al" ile bu işlemi iptal edebilirsiniz.
                </div>
              </div>

              {/* Devamsızlık Süresi: Tam Ay vs Yarım Ay / Gün Seçimi */}
              <div>
                <label style={{ fontSize: 12, color: '#334155', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Devamsızlık Süresi
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div
                    onClick={() => setSkipForm(f => ({ ...f, period: 'full' }))}
                    style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: skipForm.period === 'full' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                      background: skipForm.period === 'full' ? '#fffbeb' : '#f8fafc',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: skipForm.period === 'full' ? '#92400e' : '#334155' }}>
                      📅 Tam Ay
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Tüm taksit tutarı düşülür
                    </div>
                  </div>

                  <div
                    onClick={() => setSkipForm(f => ({ ...f, period: 'half' }))}
                    style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: skipForm.period === 'half' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                      background: skipForm.period === 'half' ? '#fffbeb' : '#f8fafc',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: skipForm.period === 'half' ? '#92400e' : '#334155' }}>
                      📆 Yarım Ay / Gün Seçimi
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Takvimden gün aralığı seçilir
                    </div>
                  </div>
                </div>
              </div>

              {/* Yarım Ay / Gün Seçimi Takvimi */}
              {skipForm.period === 'half' && (
                <div style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 12, padding: '14px', display: 'flex', flexDirection: 'column', gap: 10
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>
                      📅 {MONTH_NAMES_TR[skipForm.month - 1] || ''} {skipForm.year} Ayı Takvimi
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                      Toplam {skipForm.monthDays} Gün
                    </div>
                  </div>

                  {/* Hızlı Seçim Butonları */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const padM = String(skipForm.month).padStart(2, '0')
                        handleSkipDateChange(`${skipForm.year}-${padM}-01`, `${skipForm.year}-${padM}-15`)
                      }}
                      style={{
                        flex: 1, padding: '6px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                        background: (skipForm.startDate?.endsWith('-01') && skipForm.endDate?.endsWith('-15')) ? '#fef3c7' : '#fff',
                        border: (skipForm.startDate?.endsWith('-01') && skipForm.endDate?.endsWith('-15')) ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                        color: (skipForm.startDate?.endsWith('-01') && skipForm.endDate?.endsWith('-15')) ? '#92400e' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      İlk 15 Gün (1-15)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const padM = String(skipForm.month).padStart(2, '0')
                        handleSkipDateChange(`${skipForm.year}-${padM}-16`, `${skipForm.year}-${padM}-${String(skipForm.monthDays).padStart(2, '0')}`)
                      }}
                      style={{
                        flex: 1, padding: '6px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                        background: (skipForm.startDate?.endsWith('-16') && skipForm.endDate?.endsWith(`-${String(skipForm.monthDays).padStart(2, '0')}`)) ? '#fef3c7' : '#fff',
                        border: (skipForm.startDate?.endsWith('-16') && skipForm.endDate?.endsWith(`-${String(skipForm.monthDays).padStart(2, '0')}`)) ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                        color: (skipForm.startDate?.endsWith('-16') && skipForm.endDate?.endsWith(`-${String(skipForm.monthDays).padStart(2, '0')}`)) ? '#92400e' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      Son 15 Gün (16-{skipForm.monthDays})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const padM = String(skipForm.month).padStart(2, '0')
                        handleSkipDateChange(`${skipForm.year}-${padM}-01`, `${skipForm.year}-${padM}-${String(skipForm.monthDays).padStart(2, '0')}`)
                      }}
                      style={{
                        flex: 1, padding: '6px 8px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                        background: (skipForm.startDate?.endsWith('-01') && skipForm.endDate?.endsWith(`-${String(skipForm.monthDays).padStart(2, '0')}`)) ? '#fef3c7' : '#fff',
                        border: (skipForm.startDate?.endsWith('-01') && skipForm.endDate?.endsWith(`-${String(skipForm.monthDays).padStart(2, '0')}`)) ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                        color: (skipForm.startDate?.endsWith('-01') && skipForm.endDate?.endsWith(`-${String(skipForm.monthDays).padStart(2, '0')}`)) ? '#92400e' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      Tüm Ay (1-{skipForm.monthDays})
                    </button>
                  </div>

                  {/* Tarih Seçiciler: Başlangıç & Bitiş */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#475569', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        📅 Başlangıç Tarihi
                      </label>
                      <input
                        type="date"
                        style={{ ...InputCls, fontSize: 12, padding: '6px 8px' }}
                        value={skipForm.startDate}
                        onChange={e => handleSkipDateChange(e.target.value, skipForm.endDate)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#475569', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        📅 Bitiş Tarihi
                      </label>
                      <input
                        type="date"
                        style={{ ...InputCls, fontSize: 12, padding: '6px 8px' }}
                        value={skipForm.endDate}
                        onChange={e => handleSkipDateChange(skipForm.startDate, e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Mini Takvim Grid */}
                  <div style={{ background: '#fff', borderRadius: 10, padding: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', marginBottom: 6 }}>
                      {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d, i) => (
                        <div key={d} style={{ fontSize: 10, fontWeight: 800, color: i >= 5 ? '#ef4444' : '#64748b' }}>
                          {d}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                      {/* Ayın 1'inden önceki boşluklar */}
                      {Array.from({ length: (new Date(skipForm.year, skipForm.month - 1, 1).getDay() + 6) % 7 }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {/* Ayın günleri */}
                      {Array.from({ length: skipForm.monthDays }).map((_, i) => {
                        const day = i + 1
                        const padM = String(skipForm.month).padStart(2, '0')
                        const padD = String(day).padStart(2, '0')
                        const dateStr = `${skipForm.year}-${padM}-${padD}`
                        const isSelected = dateStr >= skipForm.startDate && dateStr <= skipForm.endDate
                        const isStart = dateStr === skipForm.startDate
                        const isEnd = dateStr === skipForm.endDate

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (!skipForm.startDate || (skipForm.startDate && skipForm.endDate && dateStr < skipForm.startDate)) {
                                handleSkipDateChange(dateStr, skipForm.endDate && skipForm.endDate >= dateStr ? skipForm.endDate : dateStr)
                              } else if (dateStr >= skipForm.startDate) {
                                handleSkipDateChange(skipForm.startDate, dateStr)
                              } else {
                                handleSkipDateChange(dateStr, dateStr)
                              }
                            }}
                            style={{
                              padding: '6px 0',
                              borderRadius: 6,
                              border: 'none',
                              background: (isStart || isEnd)
                                ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                                : isSelected
                                  ? '#fef3c7'
                                  : '#f8fafc',
                              color: (isStart || isEnd)
                                ? '#fff'
                                : isSelected
                                  ? '#92400e'
                                  : '#334155',
                              fontWeight: isSelected ? 800 : 500,
                              fontSize: 11,
                              cursor: 'pointer',
                              transition: 'all 0.1s',
                              boxShadow: (isStart || isEnd) ? '0 2px 6px rgba(245,158,11,0.4)' : 'none'
                            }}
                            title={dateStr}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Canlı Hesaplama Özeti Kartı */}
              {activePlan && (() => {
                const count = Math.max(1, Number(activePlan.installments) || 1)
                const total = Number(activePlan.total) || 0
                const perInst = round2(total / count)
                const daysInMonth = skipForm.monthDays || 30
                const dailyAmount = round2(perInst / daysInMonth)

                let deduction = perInst
                let absentDays = daysInMonth
                if (skipForm.period === 'half') {
                  absentDays = Math.max(1, Math.min(daysInMonth, skipForm.absentDays || 1))
                  deduction = round2((perInst / daysInMonth) * absentDays)
                  deduction = Math.min(perInst, deduction)
                }
                const remaining = round2(Math.max(0, perInst - deduction))

                return (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🧮 Hesaplama Detayı ({MONTH_NAMES_TR[skipForm.month - 1] || ''} {skipForm.year} — {daysInMonth} Gün)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12 }}>
                      <div style={{ color: '#475569' }}>Taksit Tutarı:</div>
                      <div style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{money(perInst)}</div>

                      {skipForm.period === 'half' && (
                        <>
                          <div style={{ color: '#475569' }}>Günlük Birim Tutar:</div>
                          <div style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                            {money(dailyAmount)} / gün
                          </div>

                          <div style={{ color: '#475569' }}>Gelmediği Gün Sayısı:</div>
                          <div style={{ textAlign: 'right', fontWeight: 800, color: '#d97706' }}>
                            {absentDays} Gün
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ borderTop: '1px dashed #86efac', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800 }}>
                        <span style={{ color: '#dc2626' }}>📉 Bakiyeden Düşülecek:</span>
                        <span style={{ color: '#dc2626' }}>-{money(deduction)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                        <span style={{ color: '#15803d' }}>📌 Velinin Ödeyeceği Kalan:</span>
                        <span style={{ color: '#15803d' }}>
                          {remaining <= 0 ? '₺0,00 (Tam Muaf)' : money(remaining)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Sebep ve Kayıt Tarihi */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#334155', fontWeight: 700, display: 'block', marginBottom: 4 }}>Sebep</label>
                  <select style={{ ...InputCls }} value={skipForm.reason} onChange={e => setSkipForm(f => ({ ...f, reason: e.target.value }))}>
                    <option>Devamsızlık</option>
                    <option>Hastalık</option>
                    <option>Tatil</option>
                    <option>Ailevi Sebep</option>
                    <option>Diğer</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#334155', fontWeight: 700, display: 'block', marginBottom: 4 }}>Kayıt Tarihi</label>
                  <input type="date" style={{ ...InputCls }} value={skipForm.date} onChange={e => setSkipForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid #e6ebf3', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setSkipModalOpen(false)}
                style={{ ...Btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '7px 14px' }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={saveSkipInstallment}
                style={{
                  ...Btn, background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                  color: '#fff', padding: '7px 18px', boxShadow: '0 4px 12px rgba(245,158,11,0.3)'
                }}
              >
                🚫 Devamsızlık Olarak İşaretle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: '#fff', padding: '10px 20px', borderRadius: 12,
          fontWeight: 600, fontSize: 13, zIndex: 99999,
          boxShadow: '0 8px 24px rgba(15,23,42,0.3)'
        }}>
          {toastMsg}
        </div>
      )}

      {/* ============================================================ */}
      {/* OVERDUE INSTALLMENTS MODAL                                    */}
      {/* ============================================================ */}
      {overdueModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16
          }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 20,
              width: 'min(820px, 100%)', maxHeight: '88vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(15,23,42,0.28)', overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid #fecaca',
              background: 'linear-gradient(135deg,#fee2e2,#fff1f2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#991b1b' }}>
                    Vadesi Geçmiş Taksitler
                  </h3>
                  <span style={{
                    background: '#dc2626', color: '#fff', borderRadius: 99,
                    padding: '2px 10px', fontSize: 12, fontWeight: 800
                  }}>
                    {allOverdueInstallments.length} adet
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                  En fazla geciken taksitler üstte listeleniyor · Öğrenci → Plan → Taksit sıralaması
                </div>
              </div>
              <button
                onClick={() => setOverdueModalOpen(false)}
                style={{
                  padding: '6px 11px', borderRadius: 8, border: 'none',
                  background: '#fee2e2', color: '#991b1b', cursor: 'pointer',
                  fontSize: 15, fontWeight: 800
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1 }}>
              {allOverdueInstallments.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 700 }}>Vadesi geçmiş taksit bulunmuyor!</div>
                </div>
              ) : (() => {
                // Group by student
                const grouped = {}
                allOverdueInstallments.forEach(row => {
                  const key = String(row.student.id)
                  if (!grouped[key]) grouped[key] = { student: row.student, rows: [] }
                  grouped[key].rows.push(row)
                })

                return Object.values(grouped).map(({ student, rows }) => {
                  const totalOverdue = rows.reduce((s, r) => s + r.remaining, 0)
                  return (
                    <div key={student.id} style={{ marginBottom: 20 }}>
                      {/* Student header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                        padding: '10px 14px', borderRadius: 12,
                        background: 'linear-gradient(135deg,#fef2f2,#fff1f2)',
                        border: '1px solid #fecaca'
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                          color: '#fff', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontWeight: 800, fontSize: 15
                        }}>
                          {(student.name || 'Ö')[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: '#991b1b' }}>
                            {student.name}
                            {student.class && (
                              <span style={{
                                marginLeft: 8, padding: '1px 7px', borderRadius: 6,
                                fontSize: 11, fontWeight: 700, background: '#fca5a5', color: '#7f1d1d'
                              }}>{student.class}</span>
                            )}
                            {student._schoolName && (
                              <span style={{
                                marginLeft: 8, padding: '1px 7px', borderRadius: 6,
                                fontSize: 11, fontWeight: 700, background: '#e0e7ff', color: '#4338ca'
                              }}>🏫 {student._schoolName}</span>
                            )}
                          </div>
                          {student.parent && (
                            <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 1 }}>
                              👤 Veli: {student.parent}
                              {student.phone && ` · 📞 ${student.phone}`}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 10, color: '#b91c1c', fontWeight: 700 }}>TOPLAM BORÇ</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#dc2626' }}>{money(totalOverdue)}</div>
                          <div style={{ fontSize: 10, color: '#b91c1c' }}>{rows.length} taksit</div>
                        </div>
                      </div>

                      {/* Installments table for this student */}
                      <div style={{
                        borderRadius: 10, border: '1px solid #fecaca', overflow: 'hidden',
                        marginLeft: 8
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#fff5f5' }}>
                              <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9f1239', textAlign: 'left', borderBottom: '1px solid #fecaca' }}>Plan</th>
                              <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9f1239', textAlign: 'center', borderBottom: '1px solid #fecaca' }}>Taksit No</th>
                              <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9f1239', textAlign: 'left', borderBottom: '1px solid #fecaca' }}>Vade Tarihi</th>
                              <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9f1239', textAlign: 'right', borderBottom: '1px solid #fecaca' }}>Taksit Tutarı</th>
                              <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9f1239', textAlign: 'right', borderBottom: '1px solid #fecaca' }}>Kalan</th>
                              <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9f1239', textAlign: 'center', borderBottom: '1px solid #fecaca' }}>Gecikme</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, ri) => {
                              const urgency = row.daysOverdue > 60 ? '#dc2626' : row.daysOverdue > 30 ? '#ea580c' : '#d97706'
                              const urgencyBg = row.daysOverdue > 60 ? '#fee2e2' : row.daysOverdue > 30 ? '#ffedd5' : '#fefce8'
                              return (
                                <tr
                                  key={`${row.planName}-${row.installmentNo}`}
                                  onClick={() => openCollectModalFromOverdue(row)}
                                  onMouseEnter={e => e.currentTarget.style.background = '#fff0f0'}
                                  onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? '#fff' : '#fff8f8'}
                                  style={{
                                    background: ri % 2 === 0 ? '#fff' : '#fff8f8',
                                    cursor: 'pointer',
                                    transition: 'background 0.12s'
                                  }}
                                  title="Tıklayarak tahsilat yap"
                                >
                                  <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid #fee2e2', fontWeight: 600, color: '#374151' }}>
                                    {row.planName}
                                  </td>
                                  <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid #fee2e2', textAlign: 'center' }}>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      width: 26, height: 26, borderRadius: '50%',
                                      background: '#fca5a5', color: '#7f1d1d', fontWeight: 800, fontSize: 11
                                    }}>
                                      {row.installmentNo}
                                    </span>
                                  </td>
                                  <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid #fee2e2', fontFamily: 'monospace', color: '#374151' }}>
                                    {row.dueDateFormatted}
                                  </td>
                                  <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid #fee2e2', textAlign: 'right', color: '#374151' }}>
                                    {money(row.amount)}
                                  </td>
                                  <td style={{ padding: '9px 12px', fontSize: 13, borderBottom: '1px solid #fee2e2', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                                    {money(row.remaining)}
                                  </td>
                                  <td style={{ padding: '9px 12px', fontSize: 11, borderBottom: '1px solid #fee2e2', textAlign: 'center' }}>
                                    <span style={{
                                      display: 'inline-block', padding: '3px 8px', borderRadius: 99,
                                      background: urgencyBg, color: urgency, fontWeight: 800
                                    }}>
                                      {row.daysOverdue} gün gecikmeli
                                    </span>
                                  </td>
                                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #fee2e2', textAlign: 'center' }}>
                                    <button
                                      onClick={e => { e.stopPropagation(); openCollectModalFromOverdue(row) }}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '5px 11px', borderRadius: 8, border: 'none',
                                        background: 'linear-gradient(135deg,#10b981,#059669)',
                                        color: '#fff', fontWeight: 700, fontSize: 11,
                                        cursor: 'pointer', whiteSpace: 'nowrap',
                                        boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
                                      }}
                                    >
                                      💳 Tahsil Et
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 22px', borderTop: '1px solid #fecaca',
              background: '#fff5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
                Toplam vadesi geçmiş borç:{' '}
                <strong style={{ fontSize: 15, color: '#dc2626' }}>
                  {money(allOverdueInstallments.reduce((s, r) => s + r.remaining, 0))}
                </strong>
              </div>
              <button
                onClick={() => setOverdueModalOpen(false)}
                style={{
                  ...Btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '7px 18px'
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
