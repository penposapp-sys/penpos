import { AnaokuluSchool } from '../models/AnaokuluSchool.js'

export const getAnaokuluSchool = async (req, res) => {
  try {
    const tenantId = req.tenant?._id || req.tenant?.id
    if (!tenantId) {
      return res.json({
        settings: { school: 'Anaokulu', vat: 10 },
        students: [],
        collections: [],
        invoices: [],
        checks: []
      })
    }
    const school = await AnaokuluSchool.findOne({ tenant: tenantId }).lean()
    if (!school) {
      return res.json({
        settings: { school: 'Anaokulu', vat: 10 },
        students: [],
        collections: [],
        invoices: [],
        checks: []
      })
    }
    const { settings, students, collections, invoices, checks } = school
    // Faturaların dönemlerinin fatura tarihine uygun olduğundan emin ol (örn: 2026-06-30 -> 2026-06)
    const normalizedInvoices = (invoices || []).map(inv => {
      if (inv.date && inv.date.length >= 7) {
        const truePeriod = inv.date.slice(0, 7)
        if (inv.period !== truePeriod) {
          return { ...inv, period: truePeriod }
        }
      }
      return inv
    })
    res.json({ settings, students, collections, invoices: normalizedInvoices, checks })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Sunucu hatası' })
  }
}

export const saveAnaokuluSchool = async (req, res) => {
  try {
    const tenantId = req.tenant?._id || req.tenant?.id
    if (!tenantId) {
      return res.status(400).json({ error: 'Lütfen işlem yapacağınız bir anaokulu seçiniz.' })
    }
    const body = req.body || {}
    const reqSettings = body.settings
    const reqStudents = body.students
    const reqCollections = body.collections
    const reqInvoices = body.invoices
    const reqChecks = body.checks
    let school = await AnaokuluSchool.findOne({ tenant: tenantId }).lean()
    if (!school) {
      school = await AnaokuluSchool.create({
        tenant: tenantId,
        settings: reqSettings || { school: 'Anaokulu', vat: 10 },
        students: reqStudents || [],
        collections: reqCollections || [],
        invoices: reqInvoices || [],
        checks: reqChecks || []
      })
    } else {
      await AnaokuluSchool.updateOne(
        { tenant: tenantId },
        {
          $set: {
            settings: reqSettings || school.settings,
            students: reqStudents || school.students,
            collections: reqCollections || school.collections,
            invoices: reqInvoices || school.invoices,
            checks: reqChecks || school.checks
          }
        }
      )
      const updated = await AnaokuluSchool.findOne({ tenant: tenantId }).lean()
      school = updated
    }
    const { settings, students, collections, invoices, checks } = school
    res.json({ settings, students, collections, invoices, checks })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Sunucu hatası' })
  }
}

// Alt endpointler — tek öğrencinin dökümünü getir/sil
export const getAnaokuluStudent = async (req, res) => {
  try {
    const school = await AnaokuluSchool.findOne({ tenant: req.tenant?._id }).lean()
    if (!school || !school.students) return res.json(null)
    const s = school.students.find(st => st.id === Number(req.params.id))
    res.json(s || null)
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Sunucu hatası' })
  }
}

export const delAnaokuluStudent = async (req, res) => {
  try {
    const sid = Number(req.params.id)
    const school = await AnaokuluSchool.findOne({ tenant: req.tenant?._id })
    if (!school) return res.status(404).json({ error: 'Okul kaydı bulunamadı' })
    school.students = school.students.filter(st => st.id !== sid)
    school.collections = school.collections.filter(c => c.studentId !== sid)
    school.invoices = school.invoices.filter(i => i.studentId !== sid)
    await school.save()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Sunucu hatası' })
  }
}

export const delAnaokuluCollection = async (req, res) => {
  try {
    const cid = Number(req.params.id)
    const school = await AnaokuluSchool.findOne({ tenant: req.tenant?._id })
    if (!school) return res.status(404).json({ error: 'Okul kaydı bulunamadı' })
    school.collections = school.collections.filter(c => c.id !== cid)
    await school.save()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Sunucu hatası' })
  }
}

export const delAnaokuluInvoice = async (req, res) => {
  try {
    const uuid = req.params.uuid
    const school = await AnaokuluSchool.findOne({ tenant: req.tenant?._id })
    if (!school) return res.status(404).json({ error: 'Okul kaydı bulunamadı' })
    school.invoices = school.invoices.filter(i => i.uuid !== uuid)
    await school.save()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Sunucu hatası' })
  }
}

// ───────────────────────────────────────────────
// LUCA E-FATURA ENTEGRASYONU - BOT ile Kontrol
// ───────────────────────────────────────────────
export const checkLucaInvoices = async (req, res) => {
  try {
    const tenantId = req.tenant?._id || req.tenant?.id
    if (!tenantId) return res.status(400).json({ error: 'Tenant bulunamadı.' })

    const school = await AnaokuluSchool.findOne({ tenant: tenantId }).lean()
    if (!school) return res.status(404).json({ error: 'Okul kaydı bulunamadı.' })

    const luca = school?.settings?.luca || {}
    const tckn = luca.tckn || luca.username || luca.customerNo
    const password = luca.password

    if (!tckn || !password) {
      return res.status(400).json({ error: 'Luca TCKN ve şifre ayarları eksik. Lütfen Ayarlar sayfasından tanımlayın.' })
    }

    const { period } = req.body || {}
    if (!period) {
      return res.status(400).json({ error: 'Dönem (period) bilgisi gönderilmedi.' })
    }

    // period: "2026-04" → minDate: "2026-04-01", maxDate: "2026-04-30"
    const [year, month] = period.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Bot'u lazily import et (Puppeteer ağır, sadece gerektiğinde yükle)
    const { lucaScraperService } = await import('../services/lucaScraperService.js')
    const lucaInvoices = await lucaScraperService.getInvoices(tckn, password, startDate, endDate)

    // Öğrencilerle eşleştir: TC/VKN ya da isim üzerinden
    const students = school.students || []
    const matchBy = school.settings?.matchBy || 'tax'

    const matched = []
    let matchedCount = 0

    // Yardımcı: Türkçe karakter normalizasyonu
    const normalizeTurkish = (str) => {
      if (!str) return ''
      return String(str)
        .replace(/İ/g, 'i')
        .replace(/I/g, 'i')
        .replace(/ı/g, 'i')
        .toLowerCase()
        .replace(/ş/g, 's')
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    const matchInvoiceToStudent = (alici, studentList) => {
      const normAlici = normalizeTurkish(alici)
      if (!normAlici || !studentList || studentList.length === 0) return null

      // 1. ÖĞRENCİ ADIYLA TAM EŞLEŞME
      let found = studentList.find(s => normalizeTurkish(s.name) === normAlici)
      if (found) return found

      // 2. ÖĞRENCİ ADIYLA İLK AD + SOYAD EŞLEŞMESİ (Örn: MELİH CIVAK <-> MELİH EMRE CIVAK)
      const aliciWords = normAlici.split(' ').filter(w => w.length > 1)
      if (aliciWords.length >= 2) {
        const firstA = aliciWords[0]
        const lastA = aliciWords[aliciWords.length - 1]

        found = studentList.find(s => {
          const sWords = normalizeTurkish(s.name).split(' ').filter(w => w.length > 1)
          if (sWords.length >= 2) {
            return firstA === sWords[0] && lastA === sWords[sWords.length - 1]
          }
          return false
        })
        if (found) return found
      }

      // 3. ÖĞRENCİ ADI İÇERME (INCLUDES) EŞLEŞMESİ
      found = studentList.find(s => {
        const sNorm = normalizeTurkish(s.name)
        if (!sNorm || sNorm.length < 4) return false
        return normAlici.includes(sNorm) || sNorm.includes(normAlici)
      })
      if (found) return found

      // 4. VELİ ADIYLA TAM EŞLEŞME
      found = studentList.find(s => normalizeTurkish(s.parent) === normAlici)
      if (found) return found

      // 5. VELİ ADIYLA İLK AD + SOYAD EŞLEŞMESİ
      if (aliciWords.length >= 2) {
        const firstA = aliciWords[0]
        const lastA = aliciWords[aliciWords.length - 1]

        found = studentList.find(s => {
          const pWords = normalizeTurkish(s.parent).split(' ').filter(w => w.length > 1)
          if (pWords.length >= 2) {
            return firstA === pWords[0] && lastA === pWords[pWords.length - 1]
          }
          return false
        })
        if (found) return found
      }

      // 6. VELİ ADI İÇERME (INCLUDES) EŞLEŞMESİ
      found = studentList.find(s => {
        const pNorm = normalizeTurkish(s.parent)
        if (!pNorm || pNorm.length < 4) return false
        return normAlici.includes(pNorm) || pNorm.includes(normAlici)
      })
      if (found) return found

      return null
    }

    for (const li of lucaInvoices) {
      // Luca'da faturalar öğrenciye kesildiği için önce öğrenci adıyla eşleştir
      const student = matchInvoiceToStudent(li.alici, students)

      const vatRate = Number(school.settings?.vat || 10)
      const base = li.total ? Math.round((li.total / (1 + vatRate / 100)) * 100) / 100 : 0
      const vat  = li.total ? Math.round((li.total - base) * 100) / 100 : 0

      const invPeriod = (li.isoDate && li.isoDate.length >= 7) ? li.isoDate.slice(0, 7) : period

      matched.push({
        uuid: `luca_${li.faturaNo || Date.now()}`,
        no: li.faturaNo,
        date: li.isoDate,
        period: invPeriod, // Faturanın gerçek kesim tarihinden türetilen dönem (örn: 2026-05-30 -> 2026-05)
        taxId: student?.tax || '',
        buyer: li.alici,
        base,
        vat,
        total: li.total,
        type: 'e-Arşiv',
        status: 'Kesildi',
        studentId: student ? (student.id || student._id) : null,
        matchBy: 'luca-scraper'
      })
      if (student && invPeriod === period) matchedCount++
    }

    // Mevcut faturalara ekle (aynı fatura numarası varsa güncelle)
    const updated = await AnaokuluSchool.findOne({ tenant: tenantId })
    if (!updated) return res.status(404).json({ error: 'Okul kaydı bulunamadı.' })

    for (const inv of matched) {
      const idx = updated.invoices.findIndex(i => i.no === inv.no)
      if (idx >= 0) {
        updated.invoices[idx] = inv
      } else {
        updated.invoices.push(inv)
      }
    }

    // Tüm faturaların dönemlerini fatura tarihlerine göre garantiye al
    for (const inv of updated.invoices) {
      if (inv.date && inv.date.length >= 7) {
        inv.period = inv.date.slice(0, 7)
      }
    }

    // Check kaydı ekle
    updated.checks = updated.checks || []
    updated.checks.push({
      period,
      at: Date.now(),
      found: lucaInvoices.length,
      matched: matchedCount
    })

    updated.markModified('invoices')
    await updated.save()

    const { settings, students: sts, collections, invoices, checks } = updated
    res.json({
      ok: true,
      found: lucaInvoices.length,
      matched: matchedCount,
      settings, students: sts, collections, invoices, checks
    })
  } catch (err) {
    console.error('[checkLucaInvoices] Hata:', err)
    res.status(500).json({ error: err?.message || 'Luca entegrasyon hatası' })
  }
}
