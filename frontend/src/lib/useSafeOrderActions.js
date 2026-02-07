import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './apiClient.js'
import { toast } from './toast.js'

export const useSafeOrderActions = ({
  getOrderId,
  orderId,
  setOrder,
  pickOrder,
  reloadUrlForOrderId
}) => {
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const orderAbortRef = useRef(null)
  const actionAbortRef = useRef(null)
  const getOrderIdRef = useRef(getOrderId)
  const pickOrderRef = useRef(pickOrder)

  useEffect(() => {
    getOrderIdRef.current = getOrderId
  }, [getOrderId])

  useEffect(() => {
    pickOrderRef.current = pickOrder
  }, [pickOrder])

  const isAbort = (err) => err?.name === 'AbortError'

  const parseApiError = (err) => {
    if (!err) return 'Bir hata oluştu. Tekrar deneyin.'
    if (isAbort(err)) return null

    const status = err?.status
    const code = err?.data?.code || err?.data?.error || err?.code

    if (status === 409) {
      const map = {
        table_in_use: 'Bu masada zaten aktif sipariş var. Liste yenilendi.',
        order_not_editable: 'Bu sipariş artık düzenlenemez. Liste yenilendi.',
        order_closed: 'Sipariş kapalı. Liste yenilendi.',
        invalid_state: 'İşlem yapılamadı (durum uyuşmuyor). Liste yenilendi.',
        item_already_cancelled: 'Ürün zaten iptal edilmiş. Liste yenilendi.',
        item_already_completed: 'Ürün zaten hazır. Liste yenilendi.',
        remaining_zero: 'Kalan tutar 0, veresiye yapılamaz.',
        amount_exceeds_remaining: 'Girilen tutar kalan tutardan büyük.',
        invalid_account: 'Cari seçimi geçersiz.',
        payment_locked: 'Bu tahsilat silinemez.',
        remaining_unsettled: 'Kalan tutar var, masa kapatılamaz.',
        kitchen_not_completed: 'Mutfak tamamlanmadı, masa kapatılamaz.',
        no_active_order: 'Masada aktif sipariş yok. Liste yenilendi.',
        already_closed: 'Masa zaten kapalı. Liste yenilendi.'
      }
      return map[code] || 'İşlem yapılamadı. Liste yenilendi.'
    }

    if (status === 403) {
      if (code === 'missing_branch') {
        return 'Şube seçimi gerekli. Çıkış yapıp tekrar giriş yapın veya admin’den şube yetkisi isteyin.'
      }
      if (code === 'missing_tenant') {
        return 'Firma bilgisi bulunamadı. Çıkış yapıp tekrar giriş yapın.'
      }
      return err?.data?.message || 'Yetkiniz yok.'
    }
    if (status >= 500) return 'Bir hata oluştu. Tekrar deneyin.'
    return err?.data?.message || err?.message || 'Bir hata oluştu. Tekrar deneyin.'
  }

  const toThrownError = (res) => {
    const msg = res?.data?.message || res?.message || 'Bir hata oluştu. Tekrar deneyin.'
    const err = new Error(msg)
    err.status = res?.status
    err.code = res?.data?.code || res?.code || res?.data?.error || res?.error
    err.data = res?.data || res
    return err
  }

  const reloadOrder = useCallback(async () => {
    const id = orderId || (typeof getOrderIdRef.current === 'function' ? getOrderIdRef.current() : null)
    if (!id) return null

    orderAbortRef.current?.abort()
    const controller = new AbortController()
    orderAbortRef.current = controller
    const url = typeof reloadUrlForOrderId === 'function' ? reloadUrlForOrderId(id) : `/api/pos/orders/${id}`
    const res = await api(url, { signal: controller.signal, silent: true })
    if (!res?.ok) throw toThrownError(res)
    const payload = res?.data
    const fresh = pickOrderRef.current ? pickOrderRef.current(payload) : (payload?.order || payload?.data?.order || null)
    if (fresh) setOrder(fresh)
    return fresh
  }, [orderId, reloadUrlForOrderId, setOrder])

  const safeAction = useCallback(async (actionFn, { reload = true } = {}) => {
    if (busyRef.current) return null
    busyRef.current = true
    setBusy(true)
    actionAbortRef.current?.abort()
    actionAbortRef.current = new AbortController()

    try {
      const res = await actionFn(actionAbortRef.current.signal)
      if (!res?.ok) throw toThrownError(res)

      const payload = res?.data
      const fresh = pickOrderRef.current ? pickOrderRef.current(payload) : (payload?.order || payload?.data?.order || null)
      if (fresh) setOrder(fresh)
      if (reload) {
        await reloadOrder()
      }
      return payload
    } catch (err) {
      const msg = parseApiError(err)
      if (msg) toast.error(msg)
      if (!isAbort(err) && reload) {
        await reloadOrder().catch(() => {})
      }
      return null
    } finally {
      setBusy(false)
      busyRef.current = false
    }
  }, [reloadOrder, setOrder])

  useEffect(() => {
    return () => {
      orderAbortRef.current?.abort()
      actionAbortRef.current?.abort()
      busyRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!orderId) return
    return () => {
      orderAbortRef.current?.abort()
      actionAbortRef.current?.abort()
    }
  }, [orderId])

  return {
    busy,
    safeAction,
    reloadOrder,
    parseApiError,
    isAbort
  }
}
