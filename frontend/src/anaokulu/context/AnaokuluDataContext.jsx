import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { api } from '../../lib/apiClient.js'
import { useAuth } from '../../context/AuthContext.jsx'

const AnaokuluDataContext = createContext()

const initialState = {
  loaded: false,
  saving: false,
  error: null,
  settings: {
    okulAdi: '',
    vergiOrani: 10,
    donem: '',
    yearStart: '',
    matchBy: 'tax',
    invoiceSettings: {},
    feeCategories: [],
    discounts: []
  },
  students: [],
  collections: [],
  invoices: [],
  checks: []
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
  const { regionCurrentTenantId, isRegionAdmin, isAdminPanelMode, accessibleTenants, user, loading } = useAuth()
  const isManager = Boolean(isRegionAdmin || user?.role === 'superadmin' || user?.role === 'platform_admin')

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
    if (isRegionAdmin && !regionCurrentTenantId) return
    if (isAdminPanelMode) return
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
        dispatch({ type: 'SET_ERROR', payload: null })
      }
      return res
    } catch (e) {
      const message = String(e?.message || e)
      dispatch({ type: 'SET_ERROR', payload: message })
      return { ok: false, message }
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false })
    }
  }

  const loadFromBackend = async () => {
    if (loading) return
    if (isRegionAdmin && !regionCurrentTenantId && !isAdminPanelMode) return

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

        const allStudents = []
        const allCollections = []
        const allInvoices = []
        const allChecks = []
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
          const schoolId = String(tenant.id || tenant._id)
          const schoolName = tenant.name || 'İsimsiz Okul'
          ;(data.students || []).forEach(s => {
            allStudents.push({
              ...s,
              _schoolId: schoolId,
              _schoolName: schoolName
            })
          })
          ;(data.collections || []).forEach(c => {
            allCollections.push({
              ...c,
              _schoolId: schoolId,
              _schoolName: schoolName
            })
          })
          ;(data.invoices || []).forEach(i => {
            allInvoices.push({
              ...i,
              _schoolId: schoolId,
              _schoolName: schoolName
            })
          })
          ;(data.checks || []).forEach(ch => {
            allChecks.push({
              ...ch,
              _schoolId: schoolId,
              _schoolName: schoolName
            })
          })
        })

        dispatch({
          type: 'LOAD',
          payload: {
            settings: firstSettings,
            students: allStudents,
            collections: allCollections,
            invoices: allInvoices,
            checks: allChecks
          }
        })
      } catch {
      }
      return
    }

    try {
      const res = await api('/api/anaokulu/', buildReqConfig({ silent: true, suppressAuthRedirect: true }))
      if (res?.ok !== false && res) {
        dispatch({
          type: 'LOAD',
          payload: {
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
            students: res.students || [],
            collections: res.collections || [],
            invoices: res.invoices || [],
            checks: res.checks || []
          }
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
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveToBackend(state)
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings, state.students, state.collections, state.invoices, state.checks, isAdminPanelMode])

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
    addCollection: (c) => dispatch({ type: 'COLLECTION_ADD', payload: { id: c.id || Date.now(), ...c } }),
    updateCollection: (c) => dispatch({ type: 'COLLECTION_UPDATE', payload: c }),
    deleteCollection: (id) => {
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
