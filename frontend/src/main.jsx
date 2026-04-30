import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { AppDateProvider } from './context/AppDateContext.jsx'

createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <AppDateProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </AppDateProvider>
  </ThemeProvider>
)
