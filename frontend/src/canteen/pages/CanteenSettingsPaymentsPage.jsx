import React from 'react'
import { SettingsPaymentsContent } from '../../pages/SettingsPage.jsx'
import CanteenSettingsSection from '../components/CanteenSettingsSection.jsx'

export default function CanteenSettingsPaymentsPage() {
  return (
    <CanteenSettingsSection
      badge="Ödeme Yönetimi"
      title="Ödeme yöntemlerini aynı modern düzende yönetin"
      description="Nakit, kart, banka ve cari seçeneklerini restoran panelindeki düzenli kart yapısıyla kontrol edin; görünürlük, sıralama ve yeni yöntem ekleme akışları aynı hisle çalışsın."
      stats={[
        { label: 'Akış', value: 'Canlı' },
        { label: 'Yönetim', value: 'Tek panel' },
        { label: 'Tema', value: 'Uyumlu' },
      ]}
    >
      <SettingsPaymentsContent />
    </CanteenSettingsSection>
  )
}
