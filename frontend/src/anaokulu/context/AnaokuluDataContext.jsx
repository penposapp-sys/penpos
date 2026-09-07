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
  const { regionCurrentTenantId, isRegionAdmin, user, loading } = useAuth()
  const isManager = Boolean(isRegionAdmin || user?.role === 'superadmin' || user?.role === 'platform_admin')

  const buildReqConfig = (extra = {}) => {
    const cfg = { portalOverride: 'anaokulu', ...extra }
    if (isManager && regionCurrentTenantId) {
      cfg.headers = { ...(cfg.headers || {}), 'X-Tenant-Id': String(regionCurrentTenantId) }
      cfg.params = { ...(cfg.params || {}), tenantId: String(regionCurrentTenantId) }
    }
    return cfg
  }

  const saveToBackend = async (nextState = state) => {
    if (loading) return
    if (isRegionAdmin && !regionCurrentTenantId) return
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
        method: 'POST',
        data: body,
        ...buildReqConfig({ silent: true })
      })
      if (res?.ok === false) {
        dispatch({ type: 'SET_ERROR', payload: res?.message || 'Kaydedilemedi' })
      } else {
        dispatch({ type: 'SET_ERROR', payload: null })
      }
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: String(e?.message || e) })
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false })
    }
  }

  const loadFromBackend = async () => {
    if (loading) return
    if (isRegionAdmin && !regionCurrentTenantId) return
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
  }, [loading, regionCurrentTenantId, isRegionAdmin])

  useEffect(() => {
    if (!state.loaded) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveToBackend(state)
    }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings, state.students, state.collections, state.invoices, state.checks])

  const actions = {
    updateSettings: (patch) => dispatch({ type: 'SETTINGS_UPDATE', payload: patch }),
    addStudent: (s) => dispatch({ type: 'STUDENT_ADD', payload: { id: s.id || Date.now(), ...s } }),
    updateStudent: (s) => dispatch({ type: 'STUDENT_UPDATE', payload: s }),
    deleteStudent: (id) => dispatch({ type: 'STUDENT_DELETE', payload: id }),
    addCollection: (c) => dispatch({ type: 'COLLECTION_ADD', payload: { id: c.id || Date.now(), ...c } }),
    updateCollection: (c) => dispatch({ type: 'COLLECTION_UPDATE', payload: c }),
    deleteCollection: (id) => dispatch({ type: 'COLLECTION_DELETE', payload: id }),
    addInvoice: (i) => dispatch({ type: 'INVOICE_ADD', payload: { uuid: i.uuid || `inv_${Date.now()}`, ...i } }),
    deleteInvoice: (uuid) => dispatch({ type: 'INVOICE_DELETE', payload: uuid }),
    replaceAll: (data) => dispatch({ type: 'REPLACE_ALL', payload: data }),
    forceSave: () => saveToBackend(state),
    reload: () => loadFromBackend()
  }

  return (
    <AnaokuluDataContext.Provider value={{ state, actions, save: () => saveToBackend(state) }}>
      {children}
    </AnaokuluDataContext.Provider>
  )
}

export const useAnaokuluData = () => useContext(AnaokuluDataContext)
