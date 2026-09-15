import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { calculateSchoolsDebtMatrix, money } from '../utils/calculations.js'

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const control = { padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff', fontSize: 13 }
const cell = { padding: '9px 10px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: 12 }

export default function TopluAlacakRaporu({ selectedSchoolId = '' }) {
  const { accessibleTenants } = useAuth()
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [schoolFilter, setSchoolFilter] = useState(selectedSchoolId)
  const [schools, setSchools] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const results = await Promise.all((accessibleTenants || []).map(async (tenant) => {
      try {
        const response = await api('/api/anaokulu/', { portalOverride: 'anaokulu', params: { tenantId: tenant.id }, headers: { 'X-Tenant-Id': tenant.id }, silent: true, cacheMode: 'no-cache' })
        return { ...tenant, detail: response?.ok !== false ? response : null }
      } catch {
        return { ...tenant, detail: null }
      }
    }))
    setSchools(results)
    setLoading(false)
  }

  useEffect(() => { load() }, [accessibleTenants])

  const report = useMemo(() => {
    const scoped = schoolFilter ? schools.filter(school => String(school.id || school._id) === String(schoolFilter)) : schools
    return calculateSchoolsDebtMatrix(scoped, year)
  }, [schools, year, schoolFilter])
  const rows = report.schools.flatMap(school => school.students)
  const formatCell = (month) => month.amount > 0 ? `${money(month.amount)}${month.overdue ? ' 🔴' : ''}` : '—'

  const download = () => {
    const headers = ['Okul', 'Öğrenci', 'Sınıf', ...MONTHS, 'Yıllık Toplam']
    const body = rows.map(row => [row.schoolName, row.studentName, row.studentClass, ...report.months.map(month => row.monthly[month.period].amount), row.annualTotal])
    const html = `<table><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${body.map(line => `<tr>${line.map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    const url = URL.createObjectURL(new Blob([`\ufeff${html}`], { type: 'application/vnd.ms-excel;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `toplu-ogrenci-alacak-${year}.xls`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <div style={{ display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <div><h3 style={{ margin: 0 }}>Toplu Öğrenci Alacak Matrisi</h3><div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Her satır öğrenci, her sütun gerçek vade ayıdır.</div></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={schoolFilter} onChange={event => setSchoolFilter(event.target.value)} style={control}><option value="">Tüm Okullar</option>{(accessibleTenants || []).map(tenant => <option key={tenant.id || tenant._id} value={tenant.id || tenant._id}>{tenant.name}</option>)}</select>
        <select value={year} onChange={event => setYear(event.target.value)} style={control}>{['2025', '2026', '2027'].map(value => <option key={value} value={value}>{value} Yılı</option>)}</select>
        <button type="button" onClick={download} style={{ ...control, background: '#0f766e', color: '#fff', border: 'none', fontWeight: 700 }}>Excel'e Aktar</button>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(150px,1fr))', gap: 10 }}>
      <div style={control}>Toplam Okul: <b>{report.schools.length}</b></div><div style={control}>Toplam Öğrenci: <b>{report.totalStudents}</b></div><div style={control}>Toplam Alacak: <b>{money(report.totalDebt)}</b></div><div style={control}>Vadesi Geçmiş: <b>{money(report.totalOverdue)}</b></div>
    </div>
    <div style={{ overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
      {loading ? <div style={{ padding: 30 }}>Veriler yükleniyor...</div> : <table style={{ borderCollapse: 'collapse', minWidth: 1250, width: '100%' }}><thead><tr style={{ background: '#f8fafc' }}>{['Okul', 'Öğrenci', 'Sınıf', ...MONTHS, 'Yıllık Toplam'].map(header => <th key={header} style={{ ...cell, textAlign: 'right', fontWeight: 800 }}>{header}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={16} style={{ ...cell, textAlign: 'center' }}>Öğrenci bulunamadı.</td></tr> : rows.map(row => <tr key={`${row.schoolId}:${row.studentId}`}><td style={cell}>{row.schoolName}</td><td style={{ ...cell, fontWeight: 700 }}>{row.studentName}</td><td style={cell}>{row.studentClass}</td>{report.months.map(month => <td key={month.period} style={{ ...cell, textAlign: 'right', color: row.monthly[month.period].overdue ? '#b91c1c' : '#0f172a', background: row.monthly[month.period].overdue ? '#fff1f2' : '#fff' }}>{formatCell(row.monthly[month.period])}</td>)}<td style={{ ...cell, textAlign: 'right', fontWeight: 800 }}>{money(row.annualTotal)}</td></tr>)}</tbody></table>}
    </div>
  </div>
}
