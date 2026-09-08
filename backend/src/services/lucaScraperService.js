import puppeteer from 'puppeteer';
import { existsSync } from 'fs';

// Linux production sunucusu için Chrome/Chromium binary tespiti
const detectChromiumPath = () => {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/usr/local/bin/chromium',
  ].filter(Boolean)

  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null // Puppeteer'ın kendi indirdiği chrome'u kullan
}

class LucaScraperService {
  constructor() {
    this.loginUrl = 'https://turmobefatura.luca.com.tr/Account/Login';
    this.archiveInvoicesUrl = 'https://turmobefatura.luca.com.tr/OutgoingInvoice/OutgoingArchiveList';
  }

  async getInvoices(tckn, password, startDate, endDate) {
    if (!tckn || !password) {
      throw new Error('TCKN ve Şifre bilgileri eksik.');
    }

    console.log(`[LucaScraper] ${tckn} için giriş yapılıyor... (Dönem: ${startDate} - ${endDate})`);

    // Linux üretim sunucuları için gerekli tüm argümanlar
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1400,900',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ]

    const executablePath = detectChromiumPath()
    const launchOptions = {
      headless: 'new',
      args: launchArgs,
      ...(executablePath ? { executablePath } : {}),
      timeout: 30000,
    }

    if (executablePath) {
      console.log(`[LucaScraper] Chromium yolu: ${executablePath}`)
    }

    let browser
    try {
      browser = await puppeteer.launch(launchOptions)
    } catch (launchErr) {
      const msg = launchErr?.message || String(launchErr)
      const isLibErr = msg.includes('cannot open shared object') || msg.includes('error while loading shared lib') || msg.includes('No such file or directory')
      if (isLibErr) {
        throw new Error(
          'Sunucuda Chrome/Chromium sistem kütüphaneleri eksik. Lütfen sunucuya Chromium yükleyin:\n' +
          'Ubuntu/Debian: apt-get install -y chromium-browser\n' +
          'veya: apt-get install -y chromium\n' +
          'CentOS/RHEL: yum install -y chromium\n' +
          'Alternatif olarak PUPPETEER_EXECUTABLE_PATH ortam değişkenini ayarlayın.'
        )
      }
      throw new Error(`Tarayıcı başlatılamadı: ${msg}`)
    }

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1400, height: 900 });

      // 1. Giriş yap
      await page.goto(this.loginUrl, { waitUntil: 'networkidle2' });
      await page.type('#validation-email', tckn);
      await page.type('#validation-password', password);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click('#loginBtn'),
      ]);
      console.log('[LucaScraper] Giriş başarılı.');

      // 2. E-Arşiv Faturalar sayfasına git
      const targetUrl = `${this.archiveInvoicesUrl}?minDate=${startDate}&maxDate=${endDate}`;
      await page.goto(targetUrl, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2000));

      // Eğer sayfada "Ara" butonu varsa tıkla (filtreleri uygulamak için)
      try {
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button, a')).find(el => {
            const txt = el.innerText ? el.innerText.trim() : '';
            return txt === 'Ara' || txt.includes('Ara');
          });
          if (btn && !btn.classList.contains('disabled')) {
            btn.click();
          }
        });
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        // İsteğe bağlı, devam et
      }

      // 3. Tablo kayıt sayısını artırmayı dene (Örn: 100 veya en yüksek seçenek)
      try {
        const changedLength = await page.evaluate(() => {
          const select = document.querySelector('select[name*="length"], .dataTables_length select, select');
          if (select && select.options && select.options.length > 0) {
            const opts = Array.from(select.options);
            // 100, 50 veya en yüksek değere ayarla
            const opt100 = opts.find(o => o.value === '100' || o.text.includes('100'));
            const opt50 = opts.find(o => o.value === '50' || o.text.includes('50'));
            const target = opt100 || opt50 || opts[opts.length - 1];

            if (target && target.value !== select.value) {
              select.value = target.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              if (window.$ && window.$(select).length) {
                window.$(select).trigger('change');
              }
              return target.value;
            }
          }
          return null;
        });

        if (changedLength) {
          console.log(`[LucaScraper] Sayfa boyutu ${changedLength} yapıldı, tablo yenileniyor...`);
          await new Promise(r => setTimeout(r, 2500));
        }
      } catch (e) {
        console.log('[LucaScraper] Sayfa boyutu değiştirilemedi, sayfalama döngüsü ile devam edilecek.');
      }

      // 4. Tüm sayfaları dolaş ve faturaları topla (Pagination döngüsü)
      const invoiceMap = new Map();
      let pageNum = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        console.log(`[LucaScraper] Sayfa ${pageNum} taranıyor...`);
        await new Promise(r => setTimeout(r, 1200));

        // Bilgi satırını oku (örn: "35 kayıttan 1 - 25 arası gösteriliyor")
        const tableInfo = await page.evaluate(() => {
          const infoEl = document.querySelector('.dataTables_info, [id*="info"]');
          return infoEl ? infoEl.innerText.trim() : '';
        });
        if (tableInfo) {
          console.log(`[LucaScraper] Tablo Durumu: ${tableInfo}`);
        }

        // Tablo satırlarını çek
        const pageInvoices = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll('table tbody tr'));
          return rows.map(tr => {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length < 5) return null;
            // Sütunlar: 0: Menü, 1: Alıcı/Gönderen, 2: Fatura No, 3: Fatura Tarihi, 4: Tutar
            const alici = tds[1]?.innerText ? tds[1].innerText.trim() : '';
            const faturaNo = tds[2]?.innerText ? tds[2].innerText.trim() : '';
            const tarih = tds[3]?.innerText ? tds[3].innerText.trim() : '';
            const tutarStr = tds[4]?.innerText ? tds[4].innerText.trim() : '';

            if (!faturaNo || !alici) return null;
            return {
              alici,
              faturaNo,
              tarih,
              tutarStr,
              durum: 'Kesildi'
            };
          }).filter(row => row !== null && row.faturaNo);
        });

        // Toplanan faturaları tekil olarak haritaya ekle
        let newlyAdded = 0;
        for (const inv of pageInvoices) {
          if (!invoiceMap.has(inv.faturaNo)) {
            invoiceMap.set(inv.faturaNo, inv);
            newlyAdded++;
          }
        }
        console.log(`[LucaScraper] Sayfa ${pageNum}: ${pageInvoices.length} fatura okundu (${newlyAdded} yeni eklendi, Toplam: ${invoiceMap.size}).`);

        // Sonraki sayfa var mı kontrol et ve tıkla
        const firstFaturaBefore = pageInvoices[0]?.faturaNo || '';
        const nextPageTarget = pageNum + 1;

        const clickResult = await page.evaluate((targetPage) => {
          // 1. Önce doğrudan sonraki sayfa numarası butonunu ara (örn: "2", "3")
          const allButtons = Array.from(document.querySelectorAll(
            '.paginate_button, .pagination a, .pagination li, .pagination button, [class*="paginate"] a, [class*="paginate"] button, a, button'
          ));

          const pageNumBtn = allButtons.find(el => {
            const txt = (el.innerText || el.textContent || '').trim();
            if (txt === String(targetPage)) {
              const isDisabled = el.classList.contains('disabled') || Boolean(el.closest('.disabled'));
              const isCurrent = el.classList.contains('active') || el.classList.contains('current');
              return !isDisabled && !isCurrent;
            }
            return false;
          });

          if (pageNumBtn) {
            const clickable = pageNumBtn.tagName === 'A' || pageNumBtn.tagName === 'BUTTON'
              ? pageNumBtn
              : (pageNumBtn.querySelector('a, button') || pageNumBtn);

            if (window.$ && window.$(clickable).length) {
              window.$(clickable).trigger('click');
            }
            clickable.click();
            return { clicked: true, method: `page-${targetPage}` };
          }

          // 2. Sonraki / Next / › butonunu ara
          const nextBtn = allButtons.find(el => {
            const txt = (el.innerText || el.textContent || '').trim();
            const id = (el.id || '').toLowerCase();
            const cls = (el.className || '').toLowerCase();

            const isNextText = txt === 'Sonraki' || txt === 'Next' || txt === '›' || txt === '»';
            const isNextAttr = id.includes('next') || cls.includes('next');
            const isDisabled = el.classList.contains('disabled') ||
                               Boolean(el.closest('.disabled')) ||
                               el.getAttribute('aria-disabled') === 'true';

            return (isNextText || isNextAttr) && !isDisabled;
          });

          if (nextBtn) {
            const clickable = nextBtn.tagName === 'A' || nextBtn.tagName === 'BUTTON'
              ? nextBtn
              : (nextBtn.querySelector('a, button') || nextBtn);

            if (window.$ && window.$(clickable).length) {
              window.$(clickable).trigger('click');
            }
            clickable.click();
            return { clicked: true, method: 'next-button' };
          }

          return { clicked: false };
        }, nextPageTarget);

        if (clickResult.clicked) {
          console.log(`[LucaScraper] Sonraki sayfaya geçiş tetiklendi (${clickResult.method}).`);

          // Tablonun güncellenmesini bekle (en fazla 4 saniye)
          let tableChanged = false;
          for (let waitStep = 0; waitStep < 20; waitStep++) {
            await new Promise(r => setTimeout(r, 200));
            const firstFaturaNow = await page.evaluate(() => {
              const tr = document.querySelector('table tbody tr');
              if (!tr) return '';
              const td = tr.querySelectorAll('td');
              return td.length > 2 ? td[2].innerText.trim() : '';
            });
            if (firstFaturaNow && firstFaturaNow !== firstFaturaBefore) {
              tableChanged = true;
              break;
            }
          }

          if (!tableChanged) {
            await new Promise(r => setTimeout(r, 1500));
          }

          pageNum++;
        } else {
          console.log('[LucaScraper] Başka sayfa kalmadı veya sonraki butonu bulunamadı.');
          hasNextPage = false;
        }

        // Güvenlik sınırı (en fazla 20 sayfa)
        if (pageNum > 20) {
          console.log('[LucaScraper] Güvenlik uyarısı: 20 sayfa sınırına ulaşıldı.');
          hasNextPage = false;
        }
      }

      // 5. Tutarları ve tarihleri düzenle
      const rawInvoices = Array.from(invoiceMap.values());
      const invoices = rawInvoices.map(inv => {
        let cleanTutar = (inv.tutarStr || '').replace(/[^\d.,]/g, '').trim();
        let total = 0;
        if (cleanTutar) {
          if (cleanTutar.includes(',') && cleanTutar.includes('.')) {
            // Türk formatı: 13.500,00 → 13500.00
            cleanTutar = cleanTutar.replace(/\./g, '').replace(',', '.');
          } else if (cleanTutar.includes(',')) {
            cleanTutar = cleanTutar.replace(',', '.');
          }
          total = parseFloat(cleanTutar) || 0;
        }

        // Tarih formatı: "30.05.2026" → "2026-05-30"
        let isoDate = inv.tarih;
        const dParts = (inv.tarih || '').split('.');
        if (dParts.length === 3) {
          isoDate = `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
        }

        return {
          ...inv,
          total,
          isoDate,
          period: isoDate.slice(0, 7)
        };
      });

      console.log(`[LucaScraper] Toplam ${invoices.length} adet benzersiz fatura başarıyla çekildi.`);
      return invoices;

    } catch (error) {
      console.error('[LucaScraper] Hata oluştu:', error);
      throw new Error(`Luca entegrasyonu hatası: ${error.message}`);
    } finally {
      await browser.close();
    }
  }
}

export const lucaScraperService = new LucaScraperService();
