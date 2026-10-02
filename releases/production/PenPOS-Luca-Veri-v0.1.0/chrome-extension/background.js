const USE_LOCAL_API = false;
const DEFAULT_API_BASE = USE_LOCAL_API ? "http://localhost:4000" : "https://penpos.cloud";

const PENDING_KEY = "penposLucaPendingTask";
const DEVICE_KEY = "penposLucaDevice";
const TASK_SECRETS_KEY = "penposLucaTaskSecrets";
const activeTaskSecrets = new Map();
const claimInFlight = new Map();
let devicePollingStarted = false;

async function getApiBase() {
  return DEFAULT_API_BASE;
}

async function getDevice() {
  const data = await chrome.storage.local.get(DEVICE_KEY);
  return data?.[DEVICE_KEY] || null;
}

async function setDevice(device) {
  await chrome.storage.local.set({ [DEVICE_KEY]: device });
}

async function clearDevice() {
  await chrome.storage.local.remove(DEVICE_KEY);
}

function createDeviceId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function getPendingTask() {
  const data = await chrome.storage.session.get(PENDING_KEY);
  return data?.[PENDING_KEY] || null;
}

async function setPendingTask(task) {
  await chrome.storage.session.set({
    [PENDING_KEY]: task
  });
}

async function clearPendingTask() {
  await chrome.storage.session.remove(PENDING_KEY);
}

// ============================================================
// LUCA GÖREV KİLİDİ — canlılık (liveness) ve temizlik
// ============================================================
// Kilit, chrome.storage.session içindeki TEK bir PENDING_KEY yuvasıdır ve
// "Başka bir Luca görevi halen çalışıyor." hatasının tek kaynağıdır.
// Kilit şu üç koşulun HEPSİ sağlanmadığı sürece canlı sayılır:
//
//   1) Görevin sahibi olan Luca sekmesi hâlâ var mı?  (chrome.tabs.get)
//   2) Sahibi son ne zaman konuştu?                    (heartbeatAt)
//   3) Aşama bu kadar bekleyebilir mi?                 (aşama bütçesi)
//
// Gerçekten çalışan bir görev ASLA iptal edilmez: yalnızca ölü (stale)
// kilit temizlenir. Buna karşılık kilit sahiplenildikten sonra hiçbir
// koşul sağlanmazsa (Luca giriş ekranında unutulmuş sekme, content
// script'in çöktüğü sayfa, backend'e ulaşılamayan rapor) kilit eskiden
// SONSUZA KADAR kalıyordu ve kullanıcı yeni görev başlatamıyordu.
const LUCA_LOGIN_STALE_MS = 30 * 60 * 1000; // giriş ekranında en fazla 30 dk
const LUCA_TASK_STALE_MS = 20 * 60 * 1000; // sahiplenildikten sonra 20 dk sessizlik
const LUCA_HEARTBEAT_THROTTLE_MS = 5000;
const LUCA_LOCK_SWEEP_MS = 30 * 1000;

async function lucaTaskTabAlive(tabId) {
  if (!Number.isInteger(tabId)) return false;
  // tabs.get HİÇ yoksa "ölü" demek yanlış olur: gerçekten çalışan bir görevi
  // bir API kusuru yüzünden iptal etmek, kilidin kalıcılaşmasından daha kötüdür.
  // Böyle bir ortamda canlılık kanıtlanamaz, bu yüzden görev canlı sayılır ve
  // YALNIZCA zaman aşımı (heartbeat) karar verir.
  if (typeof chrome?.tabs?.get !== "function") return true;
  try {
    const tab = await chrome.tabs.get(tabId);
    return Boolean(tab);
  } catch {
    // Chrome, var olmayan sekme için "No tab with id" ile reddeder.
    return false;
  }
}

function lucaTaskIsStale(task, now = Date.now()) {
  if (!task) return true;
  if (!Number.isInteger(task.tabId)) return true;
  const last = Number(task.heartbeatAt || task.createdAt || 0);
  if (!last) return true;
  const budget = task.stage === "waiting_luca" ? LUCA_LOGIN_STALE_MS : LUCA_TASK_STALE_MS;
  return now - last > budget;
}

// Kilidi YALNIZCA jobId EŞLEŞİYORSA bırakır. Böylece geç gelen bir hata
// mesajı ya da eski bir sekme, YENİ bir görevin kilidini (ve sırlarını)
// silemez.
async function releaseLucaTaskLock(jobId, reason) {
  const current = await getPendingTask();
  if (!current) return false;
  const wanted = String(jobId || "").trim();
  if (wanted && String(current.jobId || "") !== wanted) {
    console.warn(
      "[PenPOS Luca Bridge] Kilit başka bir göreve ait, dokunulmadı:",
      wanted,
      "!=",
      current.jobId
    );
    return false;
  }
  await clearPendingTask();
  await clearTaskSecret(current.jobId);
  // Görev bitti (veya öldü): açtığımız Luca sekmesini kapat.
  //
  // Sekme bizim `chrome.tabs.create` ile açtığımız sekmedir (kullanıcının
  // kendi sekmesi değil), bu yüzden güvenle kapatılabilir. Kullanıcı
  // PenPOS'ta çalışmaya devam eder, arkasında açık Luca sekmesi kalmaz.
  // NOT: Kilit burada bırakıldığı için TÜM bitiş yolları (başarı, hata,
  // zaman aşımı, sekmenin kullanıcı tarafından kapatılması) tek noktadan
  // geçer; sekme kaçırma ihtimali yoktur.
  await closeLucaTab(current.tabId);
  console.warn(
    `[PenPOS Luca Bridge] Luca görev kilidi temizlendi (${reason}):`,
    current.jobId
  );
  return true;
}

// Ölü (stale) kilidi temizler; canlı göreve DOKUNMAZ.
// Dönüş: "tab-closed" | "expired" | null (canlı ya da kilit yok).
async function releaseStaleLucaTaskLock() {
  const current = await getPendingTask();
  if (!current) return null;

  if (!(await lucaTaskTabAlive(current.tabId))) {
    await releaseLucaTaskLock(current.jobId, "Luca sekmesi kapandı");
    return "tab-closed";
  }

  if (lucaTaskIsStale(current)) {
    await releaseLucaTaskLock(
      current.jobId,
      `zaman aşımı (${current.stage || "bilinmiyor"})`
    );
    return "expired";
  }

  return null;
}

// Görevin sahibi konuştuğunda kilidi canlı tutar.
async function touchPendingTask(jobId) {
  const current = await getPendingTask();
  if (!current) return null;
  const wanted = String(jobId || "").trim();
  if (wanted && String(current.jobId || "") !== wanted) return null;
  if (Date.now() - Number(current.heartbeatAt || 0) < LUCA_HEARTBEAT_THROTTLE_MS) {
    return current;
  }
  const next = { ...current, heartbeatAt: Date.now() };
  await setPendingTask(next);
  return next;
}

let lockSweepStarted = false;

function startLucaLockSweep() {
  if (lockSweepStarted) return;
  lockSweepStarted = true;
  setInterval(() => {
    releaseStaleLucaTaskLock().catch(() => {});
  }, LUCA_LOCK_SWEEP_MS);
}

// Luca görev sırları (TCKN/şifre) yalnızca oturum belleğinde tutulur.
// activeTaskSecrets service worker yeniden başladığında kaybolduğu için
// aynı bilgi chrome.storage.session üzerinde de saklanır (kalıcı DEĞİL).
async function readTaskSecrets() {
  const data = await chrome.storage.session.get(TASK_SECRETS_KEY);
  const stored = data?.[TASK_SECRETS_KEY];
  return stored && typeof stored === "object" ? stored : {};
}

async function getTaskSecret(jobId) {
  const id = String(jobId || "").trim();
  if (!id) return null;

  const cached = activeTaskSecrets.get(id);
  if (cached) return cached;

  const stored = await readTaskSecrets();
  const secret = stored[id] || null;
  if (secret) activeTaskSecrets.set(id, secret);
  return secret;
}

async function setTaskSecret(jobId, secret) {
  const id = String(jobId || "").trim();
  if (!id || !secret) return;

  activeTaskSecrets.set(id, secret);

  const stored = await readTaskSecrets();
  if (stored[id]?.tckn === secret.tckn && stored[id]?.password === secret.password) return;

  await chrome.storage.session.set({
    [TASK_SECRETS_KEY]: { ...stored, [id]: secret }
  });
}

async function clearTaskSecret(jobId) {
  const id = String(jobId || "").trim();
  if (!id) return;

  activeTaskSecrets.delete(id);

  const stored = await readTaskSecrets();
  if (!Object.prototype.hasOwnProperty.call(stored, id)) return;

  delete stored[id];
  await chrome.storage.session.set({ [TASK_SECRETS_KEY]: stored });
}

// Görevin BİTİNCE Luca sekmesini kapatır.
//
// Kullanıcı PenPOS'ta çalışmaya devam etsin diye sekme AÇILIRKEN de
// arka planda kalır; bitince tamamen kapanır. Böylece kullanıcıyı
// gereksiz sekme değiştirmek zorunda bırakmaz.
async function closeLucaTab(tabId) {
  const id = Number(tabId);

  if (!id) return false;
  try {
    await chrome.tabs.remove(id);
    return true;
  } catch (error) {
    // Kullanıcı sekmeyi zaten kapattıysa hata önemsizdir.
    console.info(
      "[PenPOS Luca Bridge] Luca sekmesi kapatılamadı (muhtemelen zaten kapalı):",
      error?.message || error
    );

    return false;
  }
}

// Extension görevini backend'de "error" durumuna alır.
//
// Bu çağrı OLMAZSA görev `extension_claimed` aşamasında kalır: frontend her
// yoklamada status:'running' görür ve "Faturaları Kontrol Et" butonu
// "Chrome Extension görevi devraldı…" metninde KALICI kilitlenir. Hata
// yalnızca Luca sekmesinin konsolunda görünür, kullanıcı PenPOS'ta hiçbir
// şey öğrenemez. İki yerde de (content.js istisnası VE submit reddi)
// çağrılmalıdır.
async function failCheckTask(jobId, resultToken, error) {
  const id = String(jobId || "").trim();
  const token = String(resultToken || "").trim();

  if (!id) return false;

  try {
    const device = await getDevice();
    const apiBase =
      device?.apiBase ||
      (device ? await getApiBase() : "http://localhost:4000");
    const response = await fetch(
      `${apiBase}/api/anaokulu/fail-luca/${encodeURIComponent(id)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(device?.deviceToken
            ? { Authorization: `Bearer ${device.deviceToken}` }
            : {})
        },
        body: JSON.stringify({
          resultToken: token,
          error: String(error || "Luca görevi başarısız oldu.")
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.ok) {
      console.error(
        "[PenPOS Luca Bridge] Görev hatası backend'e bildirilemedi:",
        data?.error || response.status
      );

      return false;
    }

    console.warn(
      "[PenPOS Luca Bridge] Görev hatası backend'e bildirildi:",
      error
    );

    return true;
  } catch (err) {
    console.error(
      "[PenPOS Luca Bridge] Görev hatası bildirimi başarısız:",
      err?.message || err
    );

    return false;
  }
}

async function claimTask(jobId, extensionToken) {
  const device = await getDevice();
  const apiBase = device?.apiBase || (device ? await getApiBase() : "http://localhost:4000");
  const response = await fetch(
    `${apiBase}/api/anaokulu/claim-luca/${encodeURIComponent(jobId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(device?.deviceToken ? { Authorization: `Bearer ${device.deviceToken}` } : {})
      },
      body: JSON.stringify({
        extensionToken,
        ...(device?.deviceToken ? { deviceToken: device.deviceToken } : {})
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.error ||
      `Luca görevi alınamadı (${response.status})`
    );
  }

  return data;
}

async function claimTaskOnce(task) {
  const jobId = String(task?.jobId || "").trim();
  if (!jobId) throw new Error("Luca jobId bulunamadı.");

  const existing = claimInFlight.get(jobId);
  if (existing) return existing;

  const claimPromise = (async () => {
    const claimed = await claimTask(jobId, task.extensionToken);
    const lucaTask = {
      jobId: claimed.jobId,
      kind: claimed.kind || "check",
      period: claimed.period,
      resultToken: claimed.resultToken,
      tckn: claimed.tckn,
      targetInvoiceNo: claimed.targetInvoiceNo || '',
      deviceBound: true,
      items: Array.isArray(claimed.items) ? claimed.items : []
    };
    const secret = {
      tckn: claimed.tckn,
      password: claimed.password
    };

    await setTaskSecret(jobId, secret);
    await setPendingTask({
      ...task,
      stage: "claimed",
      lucaTask,
      claimedAt: Date.now(),
      // Claim anındaki zaman damgası, "claimed" aşamasının bütçesinin
      // başlangıcıdır (LUCA_TASK_STALE_MS buradan sayılır).
      heartbeatAt: Date.now()
    });

    return { ...lucaTask, ...secret };
  })();

  claimInFlight.set(jobId, claimPromise);
  try {
    return await claimPromise;
  } finally {
    if (claimInFlight.get(jobId) === claimPromise) {
      claimInFlight.delete(jobId);
    }
  }
}

async function submitInvoices(jobId, resultToken, invoices) {
  const device = await getDevice();
  const apiBase = device?.apiBase || (device ? await getApiBase() : "http://localhost:4000");
  const response = await fetch(
    `${apiBase}/api/anaokulu/submit-luca/${encodeURIComponent(jobId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(device?.deviceToken ? { Authorization: `Bearer ${device.deviceToken}` } : {})
      },
      body: JSON.stringify({
        resultToken,
        invoices
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.error ||
      `Luca faturaları PenPOS'a gönderilemedi (${response.status})`
    );
  }

  return data;
}

async function claimInvoiceCreateTask(jobId, extensionToken) {
  const device = await getDevice();
  const apiBase = device?.apiBase || await getApiBase();
  const response = await fetch(`${apiBase}/api/anaokulu/luca-create/jobs/${encodeURIComponent(jobId)}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extensionToken })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || `Luca fatura görevi alınamadı (${response.status})`);
  return data;
}

async function submitInvoiceCreateResult(jobId, resultToken, results) {
  const device = await getDevice();
  const apiBase = device?.apiBase || await getApiBase();
  const response = await fetch(`${apiBase}/api/anaokulu/luca-create/jobs/${encodeURIComponent(jobId)}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resultToken, results })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || `Luca fatura sonucu kaydedilemedi (${response.status})`);
  return data;
}

async function closeLucaTab(tabId) {
  if (!tabId) return;

  try {
    await chrome.tabs.remove(tabId);
  } catch (err) {
    // Sekme zaten kapanmış olabilir.
  }
}

async function registerDevice(accessToken, deviceName, apiBaseValue) {
  const apiBase = String(apiBaseValue || await getApiBase()).replace(/\/+$/, "");
  const stored = await getDevice();
  const deviceId = stored?.deviceId || createDeviceId();
  const response = await fetch(`${apiBase}/api/anaokulu/luca-device/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ deviceId, deviceName })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !data?.deviceToken) {
    throw new Error(data?.error || `Cihaz bağlanamadı (${response.status})`);
  }
  await setDevice({
    deviceId,
    deviceName: data.device?.deviceName || deviceName,
    deviceToken: data.deviceToken,
    status: "online",
    lastSeen: Date.now(),
    apiBase
  });
  return data;
}

async function heartbeatDevice() {
  const device = await getDevice();
  if (!device?.deviceToken) return { ok: false, error: "Bağlı cihaz yok" };
  const apiBase = device.apiBase || await getApiBase();
  const response = await fetch(`${apiBase}/api/anaokulu/luca-device/heartbeat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${device.deviceToken}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    if (response.status === 401) await clearDevice();
    throw new Error(data?.error || `Heartbeat başarısız (${response.status})`);
  }
  await setDevice({ ...device, status: "online", lastSeen: Date.now() });
  return data;
}

async function pollDeviceTasks() {
  const device = await getDevice();
  if (!device?.deviceToken) return;

  // Ölü kilit varsa uzaktan gelen görevler de saatlerce aç kalır.
  await releaseStaleLucaTaskLock();

  const pending = await getPendingTask();
  if (pending) return;
  const apiBase = device.apiBase || await getApiBase();
  const response = await fetch(`${apiBase}/api/anaokulu/luca-device/tasks`, {
    headers: { Authorization: `Bearer ${device.deviceToken}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !data.task) return;

  // Uzaktan gelen görev de ARKA PLANDA açılır: kullanıcı PenPOS'ta çalışmaya
  // devam eder, görev bitince sekme kapanır.
  const tab = await chrome.tabs.create({
    url: "https://turmobefatura.luca.com.tr/Account/Login",
    active: false
  });
  await setPendingTask({
    jobId: data.task.jobId,
    extensionToken: data.task.extensionToken,
    tabId: tab.id,
    period: String(data.task.period || "").trim(),
    stage: "waiting_luca",
    createdAt: Date.now(),
    heartbeatAt: Date.now(),
    remote: true
  });
}

function scheduleDevicePolling() {
  if (!devicePollingStarted) return;
  setTimeout(async () => {
    try { await pollDeviceTasks(); } catch (error) { console.warn("[PenPOS Luca Veri] Görev kontrolü başarısız:", error?.message || error); }
    scheduleDevicePolling();
  }, 5000);
}

async function startDeviceRuntime() {
  if (devicePollingStarted) return;
  devicePollingStarted = true;
  try { await heartbeatDevice(); } catch {}
  scheduleDevicePolling();
}


/*
============================================================
LUCA TARİH FİLTRESİ
============================================================

Bu fonksiyon Luca sayfasının MAIN world'ünde çalıştırılır.

Böylece Luca'nın kendi:
- window.jQuery
- daterangepicker
- moment

nesnelerine doğrudan erişebilir.

CSP nedeniyle document.createElement("script")
kullanılmaz.
*/
async function setLucaDateRangeInPage(
  tabId,
  startDate,
  endDate
) {
  if (!tabId) {
    throw new Error(
      "Luca sekmesi bulunamadı."
    );
  }

  if (!startDate || !endDate) {
    throw new Error(
      "Luca tarih aralığı eksik."
    );
  }

  const results =
    await chrome.scripting.executeScript({
      target: {
        tabId
      },

      world: "MAIN",

      args: [
        startDate,
        endDate
      ],

      func: (
        startDateValue,
        endDateValue
      ) => {
        const input =
          document.querySelector(
            "#reportrange"
          );

        if (!input) {
          throw new Error(
            "Luca tarih alanı (#reportrange) bulunamadı."
          );
        }

        const $ =
          window.jQuery;

        if (
          typeof $ !==
          "function"
        ) {
          throw new Error(
            "Luca jQuery bulunamadı."
          );
        }

        const picker =
          $("#reportrange").data(
            "daterangepicker"
          );

        if (!picker) {
          throw new Error(
            "Luca daterangepicker bulunamadı."
          );
        }

        if (
          typeof window.moment !==
          "function"
        ) {
          throw new Error(
            "Luca moment bulunamadı."
          );
        }

        const start =
          window.moment(
            startDateValue,
            "YYYY-MM-DD"
          ).startOf("day");

        const end =
          window.moment(
            endDateValue,
            "YYYY-MM-DD"
          ).endOf("day");

        if (
          !start.isValid() ||
          !end.isValid()
        ) {
          throw new Error(
            "Luca tarihleri geçersiz."
          );
        }

        picker.setStartDate(
          start
        );

        picker.setEndDate(
          end
        );

        if (
          typeof picker.callback ===
          "function"
        ) {
          picker.callback(
            start,
            end
          );
        }

        // Güvenlik ağı: filterObject parametre olarak invoiceFirstDate /
        // invoiceLastDate global değerlerini kullanır. Luca'nın kendi
        // setDate callback'i bu değerleri doldurur; callback herhangi bir
        // nedenle çalışmazsa aynı biçimde doğrudan yaz (setInvoiceDateRange-
        // PicterFilter içindeki setDate ile BİREBİR aynı format).
        window.invoiceFirstDate =
          start.format(
            "MMMM D, YYYY"
          );

        window.invoiceLastDate =
          end.format(
            "MMMM D, YYYY  23:59:59"
          );

        if (
          typeof picker.updateElement ===
          "function"
        ) {
          picker.updateElement();
        }

        input.value =
          start.format(
            "DD.MM.YYYY"
          ) +
          " - " +
          end.format(
            "DD.MM.YYYY"
          );

        input.dispatchEvent(
          new Event(
            "input",
            {
              bubbles: true
            }
          )
        );

        input.dispatchEvent(
          new Event(
            "change",
            {
              bubbles: true
            }
          )
        );

        $("#reportrange").trigger(
          "apply.daterangepicker",
          picker
        );

        return {
          ok: true,

          value:
            input.value,

          start:
            start.format(
              "YYYY-MM-DD"
            ),

          end:
            end.format(
              "YYYY-MM-DD"
            ),

          invoiceFirstDate:
            window.invoiceFirstDate,

          invoiceLastDate:
            window.invoiceLastDate
        };
      }
    });

  const result =
    results?.[0]?.result;

  if (!result?.ok) {
    throw new Error(
      "Luca tarih filtresi ayarlanamadı."
    );
  }

  console.log(
    "[PenPOS Luca Bridge] Luca tarih filtresi ayarlandı:",
    result.value
  );

  return result;
}


chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (message?.type === "PENPOS_DEVICE_STATUS") {
      (async () => {
        const device = await getDevice();
        const task = await getPendingTask();
        sendResponse({
          ok: true,
          connected: Boolean(device?.deviceToken),
          device: device ? { deviceId: device.deviceId, deviceName: device.deviceName, status: device.status, lastSeen: device.lastSeen } : null,
          task: task ? { stage: task.stage, jobId: task.jobId } : null
        });
      })();
      return true;
    }

    if (message?.type === "PENPOS_DEVICE_LOGIN") {
      (async () => {
        try {
          const apiBase = DEFAULT_API_BASE;
          const response = await fetch(`${apiBase}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: message.identifier, password: message.password, portal: "anaokulu" })
          });
          const login = await response.json().catch(() => ({}));
          if (!response.ok || !login?.token) throw new Error(login?.message || login?.error || "PenPOS girişi başarısız.");
          const meResponse = await fetch(`${apiBase}/api/auth/me`, {
            headers: { Authorization: `Bearer ${login.token}` }
          });
          const me = await meResponse.json().catch(() => ({}));
          if (!meResponse.ok || !me?.user) throw new Error(me?.message || me?.error || "Anaokulu oturumu doğrulanamadı.");
          const systemType = String(me.user.systemType || '').toLowerCase();
          const isRegionAdmin = me.user.role === 'anaokulu_region_admin' || me.user.regionSystemType === 'anaokulu';
          if (systemType !== 'anaokulu' && !isRegionAdmin && me.user.role !== 'platform_admin' && me.user.role !== 'superadmin') {
            throw new Error("Bu hesap Anaokulu hesabı değil.");
          }
          const registered = await registerDevice(login.token, String(message.deviceName || "PenPOS Luca Cihazı").trim(), apiBase);
          sendResponse({ ok: true, device: registered.device });
          startDeviceRuntime();
        } catch (error) {
          sendResponse({ ok: false, error: error?.message || "Cihaz bağlanamadı." });
        }
      })();
      return true;
    }

    if (message?.type === "PENPOS_DEVICE_LOGOUT") {
      (async () => {
        try {
          const device = await getDevice();
          if (device?.deviceToken) {
            const apiBase = await getApiBase();
            await fetch(`${apiBase}/api/anaokulu/luca-device/revoke`, {
              method: "POST",
              headers: { Authorization: `Bearer ${device.deviceToken}` }
            });
          }
        } finally {
          await clearDevice();
          sendResponse({ ok: true });
        }
      })();
      return true;
    }

    // ==========================================================
    // PENPOS -> EXTENSION
    // ==========================================================
    if (
      message?.type ===
      "PENPOS_LUCA_START"
    ) {
      (async () => {
        try {
          const jobId =
            String(
              message.jobId ||
              ""
            ).trim();

          const extensionToken =
            String(
              message.extensionToken ||
              ""
            ).trim();

          if (
            !jobId ||
            !extensionToken
          ) {
            throw new Error(
              "Luca görev bilgileri eksik."
            );
          }

          // Önce ÖLÜ kilidi temizle. Gerçekten çalışan bir görev varsa
          // engel DEVAM eder; ölü görev varsa yeni görev başlayabilir.
          // (Eskiden ölü kilit kalıcıydı: kullanıcı "Fatura Kes"e bastığında
          // "Başka bir Luca görevi halen çalışıyor." görüp takılıyordu.)
          await releaseStaleLucaTaskLock();

          const existingTask = await getPendingTask();
          if (existingTask?.jobId === jobId) {
            sendResponse({ ok: true, type: "PENPOS_LUCA_STARTED", tabId: existingTask.tabId });
            return;
          }
          if (existingTask) {
            throw new Error("Başka bir Luca görevi halen çalışıyor.");
          }

          // Luca sekmesi ARKA PLANDA açılır: kullanıcı PenPOS'ta çalışmaya
          // devam eder, görev bitince sekme otomatik kapanır.
          const tab =
            await chrome.tabs.create({
              url:
                "https://turmobefatura.luca.com.tr/Account/Login",
              active: false
            });

          const task = {
            jobId,
            extensionToken,
            tabId: tab.id,
            // Dönem, backend görevinden BAĞIMSIZ olarak burada da tutulur.
            // content.js bu değeri kullanır; görevden gelen period
            // kaybolursa kontrol filtre uygulamadan tüm arşivi tarar.
            period:
              String(message.period || "").trim(),
            stage: "waiting_luca",
            createdAt: Date.now(),
            heartbeatAt: Date.now()
          };

          await setPendingTask(
            task
          );

          console.log(
            "[PenPOS Luca Bridge] Luca sekmesi arka planda açıldı.",
            tab.id,
            "dönem:",
            task.period || "(yok)"
          );

          sendResponse({
            ok: true,
            type:
              "PENPOS_LUCA_STARTED",
            tabId: tab.id
          });

        } catch (err) {
          console.error(
            "[PenPOS Luca Bridge] Başlatma hatası:",
            err
          );

          sendResponse({
            ok: false,
            error:
              err?.message ||
              "Luca işlemi başlatılamadı."
          });
        }
      })();

      return true;
    }

    if (["PENPOS_LUCA_CREATE_START", "PENPOS_LUCA_SEND_START"].includes(message?.type)) {
      (async () => {
        try {
          const jobId = String(message.jobId || "").trim();
          const extensionToken = String(message.extensionToken || "").trim();
          if (!jobId || !extensionToken) throw new Error("Luca fatura görevi bilgileri eksik.");

          // Ölü kilidi temizle; canlı görev varsa engel sürer.
          await releaseStaleLucaTaskLock();

          const existingTask = await getPendingTask();
          // AYNI jobId için mükerrer görev kurulmaz: mevcut görev yeniden
          // kullanılır. Kilit TEK yuva olduğu için koruma jobId karşılaştırması
          // ile yapılır, yuva sayısıyla değil.
          if (existingTask?.jobId === jobId) {
            sendResponse({ ok: true, type: "PENPOS_LUCA_CREATE_STARTED", tabId: existingTask.tabId });
            return;
          }
          if (existingTask) throw new Error("Başka bir Luca görevi halen çalışıyor.");
          // Luca sekmesi ARKA PLANDA açılır. Akış (satır seçimi, Gönder/Onayla
          // penceresi) gerçek Luca arayüzünde oynanır ama kullanıcı PenPOS'ta
          // çalışmaya devam eder; görev bitince sekme otomatik kapanır.
          const tab = await chrome.tabs.create({ url: "https://turmobefatura.luca.com.tr/Account/Login", active: false });
          await setPendingTask({
            jobId,
            extensionToken,
            tabId: tab.id,
            stage: "waiting_luca",
            kind: message.type === "PENPOS_LUCA_SEND_START" ? "send" : "create",
            createdAt: Date.now(),
            heartbeatAt: Date.now()
          });
          sendResponse({ ok: true, type: "PENPOS_LUCA_CREATE_STARTED", tabId: tab.id });
        } catch (err) {
          sendResponse({ ok: false, error: err?.message || "Luca fatura görevi başlatılamadı." });
        }
      })();
      return true;
    }


    // ==========================================================
    // LUCA SAYFASI -> EXTENSION
    // ==========================================================
    if (
      message?.type ===
      "PENPOS_LUCA_READY"
    ) {
      (async () => {
        try {
          const tabId =
            sender?.tab?.id;

          if (!tabId) {
            throw new Error(
              "Luca sekmesi bulunamadı."
            );
          }

          const task =
            await getPendingTask();

          if (!task) {
            throw new Error(
              "Bekleyen Luca görevi bulunamadı."
            );
          }

          if (
            task.tabId &&
            task.tabId !== tabId
          ) {
            throw new Error(
              "Bu Luca sekmesi mevcut görevle eşleşmiyor."
            );
          }

          // Sahip sekme konuştu: kilit canlı.
          await touchPendingTask(task.jobId);

          // Aynı görev daha önce claim edildiyse
          // tekrar claim yapma.
          if (task.stage === "claimed" && task.lucaTask) {
            const secret = await getTaskSecret(task.jobId);
            if (!secret) {
              throw new Error("Luca görev bilgileri artık bellekte değil. Luca görevini yeniden başlatın.");
            }
            sendResponse({
              ok: true,
              type:
                "PENPOS_LUCA_TASK",
              ...task.lucaTask,
              // Görev kaydındaki dönem ÖNCELİKLİDİR: görevden gelen
              // period koparsa buradaki değer kullanılır. Kontrol
              // filtresiz tüm arşivi taramak yerine doğru dönemle çalışır.
              period:
                String(task.period || task.lucaTask?.period || "").trim(),
              ...secret
            });

            return;
          }

          const claimed = ["create", "send"].includes(task.kind)
            ? await (async () => {
                const result = await claimInvoiceCreateTask(task.jobId, task.extensionToken);
                const lucaTask = {
                  jobId: result.jobId,
                  // Görev türü background'a GİRDİĞİ GİBİ taşınmalı.
                  // Sabit "create" yazılırsa PENPOS_LUCA_SEND_START görevleri
                  // content.js'te runSendTask yerine runCreateTask çalıştırır
                  // ve gönderim yerine yeniden taslak kesmeye çalışır.
                  kind: task.kind === "send" ? "send" : "create",
                  resultToken: result.resultToken,
                  items: result.items || [],
                  deviceBound: true
                };
                await setTaskSecret(task.jobId, { tckn: result.tckn, password: result.password });
                await setPendingTask({ ...task, stage: "claimed", lucaTask, claimedAt: Date.now(), heartbeatAt: Date.now() });
                return { ...lucaTask, tckn: result.tckn, password: result.password };
              })()
            : await claimTaskOnce(task);

          sendResponse({
            ok: true,
            type:
              "PENPOS_LUCA_TASK",
            ...claimed,
            // Görev kaydındaki dönem ÖNCELİKLİDİR (ikinci kanal): görevden
            // gelen period koparsa buradaki değer kullanılır. Kontrol,
            // filtresiz tüm arşivi taramak yerine doğru dönemle çalışır.
            period:
              String(
                task.period ||
                claimed?.period ||
                ""
              ).trim()
          });

        } catch (err) {
          console.error(
            "[PenPOS Luca Bridge] Görev alma hatası:",
            err
          );

          sendResponse({
            ok: false,
            error:
              err?.message ||
              "Luca görevi alınamadı."
          });
        }
      })();

      return true;
    }


    // ==========================================================
    // LUCA -> EXTENSION
    // Tarih filtresini MAIN WORLD'de ayarla.
    // ==========================================================
    if (
      message?.type ===
      "PENPOS_LUCA_SET_DATE_RANGE"
    ) {
      (async () => {
        try {
          const tabId =
            sender?.tab?.id;

          if (!tabId) {
            throw new Error(
              "Luca sekmesi bulunamadı."
            );
          }

          const task =
            await getPendingTask();

          if (!task) {
            throw new Error(
              "Bekleyen Luca görevi bulunamadı."
            );
          }

          if (
            task.tabId &&
            task.tabId !== tabId
          ) {
            throw new Error(
              "Luca sekmesi mevcut görevle eşleşmiyor."
            );
          }

          const startDate =
            String(
              message.startDate ||
              ""
            ).trim();

          const endDate =
            String(
              message.endDate ||
              ""
            ).trim();

          if (
            !startDate ||
            !endDate
          ) {
            throw new Error(
              "Luca tarih bilgileri eksik."
            );
          }

          console.log(
            "[PenPOS Luca Bridge] Luca tarih filtresi MAIN world üzerinden ayarlanıyor:",
            startDate,
            endDate
          );

          const result =
            await setLucaDateRangeInPage(
              tabId,
              startDate,
              endDate
            );

          sendResponse({
            ok: true,
            type:
              "PENPOS_LUCA_DATE_RANGE_SET",
            value:
              result.value,
            startDate:
              result.start,
            endDate:
              result.end
          });

        } catch (err) {
          console.error(
            "[PenPOS Luca Bridge] Tarih filtresi ayarlama hatası:",
            err
          );

          sendResponse({
            ok: false,
            type:
              "PENPOS_LUCA_DATE_RANGE_ERROR",
            error:
              err?.message ||
              "Luca tarih filtresi ayarlanamadı."
          });
        }
      })();

      return true;
    }


    // ==========================================================
    // LUCA -> EXTENSION
    // Sayfalamayı Luca'nın kendi DataTable örneği üzerinden başa al.
    // (stateSave:true kayıtlı sayfa konumunu geri yükler; kazıma
    // yanlış sayfadan başlamasın diye page(0).draw(false) çağrılır.)
    // ==========================================================
    if (
      message?.type ===
      "PENPOS_LUCA_RESET_PAGING"
    ) {
      (async () => {
        try {
          const tabId =
            sender?.tab?.id;

          if (!tabId) {
            throw new Error(
              "Luca sekmesi bulunamadı."
            );
          }

          // Hangi tablo? Varsayilan arsiv listesi; istenirse staging (taslak)
          // listeleri. Toplu onayda tum listenin TEK sayfada gorunmesi
          // gerekir; aksi halde kalemler 2. sayfada kalir, "bulunamadi"
          // sanilir ve satir "Fatura Kes"e doner.
          //
          // clearFilters varsayilan TRUE: kalinti sunucu tarafi filtreleri
          // (#FaturaNo, #reportrange, window.invoiceFirstDate/LastDate)
          // temizlenir, cunku listeyi daraltip hedef satiri GIZLER.
          // "Faturalari Kontrol Et" ise kendi tarih filtresini bu cagridan
          // hemen ONCE kurdugu icin clearFilters:false gonderir; aksi halde
          // kontrol kendi filtresini siler ve TUM arsivi tarar.
          const shouldClearFilters =
            message.clearFilters !== false;
          const tableIds =
            Array.isArray(message.tableIds) && message.tableIds.length
              ? message.tableIds.map(id => String(id))
              : ["#OutgoingArchiveTable"];

          const pageLength =
            Number(message.pageLength) > 0
              ? Number(message.pageLength)
              : 1000;

          const results =
            await chrome.scripting.executeScript({
              target: {
                tabId
              },

              world: "MAIN",

              args: [
                tableIds,
                pageLength,
                shouldClearFilters
              ],

              func: (ids, wantedLength, shouldClearFilters) => {
                const $ =
                  window.jQuery;

                if (
                  !$ ||
                  typeof $.fn !==
                    "object" ||
                  typeof $.fn.DataTable !==
                    "function"
                ) {
                  return {
                    ok: false,
                    reason:
                      "Luca DataTable JS bulunamadi."
                  };
                }

                for (const id of ids) {
                  const table =
                    document.querySelector(
                      id
                    );

                  if (!table) {
                    continue;
                  }

                  if (
                    typeof $.fn.DataTable.isDataTable !==
                      "function" ||
                    !$.fn.DataTable.isDataTable(table)
                  ) {
                    continue;
                  }

                  const dataTable =
                    $(table).DataTable();

                  // Tum liste tek sayfada: satirlar DOM'a gelir.
                  // SIRA ONEMLI: once sayfa boyutu ayarlanir, SONRA
                  // sunucu tarafi filtreler temizlenir ve "Ara" ile
                  // tetiklenir. Boylece son cekim hem uzun liste hem de
                  // FILTRESIZ olur.
                  try {
                    if (typeof dataTable.page.len === "function") {
                      dataTable.page.len(wantedLength).draw(false);
                    }
                  } catch (lenError) {}

                  try {
                    if (typeof dataTable.search === "function") {
                      dataTable.search("").draw(false);
                    }
                  } catch (searchError) {}

                  // ────────────────────────────────────────────────
                  // SUNUCU TARAFI FILTRE KALINTILARI
                  //
                  // Lucanin staging listesi her AJAX cekiminde
                  // filterObject(param) ile filtreleri SUNUCUYA gonderir.
                  // Kalinti bir filtre listeyi hedef satiru GIZLEYEBILIR:
                  //   * #FaturaNo : tekil onayda yazilan numara kalir,
                  //   * window.invoiceFirstDate / invoiceLastDate : tarih
                  //     filtresi BU GLOBALDELEGERLERDE tutulur (input
                  //     temizlemek YETMEZ; bkz. setLucaDateRange).
                  // Gerekce: gizlenen satir "bulunamadi" sanilir,
                  // 'draft_missing' bildirilir ve kullanici ayni ogrenci
                  // icin MUKERRER taslak keser.
                  const clearedFilters = [];

                  if (shouldClearFilters) {
                    const faturaNoField =
                      document.querySelector("#FaturaNo");

                    if (
                      faturaNoField &&
                      String(faturaNoField.value || "").trim()
                    ) {
                      faturaNoField.value = "";
                      clearedFilters.push("FaturaNo");
                    }

                    if (
                      String(
                        window.invoiceFirstDate || ""
                      ).trim() ||
                      String(
                        window.invoiceLastDate || ""
                      ).trim()
                    ) {
                      window.invoiceFirstDate = "";
                      window.invoiceLastDate = "";
                      clearedFilters.push(
                        "invoiceFirst/LastDate"
                      );
                    }

                    const rangeInput =
                      document.querySelector("#reportrange");

                    if (
                      rangeInput &&
                      String(rangeInput.value || "").trim()
                    ) {
                      rangeInput.value = "";
                      clearedFilters.push("reportrange");
                    }
                  }

                  // Temizlikten SONRA tek arama: "Ara" dugmesi
                  // stagingTable.ajax.reload() tetikler ve filtreler
                  // sunucuya gider.
                  const searchButton =
                    document.querySelector("#searchButton");

                  if (
                    clearedFilters.length &&
                    searchButton
                  ) {
                    searchButton.click();
                  }

                  if (typeof dataTable.page === "function") {
                    dataTable.page(0).draw(false);
                  }

                  const info =
                    typeof dataTable.page.info === "function"
                      ? dataTable.page.info()
                      : null;

                  return {
                    ok: true,
                    clearedFilters,
                    // UYGULANAN tarih filtresi. Luca filtreyi
                    // window.invoiceFirstDate/LastDate GLOBALINDE ve
                    // URL'de tutar; #reportrange input'u BOS olabilir ve
                    // yine de filtre AÇIK olabilir. Dogrulama bu
                    // globalden yapilir (content.js ISOLATED world'de
                    // window'a erisemez).
                    dateRange: {
                      first: String(
                        window.invoiceFirstDate || ""
                      ).trim(),
                      last: String(
                        window.invoiceLastDate || ""
                      ).trim(),
                      input: String(
                        document.querySelector(
                          "#reportrange"
                        )?.value || ""
                      ).trim()
                    },
                    page: info?.page ?? 0,
                    length: info?.length ?? 0,
                    total: info?.recordsTotal ?? 0
                  };
                }

                return {
                  ok: false,
                  reason:
                    "Luca tablosu bulunamadi."
                };
              }
            });

          const value =
            results?.[0]?.result || {
              ok: false,
              reason:
                "Luca sayfalama yanıtı alınamadı."
            };

          sendResponse({
            ok: true,
            ...value
          });
        } catch (err) {
          console.error(
            "[PenPOS Luca Bridge] Sayfalama sıfırlama hatası:",
            err
          );

          sendResponse({
            ok: false,
            error:
              err?.message ||
              "Luca sayfalama sıfırlanamadı."
          });
        }
      })();

      return true;
    }


    // ==========================================================
    // LUCA -> EXTENSION
    // Yeni müşteri formunu CSP ihlali OLMADAN açar.
    //
    // #CustomerActions gerçek DOM'da:
    //   <a href="javascript: void(0);" onclick="createRecipient()">
    // Bu anchor'a .click() veya element.dispatchEvent(new MouseEvent('click'))
    // göndermek Chrome'da "javascript:" URL varsayılan eylemini çalıştırır ve
    // "Running the JavaScript URL violates Content Security Policy..." hatası
    // verir. Bu yüzden anchor'a HİÇ click gönderilmez; main dünyada Luca'nın
    // GERÇEK createRecipient() fonksiyonu doğrudan çağrılır. Fonksiyon yoksa
    // gerçek element.onclick işleyicisi yine doğrudan çalıştırılır.
    // ==========================================================
    if (
      message?.type ===
      "PENPOS_LUCA_OPEN_RECIPIENT_MODAL"
    ) {
      (async () => {
        try {
          const tabId =
            sender?.tab?.id;

          if (!tabId) {
            throw new Error(
              "Luca sekmesi bulunamadı."
            );
          }

          const results =
            await chrome.scripting.executeScript({
              target: {
                tabId
              },

              world: "MAIN",

              func: () => {
                // Öncelik 1: Luca'nın gerçek fonksiyonu.
                if (
                  typeof window.createRecipient ===
                  "function"
                ) {
                  window.createRecipient();

                  return {
                    ok: true,
                    via: "createRecipient"
                  };
                }

                // Öncelik 2: gerçek inline onclick işleyicisi; javascript:
                // URL'i çalıştırmadan doğrudan handler çağrılır.
                const link =
                  document.querySelector(
                    "#CustomerActions"
                  );

                if (
                  link &&
                  typeof link.onclick ===
                    "function"
                ) {
                  link.onclick.call(
                    link,
                    new MouseEvent("click", {
                      bubbles: true,
                      cancelable: true,
                      view: window
                    })
                  );

                  return {
                    ok: true,
                    via: "onclick"
                  };
                }

                return {
                  ok: false,
                  reason:
                    "Luca createRecipient() bulunamadı."
                };
              }
            });

          const value =
            results?.[0]?.result || {
              ok: false,
              reason:
                "Luca müşteri formu yanıtı alınamadı."
            };

          sendResponse({
            ok: true,
            ...value
          });
        } catch (err) {
          console.error(
            "[PenPOS Luca Bridge] Müşteri formu açma hatası:",
            err
          );

          sendResponse({
            ok: false,
            error:
              err?.message ||
              "Luca 'Yeni Müşteri Ekle' formu açılamadı."
          });
        }
      })();

      return true;
    }


    // ==========================================================
    // LUCA -> EXTENSION
    // Faturalar geldi.
    // ==========================================================
    if (
      message?.type ===
      "PENPOS_LUCA_INVOICES"
    ) {
      (async () => {
        const task =
          await getPendingTask();

        const tabId = sender?.tab?.id;

        try {
          if (!task) {
            throw new Error(
              "Bekleyen Luca görevi bulunamadı."
            );
          }

          const jobId =
            String(
              message.jobId ||
              task.jobId ||
              ""
            ).trim();

          const invoices =
            Array.isArray(
              message.invoices
            )
              ? message.invoices
              : [];

          const resultToken =
            String(
              message.resultToken ||
              task?.lucaTask?.resultToken ||
              ""
            ).trim();

          if (!jobId) {
            throw new Error(
              "Luca jobId bulunamadı."
            );
          }

          if (!resultToken) {
            throw new Error(
              "Luca sonuç tokenı bulunamadı."
            );
          }

          console.log(
            `[PenPOS Luca Bridge] ${invoices.length} fatura PenPOS'a gönderiliyor.`
          );

          const result =
            await submitInvoices(
              jobId,
              resultToken,
              invoices
            );

          console.log(
            "[PenPOS Luca Bridge] Faturalar PenPOS'a başarıyla gönderildi.",
            result.accepted
          );

          // İş tamamlandı.
          await releaseLucaTaskLock(task.jobId, "faturalar gönderildi");
          await clearTaskSecret(jobId);

          // Luca sekmesini kapat.
          await closeLucaTab(
            tabId
          );

          sendResponse({
            ok: true,
            type:
              "PENPOS_LUCA_SUBMITTED",

            jobId,

            accepted:
              result.accepted ??
              invoices.length
          });

        } catch (err) {
          console.error(
            "[PenPOS Luca Bridge] Fatura gönderme hatası:",
            err
          );

          await failCheckTask(
            task?.jobId || message.jobId,
            message.resultToken || task?.lucaTask?.resultToken,
            err?.message || "Luca faturaları PenPOS'a gönderilemedi."
          );

          // Kontrol (arşiv) görevi burada da bitmiyor: kilit bırakılırsa
          // "Faturaları Kontrol Et" sonrası yeni görev başlatılamaz.
          await releaseLucaTaskLock(task?.jobId, `fatura gönderilemedi: ${err?.message || err}`);

          // Hata olsa bile Luca sekmesini kapat.
          await closeLucaTab(
            tabId
          );

          sendResponse({
            ok: false,
            type:
              "PENPOS_LUCA_SUBMIT_ERROR",
            error:
              err?.message ||
              "Luca faturaları PenPOS'a gönderilemedi."
          });
        }
      })();

      return true;
    }

    if (message?.type === "PENPOS_LUCA_CREATE_RESULT") {
      (async () => {
        const task = await getPendingTask();
        try {
          if (!task || !["create", "send"].includes(task.kind)) throw new Error("Bekleyen Luca fatura görevi bulunamadı.");

          const messageJobId = String(message.jobId || "").trim();

          // Farklı göreve ait sonuç, başka bir görevin kilidine DOKUNMAZ.
          if (messageJobId && messageJobId !== String(task.jobId)) {
            sendResponse({
              ok: false,
              type: "PENPOS_LUCA_CREATE_ERROR",
              error: "Bu sonuç farklı bir Luca görevine ait."
            });
            return;
          }

          const result = await submitInvoiceCreateResult(
            task.jobId,
            String(message.resultToken || task?.lucaTask?.resultToken || ""),
            Array.isArray(message.results) ? message.results : []
          );

          await touchPendingTask(task.jobId);

          if (result.done) {
            await releaseLucaTaskLock(task.jobId, "görev tamamlandı");
            await closeLucaTab(sender?.tab?.id || task.tabId);
          }
          sendResponse({ ok: true, type: "PENPOS_LUCA_CREATE_SUBMITTED", ...result });
        } catch (err) {
          // Sonuç backend'e yazılamadıysa görev ilerleyemez. Kilt birakılırsa
          // kullanıcı yeni görev de başlatamaz; bu yüzden kilit burada
          // bırakılır. Satırlar "Fatura Kes"e dönmediği için yeniden denenebilir.
          await releaseLucaTaskLock(task?.jobId, `sonuç kaydedilemedi: ${err?.message || err}`);
          sendResponse({ ok: false, type: "PENPOS_LUCA_CREATE_ERROR", error: err?.message || "Luca fatura sonucu gönderilemedi." });
        }
      })();
      return true;
    }


    // ==========================================================
    // LUCA -> EXTENSION
    // Hata bildirimi
    // ==========================================================
    if (
      message?.type ===
      "PENPOS_LUCA_ERROR"
    ) {
      (async () => {
        const task =
          await getPendingTask();

        const messageJobId = String(message.jobId || "").trim();

        // YALNIZCA KENDİ görevinin hatası kilidini bırakır. Geç gelen bir
        // hata mesajı yeni bir görevin kilidini (ve sırlarını) silemez.
        if (task && messageJobId && messageJobId !== String(task.jobId)) {
          console.warn(
            "[PenPOS Luca Bridge] Farklı göreve ait hata mesajı yok sayıldı:",
            messageJobId
          );

          sendResponse({
            ok: true,
            type:
              "PENPOS_LUCA_ERROR_ACK"
          });

          return;
        }

        const tabId =
          sender?.tab?.id ||
          task?.tabId;

        console.error(
          "[PenPOS Luca Bridge] Luca hata:",
          message.error
        );

        if (task?.kind === "create" || task?.kind === "send") {
          try {
            await submitInvoiceCreateResult(
              task.jobId,
              task?.lucaTask?.resultToken || "",
              (task.lucaTask?.items || task.items || []).map(item => ({
                ...item,
                status: "failed",
                error: message.error || "Luca işlemi başarısız."
              }))
            );
          } catch (resultError) {
            console.warn("[PenPOS Luca Bridge] Fatura hata sonucu kaydedilemedi:", resultError?.message || resultError);
          }
        }

        await releaseLucaTaskLock(task?.jobId, "Luca işlemi hatası");

        // HATA durumunda Luca sekmesi KAPATILMAZ.
        // Kullanıcı hatayı inceleyip (ör. Luca onay penceresi) aynı satıra
        // yeniden "Fatura Kes" basabilsin diye sekme açık bırakılır.
        // Başarılı akışta sekme ilgili sonuç işleyicisinde kapatılır.
        console.warn(
          "[PenPOS Luca Bridge] Luca hatası nedeniyle sekme açık bırakıldı:",
          tabId
        );

        sendResponse({
          ok: true,
          type:
            "PENPOS_LUCA_ERROR_ACK"
        });
      })();

      return true;
    }


    // ==========================================================
    // PING
    // ==========================================================
    if (
      message?.type ===
      "PENPOS_LUCA_PING"
    ) {
      sendResponse({
        ok: true,
        type:
          "PENPOS_LUCA_PONG"
      });

      return false;
    }


    // ==========================================================
    // CHECK REQUEST
    // ==========================================================
    if (
      message?.type ===
      "PENPOS_LUCA_CHECK_REQUEST"
    ) {
      sendResponse({
        ok: true,
        type:
          "PENPOS_LUCA_CHECK_RESPONSE"
      });

      return false;
    }

    return false;
  }
);


// ============================================================
// SEKME KAPANIRSA GÖREV TEMİZLİĞİ
// ============================================================
chrome.tabs.onRemoved.addListener(
  async (tabId) => {
    const task =
      await getPendingTask();

    if (
      task?.tabId === tabId
    ) {
      console.log(
        "[PenPOS Luca Bridge] Luca sekmesi kapandı."
      );

      // Sekmesi kapanan görev artık ilerleyemez; kilidi KESIN olarak bırak.
      await releaseLucaTaskLock(
        task.jobId,
        "Luca sekmesi kapandı"
      );
    }
  }
);

// Ölü kilitleri periyodik olarak temizle: kullanıcı yeni görev başlatmayı
// denemeden de kilit kendiliğinden çözülür. Canlı görevlere dokunulmaz.
startLucaLockSweep();

// Servis worker yeniden başladığında (kilit chrome.storage.session'da
// kaldığı için) süpürmeyi hemen bir kez çalıştır.
releaseStaleLucaTaskLock().catch(() => {});

chrome.runtime.onStartup.addListener(() => {
  startDeviceRuntime();
});

chrome.runtime.onInstalled.addListener(() => {
  startDeviceRuntime();
});


// ============================================================
// EXTENSION BAŞLADI
// ============================================================
console.log(
  "[PenPOS Luca Bridge] Background aktif."
);
startDeviceRuntime();