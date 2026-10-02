import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { api } from '../../lib/apiClient.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { mergeAnaokuluResponses } from '../utils/schoolScope.js'

const AnaokuluDataContext = createContext()

const initialState = {
  loaded: false,
  saving: false,
  error: null,
  settings: {
    okulAdi: '',
    donem: '',
    yearStart: '',
    matchBy: 'tax',
    invoiceSettings: {},
    feeCategories: [],
    discounts: [],
    lockedDates: []
  },
  students: [],
  collections: [],
  invoices: [],
  checks: []
}

const normalizeLabel = (value) => String(value || '').trim().toLowerCase()
const toAmount = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}
const sameAmount = (a, b) => Math.abs(a - b) < 0.01
// Tekil eşleşme şart: aday sayısı tam olarak 1 değilse bu kural kullanılmaz.
const onlyOne = (list = []) => (list.length === 1 ? list[0] : null)

// Eski planın fiyat adayları: ham fiyat (basePrice) ve sözleşme tutarı (total).
// Eski kayıtlarda basePrice boş olabilir, bu yüzden ikisi de dikkate alınır.
const planPriceCandidates = (item = {}) => {
  const values = []
  const base = toAmount(item.basePrice)
  if (base > 0) values.push(base)
  const total = toAmount(item.total)
  if (total > 0) values.push(total)
  return values
}

// Bir ücret kaleminin hangi ücret kategorisine ait olduğunu bulur.
// Sıra: 1) kayıtlı kategori id'si  2) ad  3) fatura kalemi adı
//       4) ad + fiyat birlikte  5) fiyat (yalnızca tek aday varsa)
// Her kural TEKİL aday üretmelidir; tekil değilse sıradaki kural denenir.
// Hiçbir kural tekil eşleşme bulamazsa null döner ve hiçbir şey değiştirilmez.
const findFeeCategory = (categories = [], item = {}) => {
  const itemCategoryId = String(item.feeCategoryId || item.categoryId || '').trim()
  if (itemCategoryId) {
    const byId = onlyOne(categories.filter(c => String(c.id || '').trim() === itemCategoryId))
    if (byId) return byId
  }

  const label = normalizeLabel(item.name)
  if (label) {
    const byName = onlyOne(categories.filter(c => normalizeLabel(c.name) === label))
    if (byName) return byName

    const byInvoiceItem = onlyOne(categories.filter(c => normalizeLabel(c.invoiceItem) === label))
    if (byInvoiceItem) return byInvoiceItem
  }

  const prices = planPriceCandidates(item)
  if (prices.length > 0) {
    const priceMatches = (c) => prices.some(p => sameAmount(toAmount(c.defaultPrice), p))

    // 4) ad + fiyat birlikte
    if (label) {
      const byNameAndPrice = onlyOne(categories.filter(c =>
        (normalizeLabel(c.name) === label || normalizeLabel(c.invoiceItem) === label) && priceMatches(c)
      ))
      if (byNameAndPrice) return byNameAndPrice
    }

    // 5) fiyat tek başına: yalnızca tam olarak bir kategori fiyatla eşleşiyorsa
    const byPriceOnly = onlyOne(categories.filter(priceMatches))
    if (byPriceOnly) return byPriceOnly
  }

  return null
}

// Eski öğrenci ücret planlarını güncel ücret kategorilerine bağlar ve plan adını
// gerçek fatura kalemine dönüştürür (örn. "2026-2027" -> "EĞİTİM").
//
// DİKKAT: Fiyat, taksit sayısı, peşinat, tahsilat ve bakiye değerlerine dokunulmaz.
//
// ÖNEMLİ: Plan adı yalnızca bir etiket değil, tahsilatların (collections[].item)
// ve faturaların (invoices[].planName) eşleştirme anahtarıdır. Sadece öğrenci
// planı yeniden adlandırılırsa daha önce tahsil edilmiş tutarlar eşleşmez ve
// ekranda bakiye/borç yanlış hesaplanır. Bu yüzden yeniden adlandırılan eski plan
// adına ait mevcut tahsilat ve fatura kayıtları da yeni plana taşınır; böylece
// tutarlar birebir korunur ve backend doğrulaması da tutarlı kalır.
//
// ÖNEMLİ 2: Anahtar yalnızca eski ad değil, "öğrenciNo::eskiAd" şeklindedir; çünkü
// aynı eski ad farklı fiyatlarla farklı kalemlere karşılık gelebilir
// (örn. "2026-2027" + 20.000 -> EĞİTİM, "2026-2027" + 2.000 -> YEMEK).
// Bir öğrencinin aynı eski adı iki farklı kaleme giderse (çakışma) o kayıtların
// hiçbiri değiştirilmez: tahsilatlar yalnızca öğrenciNo + kalem adıyla tutulduğu
// için hangisinin hangi plana ait olduğu ayırt edilemez ve bakiye bozulur.
const migrateFeeCategories = (students = [], collections = [], invoices = [], feeCategories = []) => {
  const studentList = Array.isArray(students) ? students : []
  const collectionList = Array.isArray(collections) ? collections : []
  const invoiceList = Array.isArray(invoices) ? invoices : []
  const categories = Array.isArray(feeCategories) ? feeCategories : []

  if (categories.length === 0) {
    return { students: studentList, collections: collectionList, invoices: invoiceList, changed: false }
  }

  // Geçiş 1: eşleşmeleri hesapla (henüz hiçbir veri değiştirilmez)
  const decisions = studentList.map(student => {
    const studentId = String(student.id || student._id || '')
    return (student.items || []).map(item => {
      const category = findFeeCategory(categories, item)
      if (!category) return null

      const nextName = String(category.invoiceItem || category.name || item.name || '').trim()
      if (!nextName) return null

      const from = normalizeLabel(item.name)
      const to = normalizeLabel(nextName)
      // Ad değişmiyorsa yalnızca kategori alanlarının tamamlanması gerekir;
      // yeniden adlandırma (ve dolayısıyla tahsilat taşıma) gerekmez.
      if (!from || !to) return null

      return { key: `${studentId}::${from}`, from, to, nextName, category }
    })
  })

  // Çakışan anahtarları tespit et: aynı öğrenci + aynı eski ad -> farklı yeni ad
  // Haritada normalize (küçük harf) ad değil, yazılacak GERÇEK ad tutulur;
  // aksi halde tahsilat/faturalara bozuk bir ad yazılır.
  const resolved = new Map()
  decisions.flat().filter(Boolean).forEach(decision => {
    if (!resolved.has(decision.key)) {
      resolved.set(decision.key, { to: decision.to, nextName: decision.nextName })
    } else if (resolved.get(decision.key).to !== decision.to) {
      resolved.set(decision.key, null)
    }
  })
  const renames = new Map()
  resolved.forEach((value, key) => { if (value) renames.set(key, value.nextName) })

  // Geçiş 2: yalnızca çakışmayan eşleşmeleri uygula
  const migratedStudents = studentList.map((student, studentIndex) => ({
    ...student,
    items: (student.items || []).map((item, itemIndex) => {
      const decision = decisions[studentIndex][itemIndex]
      if (!decision) return item
      // Çakışan anahtarda hiçbir değişiklik yapılmaz.
      if (normalizeLabel(renames.get(decision.key) || '') !== decision.to) return item

      const { category, nextName } = decision
      return {
        ...item,
        name: nextName,
        feeCategoryId: String(item.feeCategoryId || item.categoryId || category.id || ''),
        invoiceItem: String(category.invoiceItem || item.invoiceItem || ''),
        vatRate: Number(category.vatRate ?? item.vatRate ?? 0),
        invoiced: category.invoiced !== false
      }
    })
  }))

  // Öğrenci numarası taşımayan tek kayıtlar için: tüm eşleşmeler aynı kaleme
  // gidiyorsa güvenle taşınabilir, aksi halde dokunulmaz.
  const onlyNewName = renames.size > 1 && new Set(renames.values()).size === 1
    ? [...renames.values()][0]
    : null

  const resolveNext = (studentId, label) => {
    const from = normalizeLabel(label)
    if (!from) return null
    const key = `${studentId}::${from}`
    if (renames.has(key)) {
      const next = renames.get(key)
      return normalizeLabel(next) !== from ? next : null
    }
    if (!studentId && onlyNewName && normalizeLabel(onlyNewName) !== from) return onlyNewName
    return null
  }

  const migratedCollections = renames.size === 0
    ? collectionList
    : collectionList.map(collection => {
      const next = resolveNext(String(collection.studentId || ''), collection.item)
      return next ? { ...collection, item: next } : collection
    })

  const migratedInvoices = renames.size === 0
    ? invoiceList
    : invoiceList.map(invoice => {
      const next = resolveNext(String(invoice.studentId || ''), invoice.planName)
      return next ? { ...invoice, planName: next } : invoice
    })

  const changed =
    JSON.stringify(migratedStudents) !== JSON.stringify(studentList) ||
    JSON.stringify(migratedCollections) !== JSON.stringify(collectionList) ||
    JSON.stringify(migratedInvoices) !== JSON.stringify(invoiceList)

  return { students: migratedStudents, collections: migratedCollections, invoices: migratedInvoices, changed }
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { ...state, loaded: true, ...(action.payload || {}) }
    case 'SET_SAVING':
      return { ...state, saving: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SETTINGS_UPDATE':
      return { ...state, settings: { ...state.settings, ...action.payload } }
    case 'STUDENT_ADD':
      return { ...state, students: [...state.students, action.payload] }
    case 'STUDENT_UPDATE':
      return { ...state, students: state.students.map(s => String(s.id || s._id) === String(action.payload.id) ? { ...s, ...action.payload } : s) }
    case 'STUDENT_DELETE':
      return { ...state, students: state.students.filter(s => String(s.id || s._id) !== String(action.payload)) }
    case 'COLLECTION_ADD':
      return { ...state, collections: [...state.collections, action.payload] }
    case 'COLLECTION_UPDATE':
      return { ...state, collections: state.collections.map(c => String(c.id || c._id) === String(action.payload.id || action.payload._id) ? { ...c, ...action.payload } : c) }
    case 'COLLECTION_DELETE':
      return { ...state, collections: state.collections.filter(c => String(c.id || c._id) !== String(action.payload)) }
    case 'INVOICE_ADD':
      return { ...state, invoices: [...state.invoices, action.payload] }
    case 'INVOICE_DELETE':
      return { ...state, invoices: state.invoices.filter(i => String(i.uuid || i._id) !== String(action.payload)) }
    case 'REPLACE_ALL':
      return { ...state, ...action.payload, loaded: true }
    default:
      return state
  }
}

export function AnaokuluDataProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const debounceRef = useRef(null)
  const lastPersistedSnapshotRef = useRef('')
  const saveInFlightRef = useRef(false)
  const suppressAutoSaveRef = useRef(false)
  const { regionCurrentTenantId, isRegionAdmin, isAdminPanelMode, accessibleTenants, user, loading } = useAuth()
  const isManager = Boolean(isRegionAdmin || user?.role === 'superadmin' || user?.role === 'platform_admin')

  const snapshotSchoolState = (source = state) => JSON.stringify({
    settings: source.settings,
    students: source.students,
    collections: source.collections,
    invoices: source.invoices,
    checks: source.checks
  })

  // Bir tahsilatın mükerrer olup olmadığını kontrol eder.
  //
  // ÖNEMLİ 1: Bir taksit birden fazla PARÇALI tahsilatla kapatılabilir
  // (örn. 20.000 TL taksit → 2.000 TL + 18.000 TL). Bu yüzden mükerrerlik
  // taksit numarasına göre belirlenmez.
  //
  // ÖNEMLİ 2: Aynı öğrenciye aynı taksit için AYNI GÜN ve AYNI TUTARLA birden
  // fazla ayrı ödeme yapılabilir (örn. sabah 2.000 TL + akşam 2.000 TL).
  // Bunlar meşru ve birbirinden bağımsız ödemelerdir; her biri ayrı kayıt
  // olarak saklanmalı ve bakiyeye ayrı ayrı yansımalıdır. Bu yüzden
  // "aynı öğrenci + kalem + taksit + tarih + tutar" imzası mükerrerlik ölçütü
  // olarak KULLANILAMAZ; o imza meşru iki kaydı da eleyip sessizce atar ve
  // bakiye eksik hesaplanır.
  //
  // Gerçek mükerrerlik yalnızca aynı kaydın iki kez gönderilmesidir
  // (çift tıklama). Bunun için kayıt kimliği (id) tek ölçüttür. Eşzamanlı
  // ikinci gönderim ayrıca saveToBackend içindeki saveInFlightRef ile
  // yakalanır.
  const hasDuplicateCollection = (collections = [], candidate = {}) => {
    if (!candidate || !candidate.studentId || !candidate.item) return false

    const candidateId = candidate.id != null ? String(candidate.id) : ''
    if (!candidateId) return false

    // Yalnızca aynı kayıt kimliği = aynı kaydın tekrar gönderilmesi.
    return collections.some((collection) =>
      collection.id != null && String(collection.id) === candidateId
    )
  }

  const buildReqConfig = (extra = {}, tenantId) => {
    const cfg = { portalOverride: 'anaokulu', ...extra }
    const effectiveTenantId = tenantId || regionCurrentTenantId
    if (isManager && effectiveTenantId) {
      cfg.headers = { ...(cfg.headers || {}), 'X-Tenant-Id': String(effectiveTenantId) }
      cfg.params = { ...(cfg.params || {}), tenantId: String(effectiveTenantId) }
    }
    return cfg
  }

  const saveToBackend = async (nextState = state) => {
    if (loading) return
    if (isManager && !regionCurrentTenantId) return
    if (isAdminPanelMode) return
    if (saveInFlightRef.current) {
      return { ok: true, skipped: true }
    }

    const snapshot = snapshotSchoolState(nextState)
    if (snapshot === lastPersistedSnapshotRef.current) {
      return { ok: true, skipped: true }
    }

    saveInFlightRef.current = true
    try {
      dispatch({ type: 'SET_SAVING', payload: true })
      const body = {
        settings: nextState.settings,
        students: nextState.students,
        collections: nextState.collections,
        invoices: nextState.invoices,
        checks: nextState.checks,
        ...(isManager && regionCurrentTenantId ? { tenantId: String(regionCurrentTenantId) } : {})
      }
      const res = await api('/api/anaokulu/', {
        method: 'PUT',
        data: body,
        ...buildReqConfig({ silent: true })
      })
      if (res?.ok === false) {
        dispatch({ type: 'SET_ERROR', payload: res?.message || 'Kaydedilemedi' })
      } else {
        lastPersistedSnapshotRef.current = snapshot
        dispatch({ type: 'SET_ERROR', payload: null })
      }
      return res
    } catch (e) {
      const message = String(e?.message || e)
      dispatch({ type: 'SET_ERROR', payload: message })
      return { ok: false, message }
    } finally {
      saveInFlightRef.current = false
      dispatch({ type: 'SET_SAVING', payload: false })
    }
  }

  const loadFromBackend = async () => {
    if (loading) return
    const needsTenantId = isRegionAdmin && !isAdminPanelMode
    if (needsTenantId && !regionCurrentTenantId) return

    if (isAdminPanelMode) {
      try {
        const tenantList = Array.isArray(accessibleTenants) && accessibleTenants.length > 0
          ? accessibleTenants
          : []

        if (tenantList.length === 0) {
          dispatch({
            type: 'LOAD',
            payload: {
              settings: { ...initialState.settings },
              students: [],
              collections: [],
              invoices: [],
              checks: []
            }
          })
          return
        }

        const results = await Promise.all(
          tenantList.map(async (t) => {
            try {
              const res = await api('/api/anaokulu/', buildReqConfig({ silent: true, suppressAuthRedirect: true }, t.id))
              return { tenant: t, data: res?.ok !== false ? res : null }
            } catch {
              return { tenant: t, data: null }
            }
          })
        )

        let firstSettings = { ...initialState.settings }

        results.forEach(({ tenant, data }, idx) => {
          if (!data) return
          if (idx === 0) {
            firstSettings = {
              ...initialState.settings,
              ...(data.settings || {}),
              feeCategories: Array.isArray(data.settings?.feeCategories) ? data.settings.feeCategories : [],
              discounts: Array.isArray(data.settings?.discounts) ? data.settings.discounts : [],
              luca: {
                tckn: '',
                customerNo: '',
                username: '',
                password: '',
                url: 'https://turmobefatura.luca.com.tr',
                autoSync: true,
                ...(data.settings?.luca || {})
              }
            }
          }
        })

        const merged = mergeAnaokuluResponses(results)
        const mergedFeeCategories = firstSettings.feeCategories || []
        // Admin paneli salt okunur; migration burada yalnızca görüntüyü düzeltir.
        const migration = migrateFeeCategories(merged.students, merged.collections, merged.invoices, mergedFeeCategories)

        dispatch({
          type: 'LOAD',
          payload: {
            settings: firstSettings,
            students: migration.students,
            collections: migration.collections,
            invoices: migration.invoices,
            checks: merged.checks
          }
        })
      } catch {
      }
      return
    }

    try {
      const res = await api('/api/anaokulu/', buildReqConfig({ silent: true, suppressAuthRedirect: true }))
      if (res?.ok !== false && res) {
        const rawStudents = res.students || []
        const rawCollections = res.collections || []
        const rawInvoices = res.invoices || []
        const migration = migrateFeeCategories(rawStudents, rawCollections, rawInvoices, res.settings?.feeCategories || [])
        const loadedState = {
          settings: {
            ...initialState.settings,
            ...(res.settings || {}),
            feeCategories: Array.isArray(res.settings?.feeCategories) ? res.settings.feeCategories : [],
            discounts: Array.isArray(res.settings?.discounts) ? res.settings.discounts : [],
            luca: {
              tckn: '',
              customerNo: '',
              username: '',
              password: '',
              url: 'https://turmobefatura.luca.com.tr',
              autoSync: true,
              ...(res.settings?.luca || {})
            }
          },
          students: migration.students,
          collections: migration.collections,
          invoices: migration.invoices,
          checks: res.checks || []
        }

        // Migration bir şeyi değiştirdiyse, "son kaydedilen" anlık görüntüyü ham
        // veriye eşitle ki otomatik kayıt (autosave) migration'ı kalıcı olarak yazsın.
        // Hiçbir şey değişmediyse snapshot'ı yüklenen haline eşitleriz; aksi halde
        // her açılışta gereksiz bir PUT isteği atılırdı.
        lastPersistedSnapshotRef.current = snapshotSchoolState(
          migration.changed
            ? { ...loadedState, students: rawStudents, collections: rawCollections, invoices: rawInvoices }
            : loadedState
        )

        dispatch({
          type: 'LOAD',
          payload: loadedState
        })
      }
    } catch {
    }
  }

  useEffect(() => {
    if (!loading) {
      loadFromBackend()
    }
  }, [loading, regionCurrentTenantId, isRegionAdmin, isAdminPanelMode, accessibleTenants])

  useEffect(() => {
    if (!state.loaded) return
    if (isAdminPanelMode) return
    if (suppressAutoSaveRef.current) return
    if (state.saving || saveInFlightRef.current) return
    const currentSnapshot = snapshotSchoolState(state)
    if (currentSnapshot === lastPersistedSnapshotRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const latest = snapshotSchoolState(state)
      if (suppressAutoSaveRef.current) return
      if (latest === lastPersistedSnapshotRef.current || state.saving || saveInFlightRef.current) return
      saveToBackend(state)
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings, state.students, state.collections, state.invoices, state.checks, isAdminPanelMode, state.saving])

  const actions = {
    updateSettings: (patch) => dispatch({ type: 'SETTINGS_UPDATE', payload: patch }),
    updateSettingsAndSave: async (settings) => {
      const nextState = { ...state, settings }
      dispatch({ type: 'SETTINGS_UPDATE', payload: settings })
      if (isAdminPanelMode) return { ok: false, message: 'Admin panelinde ayar kaydı kapalı.' }
      return saveToBackend(nextState)
    },
    addStudent: (s) => dispatch({ type: 'STUDENT_ADD', payload: { id: s.id || Date.now(), ...s } }),
    updateStudent: (s) => dispatch({ type: 'STUDENT_UPDATE', payload: s }),
    updateStudentAndSave: async (student) => {
      const nextState = {
        ...state,
        students: state.students.map(existing =>
          String(existing.id || existing._id) === String(student.id)
            ? { ...existing, ...student }
            : existing
        )
      }
      dispatch({ type: 'STUDENT_UPDATE', payload: student })
      if (isAdminPanelMode) return
      const res = await api(`/api/anaokulu/students/${encodeURIComponent(student.id)}`, {
        method: 'PUT',
        data: { items: student.items },
        ...buildReqConfig({ silent: true })
      })
      if (res?.ok === false) {
        dispatch({ type: 'SET_ERROR', payload: res?.message || 'Öğrenci planı kaydedilemedi' })
      } else {
        dispatch({ type: 'SET_ERROR', payload: null })
      }
    },
    deleteStudent: (id) => dispatch({ type: 'STUDENT_DELETE', payload: id }),
    addCollection: async (c) => {
      const payload = { id: c.id || Date.now(), ...c }
      const lockedDates = Array.isArray(state.settings?.lockedDates) ? state.settings.lockedDates : []
      if (payload.date && lockedDates.includes(payload.date)) {
        const msg = `🔒 ${payload.date} tarihi kilitlidir. Bu güne tahsilat eklenemez.`
        dispatch({ type: 'SET_ERROR', payload: msg })
        throw new Error(msg)
      }

      if (isAdminPanelMode) {
        dispatch({ type: 'COLLECTION_ADD', payload })
        return { ok: true }
      }

      if (hasDuplicateCollection(state.collections, payload)) {
        return { ok: true, skipped: true, message: 'Bu tahsilat kaydı zaten kayıtlı.' }
      }

      const nextState = { ...state, collections: [...state.collections, payload] }
      dispatch({ type: 'COLLECTION_ADD', payload })
      suppressAutoSaveRef.current = true
      const res = await saveToBackend(nextState)
      suppressAutoSaveRef.current = false

      if (res?.ok === false) {
        dispatch({ type: 'SET_ERROR', payload: res?.message || 'Tahsilat kaydedilemedi.' })
        throw new Error(res?.message || 'Tahsilat kaydedilemedi.')
      }

      await loadFromBackend()
      dispatch({ type: 'SET_ERROR', payload: null })
      return res
    },
    updateCollection: async (c) => {
      const lockedDates = Array.isArray(state.settings?.lockedDates) ? state.settings.lockedDates : []
      const existing = state.collections.find(col => String(col.id || col._id) === String(c.id || c._id))
      if (existing?.date && lockedDates.includes(existing.date)) {
        const msg = `🔒 ${existing.date} tarihi kilitlidir. Kilitli güne ait tahsilat düzenlenemez.`
        dispatch({ type: 'SET_ERROR', payload: msg })
        throw new Error(msg)
      }
      if (c.date && lockedDates.includes(c.date)) {
        const msg = `🔒 ${c.date} tarihi kilitlidir. Kilitli bir tarihe tahsilat taşınamaz.`
        dispatch({ type: 'SET_ERROR', payload: msg })
        throw new Error(msg)
      }

      if (isAdminPanelMode) {
        dispatch({ type: 'COLLECTION_UPDATE', payload: c })
        return { ok: true }
      }

      const nextState = {
        ...state,
        collections: state.collections.map(collection =>
          String(collection.id || collection._id) === String(c.id || c._id)
            ? { ...collection, ...c }
            : collection
        )
      }
      dispatch({ type: 'COLLECTION_UPDATE', payload: c })
      const res = await saveToBackend(nextState)
      if (res?.ok === false) {
        dispatch({ type: 'SET_ERROR', payload: res?.message || 'Tahsilat güncellenemedi.' })
        throw new Error(res?.message || 'Tahsilat güncellenemedi.')
      }

      await loadFromBackend()
      dispatch({ type: 'SET_ERROR', payload: null })
      return res
    },
    deleteCollection: (id) => {
      const existing = state.collections.find(col => String(col.id || col._id) === String(id))
      const lockedDates = Array.isArray(state.settings?.lockedDates) ? state.settings.lockedDates : []
      if (existing?.date && lockedDates.includes(existing.date)) {
        const msg = `🔒 ${existing.date} tarihi kilitlidir. Kilitli güne ait tahsilat silinemez.`
        dispatch({ type: 'SET_ERROR', payload: msg })
        throw new Error(msg)
      }

      dispatch({ type: 'COLLECTION_DELETE', payload: id })
      if (!isAdminPanelMode && id != null) {
        api(`/api/anaokulu/collections/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          ...buildReqConfig({ silent: true })
        }).catch(error => {
          dispatch({ type: 'SET_ERROR', payload: String(error?.message || error) })
        })
      }
    },
    addInvoice: (i) => dispatch({ type: 'INVOICE_ADD', payload: { uuid: i.uuid || `inv_${Date.now()}`, ...i } }),
    deleteInvoice: (uuid) => dispatch({ type: 'INVOICE_DELETE', payload: uuid }),
    replaceAll: (data) => dispatch({ type: 'REPLACE_ALL', payload: data }),
    forceSave: () => !isAdminPanelMode && saveToBackend(state),
    reload: () => loadFromBackend()
  }

  return (
    <AnaokuluDataContext.Provider value={{ state, actions, save: () => !isAdminPanelMode && saveToBackend(state), isAdminPanelMode }}>
      {children}
    </AnaokuluDataContext.Provider>
  )
}

export const useAnaokuluData = () => useContext(AnaokuluDataContext)
