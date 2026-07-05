import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ScrollReset from './components/ScrollReset.jsx'
import './styles.css'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { AppDateProvider } from './context/AppDateContext.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter future={{ v7_relativeSplatPath: true }}>
    <ThemeProvider>
      <AppDateProvider>
        <ScrollReset />
        <App />
      </AppDateProvider>
    </ThemeProvider>
  </BrowserRouter>
)
