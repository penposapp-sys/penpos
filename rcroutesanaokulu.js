[1mdiff --git a/backend/src/controllers/anaokuluController.js b/backend/src/controllers/anaokuluController.js[m
[1mindex 016cf2f..6748d0a 100644[m
[1m--- a/backend/src/controllers/anaokuluController.js[m
[1m+++ b/backend/src/controllers/anaokuluController.js[m
[36m@@ -166,16 +166,22 @@[m [mexport const checkLucaInvoices = async (req, res) => {[m
 [m
     // Job oluştur ve hemen dön[m
     const jobId = crypto.randomUUID()[m
[32m+[m[32m    const extensionToken = crypto.randomBytes(32).toString('hex')[m
[32m+[m[32m    const extensionTokenHash = crypto.createHash('sha256').update(extensionToken).digest('hex')[m
     lucaJobs.set(jobId, {[m
       status: 'running',[m
[31m-      step: 'Luca kontrolü başlatılıyor…',[m
[32m+[m[32m      phase: 'waiting_extension',[m
[32m+[m[32m      period,[m
[32m+[m[32m      tenantId: String(tenantId),[m
[32m+[m[32m      extensionTokenHash,[m
[32m+[m[32m      step: 'Chrome Extension bağlantısı bekleniyor…',[m
       startedAt: Date.now()[m
     })[m
 [m
     // Arka planda çalıştır (await YOK)[m
[31m-    _runLucaJob(jobId, tenantId, school, tckn, password, period)[m
[32m+[m[32m    // Luca işlemi Chrome Extension tarafından yürütülecek.[m
 [m
[31m-    return res.json({ ok: true, jobId, status: 'running' })[m
[32m+[m[32m    return res.json({ ok: true, jobId, extensionToken, status: 'running' })[m
   } catch (err) {[m
     console.error('[checkLucaInvoices] Hata:', err)[m
     res.status(500).json({ error: err?.message || 'Luca entegrasyon hatası' })[m
[36m@@ -187,7 +193,99 @@[m [mexport const checkLucaJobStatus = async (req, res) => {[m
   const { jobId } = req.params[m
   const job = lucaJobs.get(jobId)[m
   if (!job) return res.status(404).json({ error: 'Job bulunamadı veya süresi doldu.' })[m
[31m-  return res.json(job)[m
[32m+[m[32m  const { extensionTokenHash, ...safeJob } = job[m
[32m+[m[32m  return res.json(safeJob)[m
[32m+[m[32m}[m
[32m+[m[32mexport const claimLucaExtensionTask = async (req, res) => {[m
[32m+[m[32m  try {[m
[32m+[m[32m    const { jobId } = req.params[m
[32m+[m[32m    const token = String(req.body?.extensionToken || '').trim()[m
[32m+[m
[32m+[m[32m    if (!jobId || !token) {[m
[32m+[m[32m      return res.status(400).json({ error: 'Extension görev bilgisi eksik.' })[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const job = lucaJobs.get(jobId)[m
[32m+[m[32m    if (!job) {[m
[32m+[m[32m      return res.status(404).json({ error: 'Job bulunamadı veya süresi doldu.' })[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    if (job.status !== 'running' || job.phase !== 'waiting_extension') {[m
[32m+[m[32m      return res.status(409).json({[m
[32m+[m[32m        error: 'Bu Luca görevi Extension için hazır değil.'[m
[32m+[m[32m      })[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    if (!job.startedAt || Date.now() - job.startedAt > 5 * 60 * 1000) {[m
[32m+[m[32m      return res.status(410).json({[m
[32m+[m[32m        error: 'Extension görev anahtarının süresi doldu.'[m
[32m+[m[32m      })[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const tokenHash = crypto[m
[32m+[m[32m      .createHash('sha256')[m
[32m+[m[32m      .update(token)[m
[32m+[m[32m      .digest('hex')[m
[32m+[m
[32m+[m[32m    const expectedHash = String(job.extensionTokenHash || '')[m
[32m+[m
[32m+[m[32m    if ([m
[32m+[m[32m      !expectedHash ||[m
[32m+[m[32m      expectedHash.length !== tokenHash.length ||[m
[32m+[m[32m      !crypto.timingSafeEqual([m
[32m+[m[32m        Buffer.from(tokenHash),[m
[32m+[m[32m        Buffer.from(expectedHash)[m
[32m+[m[32m      )[m
[32m+[m[32m    ) {[m
[32m+[m[32m      return res.status(401).json({[m
[32m+[m[32m        error: 'Geçersiz Extension görev anahtarı.'[m
[32m+[m[32m      })[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const tenantId = job.tenantId[m
[32m+[m[32m    const school = await AnaokuluSchool.findOne({[m
[32m+[m[32m      tenant: tenantId[m
[32m+[m[32m    }).lean()[m
[32m+[m
[32m+[m[32m    if (!school) {[m
[32m+[m[32m      return res.status(404).json({[m
[32m+[m[32m        error: 'Okul kaydı bulunamadı.'[m
[32m+[m[32m      })[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const luca = school?.settings?.luca || {}[m
[32m+[m[32m    const tckn = luca.tckn || luca.username || luca.customerNo[m
[32m+[m[32m    const password = luca.password[m
[32m+[m
[32m+[m[32m    if (!tckn || !password) {[m
[32m+[m[32m      return res.status(400).json({[m
[32m+[m[32m        error: 'Luca giriş bilgileri eksik.'[m
[32m+[m[32m      })[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    // Token tek kullanımlık.[m
[32m+[m[32m    lucaJobs.set(jobId, {[m
[32m+[m[32m      ...job,[m
[32m+[m[32m      phase: 'extension_claimed',[m
[32m+[m[32m      step: 'Chrome Extension görevi devraldı…',[m
[32m+[m[32m      extensionTokenHash: undefined,[m
[32m+[m[32m      claimedAt: Date.now()[m
[32m+[m[32m    })[m
[32m+[m
[32m+[m[32m    return res.json({[m
[32m+[m[32m      ok: true,[m
[32m+[m[32m      jobId,[m
[32m+[m[32m      period: job.period,[m
[32m+[m[32m      tckn,[m
[32m+[m[32m      password[m
[32m+[m[32m    })[m
[32m+[m[32m  } catch (err) {[m
[32m+[m[32m    console.error('[claimLucaExtensionTask] Hata:', err)[m
[32m+[m
[32m+[m[32m    return res.status(500).json({[m
[32m+[m[32m      error: err?.message || 'Extension görevi alınamadı.'[m
[32m+[m[32m    })[m
[32m+[m[32m  }[m
 }[m
 [m
 // ─── İç yardımcı: arka planda çalışan Luca job'u ───[m
