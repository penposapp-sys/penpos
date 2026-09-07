import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  money,
  calculateSchoolsDebtReport,
  exportSchoolsDebtReportToExcel
} from '../utils/calculations.js'

const Btn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', borderRadius: 10, fontWeight: 700,
  cursor: 'pointer', border: 'none', fontSize: 13, transition: 'all 0.15s ease'
}

const InputCls = {
  padding: '9px 13px', borderRadius: 10,
  border: '1.5px solid #cbd5e1', background: '#fff',
  fontSize: 13, outline: 'none', color: '#0f172a'
}

export default function TopluAlacakRaporu({ initialSchools = null }) {
  const { accessibleTenants, setRegionCurrentTenantId } = useAuth()
  const navigate = useNavigate()

  const [schools, setSchools] = useState(initialSchools || [])
  const [loading, setLoading] = useState(!initialSchools || initialSchools.length === 0)
  const [selectedYear, setSelectedYear] = useState('2026')
  const [onlyWithDebt, setOnlyWithDebt] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedSchools, setCollapsedSchools] = useState({})
  const [toastMsg, setToastMsg] = useState('')

  const toast = (m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 3500) }

  // Okul verilerini çek
  const fetchAllSchools = async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        (accessibleTenants || []).map(async (t) => {
          try {
            const res = await api('/api/anaokulu/', {
              portalOverride: 'anaokulu',
              params: { tenantId: t.id },
              headers: { 'X-Tenant-Id': t.id },
              silent: true
            })
            return { ...t, detail: res?.ok !== false ? res : null }
          } catch {
            return { ...t, detail: null }
          }
        })
      )
      setSchools(results)
      toast('✓ Tüm okulların güncel verileri başarıyla çekildi.')
    } catch {
      setSchools(accessibleTenants || [])
      toast('⚠️ Bazı okulların verileri alınırken hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialSchools || initialSchools.length === 0) {
      fetchAllSchools()
    } else {
      setSchools(initialSchools)
      setLoading(false)
    }
  }, [accessibleTenants, initialSchools])

  // Rapor hesaplaması (Seçilen yılın 12 ayı için ay ay döküm)
  const report = useMemo(() => {
    return calculateSchoolsDebtReport(schools, selectedYear)
  }, [schools, selectedYear])

  // Arama ve filtreleme
  const filteredSchools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return report.schools.map(school => {
      let matchingStudents = school.students

      if (onlyWithDebt) {
        matchingStudents = matchingStudents.filter(s => s.totalDebt > 0)
      }

      if (q) {
        const schoolMatch = (school.schoolName || '').toLowerCase().includes(q)
        if (!schoolMatch) {
          matchingStudents = matchingStudents.filter(s =>
            (s.studentName || '').toLowerCase().includes(q) ||
            String(s.studentId || '').includes(q) ||
            (s.studentClass || '').toLowerCase().includes(q) ||
            (s.parentName || '').toLowerCase().includes(q) ||
            (s.parentPhone || '').includes(q)
          )
        }
      }

      return {
        ...school,
        filteredStudents: matchingStudents,
        filteredDebtTotal: matchingStudents.reduce((sum, s) => sum + s.totalDebt, 0)
      }
    }).filter(school => {
      if (!q && !onlyWithDebt) return true
      if (onlyWithDebt && school.debt <= 0 && school.filteredStudents.length === 0) return false
      return school.filteredStudents.length > 0 || (q && (school.schoolName || '').toLowerCase().includes(q))
    })
  }, [report, onlyWithDebt, searchQuery])

  const toggleCollapse = (id) => {
    setCollapsedSchools(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSelectSchool = (schoolId) => {
    setRegionCurrentTenantId(String(schoolId))
    navigate('/anaokulu/genel-bakis')
  }

  const handleExportExcel = () => {
    exportSchoolsDebtReportToExcel(report, onlyWithDebt)
    toast(`✓ ${selectedYear} yılı ay ay alacak raporu (.xls) başarıyla indirildi.`)
  }

  const panel = {
    background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0',
    boxShadow: '0 4px 14px rgba(15,23,42,0.04)', overflow: 'hidden', marginBottom: 20
  }

  return (
    <div style={{ display: 'grid', gap: 20, width: '100%' }}>
      {/* Üst Başlık ve Butonlar */}
      <div style={{
        background: '#fff', borderRadius: 18, border: '1.5px solid #e2e8f0', padding: '20px 24px',
        boxShadow: '0 4px 14px rgba(15,23,42,0.04)', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 16
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>📊</span>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
              Tüm Okullar — {selectedYear} Yılı Ay Ay Öğrenci Alacak Raporu
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            Tüm anaokullarının {selectedYear} yılındaki 12 ay boyunca oluşan öğrenci borçlarını ay ay sütunlarda görüntüleyin ve Excel olarak indirin.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={fetchAllSchools}
            disabled={loading}
            style={{
              ...Btn, background: '#f8fafc', color: '#0369a1', border: '1.5px solid #bae6fd'
            }}
          >
            {loading ? '⏳ Veriler Çekiliyor...' : '🔄 Verileri Yeniden Çek'}
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              ...Btn, background: 'linear-gradient(135deg, #16a34a, #15803d)',
              color: '#fff', boxShadow: '0 4px 12px rgba(22,163,74,0.25)'
            }}
          >
            📥 Excel Raporu İndir (.xls)
          </button>
        </div>
      </div>

      {/* Filtre ve Kontrol Çubuğu */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '16px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14
      }}>
        {/* Yıl Seçici */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>🗓️ Rapor Yılı:</span>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            style={{ ...InputCls, fontWeight: 800, color: '#4338ca', cursor: 'pointer', minWidth: 120 }}
          >
            <option value="2025">2025 Yılı</option>
            <option value="2026">2026 Yılı</option>
            <option value="2027">2027 Yılı</option>
          </select>
          <span style={{ fontSize: 12, color: '#64748b' }}>(Ocak — Aralık 12 Ay)</span>
        </div>

        {/* Arama & Borçlu Filtresi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Okul, öğrenci, sınıf veya veli ara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ ...InputCls, width: 280 }}
          />

          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700,
            color: '#334155', cursor: 'pointer', background: '#f8fafc', padding: '8px 14px',
            borderRadius: 10, border: '1px solid #e2e8f0'
          }}>
            <input
              type="checkbox"
              checked={onlyWithDebt}
              onChange={e => setOnlyWithDebt(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Yalnızca Borcu Olanları Göster</span>
          </label>
        </div>
      </div>

      {/* Genel KPI Özet Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div style={{
          padding: '16px 20px', borderRadius: 14, background: '#fff',
          border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Toplam Okul</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#4338ca', marginTop: 4 }}>
            {report.totalSchools} <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Okul</span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            {report.schools.filter(s => s.debt > 0).length} okulda alacak var
          </div>
        </div>

        <div style={{
          padding: '16px 20px', borderRadius: 14, background: '#fff',
          border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Borçlu Öğrenci</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#c2410c', marginTop: 4 }}>
            {report.grandDebtStudentsCount} <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Öğrenci</span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            Toplam {report.totalStudentsCount} öğrenci içinden
          </div>
        </div>

        <div style={{
          padding: '16px 20px', borderRadius: 14, background: '#fff',
          border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{selectedYear} Tahakkuk</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
            {money(report.grandAccrued)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Yıl içi planlanan toplam taksit
          </div>
        </div>

        <div style={{
          padding: '16px 20px', borderRadius: 14, background: '#fff',
          border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Tahsil Edilen</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>
            {money(report.grandPaid)}
          </div>
          <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>
            Tahsilat oranı: %{report.grandAccrued > 0 ? Math.round((report.grandPaid / report.grandAccrued) * 100) : 0}
          </div>
        </div>

        <div style={{
          padding: '16px 20px', borderRadius: 14,
          background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
          border: '2px solid #fca5a5', boxShadow: '0 4px 14px rgba(220,38,38,0.1)'
        }}>
          <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 800, textTransform: 'uppercase' }}>
            ⚠️ Toplam Kalan Alacak
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', marginTop: 4 }}>
            {money(report.grandDebt)}
          </div>
          <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4, fontWeight: 600 }}>
            {selectedYear} yılı genelinde ödenmemiş borç
          </div>
        </div>
      </div>

      {/* Okul Okul Ay Ay Matris Tablosu */}
      {loading ? (
        <div style={{
          background: '#fff', borderRadius: 16, padding: 50, textAlign: 'center',
          color: '#64748b', fontWeight: 700, border: '1.5px solid #e2e8f0'
        }}>
          ⏳ Okulların verileri ve {selectedYear} yılı taksitleri taranıyor...
        </div>
      ) : filteredSchools.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 16, padding: 48, textAlign: 'center',
          border: '2px dashed #cbd5e1'
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
            {searchQuery ? 'Aramanıza uygun sonuç bulunamadı.' : `${selectedYear} yılı için geçmiş borcu olan okul veya öğrenci bulunamadı.`}
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
            {onlyWithDebt && 'Tüm öğrencileri görüntülemek için "Yalnızca Borcu Olanları Göster" filtresini kaldırabilirsiniz.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {filteredSchools.map((school) => {
            const isCollapsed = collapsedSchools[school.schoolId]
            const studentsToShow = school.filteredStudents

            return (
              <div key={school.schoolId} style={panel}>
                {/* Okul Başlık Kartı */}
                <div style={{
                  padding: '16px 20px', background: '#f8fafc', borderBottom: isCollapsed ? 'none' : '1.5px solid #e2e8f0',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, boxShadow: '0 4px 10px rgba(79,70,229,0.2)'
                    }}>
                      🏫
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span>{school.schoolName}</span>
                        {school.debt > 0 ? (
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                            background: '#fee2e2', color: '#dc2626'
                          }}>
                            ₺{school.debt.toLocaleString('tr-TR')} ALACAK
                          </span>
                        ) : (
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                            background: '#dcfce7', color: '#166534'
                          }}>
                            ✓ BORÇ YOK
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                        Toplam {school.totalStudents} öğrenci — {school.debtStudentsCount} öğrencinin borcu var
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleSelectSchool(school.schoolId)}
                      style={{
                        ...Btn, padding: '6px 12px', background: '#e0e7ff', color: '#3730a3',
                        fontSize: 12
                      }}
                      title="Bu okulun paneline geçiş yap"
                    >
                      🏫 Bu Okula Geç ↗
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCollapse(school.schoolId)}
                      style={{
                        ...Btn, padding: '6px 12px', background: '#fff', color: '#475569',
                        border: '1px solid #cbd5e1', fontSize: 12
                      }}
                    >
                      {isCollapsed ? '▼ Detayları Aç' : '▲ Gizle'}
                    </button>
                  </div>
                </div>

                {/* Okul İçi Öğrenci Ay Ay Matris Tablosu */}
                {!isCollapsed && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: 35 }}>#</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: 140 }}>Öğrenci Adı Soyadı</th>
                          <th style={{ padding: '10px 10px', textAlign: 'left', width: 50 }}>Sınıf</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: 130 }}>Veli &amp; İletişim</th>
                          {report.months.map(m => (
                            <th
                              key={m.period}
                              style={{
                                padding: '10px 6px', textAlign: 'right', minWidth: 72,
                                background: '#f1f5f9', fontWeight: 800, fontSize: 11,
                                color: '#334155'
                              }}
                            >
                              {m.name}
                            </th>
                          ))}
                          <th style={{
                            padding: '10px 12px', textAlign: 'right', minWidth: 100,
                            color: '#dc2626', background: '#fee2e2', fontWeight: 900
                          }}>
                            Toplam Alacak
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentsToShow.length === 0 ? (
                          <tr>
                            <td colSpan={5 + report.months.length} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                              Bu okulda seçilen kriterlere uygun öğrenci bulunamadı.
                            </td>
                          </tr>
                        ) : (
                          studentsToShow.map((student, idx) => (
                            <tr
                              key={student.studentId}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                background: student.totalDebt > 0 ? (idx % 2 === 0 ? '#fff' : '#fffaf9') : '#fff'
                              }}
                            >
                              <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{idx + 1}</td>
                              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{student.studentName}</span>
                                  {!student.active && (
                                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fee2e2', color: '#991b1b' }}>
                                      Pasif
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>No: {student.studentId}</div>
                              </td>
                              <td style={{ padding: '10px 10px', color: '#334155' }}>{student.studentClass}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: 600, color: '#334155', fontSize: 12 }}>{student.parentName}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{student.parentPhone}</div>
                              </td>
                              {/* 12 Ayın Sütunları */}
                              {report.months.map(m => {
                                const d = student.monthlyDebts[m.period] || 0
                                const due = student.monthlyDues[m.period] || 0
                                return (
                                  <td key={m.period} style={{ padding: '10px 6px', textAlign: 'right' }}>
                                    {d > 0 ? (
                                      <span style={{
                                        display: 'inline-block', padding: '3px 6px', borderRadius: 6,
                                        background: '#fee2e2', color: '#dc2626', fontWeight: 800, fontSize: 11
                                      }}>
                                        ₺{d.toLocaleString('tr-TR')}
                                      </span>
                                    ) : due > 0 ? (
                                      <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 11 }}>
                                        ✓ Ödendi
                                      </span>
                                    ) : (
                                      <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
                                    )}
                                  </td>
                                )
                              })}
                              {/* Toplam Alacak Sütunu */}
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                {student.totalDebt > 0 ? (
                                  <span style={{
                                    display: 'inline-block', padding: '4px 8px', borderRadius: 8,
                                    background: '#fee2e2', color: '#dc2626', fontWeight: 900, fontSize: 13
                                  }}>
                                    ₺{student.totalDebt.toLocaleString('tr-TR')}
                                  </span>
                                ) : (
                                  <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 12 }}>
                                    ✓ Borç Yok
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#fef3c7', fontWeight: 800, borderTop: '2px solid #fcd34d' }}>
                          <td colSpan={4} style={{ padding: '11px 12px', textAlign: 'right', color: '#92400e' }}>
                            {school.schoolName} Ara Toplam:
                          </td>
                          {/* Her Ayın Okul Toplamı */}
                          {report.months.map(m => {
                            const d = school.monthlyDebts[m.period] || 0
                            return (
                              <td
                                key={m.period}
                                style={{
                                  padding: '11px 6px', textAlign: 'right', fontSize: 11,
                                  color: d > 0 ? '#dc2626' : '#64748b', fontWeight: d > 0 ? 800 : 600
                                }}
                              >
                                {d > 0 ? `₺${d.toLocaleString('tr-TR')}` : '—'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '11px 12px', textAlign: 'right', color: '#dc2626', fontSize: 14 }}>
                            ₺{school.debt.toLocaleString('tr-TR')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Genel Toplam Alt Tablosu */}
      {!loading && filteredSchools.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b, #312e81)', color: '#fff',
          borderRadius: 16, padding: '18px 24px', boxShadow: '0 8px 24px rgba(30,27,75,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
        }}>
          <div>
            <div style={{ fontSize: 13, textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>
              {selectedYear} Yılı — Tüm Okullar Genel Alacak Özeti
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>
              Toplam {report.totalSchools} Okul | {report.grandDebtStudentsCount} Borçlu Öğrenci
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Yıl İçi Tahsilat</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#4ade80' }}>
                {money(report.grandPaid)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Toplam Açık Alacak</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fca5a5' }}>
                {money(report.grandDebt)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportExcel}
              style={{
                ...Btn, background: '#fff', color: '#312e81',
                padding: '10px 20px', fontSize: 13, fontWeight: 800
              }}
            >
              📥 Tümünü Excel'e Aktar (.xls)
            </button>
          </div>
        </div>
      )}

      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: '#fff', padding: '12px 24px', borderRadius: 14,
          fontWeight: 700, fontSize: 13, zIndex: 99999,
          boxShadow: '0 8px 24px rgba(15,23,42,0.3)'
        }}>
          {toastMsg}
        </div>
      )}
    </div>
  )
}
