import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'

const STATUS_LABELS = {
  pending: 'Onay Bekliyor',
  confirmed: 'Onaylandı',
  arrived: 'Geldi',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
  no_show: 'Gelmedi'
}
const STATUS_COLORS = {
  pending: '#f59e0b',
  confirmed: '#2563eb',
  arrived: '#16a34a',
  completed: '#64748b',
  cancelled: '#ef4444',
  no_show: '#7c3aed'
}
const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const ALL_BRANCHES = '__all__'
const tableNameCollator = new Intl.Collator('tr-TR', { numeric: true, sensitivity: 'base' })
const localDate = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const initialSettings = () => ({
  onlineEnabled: false,
  durationMinutes: 60,
  bufferMinutes: 0,
  minAdvanceMinutes: 0,
  maxAdvanceDays: 90,
  pendingHoldMinutes: 15,
  autoConfirm: false,
  workingHours: Array.from({ length: 7 }, (_, day) => ({ day, open: true, start: '09:00', end: '22:00' }))
})
const initialForm = (date = localDate()) => ({
  customerName: '',
  phone: '',
  guestCount: 2,
  date,
  time: '',
  tableId: '',
  note: '',
  status: 'pending'
})

export default function ReservationsPage() {
  const navigate = useNavigate()
  const { user, allowedBranchIds = [] } = useAuth()
  const allowedIds = useMemo(() => Array.from(new Set((Array.isArray(allowedBranchIds) ? allowedBranchIds : []).map((item) => String(item?._id || item?.id || item)).filter(Boolean))), [allowedBranchIds])
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [date, setDate] = useState(localDate())
  const [status, setStatus] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [reservations, setReservations] = useState([])
  const [reservationsError, setReservationsError] = useState('')
  const [reservationNotice, setReservationNotice] = useState('')
  const [branchesError, setBranchesError] = useState('')
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [tables, setTables] = useState([])
  const [settings, setSettings] = useState(initialSettings)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(initialForm())
  const [availableSlots, setAvailableSlots] = useState([])
  const [availabilityError, setAvailabilityError] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [saving, setSaving] = useState(false)
  const isAdmin = user?.role === 'tenant_admin'
  const isStaff = user?.role === 'staff'
  const permissions = Array.isArray(user?.permissions) ? user.permissions : []
  const canViewReservations = isAdmin || permissions.includes('reservations_view')
  const canCreateReservations = isAdmin || permissions.includes('manage_tables') || permissions.includes('reservations_create')
  const canApproveReservations = isAdmin || permissions.includes('manage_tables') || permissions.includes('reservations_approve')
  const activeStaffBranchId = String(user?.branchId || (allowedIds.length === 1 ? allowedIds[0] : '')).trim()
  const isAllBranches = isAdmin && branchId === ALL_BRANCHES
  const scopedBranchIds = useMemo(() => isAllBranches
    ? branches.map((branch) => String(branch._id))
    : branchId && branchId !== ALL_BRANCHES ? [branchId] : [], [branchId, branches, isAllBranches])

  const selectBranch = useCallback((id) => {
    const next = String(id || '')
    setBranchId(next)
    try {
      if (next && next !== ALL_BRANCHES) localStorage.setItem('selectedBranchId', next)
    } catch {}
  }, [])

  const loadBranches = useCallback(async () => {
    try {
      const result = await api('/api/branches', { silent: true, cacheMode: 'no-store' })
      if (result?.success !== true) throw new Error(result?.message || 'Şubeler yüklenemedi')
      const permitted = (Array.isArray(result?.branches) ? result.branches : [])
        .filter((branch) => branch.isActive !== false
          && (allowedIds.length === 0 || allowedIds.includes(String(branch._id)))
          && (!isStaff || String(branch._id) === activeStaffBranchId))
      setBranches(permitted)
      setBranchesError('')
      setBranchId((previous) => {
        if (isStaff) return permitted.some((branch) => String(branch._id) === activeStaffBranchId)
          ? activeStaffBranchId
          : ''
        if (previous === ALL_BRANCHES && isAdmin && permitted.length > 1) return ALL_BRANCHES
        const saved = (() => { try { return localStorage.getItem('selectedBranchId') || '' } catch { return '' } })()
        const chosen = [previous, saved, permitted[0]?._id].find((value) => value && permitted.some((branch) => String(branch._id) === String(value)))
        if (chosen) {
          try { localStorage.setItem('selectedBranchId', String(chosen)) } catch {}
        }
        return String(chosen || '')
      })
    } catch (err) {
      setBranchesError(err?.message || 'Şubeler yüklenemedi')
      toast.error(err?.message || 'Şubeler yüklenemedi')
    }
  }, [activeStaffBranchId, allowedIds, isAdmin, isStaff])

  const loadBranchSettings = useCallback(async () => {
    if (!isAdmin || !branchId || isAllBranches) {
      setSettingsLoaded(false)
      setSettingsError('')
      return
    }
    setSettingsLoaded(false)
    setSettingsError('')
    try {
      const result = await api(`/api/reservations/settings?branchId=${encodeURIComponent(branchId)}`, {
        silent: true,
        skipBranchHeader: true,
        cacheMode: 'no-store'
      })
      if (result?.success !== true || !result?.settings) {
        throw new Error(result?.message || result?.data?.message || 'Rezervasyon ayarları yüklenemedi')
      }
      setSettings(result.settings)
      setSettingsLoaded(true)
    } catch (err) {
      setSettingsError(err?.message || 'Rezervasyon ayarları yüklenemedi')
      toast.error(err?.message || 'Rezervasyon ayarları yüklenemedi')
    }
  }, [branchId, isAdmin, isAllBranches])

  const loadReservations = useCallback(async () => {
    if (!canViewReservations) {
      setReservations([])
      setNotifications([])
      setPendingCount(0)
      setUnreadCount(0)
      return
    }
    if (!branchId || (isAllBranches && scopedBranchIds.length === 0)) {
      setReservations([])
      setPendingCount(0)
      setUnreadCount(0)
      setNotifications([])
      setLoading(false)
      return
    }
    setLoading(true)
    setReservationsError('')
    setReservationNotice('')
    try {
      const scopeParams = new URLSearchParams(isAllBranches
        ? { branchIds: scopedBranchIds.join(','), date }
        : { branchId, date })
      const notificationParams = new URLSearchParams(isAllBranches
        ? { branchIds: scopedBranchIds.join(',') }
        : { branchId })
      if (status) scopeParams.set('status', status)
      const [listResult, countResult, notificationResult] = await Promise.all([
        api(`/api/reservations?${scopeParams}`, { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api(`/api/reservations/pending-count?${notificationParams}`, { silent: true, skipBranchHeader: true, cacheMode: 'no-store' }),
        api(`/api/reservations/notifications?${notificationParams}`, { silent: true, skipBranchHeader: true, cacheMode: 'no-store' })
      ])
      if (listResult?.success !== true) {
        throw new Error(listResult?.message || listResult?.data?.message || 'Rezervasyonlar yüklenemedi')
      }
      setReservations(Array.isArray(listResult?.reservations) ? listResult.reservations : [])
      if (countResult?.success === true) {
        setPendingCount(Number(countResult?.pendingCount || 0))
        setUnreadCount(Number(countResult?.unreadCount || 0))
      } else {
        setReservationNotice(countResult?.message || 'Rezervasyon sayaçları alınamadı.')
      }
      if (notificationResult?.success === true) {
        setNotifications(Array.isArray(notificationResult?.notifications) ? notificationResult.notifications : [])
      } else {
        setNotifications([])
        setReservationNotice(notificationResult?.message || 'Bildirimler alınamadı.')
      }
    } catch (err) {
      setReservations([])
      setReservationsError(err?.message || 'Rezervasyonlar yüklenemedi')
      toast.error(err?.data?.message || err?.message || 'Rezervasyonlar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [branchId, canViewReservations, date, isAllBranches, scopedBranchIds, status])

  useEffect(() => { loadBranches() }, [loadBranches])
  useEffect(() => { loadReservations() }, [loadReservations])
  useEffect(() => { loadBranchSettings() }, [loadBranchSettings])
  useEffect(() => {
    if (!branchId) return undefined
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadReservations()
    }, 10000)
    return () => window.clearInterval(timer)
  }, [branchId, loadReservations])

  const loadTablesAndSettings = async (targetBranchId = branchId) => {
    if (!targetBranchId || targetBranchId === ALL_BRANCHES) return
    try {
      const tableRequest = api(`/api/tenant/tables?branchId=${encodeURIComponent(targetBranchId)}`, { silent: true, skipBranchHeader: true, cacheMode: 'no-store' })
      const [tableResult, settingsResult] = await Promise.all([
        tableRequest,
        isAdmin
          ? api(`/api/reservations/settings?branchId=${encodeURIComponent(targetBranchId)}`, { silent: true, skipBranchHeader: true, cacheMode: 'no-store' })
          : Promise.resolve(null)
      ])
      if (tableResult?.success !== true || (isAdmin && (settingsResult?.success !== true || !settingsResult?.settings))) {
        throw new Error(tableResult?.message || settingsResult?.message || 'Masa ve rezervasyon ayarları yüklenemedi')
      }
      setTables((Array.isArray(tableResult?.tables) ? tableResult.tables : [])
        .slice()
        .sort((a, b) => tableNameCollator.compare(String(a.name || ''), String(b.name || ''))))
      if (isAdmin) {
        setSettings(settingsResult.settings)
        setSettingsLoaded(true)
        setSettingsError('')
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Masa ve rezervasyon ayarları yüklenemedi')
    }
  }

  const loadAvailability = async (nextForm = form, targetBranchId = branchId, excludeReservationId = editing?.id || '') => {
    if (!targetBranchId || targetBranchId === ALL_BRANCHES || !nextForm.date || !nextForm.guestCount) return
    setAvailabilityError('')
    try {
      const params = new URLSearchParams({ branchId: targetBranchId, date: nextForm.date, guestCount: String(nextForm.guestCount) })
      if (excludeReservationId) params.set('excludeReservationId', excludeReservationId)
      const result = await api(`/api/reservations/availability?${params}`, { silent: true, skipBranchHeader: true, cacheMode: 'no-store' })
      if (result?.success !== true) throw new Error(result?.message || 'Uygunluk bilgisi yüklenemedi')
      setAvailableSlots(Array.isArray(result?.slots) ? result.slots : [])
    } catch (err) {
      setAvailableSlots([])
      setAvailabilityError(err?.message || 'Uygunluk bilgisi yüklenemedi')
      toast.error(err?.data?.message || err?.message || 'Uygunluk bilgisi yüklenemedi')
    }
  }

  const openCreate = async () => {
    if (!branchId || branchId === ALL_BRANCHES) return
    const next = initialForm(date)
    setFormError('')
    setAvailabilityError('')
    setEditing(null)
    setForm(next)
    setAvailableSlots([])
    setModalOpen(true)
    await Promise.all([loadTablesAndSettings(), loadAvailability(next, branchId, '')])
  }

  const openEdit = async (reservation) => {
    if (isStaff && reservation.branchId !== activeStaffBranchId) return
    selectBranch(reservation.branchId)
    const next = {
      customerName: reservation.customerName,
      phone: reservation.phone,
      guestCount: reservation.guestCount,
      date: reservation.date,
      time: reservation.time,
      tableId: reservation.tableId || '',
      note: reservation.note || '',
      status: reservation.status
    }
    setEditing(reservation)
    setFormError('')
    setAvailabilityError('')
    setForm(next)
    setAvailableSlots([])
    setModalOpen(true)
    await Promise.all([loadTablesAndSettings(reservation.branchId), loadAvailability(next, reservation.branchId, reservation.id)])
  }

  const save = async (event) => {
    event.preventDefault()
    const targetBranchId = String(editing?.branchId || branchId || '')
    if (!targetBranchId || targetBranchId === ALL_BRANCHES || saving) return
    setSaving(true)
    try {
      selectBranch(targetBranchId)
      const result = await api(editing
        ? `/api/reservations/${editing.id}?branchId=${encodeURIComponent(targetBranchId)}`
        : `/api/reservations?branchId=${encodeURIComponent(targetBranchId)}`, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
        silent: true,
        skipBranchHeader: false
      })
      toast.success(editing ? 'Rezervasyon güncellendi' : 'Rezervasyon oluşturuldu')
      setModalOpen(false)
      setReservations((previous) => {
        const next = (previous || []).filter((item) => item.id !== result?.reservation?.id)
        return [...next, result.reservation].sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`))
      })
      await loadReservations()
    } catch (err) {
      const message = err?.data?.message || err?.message || 'Rezervasyon kaydedilemedi'
      setFormError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (reservation, nextStatus) => {
    if (busyId) return
    if (isStaff && reservation.branchId !== activeStaffBranchId) return
    setBusyId(reservation.id)
    try {
      const result = await api(`/api/reservations/${reservation.id}/status?branchId=${encodeURIComponent(reservation.branchId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
        silent: true,
        skipBranchHeader: true
      })
      if (result?.success !== true || !result?.reservation) {
        throw new Error(result?.message || result?.data?.message || 'Rezervasyon durumu güncellenemedi.')
      }
      setReservations((previous) => previous.map((item) => item.id === reservation.id ? result.reservation : item))
      toast.success(`Rezervasyon: ${STATUS_LABELS[nextStatus]}`)
      await loadReservations()
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Durum güncellenemedi')
    } finally {
      setBusyId('')
    }
  }

  const arriveAndOpen = async (reservation) => {
    if (busyId) return
    if (isStaff && reservation.branchId !== activeStaffBranchId) return
    setBusyId(reservation.id)
    try {
      selectBranch(reservation.branchId)
      const result = await api(`/api/reservations/${reservation.id}/arrive?branchId=${encodeURIComponent(reservation.branchId)}`, {
        method: 'POST',
        body: JSON.stringify({}),
        silent: true,
        skipBranchHeader: true
      })
      toast.success(result?.opened ? 'Adisyon açıldı' : 'Mevcut adisyon açıldı')
      navigate(`/restoran/app/pos?orderId=${encodeURIComponent(result.orderId)}`, { state: { fromTables: true, tableName: reservation.tableName || '' } })
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Adisyon açılamadı')
      await loadReservations()
    } finally {
      setBusyId('')
    }
  }

  const markRead = async (id = '') => {
    try {
      const notificationParams = new URLSearchParams(isAllBranches
        ? { branchIds: scopedBranchIds.join(',') }
        : { branchId })
      const endpoint = id
        ? `/api/reservations/notifications/${id}/read?${notificationParams}`
        : `/api/reservations/notifications/read?${notificationParams}`
      await api(endpoint, { method: 'PUT', body: JSON.stringify({}), silent: true, skipBranchHeader: true })
      await loadReservations()
    } catch (err) {
      toast.error(err?.message || 'Bildirimler güncellenemedi')
    }
  }

  const saveSettings = async (event) => {
    event.preventDefault()
    if (!isAdmin || isAllBranches || settingsSaving || !branchId) return
    setSettingsSaving(true)
    try {
      selectBranch(branchId)
      const result = await api(`/api/reservations/settings?branchId=${encodeURIComponent(branchId)}`, {
        method: 'PUT',
        body: JSON.stringify(settings),
        silent: true,
        skipBranchHeader: false
      })
      if (result?.success !== true || !result?.settings) {
        throw new Error(result?.message || result?.data?.message || 'Rezervasyon ayarları kaydedilemedi')
      }
      setSettings(result.settings)
      setSettingsLoaded(true)
      setSettingsError('')
      toast.success('Rezervasyon ayarları kaydedildi')
      setSettingsOpen(false)
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Ayarlar kaydedilemedi')
    } finally {
      setSettingsSaving(false)
    }
  }

  const setFormField = (key, value) => {
    const next = ['date', 'guestCount'].includes(key)
      ? { ...form, [key]: value, tableId: '', time: '' }
      : key === 'tableId'
        ? { ...form, tableId: value, time: '' }
        : { ...form, [key]: value }
    setForm(next)
    if (['date', 'guestCount'].includes(key)) loadAvailability(next, branchId, editing?.id || '')
  }
  const slot = availableSlots.find((item) => item.time === form.time)
  const isSlotAvailableForForm = (item) => form.tableId
    ? item.tables?.some((table) => String(table.id) === String(form.tableId)) === true
    : item.available === true
  const selectedTimeAvailable = slot ? isSlotAvailableForForm(slot) : false
  const slotTables = (Array.isArray(slot?.tables) ? slot.tables : [])
    .slice()
    .sort((a, b) => tableNameCollator.compare(String(a.name || ''), String(b.name || '')))

  return (
    <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
      <header className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center', padding: '22px 24px', border: '1px solid rgba(37,99,235,0.16)', background: 'linear-gradient(120deg, rgba(15,35,64,0.98), rgba(19,61,82,0.96))', color: '#fff' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, color: '#fff' }}>Rezervasyonlar</h1>
          <div style={{ color: 'rgba(226,232,240,0.8)', marginTop: 6 }}>Online ve personel rezervasyonlarını şube bazında yönetin.</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {isAdmin && !isAllBranches ? <button className="btn" type="button" onClick={() => { loadTablesAndSettings(); setSettingsOpen(true) }} style={headerButtonStyle}>Rezervasyon Ayarları</button> : null}
          {canCreateReservations ? <button className="btn" type="button" onClick={openCreate} disabled={!branchId || isAllBranches} style={{ ...headerButtonStyle, background: '#22c55e', borderColor: '#22c55e', color: '#062b22' }}>+ Rezervasyon Ekle</button> : null}
          <button className="btn" type="button" onClick={() => navigate('/restoran/app/tables')} style={headerButtonStyle}>Masalara Dön</button>
        </div>
      </header>

      <section className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 14, alignItems: 'end', padding: 18 }}>
        <label style={fieldLabelStyle}>Şube
          <select value={branchId} onChange={(e) => selectBranch(e.target.value)} style={fieldControlStyle}>
            <option value="">Şube seçin</option>
            {isAdmin && branches.length > 0 ? <option value={ALL_BRANCHES}>Tüm Şubeler</option> : null}
            {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
          </select>
        </label>
        <label style={fieldLabelStyle}>Tarih<input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldControlStyle} /></label>
        <label style={fieldLabelStyle}>Durum
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={fieldControlStyle}>
            <option value="">Tüm durumlar</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'end' }}>
          <button className="btn" type="button" onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'} style={viewButtonStyle(viewMode === 'list')}>Liste</button>
          <button className="btn" type="button" onClick={() => setViewMode('calendar')} aria-pressed={viewMode === 'calendar'} style={viewButtonStyle(viewMode === 'calendar')}>Günlük Takvim</button>
          <button className="btn" type="button" onClick={loadReservations} disabled={loading} style={viewButtonStyle(false)}>{loading ? 'Yükleniyor…' : 'Yenile'}</button>
        </div>
      </section>

      {branchesError ? <div role="alert" className="card" style={alertStyle}>{branchesError}</div> : null}
      {!branchId && !branchesError ? <div className="card" style={emptyStateStyle}>{branches.length ? 'Rezervasyonları görmek için bir şube seçin.' : 'Bu kullanıcı için erişilebilir aktif şube bulunamadı.'}</div> : null}
      {isAdmin && branchId && !isAllBranches ? (
        <section className="card" role={settingsError || (settingsLoaded && !settings.onlineEnabled) ? 'status' : undefined} style={settingsError || (settingsLoaded && !settings.onlineEnabled) ? alertStyle : noticeStyle}>
          {settingsError
            ? `Online rezervasyon durumu doğrulanamadı: ${settingsError}`
            : !settingsLoaded
              ? 'Şubenin online rezervasyon hizmet durumu yükleniyor…'
              : settings.onlineEnabled
                ? `Online rezervasyon hizmeti açık · ${branches.find((item) => String(item._id) === branchId)?.name || 'Seçili şube'}`
                : `Online rezervasyon hizmeti kapalı · ${branches.find((item) => String(item._id) === branchId)?.name || 'Seçili şube'}. Üye web sitesindeki rezervasyon butonu görünür olsa da müşteriler rezervasyon oluşturamaz. Hizmeti açmak için Rezervasyon Ayarları'ndan etkinleştirin.`}
        </section>
      ) : null}

      {!canViewReservations ? <div className="card" style={noticeStyle}>Rezervasyon listesini görüntüleme yetkiniz yok. Yetkiniz varsa yeni rezervasyon oluşturabilirsiniz.</div> : null}
      {canViewReservations ? <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 12 }}>
        <SummaryCard label="Gösterilen rezervasyon" value={reservations.length} color="#2563eb" />
        <SummaryCard label="Onay bekleyen" value={pendingCount} color="#d97706" />
        <SummaryCard label="Okunmamış bildirim" value={unreadCount} color="#059669" />
      </section> : null}

      {canViewReservations ? <section className="card" style={{ display: 'grid', gap: 12, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19 }}>{viewMode === 'list' ? 'Rezervasyon listesi' : 'Günlük rezervasyon takvimi'}</h2>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>{isAllBranches ? 'Tüm Şubeler' : branches.find((item) => String(item._id) === branchId)?.name || 'Şube seçilmedi'} · {date} · {status ? STATUS_LABELS[status] : 'Tüm durumlar'}</div>
          </div>
          {status ? <button className="btn" type="button" onClick={() => setStatus('')} style={viewButtonStyle(false)}>Tüm durumları göster</button> : null}
        </div>
        {reservationNotice ? <div role="status" style={noticeStyle}>{reservationNotice}</div> : null}
        {reservationsError ? (
          <div role="alert" style={alertStyle}>Rezervasyonlar yüklenemedi: {reservationsError}</div>
        ) : reservations.length === 0 ? (
          <div style={emptyStateStyle}>{loading ? 'Rezervasyonlar yükleniyor…' : 'Seçilen şube ve tarih için kayıtlı rezervasyon bulunamadı.'}</div>
        ) : viewMode === 'list' ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {reservations.map((reservation) => (
              <ReservationCard key={reservation.id} reservation={reservation} busy={busyId === reservation.id} onEdit={openEdit} onStatus={changeStatus} onArrive={arriveAndOpen} canApprove={canApproveReservations} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8, padding: 4 }}>
            {Array.from({ length: 24 }, (_, hour) => {
              const items = reservations.filter((reservation) => Number(reservation.time.split(':')[0]) === hour)
              return <div key={hour} style={{ minHeight: 48, display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <strong>{String(hour).padStart(2, '0')}:00</strong>
                <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>{items.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation} busy={busyId === reservation.id} onEdit={openEdit} onStatus={changeStatus} onArrive={arriveAndOpen} canApprove={canApproveReservations} compact />)}</div>
              </div>
            })}
          </div>
        )}
      </section> : null}

      {canViewReservations ? <section className="card" style={{ display: 'grid', gap: 10, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Rezervasyon bildirimleri</h2>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>{unreadCount} okunmamış · {notifications.length} kayıt</div>
          </div>
          {unreadCount > 0 ? <button className="btn" type="button" onClick={() => markRead()} style={viewButtonStyle(false)}>Tümünü okundu işaretle</button> : null}
        </div>
        {notifications.length === 0 ? <div style={{ color: 'var(--muted)', padding: '8px 0' }}>Bu şube için yeni bildirim yok.</div> : notifications.slice(0, 6).map((item) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
            <span>{item.reservation.customerName} · {item.reservation.guestCount} kişi · {item.reservation.date} {item.reservation.time}</span>
            {!item.readAt ? <button className="btn" type="button" onClick={() => markRead(item.id)}>Okundu</button> : <small style={{ color: 'var(--muted)' }}>Okundu</small>}
          </div>
        ))}
      </section> : null}

      {modalOpen ? (
        <div style={overlayStyle}>
          <form className="card" onSubmit={save} style={{ width: 'min(820px, 100%)', maxHeight: 'min(92vh, 960px)', overflow: 'auto', display: 'grid', gap: 18, padding: 'clamp(18px, 4vw, 30px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{editing ? 'Rezervasyonu Düzenle' : 'Rezervasyon Oluştur'}</h2>
                <div style={{ color: 'var(--muted)', marginTop: 5 }}>{branches.find((item) => String(item._id) === branchId)?.name || ''}</div>
              </div>
              <button className="btn" type="button" onClick={() => setModalOpen(false)}>Kapat</button>
            </div>
            <div style={formGridStyle}>
              <label style={fieldLabelStyle}>Ad soyad<input required minLength={2} maxLength={120} value={form.customerName} onChange={(e) => setFormField('customerName', e.target.value)} style={fieldControlStyle} /></label>
              <label style={fieldLabelStyle}>Telefon<input required type="tel" minLength={7} maxLength={40} value={form.phone} onChange={(e) => setFormField('phone', e.target.value)} style={fieldControlStyle} /></label>
              <label style={fieldLabelStyle}>Kişi sayısı<input required type="number" min={1} max={100} value={form.guestCount} onChange={(e) => setFormField('guestCount', Number(e.target.value))} style={fieldControlStyle} /></label>
              <label style={fieldLabelStyle}>Tarih<input required type="date" value={form.date} onChange={(e) => setFormField('date', e.target.value)} style={fieldControlStyle} /></label>
              <label style={fieldLabelStyle}>Masa<select value={form.tableId} onChange={(e) => setFormField('tableId', e.target.value)} style={fieldControlStyle}><option value="">Masa atama</option>{tables.map((table) => <option key={table.id || table._id} value={table.id || table._id}>{table.name}</option>)}</select></label>
              {!editing && canApproveReservations ? <label style={fieldLabelStyle}>İlk durum<select value={form.status} onChange={(e) => setFormField('status', e.target.value)} style={fieldControlStyle}><option value="pending">Onay Bekliyor</option><option value="confirmed">Onaylandı</option></select></label> : null}
              <label style={{ ...fieldLabelStyle, gridColumn: '1 / -1' }}>Not<textarea maxLength={1000} rows={3} value={form.note} onChange={(e) => setFormField('note', e.target.value)} style={{ ...fieldControlStyle, resize: 'vertical' }} /></label>
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <strong>{form.tableId ? 'Seçilen masa için saatler' : 'Uygun saatler'}</strong>
                <small style={{ color: 'var(--muted)' }}>{form.tableId ? 'Yeşil: uygun · Gri: dolu · Lacivert: seçili' : 'Masa seçerseniz doluluk o masaya göre gösterilir.'}</small>
              </div>
              {availabilityError ? <div role="alert" style={alertStyle}>Uygunluk bilgisi alınamadı: {availabilityError}</div> : availableSlots.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
                  {availableSlots.map((item) => {
                    const selected = form.time === item.time
                    const available = isSlotAvailableForForm(item)
                    return <button key={item.time} type="button" disabled={!available} onClick={() => setFormField('time', item.time)} aria-pressed={selected} style={slotButtonStyle(available, selected)}>
                      <strong>{item.time}</strong><small>{available ? 'Uygun' : 'Dolu'}</small>
                    </button>
                  })}
                </div>
              ) : <div style={{ color: 'var(--muted)' }}>Bu tarih ve kişi sayısı için uygunluk bilgisi bulunamadı.</div>}
            </div>
            {formError ? <div role="alert" style={{ color: '#b91c1c' }}>{formError}</div> : null}
            {!form.tableId && slotTables.length ? <small style={{ color: 'var(--muted)' }}>Seçilen saatte uygun masalar: {slotTables.map((table) => table.name).join(', ')}</small> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" type="button" onClick={() => setModalOpen(false)}>İptal</button>
              <button className="btn" type="submit" disabled={saving || !form.time || !selectedTimeAvailable}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {settingsOpen && isAdmin ? (
        <div className="reservation-settings-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
          <form className="card reservation-settings-modal" onSubmit={saveSettings} role="dialog" aria-modal="true" aria-labelledby="reservation-settings-title">
            <header className="reservation-settings-header">
              <div>
                <span className="reservation-settings-eyebrow">ŞUBE YÖNETİMİ</span>
                <h2 id="reservation-settings-title">Rezervasyon Ayarları</h2>
                <p>{branches.find((item) => String(item._id) === branchId)?.name || ''}</p>
              </div>
              <button className="reservation-settings-close" type="button" onClick={() => setSettingsOpen(false)} aria-label="Ayarları kapat">×</button>
            </header>
            <div className="reservation-settings-scroll">
              <section className="reservation-settings-section">
                <div className="reservation-settings-section-heading">
                  <h3>Rezervasyon hizmeti</h3>
                  <p>Online rezervasyonların kabul ve onay davranışını belirleyin.</p>
                </div>
                <div className="reservation-settings-toggles">
                  <label className="reservation-settings-toggle">
                    <input type="checkbox" checked={settings.onlineEnabled === true} onChange={(e) => setSettings({ ...settings, onlineEnabled: e.target.checked })} disabled={!isAdmin || !settingsLoaded} />
                    <span><strong>Online rezervasyonu etkinleştir</strong><small>Bu şubenin rezervasyon hizmetini açar. Web sitesindeki buton görünürlüğü ayrı bir ayardır.</small></span>
                  </label>
                  <label className="reservation-settings-toggle">
                    <input type="checkbox" checked={settings.autoConfirm === true} onChange={(e) => setSettings({ ...settings, autoConfirm: e.target.checked })} />
                    <span><strong>Online rezervasyonları otomatik onayla</strong><small>Kapalı olduğunda yeni online talepler personel onayına düşer.</small></span>
                  </label>
                </div>
                {!settingsLoaded ? <small className="reservation-settings-loading" role="status">Şube ayarları yüklenene kadar değişiklik yapılamaz.</small> : null}
              </section>

              <section className="reservation-settings-section">
                <div className="reservation-settings-section-heading">
                  <h3>Süre ve uygunluk</h3>
                  <p>Rezervasyon süresi ve masa hazırlık aralığını belirleyin.</p>
                </div>
                <div className="reservation-settings-groups">
                  <div className="reservation-settings-group">
                    <NumericSetting label="Rezervasyon süresi (dakika)" value={settings.durationMinutes} onChange={(value) => setSettings({ ...settings, durationMinutes: value })} min={15} max={480} step={15} />
                    <NumericSetting label="Hazırlık/temizlik aralığı (dakika)" value={settings.bufferMinutes} onChange={(value) => setSettings({ ...settings, bufferMinutes: value })} min={0} max={240} step={15} />
                  </div>
                  <div className="reservation-settings-group">
                    <NumericSetting label="En erken rezervasyon (dakika)" value={settings.minAdvanceMinutes} onChange={(value) => setSettings({ ...settings, minAdvanceMinutes: value })} min={0} max={10080} />
                    <NumericSetting label="En ileri rezervasyon (gün)" value={settings.maxAdvanceDays} onChange={(value) => setSettings({ ...settings, maxAdvanceDays: value })} min={1} max={365} />
                  </div>
                  <div className="reservation-settings-group reservation-settings-group--single">
                    <NumericSetting label="Onay bekleme süresi (dakika)" value={settings.pendingHoldMinutes} onChange={(value) => setSettings({ ...settings, pendingHoldMinutes: value })} min={5} max={1440} />
                    <small>Bekleyen taleplerin masa uygunluğunu ne kadar süreyle tutacağını belirler.</small>
                  </div>
                </div>
              </section>

              <section className="reservation-settings-section">
                <div className="reservation-settings-section-heading">
                  <h3>Çalışma gün ve saatleri</h3>
                  <p>Rezervasyon alınabilecek günleri ve saat aralığını düzenleyin.</p>
                </div>
                <div className="reservation-hours-grid">
                  <div className="reservation-hours-heading" aria-hidden="true"><span>Gün</span><span>Durum</span><span>Açılış</span><span>Kapanış</span></div>
                  {(settings.workingHours || initialSettings().workingHours).map((row) => (
                    <div className="reservation-hours-row" key={row.day}>
                      <strong>{WEEKDAYS[row.day]}</strong>
                      <label className="reservation-hours-toggle"><input type="checkbox" checked={row.open} onChange={(e) => setWorkingHour(row.day, 'open', e.target.checked)} /><span>{row.open ? 'Açık' : 'Kapalı'}</span></label>
                      <label className="reservation-time-field"><span>Açılış</span><input aria-label={`${WEEKDAYS[row.day]} açılış saati`} type="time" disabled={!row.open} value={row.start} onChange={(e) => setWorkingHour(row.day, 'start', e.target.value)} /></label>
                      <label className="reservation-time-field"><span>Kapanış</span><input aria-label={`${WEEKDAYS[row.day]} kapanış saati`} type="time" disabled={!row.open} value={row.end} onChange={(e) => setWorkingHour(row.day, 'end', e.target.value)} /></label>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <footer className="reservation-settings-footer">
              {!isAdmin ? <small>Yalnızca firma yöneticisi ayarları değiştirebilir.</small> : null}
              <button className="btn reservation-settings-cancel" type="button" onClick={() => setSettingsOpen(false)}>İptal</button>
              {isAdmin ? <button className="btn reservation-settings-save" type="submit" disabled={settingsSaving || !settingsLoaded}>{settingsSaving ? 'Kaydediliyor…' : 'Ayarları Kaydet'}</button> : null}
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  )

  function setWorkingHour(day, key, value) {
    setSettings((current) => ({
      ...current,
      workingHours: current.workingHours.map((row) => row.day === day ? { ...row, [key]: value } : row)
    }))
  }
}

function NumericSetting({ label, value, onChange, min, max, step = 1 }) {
  return <label className="reservation-numeric-setting"><span>{label}</span><input type="number" min={min} max={max} step={step} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} /></label>
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="card" style={{ display: 'grid', gap: 8, padding: 16, borderTop: `3px solid ${color}` }}>
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</span>
      <strong style={{ fontSize: 26, lineHeight: 1 }}>{value}</strong>
    </div>
  )
}

function ReservationCard({ reservation, busy, onEdit, onStatus, onArrive, canApprove = false, compact = false }) {
  const canArrive = ['pending', 'confirmed', 'arrived'].includes(reservation.status) && reservation.tableId
  return (
    <article className={`card reservation-card${compact ? ' reservation-card--compact' : ''}`} style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0,1fr) auto', gap: 12, borderLeft: `4px solid ${STATUS_COLORS[reservation.status] || '#94a3b8'}`, padding: 14 }}>
      <div className="reservation-card__details" style={{ display: 'grid', gap: 5, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong>{reservation.time} · {reservation.customerName}</strong>
          <span style={{ borderRadius: 999, padding: '3px 8px', color: '#fff', background: STATUS_COLORS[reservation.status], fontSize: 12, fontWeight: 800 }}>{STATUS_LABELS[reservation.status]}</span>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{reservation.source === 'website' ? 'Web sitesi' : 'Personel'}</span>
        </div>
        <div>{reservation.guestCount} kişi · {reservation.phone} · {reservation.tableName || 'Masa atanmadı'}</div>
        {reservation.note ? <div style={{ color: 'var(--muted)' }}>{reservation.note}</div> : null}
      </div>
      <div className="reservation-card__actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {canApprove && canArrive ? <button className="btn" type="button" disabled={busy} onClick={() => onArrive(reservation)}>Geldi / Adisyon Aç</button> : null}
        {canApprove && ['pending', 'confirmed'].includes(reservation.status) ? <button className="btn" type="button" disabled={busy} onClick={() => onEdit(reservation)}>Düzenle</button> : null}
        {canApprove && reservation.status === 'pending' ? <button className="btn" type="button" disabled={busy} onClick={() => onStatus(reservation, 'confirmed')}>Onayla</button> : null}
        {canApprove && ['pending', 'confirmed'].includes(reservation.status) ? <button className="btn" type="button" disabled={busy} onClick={() => onStatus(reservation, 'cancelled')}>İptal</button> : null}
        {canApprove && reservation.status === 'arrived' ? <button className="btn" type="button" disabled={busy} onClick={() => onStatus(reservation, 'completed')}>Tamamlandı</button> : null}
        {canApprove && ['pending', 'confirmed'].includes(reservation.status) ? <button className="btn" type="button" disabled={busy} onClick={() => onStatus(reservation, 'no_show')}>Gelmedi</button> : null}
      </div>
    </article>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,0.62)' }
const formGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }
const checkLabel = { display: 'flex', alignItems: 'center', gap: 8 }
const fieldLabelStyle = { display: 'grid', gap: 7, minWidth: 0, fontWeight: 650 }
const fieldControlStyle = { width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: 42, padding: '9px 11px', borderRadius: 8 }
const headerButtonStyle = { background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.28)', color: '#fff' }
const viewButtonStyle = (active) => ({
  borderColor: active ? '#2563eb' : 'var(--border)',
  background: active ? '#2563eb' : 'var(--surface)',
  color: active ? '#fff' : 'var(--text)',
  minHeight: 40
})
const slotButtonStyle = (available, selected) => ({
  minHeight: 58,
  display: 'grid',
  gap: 3,
  justifyItems: 'center',
  alignContent: 'center',
  borderRadius: 10,
  border: `1px solid ${selected ? '#1d4ed8' : available ? '#86efac' : 'var(--border)'}`,
  background: selected ? '#1e3a8a' : available ? 'rgba(34,197,94,0.1)' : 'var(--surface)',
  color: selected ? '#fff' : available ? 'var(--success-text)' : 'var(--muted)',
  cursor: available ? 'pointer' : 'not-allowed',
  opacity: available ? 1 : 0.72
})
const emptyStateStyle = { padding: 28, textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)' }
const alertStyle = { padding: 14, color: '#b91c1c', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)' }
const noticeStyle = { padding: 12, color: '#92400e', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 8 }
