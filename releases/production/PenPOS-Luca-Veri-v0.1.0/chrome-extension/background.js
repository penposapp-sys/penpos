const USE_LOCAL_API = false;
const DEFAULT_API_BASE = "https://penpos.cloud";

const PENDING_KEY = "penposLucaPendingTask";
const DEVICE_KEY = "penposLucaDevice";
const activeTaskSecrets = new Map();
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

async function claimTask(jobId, extensionToken) {
  const device = await getDevice();
  const apiBase = DEFAULT_API_BASE;
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

async function submitInvoices(jobId, resultToken, invoices) {
  const device = await getDevice();
  const apiBase = DEFAULT_API_BASE;
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

async function closeLucaTab(tabId) {
  if (!tabId) return;

  try {
    await chrome.tabs.remove(tabId);
  } catch (err) {
    // Sekme zaten kapanmış olabilir.
  }
}

async function registerDevice(accessToken, deviceName, apiBaseValue) {
  const apiBase = DEFAULT_API_BASE;
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
  const apiBase = DEFAULT_API_BASE;
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
  const pending = await getPendingTask();
  if (pending) return;
  const apiBase = DEFAULT_API_BASE;
  const response = await fetch(`${apiBase}/api/anaokulu/luca-device/tasks`, {
    headers: { Authorization: `Bearer ${device.deviceToken}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !data.task) return;

  const tab = await chrome.tabs.create({
    url: "https://turmobefatura.luca.com.tr/Account/Login",
    active: false
  });
  await setPendingTask({
    jobId: data.task.jobId,
    extensionToken: data.task.extensionToken,
    tabId: tab.id,
    stage: "waiting_luca",
    createdAt: Date.now(),
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
            )
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
            const apiBase = DEFAULT_API_BASE;
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

          // Önce eski görev varsa temizle.
          await clearPendingTask();

          // Luca'yı AKTİF sekme yapmadan aç.
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
            stage: "waiting_luca",
            createdAt: Date.now()
          };

          await setPendingTask(
            task
          );

          console.log(
            "[PenPOS Luca Bridge] Luca arka plan sekmesinde açıldı.",
            tab.id
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

          // Aynı görev daha önce claim edildiyse
          // tekrar claim yapma.
          if (
            task.stage ===
              "claimed" &&
            task.lucaTask
          ) {
            const secret = activeTaskSecrets.get(task.jobId);
            if (!secret) {
              throw new Error("Luca görev bilgileri artık bellekte değil. Luca görevini yeniden başlatın.");
            }
            sendResponse({
              ok: true,
              type:
                "PENPOS_LUCA_TASK",
              ...task.lucaTask,
              ...secret
            });

            return;
          }

          const claimed =
            await claimTask(
              task.jobId,
              task.extensionToken
            );

          const lucaTask = {
            jobId:
              claimed.jobId,

            period:
              claimed.period,

            resultToken:
              claimed.resultToken,

            tckn:
              claimed.tckn,

            deviceBound: true
          };

          activeTaskSecrets.set(task.jobId, {
            tckn: claimed.tckn,
            password: claimed.password
          });

          await setPendingTask({
            ...task,

            stage:
              "claimed",

            lucaTask,

            claimedAt:
              Date.now()
          });

          sendResponse({
            ok: true,
            type:
              "PENPOS_LUCA_TASK",
            ...lucaTask
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
    // Faturalar geldi.
    // ==========================================================
    if (
      message?.type ===
      "PENPOS_LUCA_INVOICES"
    ) {
      (async () => {
        const task =
          await getPendingTask();

        const tabId =
          sender?.tab?.id ||
          task?.tabId;

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
          await clearPendingTask();
          activeTaskSecrets.delete(jobId);

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

        const tabId =
          sender?.tab?.id ||
          task?.tabId;

        console.error(
          "[PenPOS Luca Bridge] Luca hata:",
          message.error
        );

        await clearPendingTask();

        await closeLucaTab(
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

      await clearPendingTask();
    }
  }
);

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