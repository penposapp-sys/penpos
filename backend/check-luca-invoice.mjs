import mongoose from 'mongoose'
import { AnaokuluSchool } from './src/models/AnaokuluSchool.js'
import './src/config/db.js'

const run = async () => {
  const school = await AnaokuluSchool.findOne({ 'invoices.no': 'PDK2026000000160' }).lean()
  const invoices = school && Array.isArray(school.invoices) ? school.invoices : []
  const matches = invoices.filter((inv) => inv && inv.no === 'PDK2026000000160')

  console.log(JSON.stringify({
    foundSchool: !!school,
    tenant: school ? String(school.tenant) : null,
    totalInvoices: invoices.length,
    matchCount: matches.length,
    firstMatch: matches[0] || null
  }, null, 2))

  await mongoose.disconnect()
}

run()
