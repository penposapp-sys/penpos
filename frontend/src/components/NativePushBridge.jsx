import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { isCapacitorNativePlatform } from '../utils/device.js'
import { getNativeRuntimeCapabilities } from '../lib/nativeRuntime.js'
import { useKitchenAlertSound } from '../lib/useKitchenAlertSound.js'

const normalizeToken = (token) => String(token || '').trim()

export default function NativePushBridge() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const lastTokenRef = useRef('')
  const knownWaiterCallRevisionsRef = useRef(new Map())
  const waiterCallsInitializedRef = useRef(false)
  const { playAlert } = useKitchenAlertSound({ debounceMs: 500, storageKey: 'waiterCallSoundEnabled' })

  const notifyWaiterCall = (id, title, body, revisionAt = '') => {
    const callId = String(id || '').trim()
    const revision = String(revisionAt || '').trim()
    if (callId && knownWaiterCallRevisionsRef.current.get(callId) === revision) return
    if (callId) knownWaiterCallRevisionsRef.current.set(callId, revision)
    // The waiter-call screen owns its own sound so its polling and push events
    // cannot play the same alert twice.
    if (!location.pathname.endsWith('/app/waiter-calls')) playAlert()
    toast.info([title || 'Garson çağrısı', body].filter(Boolean).join(' - '))
  }

  // Garson çağrısı uç noktası tenant'a bağlıdır. Platform/mağaza/anaokulu
  // kullanıcıları bu isteği yapmamalı; aksi halde 401 oturumu kapatır.
  const userSystemType = String(user?.systemType || '').trim().toLowerCase()
  const canPollWaiterCalls = Boolean(
    user?.tenantId &&
    (user.role === 'tenant_admin' || user.role === 'staff') &&
    (userSystemType === '' || userSystemType === 'kermes' || userSystemType === 'restaurant')
  )

  // Keep an in-app fallback so incoming calls are still visible when this APK
  // was built without Firebase configuration and native push cannot register.
  useEffect(() => {
    if (!canPollWaiterCalls) return undefined
    let cancelled = false

    const pollWaiterCalls = async () => {
      try {
        const response = await api('/api/tenant/waiter-calls?status=open', {
          silent: true,
          suppressAuthRedirect: true,
          skipBranchHeader: true,
          cacheMode: 'no-store'
        })
        if (cancelled || response?.success === false) return
        const calls = Array.isArray(response?.calls) ? response.calls : []
        const currentIds = new Set(calls.map((call) => String(call?.id || '')).filter(Boolean))

        if (waiterCallsInitializedRef.current) {
          calls.forEach((call) => {
            const id = String(call?.id || '')
            const revision = String(call?.createdAt || '')
            if (id && knownWaiterCallRevisionsRef.current.get(id) !== revision) {
              notifyWaiterCall(
                id,
                call.callType === 'service_request' ? 'Servis talebi' : 'Garson çağrısı',
                call.callType === 'service_request'
                  ? `${call.tableName || 'Masa'} servis istiyor.`
                  : `${call.tableName || 'Masa'} garson çağırıyor.`,
                revision
              )
            }
            if (id) knownWaiterCallRevisionsRef.current.set(id, revision)
          })
        } else {
          waiterCallsInitializedRef.current = true
          calls.forEach((call) => {
            const id = String(call?.id || '')
            if (id) knownWaiterCallRevisionsRef.current.set(id, String(call?.createdAt || ''))
          })
        }

        // Prune resolved calls so a later new call can be announced normally.
        knownWaiterCallRevisionsRef.current = new Map(
          [...knownWaiterCallRevisionsRef.current].filter(([id]) => currentIds.has(id))
        )
      } catch {
        // Push remains the primary delivery path; polling is a quiet fallback.
      }
    }

    pollWaiterCalls()
    const timer = window.setInterval(pollWaiterCalls, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [canPollWaiterCalls, user?.id, user?.tenantId, playAlert, location.pathname])

  useEffect(() => {
    if (!user || !isCapacitorNativePlatform()) return undefined

    let isCancelled = false
    const cleanups = []

    const registerToken = async (token, deviceInfo) => {
      const normalizedToken = normalizeToken(token)
      if (!normalizedToken || lastTokenRef.current === normalizedToken) return

      try {
        await api('/api/auth/push/register', {
          method: 'POST',
          data: {
            token: normalizedToken,
            platform: String(deviceInfo?.platform || 'android').toLowerCase(),
            deviceId: String(deviceInfo?.identifier || deviceInfo?.model || ''),
            appVersion: String(deviceInfo?.appVersion || '')
          },
          silent: true
        })
        lastTokenRef.current = normalizedToken
      } catch (err) {
        console.error('Push token registration failed', err)
      }
    }

    const init = async () => {
      const runtime = await getNativeRuntimeCapabilities()
      if (isCancelled || runtime.pushAvailable !== true) return

      try {
        const [{ PushNotifications }, { Device }, { App: CapacitorApp }] = await Promise.all([
          import('@capacitor/push-notifications'),
          import('@capacitor/device'),
          import('@capacitor/app')
        ])
        if (isCancelled) return

        const deviceInfo = await Device.getInfo().catch((err) => {
          console.error('Device info lookup failed', err)
          return null
        })

        let permission
        try {
          permission = await PushNotifications.requestPermissions()
        } catch (err) {
          console.error('Push permission request failed', err)
          return
        }

        if (permission?.receive !== 'granted' || isCancelled) return

        try {
          await PushNotifications.createChannel({
            id: 'penpos-alerts',
            name: 'PenPOS Alerts',
            description: 'Garson ve kurye bildirimleri',
            importance: 5,
            visibility: 1,
            sound: 'default'
          })
        } catch (err) {
          console.error('Push channel creation failed', err)
        }

        try {
          const registrationListener = await PushNotifications.addListener('registration', ({ value }) => {
            registerToken(value, deviceInfo).catch((err) => {
              console.error('Push registration listener failed', err)
            })
          })
          cleanups.push(() => registrationListener?.remove?.())
        } catch (err) {
          console.error('Push registration listener attach failed', err)
        }

        try {
          const errorListener = await PushNotifications.addListener('registrationError', (err) => {
            console.error('Push registration error', err)
          })
          cleanups.push(() => errorListener?.remove?.())
        } catch (err) {
          console.error('Push error listener attach failed', err)
        }

        try {
          const receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
            const title = String(notification?.title || '').trim()
            const body = String(notification?.body || '').trim()
            const data = notification?.data || {}
            if (String(data.type || '').trim() === 'waiter_call') {
              notifyWaiterCall(data.waiterCallId, title, body, data.callRevisionAt)
              return
            }
            if (title || body) toast.success([title, body].filter(Boolean).join(' - '))
          })
          cleanups.push(() => receivedListener?.remove?.())
        } catch (err) {
          console.error('Push receive listener attach failed', err)
        }

        try {
          const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
            const data = event?.notification?.data || {}
            const targetPath = String(data?.targetPath || '').trim()
            if (targetPath) navigate(targetPath)
          })
          cleanups.push(() => actionListener?.remove?.())
        } catch (err) {
          console.error('Push action listener attach failed', err)
        }

        try {
          const resumeListener = await CapacitorApp.addListener('resume', () => {
            PushNotifications.register().catch((err) => {
              console.error('Push re-register on resume failed', err)
            })
          })
          cleanups.push(() => resumeListener?.remove?.())
        } catch (err) {
          console.error('App resume listener attach failed', err)
        }

        try {
          await PushNotifications.register()
        } catch (err) {
          console.error('Push register failed', err)
        }
      } catch (err) {
        console.error('Push bridge initialization failed', err)
      }
    }

    init().catch((err) => {
      console.error('Native push bootstrap failed', err)
    })

    return () => {
      isCancelled = true
      cleanups.forEach((cleanup) => {
        try {
          cleanup()
        } catch (err) {
          console.error('Push cleanup failed', err)
        }
      })
    }
  }, [navigate, playAlert, user])

  return null
}
