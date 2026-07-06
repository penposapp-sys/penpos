import { useEffect, useRef } from 'react'
import { PushNotifications } from '@capacitor/push-notifications'
import { Device } from '@capacitor/device'
import { App as CapacitorApp } from '@capacitor/app'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { isCapacitorNativePlatform } from '../utils/device.js'

const normalizeToken = (token) => String(token || '').trim()

export default function NativePushBridge() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const lastTokenRef = useRef('')

  useEffect(() => {
    if (!user || !isCapacitorNativePlatform()) return undefined

    let isCancelled = false
    const listeners = []

    const registerToken = async (token) => {
      const normalizedToken = normalizeToken(token)
      if (!normalizedToken || lastTokenRef.current === normalizedToken) return

      const deviceInfo = await Device.getInfo().catch(() => null)
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
    }

    const init = async () => {
      const permission = await PushNotifications.requestPermissions()
      if (permission.receive !== 'granted' || isCancelled) return

      await PushNotifications.createChannel({
        id: 'penpos-alerts',
        name: 'PenPOS Alerts',
        description: 'Garson ve kurye bildirimleri',
        importance: 5,
        visibility: 1,
        sound: 'default'
      }).catch(() => {})

      listeners.push(await PushNotifications.addListener('registration', ({ value }) => {
        registerToken(value).catch(() => {})
      }))

      listeners.push(await PushNotifications.addListener('registrationError', (err) => {
        console.error('Push registration error', err)
      }))

      listeners.push(await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const title = String(notification?.title || '').trim()
        const body = String(notification?.body || '').trim()
        if (title || body) toast.success([title, body].filter(Boolean).join(' - '))
      }))

      listeners.push(await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
        const data = event?.notification?.data || {}
        const targetPath = String(data?.targetPath || '').trim()
        if (targetPath) navigate(targetPath)
      }))

      listeners.push(await CapacitorApp.addListener('resume', () => {
        PushNotifications.register().catch(() => {})
      }))

      await PushNotifications.register()
    }

    init().catch(() => {})

    return () => {
      isCancelled = true
      listeners.forEach((listener) => listener?.remove?.())
    }
  }, [navigate, user])

  return null
}
