import puppeteer from 'puppeteer';

(async () => {
  console.log('Başlatılıyor...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();
    console.log('Sayfaya gidiliyor...');
    await page.goto('https://turmobefatura.luca.com.tr/Account/Login', { waitUntil: 'networkidle2' });

    console.log('Giriş bilgileri yazılıyor...');
    await page.type('#validation-email', '34471098310');
    await page.type('#validation-password', 'Umr135791*');

    console.log('Giriş yapılıyor...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('#loginBtn'),
    ]);

    console.log('Giriş başarılı. Sayfa başlığı:', await page.title());
    console.log('URL:', page.url());

    // Ekrandaki tüm linkleri veya ana tabloları ekrana yazdıralım
    const html = await page.evaluate(() => {
      return document.body.innerHTML;
    });

    const fs = await import('fs');
    fs.writeFileSync('dashboard.html', html);
    console.log('dashboard.html kaydedildi.');
    
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }));
    });
    console.log('Sayfadaki menü linkleri:');
    console.table(links.filter(l => l.text.toLowerCase().includes('fatura')));

  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await browser.close();
  }
})();
