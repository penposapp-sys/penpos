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

    return {
      alici,
      faturaNo,
      isoDate,
      total: parseTotal(rawTotal),
      period: isoDate ? isoDate.slice(0, 7) : ""
    }
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