import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { isCapacitorNativePlatform } from '../utils/device.js'
import { getNativeRuntimeCapabilities } from '../lib/nativeRuntime.js'

const normalizeToken = (token) => String(token || '').trim()

export default function NativePushBridge() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const lastTokenRef = useRef('')

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
  }, [navigate, user])

  return null
}
