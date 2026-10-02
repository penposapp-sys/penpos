import { AnaokuluSchool } from '../models/AnaokuluSchool.js'
import LucaExtensionDevice from '../models/LucaExtensionDevice.js'
import LucaJob from '../models/LucaJob.js'
import { findLucaDeviceByToken, getLucaDeviceToken, hashLucaDeviceToken } from '../middlewares/requireLucaDevice.js'
import { renderAnaokuluInvoicePdf } from '../services/anaokuluInvoicePdfService.js'
import { getPlanGrossTotal, getPlanInstallmentGrossAmount, validateAnaokuluPlanSchedules } from '../utils/anaokuluPlanValidation.js'
import crypto from 'crypto'

// In-memory job store (process restart’ta sıfırlanır — kısa süreli işler için yeterli)
const lucaJobs = new Map()

// ============================================================
// LUCA FATURA YAŞAM DÖNGÜSÜ DURUMLARI
// ============================================================
// DRAFT_MISSING_STATUS: "Luca'da bu taslak artık yok" (kullanıcı sildi /
// taşıdı). Gönderim yapılmadı ama bu bir GÖNDERİM HATASI da değil.
// PenPOS'taki invoiceNo ve draft kilidi bu durumda temizlenir; satır yeniden
// "Fatura Kes"e döner. Kalıcı hata ("failed") olarak tutulsaydı satır hiçbir
// şekilde toparlanamazdı; kalıcı başarı ("sent") olarak tutulsaydı yanlışlıkla
// "gönderilmiş" görünürdü.
export const DRAFT_MISSING_STATUS = 'draft_missing'

// Gelen sonuç durumlarının güvenilir kümesi: listede olmayan bir durum
// yazılamaz (istemci rastgele bir değer gönderemez).
const KNOWN_RESULT_STATUSES = [
  'draft_created',
  'awaiting_approval',
  'sent',
  'checking',
  'verified',
  'failed',
  'cancelled',
  DRAFT_MISSING_STATUS
]

// Görevin "done" sayılması için bir kalemin ulaşması gereken terminal durumlar.
const TERMINAL_RESULT_STATUSES = [
  'failed',
  'cancelled',
  'draft_created',
  'awaiting_approval',
  'sent',
  'verified',
  DRAFT_MISSING_STATUS
]

// Bir görevin "aynı iş" olduğunu belirleyen anahtar: görev türü + satır
// (sourceKey) + fatura numarası. Numara dolmuşsa numara da anahtara girer; böylece
// ESKİ bir numara ile yeni bir görev birbirine karışmaz.
const createJobKey = (action, sourceKey, invoiceNo = '') => {
  const number = String(invoiceNo || '').trim()
  return `${action}|${String(sourceKey || '').trim()}|${number}`
}

// Bekleyen bir görev gerçekten engelliyorsa o iş TAZE olmalıdır:
//   * extension görevi saniyeler içinde devralır (poll 5 sn) -> 90 sn
//   * devralınmış ama HİÇ sonuç üretmemiş iş 5 dakika sonra ölüdür
//     (Luca sekmesi kapandı / extension çöktü / akış başlamadı)
// Bunun ötesindeki her iş ÖLÜDÜR ve satırı kilitlemez. Aksi halde 32
// öğrencilik bir toplu kesimde yarıda kesilip kaldığında, o satırlar
// SONSUZA kadar "bekleyen görev var" uyarısı verir ve kullanıcı hiçbir
// Luca işlemi yapmamış olsa bile hiçbir şey deneyemez.
const LUCA_UNCLAIMED_JOB_STALE_MS = 90 * 1000
const LUCA_CLAIMED_JOB_STALE_MS = 5 * 60 * 1000

const isLucaJobStale = (job, now = Date.now()) => {
  if (job?.status !== 'running') return false
  if (!['create', 'send'].includes(job?.kind)) return false

  if (job?.phase === 'waiting_extension') {
    return now - Number(job?.startedAt || 0) > LUCA_UNCLAIMED_JOB_STALE_MS
  }

  if (job?.phase === 'extension_claimed') {
    // Kısmi sonuç varsa iş hâlâ ilerliyor olabilir; yalnızca HİÇ sonuç
    // yoksa ölü sayılır.
    if (Array.isArray(job?.results) && job.results.length) return false
    return now - Number(job?.claimedAt || job?.startedAt || 0) > LUCA_CLAIMED_JOB_STALE_MS
  }

  return false
}

const listActiveJobKeys = async () => {
  const keys = new Set()
  const now = Date.now()
  const staleJobIds = []

  for (const [jobId, job] of lucaJobs.entries()) {
    if (job?.status !== 'running') continue
    if (!['create', 'send'].includes(job?.kind)) continue

    if (isLucaJobStale(job, now)) {
      staleJobIds.push(jobId)
      continue
    }

    for (const item of job.items || []) {
      keys.add(createJobKey(job.kind, item.sourceKey, item.invoiceNo))
      // Numarasız create görevleri de satır bazında korunur.
      if (!String(item.invoiceNo || '').trim()) keys.add(createJobKey(job.kind, item.sourceKey, ''))
    }
  }

  // Ölü işler "terk edilmiş" olarak kapatılır. Aksi halde istemcinin
  // yoklama döngüsü sonsuza kadar sürer ve sayfa hiçbir geri bildirim
  // vermez; kullanıcı işin ne olduğunu asla öğrenemez.
  for (const staleId of staleJobIds) {
    const staleJob = lucaJobs.get(staleId)

    try {
      await setLucaJob(staleId, {
        ...staleJob,
        status: 'error',
        phase: 'completed',
        error: 'Luca görevi zamanında tamamlanamadı (Chrome Extension görevi alamadı). Lütfen tekrar deneyin.',
        finishedAt: Date.now()
      })
      console.warn(
        `[Luca] ${staleId} numaralı ölü görev kapatıldı (${staleJob?.phase || 'bilinmeyen'}); satırlar yeniden deneyebilir.`
      )
    } catch (error) {
      lucaJobs.delete(staleId)
    }
  }

  return keys
}

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
  validateAnaokuluPlanSchedules(students)
  const plans = new Map()
  const previousPlans = new Map()
  previousStudents.forEach(student => {
    ;(student.items || []).forEach(plan => {
      previousPlans.set(`${student.id}::${String(plan.name || '').trim().toLowerCase()}`, {
        total: roundMoney(getPlanGrossTotal(plan)),
        downPayment: roundMoney(plan.downPayment),
        installments: Math.max(1, Number(plan.installments) || 1),
        installmentSchedule: JSON.stringify(plan.installmentSchedule || [])
      })
    })
  })
  students.forEach(student => {
    ;(student.items || []).forEach(plan => {
      const key = `${student.id}::${String(plan.name || '').trim().toLowerCase()}`
      const currentPlan = {
        total: roundMoney(getPlanGrossTotal(plan)),
        downPayment: roundMoney(plan.downPayment),
        installments: Math.max(1, Number(plan.installments) || 1),
        installmentSchedule: JSON.stringify(plan.installmentSchedule || [])
      }
      const previousPlan = previousPlans.get(key)
      plans.set(key, {
        ...currentPlan,
        source: plan,
        scheduleChanged: Boolean(previousPlan && (
          previousPlan.total !== currentPlan.total ||
          previousPlan.downPayment !== currentPlan.downPayment ||
          previousPlan.installments !== currentPlan.installments ||
          previousPlan.installmentSchedule !== currentPlan.installmentSchedule
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
      : getPlanInstallmentGrossAmount(plan.source, installmentNo)
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
      studentCount: Array.isArray(students) ? students.length : 0,
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
    const invoicesChanged = JSON.stringify(reqInvoices || []) !== JSON.stringify(school?.invoices || [])
    const checksChanged = JSON.stringify(reqChecks || []) !== JSON.stringify(school?.checks || [])

    if (req.user?.role === 'superadmin') {
      if (studentsChanged || collectionsChanged || invoicesChanged || checksChanged) {
        return res.status(403).json({
          error: 'Süper Admin okul içinde öğrenci, taksit, tahsilat veya fatura kaydı değiştiremez.'
        })
      }
    }

    if (studentsChanged || collectionsChanged) {
      try {
        validateAnaokuluCollections(reqStudents || [], reqCollections || [], school?.students || [])
      } catch (validationError) {
        return res.status(400).json({
          error: validationError.message || 'Geçersiz tahsilat tutarı.'
        })
      }
    }

    if (collectionsChanged && school) {
      const lockedDates = Array.isArray(school.settings?.lockedDates) ? school.settings.lockedDates : []
      if (lockedDates.length > 0) {
        const oldCols = Array.isArray(school.collections) ? school.collections : []
        const newCols = Array.isArray(reqCollections) ? reqCollections : []

        // Kilitli güne yeni tahsilat eklenmiş mi?
        const oldIds = new Set(oldCols.map(c => String(c.id || c._id)))
        for (const nc of newCols) {
          if (!oldIds.has(String(nc.id || nc._id))) {
            if (nc.date && lockedDates.includes(nc.date)) {
              return res.status(400).json({
                error: `${nc.date} tarihi kilitlidir. Kilitli güne tahsilat eklenemez.`
              })
            }
          }
        }

        // Kilitli günden tahsilat silinmiş mi?
        const newIds = new Set(newCols.map(c => String(c.id || c._id)))
        for (const oc of oldCols) {
          if (!newIds.has(String(oc.id || oc._id))) {
            if (oc.date && lockedDates.includes(oc.date)) {
              return res.status(400).json({
                error: `${oc.date} tarihi kilitlidir. Kilitli güne ait tahsilat silinemez.`
              })
            }
          }
        }
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

export const resetAnaokuluSchool = async (req, res) => {
  try {
    const tenantId = req.tenant?._id || req.tenant?.id

    if (!tenantId) {
      return res.status(400).json({ error: 'Lütfen işlem yapacağınız bir anaokulu seçiniz.' })
    }

    if (req.user?.role === 'superadmin' || req.user?.role === 'platform_admin') {
      return res.status(403).json({ error: 'Bu işlem okul yöneticisi hesabından yapılmalıdır.' })
    }

    await AnaokuluSchool.deleteOne({ tenant: tenantId })

    res.json({ ok: true, message: 'Anaokulu verileri kalıcı olarak silindi.' })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Veriler silinemedi.' })
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
    if (req.user?.role === 'superadmin') {
      return res.status(403).json({ error: 'Süper Admin okul öğrencilerini silemez.' })
    }
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
    if (req.user?.role === 'superadmin') {
      return res.status(403).json({ error: 'Süper Admin tahsilat silemez veya değiştiremez.' })
    }
    const cid = Number(req.params.id)

    const school = await AnaokuluSchool.findOne({
      tenant: req.tenant?._id
    })

    if (!school) {
      return res.status(404).json({
        error: 'Okul kaydı bulunamadı'
      })
    }

    const col = (school.collections || []).find(c => Number(c.id) === cid || String(c._id) === String(req.params.id))
    const lockedDates = Array.isArray(school.settings?.lockedDates) ? school.settings.lockedDates : []
    if (col && col.date && lockedDates.includes(col.date)) {
      return res.status(400).json({
        error: `${col.date} tarihi kilitlidir. Kilitli güne ait tahsilat silinemez.`
      })
    }

    school.collections = school.collections.filter(
      c => Number(c.id) !== cid && String(c._id) !== String(req.params.id)
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
    if (req.user?.role === 'superadmin') {
      return res.status(403).json({ error: 'Süper Admin fatura silemez veya iptal edemez.' })
    }
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

const createInvoiceSourceKey = (item = {}) => String(
  item.sourceKey ||
  `${item.studentId || ''}:${item.planName || ''}:${item.installmentNo || 0}:${item.period || ''}`
).trim()

const createLucaInvoiceToken = () => crypto.randomBytes(32).toString('hex')

// ============================================================
// "Maximum call stack size exceeded" — KÖK NEDEN DÜZELTMESİ
// ============================================================
// Luca arşivindeki ham fatura yükü SINIRSIZ derinlikte iç içe diziler
// ("items" -> "items" -> ...) taşıyabilir. (Eski content.js
// normalizeLineItems'in iç içe dizilerde ÖZYİNELİMELİ yazılması bunun
// doğrudan kanıtıdır.)
//
// Bu ham yük iki yerde sorun çıkarıyordu:
//   1) job'a `extensionInvoices` olarak BÜTÜNÜYLE yazılıyordu,
//   2) checkLucaJobStatus her sorguda (istemci 1.5 sn'de bir soruyor) işin
//      TAMAMINI res.json() ile serileştiriyordu.
// V8'in JSON.stringify'i ÖZYİNELİ çalışır; ~4781 derinlikte
// "RangeError: Maximum call stack size exceeded" fırlatır ve bu hat
// (handler'da try/catch YOK olduğu için) Express hata katmanından
// { error: err.message } olarak istemciye ulaşıp ekranda görünüyordu.
//
// DÜZELTME: ham yük göreve yazılmaz. Yerine SINIRLI, düz (derinlik 1) bir
// kayıt saklanır: fatura başlık alanları + düzleştirilmiş kalemler.
// Düzleştirme BİLİNÇLİ olarak ÖZYİNELİMSİZ (açık yığın) yazılmıştır; aynı
// şekilde derin veri tekrar yığın taşması üretmez. Bu gizleme değil, kök
// nedeni (sınırsız derinliğin kalıcılaştırılması ve tekrarlı serileştirilmesi)
// ortadan kaldırır.
const LUCA_RAW_FIELD_LIMIT = 400
const LUCA_RAW_STRING_LIMIT = 2000
// Lucanın kendi iç içe dizi derinliği pratikte 4-6'dır (ör. kalem -> alt
// kalem -> vergi satırı). 32 derinlik hem gerçek veriyi tamamen kapsar hem
// de yığın taşımasının (~4781) çok altında kalır.
const LUCA_RAW_MAX_DEPTH = 32
const LUCA_RAW_MAX_ITEMS = 2000

// Derinlikteki ham kalem ağacını AÇIK YIĞINLA düzleştirir. Özyineleme
// yoktur, dolayısıyla derinlik ne olursa olsun yığın taşmaz.
//
// İki ayrı sınır vardır ve BİRLİKTE çalışırlar:
//   * maxDepth  -> kalemlerin toplanacağı azami iç içe geçme derinliği.
//   * maxItems  -> yürüyüşün toplam düğüm bütçesi. Hem patolojik girdiyi
//                  keser hem de ÇEVRİMSEL (cyclic) nesne ağacında sonsuz
//                  döngüyü engeller.
//
// ÖNEMLİ: Lucada iç içe geçme DİZİ İÇİNDE DEĞİL, NESNE ÖZELLİĞİ
// ÜZERİNDEN olur: items -> { items: [ ... ] } -> { items: [ ... ] }.
// Bu yüzden yürüyüş hem dizileri hem de nesnelerin DİZİ TUTAN
// ÖZELLİKLERİNİ takip eder. (Eski, özyinelemeli content.js
// normalizeLineItems'in iç içe dizilerde yazılması bu biçimi kanıtlar.)
const flattenLucaRawArray = (input, { maxDepth = LUCA_RAW_MAX_DEPTH, maxItems = LUCA_RAW_MAX_ITEMS } = {}) => {
  const out = []
  const stack = [{ value: input, depth: 0 }]
  const seen = new Set()
  let visited = 0

  while (stack.length) {
    // Düğüm bütçesi: sonsuz büyüyen girdide yürüyüşü keser.
    if (++visited > maxItems) break

    const { value, depth } = stack.pop()
    if (!value || typeof value !== 'object') continue

    // Aynı nesne iki kez gezilmez: hem çevrimsel ağaçta sonsuz döngüyü
    // keser hem de paylaşılan (DAG) bir kalemin kalem listesinde İKİ KEZ
    // görünmesini engeller.
    if (seen.has(value)) continue
    seen.add(value)

    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i -= 1) {
        stack.push({ value: value[i], depth: depth + 1 })
      }
      continue
    }

    // Nesne: hem bir kalem olabilir, hem de içinde dizi taşıyan bir
    // sarmalayıcı. Kalem olarak toplanır VE içindeki dizilere de inilir.
    if (depth <= maxDepth) out.push(value)

    for (const key of Object.keys(value)) {
      const nested = value[key]
      if (Array.isArray(nested)) stack.push({ value: nested, depth: depth + 1 })
    }
  }

  return out
}

// Ham nesneden YALNIZCA ilkel (ilkel olmayan hiçbir şey içermeyen) alanları
// kopyalar. Bu kopya çevrimsel (cyclic) olamaz ve iç içe olamaz; dolayısıyla
// JSON.stringify daima güvenlidir.
const copyLucaRawScalars = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null

  const out = {}
  let count = 0

  for (const [key, value] of Object.entries(obj)) {
    if (count >= LUCA_RAW_FIELD_LIMIT) break
    if (value === null || value === undefined) continue
    if (typeof value === 'string') {
      out[key] = value.slice(0, LUCA_RAW_STRING_LIMIT)
      count += 1
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
      count += 1
    }
  }

  return Object.keys(out).length ? out : null
}

// İç içe nesneleri SINIRLI derinlikte düzleştirir (özyineleme yok).
const sanitizeLucaNestedObject = (value, depth = 0) => {
  if (depth > 4) return null
  if (Array.isArray(value)) {
    // Ham dizi NESNELERİ DÖNDÜRMEZ; her öğe ilkel alanlara indirgenir.
    // (Ham nesne döndürmek, çevrimsel bir yükte çevrimi çıktıya taşırdı.)
    return flattenLucaRawArray(value, { maxDepth: 2, maxItems: 20 })
      .map(copyLucaRawScalars)
      .filter(Boolean)
      .slice(0, 20)
  }
  if (!value || typeof value !== 'object') return null

  const out = {}
  for (const [key, nested] of Object.entries(value).slice(0, LUCA_RAW_FIELD_LIMIT)) {
    if (nested === null || nested === undefined) continue
    if (typeof nested === 'string') {
      out[key] = nested.slice(0, LUCA_RAW_STRING_LIMIT)
      continue
    }
    if (typeof nested === 'number' || typeof nested === 'boolean') {
      out[key] = nested
      continue
    }
    if (typeof nested === 'object') {
      const child = sanitizeLucaNestedObject(nested, depth + 1)
      if (child) out[key] = child
    }
  }
  return out
}

// Tek bir ham kalemi düz, sınırlı alanlara indirger.
const normalizeLucaRawLineItem = (item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null

  const pick = (...names) => {
    for (const name of names) {
      const value = item[name]
      if (typeof value === 'string' || typeof value === 'number') return value
    }
    return ''
  }

  const description = String(pick('description', 'name', 'productName', 'malHizmet', 'aciklama')).trim()
  const quantity = Number(pick('quantity', 'qty', 'miktar')) || 1
  const unitPrice = Number(pick('unitPrice', 'birimFiyat', 'price', 'fiyat')) || 0
  const lineTotal = Number(pick('lineTotal', 'toplam', 'total')) || quantity * unitPrice

  if (!description && !unitPrice && !lineTotal) return null

  return {
    description,
    quantity,
    unit: String(pick('unit', 'birim')).trim(),
    unitPrice,
    discountRate: Number(pick('discountRate', 'indirimOrani')) || 0,
    discountAmount: Number(pick('discountAmount', 'indirimTutari')) || 0,
    vatRate: Number(pick('vatRate', 'kdvOrani', 'taxRate', 'vat')) || 0,
    vatAmount: Number(pick('vatAmount', 'kdvTutari', 'taxAmount')) || 0,
    lineTotal
  }
}

// Ham Luca faturasını sınırlı, düz bir kayda indirger.
const sanitizeLucaInvoice = (li) => {
  if (!li || typeof li !== 'object') return null

  const source = Array.isArray(li.items)
    ? li.items
    : Array.isArray(li.lineItems)
      ? li.lineItems
      : Array.isArray(li.malHizmetler)
        ? li.malHizmetler
        : []

  const items = flattenLucaRawArray(source)
    .map(normalizeLucaRawLineItem)
    .filter(Boolean)

  // Yalnızca skaler/seri alanlar kopyalanır. `...li` KULLANILMAZ: ham nesne
  // her alanıyla (iç içe diziler dâhil) kalıcılaştırılır ve iş bitince tekrar
  // serileştirildiğinde yığın taşması doğar.
  const scalar = {}
  for (const [key, value] of Object.entries(li)) {
    if (value === null || value === undefined) continue
    if (typeof value === 'function' || typeof value === 'symbol') continue
    if (typeof value === 'string') {
      scalar[key] = value.slice(0, LUCA_RAW_STRING_LIMIT)
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      scalar[key] = value
      continue
    }
    if (Array.isArray(value)) {
      // Ham dizi: DÜZLEŞTİRİLİP kalem olarak taşınır, kayıtta dizi bırakılmaz.
      continue
    }
    if (typeof value === 'object') {
      const nested = sanitizeLucaNestedObject(value)
      if (nested) scalar[key] = nested
    }
  }

  return { ...scalar, items }
}

// Gelen ham fatura listesini sınırlar. Sınır dışı faturalar ATILIR (sessizce
// kırpılmaz; adet `sanitizeLucaInvoice` sınırı içinde zaten güvenlidir).
// Listede de bir adet sınırı vardır: görev belgesi Mongo'ya yazıldığı için
// liste ne kadar büyükse o kadar çok yer (ve serileştirme işi) gerekir.
const LUCA_RAW_MAX_INVOICES = 2000
const sanitizeLucaInvoiceList = (invoices) => {
  const source = Array.isArray(invoices) ? invoices : []
  return source
    .slice(0, LUCA_RAW_MAX_INVOICES)
    .map(sanitizeLucaInvoice)
    .filter(Boolean)
}

// Durum sorgusunun done dalında dönen DİĞER alanlar
// (settings/students/collections/checks/results): düzeltme öncesi yazılmış
// derin bir ağaç BURALARDA da olabilir. Yapıyı KORUYARAK yalnızca derinlik
// sınırlanır; düz veri birebir aynı döner (kesme/budama yok).
//
// ÖNEMLİ: Bu fonksiyon AÇIK YIĞINLA çalışır, ÖZYİNELEME YOKTUR.
// Özyinelemeli sürüm derin yükte kendisi "Maximum call stack size
// exceeded" üretiyordu (sınır kontrolüne hiç ulaşamadan).
const LUCA_STATUS_MAX_DEPTH = 6
const capLucaStatusDepth = (value, maxDepth = LUCA_STATUS_MAX_DEPTH) => {
  const capLeaf = (v) => {
    if (v === null || v === undefined) return { leaf: true, out: v }
    const type = typeof v
    if (type === 'string' || type === 'number' || type === 'boolean') return { leaf: true, out: v }
    if (type !== 'object') return { leaf: true, out: undefined }
    if (v instanceof Date) return { leaf: true, out: v }
    // ObjectId ve benzeri BSON skalerleri: JSON çıktısı hex dizgidir.
    if (typeof v?.toHexString === 'function') {
      try {
        return { leaf: true, out: v.toHexString() }
      } catch {
        return { leaf: true, out: String(v) }
      }
    }
    return { leaf: false }
  }

  const first = capLeaf(value)
  if (first.leaf) return first.out

  const root = Array.isArray(value) ? [] : {}
  const stack = [{ src: value, dst: root, depth: 0, entries: null, index: 0, isArray: false }]

  while (stack.length) {
    const frame = stack[stack.length - 1]

    if (!frame.entries) {
      if (Array.isArray(frame.src)) {
        frame.entries = frame.src.slice(0, LUCA_RAW_MAX_ITEMS).map((item, i) => [i, item])
        frame.isArray = true
      } else {
        frame.entries = Object.entries(frame.src).slice(0, LUCA_RAW_FIELD_LIMIT)
        frame.isArray = false
      }
      frame.index = 0
    }

    if (frame.index >= frame.entries.length) {
      stack.pop()
      continue
    }

    const [key, nested] = frame.entries[frame.index]
    frame.index += 1

    const capped = capLeaf(nested)
    if (capped.leaf) {
      if (capped.out === undefined) {
        // JSON anlambilimi: dizideki tanımsız değer null olur,
        // nesnede anahtar düşer.
        if (frame.isArray) frame.dst.push(null)
      } else if (frame.isArray) {
        frame.dst.push(capped.out)
      } else {
        frame.dst[key] = capped.out
      }
      continue
    }

    if (frame.depth + 1 > maxDepth) {
      if (frame.isArray) frame.dst.push(null)
      continue
    }

    const child = Array.isArray(nested) ? [] : {}
    if (frame.isArray) frame.dst.push(child)
    else frame.dst[key] = child
    stack.push({ src: nested, dst: child, depth: frame.depth + 1, entries: null, index: 0, isArray: false })
  }

  return root
}

// Okul fatura kaydının done-yükü izdüşümü: yalnızca ilkel alanlar + düz
// kalemler + sınırlı iç içe nesneler (salt okuma; veritabanına yazılmaz).
const sanitizeStatusInvoice = (inv) => {
  if (!inv || typeof inv !== 'object' || Array.isArray(inv)) return null

  const out = {}

  for (const [key, value] of Object.entries(inv)) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string') {
      out[key] = value.slice(0, LUCA_RAW_STRING_LIMIT)
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
      continue
    }
    if (Array.isArray(value)) {
      // Kalem dizileri düz, ilkel kalemlere indirgenir; eski derin `items`
      // ağaçları burada budanır. Kalem olmayan diziler taşınmaz.
      if (key === 'lineItems' || key === 'items') {
        out[key] = value
          .map(normalizeLucaRawLineItem)
          .filter(Boolean)
          .slice(0, LUCA_RAW_MAX_ITEMS)
      }
      continue
    }
    if (typeof value === 'object') {
      const nested = sanitizeLucaNestedObject(value)
      if (nested) out[key] = nested
    }
  }

  return out
}

export const createLucaInvoiceJob = async (req, res) => {
  try {
    const tenantId = req.tenant?._id || req.tenant?.id
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    const action = req.body?.action === 'send' ? 'send' : 'create'
    if (!tenantId || items.length === 0) {
      return res.status(400).json({ error: 'En az bir fatura kaydı gerekli.' })
    }

    const school = await AnaokuluSchool.findOne({ tenant: tenantId }).lean()
    if (!school) return res.status(404).json({ error: 'Okul kaydı bulunamadı.' })

    const existing = new Map(
      (school.invoices || []).map(invoice => [String(invoice.sourceKey || ''), invoice])
    )
    const configuredMatchBy = school.settings?.invoiceCustomerMatchBy || school.settings?.matchBy || 'student'
    const normalizeCreateName = value => String(value || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'i')
      .replace(/[^a-z0-9çğıöşü ]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const normalizeCreateTax = value => String(value || '').replace(/\D/g, '')
    const accepted = []
    const skipped = []
    // Gönderilemeyen/kullanılamaz taslak kayıtlarının silineceği indeksler.
    // Kayıt SİLMEK önemlidir: yalnızca durum değiştirmek yetmez, çünkü
    // frontend kaydı yeniden yüklediğinde (sayfa yenileme) eski invoiceNo ve
    // draft kilidi tekrar "Faturayı Onayla" durumunu üretir.
    const cleanedInvoices = []
    // Halen çalışan görevlerin (satır, fatura numarası) anahtarları.
    const activeJobKeys = await listActiveJobKeys()
    const allowedInvoiceItems = new Set(['EĞİTİM', 'KIRTASİYE', 'YEMEK', 'SERVİS', 'ATÖLYE'])
    for (const item of items) {
      const sourceKey = createInvoiceSourceKey(item)
      if (!allowedInvoiceItems.has(String(item.invoiceItem || item.productName || '').trim())) {
        skipped.push({ sourceKey, status: 'unmatched', reason: 'Geçerli bir Fatura Kalemi seçilmedi.' })
        continue
      }
      if (configuredMatchBy === 'student' || configuredMatchBy === 'student_tax') {
        const sourceStudent = (school.students || []).find(student => String(student.id || student._id) === String(item.studentId))
        const nameMatches = sourceStudent && normalizeCreateName(sourceStudent.name) === normalizeCreateName(item.studentName)
        const taxMatches = sourceStudent && normalizeCreateTax(sourceStudent.tax) && normalizeCreateTax(sourceStudent.tax) === normalizeCreateTax(item.taxId)
        if (!nameMatches || (configuredMatchBy === 'student_tax' && !taxMatches)) {
          skipped.push({ sourceKey, status: 'unmatched', reason: 'Öğrenci adı ve TC Kimlik No tam eşleşmedi.' })
          continue
        }
      }
      if (configuredMatchBy === 'tax') {
        const sourceStudent = (school.students || []).find(student => String(student.id || student._id) === String(item.studentId))
        if (!sourceStudent || !normalizeCreateTax(sourceStudent.tax) || normalizeCreateTax(sourceStudent.tax) !== normalizeCreateTax(item.taxId)) {
          skipped.push({ sourceKey, status: 'unmatched', reason: 'TC Kimlik No tam eşleşmedi.' })
          continue
        }
      }
      const previous = existing.get(sourceKey) || (school.invoices || []).find(invoice =>
        !invoice.sourceKey &&
        String(invoice.studentId || '') === String(item.studentId || '') &&
        Number(invoice.installmentNo || 0) === Number(item.installmentNo || 0) &&
        String(invoice.period || '') === String(item.period || '') &&
        String(invoice.planName || '').trim().toLowerCase() === String(item.planName || '').trim().toLowerCase()
      )
      const blockedStatuses = action === 'send'
        ? ['sent', 'checking', 'verified']
        : []
      // Bir kaydın satırı kilitleyip kilitlemeyeceğine NUMARA karar verir.
      //
      // Numara YOKSA kayıt ölüdür: ne "Faturayı Gör" gösterilebilir, ne
      // Luca'da doğrulanabilir, ne de "Faturayı Onayla" yapılabilir.
      // Frontend de böyle bir satırı "Fatura Kes" olarak gösterir. Backend
      // ise "verified" deyip satırı kilitlerse iki taraf ÇELİŞİR ve o
      // öğrenci için hiçbir zaman yeni taslak kesilemez. Bu yüzden numarasız
      // kayıt ASLA kilitlemez; aşağıda temizlenir.
      //
      // lifecycleStatus BOŞ olan eski kayıtlar (alan eklendikten önce
      // yazılmış) için de numara varsa 'verified' kabul edilir: mükerrer
      // kesim koruması bozulmamalıdır.
      const previousHasNo = !!previous && !String(previous.no || '').trim()
      // Gönderimde aranacak numara: önce PenPOS kaydı, yoksa frontend'in
      // bildirdiği numara. Kayıt bozulmuş/eksik olabilir; numara yine de
      // vardır ve fatura staging listesinde duruyor olabilir. Bu yüzden
      // görev reddedilmez: Luca açılır ve GERÇEKTEN kontrol edilir.
      const sendableNo = String(previous?.no || item.invoiceNo || item.no || '').trim()
      const previousStatus = previous?.lifecycleStatus || (previousHasNo ? '' : 'verified')
      if (previous && !previousHasNo && blockedStatuses.includes(previousStatus)) {
        skipped.push({ sourceKey, status: previousStatus, invoiceNo: previous.no || '', reason: `Bu satır zaten "${previousStatus}" aşamasında; yeniden işleme alınamaz.` })
        continue
      }
      // ÖLÜ kayıt: numarasız kayıt (lifecycleStatus 'verified'/'sent' olsa
      // bile). Satır kullanılabilir görünür ama kayıt hiçbir işe yaramaz;
      // birikirse "yeniden işleme alınamaz" kilidi doğurur. BOTH aksiyonlarda
      // geçerlidir.
      if (previousHasNo) {
        const deadIndex = school.invoices.findIndex(
          invoice => invoice.sourceKey && invoice.sourceKey === sourceKey
        )

        if (deadIndex >= 0) cleanedInvoices.push(deadIndex)
      }

      if (action === 'send' && !sendableNo) {
        // Ölü kayıt zaten yukarıda temizlendiği için burada ek iş yok; gönderim
        // için numara olmadan satır işlenemez (kayıt hiç yoksa da), kullanıcıya
        // net yol gösterilir.
        skipped.push({
          sourceKey,
          status: DRAFT_MISSING_STATUS,
          reason: 'Luca taslak faturası artık yok; PenPOS kaydı temizlendi, "Fatura Kes" ile yeni taslak oluşturulabilir.'
        })
        continue
      }

      // AYNI satır/numara için İKİNCİ bir görev çalışmasın. Extension'daki tek
      // global görev yuvası ikinci görevi zaten engelliyor; backend tarafında da
      // engellenirse görev sonradan yeniden başlatıldığında iki iş birbirinin
      // sonucunu ezmez.
      if (activeJobKeys.has(createJobKey(action, sourceKey, sendableNo))) {
        skipped.push({ sourceKey, status: 'job_running', reason: 'Bu fatura için zaten çalışan bir Luca görevi var.' })
        continue
      }
      accepted.push({
        ...item,
        sourceKey,
        lifecycleStatus: 'pending',
        ...(action === 'send' ? { invoiceNo: sendableNo } : {})
      })
    }

    // Kullanılamaz/eskimiş taslak kayıtları burada SİLİNİR. Silme yapılmazsa
    // frontend bir sonraki yüklemede (sayfa yenileme) eski invoiceNo'yu ve
    // draft kilidini tekrar görür ve satır kalıcı "Faturayı Onayla"da kalır.
    if (cleanedInvoices.length) {
      const drop = new Set(cleanedInvoices)

      for (let index = school.invoices.length - 1; index >= 0; index -= 1) {
        if (drop.has(index)) school.invoices.splice(index, 1)
      }

      await AnaokuluSchool.updateOne({ tenant: tenantId }, { $set: { invoices: school.invoices } })
      console.warn(
        `[Luca] ${cleanedInvoices.length} eskimiş taslak kaydı temizlendi; satırlar "Fatura Kes"e döndürülüyor.`
      )
    }

    if (accepted.length === 0) {
      return res.json({ ok: true, skipped, accepted: [], jobId: null })
    }

    const jobId = crypto.randomUUID()
    const extensionToken = createLucaInvoiceToken()
    await setLucaJob(jobId, {
      kind: action,
      status: 'running',
      phase: 'waiting_extension',
      tenantId: String(tenantId),
      source: 'manual_invoice_action',
      items: accepted,
      results: [],
      extensionToken,
      extensionTokenHash: crypto.createHash('sha256').update(extensionToken).digest('hex'),
      startedAt: Date.now(),
      step: 'Chrome Extension bağlantısı bekleniyor…'
    })

    return res.json({ ok: true, jobId, extensionToken, accepted, skipped })
  } catch (err) {
    console.error('[createLucaInvoiceJob] Hata:', err)
    return res.status(500).json({ error: err?.message || 'Luca fatura görevi oluşturulamadı.' })
  }
}

export const claimLucaInvoiceCreateTask = async (req, res) => {
  try {
    const job = await getLucaJob(req.params.jobId, { fresh: true })
    const token = String(req.body?.extensionToken || '').trim()
    if (!job || !['create', 'send'].includes(job.kind) || job.phase !== 'waiting_extension' || !token) {
      return res.status(409).json({ error: 'Luca oluşturma görevi hazır değil.' })
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    if (tokenHash !== job.extensionTokenHash) return res.status(401).json({ error: 'Geçersiz Extension görev anahtarı.' })

    const school = await AnaokuluSchool.findOne({ tenant: job.tenantId }).lean()
    const luca = school?.settings?.luca || {}
    const resultToken = createLucaInvoiceToken()
    await setLucaJob(req.params.jobId, {
      ...job,
      phase: 'extension_claimed',
      extensionToken: undefined,
      extensionTokenHash: undefined,
      resultTokenHash: crypto.createHash('sha256').update(resultToken).digest('hex'),
      claimedAt: Date.now(),
      step: 'Luca Hızlı Fatura ekranı hazırlanıyor…'
    })
    return res.json({
      ok: true,
      kind: 'create',
      jobId: req.params.jobId,
      resultToken,
      items: job.items,
      tckn: luca.tckn || luca.username || luca.customerNo || '',
      password: luca.password || ''
    })
  } catch (err) {
    console.error('[claimLucaInvoiceCreateTask] Hata:', err)
    return res.status(500).json({ error: err?.message || 'Luca oluşturma görevi alınamadı.' })
  }
}

export const submitLucaInvoiceCreateResult = async (req, res) => {
  try {
    const job = await getLucaJob(req.params.jobId, { fresh: true })
    const resultToken = String(req.body?.resultToken || '').trim()
    const results = Array.isArray(req.body?.results) ? req.body.results : []
    if (!job || !['create', 'send'].includes(job.kind) || job.phase !== 'extension_claimed' || !resultToken) {
      return res.status(409).json({ error: 'Luca oluşturma sonucu kabul edilemez.' })
    }
    const tokenHash = crypto.createHash('sha256').update(resultToken).digest('hex')
    if (tokenHash !== job.resultTokenHash) return res.status(401).json({ error: 'Geçersiz Luca sonuç anahtarı.' })

    const school = await AnaokuluSchool.findOne({ tenant: job.tenantId }).lean()
    if (!school) return res.status(404).json({ error: 'Okul kaydı bulunamadı.' })

    const invoices = [...(school.invoices || [])]
    // Satır bazlı Luca hata notları (sourceKey -> { message, at }). Fatura
    // kaydından BAĞIMSIZ tutulur: "Fatura Kes" hatasında henüz kayıt yoktur,
    // "Faturayı Onayla" hatasında ise kayıt vardır ve yaşam döngüsü bozulmadan
    // korunmalıdır (bkz. failed dalı).
    const lucaErrors = { ...(school.settings?.lucaErrors || {}) }
    const previousResults = Array.isArray(job.results) ? job.results : []
    const mergedResults = [...previousResults]
    // Bu durumlar GERI ALINAMAZ (terminal başarı). Sonradan gelen genel bir
    // hata bildirimi bunları EZMEMELİ; aksi halde "gönderilmiş" bir fatura
    // "başarısız"a dönüşür.
    const successStatuses = ['draft_created', 'awaiting_approval', 'sent', 'checking', 'verified', DRAFT_MISSING_STATUS]
    for (const result of results) {
      const sourceKey = createInvoiceSourceKey(result)
      const item = job.items.find(candidate => candidate.sourceKey === sourceKey) || result
      const lifecycleStatus = KNOWN_RESULT_STATUSES.includes(result.status)
        ? result.status
        : (job.kind === 'send' ? 'sent' : 'draft_created')

      // "LUCA TASLAĞI ARTIK YOK": Kullanıcı Luca'daki taslağı silmiş/taşımış.
      // Bu kalıcı bir gönderim hatası DEĞİLDİR ve "başarılı" da değildir.
      // PenPOS'taki eski invoiceNo + draft/awaiting_approval kilidi bu satır
      // için SİLİNİR; böylece satır "Fatura Kes"e döner ve yeniden taslak
      // kesilebilir. Fatura kaydı silinmezse satır kalıcı olarak "Faturayı
      // Onayla" durumunda kalır ve hiçbir şekilde toparlanamaz.
      if (lifecycleStatus === DRAFT_MISSING_STATUS) {
        const resultIndex = mergedResults.findIndex(current => current.sourceKey === sourceKey)
        if (resultIndex >= 0) {
          mergedResults[resultIndex] = {
            ...mergedResults[resultIndex],
            ...result,
            sourceKey,
            status: DRAFT_MISSING_STATUS,
            invoiceNo: '',
            no: ''
          }
        } else {
          mergedResults.push({
            ...result,
            sourceKey,
            status: DRAFT_MISSING_STATUS,
            invoiceNo: '',
            no: ''
          })
        }

        const staleIndex = invoices.findIndex(
          current => current.sourceKey && current.sourceKey === sourceKey
        )

        if (staleIndex >= 0) invoices.splice(staleIndex, 1)

        console.warn(
          `[Luca] Taslak artık yok, fatura kaydı temizlendi (${sourceKey}):`,
          result.error || ''
        )
        continue
      }

      // BAŞARISIZ / İPTAL sonuç: faturaya başarı bilgisi (invoiceNo, status=sent ...) YAZILMAZ.
      // Aksi halde başarısız bir create PenPOS'ta "Kesildi" gibi görünür ve satır
      // yeniden "Fatura Kes" ile denenemez hale gelir. Sonuç yalnızca job sonucu
      // olarak tutulur; böylece satır yeniden denenebilir kalır.
      if (lifecycleStatus === 'failed' || lifecycleStatus === 'cancelled') {
        const resultIndex = mergedResults.findIndex(current => current.sourceKey === sourceKey)
        const existingResult = resultIndex >= 0 ? mergedResults[resultIndex] : null
        // Aynı iş içinde daha önce BAŞARIYLA alınmış bir sonucu hata ile ezme.
        if (existingResult && successStatuses.includes(existingResult.status)) {
          continue
        }
        if (resultIndex >= 0) mergedResults[resultIndex] = { ...existingResult, ...result, sourceKey, status: lifecycleStatus }
        else mergedResults.push({ ...result, sourceKey, status: lifecycleStatus })

        // Hata metni KALICI olarak saklanır: kullanıcı sayfayı yenilediğinde
        // de "bu öğrenci neden kesilemedi?" notu satırın üstünde durmalıdır.
        //
        // DİKKAT: yaşam döngüsüye (lifecycleStatus) veya numaraya DOKUNULMAZ.
        // Gönderim hatasında satır "Faturayı Onayla"da kalmalıdır; 'failed'
        // yazılırsa satır "Fatura Kes"e düşer ve kullanıcı mükerrer taslak
        // keser. Not, fatura kaydından BAĞIMSIZ tutulur (create hatasında
        // zaten kayıt yoktur) ve yalnızca yeniden denendiğinde temizlenir.
        lucaErrors[sourceKey] = {
          message: String(result.error || existingResult?.error || '').slice(0, 600),
          at: Date.now()
        }

        continue
      }

      // Bu kalem BAŞARILI: varsa eski hata notu temizlenir (notun
      // gösterilmeye devam etmesi yanıltıcı olur).
      delete lucaErrors[sourceKey]

      const invoice = {
        uuid: result.uuid || `luca-create-${sourceKey}`,
        sourceKey,
        lifecycleStatus,
        no: String(result.invoiceNo || result.no || ''),
        ettn: String(result.ettn || ''),
        date: result.date || item.invoiceDate || item.period || '',
        period: item.period || '',
        taxId: item.taxId || '',
        buyer: item.buyer || item.recipientName || '',
        total: Number(result.total ?? item.amount ?? 0) || 0,
        grandTotal: Number(result.grandTotal ?? item.amount ?? 0) || 0,
        vatRate: Number(item.vatRate || 0) || 0,
        vatTotal: Number(result.vatTotal ?? item.vatAmount ?? 0) || 0,
        type: item.invoiceType === '2' ? 'e-Fatura' : 'e-Arşiv',
        studentId: item.studentId,
        installmentNo: item.installmentNo,
        planName: item.planName || '',
        note: item.notes || '',
        lineItems: item.lineItems || []
      }
      const index = invoices.findIndex(current => current.sourceKey && current.sourceKey === sourceKey)
      if (index >= 0) invoices[index] = { ...invoices[index], ...invoice }
      else invoices.push(invoice)
      const resultIndex = mergedResults.findIndex(current => current.sourceKey === sourceKey)
      if (resultIndex >= 0) mergedResults[resultIndex] = { ...mergedResults[resultIndex], ...result, status: lifecycleStatus }
      else mergedResults.push({ ...result, sourceKey, status: lifecycleStatus })
    }

    await AnaokuluSchool.updateOne({ tenant: job.tenantId }, { $set: { invoices } })
    // 'awaiting_approval' da terminal sonuctur: Fatura Kes -> "Fatura
    // Kaydedilecek" onaylandi, taslak olustu, gonderim YAPILMADI. Bu durum
    // listede TIKLANABILIR kalir (satirdaki "Faturayi Onayla" dugmesi).
    // DRAFT_MISSING_STATUS de terminaldir: Luca taslagi yok, satir resetlendi.
    const done = job.items.every(item => mergedResults.some(result => result.sourceKey === item.sourceKey && TERMINAL_RESULT_STATUSES.includes(result.status)))

    // Hata notları kalıcı yazılır (yenilemede kaybolmamalı).
    if (Object.keys(lucaErrors).length) {
      await AnaokuluSchool.updateOne(
        { tenant: job.tenantId },
        { $set: { 'settings.lucaErrors': lucaErrors } }
      )
    }

    await setLucaJob(req.params.jobId, {
      ...job,
      phase: done ? 'completed' : 'extension_claimed',
      status: done ? 'done' : 'running',
      results: mergedResults,
      resultTokenHash: done ? undefined : job.resultTokenHash,
      completedAt: done ? Date.now() : undefined,
      step: done ? 'Luca fatura görevi tamamlandı.' : `${mergedResults.length}/${job.items.length} Luca taslak faturası oluşturuldu.`
    })
    return res.json({ ok: true, jobId: req.params.jobId, accepted: results.length, results: mergedResults, done })
  } catch (err) {
    console.error('[submitLucaInvoiceCreateResult] Hata:', err)
    return res.status(500).json({ error: err?.message || 'Luca fatura sonucu kaydedilemedi.' })
  }
}

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

    const { period, targetInvoiceNo } = req.body || {}

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
      targetInvoiceNo: String(targetInvoiceNo || '').trim(),
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
//
// İstemci bu endpoint'i 1.5 sn'de bir sorgular. Gövde DEĞİŞKENİN TAMAMI
// (`extensionInvoices` = ham Luca yükü, `items` + `results` = tüm kalemler)
// dönmek, hem her sorguda gereksiz yüzlerce KB taşımak hem de
// JSON.stringify'in özyinelemeli çalışması nedeniyle derin veride
// "RangeError: Maximum call stack size exceeded" fırlatmak demektir.
// İstemcinin gerçekten kullandığı alanlar dönülür; kalemler yalnızca görev
// BİTTİĞİNDE (status === 'done') döner, çünkü o zaman gövde zaten düz ve
// sınırlıdır.
const LUCA_JOB_STATUS_FIELDS = [
  'jobId',
  'kind',
  'status',
  'phase',
  'step',
  'period',
  'source',
  'targetInvoiceNo',
  'startedAt',
  'claimedAt',
  'extensionSubmittedAt',
  'completedAt',
  'found',
  'matched',
  'reset',
  'resetRows',
  'checkedSourceKeys'
]

export const checkLucaJobStatus = async (req, res) => {
  try {
    const job = await getLucaJob(req.params.jobId)

    if (!job) {
      return res.status(404).json({
        error: 'Job bulunamadı veya süresi doldu.'
      })
    }

    const safeJob = {}
    for (const field of LUCA_JOB_STATUS_FIELDS) {
      if (job[field] !== undefined) safeJob[field] = job[field]
    }

    if (job.status === 'error') {
      // Gerçek hata metni kullanıcıya gösterilir. (Bu alan önceden de dönüyordu.)
      safeJob.error = job.error || 'Luca entegrasyon hatası'
    }

    // Ara sonuçlar (running dahil) sınırlı biçimde dönülür: uzun toplu
    // işlerde istemci biten kalemleri CANLI gösterir ("17/32 tamamlandı"),
    // kullanıcı işlemin sürdüğünü görür. Düz ve sınırlı kayıtlar olduğu
    // için serileştirme güvenlidir.
    if (Array.isArray(job.results) && job.results.length) {
      safeJob.results = capLucaStatusDepth(job.results)
    }

    if (job.status === 'done') {
      // Görev bittiğinde gövde zaten düz ve sınırlıdır; yalnızca o zaman
      // kalem sonuçları ve eşleştirilmiş okul durumu döner (istemci bunu
      // bir kez, işin sonunda kullanır).
      //
      // `invoices` okul koleksiyonunun TAMAMIDIR ve düzeltme öncesi yazılmış
      // derin ham ağaçlar içerebilir; SINIRLANARAK dönülür, aksi halde
      // `res.json` "Maximum call stack size exceeded" üretir.
      safeJob.ok = job.ok !== false
      safeJob.finishedAt = job.finishedAt
      safeJob.results = capLucaStatusDepth(Array.isArray(job.results) ? job.results : [])
      safeJob.settings = capLucaStatusDepth(job.settings)
      safeJob.students = capLucaStatusDepth(job.students)
      safeJob.collections = capLucaStatusDepth(job.collections)
      safeJob.invoices = Array.isArray(job.invoices)
        ? job.invoices.map(sanitizeStatusInvoice).filter(Boolean)
        : []
      safeJob.checks = capLucaStatusDepth(job.checks)
    }

    return res.json(safeJob)
  } catch (err) {
    console.error('[checkLucaJobStatus] Hata:', err)
    return res.status(500).json({ error: err?.message || 'Luca görev durumu okunamadı.' })
  }
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
      targetInvoiceNo: job.targetInvoiceNo || '',
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
// Extension görevi BAŞARISIZ olduğunda görevi "error" durumuna alır.
//
// Neden gerekli: submit-luca ULAŞILAMAZSA (content.js istisna attı,
// ağ hatası, 401/409/410 reddi) görev `extension_claimed` aşamasında
// kalıyordu. Frontend her yoklamada status:'running' görüp aynı adımı
// ("Chrome Extension görevi devraldı…") göstermeye devam ediyor ve
// "Faturaları Kontrol Et" butonu kalıcı kilitleniyordu. Kullanıcı hata
// mesajını Luca sekmesinin konsolunda olsa da PenPOS'ta göremiyordu.
//
// Endpoint JWT istemez; jobId + tek kullanımlık sonuç tokenı ile korunur
// (claim-luca / submit-luca ile aynı model).
export const failLucaExtensionTask = async (req, res) => {
  try {
    const jobId = String(req.params?.jobId || '').trim()
    const resultToken = String(req.body?.resultToken || '').trim()
    const error = String(req.body?.error || '').trim() || 'Luca görevi başarısız oldu.'

    if (!jobId || !resultToken) {
      return res.status(400).json({ error: 'Luca görev hata bildirimi eksik.' })
    }

    const job = await getLucaJob(jobId)
    if (!job) return res.status(404).json({ error: 'Job bulunamadı veya süresi doldu.' })

    // Yalnızca görevi fiilen devralmış extension hata bildirebilir.
    const expectedHash = String(job.resultTokenHash || '')
    const tokenHash = crypto.createHash('sha256').update(resultToken).digest('hex')

    if (!expectedHash || !crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(expectedHash))) {
      return res.status(401).json({ error: 'Geçersiz Luca sonuç anahtarı.' })
    }

    // Zaten tamamlanmış görev hata ile ezilmez.
    if (job.status === 'done' || job.status === 'error') {
      return res.json({ ok: true, alreadyFinished: true, status: job.status })
    }

    await setLucaJob(jobId, {
      ...job,
      status: 'error',
      ok: false,
      phase: 'extension_failed',
      step: error,
      error,
      failedAt: Date.now(),
      resultTokenHash: undefined,
      finishedAt: Date.now()
    })

    console.warn(`[Luca Kontrol] Görev başarısız: ${error}`)

    return res.json({ ok: true, jobId, status: 'error' })
  } catch (err) {
    console.error('[failLucaExtensionTask] Hata:', err)
    return res.status(500).json({ error: err?.message || 'Luca görev hatası kaydedilemedi.' })
  }
}

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

    // Ham Luca yükü SINIRSIZ derinlikte iç içe diziler taşıyabilir. Göreve
    // yazılan veri SINIRLANIR: aksi halde her durum sorgusunda yeniden
    // serileştirilip "Maximum call stack size exceeded" üretirdi.
    const safeInvoices = sanitizeLucaInvoiceList(invoices)

    // Sonuç tokenını tek kullanımlık hale getir.
    await setLucaJob(jobId, {
      ...job,
      phase: 'processing_invoices',
      step:
        `${safeInvoices.length} Luca faturası alındı, PenPOS eşleştirmesi yapılıyor…`,
      resultTokenHash: undefined,
      extensionInvoices: safeInvoices,
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
      safeInvoices
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


// Mongoose belgesinden GÜVENLİ alan okuma. Kirlenmiş (döngüsel iç yapılı)
// bir kayıtta getter SONSUZ ÖZYİNELEMEYE girer (Document.get ↔
// EmbeddedDocument.get) ve "Maximum call stack size exceeded" fırlatır.
// Okunamayan kayıt için undefined döner; çağıran kaydı temizler.
const readLucaRecordField = (record, key) => {
  try {
    return record?.[key]
  } catch {
    return undefined
  }
}

// Mongoose belgesini DÜZ nesneye çevirir. `{...subdoc}` YAYMASI YASAK:
// subdoc'un `$__`, `_doc`, `$__parent` içleri kopyalanır (döngüsel!),
// veri kaybolur (`no` undefined olur) ve belge okunamaz hale gelir.
const toPlainLucaRecord = (record) => {
  if (!record || typeof record !== 'object') return {}
  if (typeof record.toObject === 'function') {
    try {
      const plain = record.toObject()
      if (plain && typeof plain === 'object' && !Array.isArray(plain)) return plain
    } catch {
      // Kirlenmiş belge: skaler seçime düş.
    }
  }
  const out = {}
  try {
    for (const [key, value] of Object.entries(record)) {
      if (key === '$__' || key === '_doc' || key === '$__parent' || key === '__parentArray' || key === '__index' || key.startsWith('$')) continue
      if (value === null || value === undefined) continue
      const type = typeof value
      if (type === 'string' || type === 'number' || type === 'boolean') out[key] = value
      else if (value instanceof Date || typeof value?.toHexString === 'function') out[key] = value
      else if (Array.isArray(value)) {
        const flat = []
        for (const item of value) {
          if (item === null || item === undefined) continue
          const itemType = typeof item
          if (itemType === 'string' || itemType === 'number' || itemType === 'boolean') flat.push(item)
        }
        out[key] = flat
      }
    }
  } catch {
    return out
  }
  return out
}

// Eşleşmiş Luca faturasını mevcut kayıtla birleştirir. `previous` bir
// Mongoose belgesi olabilir; doğrudan yayma YAPILMAZ (gerekçe yukarıda).
const mergeLucaMatchedInvoice = (previous, inv) => {
  let base = {}
  try {
    base = toPlainLucaRecord(previous)
  } catch {
    base = {}
  }
  const safe = (inv && typeof inv === 'object' && !Array.isArray(inv)) ? inv : {}
  try {
    return {
      ...base,
      ...safe,
      sourceKey: base.sourceKey || safe.sourceKey || '',
      status: 'Kesildi',
      lifecycleStatus: 'verified'
    }
  } catch {
    return { ...safe, sourceKey: safe.sourceKey || '', status: 'Kesildi', lifecycleStatus: 'verified' }
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

    const matchBy = school.settings?.invoiceMatchBy || school.settings?.matchBy || 'tax'
    const normalizeTax = (value) => String(value || '').replace(/\D/g, '')

    const matchInvoiceToStudent = (
      alici,
      studentList,
      incomingTaxId = ''
    ) => {
      const normAlici =
        normalizeTurkish(alici)

      if (
        !normAlici ||
        !studentList?.length
      ) {
        return null
      }

      const uniqueNameMatch = (field) => {
        const candidates = studentList.filter(student => normalizeTurkish(student[field]) === normAlici)
        return candidates.length === 1 ? candidates[0] : null
      }

      if (matchBy === 'student_tax') {
        const invoiceTax = normalizeTax(incomingTaxId)
        if (!invoiceTax) return null
        const candidates = studentList.filter(student =>
          normalizeTurkish(student.name) === normAlici &&
          normalizeTax(student.tax) === invoiceTax
        )
        return candidates.length === 1 ? candidates[0] : null
      }

      if (matchBy === 'student') {
        return uniqueNameMatch('name')
      }

      if (matchBy === 'parent') {
        return uniqueNameMatch('parent')
      }

      if (matchBy === 'tax') {
        const invoiceTax = normalizeTax(incomingTaxId)
        if (invoiceTax) {
          const taxMatches = studentList.filter(student => normalizeTax(student.tax) === invoiceTax)
          if (taxMatches.length === 1) return taxMatches[0]
        }
        return null
      }

      // 1. Öğrenci tam isim eşleşmesi
      let found = uniqueNameMatch('name')

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

    const defaultVatRate = 0

    const asNumber = (value, fallback = 0) => {
      const n = Number(value)
      return Number.isFinite(n) ? n : fallback
    }

    const normalizeLucaLineItem = (item) => {
      if (!item || typeof item !== 'object') return null

      const description = String(item.description || item.name || item.productName || item.malHizmet || item.aciklama || '').trim()
      const rawUnitText = String(item.unit || item.birim || '').trim()
      const rawQuantity = item.quantity ?? item.qty ?? item.miktar ?? 1
      const parsedQty = typeof rawQuantity === 'string' ? Number(String(rawQuantity).replace(',', '.').match(/\d+(?:[.,]\d+)?/)?.[0] || 0) : asNumber(rawQuantity, 0)
      const quantity = parsedQty || asNumber(item.quantity ?? item.qty ?? item.miktar ?? 1, 0)
      const unit = rawUnitText || (() => {
        if (typeof item.quantity === 'string' && item.quantity.includes(' ')) {
          return item.quantity.split(' ').slice(1).join(' ').trim()
        }
        if (typeof item.miktar === 'string' && item.miktar.includes(' ')) {
          return item.miktar.split(' ').slice(1).join(' ').trim()
        }
        return ''
      })()
      const unitPrice = asNumber(item.unitPrice ?? item.birimFiyat ?? item.price ?? item.fiyat ?? 0, 0)
      const vatRate = asNumber(item.vatRate ?? item.kdvOrani ?? item.taxRate ?? item.vat ?? 0, 0)
      const vatAmount = asNumber(item.vatAmount ?? item.kdvTutari ?? item.taxAmount ?? 0, 0)
      const discountRate = asNumber(item.discountRate ?? item.indirimOrani ?? item.discountRateValue ?? 0, 0)
      const discountAmount = asNumber(item.discountAmount ?? item.indirimTutari ?? 0, 0)
      const lineTotal = asNumber(item.lineTotal ?? item.toplam ?? item.total ?? (quantity * unitPrice), 0)

      if (!description && !unitPrice && !lineTotal && !quantity) {
        return null
      }

      return {
        description,
        quantity,
        unit,
        unitPrice,
        discountRate,
        discountAmount,
        vatRate,
        vatAmount,
        lineTotal
      }
    }

    const normalizeLucaInvoice = (li) => {
      const rawLineItems = Array.isArray(li?.items)
        ? li.items
        : Array.isArray(li?.lineItems)
          ? li.lineItems
          : []

      const lineItems = rawLineItems
        .map(normalizeLucaLineItem)
        .filter(Boolean)

      const invoiceVatRate = asNumber(
        li.vatRate ?? li.kdvOrani ?? li.taxRate ?? li.vat ?? defaultVatRate,
        defaultVatRate
      )

      const note = String(
        li.note || li.notes || li.aciklama || li.description || li.remarks || ''
      ).trim()

      // KÖK NEDEN DÜZELTMESİ: `...li` ham Luca ağacını (sınırsız iç içe
      // dizi/nesne) normalize kayda taşıyordu; kayıt Mongo'ya yazılıp her
      // durum sorgusunda (`checkLucaJobStatus` -> `res.json`) yeniden
      // serileştirilince "Maximum call stack size exceeded" doğuyor ve
      // istemci her yoklamada aynı hata toast'ını görüyordu. Bu yüzden
      // YALNIZCA İLKEL alanlar alınır; nesne/dizi alanlar bırakılır.
      // (`buyerDetails` ayrıca aşağıdaki sınırlı temizleyiciden geçer.)
      const flatBase = {}
      for (const [key, value] of Object.entries(li || {})) {
        if (value === null || value === undefined) continue
        if (typeof value === 'string') {
          flatBase[key] = value.slice(0, LUCA_RAW_STRING_LIMIT)
          continue
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
          flatBase[key] = value
        }
      }

      return {
        ...flatBase,
        buyerDetails: sanitizeLucaNestedObject(li.buyerDetails || li.buyer) || {},
        taxId: li.taxId || li.vknTckn || li.tckn || li.buyerDetails?.taxNumber || li.buyerDetails?.identityNumber || '',
        customizationNo: li.customizationNo || li.ozellestirmeNo || li.customization || '',
        invoiceTime: li.invoiceTime || li.dateTime || li.time || li.düzenlemeZamani || li.editTime || '',
        ettn: li.ettn || li.ettnNo || li.ETTN || '',
        sendingMethod: li.sendingMethod || li.gonderimSekli || li.sendMethod || '',
        taxOffice: li.taxOffice || li.vergiDairesi || li.taxOfficeName || '',
        note,
        lineItems,
        vatRate: invoiceVatRate
      }
    }

    for (const li of lucaInvoices) {
      const normalizedLi = normalizeLucaInvoice(li)
      const incomingTaxId = normalizedLi.taxId || normalizedLi.buyerDetails?.taxNumber || normalizedLi.buyerDetails?.identityNumber || ''
      const student =
        matchInvoiceToStudent(
          normalizedLi.alici,
          students,
          incomingTaxId
        )

      const effectiveVatRate = asNumber(
        normalizedLi.vatRate || defaultVatRate,
        defaultVatRate
      )

      const base =
        normalizedLi.total
          ? Math.round(
              (
                normalizedLi.total /
                (1 + effectiveVatRate / 100)
              ) * 100
            ) / 100
          : 0

      const vat =
        normalizedLi.total
          ? Math.round(
              (
                normalizedLi.total -
                base
              ) * 100
            ) / 100
          : 0

      const invPeriod =
        (
          normalizedLi.isoDate &&
          normalizedLi.isoDate.length >= 7
        )
          ? normalizedLi.isoDate.slice(0, 7)
          : period

      matched.push({
        uuid:
          `luca_${normalizedLi.faturaNo || Date.now()}`,

        no:
          normalizedLi.faturaNo,

        date:
          normalizedLi.isoDate,

        period:
          invPeriod,

        taxId:
          incomingTaxId || student?.tax || '',

        buyer:
          normalizedLi.alici,

        buyerDetails:
          normalizedLi.buyerDetails || {},

        invoiceType:
          normalizedLi.invoiceType || normalizedLi.faturaType || '',

        customizationNo:
          normalizedLi.customizationNo,

        invoiceTime:
          normalizedLi.invoiceTime,

        ettn:
          normalizedLi.ettn,

        sendingMethod:
          normalizedLi.sendingMethod,

        taxOffice:
          normalizedLi.taxOffice,

        address:
          normalizedLi.address || '',

        lineItems:
          normalizedLi.lineItems,

        note:
          normalizedLi.note,

        goodsServicesTotal:
          normalizedLi.goodsServicesTotal ?? normalizedLi.subtotal ?? undefined,

        discountTotal:
          normalizedLi.discountTotal ?? undefined,

        vatBase:
          normalizedLi.vatBase ?? undefined,

        vatTotal:
          normalizedLi.vatTotal ?? normalizedLi.vat ?? undefined,

        grandTotal:
          normalizedLi.grandTotal ?? normalizedLi.total ?? undefined,

        payableTotal:
          normalizedLi.payableTotal ?? normalizedLi.grandTotal ?? normalizedLi.total ?? 0,

        issuerSnapshot:
          school.settings?.invoiceSettings || {},

        base,

        vat,

        total:
          normalizedLi.total,

        vatRate:
          effectiveVatRate,

        type:
          'e-Arşiv',

        status:
          'Kesildi',

        studentId:
          student
            ? (student.id || student._id)
            : null,

        matchBy:
          matchBy
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

    // Kirlenmiş (okunamayan) kayıtlar ÖNCE temizlenir; aksi halde
    // aşağıdaki okumalar/birleştirmeler Mongoose getter özyinelemesinde
    // çöker ("Maximum call stack size exceeded"). Temizlenen kayıt çöptür
    // (okunamıyor, serileştirilemiyor); taze kayıt push ile gelir.
    for (let i = updated.invoices.length - 1; i >= 0; i -= 1) {
      let readable = true
      try {
        void updated.invoices[i].no
        void updated.invoices[i].sourceKey
      } catch {
        readable = false
      }
      if (!readable) {
        try {
          updated.invoices.splice(i, 1)
        } catch {
          // Yapısal silme bile başarısızsa akış yine de sürer.
        }
      }
    }

    for (const inv of matched) {
      let idx = -1
      try {
        idx = updated.invoices.findIndex(i => readLucaRecordField(i, 'no') === inv.no)
      } catch {
        idx = -1
      }

      if (idx >= 0) {
        updated.invoices[idx] = mergeLucaMatchedInvoice(updated.invoices[idx], inv)
      } else {
        updated.invoices.push(inv)
      }
    }

    // ─────────────────────────────────────────────────────────────
    // KONTROL EDİLMEYEN KAYITLAR SIFIRLANIR
    //
    // Kullanıcı senaryosu: 32 öğrenci kontrol edildi, Luca'da yalnızca 29
    // fatura onaylıydı. 3 öğrencinin kaydı PenPOS'ta "gönderilmiş" görünüyor
    // ama Luca'da o fatura YOK. Bu kayıtlar yanlış güven veriyordu: satır
    // "Faturayı Gör" diyor, kullanıcı PDF'i arıyor, fatura yok.
    //
    // Bu kayıtlar SİLİNİR: numara ve durum temizlenir, satır yeniden
    // "pending" olur ve "Fatura Kes" düğmesine döner. Kullanıcı tekrar
    // fatura kesme akışına yönlendirilir.
    //
    // DİKKAT:
    //   * Yalnızca KONTROL EDİLEN DÖNEMİN kayıtları sıfırlanır; geçmiş
    //     dönem faturalarına dokunulmaz.
    //   * Luca'da bu dönemde ONAYLANMIŞ numaralar korunur (29 öğrenci
    //     verified/sent olarak kalır).
    //   * "Fatura Kes" akışı Luca'da önce TASLAK listesine baktığı için
    //     gönderilmemiş bir taslak kaybolmaz; yeniden kesilmez, mevcut
    //     taslak benimsenir.
    // ─────────────────────────────────────────────────────────────
    const matchedNos =
      new Set(
        matched
          .map(invoice => String(invoice.no || '').trim())
          .filter(Boolean)
      )

    const RESETTABLE_LIFECYCLE_STATUSES = [
      'creating',
      'draft_created',
      'awaiting_approval',
      DRAFT_MISSING_STATUS,
      'sent',
      'checking',
      'verified'
    ]

    const resetRows = []

    for (let index = updated.invoices.length - 1; index >= 0; index -= 1) {
      const record = updated.invoices[index]
      let recordNo = ''
      let recordPeriod = ''
      let recordDate = ''
      let recordStatus = ''

      try {
        recordNo = String(
          readLucaRecordField(record, 'no') || ''
        ).trim()

        recordPeriod = String(
          readLucaRecordField(record, 'period') || ''
        ).trim()

        recordDate = String(
          readLucaRecordField(record, 'date') || ''
        ).trim()

        recordStatus = String(
          readLucaRecordField(record, 'lifecycleStatus') || ''
          || readLucaRecordField(record, 'status') || ''
        ).trim()
      } catch {
        continue
      }

      // Sadece bu dönemin kayıtları.
      const recordPeriodFromDate =
        recordDate.length >= 7
          ? recordDate.slice(0, 7)
          : ''

      if (
        recordPeriod !== period &&
        recordPeriodFromDate !== period
      ) {
        continue
      }

      // Numarasız kayıt zaten ölü; ayrıca sıfırlama gerekmez.
      if (!recordNo) continue

      // Luca'da bu dönemde onaylanmış numara → KORUNUR.
      if (matchedNos.has(recordNo)) continue

      // Yalnızca yaşam döngüsü olan kayıtlar sıfırlanır.
      if (!RESETTABLE_LIFECYCLE_STATUSES.includes(recordStatus)) continue

      resetRows.push({
        no: recordNo,
        sourceKey: readLucaRecordField(record, 'sourceKey') || '',
        studentId: readLucaRecordField(record, 'studentId') ?? null,
        planName: readLucaRecordField(record, 'planName') || '',
        previousStatus: recordStatus
      })

      try {
        updated.invoices.splice(index, 1)
      } catch {
        // Yapısal silme başarısızsa kayıt kalır; akış yine de sürer.
      }
    }

    const checkedSourceKeys = updated.invoices
      .filter(record => matchedNos.has(String(readLucaRecordField(record, 'no') || '').trim()))
      .map(record => String(readLucaRecordField(record, 'sourceKey') || '').trim())
      .filter(Boolean)

    if (resetRows.length) {
      await updateStep(
        `${resetRows.length} fatura Luca'da bulunamadı; kayıtlar temizleniyor…`
      )

      console.warn(
        `[Luca Kontrol] ${resetRows.length} fatura kaydı Luca'da bulunamadı, "Fatura Kes"e döndürüldü:`,
        resetRows.map(row => row.no).join(', ')
      )
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
        matchedCount,
      // Luca'da olmayan faturalar: satırlar "Fatura Kes"e döndürüldü.
      reset:
        resetRows.length,
      resetRows
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
      checkedSourceKeys,
      reset:
        resetRows.length,
      resetRows,
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
    if (req.user?.role === 'superadmin') {
      return res.status(403).json({ error: 'Süper Admin öğrenci bilgisi veya taksit düzenleyemez.' })
    }
    const studentId = Number(req.params.id)
    const school = await AnaokuluSchool.findOne({
      tenant: req.tenant?._id
    })

    if (!school) return res.status(404).json({ error: 'Okul kaydı bulunamadı' })

    const student = school.students.find(item => item.id === studentId)
    if (!student) return res.status(404).json({ error: 'Öğrenci bulunamadı' })

    if (Array.isArray(req.body?.items)) {
      const studentsWithUpdatedPlan = school.students.map(item => item.id === studentId
        ? { ...item.toObject(), items: req.body.items }
        : item.toObject())
      try {
        validateAnaokuluCollections(studentsWithUpdatedPlan, school.collections || [], school.students)
      } catch (validationError) {
        return res.status(400).json({ error: validationError.message || 'Geçersiz ücret planı.' })
      }
      student.items = req.body.items
    }
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

export const getAnaokuluInvoicePdf = async (req, res) => {
  try {
    const tenantId = req.tenant?._id || req.tenant?.id
    if (!tenantId) return res.status(400).json({ error: 'Tenant bulunamadı.' })

    const school = await AnaokuluSchool.findOne({ tenant: tenantId }).lean()
    if (!school) return res.status(404).json({ error: 'Okul kaydı bulunamadı.' })

    const invoice = (school.invoices || []).find(item => String(item.uuid) === String(req.params.uuid))
    if (!invoice) return res.status(404).json({ error: 'Fatura bulunamadı.' })

    const configured = school.settings?.invoiceSettings || {}
    const snapshot = invoice.issuerSnapshot || {}
    const tenant = req.tenant || {}
    const nonEmptySnapshot = Object.fromEntries(
      Object.entries(snapshot).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    )
    const issuer = {
      ...configured,
      ...nonEmptySnapshot,
      companyName: nonEmptySnapshot.companyName || configured.companyName || school.settings?.school || tenant.name || '',
      phone: nonEmptySnapshot.phone || configured.phone || tenant.phone || '',
      logoUrl: nonEmptySnapshot.logoUrl || configured.logoUrl || tenant.logoUrl || ''
    }

    const pdf = await renderAnaokuluInvoicePdf({ invoice, issuer, tenant })
    const filename = `${String(invoice.no || invoice.uuid || 'fatura').replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    res.setHeader('Content-Length', pdf.length)
    return res.send(pdf)
  } catch (err) {
    console.error('[getAnaokuluInvoicePdf] Hata:', err)
    return res.status(500).json({ error: 'Fatura PDF oluşturulamadı.' })
  }
}