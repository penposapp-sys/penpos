import React from 'react'
import UserAppearancePreferences from '../components/settings/UserAppearancePreferences.jsx'
import { SettingsUiStyles } from '../components/settings/SettingsUi.jsx'

export default function UserAppearancePage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 920 }}>
      <SettingsUiStyles />
      <h2 style={{ margin: 0 }}>Kişisel Görünüm Ayarları</h2>
      <UserAppearancePreferences />
    </div>
  )
}
