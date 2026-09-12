import { AnaokuluSchool } from '../models/AnaokuluSchool.js'
import LucaExtensionDevice from '../models/LucaExtensionDevice.js'
import LucaJob from '../models/LucaJob.js'
import { findLucaDeviceByToken, getLucaDeviceToken, hashLucaDeviceToken } from '../middlewares/requireLucaDevice.js'
import crypto from 'crypto'

// In-memory job store (process restart’ta sıfırlanır — kısa süreli işler için yeterli)
const lucaJobs = new Map()

const getLucaJob = async (jobId, { fresh = false } = {}) => {
  const cached = lucaJobs.get(jobId)
  if (cached && !fresh) return cached
  const stored = await LucaJob.findOne({ jobId }).lean()
  if (!stored) return null
  lucaJobs.set(jobId, stored.data)
  return stored.data
}

const setLucaJob = async (jobId, data) => {
  lucaJobs.set(jobId, data)
  const expiresAt = new Date(Date.now() + (data.status === 'running' ? 10 : 5) * 60 * 1000)
  await LucaJob.findOneAndUpdate(
    { jobId },
    { $set: { jobId, data, expiresAt } },
    { upsert: true, setDefaultsOnInsert: true }
  )
  return data
}

const deleteLucaJob = async (jobId) => {
  lucaJobs.delete(jobId)
  await LucaJob.deleteOne({ jobId })
}

const listLucaJobs = async () => {
  const stored = await LucaJob.find({ 'data.status': 'running' }).lean()
  for (const item of stored) lucaJobs.set(item.jobId, item.data)
  return stored.map(item => [item.jobId, item.data])
}

const createLucaDeviceToken = () => crypto.randomBytes(32).toString('hex')

const getDeviceTenantId = (req) => String(req.tenant?._id || req.tenant?.id || req.user?.tenantId || '').trim()

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100

const validateAnaokuluCollections = (students = [], collections = [], previousStudents = []) => {
  const plans = new Map()
  const previousPlans = new Map()
  previousStudents.forEach(student => {
    ;(student.items || []).forEach(plan => {
      previousPlans.set(`${student.id}::${String(plan.name || '').trim().toLowerCase()}`, {
        total: roundMoney(plan.total),
        downPayment: roundMoney(plan.downPayment),
        installments: Math.max(1, Number(plan.installments) || 1)
      })
    })
  })
  students.forEach(student => {
    ;(student.items || []).forEach(plan => {
      const key = `${student.id}::${String(plan.name || '').trim().toLowerCase()}`
      const currentPlan = {
        total: roundMoney(plan.total),
        downPayment: roundMoney(plan.downPayment),
        installments: Math.max(1, Number(plan.installments) || 1)
      }
      const previousPlan = previousPlans.get(key)
      plans.set(key, {
        ...currentPlan,
        scheduleChanged: Boolean(previousPlan && (
          previousPlan.total !== currentPlan.total ||
          previousPlan.downPayment !== currentPlan.downPayment ||
          previousPlan.installments !== currentPlan.installments
        ))
      })
    })
  })

  const totals = new Map()
  const installmentTotals = new Map()
  collections.forEach(collection => {
    const amount = roundMoney(collection.amount)
    if (amount < 0) throw new Error('Tahsilat tutarı negatif olamaz.')
    const key = `${collection.studentId}::${String(collection.item || '').trim().toLowerCase()}`
    const plan = plans.get(key)
    if (!plan) return

    const total = roundMoney((totals.get(key) || 0) + amount)
    totals.set(key, total)
    if (total > plan.total + 0.01) {
      throw new Error(`Toplam tahsilat plan tutarını aşamaz: ${collection.item || 'Ücret planı'}.`)
    }

    const installmentNo = Number(collection.installmentNo)
    if (!Number.isInteger(installmentNo) || installmentNo < 0 || installmentNo > plan.installments) return
    if (installmentNo === 0 && plan.downPayment <= 0) return
    const installmentKey = `${key}::${installmentNo}`
    const installmentTotal = roundMoney((installmentTotals.get(installmentKey) || 0) + amount)
    installmentTotals.set(installmentKey, installmentTotal)
    const expected = installmentNo === 0
      ? plan.downPayment
      : roundMoney(plan.total / plan.installments)
    if (!plan.scheduleChanged && installmentTotal > expected + 0.01) {
      throw new Error(`${installmentNo === 0 ? 'Peşinat' : `${installmentNo}. taksit`} tutarı aşamaz.`)
    }
  })
}

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

    const school = await AnaokuluSchool.findOne({
      tenant: tenantId
    }).lean()

    if (!school) {
      return res.json({
        settings: { school: 'Anaokulu', vat: 10 },
        students: [],
        collections: [],
        invoices: [],
        checks: []
      })
    }

    const {
      settings,
      students,
      collections,
      invoices,
      checks
    } = school

    // Faturaların dönemlerinin fatura tarihine uygun olduğundan emin ol
    // (örn: 2026-06-30 -> 2026-06)
    const normalizedInvoices = (invoices || []).map(inv => {
      if (inv.date && inv.date.length >= 7) {
        const truePeriod = inv.date.slice(0, 7)

        if (inv.period !== truePeriod) {
          return {
            ...inv,
            period: truePeriod
          }
        }
      }

      return inv
    })

    res.json({
      settings,
      students,
      collections,
      invoices: normalizedInvoices,
      checks
    })
  } catch (err) {
    res.status(500).json({
      error: err?.message || 'Sunucu hatası'
    })
  }
}

export const saveAnaokuluSchool = async (req, res) => {
  try {
    const tenantId = req.tenant?._id || req.tenant?.id

    if (!tenantId) {
      return res.status(400).json({
        error: 'Lütfen işlem yapacağınız bir anaokulu seçiniz.'
      })
    }

    const body = req.body || {}

    const reqSettings = body.settings
    const reqStudents = body.students
    const reqCollections = body.collections
    const reqInvoices = body.invoices
    const reqChecks = body.checks

    let school = await AnaokuluSchool.findOne({
      tenant: tenantId
    }).lean()

    const studentsChanged = JSON.stringify(reqStudents || []) !== JSON.stringify(school?.students || [])
    const collectionsChanged = JSON.stringify(reqCollections || []) !== JSON.stringify(school?.collections || [])

    if (studentsChanged || collectionsChanged) {
      try {
        validateAnaokuluCollections(reqStudents || [], reqCollections || [], school?.students || [])
      } catch (validationError) {
        return res.status(400).json({
          error: validationError.message || 'Geçersiz tahsilat tutarı.'
        })
      }
    }

    if (!school) {
      school = await AnaokuluSchool.create({
        tenant: tenantId,
        settings: reqSettings || {
          school: 'Anaokulu',
          vat: 10
        },
        students: reqStudents || [],
        collections: reqCollections || [],
        invoices: reqInvoices || [],
        checks: reqChecks || []
      })
    } else {
      await AnaokuluSchool.updateOne(
        {
          tenant: tenantId
        },
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

      const updated = await AnaokuluSchool.findOne({
        tenant: tenantId
      }).lean()

      school = updated
    }

    const {
      settings,
      students,
      collections,
      invoices,
      checks
    } = school

    res.json({
      settings,
      students,
      collections,
      invoices,
      checks
    })
  } catch (err) {
    res.status(500).json({
      error: err?.message || 'Sunucu hatası'
    })
  }
}

// Alt endpointler — tek öğrencinin dökümünü getir/sil
export const getAnaokuluStudent = async (req, res) => {
  try {
    const school = await AnaokuluSchool.findOne({
      tenant: req.tenant?._id
    }).lean()

    if (!school || !school.students) {
      return res.json(null)
    }

    const s = school.students.find(
      st => st.id === Number(req.params.id)
    )

    res.json(s || null)
  } catch (err) {
    res.status(500).json({
      error: err?.message || 'Sunucu hatası'
    })
  }
}

export const delAnaokuluStudent = async (req, res) => {
  try {
    const sid = Number(req.params.id)

    const school = await AnaokuluSchool.findOne({
      tenant: req.tenant?._id
    })

    if (!school) {
      return res.status(404).json({
        error: 'Okul kaydı bulunamadı'
      })
    }

    school.students = school.students.filter(
      st => st.id !== sid
    )

    school.collections = school.collections.filter(
      c => c.studentId !== sid
    )

    school.invoices = school.invoices.filter(
      i => i.studentId !== sid
    )

    await school.save()

    res.json({
      ok: true
    })
  } catch (err) {
    res.status(500).json({
      error: err?.message || 'Sunucu hatası'
    })
  }
}

export const delAnaokuluCollection = async (req, res) => {
  try {
    const cid = Number(req.params.id)

    const school = await AnaokuluSchool.findOne({
      tenant: req.tenant?._id
    })

    if (!school) {
      return res.status(404).json({
        error: 'Okul kaydı bulunamadı'
      })
    }

    school.collections = school.collections.filter(
      c => c.id !== cid
    )

    await school.save()

    res.json({
      ok: true
    })
  } catch (err) {
    res.status(500).json({
      error: err?.message || 'Sunucu hatası'
    })
  }
}

export const delAnaokuluInvoice = async (req, res) => {
  try {
    const uuid = req.params.uuid

    const school = await AnaokuluSchool.findOne({
      tenant: req.tenant?._id
    })

    if (!school) {
      return res.status(404).json({
        error: 'Okul kaydı bulunamadı'
      })
    }

    school.invoices = school.invoices.filter(
      i => i.uuid !== uuid
    )

    await school.save()

    res.json({
      ok: true
    })
  } catch (err) {
    res.status(500).json({
      error: err?.message || 'Sunucu hatası'
    })
  }
}

// ─────────────────────────────────────────────────────────────
// LUCA E-FATURA ENTEGRASYONU - Chrome Extension Job mimarisi
// ─────────────────────────────────────────────────────────────

export const checkLucaInvoices = async (req, res) => {
  try {
    const tenantId = req.tenant?._id || req.tenant?.id

    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant bulunamadı.'
      })
    }

    const school = await AnaokuluSchool.findOne({
      tenant: tenantId
    }).lean()

    if (!school) {
      return res.status(404).json({
        error: 'Okul kaydı bulunamadı.'
      })
    }

    const luca = school?.settings?.luca || {}

    const tckn =
      luca.tckn ||
      luca.username ||
      luca.customerNo

    const password = luca.password

    if (!tckn || !password) {
      return res.status(400).json({
        error: 'Luca TCKN ve şifre ayarları eksik. Lütfen Ayarlar sayfasından tanımlayın.'
      })
    }

    const { period } = req.body || {}

    if (!period) {
      return res.status(400).json({
        error: 'Dönem (period) bilgisi gönderilmedi.'
      })
    }

    // Extension görevi için kısa ömürlü tek kullanımlık token.
    const jobId = crypto.randomUUID()

    const extensionToken = crypto
      .randomBytes(32)
      .toString('hex')

    const extensionTokenHash = crypto
      .createHash('sha256')
      .update(extensionToken)
      .digest('hex')

    await setLucaJob(jobId, {
      status: 'running',
      phase: 'waiting_extension',
      period,
      tenantId: String(tenantId),
      extensionToken,
      extensionTokenHash,
      step: 'Chrome Extension bağlantısı bekleniyor…',
      startedAt: Date.now()
    })

    // Luca işlemi Chrome Extension tarafından yürütülecek.
    return res.json({
      ok: true,
      jobId,
      extensionToken,
      status: 'running'
    })
  } catch (err) {
    console.error('[checkLucaInvoices] Hata:', err)

    res.status(500).json({
      error: err?.message || 'Luca entegrasyon hatası'
    })
  }
}

// Job durum sorgusu
export const checkLucaJobStatus = async (req, res) => {
  const { jobId } = req.params

  const job = await getLucaJob(jobId)

  if (!job) {
    return res.status(404).json({
      error: 'Job bulunamadı veya süresi doldu.'
    })
  }

  const {
    extensionTokenHash,
    resultTokenHash,
    ...safeJob
  } = job

  return res.json(safeJob)
}


// ─────────────────────────────────────────────────────────────
// Chrome Extension görevi devralır.
// Burada PenPOS'taki Luca bilgileri Extension'a verilir.
// ─────────────────────────────────────────────────────────────
export const claimLucaExtensionTask = async (req, res) => {
  try {
    const { jobId } = req.params

    const token = String(
      req.body?.extensionToken || ''
    ).trim()

    if (!jobId || !token) {
      return res.status(400).json({
        error: 'Extension görev bilgisi eksik.'
      })
    }

    const job = await getLucaJob(jobId, { fresh: true })

    if (!job) {
      return res.status(404).json({
        error: 'Job bulunamadı veya süresi doldu.'
      })
    }

    if (job.assignedDeviceId) {
      const device = await findLucaDeviceByToken(getLucaDeviceToken(req))
      if (!device || String(device._id) !== String(job.assignedDeviceId)) {
        return res.status(403).json({ error: 'Bu Luca görevi farklı bir cihaza atanmış.' })
      }
    }

    if (
      job.status !== 'running' ||
      job.phase !== 'waiting_extension'
    ) {
      return res.status(409).json({
        error: 'Bu Luca görevi Extension için hazır değil.'
      })
    }

    // Extension görevi maksimum 5 dakika içinde devralmalı.
    if (
      !job.startedAt ||
      Date.now() - job.startedAt > 5 * 60 * 1000
    ) {
      return res.status(410).json({
        error: 'Extension görev anahtarının süresi doldu.'
      })
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')

    const expectedHash = String(
      job.extensionTokenHash || ''
    )

    if (
      !expectedHash ||
      expectedHash.length !== tokenHash.length ||
      !crypto.timingSafeEqual(
        Buffer.from(tokenHash),
        Buffer.from(expectedHash)
      )
    ) {
      return res.status(401).json({
        error: 'Geçersiz Extension görev anahtarı.'
      })
    }

    const tenantId = job.tenantId

    const school = await AnaokuluSchool.findOne({
      tenant: tenantId
    }).lean()

    if (!school) {
      return res.status(404).json({
        error: 'Okul kaydı bulunamadı.'
      })
    }

    const luca = school?.settings?.luca || {}

    const tckn =
      luca.tckn ||
      luca.username ||
      luca.customerNo

    const password = luca.password

    if (!tckn || !password) {
      return res.status(400).json({
        error: 'Luca giriş bilgileri eksik.'
      })
    }

    // Extension faturaları geri gönderirken kullanılacak
    // ayrı ve tek kullanımlık sonuç tokenı.
    const resultToken = crypto
      .randomBytes(32)
      .toString('hex')

    const resultTokenHash = crypto
      .createHash('sha256')
      .update(resultToken)
      .digest('hex')

    await setLucaJob(jobId, {
      ...job,
      phase: 'extension_claimed',
      step: 'Chrome Extension görevi devraldı…',
      extensionTokenHash: undefined,
      extensionToken: undefined,
      resultTokenHash,
      claimedAt: Date.now()
    })

    return res.json({
      ok: true,
      jobId,
      period: job.period,
      resultToken,
      tckn,
      password
    })
  } catch (err) {
    console.error(
      '[claimLucaExtensionTask] Hata:',
      err
    )

    return res.status(500).json({
      error:
        err?.message ||
        'Extension görevi alınamadı.'
    })
  }
}


// ─────────────────────────────────────────────────────────────
// Chrome Extension Luca faturalarını PenPOS'a geri gönderir.
// Sonrasında mevcut öğrenci eşleştirme + KDV + kayıt sistemi
// çalışır.
// ─────────────────────────────────────────────────────────────
export const submitLucaExtensionInvoices = async (req, res) => {
  try {
    const { jobId } = req.params

    const resultToken = String(
      req.body?.resultToken || ''
    ).trim()

    const invoices = req.body?.invoices
console.log(
  '[LUCA EXTENSION] Gelen fatura sayısı:',
  Array.isArray(invoices) ? invoices.length : 'ARRAY DEGIL'
)

console.log(
  '[LUCA EXTENSION] İlk fatura:',
  Array.isArray(invoices) && invoices.length
    ? invoices[0]
    : null
)

    if (!jobId || !resultToken) {
      return res.status(400).json({
        error: 'Luca sonuç doğrulama bilgisi eksik.'
      })
    }

    if (!Array.isArray(invoices)) {
      return res.status(400).json({
        error: 'invoices dizisi gerekli.'
      })
    }

    const job = await getLucaJob(jobId)

    if (!job) {
      return res.status(404).json({
        error: 'Job bulunamadı veya süresi doldu.'
      })
    }

    if (job.assignedDeviceId) {
      const device = await findLucaDeviceByToken(getLucaDeviceToken(req))
      if (!device || String(device._id) !== String(job.assignedDeviceId)) {
        return res.status(403).json({ error: 'Bu Luca görevi farklı bir cihaza atanmış.' })
      }
    }

    if (
      job.status !== 'running' ||
      job.phase !== 'extension_claimed'
    ) {
      return res.status(409).json({
        error: 'Luca görevi fatura kabulü için hazır değil.'
      })
    }

    // Sonuç en fazla 5 dakika içinde gönderilmeli.
    if (
      !job.claimedAt ||
      Date.now() - job.claimedAt > 5 * 60 * 1000
    ) {
      return res.status(410).json({
        error: 'Luca sonuç anahtarının süresi doldu.'
      })
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(resultToken)
      .digest('hex')

    const expectedHash = String(
      job.resultTokenHash || ''
    )

    if (
      !expectedHash ||
      expectedHash.length !== tokenHash.length ||
      !crypto.timingSafeEqual(
        Buffer.from(tokenHash),
        Buffer.from(expectedHash)
      )
    ) {
      return res.status(401).json({
        error: 'Geçersiz Luca sonuç anahtarı.'
      })
    }

    const tenantId = job.tenantId

    const school = await AnaokuluSchool.findOne({
      tenant: tenantId
    }).lean()

    if (!school) {
      return res.status(404).json({
        error: 'Okul kaydı bulunamadı.'
      })
    }

    // Sonuç tokenını tek kullanımlık hale getir.
    await setLucaJob(jobId, {
      ...job,
      phase: 'processing_invoices',
      step:
        `${invoices.length} Luca faturası alındı, PenPOS eşleştirmesi yapılıyor…`,
      resultTokenHash: undefined,
      extensionInvoices: invoices,
      extensionSubmittedAt: Date.now()
    })

    // Mevcut öğrenci eşleştirme,
    // KDV hesaplama,
    // fatura oluşturma,
    // MongoDB kayıt,
    // found / matched
    // akışını kullan.
    _runLucaJob(
      jobId,
      tenantId,
      school,
      null,
      null,
      job.period,
      invoices
    )

    return res.json({
      ok: true,
      jobId,
      accepted: invoices.length
    })
  } catch (err) {
    console.error(
      '[submitLucaExtensionInvoices] Hata:',
      err
    )

    return res.status(500).json({
      error:
        err?.message ||
        'Luca faturaları işlenemedi.'
    })
  }
}


// ─── İç yardımcı: Chrome Extension'dan gelen faturaları işleyen job ───
async function _runLucaJob(
  jobId,
  tenantId,
  school,
  tckn,
  password,
  period,
  extensionInvoices = null
) {
  try {
    const updateStep = async (step) => {
      const currentJob = await getLucaJob(jobId)

      if (currentJob?.status === 'running') {
        await setLucaJob(jobId, {
          ...currentJob,
          step,
          updatedAt: Date.now()
        })
      }
    }

    const [year, month] = period
      .split('-')
      .map(Number)

    const lastDay = new Date(
      year,
      month,
      0
    ).getDate()

    const startDate =
      `${year}-${String(month).padStart(2, '0')}-01`

    const endDate =
      `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Artık Puppeteer/Luca scraper kullanılmıyor.
    // Faturalar Chrome Extension'dan geliyor.
    const lucaInvoices = Array.isArray(extensionInvoices)
      ? extensionInvoices
      : []

    if (!Array.isArray(extensionInvoices)) {
      throw new Error(
        'Luca faturaları Chrome Extension tarafından gönderilmedi.'
      )
    }

    await updateStep(
      lucaInvoices.length
        ? 'Faturalar öğrencilerle eşleştiriliyor…'
        : 'Luca bu dönem için fatura bulamadı. Sonuç kaydediliyor…'
    )

    const students = school.students || []

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

    const matchInvoiceToStudent = (
      alici,
      studentList
    ) => {
      const normAlici =
        normalizeTurkish(alici)

      if (
        !normAlici ||
        !studentList?.length
      ) {
        return null
      }

      // 1. Öğrenci tam isim eşleşmesi
      let found = studentList.find(
        s =>
          normalizeTurkish(s.name) ===
          normAlici
      )

      if (found) {
        return found
      }

      // 2. Ad + soyad eşleşmesi
      const aliciWords =
        normAlici
          .split(' ')
          .filter(w => w.length > 1)

      if (aliciWords.length >= 2) {
        const firstA =
          aliciWords[0]

        const lastA =
          aliciWords[aliciWords.length - 1]

        found = studentList.find(s => {
          const sWords =
            normalizeTurkish(s.name)
              .split(' ')
              .filter(w => w.length > 1)

          return (
            sWords.length >= 2 &&
            firstA === sWords[0] &&
            lastA ===
              sWords[sWords.length - 1]
          )
        })

        if (found) {
          return found
        }
      }

      // 3. İçerme eşleşmesi
      found = studentList.find(s => {
        const sNorm =
          normalizeTurkish(s.name)

        if (
          !sNorm ||
          sNorm.length < 4
        ) {
          return false
        }

        return (
          normAlici.includes(sNorm) ||
          sNorm.includes(normAlici)
        )
      })

      if (found) {
        return found
      }

      // 4. Veli tam isim eşleşmesi
      found = studentList.find(
        s =>
          normalizeTurkish(s.parent) ===
          normAlici
      )

      if (found) {
        return found
      }

      // 5. Veli ad + soyad eşleşmesi
      if (aliciWords.length >= 2) {
        const firstA =
          aliciWords[0]

        const lastA =
          aliciWords[aliciWords.length - 1]

        found = studentList.find(s => {
          const pWords =
            normalizeTurkish(s.parent)
              .split(' ')
              .filter(w => w.length > 1)

          return (
            pWords.length >= 2 &&
            firstA === pWords[0] &&
            lastA ===
              pWords[pWords.length - 1]
          )
        })

        if (found) {
          return found
        }
      }

      // 6. Veli içerme eşleşmesi
      found = studentList.find(s => {
        const pNorm =
          normalizeTurkish(s.parent)

        if (
          !pNorm ||
          pNorm.length < 4
        ) {
          return false
        }

        return (
          normAlici.includes(pNorm) ||
          pNorm.includes(normAlici)
        )
      })

      return found || null
    }

    const matched = []

    let matchedCount = 0

    const vatRate =
      Number(
        school.settings?.vat || 10
      )

    for (const li of lucaInvoices) {
      const student =
        matchInvoiceToStudent(
          li.alici,
          students
        )

      const base =
        li.total
          ? Math.round(
              (
                li.total /
                (1 + vatRate / 100)
              ) * 100
            ) / 100
          : 0

      const vat =
        li.total
          ? Math.round(
              (
                li.total -
                base
              ) * 100
            ) / 100
          : 0

      const invPeriod =
        (
          li.isoDate &&
          li.isoDate.length >= 7
        )
          ? li.isoDate.slice(0, 7)
          : period

      matched.push({
        uuid:
          `luca_${li.faturaNo || Date.now()}`,

        no:
          li.faturaNo,

        date:
          li.isoDate,

        period:
          invPeriod,

        taxId:
          student?.tax || '',

        buyer:
          li.alici,

        base,

        vat,

        total:
          li.total,

        type:
          'e-Arşiv',

        status:
          'Kesildi',

        studentId:
          student
            ? (student.id || student._id)
            : null,

        matchBy:
          'luca-extension'
      })

      if (
        student &&
        invPeriod === period
      ) {
        matchedCount++
      }
    }

    const updated =
      await AnaokuluSchool.findOne({
        tenant: tenantId
      })

    if (!updated) {
      throw new Error(
        'Okul kaydı bulunamadı'
      )
    }

    await updateStep(
      'Sonuçlar kaydediliyor…'
    )

    for (const inv of matched) {
      const idx =
        updated.invoices.findIndex(
          i => i.no === inv.no
        )

      if (idx >= 0) {
        updated.invoices[idx] = inv
      } else {
        updated.invoices.push(inv)
      }
    }

    for (const inv of updated.invoices) {
      if (
        inv.date &&
        inv.date.length >= 7
      ) {
        inv.period =
          inv.date.slice(0, 7)
      }
    }

    updated.checks =
      updated.checks || []

    updated.checks.push({
      period,
      at: Date.now(),
      found:
        lucaInvoices.length,
      matched:
        matchedCount
    })

    updated.markModified(
      'invoices'
    )

    await updated.save()

    const {
      settings,
      students: sts,
      collections,
      invoices,
      checks
    } = updated.toObject()

    await setLucaJob(jobId, {
      status: 'done',
      ok: true,
      found:
        lucaInvoices.length,
      matched:
        matchedCount,
      settings,
      students: sts,
      collections,
      invoices,
      checks,
      finishedAt:
        Date.now()
    })

    // 10 dakika sonra belleği temizle
    setTimeout(
      () => { void deleteLucaJob(jobId) },
      10 * 60 * 1000
    )
  } catch (err) {
    console.error(
      '[_runLucaJob] Hata:',
      err
    )

    await setLucaJob(jobId, {
      status: 'error',
      error:
        err?.message ||
        'Luca entegrasyon hatası',
      finishedAt:
        Date.now()
    })

    setTimeout(
      () => { void deleteLucaJob(jobId) },
      5 * 60 * 1000
    )
  }
}

export const updateAnaokuluStudent = async (req, res) => {
  try {
    const studentId = Number(req.params.id)
    const school = await AnaokuluSchool.findOne({
      tenant: req.tenant?._id
    })

    if (!school) return res.status(404).json({ error: 'Okul kaydı bulunamadı' })

    const student = school.students.find(item => item.id === studentId)
    if (!student) return res.status(404).json({ error: 'Öğrenci bulunamadı' })

    if (Array.isArray(req.body?.items)) student.items = req.body.items
    await school.save()

    res.json({ ok: true, student: student.toObject() })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Öğrenci güncellenemedi' })
  }
}

export const registerLucaDevice = async (req, res) => {
  try {
    const tenantId = getDeviceTenantId(req)
    if (!tenantId || !req.user?.id) return res.status(400).json({ error: 'Cihaz için tenant ve kullanıcı bilgisi gerekli.' })
    if (req.user.role === 'staff' && req.user.systemType !== 'anaokulu') {
      return res.status(403).json({ error: 'Bu kullanıcı Luca cihazı bağlayamaz.' })
    }

    const deviceId = String(req.body?.deviceId || '').trim()
    const deviceName = String(req.body?.deviceName || 'PenPOS Luca Cihazı').trim().slice(0, 80)
    if (!deviceId) return res.status(400).json({ error: 'Cihaz kimliği gerekli.' })

    const rawToken = createLucaDeviceToken()
    const tokenHash = hashLucaDeviceToken(rawToken)
    const device = await LucaExtensionDevice.findOneAndUpdate(
      { tenant: tenantId, deviceId },
      {
        $set: {
          user: req.user.id,
          deviceName: deviceName || 'PenPOS Luca Cihazı',
          tokenHash,
          status: 'online',
          lastSeen: new Date(),
          revokedAt: null
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean()

    return res.json({
      ok: true,
      device: {
        id: String(device._id),
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        status: device.status,
        lastSeen: device.lastSeen
      },
      deviceToken: rawToken
    })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Luca cihazı kaydedilemedi.' })
  }
}

export const heartbeatLucaDevice = async (req, res) => {
  const device = req.lucaDevice
  if (!device) return res.status(401).json({ error: 'Luca cihazı yetkisiz.' })
  return res.json({ ok: true, device: { deviceId: device.deviceId, deviceName: device.deviceName, status: 'online', lastSeen: new Date() } })
}

export const getLucaDeviceStatus = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  const tenantId = req.tenant?._id || req.tenant?.id
  if (!tenantId) return res.status(400).json({ error: 'Tenant bulunamadı.' })

  const activeThresholdMs = 15 * 1000
  const activeSince = new Date(Date.now() - activeThresholdMs)
  const devices = await LucaExtensionDevice.find({
    tenant: tenantId,
    status: { $ne: 'revoked' }
  }).sort({ lastSeen: -1 }).lean()

  const safeDevices = devices.map(device => ({
    deviceName: device.deviceName || 'PenPOS Luca Cihazı',
    status: device.lastSeen && new Date(device.lastSeen) >= activeSince ? 'online' : 'offline',
    lastSeen: device.lastSeen ? new Date(device.lastSeen).toISOString() : null
  }))

  return res.json({
    ok: true,
    active: safeDevices.some(device => device.status === 'online'),
    activeThresholdSeconds: activeThresholdMs / 1000,
    devices: safeDevices
  })
}

export const listLucaDeviceTasks = async (req, res) => {
  const device = req.lucaDevice
  if (!device) return res.status(401).json({ error: 'Luca cihazı yetkisiz.' })

  for (const [jobId, job] of await listLucaJobs()) {
    if (job.status !== 'running' || job.phase !== 'waiting_extension') continue
    if (job.assignedDeviceId) continue
    if (String(job.tenantId) !== String(device.tenant)) continue
    if (job.startedAt && Date.now() - job.startedAt > 5 * 60 * 1000) continue

    const assignedAt = Date.now()
    const claimed = await LucaJob.findOneAndUpdate(
      {
        jobId,
        'data.status': 'running',
        'data.phase': 'waiting_extension',
        'data.tenantId': String(device.tenant),
        'data.assignedDeviceId': { $exists: false }
      },
      {
        $set: {
          'data.assignedDeviceId': String(device._id),
          'data.assignedAt': assignedAt,
          'data.step': `${device.deviceName || 'Luca cihazı'} görevi aldı, Luca bağlantısı bekleniyor…`
        }
      },
      { new: true }
    ).lean()

    if (!claimed) continue

    lucaJobs.set(jobId, claimed.data)
    return res.json({
      ok: true,
      task: { jobId: claimed.jobId, extensionToken: claimed.data.extensionToken, period: claimed.data.period }
    })
  }

  return res.json({ ok: true, task: null })
}

export const revokeLucaDevice = async (req, res) => {
  const device = req.lucaDevice
  if (!device) return res.status(401).json({ error: 'Luca cihazı yetkisiz.' })
  await LucaExtensionDevice.updateOne(
    { _id: device._id },
    { $set: { status: 'revoked', revokedAt: new Date() } }
  )
  return res.json({ ok: true })
}