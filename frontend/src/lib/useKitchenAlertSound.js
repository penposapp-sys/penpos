import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'kitchenSoundEnabled'
const SOUND_SRC = '/sounds/kitchen-alert.mp3'

export function useKitchenAlertSound({ debounceMs = 5000 } = {}) {
  const audioRef = useRef(null)
  const unlockedRef = useRef(false)
  const lastPlayedRef = useRef(0)

  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw == null) return true
      return raw === '1' || raw === 'true'
    } catch {
      return true
    }
  })
  const soundEnabledRef = useRef(soundEnabled)
  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  const ensureAudioElement = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!audioRef.current) {
      const audio = new Audio(SOUND_SRC)
      audio.preload = 'auto'
      audio.volume = 1
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

  const ensureAudioUnlocked = useCallback(async () => {
    const audio = ensureAudioElement()
    if (!audio) return false
    try {
      audio.muted = true
      audio.currentTime = 0
      await audio.play()
      audio.pause()
      audio.currentTime = 0
      audio.muted = false
      audio.volume = 1
      unlockedRef.current = true
      return true
    } catch {
      audio.muted = false
      return false
    }
  }, [ensureAudioElement])

  const playAlert = useCallback(async () => {
    if (!soundEnabledRef.current) return
    const now = Date.now()
    if (now - Number(lastPlayedRef.current || 0) < debounceMs) return
    lastPlayedRef.current = now

    const audio = ensureAudioElement()
    if (!audio) return

    if (!unlockedRef.current) {
      const ok = await ensureAudioUnlocked()
      if (!ok) return
    }

    try {
      audio.pause()
      audio.currentTime = 0
      audio.muted = false
      audio.volume = 1
      await audio.play()
    } catch {}
  }, [debounceMs, ensureAudioElement, ensureAudioUnlocked])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, soundEnabled ? '1' : '0')
    } catch {}
  }, [soundEnabled])

  useEffect(() => {
    if (!soundEnabled) return undefined

    const unlock = () => {
      ensureAudioUnlocked()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') unlock()
    }

    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
    window.addEventListener('touchstart', unlock, { passive: true })
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchstart', unlock)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [ensureAudioUnlocked, soundEnabled])

  // Ses acıldığında hemen unlock denemesi yap; böylece sonraki playAlert
  // çağrıları unlock state'i bypass etmeden ses çalabilir.
  useEffect(() => {
    if (!soundEnabled) return undefined
    let cancelled = false
    const run = async () => {
      const ok = await ensureAudioUnlocked()
      if (!cancelled && ok) unlockedRef.current = true
    }
    const timer = window.setTimeout(run, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [ensureAudioUnlocked, soundEnabled])

  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (!audio) return
      audio.pause()
      audioRef.current = null
    }
  }, [])

  const soundIcon = useMemo(() => (soundEnabled ? '🔊' : '🔇'), [soundEnabled])

  return {
    soundEnabled,
    setSoundEnabled,
    soundIcon,
    ensureAudioUnlocked,
    playAlert
  }
}
