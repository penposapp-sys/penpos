import React, { createContext, useContext, useState } from 'react'

const defaultTheme = {
  primaryColor: '#3b82f6',
  secondaryColor: '#1e293b',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  borderRadius: '8px',
}

const ThemeContext = createContext({
  theme: defaultTheme,
  setTheme: () => {},
})

export function ThemeProvider({ children, initialTheme = null }) {
  const [theme, setTheme] = useState(() => ({ ...defaultTheme, ...(initialTheme || {}) }))

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div
        style={{
          '--primary-color': theme.primaryColor,
          '--secondary-color': theme.secondaryColor,
          '--font-family': theme.fontFamily,
          '--border-radius': theme.borderRadius,
          fontFamily: theme.fontFamily,
          color: 'var(--secondary-color)',
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export { defaultTheme }
