import React from 'react'
import { SettingsPaymentsContent } from '../../pages/SettingsPage.jsx'
import CanteenSettingsSection from '../components/CanteenSettingsSection.jsx'

export default function CanteenSettingsPaymentsPage() {
  return (
    <CanteenSettingsSection>
      <SettingsPaymentsContent showHeading={false} />
    </CanteenSettingsSection>
  )
}
