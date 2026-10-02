(() => {
  let startedJobId = ""
  let startTaskPromise = null

  console.log(
    "[PenPOS Luca Bridge] Content script aktif:",
    location.href
  )

  const LUCA_HOST = "turmobefatura.luca.com.tr"

  function isLucaPage() {
    return location.hostname === LUCA_HOST
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // content.js manifest ile "document_start" enjekte edilirse DOM henüz
  // oluşmamış olur ve hiçbir selector bulunamaz. DOM hazır olana kadar bekle.
  function waitForDomReady() {
    if (document.readyState !== "loading") {
      return Promise.resolve()
    }
    return new Promise(resolve => {
      document.addEventListener("DOMContentLoaded", () => resolve(), { once: true })
    })
  }

  // Belirli bir element DOM'a gelene kadar (en fazla timeoutMs) bekler.
  async function waitForElement(selector, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const element = document.querySelector(selector)
      if (element) return element
      await sleep(200)
    }
    return null
  }

  // Dönem bilgisini "YYYY-MM" aralığa çevirir.
//
// Biçim tek olsaydı burada işimiz kolaydı. Oysa dönem birden çok yerden
// geliyor (frontend seçicisi, backend görevi, eski kayıtlar) ve
// biçim farkı sessizce TÜM ARŞİVİ taratıyordu: filtre uygulanmayınca
// kullanıcı "494 fatura bulundu" görüyordu. Bu yüzden yaygın biçimlerin
// hepsi kabul edilir; anlaşılmayan biçim HATA verir (sessizce boş dönem
// DEĞİL) ki filtre uygulanmadan tarama yapılmasın.
const LUCA_PERIOD_MONTHS = {
    ocak: 1,
    "şubat": 2,
    subat: 2,
    mart: 3,
    nisan: 4,
    "mayıs": 5,
    mayis: 5,
    haziran: 6,
    temmuz: 7,
    "ağustos": 8,
    agustos: 8,
    "eylül": 9,
    eylul: 9,
    ekim: 10,
    "kasım": 11,
    kasim: 11,
    "aralık": 12,
    aralik: 12
  }

  function getPeriodDates(period) {
    const raw = String(period ?? "")
      .trim()

    if (!raw) {
      return {
        startDate: "",
        endDate: ""
      }
    }

    let year = 0
    let month = 0

    // 1) "2026-09" / "2026-9"
    let match = raw.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/)

    if (match) {
      year = Number(match[1])
      month = Number(match[2])
    }

    // 2) "202609"
    if (!month) {
      match = raw.match(/^(\d{4})(\d{2})$/)

      if (match) {
        year = Number(match[1])
        month = Number(match[2])
      }
    }

    // 3) "Eylül 2026" / "09.2026 Eylül" -> Türkçe ay adı
    if (!month) {
      const normalized = raw
        .replace(/İ/g, "i")
        .replace(/I/g, "i")
        .replace(/ı/g, "i")
        .toLowerCase()
      // DİKKAT: ay ADI değil, ay NUMARASI kullanılır. Dizi indeksine
      // güvenilseydi "Eylül" (indeks 11) Aralık (12) sanılırdı; yanlış
      // dönem filtresi tüm arşivin taranmasına yol açıyordu.
      const matchedName = Object.keys(LUCA_PERIOD_MONTHS).find(name =>
        normalized.includes(name)
      )

      if (matchedName) {
        const yearMatch = raw.match(/(\d{4})/)

        if (yearMatch) {
          month = LUCA_PERIOD_MONTHS[matchedName]
          year = Number(yearMatch[1])
        }
      }
    }

    if (!year || !month || month < 1 || month > 12) {
      return {
        startDate: "",
        endDate: ""
      }
    }

    const lastDay = new Date(year, month, 0).getDate()

    return {
      startDate:
        `${year}-${String(month).padStart(2, "0")}-01`,
      endDate:
        `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    }
  }

  function parseTotal(value) {
    if (value === null || value === undefined) {
      return 0
    }

    let text = String(value)
      .replace(/\s/g, "")
      .replace(/₺/g, "")
      .replace(/TL/gi, "")

    if (text.includes(".") && text.includes(",")) {
      text = text
        .replace(/\./g, "")
        .replace(",", ".")
    } else if (text.includes(",")) {
      text = text.replace(",", ".")
    }

    text = text.replace(/[^0-9.-]/g, "")

    const number = Number.parseFloat(text)

    return Number.isFinite(number) ? number : 0
  }

  function parseDecimal(value, fallback = 0) {
    if (value === null || value === undefined || value === "") {
      return fallback
    }

    const text = String(value)
      .replace(/\s/g, "")
      .replace(/%/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "")

    if (!text) {
      return fallback
    }

    const number = Number.parseFloat(text)
    return Number.isFinite(number) ? number : fallback
  }

  // Tutar: PenPOS JSON sayıları (1200.5) ile Luca'nın TL metinleri
  // ("1.200,50") arasında ayrım yapar. parseDecimal ondalık noktalarını
  // binlik ayracı varsaydığı için SAF SAYILAR buradan geçmelidir.
  function parseAmountValue(value, fallback = 0) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : fallback
    }

    const parsed = parseDecimal(value, fallback)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  function getRowMetaValue(row, names) {
    const candidates = names.flatMap(name => [
      row?.dataset?.[name],
      row?.dataset?.[name.replace(/[-_]+/g, "")],
      row?.getAttribute?.(`data-${name}`),
      row?.getAttribute?.(`data-${name.replace(/([A-Z])/g, "-$1").toLowerCase()}`)
    ])

    for (const value of candidates) {
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim()
      }
    }

    return ""
  }

  function parseLucaMoney(value) {
    return parseTotal(value)
  }

  function parseQuantityAndUnit(value) {
    const text = String(value || "").trim()
    if (!text) {
      return { quantity: 0, unit: "" }
    }

    const match = text.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(.*)$/)
    if (!match) {
      return { quantity: 0, unit: text }
    }

    const quantity = Number(match[1].replace(",", ".")) || 0
    const unit = String(match[2] || "").trim()

    return { quantity, unit }
  }

  function extractDetailPageInvoice() {
    const pageText = String(document.body?.innerText || "")
    const rowPattern = (pattern) => {
      const match = pageText.match(pattern)
      return match ? match[1].trim() : ""
    }

    const no = rowPattern(/Fatura No\s*[:\-]\s*([A-Z0-9-]+)/i)
      || rowPattern(/Fatura No\s*[:\-]\s*([A-Z0-9-]+)\s*$/im)
    const invoiceType = rowPattern(/Fatura Tipi\s*[:\-]\s*([A-ZÇĞİÖŞÜ]+)/i)
    const sendingMethod = rowPattern(/Gönderim Şekli\s*[:\-]\s*([A-ZÇĞİÖŞÜ]+)/i)
    const date = rowPattern(/Düzenleme Tarihi\s*[:\-]\s*(\d{2}-\d{2}-\d{4})/i)
    const invoiceTime = rowPattern(/Düzenleme Zamanı\s*[:\-]\s*(\d{2}:\d{2}:\d{2})/i)
    const ettn = rowPattern(/ETTN\s*[:\-]\s*([0-9A-Fa-f-]+)/i)
    const note = rowPattern(/Not\s*[:\-]\s*([\s\S]*?)(?:\n|$)/i)
    const vatRate = (() => {
      const match = pageText.match(/Hesaplanan KDV\((?:%\s*)?([0-9]+(?:[.,][0-9]+)?)\)/i)
      if (match) return parseDecimal(match[1], 0)
      const itemMatch = pageText.match(/KDV Oranı\s*[:\-]\s*(?:%\s*)?([0-9]+(?:[.,][0-9]+)?)/i)
      return itemMatch ? parseDecimal(itemMatch[1], 0) : 0
    })()

    const vatBase = (() => {
      const match = pageText.match(/KDV Matrahı\s*[:\-]?\s*([0-9\.\s,]+(?:TL|₺)?)/i)
      return match ? parseTotal(match[1]) : 0
    })()
    const vatAmount = (() => {
      const match = pageText.match(/Hesaplanan KDV\([^\n]*?\)\s*[:\-]?\s*([0-9\.\s,]+(?:TL|₺)?)/i)
      return match ? parseTotal(match[1]) : 0
    })()
    const payable = (() => {
      const match = pageText.match(/Ödenecek Tutar\s*[:\-]?\s*([0-9\.\s,]+(?:TL|₺)?)/i)
      return match ? parseTotal(match[1]) : 0
    })()
    const total = (() => {
      const match = pageText.match(/Vergiler Dahil Toplam Tutar\s*[:\-]?\s*([0-9\.\s,]+(?:TL|₺)?)/i)
      return match ? parseTotal(match[1]) : payable || 0
    })()

    const lineRows = Array.from(document.querySelectorAll('table tr')).filter(tr => {
      const cells = Array.from(tr.querySelectorAll('td'))
      const text = (tr.textContent || '').replace(/\s+/g, ' ').trim()
      return cells.length >= 11 && /Miktar|KDV Oranı|Mal Hizmet Tutarı/i.test(text)
    })

    const lineItems = lineRows
      .map(tr => {
        const cells = Array.from(tr.querySelectorAll('td'))
        if (cells.length < 11) return null

        const firstText = (cells[0]?.textContent || '').trim()
        if (!/\d+/.test(firstText) && !/EĞİTİM|HEM|BİTİR|AÇIKLAMA/i.test((cells[1]?.textContent || '').trim())) {
          return null
        }

        const description = (cells[1]?.textContent || '').trim() || (cells[2]?.textContent || '').trim()
        const quantityAndUnit = parseQuantityAndUnit(cells[3]?.textContent || '')
        const quantity = quantityAndUnit.quantity || Number((cells[3]?.textContent || '').match(/\d+/)?.[0] || 0)
        const unit = quantityAndUnit.unit || (cells[3]?.textContent || '').replace(/\d+|[.,]/g, '').trim()
        const unitPrice = parseLucaMoney(cells[4]?.textContent || 0)
        const vatRateRow = parseDecimal((cells[7]?.textContent || '').replace(/%/g, '').replace(/\./g, '').replace(',', '.'), 0)
        const vatAmountRow = parseLucaMoney(cells[8]?.textContent || 0)
        const lineTotalValue = parseLucaMoney(cells[10]?.textContent || 0)

        if (!description && !quantity && !unitPrice && !lineTotalValue) {
          return null
        }

        return {
          description,
          quantity,
          unit,
          unitPrice,
          vatRate: vatRateRow,
          vatAmount: vatAmountRow,
          lineTotal: lineTotalValue
        }
      })
      .filter(Boolean)

    return {
      faturaNo: no || "",
      alici: (String(document.body?.innerText || '').match(/SAYIN\s+([^\n]+)/i)?.[1] || '').trim() || "",
      isoDate: date ? `${date.split('-').reverse().join('-')}` : "",
      total,
      period: date ? date.slice(6, 10) + '-' + date.slice(3, 5) : "",
      ettn,
      invoiceType,
      sendingMethod,
      invoiceTime,
      vatRate,
      note,
      lineItems,
      vatBase,
      vatTotal: vatAmount,
      payableTotal: payable,
      grandTotal: total,
      goodsServicesTotal: total - vatAmount || 0
    }
  }

  function normalizeLineItems(raw) {
    if (!raw) return []
    const result = []
    const stack = [raw]
    while (stack.length) {
      const current = stack.pop()
      if (!current) continue
      if (Array.isArray(current)) {
        for (let i = current.length - 1; i >= 0; i--) {
          stack.push(current[i])
        }
        continue
      }
      if (typeof current === "string") {
        try {
          const parsed = JSON.parse(current)
          if (parsed === current) continue
          stack.push(parsed)
        } catch {
          // ignore
        }
        continue
      }
      if (!current || typeof current !== "object") continue
      const description = current.description || current.name || current.productName || current.malHizmet || current.aciklama || ""
      const quantity = current.quantity ?? current.qty ?? current.miktar ?? 1
      const unit = current.unit || current.birim || ""
      const unitPrice = current.unitPrice ?? current.birimFiyat ?? current.price ?? current.fiyat ?? 0
      const vatRate = current.vatRate ?? current.kdvOrani ?? current.taxRate ?? current.vat ?? 0
      const vatAmount = current.vatAmount ?? current.kdvTutari ?? current.taxAmount ?? 0
      const lineTotal = current.lineTotal ?? current.toplam ?? current.total ?? (Number(quantity) * Number(unitPrice || 0))
      const discountRate = current.discountRate ?? current.indirimOrani ?? current.discount ?? 0
      const discountAmount = current.discountAmount ?? current.indirimTutari ?? 0
      if (!description && !unitPrice && !lineTotal && !quantity) continue
      result.push({
        description: String(description || "").trim(),
        quantity: Number(quantity) || 0,
        unit: String(unit || "").trim(),
        unitPrice: Number(unitPrice) || 0,
        discountRate: Number(discountRate) || 0,
        discountAmount: Number(discountAmount) || 0,
        vatRate: Number(vatRate) || 0,
        vatAmount: Number(vatAmount) || 0,
        lineTotal: Number(lineTotal) || 0
      })
    }
    return result
  }

  // Gerçek Luca arşiv tablosunun başlık sütunlarını çıkarır. Satır hücrelerini
  // sıra numarasıyla değil, BAŞLIKLA eşlemek için kullanılır. (Gerçek tabloda
  // satır başında gizli "IdFatura" ve boş "ActionButtons" kolonları vardır;
  // sıra tabanlı okuma bu yüzden yanlış hücreleri okurdu.)
  function getOutgoingColumnMap() {
    const table =
      document.querySelector(
        "#OutgoingArchiveTable"
      )

    if (!table) {
      return null
    }

    const headerRow =
      table.querySelector("thead tr")

    if (!headerRow) {
      return null
    }

    const headers =
      Array.from(
        headerRow.querySelectorAll("th")
      )

    if (!headers.length) {
      return null
    }

    return headers.map(header =>
      String(
        header.textContent ||
        header.innerText ||
        ""
      )
      .replace(/\s+/g, " ")
      .trim()
    )
  }

  function normalizeInvoice(row, columnMap) {
    if (!row) {
      return null
    }

    const cells = Array.from(
      row.querySelectorAll("td")
    )

    if (!cells.length) {
      return null
    }

    let alici = ""
    let faturaNo = ""
    let rawDate = ""
    let rawTotal = ""
    let durum = ""
    let gonderimDurumu = ""
    let faturaTipi = ""

    if (columnMap && columnMap.length) {
      // Gerçek başlıklar:
      //   [Id] [ActionButtons] [Alıcı / Gönderen] [Fatura No.] [Fatura Tarihi]
      //   [Tutar] [Fatura Tipi] [Fatura Durumu] [Gönderim Durumu] ...
      const columnIndex = pattern =>
        columnMap.findIndex(header =>
          pattern.test(header)
        )

      const take = index => {
        if (
          index < 0 ||
          index >= cells.length
        ) {
          return ""
        }

        const cell = cells[index]

        return (
          cell?.innerText ||
          cell?.textContent ||
          ""
        )
        .replace(/\s+/g, " ")
        .trim()
      }

      alici =
        take(
          columnIndex(
            /alıcı|gönderen|müşteri|adı/i
          )
        ) ||
        take(1)

      faturaNo =
        take(
          columnIndex(
            /fatura\s*no/i
          )
        )

      rawDate =
        take(
          columnIndex(
            /fatura\s*tarihi/i
          )
        )

      const totalIndex =
        columnIndex(/^tutar$/i)

      rawTotal =
        take(
          totalIndex >= 0
            ? totalIndex
            : columnIndex(
              /ödenecek|tahsil|tutar/i
            )
        )

      faturaTipi =
        take(
          columnIndex(
            /fatura\s*tipi/i
          )
        )

      durum =
        take(
          columnIndex(
            /^fatura\s*durumu$/i
          )
        )

      gonderimDurumu =
        take(
          columnIndex(
            /gönderim\s*durumu/i
          )
        )
    } else {
      // Bilinmeyen düzen: eski varsayılan sıra eşlemesi (geriye dönük uyum).
      alici =
        cells[1]?.innerText?.trim() || ""

      faturaNo =
        cells[2]?.innerText?.trim() || ""

      rawDate =
        cells[3]?.innerText?.trim() || ""

      rawTotal =
        cells[4]?.innerText?.trim() || ""
    }

    if (!faturaNo) {
      return null
    }

    let isoDate = ""

    const dateMatch = rawDate.match(
      /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
    )

    if (dateMatch) {
      const day =
        String(dateMatch[1]).padStart(2, "0")

      const month =
        String(dateMatch[2]).padStart(2, "0")

      const year =
        dateMatch[3]

      isoDate =
        `${year}-${month}-${day}`
    } else {
      const parsed = new Date(rawDate)

      if (!Number.isNaN(parsed.getTime())) {
        isoDate =
          `${parsed.getFullYear()}-${String(
            parsed.getMonth() + 1
          ).padStart(2, "0")}-${String(
            parsed.getDate()
          ).padStart(2, "0")}`
      }
    }

    const rowText = String(row.textContent || "")
    const ettn = getRowMetaValue(row, ["ettn", "ettnNo"]) || (rowText.match(/ETTN\s*[:=]\s*([A-Z0-9]+)/i)?.[1] || "")
    const invoiceTime = getRowMetaValue(row, ["invoiceTime", "editTime", "dateTime", "duzenlemeZamani", "zaman"]) || (rowText.match(/(?:Düzenleme\s+Zamanı|Invoice\s+Time|Zaman)\s*[:=]\s*([^\n|]+?)(?:\s*(?:ETTN|KDV|Not|\|)|$)/i)?.[1] || "")
    const vatRateMatch = rowText.match(/(?:KDV|VAT|Vergi)\s*(?:Oranı|Rate)?\s*[:=]\s*(?:%\s*)?([0-9]+(?:[.,][0-9]+)?)/i)
    const vatRate = vatRateMatch ? parseDecimal(vatRateMatch[1], 0) : parseDecimal(getRowMetaValue(row, ["vatRate", "kdvOrani", "taxRate"]), 0)
    const note = getRowMetaValue(row, ["note", "notes", "aciklama", "description"]) || (rowText.match(/(?:Not|Note|Açıklama)\s*[:=]\s*([^\n|]+?)(?:\s*(?:ETTN|KDV|Düzenleme|\|)|$)/i)?.[1] || "")
    const lineItems = normalizeLineItems(
      getRowMetaValue(row, ["lineItems", "items", "malHizmetler", "lineitems"]) ||
      row.querySelector('script[type="application/json"]')?.textContent ||
      row.querySelector('[data-line-items]')?.dataset?.lineItems ||
      ""
    )

    const invoice = {
      alici,
      faturaNo,
      isoDate,
      total: parseTotal(rawTotal),
      period: isoDate ? isoDate.slice(0, 7) : "",
      ettn,
      invoiceTime,
      vatRate,
      note,
      lineItems,
      durum,
      gonderimDurumu,
      faturaTipi
    }

    const hidden = row.querySelectorAll('[data-ettn], [data-vat-rate], [data-kdv-orani], [data-line-items], [data-note], [data-invoice-time]')
    for (const el of hidden) {
      const elText = String(el.dataset?.ettn || el.dataset?.invoiceTime || el.dataset?.vatRate || el.dataset?.kdvOrani || el.dataset?.note || "")
      if (elText && !invoice.ettn && el.dataset?.ettn) invoice.ettn = el.dataset.ettn
      if (elText && !invoice.invoiceTime && (el.dataset?.invoiceTime || el.dataset?.dateTime || el.dataset?.duzenlemeZamani)) invoice.invoiceTime = el.dataset.invoiceTime || el.dataset.dateTime || el.dataset.duzenlemeZamani
      if (elText && !invoice.vatRate && (el.dataset?.vatRate || el.dataset?.kdvOrani || el.dataset?.taxRate)) invoice.vatRate = parseDecimal(el.dataset.vatRate || el.dataset.kdvOrani || el.dataset.taxRate, 0)
      if (elText && !invoice.note && (el.dataset?.note || el.dataset?.notes || el.dataset?.aciklama)) invoice.note = el.dataset.note || el.dataset.notes || el.dataset.aciklama
      if (!invoice.lineItems.length && (el.dataset?.lineItems || el.dataset?.items)) invoice.lineItems = normalizeLineItems(el.dataset.lineItems || el.dataset.items)
    }

    return invoice
  }

  function getPageInvoices() {
    const table =
      document.querySelector("#OutgoingArchiveTable")

    if (!table) {
      return []
    }

    const rows =
      Array.from(
        table.querySelectorAll("tbody tr")
      )

    const columnMap =
      getOutgoingColumnMap()

    const invoices = []

    for (const row of rows) {
      const invoice =
        normalizeInvoice(
          row,
          columnMap
        )

      if (!invoice) {
        continue
      }

      if (!invoice.faturaNo || !invoice.alici) {
        continue
      }

      invoices.push(invoice)
    }

    return invoices
  }

  async function setLucaDateRange(period) {
    const {
      startDate,
      endDate
    } = getPeriodDates(period)

    if (!startDate || !endDate) {
      throw new Error(
        `Geçersiz dönem: ${period}`
      )
    }

    const input =
      document.querySelector("#reportrange")

    if (!input) {
      throw new Error(
        "Luca tarih alanı (#reportrange) bulunamadı."
      )
    }

    console.log(
      "[PenPOS Luca Bridge] Luca tarih filtresi ayarlanıyor:",
      startDate,
      endDate
    )

    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      typeof chrome.runtime.sendMessage !== "function"
    ) {
      throw new Error(
        "Chrome Extension runtime bağlantısı bulunamadı."
      )
    }

    const response =
      await chrome.runtime.sendMessage({
        type: "PENPOS_LUCA_SET_DATE_RANGE",
        period,
        startDate,
        endDate
      })

    console.log(
      "[PenPOS Luca Bridge] Tarih ayarı background cevabı:",
      response
    )

    if (!response?.ok) {
      throw new Error(
        response?.error ||
        "Luca tarih filtresi background tarafından ayarlanamadı."
      )
    }

    await sleep(700)

    const expectedStart =
      String(startDate)
        .split("-")
        .reverse()
        .join(".")

    const expectedEnd =
      String(endDate)
        .split("-")
        .reverse()
        .join(".")

    const expected =
      `${expectedStart} - ${expectedEnd}`

    console.log(
      "[PenPOS Luca Bridge] Luca tarih alanı:",
      input.value
    )

    if (input.value !== expected) {
      console.warn(
        "[PenPOS Luca Bridge] Luca tarih alanı beklenen değerde değil:",
        input.value,
        "=>",
        expected
      )

      throw new Error(
        `Luca tarih filtresi ayarlanamadı. Beklenen: ${expected}, mevcut: ${input.value}`
      )
    }

    console.log(
      "[PenPOS Luca Bridge] Luca tarih filtresi başarıyla ayarlandı:",
      expected
    )

    return true
  }

  function clickAra() {
    const button =
      document.querySelector("#searchButton")

    if (!button) {
      console.warn(
        "[PenPOS Luca Bridge] Ara butonu bulunamadı."
      )

      return false
    }

    console.log(
      "[PenPOS Luca Bridge] Ara butonuna basılıyor..."
    )

    button.click()

    return true
  }

  function isTableProcessing() {
    const processing =
      document.querySelector(
        "#OutgoingArchiveTable_processing"
      )

    if (!processing) {
      return false
    }

    const style =
      window.getComputedStyle(processing)

    return (
      style.display !== "none" &&
      processing.offsetParent !== null
    )
  }

  async function waitForTableData() {
    const started = Date.now()
    const timeout = 20000

    while (Date.now() - started < timeout) {
      if (!isTableProcessing()) {
        const rows = getPageInvoices()

        if (rows.length > 0) {
          return rows
        }

        const bodyText =
          document.body?.innerText || ""

        if (
          bodyText.includes(
            "Gösterilecek Kayıt Bulunamadı"
          ) ||
          bodyText.includes(
            "Gösterilecek Kayıt Yok"
          ) ||
          // Luca'nın TÜRMOB aksiyonu: clearReportTableRows tabloyu boşaltır ve
          // kendi "Arama parametreleri değiştirildi..." mesajını basar.
          /Arama parametreleri değiştirildi/i.test(
            bodyText
          ) ||
          /Listelemek için\s*"Ara"/i.test(
            bodyText
          )
        ) {
          return []
        }
      }

      await sleep(500)
    }

    return getPageInvoices()
  }

  async function waitForFreshArchiveResults(startSearch) {
    const table = document.querySelector("#OutgoingArchiveTable")
    if (!table) {
      throw new Error("Luca arşiv tablosu bulunamadı.")
    }

    return new Promise((resolve, reject) => {
      const started = Date.now()
      let changed = false
      let lastChangeAt = started
      const observer = new MutationObserver(() => {
        changed = true
        lastChangeAt = Date.now()
      })

      observer.observe(table, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
      })

      const finish = (error) => {
        observer.disconnect()
        if (error) reject(error)
        else resolve()
      }

      if (!startSearch()) {
        finish(new Error("Luca Ara butonuna basılamadı."))
        return
      }

      const check = () => {
        if (isTableProcessing()) {
          changed = true
          lastChangeAt = Date.now()
        }

        if (changed && !isTableProcessing() && Date.now() - lastChangeAt >= 1000) {
          finish()
          return
        }

        if (Date.now() - started >= 20000) {
          finish(new Error("Luca arşiv sonuçları yenilenmedi; eski sonuçlar kullanılmadı."))
          return
        }

        setTimeout(check, 200)
      }

      check()
    })
  }

  async function setPageLength() {
    const selects =
      Array.from(
        document.querySelectorAll(
          "#OutgoingArchiveTable_length select, select"
        )
      )

    const select =
      selects.find(el =>
        Array.from(el.options || []).some(option =>
          ["50", "100"].includes(
            String(option.value)
          )
        )
      )

    if (!select) {
      return
    }

    const options =
      Array.from(select.options || [])

    const preferred =
      options.find(
        option =>
          String(option.value) === "100"
      ) ||
      options.find(
        option =>
          String(option.value) === "50"
      ) ||
      options[options.length - 1]

    if (!preferred) {
      return
    }

    if (
      String(select.value) ===
      String(preferred.value)
    ) {
      console.log(
        "[PenPOS Luca Bridge] Sayfa kayıt sayısı:",
        select.value
      )

      return
    }

    select.value = preferred.value

    select.dispatchEvent(
      new Event("change", {
        bubbles: true
      })
    )

    await sleep(2500)

    console.log(
      "[PenPOS Luca Bridge] Sayfa kayıt sayısı:",
      select.value
    )
  }

  // Luca'nın KENDİ DataTable örneği üzerinden sayfalamayı başa alır.
  // stateSave:true Luca arşiv tablosunda KAYITLI sayfa konumunu geri yükler;
  // eski oturumdan kalan sayfa açıkken arama yapılırsa kazıma yanlış sayfadan
  // başlar ve faturalar "bulunamadı" görünür. Arka plandaki MAIN-world çağrısı
  // $('#OutgoingArchiveTable').DataTable().page(0).draw(false) ile bu düzeltilir.
  async function sendResetPaging(options = {}) {
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      typeof chrome.runtime.sendMessage !== "function"
    ) {
      return null
    }

    try {
      const response =
        await chrome.runtime.sendMessage({
          type: "PENPOS_LUCA_RESET_PAGING",
          tableIds: Array.isArray(options.tableIds) ? options.tableIds : undefined,
          pageLength: Number(options.pageLength) || undefined,
          // clearFilters:false -> arka plan filtreleri TEMİZLEMEZ.
          // "Faturaları Kontrol Et" kendi tarih filtresini bu çağrıdan
          // hemen önce kurar; temizlenirse kontrol TÜM arşivi tarar
          // (494 fatura) ve #reportrange boşaldığı için işlem durur.
          clearFilters: options.clearFilters !== false
        })

      if (!response?.ok) {
        console.warn(
          "[PenPOS Luca Bridge] Luca sayfalama sıfırlanamadı:",
          response?.error ||
          response?.reason ||
          ""
        )
      }

      return response
    } catch (err) {
      console.warn(
        "[PenPOS Luca Bridge] Luca sayfalama sıfırlama çağrısı başarısız:",
        err?.message || err
      )

      return null
    }
  }

  function getNextButton() {
    return document.querySelector(
      "#OutgoingArchiveTable_next"
    )
  }

  async function clickNextPage(previousFirstNo) {
    const next = getNextButton()

    if (!next) {
      return false
    }

    const className =
      String(next.className || "")

    const disabled =
      className.includes("disabled") ||
      next.getAttribute("aria-disabled") === "true"

    if (disabled) {
      return false
    }

    console.log(
      "[PenPOS Luca Bridge] Sonraki sayfaya geçiliyor..."
    )

    next.click()

    const started = Date.now()

    while (Date.now() - started < 15000) {
      await sleep(400)

      if (isTableProcessing()) {
        continue
      }

      const invoices = getPageInvoices()

      if (!invoices.length) {
        continue
      }

      const firstNo =
        invoices[0]?.faturaNo

      if (
        !previousFirstNo ||
        firstNo !== previousFirstNo
      ) {
        return true
      }
    }

    return false
  }

  async function scrapeInvoices() {
    const all = []
    const seen = new Set()

    let page = 1

    while (page <= 20) {
      const current =
        await waitForTableData()

      console.log(
        `[PenPOS Luca Bridge] Sayfa ${page}: ${current.length} fatura bulundu.`
      )

      for (const invoice of current) {
        const key =
          String(
            invoice.faturaNo || ""
          ).trim()

        if (!key) {
          continue
        }

        if (seen.has(key)) {
          continue
        }

        seen.add(key)
        all.push(invoice)
      }

      if (!current.length) {
        break
      }

      const previousFirstNo =
        current[0]?.faturaNo || ""

      const moved =
        await clickNextPage(
          previousFirstNo
        )

      if (!moved) {
        break
      }

      page++
    }

    return all
  }

  async function sendInvoicesToBackground(
    task,
    invoices
  ) {
    console.log(
      "[PenPOS Luca Bridge] Faturalar background'a gönderiliyor:",
      invoices.length
    )

    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      typeof chrome.runtime.sendMessage !==
        "function"
    ) {
      throw new Error(
        "Chrome Extension runtime bağlantısı bulunamadı."
      )
    }

    const response =
      await chrome.runtime.sendMessage({
        type:
          "PENPOS_LUCA_INVOICES",

        jobId:
          task.jobId,

        resultToken:
          task.resultToken,

        invoices
      })

    console.log(
      "[PenPOS Luca Bridge] Background cevap:",
      response
    )

    if (!response?.ok) {
      throw new Error(
        response?.error ||
        "Faturalar PenPOS backend'e gönderilemedi."
      )
    }

    console.log(
      "[PenPOS Luca Bridge] Faturalar PenPOS backend'e gönderildi:",
      invoices.length
    )

    return response
  }

  async function openArchiveAndScrape(task) {
    const {
      startDate,
      endDate
    } = getPeriodDates(task.period)

    console.log(
      "[PenPOS Luca Bridge] Fatura arşivi açılıyor:",
      startDate,
      endDate
    )

    const archiveLink =
      Array.from(
        document.querySelectorAll("a[href]")
      ).find(link =>
        String(
          link.getAttribute("href") || ""
        ).includes(
          "/OutgoingInvoice/OutgoingArchiveList"
        )
      )

    if (archiveLink) {
      archiveLink.click()
    } else {
      const url =
        `/OutgoingInvoice/OutgoingArchiveList?minDate=${encodeURIComponent(
          startDate
        )}&maxDate=${encodeURIComponent(
          endDate
        )}`

      location.href = url
    }

    await sleep(2500)
  }

  async function loginIfNeeded(task) {
    const email =
      document.querySelector(
        "#validation-email"
      )

    const password =
      document.querySelector(
        "#validation-password"
      )

    const loginButton =
      document.querySelector(
        "#loginBtn"
      )

    if (!email || !password || !loginButton) {
      return false
    }

    console.log(
      "[PenPOS Luca Bridge] Luca giriş ekranı bulundu."
    )

    email.value =
      task.tckn || ""

    password.value =
      task.password || ""

    email.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    )

    password.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    )

    await sleep(300)

    loginButton.click()

    await sleep(3000)

    return true
  }

  // Luca oturumu yoksa giriş ekranını doldurup oturumu açar.
  //
  // TÜM görev türleri (check / create / send) buradan geçer ve göreve özel
  // dallara (runCreateTask / runSendTask) geçilmeden ÖNCE çağrılmalıdır.
  // Aksi halde create/send görevleri giriş yapılmadan korumalı
  // /Invoice/CreateQuick sayfasına gider, alanlar boş kalır ve görev
  // sessizce başarısız olur.
  async function ensureLucaLogin(task) {
    const isLoginPage = () =>
      location.pathname
        .toLowerCase()
        .includes("/account/login")

    // Giriş ekranı değilse oturum açıktır, hiçbir şey yapma.
    if (!isLoginPage()) {
      return
    }

    console.log(
      "[PenPOS Luca Bridge] Luca oturumu yok, giriş yapılıyor..."
    )

    await loginIfNeeded(task)

    await sleep(2500)

    if (isLoginPage()) {
      throw new Error(
        "Luca giriş yapılamadı."
      )
    }
  }

  async function runArchiveTask(task) {
    // DÖNEM ZORUNLUDUR. Tarih filtresi uygulanmadan taranan liste TÜM
    // arşivdir: kullanıcı "494 fatura bulundu" görüyordu ve kontrol
    // anlamsızlaşıyordu. Dönem yoksa TARAMA YAPILMAZ, net hata verilir.
    const dates = getPeriodDates(task?.period)

    if (!dates.startDate || !dates.endDate) {
      throw new Error(
        `Kontrol dönemi belirlenemedi (gelen değer: ${JSON.stringify(task?.period ?? null)}). ` +
        'Luca kontrolü "Faturaları Kontrol Et" düğmesinden, seçili dönem ile başlatılmalı. ' +
        'Sayfayı yenileyip tekrar deneyin.'
      )
    }

    await setLucaDateRange(task.period)

    await sleep(500)

    await waitForFreshArchiveResults(clickAra)

    await setPageLength()

    await sleep(800)

    // Sayfalama sıfırlanır AMA filtre TEMİZLENMEZ: az önce kurduğumuz
    // dönem filtresi korunmalıdır (clearFilters varsayılanı sunucu tarafı
    // kalıntıları silerdi ve kontrol TÜM arşivi tarardı -> 494 fatura).
    const paging =
      await sendResetPaging({
        clearFilters: false
      })

    if (paging?.ok) {
      console.log(
        "[PenPOS Luca Bridge] Luca sayfalama başa alındı:",
        paging
      )
    }

    await sleep(600)

    // Güvenlik ağı: filtre GERÇEKTEN uygulandı mı?
    //
    // DİKKAT: Luca tarih filtresini #reportrange input'unda değil,
    // window.invoiceFirstDate / window.invoiceLastDate GLOBALİNDE ve URL'de
    // tutar; input boş olsa bile filtre açık olabilir. Bu yüzden doğrulama
    // arka planın MAIN world'den bildirdiği global değerlerden yapılır
    // (content.js ISOLATED world'de window'a erişemez).
    const appliedRange = String(
      paging?.dateRange?.input ||
      document.querySelector("#reportrange")?.value ||
      ""
    ).trim()
    const appliedFirst =
      String(paging?.dateRange?.first || "").trim()

    if (appliedFirst) {
      console.log(
        "[PenPOS Luca Bridge] Luca kontrolü dönem filtresi:",
        appliedRange || appliedFirst,
        `(${dates.startDate} .. ${dates.endDate})`
      )
    } else {
      throw new Error(
        'Luca tarih filtresi uygulanamadı (Luca\'nın filtre değerleri boş). ' +
        'Kontrol TÜM arşivi tarayacağı için durduruldu; Luca sayfasında "Ara" ' +
        'filtresini temizleyip tekrar deneyin.'
      )
    }

    const invoices =
      await scrapeInvoices()

    const filteredInvoices = task.targetInvoiceNo
      ? invoices.filter(invoice => String(invoice.faturaNo || '') === String(task.targetInvoiceNo))
      : invoices

    console.log(
      "[PenPOS Luca Bridge] Toplam bulunan fatura:",
      filteredInvoices.length,
      `(dönem: ${appliedRange || appliedFirst})`
    )

    await sendInvoicesToBackground(
      task,
      filteredInvoices
    )
  }

  function setCreateField(selector, value) {
    const element = document.querySelector(selector)
    if (!element || value === undefined || value === null) return false
    element.value = String(value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }

  // ============================================================
  // Müşteri eşleştirme yardımcıları
  // ============================================================

  // PenPOS invoiceCustomerMatchBy değerlerini ve eski anlamsal adları
  // Luca araması için kullanılan moda çevirir: student / tax / student_tax.
  function resolveCustomerMode(item) {
    const raw = String(
      item.customerMatchBy ||
      item.invoiceCustomerMatchBy ||
      item.customerSearchMode ||
      ""
    ).trim().toLowerCase()

    const aliases = {
      studentname: "student",
      tckn: "tax",
      vkn: "tax",
      nameandtckn: "student_tax",
      nameandtc: "student_tax"
    }

    if (aliases[raw]) {
      return aliases[raw]
    }

    if (
      raw === "student" ||
      raw === "tax" ||
      raw === "student_tax"
    ) {
      return raw
    }

    // Eski görevlerde mod bilgisi yoksa customerSearchValue ipucu kullanılır:
    // arama değeri yalnızca TCKN ise mod tax'tır.
    const searchValue =
      String(item.customerSearchValue || "").trim()

    const taxValue =
      digitsOnly(item.taxId || item.vknTckn || "")

    if (
      searchValue &&
      taxValue &&
      searchValue.replace(/\D/g, "") === taxValue
    ) {
      return "tax"
    }

    return "student"
  }

  function normalizeNameForMatch(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .replace(/İ/g, "i")
      .replace(/[^a-z0-9çğıöşü ]/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "")
  }

  // ISO (YYYY-MM-DD) veya DD.MM.YYYY -> Luca'nın kullandığı DD-MM-YYYY.
  // Gerçek alan: <input id="InvoiceDate" data-date-format="DD-MM-YYYY">
  function toLucaDate(value) {
    const text = String(value || "").trim()
    if (!text) return ""

    const iso =
      text.match(/^(\d{4})-(\d{2})-(\d{2})/)

    if (iso) {
      return `${iso[3]}-${iso[2]}-${iso[1]}`
    }

    const local =
      text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)

    if (local) {
      return `${local[1]}-${local[2]}-${local[3]}`
    }

    return text
  }

  // Luca virgüllü ondalık biçimi (accounting.js): "1200,00"
  function formatCommaAmount(value) {
    const number = parseAmountValue(value, 0)
    if (!Number.isFinite(number)) return "0"
    return String(number.toFixed(2)).replace(".", ",")
  }

  // PenPOS KDV oranı yüzde olarak gelir (%20 -> 20); kesir (0.2) da kabul.
  function normalizeVatRate(value) {
    const number = Number(
      String(value ?? "").replace(",", ".")
    )

    if (!Number.isFinite(number) || number < 0) {
      return "0"
    }

    if (number > 0 && number < 1) {
      return String(Math.round(number * 100))
    }

    return String(Math.round(number))
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
  }

  // ============================================================
  // Luca onay penceresi (SweetAlert 1.x) — GERÇEK DOM/JS
  // ============================================================
  //
  // Luca sayfaları sweetalert.js v1 kullanıyor (bundled "sweetalert.js",
  // 5.4 MB bundle içinde "./handle-swal-dom" + "./modules/handle-click").
  // Gerçek şablon (handle-swal-dom -> injected-html):
  //
  //   <div class="sweet-overlay" tabindex="-1"></div>
  //   <div class="sweet-alert" tabindex="-1">
  //     <div class="sa-icon sa-warning">…</div>
  //     <h2>Title</h2>
  //     <p class="lead text-muted">Text</p>
  //     <div class="sa-button-container">
  //       <button class="cancel btn btn-lg">…</button>
  //       <button class="confirm btn btn-lg">…</button>
  //     </div>
  //   </div>
  //
  // ÖNEMLİ GERÇEKLER (set-params / handle-click kaynaklarından):
  //  * Başlık -> modal içindeki <h2>, metin -> ilk <p>.
  //  * swal() AYNI .sweet-alert elementini yeniden kullanır. close() elementi
  //    DOM'DAN SİLMEZ; sadece "visible" class'ını kaldırıp "hideSweetAlert"
  //    ekler. Bu yüzden "pencere açık mı" sorusu YALNIZCA showSweetAlert
  //    class'ıyla cevaplanır.
  //  * openModal() "showSweetAlert" class'ını anında, "visible" class'ını ise
  //    setTimeout(..., 500) ile 500 ms SONRA ekler. handleClick de
  //    `hasClass(modal, "visible")` şartını arar: visible olmadan tıklanan
  //    buton doneFunction'ı ÇALIŞTIRMAZ, sadece pencereyi kapatır.
  //    => Otomatik onay MUTLAKA .visible class'ı gelene kadar beklemelidir.
  //  * handle-click, modal içindeki TÜM butonlara aynı onclick'i verir ve
  //    butonun class'ında "confirm" geçip geçmediğine bakar. Bu yüzden
  //    element.click() (gerçek "click" tipi MouseEvent) kullanılır.
  //  * showLoaderOnConfirm -> disableButtons() her iki butonu da disabled
  //    yapar; ikinci tıklama zaten etkisizdir.
  function readLucaSwal() {
    const modal = document.querySelector(".sweet-alert")

    if (!modal) {
      return null
    }

    const className = String(modal.className || "")

    return {
      element: modal,
      open: className.includes("showSweetAlert"),
      // handle-click'in confirm/cancel callback'ini çalıştırması için şart.
      interactive:
        className.includes("showSweetAlert") &&
        className.includes("visible"),
      type:
        (className.match(/sa-(error|warning|info|success)\b/) || [])[1] ||
        "",
      title: normalizeText(modal.querySelector("h2")?.innerText),
      text: normalizeText(modal.querySelector("p")?.innerText),
      buttons: Array.from(
        modal.querySelectorAll(".sa-button-container button")
      ).map(button => ({
        element: button,
        role: button.classList.contains("confirm")
          ? "confirm"
          : button.classList.contains("cancel")
            ? "cancel"
            : "unknown",
        label: normalizeText(button.innerText),
        disabled: button.disabled === true
      }))
    }
  }

  // Luca onay penceresinde onay butonunu tıklar — AMA YALNIZCA
  //   * başlık TAM eşleşiyorsa,
  //   * metin şartı varsa TAM eşleşiyorsa,
  //   * onay butonunun metni TAM eşleşiyorsa.
  //
  // Neden başlık şartı zorunlu: Luca staging listesinde "Gönder",
  // "Raporla", "Klonla", "Sil", "Fatura Tekrar Gönderimi", "Onay" gibi
  // pek çok pencerenin onay butonu "Onayla"dır. Sadece buton metnine
  // bakmak "Sil" onayına basmaya yol açar.
  //
  // Dönüş değerleri (çağıran taraf bunları loglar/şartlandırır):
  //   "closed" | "other-popup" | "text-mismatch" | "not-clickable-yet"
  //   | "no-confirm-button" | "disabled" | "confirmed"
  function confirmLucaSwal(title, confirmLabel, options = {}) {
    const swal = readLucaSwal()

    if (!swal || !swal.open) {
      return "closed"
    }

    if (swal.title !== normalizeText(title)) {
      return "other-popup"
    }

    if (
      options.text &&
      !swal.text.includes(normalizeText(options.text))
    ) {
      return "text-mismatch"
    }

    if (!swal.interactive) {
      // handle-click "visible" class'ı olmadan confirm callback'ini
      // çalıştırmaz; erken tıklama pencereyi kapatıp akışı öldürür.
      return "not-clickable-yet"
    }

    const button = swal.buttons.find(
      entry => entry.role === "confirm"
    )

    if (!button) {
      return "no-confirm-button"
    }

    if (button.label !== normalizeText(confirmLabel)) {
      return "other-popup"
    }

    if (button.disabled) {
      return "disabled"
    }

    button.element.click()

    return "confirmed"
  }

  // Açık bir Luca SONUÇ penceresini kapatır.
  //
  // YALNIZCA doneFunction'ı OLMAYAN sonuç pencerelerinde güvenlidir: gönderim
  // başarı penceresi ("Seçili faturalar başarıyla gönderilmiştir.")
  // tek başlıklıdır ve onay butonu yalnızca pencereyi kapatır.
  //
  // Fatura kaydetme BAŞARI penceresi ("Yeni Fatura Oluştur!" /
  // "Taslaklara git!") doneFunction'ı navigasyon YAPAR; bu yüzden
  // closeLucaResultSwal ile ASLA kapatılmaz — yalnızca metni okunur.
  //
  // openModal "visible" class'ını 500 ms SONRA eklediği için kapatma
  // hemen denemek yerine görünür/tıklanabilir olana kadar bekler.
  async function closeLucaResultSwal(title) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const swal = readLucaSwal()

      if (!swal || !swal.open) {
        return true
      }

      if (swal.title !== normalizeText(title)) {
        return false
      }

      const button = swal.buttons.find(entry => entry.role === "confirm")

      if (!button) {
        return false
      }

      if (button.disabled || !swal.interactive) {
        await sleep(100)

        continue
      }

      button.element.click()

      return true
    }

    return false
  }

  // Gerçek Luca pencereleri (başlık -> onay butonu metni):
  //   "Müşteri Ekleme"        -> "Evet"          (alıcı kaydı)
  //   "Fatura Kaydedilecek"   -> "Evet Kaydedelim !"  (taslak kaydı)
  //   "Gönder"                -> "Onayla"        (taslak gönderimi)
  //   "Fatura Kaydetme"       -> "OK"            (kaydetme sonucu)
  //   "Sil" / "Klonla" / "Raporla" / "Fatura Tekrar Gönderimi" -> "Onayla"
  // Müşteri "Evet" onayı ile fatura "Evet Kaydedelim !" onayı
  // BAŞLIK + BUTON METNİ ikisinden birlikte ayrılır.
  const LUCA_RECIPIENT_CONFIRM_TITLE = "Müşteri Ekleme"
  const LUCA_RECIPIENT_CONFIRM_LABEL = "Evet"

  // Luca'nın "#CustomerActions" bağlantısı gerçek DOM'da:
  //   <a href="javascript: void(0);" onclick="createRecipient()">
  // Gerçek Luca testi, element.click() gibi element.dispatchEvent(new
  // MouseEvent("click")) çağrısının da anchor'ın "javascript:" varsayılan
  // eylemini çalıştırdığını ve Chrome CSP'sini ihlal ettiğini gösterdi:
  //   "Running the JavaScript URL violates Content Security Policy..."
  // Bu yüzden anchor'a HİÇ click göndermiyoruz. Yeni müşteri formu main
  // dünyada (background -> chrome.scripting.executeScript, world:"MAIN")
  // Luca'nın GERÇEK createRecipient() fonksiyonu doğrudan çağrılarak açılır;
  // fonksiyon yoksa gerçek element.onclick işleyicisi doğrudan çalıştırılır.
  async function openLucaRecipientForm() {
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      typeof chrome.runtime.sendMessage !== "function"
    ) {
      throw new Error(
        "Chrome Extension runtime bağlantısı bulunamadı."
      )
    }

    const response =
      await chrome.runtime.sendMessage({
        type: "PENPOS_LUCA_OPEN_RECIPIENT_MODAL"
      })

    if (!response?.ok) {
      throw new Error(
        response?.error ||
        response?.reason ||
        "Luca 'Yeni Müşteri Ekle' formu açılamadı."
      )
    }

    console.log(
      "[PenPOS Luca Bridge] Yeni müşteri formu açıldı:",
      response.via || ""
    )

    return response
  }

  // <select> değerini gerçek DOM olayıyla değiştirir (değer + bubbled change).
  // Luca'nın inline onchange="GetCounty()" gibi native dinleyicileri bu
  // şekilde çalışır; "sadece input value atamak" yeterli değildir.
  function setSelectField(selector, value) {
    const select = document.querySelector(selector)
    if (!select || value === undefined || value === null || value === "") {
      return false
    }
    select.value = String(value)
    select.dispatchEvent(new Event("change", { bubbles: true }))
    return true
  }

  // Bir <select> seçeneğini beklenen metne göre puanlar. Tam metin en yüksek
  // puandır; tek taraflı içerme ve token isabetleri ek puan verir. preferVergi,
  // vergi dairesi listesinde "VERGİ DAİRESİ" içeren seçeneği öne alır
  // ("... MAL MÜDÜRLÜĞÜ" ile karışmasın).
  function scoreSelectOption(option, expectedNorm, preferVergi) {
    const optionText = String(
      option.textContent || option.innerText || option.text || ""
    )
    const textNorm = normalizeNameForMatch(optionText)
    if (!textNorm) return 0

    let score = 0

    if (textNorm === expectedNorm) {
      score += 100
    }

    if (
      textNorm.includes(expectedNorm) ||
      expectedNorm.includes(textNorm)
    ) {
      score += 60
    }

    const tokens = expectedNorm
      .split(" ")
      .filter(token => token.length >= 3)

    const hits = tokens.filter(token =>
      textNorm.includes(token)
    ).length

    score += hits * 25

    if (preferVergi && /vergi/.test(textNorm)) {
      score += 10
    }

    return score
  }

  // Gerçek Luca <select>'inde beklenen metne en iyi uyan seçeneği döndürür;
  // bulunamazsa null. "Seçiniz" placeholder seçenekleri asla seçilmez.
  // Skor eşitliği (belirsizlik) varsa null döner - yanlış seçenek seçilmez.
  function matchSelectOption(select, expectedText, preferVergi) {
    if (!select || !select.options) return null

    const expectedNorm =
      normalizeNameForMatch(expectedText)

    if (!expectedNorm) return null

    let best = null
    let bestScore = 0
    let tie = false

    for (const option of Array.from(select.options)) {
      const optionText = String(
        option.textContent || option.innerText || option.text || ""
      )

      if (/seçiniz|seciniz/i.test(normalizeNameForMatch(optionText))) {
        continue
      }

      const value = String(option.value ?? "")

      if (value === "-1" || value === "") {
        continue
      }

      const score =
        scoreSelectOption(option, expectedNorm, preferVergi)

      if (score > bestScore) {
        bestScore = score
        best = option
        tie = false
      } else if (score === bestScore && score > 0) {
        tie = true
      }
    }

    if (tie || !best || bestScore < 40) {
      return null
    }

    return best
  }

  // Seçili <option>'un metnini döndürür (seçili değerle karşılaştırma yapar;
  // hem gerçek DOM hem test sandbox'ıyla çalışır).
  function selectedOptionText(select) {
    if (!select || !select.options) return ""
    const value = String(select.value ?? "")
    const options = Array.from(select.options || [])
    const found = options.find(option =>
      String(option.value ?? "") === value
    )
    if (!found) return ""
    return String(
      found.textContent || found.innerText || found.text || ""
    ).trim()
  }

  // Luca'da İl (#CityId) değişince GetCounty() AJAX ile #Ilce listesini
  // doldurur. Liste yüklenene dek bekler; placeholder dışı seçenek sayısını
  // döndürür (0 = yüklenemedi).
  async function waitForIlceOptions(ilceSelect, timeout) {
    const started = Date.now()

    while (Date.now() - started < timeout) {
      const select =
        ilceSelect ||
        document.querySelector("#EmptyModal select[id=Ilce]")

      if (select && select.options) {
        const count =
          Array.prototype.slice.call(select.options)
            .filter(option => {
              const value = String(option.value ?? "")
              const text = normalizeNameForMatch(
                String(option.textContent || option.innerText || option.text || "")
              )
              const placeholder =
                value === "-1" ||
                value === "" ||
                /seçiniz|seciniz/.test(text)
              return !placeholder
            })
            .length

        if (count > 0) {
          return count
        }
      }

      await sleep(250)
    }

    return 0
  }

  // Luca, VKN/TCKN değişiminde setNameInfo()/setAddressInfo() ile
  // ../Recipient/GetUserInfoFromTurmobService çağrılarını başlatır ve
  // #RecipientExtraInfo üzerinde bir yükleme katmanı gösterir. Bu çağrılar geç
  // yanıtlandığında setRecipientAddresDefaultValue() çalışıp İl/İlçe/Vergi
  // Dairesi seçimlerini SIFIRLAR (İl "Seçiniz"e döner). Bu yüzden alanları
  // doldurmadan önce yüklemenin bitmesi beklenir.
  function isRecipientLoading() {
    const modal = document.querySelector("#EmptyModal")

    if (!modal || typeof modal.querySelectorAll !== "function") {
      return false
    }

    const candidates =
      modal.querySelectorAll(
        ".js-loading-overlay, .js-loading-indicator, " +
        ".loading-overlay, .loading"
      )

    for (const element of Array.from(candidates)) {
      const visible =
        typeof element.getClientRects === "function"
          ? element.getClientRects().length > 0
          : element.offsetParent !== null

      if (visible) return true
    }

    return false
  }

  // Luca'nın VKN/TCKN kaynaklı async çağrıları bitene dek bekler; ardından
  // kısa bir "sessizlik" penceresi bırakır (geç gelen yanıtları yakalamak için).
  async function waitForRecipientSettle(timeoutMs) {
    const started = Date.now()

    while (
      isRecipientLoading() &&
      Date.now() - started < timeoutMs
    ) {
      await sleep(150)
    }

    await sleep(700)

    return !isRecipientLoading()
  }

  // Luca yeni müşteri formundaki adres alanlarını gerçek <select> akışıyla
  // doldurur (yeniden çalıştırılabilir; zaten doğru olan alanı tekrar yazmaz):
  //   1) #CityId (İl) seç -> change -> GetCounty()
  //   2) #Ilce (İlçe) AJAX listesi YÜKLENENE DEK bekle
  //   3) #Ilce (İlçe) seç
  //   4) #VergiDairesi seç (gerçek Luca dropdown'ından)
  //   5) #MahalleSokak (öğrencinin sistemde kayıtlı adresi varsa)
  // Öncelik: öğrencinin yapılandırılmış il/ilçe/vergi dairesi (studentCity/
  // studentDistrict/studentTaxOffice); yoksa Anaokulu/Firma ayarlarındaki
  // fatura bilgileri (firmCity/firmDistrict/firmTaxOffice).
  // Eşleştirilen Luca <option> değerlerini döndürür (DOM doğrulaması için).
  async function fillRecipientAddress({
    city, district, taxOffice, street
  }) {
    const cityNorm = normalizeNameForMatch(city)
    const districtNorm = normalizeNameForMatch(district)
    const taxOfficeNorm = normalizeNameForMatch(taxOffice)

    const citySelect =
      document.querySelector("#EmptyModal select[id=CityId]")

    if (!citySelect) {
      throw new Error(
        "Luca müşteri formunda İl alanı bulunamadı (#CityId)."
      )
    }

    if (!cityNorm) {
      throw new Error(
        "Müşteri İl bilgisi boş: Anaokulu/Firma ayarlarındaki fatura İl alanını doldurun (invoiceSettings.city)."
      )
    }

    if (!districtNorm) {
      throw new Error(
        "Müşteri İlçe bilgisi boş: Anaokulu/Firma ayarlarındaki fatura İlçe alanını doldurun (invoiceSettings.district)."
      )
    }

    const cityOption = matchSelectOption(citySelect, city, false)

    if (!cityOption) {
      throw new Error(
        `Luca İl listesinde "${city}" bulunamadı.`
      )
    }

    const ilceSelect =
      document.querySelector("#EmptyModal select[id=Ilce]")

    if (!ilceSelect) {
      throw new Error(
        "Luca müşteri formunda İlçe alanı bulunamadı (#Ilce)."
      )
    }

    // İl: değer değişecekse GERÇEK Luca akışıyla (değer + change -> GetCounty)
    // seç. Bir önceki şehre ait ilçe seçenekleriyle eşleşmemek için #Ilce
    // listesini biz de boşaltırız; GetCounty() zaten baştan doldurur.
    const desiredCity = String(cityOption.value || "")

    if (String(citySelect.value || "") !== desiredCity) {
      if (typeof ilceSelect.replaceChildren === "function") {
        ilceSelect.replaceChildren()
      } else {
        ilceSelect.innerHTML = ""
      }

      setSelectField(
        "#EmptyModal select[id=CityId]",
        desiredCity
      )
    }

    const ilceCount = await waitForIlceOptions(ilceSelect, 12000)

    if (!ilceCount) {
      throw new Error(
        `Luca "${city}" için İlçe listesini yükleyemedi (#Ilce boş kaldı).`
      )
    }

    const ilceOption = matchSelectOption(ilceSelect, district, false)

    if (!ilceOption) {
      throw new Error(
        `Luca İlçe listesinde "${district}" bulunamadı (${ilceCount} ilçe yüklendi).`
      )
    }

    if (
      String(ilceSelect.value || "") !==
      String(ilceOption.value || "")
    ) {
      setSelectField(
        "#EmptyModal select[id=Ilce]",
        ilceOption.value
      )
    }

    await sleep(200)

    const vergiSelect =
      document.querySelector("#EmptyModal select[id=VergiDairesi]")

    if (!vergiSelect) {
      throw new Error(
        "Luca müşteri formunda Vergi Dairesi alanı bulunamadı (#VergiDairesi)."
      )
    }

    if (!taxOfficeNorm) {
      throw new Error(
        "Müşteri Vergi Dairesi bilgisi boş: Anaokulu/Firma ayarlarındaki fatura Vergi Dairesi alanını doldurun (invoiceSettings.taxOffice)."
      )
    }

    const vergiOption = matchSelectOption(vergiSelect, taxOffice, true)

    if (!vergiOption) {
      throw new Error(
        `Luca Vergi Dairesi listesinde "${taxOffice}" bulunamadı.`
      )
    }

    if (
      String(vergiSelect.value || "") !==
      String(vergiOption.value || "")
    ) {
      setSelectField(
        "#EmptyModal select[id=VergiDairesi]",
        vergiOption.value
      )
    }

    if (street) {
      setCreateField("#EmptyModal #MahalleSokak", street)
    }

    await sleep(200)

    console.log(
      "[PenPOS Luca Bridge] Yeni müşteri adresi dolduruldu:",
      { city, district, taxOffice, street: street || "" }
    )

    // Kaydetmeden önce DOM'da doğrulanacak seçili değerler:
    // eşleştirilen Luca seçeneklerinin value alanları.
    return {
      cityValue: desiredCity,
      ilceValue: String(ilceOption.value || ""),
      vergiValue: String(vergiOption.value || "")
    }
  }

  // jquery-typeahead 2.7.6 (tomcnt) ile gerçek arama: input'a yaz, native
  // input/keyup olayını tetikle (lib dinleyicileri native'dir), çıkan
  // li.typeahead__item listesinden en iyi eşleşmeyi döndür.
  async function searchAliciTypeahead(terms) {
    const input =
      document.querySelector("#Alici")

    if (!input) {
      return { items: [] }
    }

    for (const term of terms) {
      const value =
        String(term ?? "").trim()

      if (value.length < 3) {
        continue
      }

      input.focus?.({ preventScroll: true })

      setCreateField("#Alici", value)

      input.dispatchEvent(
        new KeyboardEvent("keyup", {
          bubbles: true,
          key: value.slice(-1) || "a"
        })
      )

      await sleep(1000)

      const container =
        input.closest(".typeahead__container") ||
        document.querySelector(
          "#GetReciepent"
        )

      const items = container
        ? Array.from(
          container.querySelectorAll(
            ".typeahead__list .typeahead__item"
          )
        )
        : []

      if (items.length) {
        return { items, term: value }
      }
    }

    return { items: [] }
  }

  function scoreAliciItem(itemElement, nameNorm, taxDigits) {
    const text =
      String(
        itemElement.innerText ||
        itemElement.textContent ||
        ""
      ).replace(/\s+/g, " ").trim()

    const norm =
      normalizeNameForMatch(text)

    const asDigits =
      digitsOnly(text)

    let score = 0

    if (nameNorm && norm.includes(nameNorm)) {
      score += 100
    }

    if (nameNorm) {
      const tokens =
        nameNorm.split(" ")

      const hits = tokens.filter(token =>
        token.length >= 3 && norm.includes(token)
      ).length

      score += Math.min(hits * 30, 90)
    }

    if (taxDigits && asDigits.includes(taxDigits)) {
      score += 60
    }

    return score
  }

  // PenPOS ayarına (invoiceCustomerMatchBy) göre Luca'da müşteriyi arar ve
  // gerçek typeahead akışıyla SEÇER. #AliciId'nin dolduğunu doğrular.
  // Müşteri lisansı ÖĞRENCİ üzerinden kurulur: ad önce item.studentName,
  // TCKN ise item.taxId (öğrencinin TC Kimlik No) ile aranır.
  async function selectLucaCustomer(item) {
    const mode = resolveCustomerMode(item)

    const name =
      String(
        item.studentName ||
        item.recipientName ||
        item.buyer ||
        item.customerName ||
        ""
      ).trim()

    const tax =
      digitsOnly(
        item.taxId ||
        item.vknTckn ||
        item.customerTaxId ||
        ""
      )

    const nameNorm =
      normalizeNameForMatch(name)

    const orders =
      mode === "tax"
        ? [
          [tax, name].filter(Boolean),
          []
        ]
        : mode === "student_tax"
          ? [
            [name, tax].filter(Boolean),
            [tax, name].filter(Boolean)
          ]
          : [
            [name, tax].filter(Boolean),
            [tax, name].filter(Boolean)
          ]

    for (const order of orders) {
      if (!order.length) {
        continue
      }

      const { items } =
        await searchAliciTypeahead(order)

      if (!items.length) {
        continue
      }

      let best = null
      let bestScore = 0

      for (const element of items) {
        const score =
          scoreAliciItem(
            element,
            nameNorm,
            tax
          )

        if (score > bestScore) {
          bestScore = score
          best = element
        }
      }

      if (!best) {
        continue
      }

      // Kesin eşleşme olmayan bir öğeyi tıklamak yanlış müşteriyi seçerdi;
      // emin değilsek "Yeni Müşteri Ekle" akışına geçilir.
      const pickThreshold =
        mode === "tax" && !nameNorm
          ? 30
          : 40

      if (bestScore < pickThreshold) {
        continue
      }

      best.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        })
      )

      // #AliciId dolana kadar bekle (Luca onClickBefore senkron doldurur).
      const id = await waitForAliciId(8000)

      if (!id) {
        continue
      }

      const selectedText =
        String(
          document.querySelector("#Alici")?.value || ""
        )

      const selectedNorm =
        normalizeNameForMatch(selectedText)

      const okForName =
        nameNorm &&
        selectedNorm &&
        (
          selectedNorm.includes(nameNorm) ||
          nameNorm.includes(selectedNorm)
        )

      const okForTax =
        tax &&
        digitsOnly(selectedText).includes(tax)

      if (okForName || okForTax) {
        console.log(
          "[PenPOS Luca Bridge] Luca müşterisi seçildi:",
          selectedText,
          "(mod:",
          mode,
          ")"
        )

        return true
      }

      // Seçilen müşteri PenPOS'taki müşteriyle eşleşmiyor.
      continue
    }

    return false
  }

  async function waitForAliciId(timeout) {
    const started = Date.now()

    while (Date.now() - started < timeout) {
      const value =
        digitsOnly(
          document.querySelector("#AliciId")?.value || ""
        )

      if (value && Number(value) > 0) {
        return value
      }

      await sleep(200)
    }

    return ""
  }

  // "Yeni Müşteri Ekle": Luca /Recipient/Create formunu doldurur, Bireysel +
  // Kağıt + adres (İl/İlçe/Vergi Dairesi) durumunu DOM'da doğrular, kaydeder
  // ve "Müşteri Ekleme" onayını ("Evet" - TAM METİN) onaylar.
  // "Evet Kaydedelim !" asla tıklanmaz. Müşteri bilgisi ÖĞRENCİden gelir:
  // ad = item.studentName, TCKN = item.taxId (VELİ bilgisi kullanılmaz).
  async function createLucaRecipient(item) {
    const name =
      String(
        item.studentName ||
        item.recipientName ||
        item.buyer ||
        item.customerName ||
        ""
      ).trim()

    const tax =
      digitsOnly(
        item.taxId ||
        item.vknTckn ||
        item.customerTaxId ||
        ""
      )

    if (!name) {
      throw new Error(
        "Yeni müşteri oluşturmak için müşteri adı bulunamadı."
      )
    }

    if (!tax) {
      throw new Error(
        "Yeni müşteri oluşturmak için TC Kimlik No bulunamadı."
      )
    }

    const addButton =
      await waitForElement("#CustomerActions", 15000)

    if (!addButton) {
      throw new Error(
        "Luca müşteri ekleme düğmesi bulunamadı (#CustomerActions)."
      )
    }

    // #CustomerActions <a href="javascript: void(0);" onclick="createRecipient()">
    // anchor'ına click GÖNDERİLMEZ (javascript: URL CSP ihlali üretir). Main
    // dünyada Luca'nın gerçek createRecipient() fonksiyonu doğrudan çağrılır.
    await openLucaRecipientForm()

    const vknField =
      await waitForElement("#EmptyModal #VknTckn", 15000)

    if (!vknField) {
      throw new Error(
        "Luca müşteri ekleme formu açılamadı (#EmptyModal #VknTckn)."
      )
    }

    setCreateField("#EmptyModal #GibUser", name)
    setCreateField("#EmptyModal #VknTckn", tax)

    // VKN/TCKN değişimi Luca'da setNameInfo()/setAddressInfo() async TÜRMOB
    // çağrılarını tetikler; bunlar #GibUser'ı ve adres alanlarını geç saatte
    // EZEBİLİR. Önce bu çağrıların bitmesini (yükleme katmanının kalkmasını)
    // bekleriz; sonra öğrencinin adını yeniden yazarız.
    await waitForRecipientSettle(12000)

    setCreateField("#EmptyModal #GibUser", name)

    // Bireysel + Kağıt: Luca'nın KENDİ kodundaki gibi radio'yu işaretle,
    // change olayını tetikle ve label'ı aktifleştir.
    const bireysel =
      document.querySelector(
        '#EmptyModal input[name="AliciTipi"][value="1"]'
      )

    if (bireysel) {
      bireysel.checked = true
      bireysel.dispatchEvent(
        new Event("change", { bubbles: true })
      )
      const label =
        bireysel.closest("label")
      if (label) label.classList.add("active")
    }

    const kagit =
      document.querySelector(
        '#EmptyModal input[name="GonderimSekli"][value="2"]'
      )

    if (kagit) {
      kagit.checked = true
      kagit.dispatchEvent(
        new Event("change", { bubbles: true })
      )
      const label =
        kagit.closest("label")
      if (label) label.classList.add("active")
    }

    // Adres: İl -> (İlçe listesi yüklenene dek bekle) -> İlçe -> Vergi Dairesi.
    // Öncelik: öğrencinin yapılandırılmış adresi; yoksa firma ayarları.
    const addressOptions = {
      city: String(item.studentCity || item.firmCity || "").trim(),
      district: String(item.studentDistrict || item.firmDistrict || "").trim(),
      taxOffice: String(item.studentTaxOffice || item.firmTaxOffice || "").trim(),
      street: String(item.studentAddress || "").trim()
    }

    // Luca'nın VKN/TCKN değişiminde başlattığı TÜRMOB çağrıları geç yanıtlanıp
    // adres seçimlerini (özellikle İl'i "Seçiniz"e) sıfırlayabildiği için
    // alanları "uygula -> DOM'dan doğrula" döngüsüyle KARARLI hale getiririz:
    // değerler üst üste iki okumada da eşleşmeden kaydetmeye geçilmez.
    const readRecipientAddressState = () => {
      const currentCity =
        document.querySelector("#EmptyModal select[id=CityId]")
      const currentIlce =
        document.querySelector("#EmptyModal select[id=Ilce]")
      const currentVergi =
        document.querySelector("#EmptyModal select[id=VergiDairesi]")

      return {
        cityValue: String(currentCity?.value || ""),
        ilceValue: String(currentIlce?.value || ""),
        vergiValue: String(currentVergi?.value || ""),
        cityText: selectedOptionText(currentCity),
        ilceText: selectedOptionText(currentIlce),
        vergiText: selectedOptionText(currentVergi)
      }
    }

    let addressValues = null
    let addressStableReads = 0
    let addressProblem = ""

    for (
      let attempt = 0;
      attempt < 6 && addressStableReads < 2;
      attempt += 1
    ) {
      if (attempt === 0 || addressProblem) {
        addressValues =
          await fillRecipientAddress(addressOptions)

        await sleep(300)
      }

      const state = readRecipientAddressState()

      if (
        !addressValues.cityValue ||
        state.cityValue !== addressValues.cityValue
      ) {
        addressProblem =
          `Müşteri İl alanı doğrulanamadı: "${state.cityText}" (beklenen İl değeri: "${addressValues.cityValue}").`
      } else if (
        !addressValues.ilceValue ||
        state.ilceValue !== addressValues.ilceValue
      ) {
        addressProblem =
          `Müşteri İlçe alanı doğrulanamadı: "${state.ilceText}" (beklenen İlçe değeri: "${addressValues.ilceValue}").`
      } else if (
        !addressValues.vergiValue ||
        state.vergiValue !== addressValues.vergiValue
      ) {
        addressProblem =
          `Müşteri Vergi Dairesi alanı doğrulanamadı: "${state.vergiText}" (beklenen Vergi Dairesi değeri: "${addressValues.vergiValue}").`
      } else {
        addressProblem = ""
      }

      if (addressProblem) {
        addressStableReads = 0
      } else {
        addressStableReads += 1

        await sleep(400)
      }
    }

    if (addressStableReads < 2) {
      throw new Error(
        addressProblem ||
        "Müşteri adres alanları Luca'da kararlı hale getirilemedi."
      )
    }

    const addressSelected = readRecipientAddressState()

    // Kaydetmeden ÖNCE form durumunu DOM'da doğrula (yanlış kayıt yaratma).
    const gibValue =
      String(
        document.querySelector("#EmptyModal #GibUser")?.value || ""
      ).trim()

    const vknValue =
      digitsOnly(
        document.querySelector("#EmptyModal #VknTckn")?.value || ""
      )

    const aliciTipi =
      String(
        document.querySelector(
          '#EmptyModal input[name="AliciTipi"]:checked'
        )?.value || ""
      )

    const gonderimSekli =
      String(
        document.querySelector(
          '#EmptyModal input[name="GonderimSekli"]:checked'
        )?.value || ""
      )

    if (
      normalizeNameForMatch(gibValue) !==
      normalizeNameForMatch(name)
    ) {
      throw new Error(
        `Müşteri adı doğrulanamadı: "${gibValue}" (beklenen: "${name}").`
      )
    }

    if (vknValue !== tax) {
      throw new Error(
        `VKN/TCKN doğrulanamadı: "${vknValue}" (beklenen: "${tax}").`
      )
    }

    if (aliciTipi !== "1") {
      throw new Error(
        "Müşteri Tipi Bireysel olarak seçilemedi."
      )
    }

    if (gonderimSekli !== "2") {
      throw new Error(
        "Gönderim Şekli Kağıt olarak seçilemedi."
      )
    }

    console.log(
      "[PenPOS Luca Bridge] Yeni müşteri doğrulandı:",
      {
        gibValue,
        vknValue,
        cityValue: addressSelected.cityValue,
        ilceValue: addressSelected.ilceValue,
        vergiValue: addressSelected.vergiValue,
        citySelected: addressSelected.cityText,
        ilceSelected: addressSelected.ilceText,
        vergiSelected: addressSelected.vergiText,
        aliciTipi,
        gonderimSekli
      }
    )

    const saveButton =
      await waitForElement("#EmptyModal #btnCreateRecipient", 15000)

    if (!saveButton) {
      throw new Error(
        "Müşteri kaydet düğmesi bulunamadı (#btnCreateRecipient)."
      )
    }

    saveButton.click()

    // Gerçek Luca alıcı kaydı onayı:
    //   swal({ title: "Müşteri Ekleme", text: "Müşteriyi eklemek istediğinize
    //           emin misiniz?", confirmButtonText: "Evet",
    //           cancelButtonText: "Hayır", closeOnConfirm: false })
    // SweetAlert 1.x "visible" class'ı 500 ms sonra eklendiği için
    // onay penceresi görünür + tıklanabilir olana kadar beklenir.
    let recipientConfirmed = false
    const recipientDeadline = Date.now() + 15000
    while (!recipientConfirmed && Date.now() < recipientDeadline) {
      const outcome = confirmLucaSwal(
        LUCA_RECIPIENT_CONFIRM_TITLE,
        LUCA_RECIPIENT_CONFIRM_LABEL
      )
      if (outcome === "confirmed") {
        recipientConfirmed = true
        console.log(
          "[PenPOS Luca Bridge] 'Müşteri Ekleme' onayı (Evet) tıklandı."
        )
        break
      }
      if (outcome === "closed" || outcome === "other-popup") {
        // "Müşteri Ekleme" penceresi hiç açılmadıysa (ör. VKN/TCKN uyarısı
        // ya da önceki bir hata penceresi) akış zaten duracaktır; boşuna
        // beklemeden sonraki adıma geç.
        break
      }
      await sleep(200)
    }

    if (!recipientConfirmed) {
      console.warn(
        "[PenPOS Luca Bridge] 'Müşteri Ekleme' onayı otomatik verilemedi; Luca'nın kendi onayı bekleniyor."
      )
    }

    // Sonuç: başarı -> modal kapanır ve #AliciId dolar;
    // hata -> $.notify ({ type: 'danger' }) mesajı görünür.
    const deadline = Date.now() + 30000

    const modalHidden = () => {
      const modal =
        document.querySelector("#EmptyModal")

      if (!modal) return true

      const style =
        window.getComputedStyle(modal)

      return (
        style.display === "none" ||
        modal.getAttribute("aria-hidden") === "true"
      )
    }

    const notifyText = () =>
      Array.from(
        document.querySelectorAll(
          ".notifyjs-container .alert, " +
          ".notifyjs-container .alert-danger, " +
          ".alert-danger, " +
          "[role='alert']"
        )
      )
      .map(element =>
        String(element.innerText || element.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean)
      .join(" | ")

    while (Date.now() < deadline) {
      const danger =
        notifyText()

      const id =
        digitsOnly(
          document.querySelector("#AliciId")?.value || ""
        )

      if (
        modalHidden() &&
        id &&
        Number(id) > 0
      ) {
        console.log(
          "[PenPOS Luca Bridge] Yeni müşteri oluşturuldu; Luca müşteri seçildi (Id:",
          id,
          ")"
        )

        return
      }

      if (
        danger &&
        /hata|geçersiz|eksik|bulunamadı|başarısız/i.test(danger)
      ) {
        throw new Error(
          `Luca müşteri ekleme hatası: ${danger}`
        )
      }

      await sleep(600)
    }

    const remaining =
      notifyText()

    throw new Error(
      remaining ||
      "Luca müşteri kaydı zamanında tamamlanamadı."
    )
  }

  // ============================================================
  // KDV DAHİL TUTAR — gerçek Luca CreateQuick akışı
  // ============================================================
  //
  // Gerçek Luca JS (f_0060f3 / CreateQuick):
  //   <input id="ToggleTaxIncluded" type="checkbox"
  //          onchange="toggleTaxIncluded(this.checked)">   -> kdvTaxChecked
  //   $("#BirimFiyat").change -> CalculateProductLine('') + CalculateTotalPayments()
  //   CalculateProductLine(lineNum), kdvTaxChecked iken:
  //       $(document).on("change", "#Miktar,#IskontoOrani", ...)
  //       $(document).on("change", "#BirimFiyat,#KDV", function () {
  //           ReCalculateUnitPriceLine(lineNum, birimFiyati); CalculateTotalPayments()
  //       })
  //       -> `birimFiyati`, CalculateProductLine'in O AN okuduğu #BirimFiyat
  //          değeridir (closure).
  //   ReCalculateUnitPriceLine(lineNum, unitPrice):
  //       kdvExcludedValue = unitPrice / (1 + kdvRate/100)
  //       #KTutari    = net * kdv/100
  //       #Toplam     = net                  ("Hizmet Tutarı" = KDV hariç)
  //       #BirimFiyat = net                  <-- Luca alanı NETE çevirir
  //   CalculateTotalPayments():
  //       subtotal = Σ (birimFiyat * miktar)   (DOM'daki NET fiyattan)
  //       taxTotal = Σ kdvTutari               (DOM'daki KDV'den)
  //       #PayableAmount ("Ödenecek Tutar")
  //           = accounting.formatNumber(total, 2, ".", ",") + " " + paraBirimi
  //
  // ÇELİŞKİ AKIŞ: brüt tutarı #BirimFiyat'a yazıp change'i birden çok kez
  // tetiklemek. CalculateProductLine her KDV-Dahil çağrısında document'a YENİ
  // bir "#BirimFiyat,#KDV" delegatı ekler ve jQuery .on() bunları tekilleştirmez.
  // Her ek tetikleme bir tur daha ReCalculateUnitPriceLine çalıştırır; KDV ikinci
  // kez düşer: 20.000 -> 18.181,82 -> 16.528,93 -> ...
  //
  // DOĞRU AKIŞ: brüt tutarı doğrudan #BirimFiyat'a yaz ve change'i TAM OLARAK
  // BİR KERE tetikle. O tek geçişte CalculateProductLine brüt değeri closure'a
  // alır ve en son eklenen delegat en son çalıştığı için doğru sonuç çıkar:
  //   #BirimFiyat = 18.181,82 | #KTutari = 1.818,18 | #PayableAmount = 20.000,00
  // PenPOS hiçbir aşamada KDV çıkarılmış/net tutarı alana YAZMAZ.

  function readLucaFieldValue(selector) {
    const element = document.querySelector(selector)
    return element ? String(element.value ?? "") : ""
  }

  // "#PayableAmount" = "Ödenecek Tutar" etiketi.
  // Luca metni: accounting.formatNumber(total, 2, ".", ",") + " " + currency
  //             -> "20.000,00 TRY"
  function readLucaPayableTotal() {
    const element = document.querySelector("#PayableAmount")

    if (!element) {
      return null
    }

    const text = String(
      element.textContent || element.innerText || ""
    ).trim()

    if (!text) {
      return null
    }

    return parseTotal(text)
  }

  // Gerçek Luca anahtarı: #ToggleTaxIncluded (inline onchange).
  // Katalog ürün seçimi de CalculateProductLine çalıştırdığı için anahtar
  // ÜRÜN SEÇİMİNDEN ÖNCE açılmalıdır; aksi halde katalog seçimi KDV-Dahil
  // hesabını yanlış dala sokar.
  function setKdvDahilMode() {
    const toggle =
      document.querySelector("#ToggleTaxIncluded")

    if (!toggle) {
      throw new Error(
        "Luca Hızlı Fatura ekranında KDV Dahil anahtarı (#ToggleTaxIncluded) bulunamadı."
      )
    }

    if (toggle.checked) {
      return false
    }

    toggle.checked = true

    toggle.dispatchEvent(
      new Event("change", { bubbles: true })
    )

    console.log(
      "[PenPOS Luca Bridge] Luca'da KDV Dahil açıldı."
    )

    return true
  }

  // Vade Tarihi (#LastPaymentDate): Luca'nın "Aynı gün / 7 / 30 / 60 / 90 Gün"
  // düğmeleri bu alanı doldurur (varsayılan 90 gün de dahil) ve
  // CollectSaveInvoiceData() alanı olduğu gibi LastPaymentDate olarak
  // sunucuya gönderir. PenPOS vade tarihi tutmaz; alan boşaltılır.
  function clearLastPaymentDate() {
    const element =
      document.querySelector("#LastPaymentDate")

    if (!element) {
      return false
    }

    element.value = ""

    element.dispatchEvent(
      new Event("input", { bubbles: true })
    )

    element.dispatchEvent(
      new Event("change", { bubbles: true })
    )

    if (typeof element.removeAttribute === "function") {
      element.removeAttribute("value")
    }

    return true
  }

  // Kaydetmeden önceki son kapı:
  //  1) Vade Tarihi BOŞ olmalı (LastPaymentDate sunucuya aynen gider).
  //  2) Ödenecek Tutar (#PayableAmount) PenPOS taksit tutarına eşit olmalı.
  async function verifyQuickInvoiceBeforeSave(item) {
    const amount =
      parseAmountValue(
        item.amount ?? item.unitPrice ?? 0,
        0
      )

    const target = Math.round(amount * 100) / 100

    const vade =
      readLucaFieldValue("#LastPaymentDate").trim()

    if (vade) {
      throw new Error(
        `Luca'da Vade Tarihi boşaltılamadı: "${vade}". Fatura kaydedilmedi; Luca'da vade alanını temizleyip tekrar deneyin.`
      )
    }

    if (target <= 0) {
      return
    }

    if (!document.querySelector("#PayableAmount")) {
      throw new Error(
        "Luca Hızlı Fatura ekranında ödenecek tutar alanı (#PayableAmount) bulunamadı; KDV Dahil tutar doğrulanamıyor."
      )
    }

    const payable = readLucaPayableTotal()

    if (
      payable === null ||
      Math.abs(payable - target) >= 0.01
    ) {
      throw new Error(
        `Luca'da ödenecek tutar PenPOS tutarıyla eşleşmiyor: beklenen ${target.toFixed(2)} TL, Luca'da ${(payable ?? 0).toFixed(2)} TL ` +
        `(Birim Fiyat: "${readLucaFieldValue("#BirimFiyat")}", Hizmet Tutarı: "${readLucaFieldValue("#Toplam")}", KDV Tutarı: "${readLucaFieldValue("#KTutari")}"). ` +
        "Fatura kaydedilmedi."
      )
    }
  }

  // KDV Dahil: KDV oranı + miktar + BRÜT tutar -> Luca kendi hesabını yapar.
  async function applyKdvDahilAmount(item) {
    const amount =
      parseAmountValue(
        item.amount ?? item.unitPrice ?? 0,
        0
      )

    const vatRate =
      normalizeVatRate(item.vatRate ?? 0)

    const quantity =
      Math.max(1, Number(item.quantity) || 1)

    const target =
      Math.round(amount * 100) / 100

    // KDV Dahil anahtarı (ürün seçiminden sonra da güvenceye alınır).
    setKdvDahilMode()
    await sleep(200)

    if (!document.querySelector("#BirimFiyat")) {
      throw new Error(
        "Luca Hızlı Fatura ekranında birim fiyat alanı (#BirimFiyat) bulunamadı."
      )
    }

    if (target <= 0) {
      setCreateField("#KDV", vatRate)
      await sleep(300)
      return
    }

    // KDV oranı / miktar / iskonto: #BirimFiyat henüz brüt yazılmadan ayarlanır,
    // böylece Luca geçersiz bir fiyatla hesap yapmaz. Katalog ürün seçimi #KDV'yi
    // kendi oranıyla ezebildiği için bu adım ürün seçiminden SONRA gelir.
    setCreateField("#KDV", vatRate)
    await sleep(300)
    setCreateField("#Miktar", quantity)
    setCreateField("#IskontoOrani", item.discountRate || 0)
    await sleep(300)

    const unitGross = amount / quantity
    let state = null

    // apply -> doğrula döngüsü. Her denemede brüt tutar YAZILIR ve change
    // TAM OLARAK BİR KERE tetiklenir; hiçbir aşamada net tutar yazılmaz.
    // Bir denemede #PayableAmount brüt tutara eşitlenmezse aynı akış bir kez
    // daha denenir (CalculateProductLine her çağrıda güncel brüt değeri
    // closure'a alıp delegatı sona eklediği için akış tekrar denemede
    // yakınsar). Üç denemede de eşleşmezse kaydetmeden hata verilir.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const birimFiyat =
        document.querySelector("#BirimFiyat")

      if (!birimFiyat) {
        throw new Error(
          "Luca Hızlı Fatura ekranında birim fiyat alanı (#BirimFiyat) bulunamadı."
        )
      }

      birimFiyat.value = formatCommaAmount(unitGross)
      birimFiyat.dispatchEvent(
        new Event("input", { bubbles: true })
      )
      birimFiyat.dispatchEvent(
        new Event("change", { bubbles: true })
      )

      const deadline = Date.now() + 5000

      while (Date.now() < deadline) {
        const payable = readLucaPayableTotal()

        state = {
          payable,
          birimFiyat: readLucaFieldValue("#BirimFiyat"),
          hizmetTutari: readLucaFieldValue("#Toplam"),
          kdvTutari: readLucaFieldValue("#KTutari"),
          kdvOrani: readLucaFieldValue("#KDV"),
          miktar: readLucaFieldValue("#Miktar")
        }

        if (
          payable !== null &&
          Math.abs(payable - target) < 0.01
        ) {
          console.log(
            "[PenPOS Luca Bridge] KDV Dahil tutar doğrulandı:",
            state
          )

          return
        }

        await sleep(250)
      }
    }

    throw new Error(
      `Luca'da ödenecek tutar doğrulanamadı: beklenen ${target.toFixed(2)} TL, ` +
      `DOM'daki değerler: ödenecek="${(state?.payable ?? 0).toFixed(2)}", ` +
      `birim fiyat="${state?.birimFiyat ?? ""}", hizmet tutarı="${state?.hizmetTutari ?? ""}", ` +
      `kdv tutarı="${state?.kdvTutari ?? ""}", kdv oranı="${state?.kdvOrani ?? ""}". ` +
      "Fatura kaydedilmedi."
    )
  }

  // jquery-typeahead 2.7.6 gerçek öğe DOM'u: li.typeahead__item.
  // (Eski seçici ".Typeahead-selectable" bu lib'de hiç üretilmiyordu.)
  async function selectTypeahead(selector, value) {
    if (!value) return false
    const input = document.querySelector(selector)
    if (!input) return false
    input.focus?.({ preventScroll: true })
    setCreateField(selector, value)
    input.dispatchEvent(
      new KeyboardEvent("keyup", {
        bubbles: true,
        key: String(value).slice(-1) || "a"
      })
    )
    await sleep(900)
    const container =
      input.closest(".typeahead__container")
    const items = container
      ? Array.from(
        container.querySelectorAll(
          ".typeahead__list .typeahead__item"
        )
      )
      : []
    if (!items.length) return false
    const option =
      items.find(item => item.innerText?.trim()) || items[0]
    option.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
      })
    )
    await sleep(400)
    return true
  }

  async function fillQuickInvoice(item) {
    if (!location.pathname.toLowerCase().includes('/invoice/createquick')) {
      location.href = '/Invoice/CreateQuick'
      await sleep(2500)
    }

    await waitForElement('#btnQuickSave', 15000)
    await waitForElement('#Alici', 15000)

    // 1) Müşteri: PenPOS ayarına göre Luca'da ara; bulunamazsa
    //    "Yeni Müşteri Ekle" ile oluştur (Bireysel + Kağıt, DOM doğrulamalı).
    const customerFound = await selectLucaCustomer(item)

    if (!customerFound) {
      await createLucaRecipient(item)
    }

    // Yeni oluşturulan müşteri forma OTOMATİK seçilmeyebilir (#AliciId boş
    // kalır); o durumda kaydetme "geçerli bir alıcı vergi/kimlik numarası
    // giriniz" hatasıyla düşer. Kayıt artık mevcut olduğu için bir kez daha
    // aranır; hâlâ boşsa kaydetme boşuna denenmez, net hata verilir.
    let aliciId = await waitForAliciId(2000)

    if (!aliciId) {
      await selectLucaCustomer(item)
      aliciId = await waitForAliciId(3000)
    }

    if (!aliciId) {
      throw new Error(
        'Luca alıcısı forma seçilemedi (alıcı vergi/kimlik numarası boş); taslak oluşturulmadı.'
      )
    }

    // 2) Fatura başlık alanları (gerçek Luca formu, DD-MM-YYYY).
    const invoiceDate =
      toLucaDate(
        item.invoiceDate ||
        new Date().toISOString().slice(0, 10)
      )

    if (invoiceDate) {
      setCreateField('#InvoiceDate', invoiceDate)
    }

    // VADE TARİHİ BOŞ. Luca'nın "Aynı gün / 7 / 30 / 60 / 90 Gün" düğmeleri
    // #LastPaymentDate'i doldurur (varsayılan 90 gün dahil) ve
    // CollectSaveInvoiceData() alanı LastPaymentDate olarak sunucuya gönderir.
    // PenPOS vade tarihi göndermez: alan burada boşaltılır ve kaydetme öncesi
    // verifyQuickInvoiceBeforeSave() boş olduğunu DOM'dan doğrular.
    clearLastPaymentDate()
    await sleep(300)

    setCreateField('#SenaryoId', item.scenarioId || '1')
    setCreateField('#FaturaTipi', item.invoiceType || '1')
    setCreateField('#CurrencyCode', item.currencyCode || 'TRY')
    setCreateField('#Notes', item.notes || '')

    // 3) KDV Dahil anahtarı ÜRÜN SEÇİMİNDEN ÖNCE açılır: katalog seçimi de
    // CalculateProductLine() çalıştırır ve KDV-Dahil hesabı yalnızca
    // kdvTaxChecked === true iken doğru dala girer.
    setKdvDahilMode()
    await sleep(200)

    // 4) Ürün kalemi (EĞİTİM) - Luca'nın kendi ürün typeahead'i.
    const productName =
      item.productName ||
      item.invoiceItem ||
      'EĞİTİM'

    const productSelected =
      await selectTypeahead('#UrunAdi', productName)

    if (!productSelected) {
      // Katalogda ürün bulunamadıysa satırı doğrudan doldur (mevcut davranış).
      setCreateField('#UrunAdi', productName)
      setCreateField('#MeasureUnit', item.measureUnit || '67')
    }

    // 5) KDV Dahil + KDV oranı + miktar/iskat + BRÜT tutar.
    //    applyKdvDahilAmount #KDV / #Miktar / #IskontoOrani / #BirimFiyat
    //    alanlarını Luca'nın kendi hesaplama akışıyla doldurur ve
    //    #PayableAmount'in brüt tutara eşitlendiğini DOM'dan doğrular.
    await applyKdvDahilAmount(item)

    // 6) Kaydetmeden önce son kapı: vade boş mu, ödenecek tutar doğru mu.
    await verifyQuickInvoiceBeforeSave(item)

    console.log('[PenPOS Luca Bridge] Hızlı Fatura alanları dolduruldu.')
  }

  // Luca Hızlı Fatura ekranındaki kaydet butonunu tetikler.
  //
  // Burada YALNIZCA Luca'nın KENDİ "FATURA OLUŞTUR" butonu basılır; Luca'nın
  // kendi onay (SweetAlert) akışı devreye girer. O onay penceresindeki
  // "Evet Kaydedelim !" butonu waitForQuickInvoiceResult içinde, BAŞLIĞI ve
  // BUTON METNİ birebir doğrulanarak otomatik verilir.
  // Bu adım sadece TASLAK oluşturur: gönderim YAPILMAZ.
  async function triggerQuickSave() {
    // GERÇEK Luca Hızlı Fatura kaydet butonu (CreateQuick sayfası):
    //   <button type="button" class="btn btn-lg btn-success" id="btnQuickSave">FATURA OLUŞTUR</button>
    // Buton sayfa DOM'u ile gelir; bu yüzden doğrudan sorgulamak yerine
    // görünene kadar beklenir.
    const preferred = await waitForElement('#btnQuickSave', 15000)
    if (preferred) {
      preferred.click()
      console.log('[PenPOS Luca Bridge] Kaydet butonu tetiklendi (#btnQuickSave); Luca onayı bekleniyor.')
      return '#btnQuickSave'
    }

    // Yedek: aynı ekrandaki kaydet/oluştur butonu (metin eşleşmesi).
    // Gerçek Luca buton metni "FATURA OLUŞTUR" olduğu için bu da kapsanır.
    // Böylece buton id'si değişmişse görev sessizce başarısız olmaz.
    const fallback = Array.from(
      document.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn, .btn')
    ).find(element => {
      const label = String(element.innerText || element.value || '').replace(/\s+/g, ' ').trim()
      return /^(kaydet|faturay[ıi] kaydet|faturay[ıi] olu[şs]tur|fatura olu[şs]tur|olu[şs]tur)$/i.test(label)
    })
    if (fallback) {
      fallback.click()
      console.log('[PenPOS Luca Bridge] Kaydet butonu metin eşleşmesiyle tetiklendi; Luca onayı bekleniyor.')
      return 'metin-eslesmesi'
    }

    throw new Error(
      'Luca Hızlı Fatura ekranında kaydet butonu bulunamadı (#btnQuickSave).'
    )
  }

  // Gerçek Luca CreateQuick kaydetme sonuçları
  // ($("#btnQuickSave").click -> swal -> $.ajax POST /Invoice/Create):
  //   ONAY   : title "Fatura Kaydedilecek", confirm "Evet Kaydedelim !"
  //   HATA   : title "Fatura Kaydetme", text response.error
  //   BAŞARI : title "Fatura Kaydetme",
  //            text "Fatura başarıyla kaydedildi. Fatura No. : " + response
  //            (response doğrudan fatura numarasıdır)
  // DİKKAT: metin "kaydedildi" ile biter ("kaydedilmiştir" DEĞİL). Bazı Luca
  // sürümlerinde "kaydedilmiştir" varyantı görüldüğü için ortak "kaydedil"
  // kökü üzerinden eşleştirilir.
  const LUCA_SAVE_SUCCESS_RE =
    /Fatura\s+başarıyla\s+kaydedil/i

  const LUCA_INVOICE_NO_RE =
    /Fatura\s*No\.?\s*:\s*([^\s]+)/i

  // FATURA KES onay penceresi (CreateQuick #btnQuickSave click -> swal):
  //   title   'Fatura Kaydedilecek'
  //   text    getSaveMessage()
  //   confirm 'Evet Kaydedelim !'
  //   cancel  'Kaydetme'
  const LUCA_SAVE_CONFIRM_TITLE = 'Fatura Kaydedilecek'
  const LUCA_SAVE_CONFIRM_LABEL = 'Evet Kaydedelim !'

  // Luca kaydetme akışında oluşabilecek gerçek hata mesajlarını metinden çıkarır.
  // (CreateQuick: KdvNullCheck / validateDocument / $.ajax hata dalları.)
  function detectLucaSaveFailure(text) {
    const value = String(text || '')

    const known = [
      /KDV Oran[ıi] Eksik[^\n]*/i,
      /Vergi Muafiyet Sebebi girilmesi zorunludur[^\n]*/i,
      /Fatura için geçerli bir alıcı vergi\/kimlik numarası giriniz[^\n]*/i,
      /Fatura kaydedilirken hata olu[şs]tu[^\n]*/i
    ]

    for (const pattern of known) {
      const match = value.match(pattern)
      if (match) return match[0].trim()
    }

    // Genel Luca hata penceresi: başlık "Fatura Kaydetme".
    // Onay penceresinin başlığı "Fatura Kaydedilecek" olduğu için karışmaz.
    if (
      /Fatura Kaydetme/i.test(value) &&
      !LUCA_SAVE_SUCCESS_RE.test(value) &&
      !/Evet Kaydedelim/i.test(value)
    ) {
      const match = value.match(/Fatura Kaydetme\s*([\s\S]{0,220})/i)
      return (match?.[1] || 'Fatura kaydedilemedi.').trim()
    }

    return ''
  }

  async function waitForQuickInvoiceResult(task, item) {
    // FATURA KES -> TASLAK OLUŞTUR.
    // "FATURA OLUŞTUR" basıldıktan sonra Luca'nın KENDİ onay penceresi açılır:
    //   swal({ title: 'Fatura Kaydedilecek', text: getSaveMessage(),
    //          confirmButtonText: 'Evet Kaydedelim !',
    //          cancelButtonText:  'Kaydetme',
    //          closeOnConfirm: false, showLoaderOnConfirm: true })
    // Bu onay PenPOS tarafından OTOMATİK verilir; ancak yalnızca
    //   - başlık birebir "Fatura Kaydedilecek",
    //   - onay butonu metni birebir "Evet Kaydedelim !"
    // koşulları sağlandığında. "Kaydetme" (cancel) ASLA basılmaz ve
    // başka bir Luca penceresi (ör. alıcı kaydının "Evet" onayı) yanlışlıkla
    // onaylanmaz.
    // Onaydan sonra Luca'nın BAŞARI penceresi:
    //   title "Fatura Kaydetme",
    //   text  "Fatura başarıyla kaydedildi. Fatura No. : <numara>"
    // Bu pencerenin "Yeni Fatura Oluştur!"/"Taslaklara git!" düğmeleri
    // navigasyon yaptığı için OTOMATİK TIKLANMAZ; yalnızca numara okunur.
    let confirmOutcome = ''
    let confirmLogged = false

    for (let attempt = 0; attempt < 600; attempt += 1) {
      const text = String(document.body?.innerText || '')

      // Luca kaydetme akışı hata verdiğinde boşuna beklemek yerine
      // gerçek Luca hata mesajıyla hemen başarısız ol.
      const failure = detectLucaSaveFailure(text)
      if (failure) {
        throw new Error(`Luca fatura kaydetme hatası: ${failure}`)
      }

      // Gerçek Luca onay penceresi (başlık + buton metni doğrulanarak).
      if (confirmOutcome !== 'confirmed') {
        const swal = readLucaSwal()
        if (
          swal?.open &&
          swal.title === LUCA_SAVE_CONFIRM_TITLE
        ) {
          const outcome = confirmLucaSwal(
            LUCA_SAVE_CONFIRM_TITLE,
            LUCA_SAVE_CONFIRM_LABEL
          )
          if (outcome !== confirmOutcome) {
            confirmOutcome = outcome
            console.log(
              '[PenPOS Luca Bridge] Luca "Fatura Kaydedilecek" onayı:',
              outcome
            )
          }
          if (outcome === 'confirmed') {
            console.log(
              '[PenPOS Luca Bridge] Luca taslak kaydı onaylandı ("Evet Kaydedelim !"). Gönderim YAPILMAYACAK.'
            )
          }
        } else if (!confirmLogged && attempt === 3) {
          confirmLogged = true
          console.warn(
            '[PenPOS Luca Bridge] Luca onay penceresi henüz açılmadı; bekleniyor.'
          )
        }
      }

      // Luca'nın BAŞARI penceresi: "Fatura başarıyla kaydedildi. Fatura No. : X"
      if (LUCA_SAVE_SUCCESS_RE.test(text)) {
        // Luca başarı penceresindeki fatura numarası.
        const match =
          text.match(LUCA_INVOICE_NO_RE) ||
          text.match(/Fatura\s*Numaras[ıi]\s*:?\s*([^\s]+)/i)
        const invoiceNo = match?.[1] || ''
        if (!invoiceNo) {
          throw new Error(
            'Luca faturayı kaydetti ancak fatura numarası başarı penceresinden okunamadı. Taslak gönderilmedi; "Fatura Kes" ile tekrar deneyin.'
          )
        }
        // Başarı penceresi navigate eden butonlar içerir ("Yeni Fatura
        // Oluştur!" -> CreateQuick, "Taslaklara git!" -> staging listesi).
        // Bu yüzden HİÇBİR düğmesi tıklanmaz; yalnızca numara okunur ve
        // görev PenPOS'a bildirilir.
        await chrome.runtime.sendMessage({
          type: 'PENPOS_LUCA_CREATE_RESULT',
          jobId: task.jobId,
          resultToken: task.resultToken,
          results: [{
            ...item,
            status: 'draft_created',
            invoiceNo
          }]
        })
        // Numara çağırana da döner: toplu kesim ilerlemesi (sessionStorage)
        // bu numarayla kaydolur; sayfa geçişinden sonra kalem atlanır.
        return invoiceNo
      }

      await sleep(500)
    }

    throw new Error(
      confirmOutcome === 'confirmed'
        ? 'Luca taslak kaydı onaylandı ancak başarı sonucu zamanında alınamadı. Luca sekmesini kontrol edin.'
        : 'Luca "Fatura Kaydedilecek" onay penceresi açılmadı; taslak oluşturulamadı. "Fatura Kes" ile tekrar deneyin.'
    )
  }

  async function runCreateTask(task) {
    const items = Array.isArray(task.items) ? task.items : []
    if (!items.length) throw new Error('Luca fatura kalemi bulunamadı.')

    // Toplu kesimde sayfa geçişleri bağlamı yok eder; tamamlanan kalemler
    // atlanır. Kayıt olmasaydı her dönüşte 1. kalemden başlanır ve aynı
    // öğrenciye tekrar taslak kesilirdi.
    const reported = readLucaCreateReported(task.jobId)
    const reportedKeys = new Set(reported.map(record => record.sourceKey))
    const pending = items.filter(
      item => !reportedKeys.has(String(item.sourceKey || '').trim())
    )

    if (!pending.length) {
      // TÜM kalemler raporlandı ama sonuç backend'e ulaşamamış olabilir;
      // oynatılmazsa görev "done" olmaz, kilit kalır.
      await replayLucaCreateReported(task, reported)
      return
    }

    // MÜKERRER FATURA KORUMASI — "Fatura Kes"ten ÖNCE Luca kontrolü.
    //
    // PenPOS kaydı temizlendiğinde satır "Fatura Kes"e döner. Luca'da o
    // öğrencinin faturası HÂLÂ varsa yeni fatura kesmek mükerrerdir.
    // Kontrol sırası:
    //   1) TASLAK e-arşiv  (/OutgoingInvoice/StagingArchiveList)
    //   2) GÖNDERİLEN e-arşiv (/OutgoingInvoice/OutgoingArchiveList)
    //   3) hiçbiri yoksa -> yeni fatura kes
    //
    // Sayfa geçişi bağlamı yok ettiği için aşamanın ilerlemesi
    // sessionStorage'da tutulur ve her dönüşte kaldığı yerden sürer.
    if (readLucaCreateLookupStage(task.jobId) !== 'done') {
      // Kontrol sırası bu fonksiyonun İÇİNDE yürütülür: aşamalar arasında
      // kendisi yönlendirir. Burada ayrıca CreateQuick'e yönlendirmek
      // sonraki aşamayı ATLARDI. Raporlanan kalemler dönüşte atlanır.
      await adoptExistingLucaInvoices(task, pending, reported)
      return
    }

    // CreateQuick'te değilsek oraya git.
    if (!location.pathname.toLowerCase().includes('/invoice/createquick')) {
      location.href = '/Invoice/CreateQuick'
      return
    }

    const failures = []
    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index]
      try {
        await fillQuickInvoice(item)
        // Alanlar dolduruldu -> Luca'nın kaydet butonu -> Luca'nın onay akışı.
        await triggerQuickSave()
        const invoiceNo = await waitForQuickInvoiceResult(task, item)
        reported.push({
          sourceKey: String(item.sourceKey || '').trim(),
          status: 'draft_created',
          invoiceNo: String(invoiceNo || ''),
          error: ''
        })
        console.log(
          '[PenPOS Luca Bridge] Luca taslağı oluşturuldu:',
          invoiceNo
        )
      } catch (error) {
        const message = error?.message || 'Luca taslak oluşturulamadı.'
        reported.push({
          sourceKey: String(item.sourceKey || '').trim(),
          status: 'failed',
          invoiceNo: '',
          error: message
        })
        failures.push(message)
        console.warn('[PenPOS Luca Bridge] Luca taslak oluşturulamadı:', message)
      }
      writeLucaCreateReported(task.jobId, reported)

      // Sıradaki kalem taze form ister: CreateQuick'e dön, dönüşte
      // raporlananlar atlanır. Son kalemden sonra dönüş YOK.
      if (index < pending.length - 1) {
        location.href = '/Invoice/CreateQuick'
        return
      }
    }

    if (failures.length) {
      throw new Error(
        `${failures.length}/${pending.length} taslak oluşturulamadı: ${failures.join(' | ')}`
      )
    }
  }

  // ============================================================
  // TASLAK GÖNDERİMİ — GERÇEK Luca staging listesi akışı
  // ============================================================
  //
  // Luca'nın Hızlı Fatura kaydından sonra yönlendirdiği ekranlar:
  //   recipientType == 1 (e-Fatura) -> /OutgoingInvoice/StagingInvoiceList
  //   recipientType == 2 (e-Arşiv)  -> /OutgoingInvoice/StagingArchiveList
  //
  // staging sayfasının GERÇEK yapısı (f_00607f):
  //   <div class="panel-body" id="stagingTable">
  //     <table id="StagingInvoiceTable"> / <table id="StagingArchiveTable">
  //   <input id="FaturaNo">            <- fatura numarası filtresi
  //   <button id="searchButton">Ara</button>
  //   filterObject(param) her AJAX çekiminde $("#FaturaNo").val() okur ve
  //   searchButton -> stagingTable.ajax.reload() tetikler. Yani filtreyi
  //   yazıp "Ara"ya basmak listeyi SUNUCU TARAFINDA tek fatura numarasına
  //   daraltır; istemci tarafında sayfalama taramaya gerek kalmaz.
  //
  //   Tablo butonları DataTables Buttons konteynerinde (#th-buttons /
  //   .table-header-buttons) durur: "Gönder", "Sil", "Klonla",
  //   "Yazdır(Pdf)", "Aktif Sayfayı Seç", "Tümünü Seç", "Seçimi Kaldır"…
  //
  //   SendInvoice(dt) / SendArchive(dt) -> swal:
  //     title   "Gönder"
  //     text    "Seçili faturaları göndermek istiyor musunuz?"
  //     confirm "Onayla" / cancel "Hayır"
  //     AJAX POST SendStagingInvoice { InvoiceId: [IdFatura], IsAllSelected:false }
  //     -> başarı: swal title "Gönder",
  //               text  "Seçili faturalar başarıyla gönderilmiştir."
  //     -> hata  : swal title "Gönder", text = response.error
  //
  //   KRİTİK: SendInvoice() gönderilecek numaraları
  //     stagingTable.rows('.selected').data()
  //   üzerinden alır. DataTables Select seçili satıra "selected" class'ı
  //   eklediği için seçim YALNIZCA bu class ile doğrulanır; sadece
  //   satıra tıklamak yeterli sayılmaz.
  const LUCA_STAGING_INVOICE_URL = '/OutgoingInvoice/StagingInvoiceList'
  const LUCA_STAGING_ARCHIVE_URL = '/OutgoingInvoice/StagingArchiveList'
  const LUCA_STAGING_TABLE_SELECTORS = '#StagingInvoiceTable, #StagingArchiveTable'
  const LUCA_STAGING_BUTTON_SCOPES = [
    '#th-buttons',
    '.table-header-buttons',
    '.dataTables_buttons',
    '#stagingTable'
  ]

  const LUCA_SEND_CONFIRM_TITLE = 'Gönder'
  const LUCA_SEND_CONFIRM_LABEL = 'Onayla'
  const LUCA_SEND_CONFIRM_TEXT = 'Seçili faturaları göndermek istiyor musunuz?'
  const LUCA_SEND_SUCCESS_RE = /Seçili\s+faturalar\s+başarıyla\s+gönderilmiştir/i

  // ============================================================
  // "LUCA TASLAĞI ARTIK YOK" — kalıcı terminal durum
  // ============================================================
  //
  // PenPOS "Faturayı Onayla" dediğinde aranan numara Luca staging listesinde
  // BULUNAMAZSA bu bir gönderim hatası DEĞİLDİR: Luca'daki taslak kullanıcı
  // tarafından silinmiş / taşınmıştır. Bu durum:
  //
  //   * "gönderilmedi" diye kalıcı BAŞARISIZ sayılmamalı (aksi halde satır
  //     sonsuza kadar hatalı kalır),
  //   * "başarılı" sayılmamalı (aksi halde "Faturayı Gör" yanlış açılır),
  //   * PenPOS'taki invoiceNo + draft/awaiting_approval kilidi TEMİZLENMELİ,
  //   * satır yeniden "Fatura Kes" durumuna dönmeli.
  //
  // Bu yüzden ayrı bir terminal durum tanımlanır: 'draft_missing'.
  // Backend bu durumu gördüğünde ilgili sourceKey'in fatura kaydını SİLER.
  const LUCA_DRAFT_MISSING_STATUS = 'draft_missing'

  // Luca staging listesinde numara yoksa bu bir "hata" değil, "Luca taslağı
  // artık yok" durumudur. Kalıcı bir başarısızlık OLMAYAN bu durum ayrı
  // işaretlenir; backend bu işaretle satırın taslak kaydını siler ve
  // "Fatura Kes"e döndürür.
  function draftMissingError(invoiceNo, pathname) {
    const error = new Error(
      `Luca taslak listesinde "${invoiceNo}" numaralı fatura bulunamadı (${pathname}). Luca taslağı artık yok (silinmiş veya taşınmış); fatura gönderilmedi. PenPOS kaydı temizlendi, bu satır için "Fatura Kes" ile yeni taslak oluşturulabilir.`
    )

    error.lucaDraftMissing = true

    return error
  }

  const LUCA_CREATE_ARCHIVE_CHECKED_KEY = 'penposLucaCreateArchiveChecked'

  function isCurrentLucaArchivePath() {
    return location.pathname
      .toLowerCase()
      .includes('/outgoinginvoice/outgoingarchivelist')
  }

  // Luca'nın İKİ ayrı e-arşiv listesi vardır ve ikisi de kontrol edilir:
  //   1) /OutgoingInvoice/StagingArchiveList  -> TASLAKLAR (henüz gönderilmedi)
  //   2) /OutgoingInvoice/OutgoingArchiveList -> GÖNDERİLENLER
  // Arama sırası bu yüzden önemlidir.
  const LUCA_CREATE_LOOKUP_STAGES = [
    {
      id: 'staging',
      path: '/OutgoingInvoice/StagingArchiveList',
      tableSelector: '#StagingArchiveTable',
      isCurrent: () => location.pathname.toLowerCase().includes('/outgoinginvoice/stagingarchivelist'),
      // Staging listesi = taslak. Bulunan fatura TASLAKTIR: gönderilmemiştir.
      // Bu yüzden durum 'draft_created' olur; satır "Faturayı Onayla"ya düşer
      // ve kullanıcı gönderebilir.
      status: 'draft_created',
      logLabel: 'Luca taslak (staging) listesinde mevcut taslak bulundu, yeni taslak kesilmedi:'
    },
    {
      id: 'archive',
      path: '/OutgoingInvoice/OutgoingArchiveList',
      tableSelector: '#OutgoingArchiveTable',
      isCurrent: () => location.pathname.toLowerCase().includes('/outgoinginvoice/outgoingarchivelist'),
      // Gönderilen listesi = fatura ZATEN gönderilmiş. Kesilecek yeni bir
      // fatura mükerrer olur. Bu yüzden durum 'sent' olur: satır doğrudan
      // "Faturayı Gör"e düşer.
      status: 'sent',
      logLabel: 'Luca gönderilen (arşiv) listesinde mevcut fatura bulundu, yeni fatura kesilmedi:'
    }
  ]

  // Arama aşaması jobId ile KAPSANIR. Kapsanmasaydı önceki bir işin
  // "done" kalıntısı yeni bir işte tüm Luca kontrolünü ATLATIR ve aynı
  // öğrenciye ikinci bir fatura kesilir (mükerrer kesim). Fatura Kes her
  // çağrıldığında taslak ve gönderilen listeleri baştan taranmalıdır.
  function readLucaCreateLookupStage(jobId) {
    try {
      const raw = sessionStorage.getItem(LUCA_CREATE_ARCHIVE_CHECKED_KEY)

      if (!raw) return ''

      const stored = JSON.parse(raw)

      if (String(stored?.jobId || '') !== String(jobId || '')) return ''

      return String(stored?.stageId || '')
    } catch (error) {
      return ''
    }
  }

  function writeLucaCreateLookupStage(jobId, stageId) {
    try {
      sessionStorage.setItem(
        LUCA_CREATE_ARCHIVE_CHECKED_KEY,
        JSON.stringify({ jobId: String(jobId || ''), stageId: String(stageId || '') })
      )
    } catch (error) {
    }
  }

  // Luca'da MEVCUT fatura arar ve PenPOS'a BAĞLAR (mükerrer kesim koruması).  //
  // Sıra: 1) TASLAK e-arşiv (staging) -> 2) GÖNDERİLEN e-arşiv (outgoing)
  // -> 3) ikisinde de yoksa yeni fatura kesilir.
  //
  // Bulunan kayıt:
  //   * staging listesindeyse  -> 'draft_created' (taslak, gönderilmemiş;
  //     satır "Faturayı Onayla"ya düşer),
  //   * gönderilen listedeyse  -> 'sent' (zaten gönderilmiş; satır
  //     "Faturayı Gör"e düşer).
  //
  // Eşleştirme: TCKN (gri alan) + öğrenci adı. Tutar tek başına yeterli
  // değildir (aynı tutarda çok sayıda taksit olabilir).
  //
  // Bu sayfa boşsa bir SONRAKİ aşamaya geçilir; son aşamada hiçbiri
  // bulunamazsa kalemler normal CreateQuick akışında kesilir.
  async function adoptExistingLucaInvoices(task, pending, reported) {
    let anyTableRead = false

    // Kayıtlı aşamadan DEVAM EDİLİR: sayfa geçişi bağlamı yok ettiği için
    // her dönüşte baştan başlamak, aşamalar arasında SALINIM yaratır
    // (staging -> arsiv -> staging -> ... ve hiçbir kalem işlenmez).
    // Kayıt jobId ile kapsandığı için YENİ bir işte aşama "done" olsa bile
    // kontrol baştan başlar (mükerrer kesim koruması).
    const savedStage = readLucaCreateLookupStage(task.jobId)
    const savedIndex = LUCA_CREATE_LOOKUP_STAGES.findIndex(
      stage => stage.id === savedStage
    )
    // 'done' YENİ bir iş için geçerli değildir: kontrol sıfırdan başlar.
    const startIndex = savedStage && savedStage !== 'done' ? Math.max(0, savedIndex) : 0

    for (let index = startIndex; index < LUCA_CREATE_LOOKUP_STAGES.length; index += 1) {
      const stage = LUCA_CREATE_LOOKUP_STAGES[index]

      // Bu aşama sayfasında değilsek oraya git.
      if (!stage.isCurrent()) {
        writeLucaCreateLookupStage(task.jobId, stage.id)
        location.href = stage.path
        return
      }

      // Bu aşamada hâlâ aranan kalemler. Hepsi bulunursa sonraki listeye
      // GİMEYİZ (staging'de mevcut taslak varsa arşive bakmak gereksiz).
      // try DIŞINDA tanımlanır: catch sonrası da okunur.
      const stillPending = []

      try {
        await waitForElement(`${stage.tableSelector} tbody tr`, 15000)

        await sendResetPaging({
          tableIds: [stage.tableSelector],
          pageLength: 1000
        })
        await sleep(1500)

        const rows = Array.from(
          document.querySelectorAll(`${stage.tableSelector} tbody tr`)
        )

        if (rows.length) anyTableRead = true

        for (const item of pending) {
          const existingInvoiceNo = findLucaRowForItem(rows, item)

          if (!existingInvoiceNo) {
            stillPending.push(item)
            continue
          }

          console.log('[PenPOS Luca Bridge] ' + stage.logLabel, existingInvoiceNo)

          reported.push({
            sourceKey: String(item.sourceKey || '').trim(),
            status: stage.status,
            invoiceNo: existingInvoiceNo,
            error: ''
          })

          await chrome.runtime.sendMessage({
            type: 'PENPOS_LUCA_CREATE_RESULT',
            jobId: task.jobId,
            resultToken: task.resultToken,
            results: [{
              ...item,
              status: stage.status,
              invoiceNo: existingInvoiceNo
            }]
          })

          // KRİTİK: kayıt HEMEN yazılır. Sayfa geçişi bağlamı yok ettiği
          // için yazılmazsa dönüşte bu kalem yeniden işlenir ve mükerrer
          // fatura kesilir (bulunduğu halde tekrar kesilmiş olur).
          writeLucaCreateReported(task.jobId, reported)
        }
      } catch (error) {
        console.warn(
          '[PenPOS Luca Bridge] ' + stage.id + ' listesi okunamadı, sıradaki kayda bakılacak:',
          error?.message || error
        )
      }

      // TÜM kalemler bu aşamada bulunduysa (ör. staging'de mevcut taslak)
      // sonraki listeye GİMEYİZ: gönderilen arşive bakmaya gerek yok.
      if (!stillPending.length) {
        // Tüm kalemler bu aşamada bulundu. Kontrol bitti.
        writeLucaCreateLookupStage(task.jobId, 'done')
        location.href = '/Invoice/CreateQuick'
        return
      }

      // Sıradaki aşamaya geç: o sayfaya git, dönüşte kaldığı yerden sürer.
      const nextStage = LUCA_CREATE_LOOKUP_STAGES[index + 1]

      if (nextStage) {
        writeLucaCreateLookupStage(task.jobId, nextStage.id)
        location.href = nextStage.path
        return
      }
    }

    if (!anyTableRead) {
      console.warn(
        '[PenPOS Luca Bridge] Hiçbir Luca listesi okunamadı; kalemler yeni fatura olarak kesilecek.'
      )
    }

    // Tüm aşamalar tarandı: kesim için CreateQuick'e dön.
    writeLucaCreateLookupStage(task.jobId, 'done')
    location.href = '/Invoice/CreateQuick'
  }

  // Verilen satırlar arasında kaleme ait Luca kaydını bulur.
  //
  // GERÇEK TABLO YAPISI (Luca staging e-arşiv):
  //   Alıcı / Gönderen | Fatura No. | Fatura Tarihi | Tutar | Durum | ...
  // TCKN SÜTUNU YOKTUR. Bu yüzden eşleştirme TCKN'e dayanamaz; sütun
  // başlıklarından okunan ALICI + TARİH + TUTAR kullanılır.
  //
  // Neden hepsi gerekli:
  //   * aynı öğrenci listede ARK ARDA birden fazla kez geçebilir
  //     (örn. PDK2026000000223 ve PDK2026000002020 -> BAHADIR ENES ÖZTÜRK),
  //     bu yüzden isim tek başına yeterli DEĞİLDİR,
  //   * aynı öğrencinin birden çok taksiti farklı tutar ve tarihlerde
  //     olabilir; tutar+tarih çifti satırı benzersizleştirir.
  function findLucaRowForItem(rows, item) {
    const names = [
      normalizeNameForMatch(item.studentName || ''),
      normalizeNameForMatch(item.recipientName || '')
    ].filter(Boolean)

    const targetAmount = parseLucaRowAmount(item.amount ?? item.total ?? item.payableTotal)
    const targetPeriod = String(item.period || '').trim()
    const targetDate = String(item.invoiceDate || '').trim()

    for (const row of rows) {
      const cells = readLucaRowCells(row)

      // Alıcı sütunu: ad her iki isimden biriyle eşleşmeli.
      if (names.length) {
        const aliciNorm = normalizeNameForMatch(cells.alici)

        if (!names.some(name => aliciNorm.includes(name) || name.includes(aliciNorm))) {
          continue
        }
      }

      // Tarih: aynı dönem (ay) olmalı.
      if (targetPeriod && cells.period) {
        if (cells.period !== targetPeriod) continue
      } else if (targetDate && cells.date && cells.date !== targetDate) {
        continue
      }

      // Tutar: kuruş hassasiyetinde karşılaştır.
      if (targetAmount && cells.amount && Math.abs(cells.amount - targetAmount) > 0.5) {
        continue
      }

      if (cells.invoiceNo) return cells.invoiceNo
    }

    return ''
  }

  // Luca satırındaki sütunları BAŞLIKLARDAN okur. Sabit indeks kullanılmaz:
  // sütun sırası sürümden sürüme değişir.
  function readLucaRowCells(row) {
    const out = {
      alici: '',
      invoiceNo: '',
      date: '',
      period: '',
      amount: 0
    }

    try {
      const table = row.closest('table')
      const headers = Array.from(table?.querySelectorAll('thead th') || [])
      const cells = Array.from(row.querySelectorAll('td') || [])

      headers.forEach((th, index) => {
        const header = normalizeNameForMatch(th.innerText || '')
        const value = normalizeText(cells[index]?.innerText || '')

        if (/alici|gonderen|musteri/.test(header)) out.alici = value
        else if (/fatura\s*no|numara/.test(header)) out.invoiceNo = value
        else if (/fatura\s*tar/i.test(header)) out.date = value
        else if (/tutar|toplam/.test(header)) out.amount = parseLucaRowAmount(value)
      })

      if (!out.invoiceNo) out.invoiceNo = readInvoiceNoFromArchiveRow(row)
    } catch (error) {
      // Başlıklar okunamadı: satır metninden kaba çıkarım.
      const text = String(row.innerText || '')

      if (!out.invoiceNo) out.invoiceNo = readInvoiceNoFromArchiveRow(row)
      out.alici = text
    }

    // Tarihden dönem (YYYY-MM) türetilir: Luca "30.09.2026" gösterir.
    if (out.date) {
      const match = String(out.date).match(/(\d{4})[-./](\d{1,2})/)

      if (match) {
        out.period = `${match[1]}-${String(match[2]).padStart(2, '0')}`
      } else {
        const tr = String(out.date).match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/)

        if (tr) {
          out.period = `${tr[3]}-${String(tr[2]).padStart(2, '0')}`
        }
      }
    }

    return out
  }

  // "18.000,00 TRY" -> 18000
  function parseLucaRowAmount(value) {
    const raw = String(value ?? '')
    const numeric = raw.replace(/[^\d.,-]/g, '')

    if (!numeric) return 0

    // tr biçimi: binler ayırıcı '.', ondalık ','
    const normalized = numeric.lastIndexOf(',') > numeric.lastIndexOf('.')
      ? numeric.replace(/\./g, '').replace(',', '.')
      : numeric.replace(/,/g, '')

    const parsed = Number.parseFloat(normalized)

    return Number.isFinite(parsed) ? parsed : 0
  }

  // Arşiv satırından fatura numarasını okur. Önce "Fatura No" sütun
  // başlığının indeksi, sonra metindeki numara deseni denenir.
  function readInvoiceNoFromArchiveRow(row) {
    try {
      const table = row.closest('table')
      const headers = Array.from(table?.querySelectorAll('thead th') || [])
        .map(th => normalizeNameForMatch(th.innerText || ''))
      const noIndex = headers.findIndex(header => /fatura\s*no|numara|no\b/.test(header))

      if (noIndex >= 0) {
        const cells = Array.from(row.querySelectorAll('td'))

        if (cells[noIndex]) {
          // DİKKAT: burada normalizeText KULLANILMAZ — o küçük harfe
          // çevirir ve fatura numarası "pdk2026..." olarak PenPOS'a yazılır
          // (gönderimde eşleşme bulunamaz). Numara AYNEN korunur.
          const value = String(cells[noIndex].innerText || '').trim()

          if (value && /^[A-Za-z0-9][A-Za-z0-9\-/]{3,}$/.test(value)) {
            return value
          }
        }
      }
    } catch (error) {
      // Başlık okunamadı: metin taramasına düş.
    }

    const match = String(row.innerText || '').match(/\b[A-Z]{2,4}\d{6,}\b/i)

    return match ? match[0].trim() : ''
  }

  // Luca staging liste adresi -> geçerli sayfa yolu karşılaştırması.
  // (/OutgoingInvoice/StagingArchiveList -> "stagingarchivelist")
  function isCurrentLucaStagingPath(url) {
    return location.pathname
      .toLowerCase()
      .includes(String(url).toLowerCase().split('/outgoinginvoice/')[1] || url)
  }

  // PenPOS "Müşteri Tipi = Bireysel" + "Gönderim Şekli = Kağıt" ürettiği için
  // taslak e-Arşiv tarafındadır (recipientType 2). recipientType 1 ise
  // e-Fatura taslak listesindedir.
  function lucaStagingUrlFor(item) {
    return String(item?.recipientType) === '1'
      ? LUCA_STAGING_INVOICE_URL
      : LUCA_STAGING_ARCHIVE_URL
  }

  // Toplu gönderimde sayfa geçişi (location.href) content.js bağlamını
  // YENİDEN OLUŞTURUR ve görev baştan başlar. Bu yüzden "hangi kalemler
  // raporlandı" bilgisi sayfa geçişini atlatacak şekilde (sessionStorage)
  // saklanır; aksi halde aynı fatura tekrar tekrar işlenirdi.
  //
  // KAYIT jobId İLE KAPSANIR: aynı fatura yeni bir işte yeniden
  // gönderilebilmelidir (başarısız gönderimden sonra "Faturayı Onayla"),
  // eski kayıt yeni işi atlamasın.
  const LUCA_SEND_REPORTED_KEY = 'penposLucaSendReported'

  // Görev ilerlemesi yalnızca "anahtar" değil, tam SONUÇ KAYDI olarak tutulur:
  //   { sourceKey, status, invoiceNo, error }
  // Böylece iki ayrı arıza düzelir:
  //   1) Sayfa geçişi sonrası aynı kalem yeniden işlenmez.
  //   2) Backend'e ULAŞAMAMIŞ bir rapor (ağ hatası) tekrar oynatılabilir.
  //      Anahtar-only kayıtta bu bilgi kaybolurdu; görev hiçbir zaman "done"
  //      olmaz ve arka plan kilidi sonsuza kadar kalırdı.
  function readLucaSendReported(jobId) {
    try {
      const raw = sessionStorage.getItem(LUCA_SEND_REPORTED_KEY)

      if (!raw) return []

      const stored = JSON.parse(raw)

      if (String(stored?.jobId || '') !== String(jobId || '')) {
        return []
      }

      if (Array.isArray(stored?.records)) {
        return stored.records
          .filter(record => record && String(record.sourceKey || '').trim())
          .map(record => ({
            sourceKey: String(record.sourceKey || '').trim(),
            status: String(record.status || '').trim(),
            invoiceNo: String(record.invoiceNo || '').trim(),
            error: String(record.error || '')
          }))
      }

      // ESKİ biçim (yalnızca anahtarlar): "raporlandı" sayılır ama durumu
      // bilinmediği için oynatılmaz. Yanlış bir durum uydurmamak, kalemleri
      // yeniden göndermemek daha güvenlidir.
      return Array.isArray(stored?.keys)
        ? stored.keys
          .filter(Boolean)
          .map(sourceKey => ({
            sourceKey: String(sourceKey),
            status: '',
            invoiceNo: '',
            error: ''
          }))
        : []
    } catch (error) {
      return []
    }
  }

  function writeLucaSendReported(jobId, records) {
    try {
      sessionStorage.setItem(
        LUCA_SEND_REPORTED_KEY,
        JSON.stringify({ jobId: String(jobId || ''), records })
      )
    } catch (error) {
      // sessionStorage kapalıysa yalnızca bu sekmede ilerleme kaydı olmaz.
    }
  }

  // Raporlanmış sonuçları backend'e TEKRAR gönderir.
  //
  // Neden gerekir: arka plan PENPOS_LUCA_CREATE_RESULT işlerken ağ hatası
  // alırsa görev kaydı backend'e YAZILMAZ. content.js o yanıtı görüp
  // "raporlandı" diye işaretler. Böyle bir görev yeniden açıldığında
  // pending boştur; hiçbir şey gönderilmezse görev hiçbir zaman "done"
  // olmaz ve arka plan kilidi kalıcı bloklanır. Backend birleştirmesi
  // sourceKey'e göre yapıldığı için oynatma IDEMPOTENTTİR.
  async function replayLucaSendReported(task, records) {
    const replayable = records.filter(
      record => record.sourceKey && record.status && record.status !== 'sent_pending'
    )

    if (!replayable.length) return false

    console.log(
      '[PenPOS Luca Bridge] Raporlanmış gönderim sonuçları yeniden oynatılıyor:',
      replayable.length
    )

    const response = await chrome.runtime.sendMessage({
      type: 'PENPOS_LUCA_CREATE_RESULT',
      jobId: task.jobId,
      resultToken: task.resultToken,
      results: replayable.map(record => ({
        sourceKey: record.sourceKey,
        status: record.status,
        invoiceNo: record.invoiceNo,
        error: record.error
      }))
    })

    if (!response?.ok) {
      console.warn(
        '[PenPOS Luca Bridge] Rapor oynatılamadı:',
        response?.error || 'bilinmeyen hata'
      )
    }

    return !!response?.ok
  }

  // TASLAK OLUŞTURMA (Fatura Kes) ilerlemesi. Toplu kesimde her kalemden
  // sonra CreateQuick'e dönülür; sayfa geçişi content.js bağlamını yok
  // eder. Tamamlanan kalemler sessionStorage'da (jobId kapsamlı) tutulur ve
  // dönüşte atlanır. Kayıt yoksa her dönüşte 1. kalemden başlanır ve aynı
  // öğrenciye tekrar taslak kesilir. Biçim gönderim kaydıyla aynıdır:
  //   { sourceKey, status, invoiceNo, error }
  const LUCA_CREATE_REPORTED_KEY = 'penposLucaCreateReported'

  function readLucaCreateReported(jobId) {
    try {
      const raw = sessionStorage.getItem(LUCA_CREATE_REPORTED_KEY)

      if (!raw) return []

      const stored = JSON.parse(raw)

      if (String(stored?.jobId || '') !== String(jobId || '')) {
        return []
      }

      if (Array.isArray(stored?.records)) {
        return stored.records
          .filter(record => record && String(record.sourceKey || '').trim())
          .map(record => ({
            sourceKey: String(record.sourceKey || '').trim(),
            status: String(record.status || '').trim(),
            invoiceNo: String(record.invoiceNo || '').trim(),
            error: String(record.error || '')
          }))
      }

      return []
    } catch (error) {
      return []
    }
  }

  function writeLucaCreateReported(jobId, records) {
    try {
      sessionStorage.setItem(
        LUCA_CREATE_REPORTED_KEY,
        JSON.stringify({ jobId: String(jobId || ''), records })
      )
    } catch (error) {
      // sessionStorage kapalıysa yalnızca bu sekmede ilerleme kaydı olmaz.
    }
  }

  // Raporlanmış taslak sonuçlarını backend'e TEKRAR gönderir (gönderim
  // replay ile aynı gerekçe: rapor yolda kaybolduysa görev "done" olmaz,
  // kilit kalır; birleştirme sourceKey'e göre idempotenttir).
  async function replayLucaCreateReported(task, records) {
    const replayable = records.filter(
      record => record.sourceKey && record.status
    )

    if (!replayable.length) return false

    console.log(
      '[PenPOS Luca Bridge] Raporlanmış taslak sonuçları yeniden oynatılıyor:',
      replayable.length
    )

    const response = await chrome.runtime.sendMessage({
      type: 'PENPOS_LUCA_CREATE_RESULT',
      jobId: task.jobId,
      resultToken: task.resultToken,
      results: replayable.map(record => ({
        sourceKey: record.sourceKey,
        status: record.status,
        invoiceNo: record.invoiceNo,
        error: record.error
      }))
    })

    if (!response?.ok) {
      console.warn(
        '[PenPOS Luca Bridge] Taslak rapor oynatılamadı:',
        response?.error || 'bilinmeyen hata'
      )
    }

    return !!response?.ok
  }

  // Fatura numarasına göre sunucu tarafı filtreleme yapar.
  function filterLucaStagingByInvoiceNo(invoiceNo) {
    const field = document.querySelector('#FaturaNo')

    if (!field) {
      return false
    }

    field.value = invoiceNo

    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))

    const search = document.querySelector('#searchButton')

    if (!search) {
      return false
    }

    search.click()

    return true
  }

  // SUNUCU TARAFI filtreleri temizler.
  //
  // Luca'nın staging listesi her AJAX çekiminde filterObject(param) ile
  // filtreleri SUNUCUYA gönderir ("$("#FaturaNo").val()" okunur). Bu yüzden
  // kutuda kalan ESKİ bir numara, sonraki tüm taramalarda listeyi tek
  // faturaya daraltır:
  //   * gerçekte listede olan fatura "bulunamadı" sanılır,
  //   * 'draft_missing' bildirilir, satır "Fatura Kes"e döner,
  //   * kullanıcı aynı öğrenci için MÜKERRER taslak keser.
  // Tekil onay #FaturaNo'ya yazdığı için kalıcı TEMİZLENMESİ gerekir.
  //
  // Tarih aralığı (#reportrange) da aynı filtre çubuğunda durur ve sunucuya
  // gider; o da temizlenir.
  async function clearLucaStagingFilters() {
    const targets = [
      ['#FaturaNo', 'fatura numarası'],
      ['#reportrange', 'tarih aralığı']
    ]
    const cleared = []

    for (const [selector, label] of targets) {
      const field = document.querySelector(selector)

      if (!field) continue
      if (!String(field.value || '').trim()) continue

      field.value = ''
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new Event('change', { bubbles: true }))
      cleared.push(label)
    }

    if (!cleared.length) {
      return false
    }

    // Sunucu tarafı filtre yalnızca "Ara"ya basılınca değişir.
    const search = document.querySelector('#searchButton')

    if (!search) {
      return false
    }

    search.click()
    console.log(
      '[PenPOS Luca Bridge] Luca liste filtreleri temizlendi:',
      cleared.join(', ')
    )
    // Sunucudan dönen listenin DOM'a gelmesi için beklenir.
    await sleep(1200)

    return true
  }

  // Staging satırını fatura numarasıyla bulur. ÖNCE hücrenin TAMAMEN
  // numaraya eşit olduğu satır aranır ("ABC1", "ABC123" satırıyla
  // karışmamalı); bulunamazsa içeren satıra düşülür (eski davranış).
  function findLucaStagingRow(invoiceNo) {
    const tables = document.querySelectorAll(LUCA_STAGING_TABLE_SELECTORS)
    const expected = normalizeText(invoiceNo)

    const collectRows = () => {
      const rows = []
      for (const table of tables) {
        for (const row of table.querySelectorAll('tbody tr')) {
          rows.push(row)
        }
      }
      return rows
    }

    // 1. tur: hücre tam eşleşmesi (gerçek DOM).
    for (const row of collectRows()) {
      try {
        const cells = typeof row.querySelectorAll === 'function'
          ? row.querySelectorAll('td')
          : []
        for (const cell of cells) {
          if (normalizeText(cell.innerText) === expected && expected) {
            return row
          }
        }
      } catch (error) {
        continue
      }
    }

    // 2. tur: içeren satır (eski davranış + DOM'suz ortamlar).
    for (const row of collectRows()) {
      if (normalizeText(row.innerText).includes(expected)) {
        return row
      }
    }

    return null
  }

  // DataTables Select satır seçimi. Luca'nın SendInvoice() fonksiyonu
  // gönderilecek numaraları stagingTable.rows('.selected') üzerinden alır;
  // bu yüzden Gönder'e basılmadan ÖNCE hedef satır GERÇEK Luca UI'da seçilir
  // ve seçim DOM'dan doğrulanır.
  //
  // TEK gönderimde iki garanti birlikte verilir (aksi halde gönderim YAPILMAZ):
  //   1. hedef satır `.selected` taşır,
  //   2. BAŞKA hiçbir staging satırı `.selected` TAŞIMAZ (önceki kalemin
  //      seçimi kalmışsa SendInvoice() birden fazla faturayı gönderir ve
  //      başarı yanlış numaraya yazılır).
  // TOPLU gönderimde TÜM kalemler seçilir; o zaman koşul 2 yerine
  // "seçili satır sayısı = kalem sayısı" ve "her hedef satır kendi
  // numarasını içerir" doğrulanır (bkz. sendLucaStagingBatch).
  function lucaStagingRows() {
    const rows = []

    for (const table of document.querySelectorAll(LUCA_STAGING_TABLE_SELECTORS)) {
      for (const candidate of table.querySelectorAll('tbody tr')) {
        rows.push(candidate)
      }
    }

    return rows
  }

  function lucaStagingRowIsSelected(candidate) {
    try {
      return !!candidate.classList.contains('selected')
    } catch (error) {
      return false
    }
  }

  // TÜM staging seçimini kaldırır.
  //
  // Önce Luca'nın kendi "Seçimi Kaldır" düğmesi kullanılır: DataTables API
  // üzerinden çalışır ve DOM'da görünmeyen (filtreyle gizlenmiş / başka
  // sayfadaki) seçili satırları da temizler; DOM döngüsü tek başına
  // bunları göremezdi.
  async function clearAllLucaStagingSelection() {
    try {
      const clearSelection = findLucaStagingButton('Seçimi Kaldır')

      if (clearSelection) clearSelection.click()
    } catch (error) {
      console.warn('[PenPOS Luca Bridge] Seçim temizlenemedi:', error)
    }

    for (const candidate of lucaStagingRows()) {
      if (!lucaStagingRowIsSelected(candidate)) continue

      try {
        const checkbox = candidate.querySelector('input[type="checkbox"]')

        if (checkbox) checkbox.click()
      } catch (error) {
        continue
      }
    }

    for (let check = 0; check < 10; check += 1) {
      let leftover = false

      for (const candidate of lucaStagingRows()) {
        if (lucaStagingRowIsSelected(candidate)) {
          leftover = true

          try {
            candidate.click()
          } catch (error) {
            continue
          }
        }
      }

      if (!leftover) break

      await sleep(100)
    }
  }

  // TEK bir satırı seçer; DİĞER satırların seçimine dokunmaz (toplu seçim
  // bunu kullanır). Gerçek kullanıcı tıklaması taklit edilir: ÖNCE satırın
  // hücresine tıkla (kullanıcının tıkladığı yer; DataTables Select delege
  // dinleyicisi `td` hedefinde çalışır, doğrudan `tr.click()` bazı Luca
  // tablolarında seçim ÜRETMEZ), SONRA seçim kutusuna tıkla.
  async function markLucaStagingRowSelected(row, invoiceNo) {
    const expected = normalizeText(invoiceNo)
    const isSelectedNow = () => {
      if (!lucaStagingRowIsSelected(row)) return false

      return !expected || normalizeText(row.innerText).includes(expected)
    }

    const attempts = [
      () => {
        const cell = (typeof row.querySelector === 'function' && row.querySelector('td')) || row

        cell.click()
        return true
      },
      () => {
        const checkbox = row.querySelector('input[type="checkbox"]')

        if (!checkbox) return false

        checkbox.click()
        return true
      },
      () => {
        row.click()
        return true
      }
    ]

    for (const attempt of attempts) {
      try {
        attempt()
      } catch (error) {
        console.warn('[PenPOS Luca Bridge] Staging satırı seçilemedi:', error)
        continue
      }

      for (let check = 0; check < 10; check += 1) {
        if (isSelectedNow()) return true

        await sleep(100)
      }
    }

    return false
  }

  // TEK gönderim için: tüm seçimi kaldır → hedef satırı seç → doğrula.
  async function selectLucaStagingRow(row, invoiceNo) {
    await clearAllLucaStagingSelection()

    if (!(await markLucaStagingRowSelected(row, invoiceNo))) {
      return false
    }

    // BAŞKA seçili satır kalmamalı: SendInvoice() hepsini birlikte gönderir
    // ve başarı yanlış numaraya yazılır.
    for (const candidate of lucaStagingRows()) {
      if (candidate !== row && lucaStagingRowIsSelected(candidate)) {
        return false
      }
    }

    return true
  }

  function findLucaStagingButton(label) {
    const expected = normalizeText(label)

    for (const scope of LUCA_STAGING_BUTTON_SCOPES) {
      const found = Array.from(
        document.querySelectorAll(`${scope} button`)
      ).find(button => normalizeText(button.innerText) === expected)

      if (found) {
        return found
      }
    }

    return null
  }

  // Gönderim penceresinin durumunu GERÇEK DOM'dan okur.
  // "Gönder" başlıklı üç farklı pencere vardır ve hepsinin onay butonu
  // "Onayla"dır; bu yüzden metin ayrımı şarttır:
  //   soru metni  -> hâlâ onay bekliyor / gönderiliyor
  //   başarı     -> "Seçili faturalar başarıyla gönderilmiştir."
  //   diğer      -> response.error (gerçek Luca hatası)
  function readLucaSendResult() {
    const swal = readLucaSwal()

    if (!swal || !swal.open) {
      return { state: 'none' }
    }

    if (swal.title !== LUCA_SEND_CONFIRM_TITLE) {
      return {
        state: 'other-popup',
        message: swal.title ? `${swal.title}: ${swal.text}` : ''
      }
    }

    if (LUCA_SEND_SUCCESS_RE.test(swal.text)) {
      return { state: 'success', message: swal.text }
    }

    if (swal.text.includes(LUCA_SEND_CONFIRM_TEXT)) {
      return { state: 'confirming', message: swal.text }
    }

    if (!swal.text) {
      return { state: 'pending' }
    }

    return { state: 'error', message: swal.text }
  }

  // Tüm staging listesini TEK sayfaya getirir (sayfalama sıfırlanır, arama
  // temizlenir). Toplu onayda kalemler 2. sayfada kalıp "bulunamadı"
  // sanılmasın diye gereklidir.
  async function showAllLucaStagingRows() {
    await sendResetPaging({
      tableIds: [
        '#StagingArchiveTable',
        '#StagingInvoiceTable'
      ],
      pageLength: 1000
    })
    // Sıralama ÖNEMLİ: sayfalama önce ayarlanır, filtre sonra temizlenip
    // "Ara" ile tetiklenir. Böylece son çekim hem 1000 satırlık hem de
    // FİLTRESİZ olur. dataTable.search("") yalnızca istemci tarafı
    // aramayı siler; #FaturaNo'yu silmez.
    await clearLucaStagingFilters()
  }

  // Kalem BULUNAMADIĞINDA ne olduğunu konsola yazar. Bu tanı olmadan
  // "Luca taslağı yok" ile "Luca'da listede görünmüyor" ayırt EDİLEMEZ;
  // kullanıcı "fatura var ama bulamadı" deryken ekranda ne olduğu
  // belirsiz kalıyordu.
  function logLucaStagingMiss(invoiceNo) {
    const visible = []
    for (const row of lucaStagingRows()) {
      try {
        const cells = typeof row.querySelectorAll === 'function' ? row.querySelectorAll('td') : []
        // Fatura numarası kolonu genelde 2. hücredir; tüm hücreler
        // toplanır ki kolon sırası değişse bile kayıt bulunsun.
        for (const cell of cells) {
          const value = normalizeText(cell.innerText)
          if (/^[A-Z0-9-]{6,}$/i.test(value) && !visible.includes(value)) visible.push(value)
        }
      } catch (error) {
        continue
      }
    }

    console.warn(
      `[PenPOS Luca Bridge] "${invoiceNo}" staging listesinde bulunamadı.`,
      {
        path: location.pathname,
        satirSayisi: lucaStagingRows().length,
        filtreler: {
          faturaNo: document.querySelector('#FaturaNo')?.value ?? '(yok)',
          tarih: document.querySelector('#reportrange')?.value ?? '(yok)'
        },
        gorunenNumaralar: visible.slice(0, 40)
      }
    )
  }

  // Kalemi numarayla BULMAK için iki yol vardır ve SIRASI ÖNEMLİDİR:
  //
  //   1) FİLTRESİZ TAM LİSTE (tekil de toplu da önce bu denenir).
  //      Sunucu tarafı filtreler (#FaturaNo'da unutulmuş bir numara,
  //      #reportrange tarih aralığı) listeyi daraltıp HEDEF SATIRI
  //      gizleyebilir. Fatura listede dururken "bulunamadı" denirse
  //      'draft_missing' bildirilir, PenPOS kaydı silinir ve kullanıcı
  //      MÜKERRER taslak keser. Bu yüzden filtre önce temizlenir, liste
  //      tek sayfaya getirilir ve satır numaradan okunur.
  //   2) NUMARA FİLTRESİ: yalnızca 1) yetmediğinde, Luca'nın kendi
  //      sunucu tarafı daraltması son çare olarak denenir.
  async function findLucaStagingRowWithFilter(invoiceNo, attempts = 20) {
    await showAllLucaStagingRows()

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const row = findLucaStagingRow(invoiceNo)

      if (row) {
        return row
      }

      await sleep(500)
    }

    if (!filterLucaStagingByInvoiceNo(invoiceNo)) {
      logLucaStagingMiss(invoiceNo)
      return null
    }

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const row = findLucaStagingRow(invoiceNo)

      if (row) {
        return row
      }

      await sleep(500)
    }

    logLucaStagingMiss(invoiceNo)

    return null
  }

  // TOPLU ONAY yolu: numara ile sunucu tarafı arama YAPILMAZ (yukarıda
  // açıklandığı gibi filtre biçim farklarına duyarlıdır).
  async function findLucaStagingRowInList(invoiceNo, attempts = 20) {
    if (attempts === 20) {
      await showAllLucaStagingRows()
    }

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const row = findLucaStagingRow(invoiceNo)

      if (row) {
        return row
      }

      await sleep(500)
    }

    logLucaStagingMiss(invoiceNo)

    return null
  }

  // "Gönder" -> "Onayla" adımları TEK ve TEK kalemde de, toplu gönderimde de
  // aynıdır; ortaklaştırılır.
  //
  // Önceki kalemin "Gönder" SONUÇ penceresi açık kalmış olabilir
  // (closeOnConfirm:false + DataTables tablosu yeniden kurulurken 500 ms
  // beklenir). Açık pencere "Gönder" düğmesinin çalışmasını engeller; bu
  // yüzden ÖNCE kapatılır.
  //
  // DİKKAT: Lucada #th-buttons tablonun <tfoot>'i içindedir ve
  // stagingTable.destroy() ile SİLİNİR. Bu yüzden "Gönder" düğmesi her
  // gönderim için YENİDEN sorgulanır.
  async function clickLucaSendAndConfirm(invoiceNo = '') {
    await closeLucaResultSwal(LUCA_SEND_CONFIRM_TITLE)

    const sendButton = findLucaStagingButton('Gönder')

    if (!sendButton) {
      throw new Error(
        'Luca taslak listesinde "Gönder" düğmesi bulunamadı; gönderim yapılmadı.'
      )
    }

    sendButton.click()

    // "Gönder" onay penceresi: başlık "Gönder" + soru metni + "Onayla".
    // handle-click, "visible" class'ı gelene kadar onayı ÇALIŞTIRMAZ; bu
    // yüzden "not-clickable-yet" normaldir, hemen hata verilmez.
    let confirmOutcome = ''
    let foreignPopupCount = 0
    for (let attempt = 0; attempt < 80; attempt += 1) {
      confirmOutcome = confirmLucaSwal(
        LUCA_SEND_CONFIRM_TITLE,
        LUCA_SEND_CONFIRM_LABEL,
        { text: LUCA_SEND_CONFIRM_TEXT }
      )

      if (confirmOutcome === 'confirmed') break

      // "Gönder" olmayan bir pencere (Sil / Klonla / Raporla / Fatura Tekrar
      // Gönderimi) kalıcı olarak ekranda kaldıysa gönderim yapılamaz.
      if (confirmOutcome === 'other-popup' || confirmOutcome === 'text-mismatch') {
        foreignPopupCount += 1
        if (foreignPopupCount >= 4) break
      } else {
        foreignPopupCount = 0
      }

      await sleep(250)
    }

    if (confirmOutcome !== 'confirmed') {
      const swal = readLucaSwal()
      const suffix = invoiceNo ? `; "${invoiceNo}" gönderilmedi.` : '.'

      throw new Error(
        `Luca gönderim onayı verilemedi (${confirmOutcome || 'pencere bulunamadı'}${swal?.open && swal.title ? `; ekrandaki pencere "${swal.title}"` : ''})${suffix}`
      )
    }
  }

  // Tek bir taslağı Luca'nın kendi akışıyla gönderir:
  //   filtre -> satırı SEÇ -> "Gönder" -> "Onayla" -> sonucu bekle
  // Herhangi bir adım doğrulanamazsa hata fırlatır (sessizce "başarılı"
  // sayılmaz); çağıran taraf bu faturayı "failed" olarak işaretler.
  // Sayfa geçişi (location.href) burada YAPILMAZ: bağlamı yok eder ve görevi
  // baştan başlatır. Sayfa hazırlığını runSendTask yapar.
  async function sendSingleLucaStagingInvoice(item, options = {}) {
    // bulk: true  -> numara ile sunucu tarafı arama YAPILMAZ, liste taranır.
    // bulk: false -> numara yazılıp "Ara"ya basılır (tekil onay).
    const bulk = options.bulk === true

    const invoiceNo = String(item.invoiceNo || item.no || '').trim()

    if (!invoiceNo) {
      throw new Error('Gönderilecek taslak fatura numarası bulunamadı.')
    }

    if (!document.querySelector(LUCA_STAGING_TABLE_SELECTORS)) {
      throw new Error(
        `Luca taslak listesi yüklenmedi (${location.pathname}); "${invoiceNo}" gönderilmedi.`
      )
    }

    const row = bulk
      ? await findLucaStagingRowInList(invoiceNo)
      : await findLucaStagingRowWithFilter(invoiceNo)

    if (!row) {
      // Kalıcı hata DEĞİL: Luca taslağı artık yok. 'draft_missing' ile
      // bildirilir; backend satırın taslak kaydını temizleyip "Fatura Kes"e
      // döndürür. Yeniden denemek için aynı numarayı beklemek anlamsızdır.
      throw draftMissingError(invoiceNo, location.pathname)
    }

    // ÖNEMLİ: SendInvoice() yalnızca SEÇİLİ satırları gönderir. Gönder'e
    // basılmadan ÖNCE hedef satır gerçek UI'da seçilir, BAŞKA seçili satır
    // kalmadığı ve seçili satırın aranan numara olduğu DOM'dan doğrulanır.
    if (!(await selectLucaStagingRow(row, invoiceNo))) {
      throw new Error(
        `Luca taslak listesinde "${invoiceNo}" satırı tek başına seçilemedi (seçim doğrulanamadı); gönderim yapılmadı.`
      )
    }

    await clickLucaSendAndConfirm(invoiceNo)

    // Sonuç penceresi: "Seçili faturalar başarıyla gönderilmiştir." / hata metni
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const result = readLucaSendResult()

      if (result.state === 'success') {
        // Gönderim başarı penceresinde doneFunction YOKTUR; onay butonu
        // yalnızca pencereyi kapatır ve bir sonraki kalemin liste
        // işlemini engellemez.
        await closeLucaResultSwal(LUCA_SEND_CONFIRM_TITLE)

        return invoiceNo
      }

      if (result.state === 'error') {
        throw new Error(
          `Luca "${invoiceNo}" gönderimini reddetti: ${result.message}`
        )
      }

      if (result.state === 'other-popup') {
        throw new Error(
          `Luca gönderim sonucu okunamadı (${result.message || 'pencere başlığı eşleşmedi'}).`
        )
      }

      await sleep(500)
    }

    throw new Error(
      `Luca "${invoiceNo}" gönderim sonucunu bildirmedi; fatura gönderilmiş sayılmadı.`
    )
  }

  // TOPLU GÖNDERİM hazırlığı: kalemlerin satırlarını ÖNceden bulur.
  //
  // Listedeki KALAN sunucu filtreleri (örn. #FaturaNo'da unutulmuş bir eski
  // numara) tüm listeyi tek faturaya daraltabilir; bu yüzden önce tüm liste
  // tek sayfaya getirilir VE filtreler temizlenir (bkz.
  // showAllLucaStagingRows / clearLucaStagingFilters).
  async function planLucaStagingBatch(items) {
    await showAllLucaStagingRows()
    // Sunucudan dönen satırların DOM'a yerleşmesi için kısa bekleme.
    await sleep(800)

    const targets = []
    const missing = []

    for (const item of items) {
      const invoiceNo = String(item.invoiceNo || item.no || '').trim()

      if (!invoiceNo) {
        missing.push(String(item.sourceKey || '(numarasız)'))
        continue
      }

      let row = null

      // Aynı listede birden çok kez taranır: liste geç yüklenmişse ilk
      // taramada satır yoktur.
      for (let attempt = 0; attempt < 20 && !row; attempt += 1) {
        row = findLucaStagingRow(invoiceNo)

        if (!row) await sleep(400)
      }

      if (!row) {
        missing.push(invoiceNo)
        continue
      }

      targets.push({ item, invoiceNo, row })
    }

    return { targets, missing }
  }

  // TOPLU GÖNDERİM: TÜM kalemler TEK "Gönder" tıklamasıyla gönderilir.
  //
  // Neden: kalem başına ayrı gönderimde her turda tablo yeniden kurulur,
  // seçim temizlenir, Gönder/Onayla penceresi beklenir; beş fatura dakikalar
  // sürer ve kullanıcı akışın takıldığını sanır. Luca'nın kendi
  // SendInvoice() birden çok seçili satırı destekler ("Seçili faturalar
  // başarıyla gönderilmiştir.").
  //
  // Güvenlik: seçim GÖNDERİMDEN ÖNCE doğrulanır (sayı EŞİT olmalı, her
  // hedef satır seçili olmalı). Doğrulama başarısızsa HİÇBİR şey
  // gönderilmez ve çağıran taraf kalemleri tek tek denemeye döner.
  async function sendLucaStagingBatch(targets) {
    if (!targets.length) {
      throw new Error('Luca taslak listesinde gönderilebilir fatura bulunamadı.')
    }

    await clearAllLucaStagingSelection()

    for (const target of targets) {
      if (!(await markLucaStagingRowSelected(target.row, target.invoiceNo))) {
        throw new Error(
          `Luca taslak listesinde "${target.invoiceNo}" satırı seçilemedi; toplu gönderim yapılmadı.`
        )
      }
    }

    // Seçim DOĞRULANIR: hedef sayısı kadar satır seçili olmalı. Fazlası
    // (ya da eksiği) yanlış faturanın gönderilmesi demektir.
    const selectedRows = lucaStagingRows().filter(lucaStagingRowIsSelected)

    if (selectedRows.length !== targets.length) {
      throw new Error(
        `Luca'da ${targets.length} fatura seçilmesi gerekirken ${selectedRows.length} satır seçili kaldı; toplu gönderim yapılmadı.`
      )
    }

    for (const target of targets) {
      if (!selectedRows.includes(target.row)) {
        throw new Error(
          `"${target.invoiceNo}" satırı seçilemedi; toplu gönderim yapılmadı.`
        )
      }
    }

    await clickLucaSendAndConfirm()

    // Sonuç penceresi topludur: TÜM kalemler aynı sonucu paylaşır.
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const result = readLucaSendResult()

      if (result.state === 'success') {
        await closeLucaResultSwal(LUCA_SEND_CONFIRM_TITLE)

        return targets.map(target => target.invoiceNo)
      }

      if (result.state === 'error') {
        throw new Error(`Luca toplu gönderimini reddetti: ${result.message}`)
      }

      if (result.state === 'other-popup') {
        throw new Error(
          `Luca gönderim sonucunu okunamadı (${result.message || 'pencere başlığı eşleşmedi'}).`
        )
      }

      await sleep(500)
    }

    throw new Error(
      'Luca toplu gönderim sonucunu bildirmedi; faturalar gönderilmiş sayılmadı.'
    )
  }

  // FATURAYI ONAYLA / TOPLU FATURA ONAYLA
  // TEK onayda bir fatura, TOPLU onayda seçili bulunan faturalar tek
  // "Gönder" çağrısıyla işlenir. Başarısız olan "sent" YAZILMAZ.
  async function runSendTask(task) {
    const items = Array.isArray(task.items) ? task.items : []

    if (!items.length) {
      throw new Error('Gönderilecek Luca taslak fatura bulunamadı.')
    }

    // Sayfa geçişi sonrası görev baştan başlar; daha önce raporlanan kalemler
    // sessionStorage'dan okunup atlanır (aksi halde aynı fatura tekrar
    // işlenir ve akış sonsuza kadar sürerdi).
    const reported = readLucaSendReported(task.jobId)
    const reportedKeys = new Set(reported.map(record => record.sourceKey))
    const pending = items.filter(
      item => !reportedKeys.has(String(item.sourceKey || '').trim())
    )

    if (!pending.length) {
      // TÜM kalemler raporlandı demektir. Ancak bir rapor backend'e
      // ULAŞAMAMIŞSA görev hiçbir zaman "done" olmaz ve arka plan kilidi
      // kalıcı olarak bloklar. Kayıtlı sonuçlar bu yüzden OYNATILIR.
      await replayLucaSendReported(task, reported)
      return
    }

    // Luca'nın taslak listesi. Sayfa değişimi content.js bağlamını yok
    // eder; görev yeni sayfada yeniden başlar ve buraya döner. Bu yüzden
    // navigasyon YALNIZCA hedef listede değilsek yapılır.
    const targetUrl = lucaStagingUrlFor(pending[0])

    if (!isCurrentLucaStagingPath(targetUrl)) {
      location.href = targetUrl
      await sleep(3000)
    }

    const failures = []
    const draftsMissing = []

    // TEKİL onayda numara ile sunucu tarafı arama yapılır (kesin sonuç).
    // TOPLU onayda yapılmaz: her kalem için ayrı filtre sorgusu hem yavaştır
    // hem de biçim farkına duyarlıdır — mevcut arşiv taslağı "bulunamadı"
    // sanılıp satır "Fatura Kes"e döner ve MÜKERRER taslak kesilir. Toplu
    // onayda liste tek sayfaya getirilip satır numaradan okunur.
    const bulk = pending.length > 1

    // Toplu onayda bulunan satırlar TEK bir gönderimde işlenir. Eksik satır
    // ve toplu işlem hataları raporlanır; hiçbir zaman tekli gönderime düşmez.
    const sentByBatch = new Set()
    const failedByBatch = new Map()

    if (bulk) {
      let batch = null
      try {
        batch = await planLucaStagingBatch(pending)
      } catch (error) {
        const message = error?.message || 'Luca toplu taslak listesi okunamadı.'
        for (const item of pending) failedByBatch.set(item.sourceKey, message)
      }

      if (batch) {
        const foundKeys = new Set(batch.targets.map(target => target.item.sourceKey))
        for (const item of pending) {
          if (foundKeys.has(item.sourceKey)) continue
          const invoiceNo = String(item.invoiceNo || item.no || '').trim()
          const message = invoiceNo
            ? `Luca taslak listesinde "${invoiceNo}" bulunamadı; toplu gönderime alınmadı.`
            : 'Onaylanacak taslağın fatura numarası bulunamadı; toplu gönderime alınmadı.'
          failedByBatch.set(item.sourceKey, message)
          console.warn('[PenPOS Luca Bridge] Toplu onay için Luca taslağı bulunamadı:', message)
        }

        if (batch.targets.length) {
          try {
          await sendLucaStagingBatch(batch.targets)

          for (const target of batch.targets) {
            sentByBatch.add(target.item.sourceKey)
          }

          console.log(
            '[PenPOS Luca Bridge] Toplu gönderim tamamlandı:',
            batch.targets.length,
            'fatura'
          )
          } catch (error) {
            const message = error?.message || 'Luca toplu gönderimi başarısız.'
            for (const target of batch.targets) {
              failedByBatch.set(target.item.sourceKey, message)
            }
            console.warn('[PenPOS Luca Bridge] Toplu gönderim başarısız:', message)
          }
        }
      }
    }

    for (const item of pending) {
      let result
      let record

      if (sentByBatch.has(item.sourceKey)) {
        // Toplu gönderimde bu kalem zaten gönderildi; tek tek denemeye
        // GİRİLMEZ (aksi halde Luca'da taslak kalmadığı için "draft_missing"
        // sanılır ve kullanıcı mükerrer taslak keserdi).
        const invoiceNo = String(item.invoiceNo || item.no || '').trim()

        result = { ...item, status: 'sent', invoiceNo }
        record = { sourceKey: item.sourceKey, status: 'sent', invoiceNo, error: '' }
      } else if (bulk) {
        const message = failedByBatch.get(item.sourceKey) || 'Luca toplu onay sonucu alınamadı.'
        const { invoiceNo: _ignoredInvoiceNo, ...rest } = item
        result = { ...rest, status: 'failed', error: message }
        record = { sourceKey: item.sourceKey, status: 'failed', invoiceNo: '', error: message }
        failures.push(message)
        console.warn('[PenPOS Luca Bridge] Luca toplu onay satırı başarısız:', message)
      } else {
        try {
          const invoiceNo = await sendSingleLucaStagingInvoice(item, { bulk })
          result = { ...item, status: 'sent', invoiceNo }
          record = { sourceKey: item.sourceKey, status: 'sent', invoiceNo, error: '' }
          console.log(
            '[PenPOS Luca Bridge] Luca taslağı gönderildi:',
            invoiceNo
          )
        } catch (error) {
          const message = error?.message || 'Luca gönderimi başarısız.'
          // invoiceNo BİLEREK gönderilmez: başarısız gönderimde numara
          // "gönderilmiş" anlamına gelmez, satır yeniden denenebilir kalmalıdır.
          // (Backend de failed/cancelled sonuçlarda fatura bilgisi yazmaz.)
          const { invoiceNo: _ignoredInvoiceNo, ...rest } = item

          if (error?.lucaDraftMissing) {
            // Luca taslağı artık yok -> kalıcı terminal durum. Backend satırın
            // taslak kaydını siler, satır yeniden "Fatura Kes"e döner.
            result = {
              ...rest,
              status: LUCA_DRAFT_MISSING_STATUS,
              error: message
            }
            record = {
              sourceKey: item.sourceKey,
              status: LUCA_DRAFT_MISSING_STATUS,
              invoiceNo: '',
              error: message
            }
            draftsMissing.push(message)
            console.warn(
              '[PenPOS Luca Bridge] Luca taslağı artık yok, satır "Fatura Kes"e döndürülüyor:',
              _ignoredInvoiceNo
            )
          } else {
            result = { ...rest, status: 'failed', error: message }
            record = { sourceKey: item.sourceKey, status: 'failed', invoiceNo: '', error: message }
            failures.push(message)
            console.warn('[PenPOS Luca Bridge] Luca gönderimi başarısız:', message)
          }
        }
      }

      await chrome.runtime.sendMessage({
        type: 'PENPOS_LUCA_CREATE_RESULT',
        jobId: task.jobId,
        resultToken: task.resultToken,
        results: [result]
      })

      reported.push(record)
      writeLucaSendReported(task.jobId, reported)
    }

    // Kullanıcıya iki AYRI mesaj verilir: "Luca taslağı yok" kalıcıdır ve
    // "Fatura Kes" gerektirir; gönderim hatası ise yeniden denenebilirdir.
    if (draftsMissing.length) {
      throw new Error(
        `${draftsMissing.length}/${pending.length} Luca taslağı artık yok (silinmiş veya taşınmış). Bu faturalar için PenPOS'ta "Fatura Kes" ile yeni taslak oluşturulmalı. Detay: ${draftsMissing.join(' | ')}`
      )
    }

    if (failures.length) {
      throw new Error(
        `${failures.length}/${pending.length} taslak gönderilemedi: ${failures.join(' | ')}`
      )
    }
  }

  async function startTask(task) {
    if (!task) {
      return
    }

    const jobId = String(task.jobId || "").trim()
    if (!jobId || startedJobId === jobId) {
      return startTaskPromise
    }

    startedJobId = jobId
    startTaskPromise = runTask(task)
    return startTaskPromise
  }

  async function runTask(task) {

    console.log(
      "[PenPOS Luca Bridge] Luca görevi başladı."
    )

    try {
      // manifest \"document_start\" ile enjekte edilse bile DOM hazır olmadan
      // hiçbir selector bulunamaz; önce DOM'un hazır olmasını bekle.
      await waitForDomReady()

      if (
        location.pathname
          .toLowerCase()
          .includes("/invoice/detail")
      ) {
        const detailInvoice = extractDetailPageInvoice()
        if (detailInvoice?.faturaNo) {
          console.log(
            "[PenPOS Luca Bridge] Luca detay sayfası doğrudan okunuyor:",
            detailInvoice.faturaNo
          )
          await sendInvoicesToBackground(task, [detailInvoice])
          return
        }
      }

      // Giriş KONTROLÜ görev dalından ÖNCE yapılır.
      // create/send görevleri korumalı Luca sayfalarına gittiği için
      // oturum açılmadan çalıştırılırsa forma hiç ulaşamaz.
      await ensureLucaLogin(task)

      if (task.kind === 'create') {
        await runCreateTask(task)
        return
      }

      if (task.kind === 'send') {
        await runSendTask(task)
        return
      }

      if (
        location.pathname
          .toLowerCase()
          .includes(
            "/outgoinginvoice/outgoingarchivelist"
          )
      ) {
        console.log(
          "[PenPOS Luca Bridge] Fatura arşivi hazır."
        )

        await sleep(1000)

        await runArchiveTask(task)

        return
      }

      await openArchiveAndScrape(task)

      await sleep(1500)

      if (
        location.pathname
          .toLowerCase()
          .includes(
            "/outgoinginvoice/outgoingarchivelist"
          )
      ) {
        await runArchiveTask(task)
      }
    } catch (err) {
      console.error(
        "[PenPOS Luca Bridge] İşlem hatası:",
        err
      )

      try {
        if (
          chrome?.runtime?.sendMessage
        ) {
          await chrome.runtime.sendMessage({
            type:
              "PENPOS_LUCA_ERROR",

            jobId:
              task.jobId,

            error:
              err?.message ||
              "Luca işlemi başarısız."
          })
        }
      } catch (messageError) {
        console.error(
          "[PenPOS Luca Bridge] Hata mesajı background'a gönderilemedi:",
          messageError
        )
      }
    }
  }

  window.addEventListener(
    "message",
    event => {
      const data = event.data

      if (
        !data ||
        data.source !==
          "penpos-luca-bridge"
      ) {
        return
      }

      // Sayfa (MAIN world) ile content script (ISOLATED world) farklı JS
      // dünyalarıdır: `event.source !== window` karşılaştırması dünyalar
      // arası GEÇEMEZ ve sayfanın gerçek görev bildirimini sessizce
      // düşürürdü (görev background'a hiç ulaşmaz, istemci yoklama
      // döngüsünde takılır, Extension "çalışmıyor" görünür). Doğru
      // doğrulama aynı-kaynak kontrolüdür: sayfa bildirimi kendi
      // kaynağından postalar (`window.location.origin` hedefli).
      if (
        event.origin !==
          window.location.origin
      ) {
        return
      }

      if (!['PENPOS_LUCA_START', 'PENPOS_LUCA_CREATE_START', 'PENPOS_LUCA_SEND_START'].includes(data.type)) {
        return
      }

      console.log(
        "[PenPOS Luca Bridge] PenPOS görevi Extension'a bildirildi."
      )

      // Köprü başarısızlığı sayfaya GERİ BİLDİRİLİR; aksi halde sayfa
      // yoklama döngüsünde sessizce takılır ve kullanıcı ne olduğunu
      // anlayamaz.
      const reportBridgeFailure = (errorText) => {
        try {
          window.postMessage(
            {
              source:
                "penpos-luca-bridge-response",

              ok: false,

              type: data.type,

              jobId:
                data.jobId,

              error:
                errorText
            },
            window.location.origin
          )
        } catch (reportError) {
          console.error(
            "[PenPOS Luca Bridge] Köprü hatası sayfaya bildirilemedi:",
            reportError
          )
        }
      }

      if (
        !chrome?.runtime?.sendMessage
      ) {
        console.error(
          "[PenPOS Luca Bridge] Chrome runtime mevcut değil."
        )

        reportBridgeFailure(
          "Chrome runtime mevcut değil. Extension yüklü/etkin değil ya da bu site için izin verilmemiş."
        )

        return
      }

      // Background YANIT VERMEZSE sayfa sessizce takılmasın diye YANIT
      // zaman aşımı konur. Eski bir extension kopyasında SEND/START
      // işleyici yoktur; o durumda promise hiçbir zaman sonuçlanmaz
      // (ne ok:false ne reject) ve akış başlamadan durur.
      let bridgeAnswered = false
      const bridgeTimer = setTimeout(() => {
        if (bridgeAnswered) return
        reportBridgeFailure(
          "Extension göreve yanıt vermedi. chrome://extensions içinde eski PenPOS kopyası varsa KALDIRIP güncel chrome-extension/ klasörünü yükleyin, sekmeyi yenileyip tekrar deneyin."
        )
      }, 15000)

      chrome.runtime
        .sendMessage({
          type: data.type,

          jobId:
            data.jobId,

          extensionToken:
            data.extensionToken
        })
        .then(response => {
          if (bridgeAnswered) return
          bridgeAnswered = true
          clearTimeout(bridgeTimer)

          console.log(
            "[PenPOS Luca Bridge] Background başlangıç cevabı:",
            response
          )

          // Background REDDETTİYSE (canlı kilit, sekme açılamadı, eksik
          // bilgi) sayfa bunu bilmelidir; aksi halde görev backend'de
          // oluşmuş görünür ama Luca tarafında hiçbir şey başlamaz ve
          // sayfa yoklama döngüsünde sessizce takılır.
          if (response && response.ok === false) {
            reportBridgeFailure(
              response.error ||
                "Luca görevi başlatılamadı."
            )
          }
        })
        .catch(err => {
          if (bridgeAnswered) return
          bridgeAnswered = true
          clearTimeout(bridgeTimer)

          console.error(
            "[PenPOS Luca Bridge] Background mesaj hatası:",
            err
          )

          reportBridgeFailure(
            err?.message ||
              "Görev background'a iletilemedi."
          )
        })
    }
  )

  if (isLucaPage()) {
    console.log(
      "[PenPOS Luca Bridge] Luca sayfasında Extension görevi aranıyor."
    )

    if (
      !chrome?.runtime?.sendMessage
    ) {
      console.error(
        "[PenPOS Luca Bridge] Chrome runtime bağlantısı bulunamadı."
      )

      return
    }

    chrome.runtime
      .sendMessage({
        type:
          "PENPOS_LUCA_READY"
      })
      .then(response => {
        if (!response?.ok) {
          console.error(
            "[PenPOS Luca Bridge] Luca görevi claim edilemedi:",
            response?.error || "Backend bekleyen Luca görevi döndürmedi."
          )

          return
        }

        if (
          response.type !==
            "PENPOS_LUCA_TASK"
        ) {
          console.log(
            "[PenPOS Luca Bridge] Background geçerli Luca görevi göndermedi."
          )

          return
        }

        console.log(
          "[PenPOS Luca Bridge] Luca görevi alındı."
        )

        startTask({
          jobId:
            response.jobId,

          period:
            response.period,

          targetInvoiceNo:
            response.targetInvoiceNo || '',

          kind:
            response.kind || response?.lucaTask?.kind || 'check',

          items:
            response.items || response?.lucaTask?.items || [],

          resultToken:
            response.resultToken,

          tckn:
            response.tckn,

          password:
            response.password
        })
      })
      .catch(err => {
        console.error(
          "[PenPOS Luca Bridge] Görev alınamadı:",
          err
        )
      })
  }
})()