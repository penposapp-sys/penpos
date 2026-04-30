import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'penpos:selected-date'

const todayYmd = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const AppDateContext = createContext({
  selectedDate: todayYmd(),
  setSelectedDate: () => {}
})

export function AppDateProvider({ children }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      return saved || todayYmd()
    } catch {
      return todayYmd()
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, selectedDate || todayYmd())
    } catch {}
  }, [selectedDate])

  const value = useMemo(() => ({
    selectedDate: selectedDate || todayYmd(),
    setSelectedDate
  }), [selectedDate])

  return <AppDateContext.Provider value={value}>{children}</AppDateContext.Provider>
}

export function useAppDate() {
  return useContext(AppDateContext)
}
