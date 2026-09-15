import React, { useMemo, useState } from 'react'
import { useAnaokuluData } from '../context/AnaokuluDataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { financialSummaryForStudent, getMonthlyInvoicableInstallments, money, round2 } from '../utils/calculations.js'
import TopluAlacakRaporu from './TopluAlacakRaporu.jsx'

const TABS = [
  ['overview', 'Genel Ozet'],
  ['students', 'Ogrenci Durumu'],
  ['receivables', 'Alacak Durumu'],
  ['invoices', 'Fatura Durumu'],
  ['comparison', 'Okul Karsilastirma']
]
const buttonStyle = { border: 'none', borderRadius: 9, padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }
const cell = { padding: '10px 12px', borderBottom: '1px solid #eef2f7', fontSize: 13, textAlign: 'left' }
const head = { ...cell, background: '#f8fafc', color: '#475569', fontWeight: 800, fontSize: 12 }
const InputStyle = { padding: '9px 12px', borderRadius: 9, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13 }
const KpiGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }
const Kpi = { padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }
const Panel = ({ children }) => <div style={{ padding: 18, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', overflow: 'auto' }}>{children}</div>
const monthOf = (date) => String(date || '').slice(0, 7)
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))

export default function RaporlarPage() {
  const { user, isRegionAdmin, isAdminPanelMode, accessibleTenants, regionCurrentTenantId, tenantCtx } = useAuth()
  const { state } = useAnaokuluData()
  const isManager = isRegionAdmin || user?.role === 'superadmin' || user?.role === 'platform_admin'
  const [tab, setTab] = useState('receivables')
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const rawStudents = state?.students || []
  const rawCollections = state?.collections || []
  const rawInvoices = state?.invoices || []
  const activeSchoolId = selectedSchoolId || (!isAdminPanelMode ? String(regionCurrentTenantId || '') : '')

  const schools = useMemo(() => {
    const tenants = Array.isArray(accessibleTenants) && accessibleTenants.length > 0
      ? accessibleTenants
      : (tenantCtx?.tenant ? [tenantCtx.tenant] : [{ id: activeSchoolId || 'current', name: 'Secili Okul' }])
    return tenants.filter((tenant) => !activeSchoolId || String(tenant.id || tenant._id) === activeSchoolId)
  }, [accessibleTenants, tenantCtx, activeSchoolId])

  const rows = useMemo(() => schools.map((tenant) => {
    const schoolId = String(tenant.id || tenant._id)
    const students = rawStudents.filter((item) => !item._schoolId || String(item._schoolId) === schoolId)
    const collections = rawCollections.filter((item) => !item._schoolId || String(item._schoolId) === schoolId)
    const invoices = rawInvoices.filter((item) => !item._schoolId || String(item._schoolId) === schoolId)
    const scopedState = { ...state, students, collections, invoices }
    const studentSummaries = students.map((student) => ({ student, financial: financialSummaryForStudent(scopedState, student.id) }))
    const planned = studentSummaries.reduce((sum, item) => sum + item.financial.net, 0)
    const paid = studentSummaries.reduce((sum, item) => sum + item.financial.paid, 0)
    const overdue = studentSummaries.reduce((sum, item) => sum + item.financial.overdue, 0)
    const overdueStudents = studentSummaries.filter((item) => item.financial.overdue > 0).map((item) => item.student)
    const monthInvoices = invoices.filter((invoice) => monthOf(invoice.date || invoice.period) === month)
    const billableInstallments = getMonthlyInvoicableInstallments(scopedState, month)
    const invoicedStudentIds = new Set(monthInvoices.map((invoice) => String(invoice.studentId)).filter(Boolean))
    const invoicedStudentCount = students.filter((student) => invoicedStudentIds.has(String(student.id))).length
    const activeStudents = students.filter((student) => student.active !== false).length
    return {
      id: schoolId,
      name: tenant.name || 'Isimsiz Okul',
      students,
      collections,
      invoices,
      studentCount: students.length,
      activeStudents,
      passiveStudents: students.length - activeStudents,
      planned: round2(planned),
      paid: round2(paid),
      remaining: round2(planned - paid),
      overdue: round2(overdue),
      overdueStudents,
      studentSummaries,
      monthInvoices,
      invoiceAmount: round2(monthInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)),
      invoiceRequiredAmount: round2(billableInstallments.reduce((sum, installment) => sum + Number(installment.amount || 0), 0)),
      invoiceRequiredVat: round2(billableInstallments.reduce((sum, installment) => sum + Number(installment.vatAmount || 0), 0)),
      invoicedStudentCount,
      uninvoicedStudentCount: Math.max(0, students.length - invoicedStudentCount),
      invoiceRate: students.length ? (invoicedStudentCount / students.length) * 100 : null
    }
  }), [schools, rawStudents, rawCollections, rawInvoices, state, month])

  const total = useMemo(() => rows.reduce((sum, row) => ({
    schools: sum.schools + 1,
    students: sum.students + row.studentCount,
    planned: sum.planned + row.planned,
    paid: sum.paid + row.paid,
    remaining: sum.remaining + row.remaining,
    overdue: sum.overdue + row.overdue,
    invoices: sum.invoices + row.monthInvoices.length,
    invoiceAmount: sum.invoiceAmount + row.invoiceAmount,
    invoiceRequiredAmount: sum.invoiceRequiredAmount + row.invoiceRequiredAmount,
    invoiceRequiredVat: sum.invoiceRequiredVat + row.invoiceRequiredVat,
    invoicedStudents: sum.invoicedStudents + row.invoicedStudentCount,
    uninvoicedStudents: sum.uninvoicedStudents + row.uninvoicedStudentCount
  }), { schools: 0, students: 0, planned: 0, paid: 0, remaining: 0, overdue: 0, invoices: 0, invoiceAmount: 0, invoiceRequiredAmount: 0, invoiceRequiredVat: 0, invoicedStudents: 0, uninvoicedStudents: 0 }), [rows])

  const detailRows = rows.flatMap((row) => row.studentSummaries.map(({ student, financial }) => {
    const studentCollections = row.collections.filter((collection) => String(collection.studentId) === String(student.id))
    const lastCollectionDate = studentCollections.map((collection) => collection.date).filter(Boolean).sort().at(-1) || '-'
    return [row.name, student.name, student.parent || '-', student.class || '-', financial.net, financial.discount, financial.downPayment, financial.paid, financial.remaining, financial.overdue, lastCollectionDate, financial.remaining <= 0 ? 'Tamamlandı' : 'Bekliyor']
  }))
  const exportHeaders = tab === 'receivables'
    ? ['Okul', 'Ogrenci', 'Veli', 'Sinif', 'Net Plan', 'Indirim', 'Pesinat', 'Toplam Tahsilat', 'Kalan Alacak', 'Vadesi Gecmis', 'Son Tahsilat', 'Odeme Durumu']
    : tab === 'students'
    ? ['Okul', 'Ogrenci', 'Aktif', 'Pasif']
      : tab === 'invoices'
        ? ['Okul', 'Ogrenci', 'Faturasi Kesilen', 'Kesilmeyen', 'Kesilen Fatura Tutari', 'Kesilmesi Gereken', 'Toplam KDV Tutari', 'Oran']
        : tab === 'comparison' || tab === 'overview'
          ? ['Okul', 'Ogrenci', 'Net Planlanan', 'Toplam Tahsilat', 'Kalan Alacak', 'Vadesi Gecmis', 'Fatura Kesilen', 'Fatura Kesilmeyen']
          : ['Okul', 'Ogrenci', 'Aktif', 'Pasif']
  const exportRows = tab === 'receivables'
    ? detailRows
    : rows.map((row) => tab === 'students'
    ? [row.name, row.studentCount, row.activeStudents, row.passiveStudents]
      : tab === 'invoices'
        ? [row.name, row.studentCount, row.invoicedStudentCount, row.uninvoicedStudentCount, row.invoiceAmount, row.invoiceRequiredAmount, row.invoiceRequiredVat, row.invoiceRate == null ? '-' : `${row.invoiceRate.toFixed(2)}%`]
        : tab === 'comparison' || tab === 'overview'
          ? [row.name, row.studentCount, row.planned, row.paid, row.remaining, row.overdue, row.invoicedStudentCount, row.uninvoicedStudentCount]
          : [row.name, row.studentCount, row.activeStudents, row.passiveStudents])

  const downloadExcel = () => {
    const html = `<table><thead><tr>${exportHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${exportRows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    const url = URL.createObjectURL(new Blob([`\ufeff${html}`], { type: 'application/vnd.ms-excel;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `anaokulu-${tab}-${month}.xls`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const moneyValue = (value) => money(round2(value || 0))
  const reportTitle = TABS.find(([key]) => key === tab)?.[1] || 'Genel Ozet'
  const formatTableValue = (value, cellIndex) => {
    const isMoneyColumn = tab === 'invoices' ? cellIndex >= 4 && cellIndex <= 6 : cellIndex > 1
    return typeof value === 'number' && isMoneyColumn ? moneyValue(value) : value
  }
  const comparisonTable = <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{exportHeaders.map((header) => <th key={header} style={head}>{header}</th>)}</tr></thead><tbody>{exportRows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((value, cellIndex) => <td key={`${index}-${cellIndex}`} style={cell}>{formatTableValue(value, cellIndex)}</td>)}</tr>)}</tbody>{tab === 'invoices' && <tfoot><tr>{['Toplam', '-', total.invoicedStudents, total.uninvoicedStudents, total.invoiceAmount, total.invoiceRequiredAmount, total.invoiceRequiredVat, total.students ? `${((total.invoicedStudents / total.students) * 100).toFixed(2)}%` : '-'].map((value, cellIndex) => <td key={`invoice-total-${cellIndex}`} style={{ ...cell, fontWeight: 800, background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>{formatTableValue(value, cellIndex)}</td>)}</tr></tfoot>}</table></div>

  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: 0, color: '#0f172a' }}>📊 {reportTitle}</h2><div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>Anaokulu Super Admin raporu · {month}</div></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {isManager && <select value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)} style={InputStyle}><option value="">Tum Okullar</option>{(accessibleTenants || []).map((tenant) => <option key={tenant.id || tenant._id} value={tenant.id || tenant._id}>{tenant.name}</option>)}</select>}
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} style={InputStyle} />
        <button type="button" onClick={downloadExcel} style={{ ...buttonStyle, background: '#0f766e', color: '#fff' }}>Excel'e Aktar</button>
        <button type="button" onClick={() => window.print()} style={{ ...buttonStyle, background: '#1d4ed8', color: '#fff' }}>PDF Indir</button>
      </div>
    </div>
    {isManager && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '2px solid #e2e8f0' }}>{TABS.map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} style={{ ...buttonStyle, background: tab === key ? '#e0e7ff' : 'transparent', color: tab === key ? '#3730a3' : '#64748b', borderRadius: '8px 8px 0 0' }}>{label}</button>)}</div>}

    {tab === 'overview' && <><div style={KpiGrid}>{[
      ['Toplam Okul', total.schools], ['Toplam Ogrenci', total.students], ['Toplam Alacak', moneyValue(total.remaining)], ['Vadesi Gecmis Alacak', moneyValue(total.overdue)], ['Tahsil Edilen', moneyValue(total.paid)], ['Toplam Fatura', total.invoices], ['Faturasi Kesilen Ogrenci', total.invoicedStudents], ['Faturasi Kesilmeyen Ogrenci', total.uninvoicedStudents]
    ].map(([label, value]) => <div key={label} style={Kpi}><div style={{ color: '#64748b', fontSize: 12 }}>{label}</div><strong style={{ display: 'block', marginTop: 6, fontSize: 22, color: '#0f172a' }}>{value}</strong></div>)}</div><Panel>{comparisonTable}</Panel></>}
    {tab === 'students' && <Panel><h3>Ogrenci Durumu</h3>{comparisonTable}</Panel>}
    {tab === 'receivables' && <TopluAlacakRaporu selectedSchoolId={activeSchoolId} />}
    {tab === 'invoices' && <><div style={KpiGrid}>{[['Toplam Ogrenci', total.students], ['Faturasi Kesilen', total.invoicedStudents], ['Faturasi Kesilmeyen', total.uninvoicedStudents], ['Toplam Fatura', total.invoices], ['Kesilen Fatura Tutari', moneyValue(total.invoiceAmount)], ['Kesilmesi Gereken Toplam', moneyValue(total.invoiceRequiredAmount)], ['Kesilmesi Gereken Toplam KDV', moneyValue(total.invoiceRequiredVat)], ['Fatura Orani', total.students ? `${((total.invoicedStudents / total.students) * 100).toFixed(2)}%` : '-']].map(([label, value]) => <div key={label} style={Kpi}><div style={{ color: '#64748b', fontSize: 12 }}>{label}</div><strong style={{ display: 'block', marginTop: 6, fontSize: 22 }}>{value}</strong></div>)}</div><Panel><h3>{month} Fatura Durumu</h3>{comparisonTable}</Panel></>}
    {tab === 'comparison' && <Panel><h3>Okul Karsilastirma</h3>{comparisonTable}</Panel>}
  </div>
}
