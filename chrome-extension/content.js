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

  function getPeriodDates(period) {
    const [year, month] = String(period || "")
      .split("-")
      .map(Number)

    if (!year || !month) {
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

    const parse = value => {
      if (Array.isArray(value)) {
        return value.map(item => normalizeLineItems(item)).flat()
      }

      if (typeof value === "string") {
        try {
          return normalizeLineItems(JSON.parse(value))
        } catch {
          return []
        }
      }

      if (!value || typeof value !== "object") {
        return []
      }

      const description = value.description || value.name || value.productName || value.malHizmet || value.aciklama || ""
      const quantity = value.quantity ?? value.qty ?? value.miktar ?? 1
      const unit = value.unit || value.birim || ""
      const unitPrice = value.unitPrice ?? value.birimFiyat ?? value.price ?? value.fiyat ?? 0
      const vatRate = value.vatRate ?? value.kdvOrani ?? value.taxRate ?? value.vat ?? 0
      const vatAmount = value.vatAmount ?? value.kdvTutari ?? value.taxAmount ?? 0
      const lineTotal = value.lineTotal ?? value.toplam ?? value.total ?? (Number(quantity) * Number(unitPrice || 0))
      const discountRate = value.discountRate ?? value.indirimOrani ?? value.discount ?? 0
      const discountAmount = value.discountAmount ?? value.indirimTutari ?? 0

      if (!description && !unitPrice && !lineTotal && !quantity) {
        return []
      }

      return [{
        description: String(description || "").trim(),
        quantity: Number(quantity) || 0,
        unit: String(unit || "").trim(),
        unitPrice: Number(unitPrice) || 0,
        discountRate: Number(discountRate) || 0,
        discountAmount: Number(discountAmount) || 0,
        vatRate: Number(vatRate) || 0,
        vatAmount: Number(vatAmount) || 0,
        lineTotal: Number(lineTotal) || 0
      }]
    }

    const parsed = parse(raw)
    return Array.isArray(parsed) ? parsed : []
  }

  function normalizeInvoice(row) {
    if (!row) {
      return null
    }

    const cells = Array.from(
      row.querySelectorAll("td")
    )

    if (!cells.length) {
      return null
    }

    const alici =
      cells[1]?.innerText?.trim() || ""

    const faturaNo =
      cells[2]?.innerText?.trim() || ""

    const rawDate =
      cells[3]?.innerText?.trim() || ""

    const rawTotal =
      cells[4]?.innerText?.trim() || ""

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
      lineItems
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

    const invoices = []

    for (const row of rows) {
      const invoice = normalizeInvoice(row)

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
          )
        ) {
          return []
        }
      }

      await sleep(500)
    }

    return getPageInvoices()
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

  async function runArchiveTask(task) {
    await setLucaDateRange(
      task.period
    )

    await sleep(500)

    const clicked =
      clickAra()

    if (!clicked) {
      throw new Error(
        "Luca Ara butonuna basılamadı."
      )
    }

    await sleep(1500)

    await setPageLength()

    await sleep(1000)

    const invoices =
      await scrapeInvoices()

    console.log(
      "[PenPOS Luca Bridge] Toplam bulunan fatura:",
      invoices.length
    )

    await sendInvoicesToBackground(
      task,
      invoices
    )
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

      if (
        location.pathname
          .toLowerCase()
          .includes("/account/login")
      ) {
        await loginIfNeeded(task)

        await sleep(2500)

        if (
          location.pathname
            .toLowerCase()
            .includes("/account/login")
        ) {
          throw new Error(
            "Luca giriş yapılamadı."
          )
        }
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
      if (event.source !== window) {
        return
      }

      const data = event.data

      if (
        !data ||
        data.source !==
          "penpos-luca-bridge"
      ) {
        return
      }

      if (
        data.type !==
          "PENPOS_LUCA_START"
      ) {
        return
      }

      console.log(
        "[PenPOS Luca Bridge] PenPOS görevi Extension'a bildirildi."
      )

      if (
        !chrome?.runtime?.sendMessage
      ) {
        console.error(
          "[PenPOS Luca Bridge] Chrome runtime mevcut değil."
        )

        return
      }

      chrome.runtime
        .sendMessage({
          type:
            "PENPOS_LUCA_START",

          jobId:
            data.jobId,

          extensionToken:
            data.extensionToken
        })
        .then(response => {
          console.log(
            "[PenPOS Luca Bridge] Background başlangıç cevabı:",
            response
          )
        })
        .catch(err => {
          console.error(
            "[PenPOS Luca Bridge] Background mesaj hatası:",
            err
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
          console.log(
            "[PenPOS Luca Bridge] Bekleyen Luca görevi yok."
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