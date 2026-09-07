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

    console.log('Giden faturalar sayfasına gidiliyor...');
    await page.goto('https://turmobefatura.luca.com.tr/OutgoingInvoice/OutgoingInvoiceList', { waitUntil: 'networkidle2' });
    
    // Sayfanın yüklenmesi ve tablonun oluşması için biraz bekleyelim
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Tablo okunuyor...');
    // find any tables on the page
    const tableData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.map(tr => {
        const tds = Array.from(tr.querySelectorAll('td'));
        return tds.map(td => td.innerText.trim());
      }).filter(row => row.length > 0);
    });
    
    console.log(`Toplam ${tableData.length} satır bulundu.`);
    if (tableData.length > 0) {
       console.log('İlk satır verisi:', tableData[0]);
    }
    
    // Get table headers
    const headers = await page.evaluate(() => {
        const ths = Array.from(document.querySelectorAll('table thead th'));
        return ths.map(th => th.innerText.trim());
    });
    console.log('Tablo başlıkları:', headers);

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await browser.close();
  }
})();
