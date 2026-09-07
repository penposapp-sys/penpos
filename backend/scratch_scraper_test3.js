import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://turmobefatura.luca.com.tr/Account/Login', { waitUntil: 'networkidle2' });

    await page.type('#validation-email', '34471098310');
    await page.type('#validation-password', 'Umr135791*');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('#loginBtn'),
    ]);

    // Nisan ayındaki E-Arşiv faturalarına gidelim (kullanıcının belirttiği gibi)
    console.log('Nisan ayı e-Arşiv faturaları sayfasına gidiliyor...');
    await page.goto('https://turmobefatura.luca.com.tr/OutgoingInvoice/OutgoingArchiveList?minDate=2026-04-01&maxDate=2026-04-30', { waitUntil: 'networkidle2' });
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Tutar var mı diye tablo başlıklarına tekrar bakalım
    const headers = await page.evaluate(() => {
        const ths = Array.from(document.querySelectorAll('table thead th'));
        return ths.map(th => th.innerText.trim());
    });
    console.log('Tablo başlıkları:', headers);

    const tableData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.map(tr => {
        const tds = Array.from(tr.querySelectorAll('td'));
        return tds.map(td => td.innerText.trim());
      }).filter(row => row.length > 0);
    });
    
    console.log(`Toplam ${tableData.length} fatura bulundu.`);
    if (tableData.length > 0) {
       console.log('İlk satır:', tableData[0]);
    }

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await browser.close();
  }
})();
