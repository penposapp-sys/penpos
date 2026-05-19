import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TARGETS = [
  'frontend/src',
  'backend/src',
  'backend/scripts',
  '../PenPos YAZICI exe/setup',
  '../PenPos YAZICI exe/service'
]

const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.md', '.txt', '.yml', '.yaml'])
const SKIP_PARTS = new Set(['node_modules', 'build', 'dist', 'win-unpacked', '.git'])

const phraseReplacements = [
  ['GiriÅŸ', 'Giriş'],
  ['GÃ¶nderiliyor...', 'Gönderiliyor...'],
  ['GÃ¶nderiliyor', 'Gönderiliyor'],
  ['E-posta/ÅŸifre hatalÄ±', 'E-posta/şifre hatalı'],
  ['Hesap devre dÄ±ÅŸÄ±', 'Hesap devre dışı'],
  ['YanlÄ±ÅŸ giriÅŸ ekranÄ±', 'Yanlış giriş ekranı'],
  ['GiriÅŸ baÅŸarÄ±sÄ±z', 'Giriş başarısız'],
  ['â† Geri DÃ¶n', '← Geri Dön'],
  ['KullanÄ±cÄ± adÄ±', 'Kullanıcı adı'],
  ['kullanÄ±cÄ± adÄ±', 'kullanıcı adı'],
  ['Åifre', 'Şifre'],
  ['ÅŸifre', 'şifre'],
  ['KapandÄ±', 'Kapandı'],
  ['HazÄ±rlanÄ±yor', 'Hazırlanıyor'],
  ['OnaylandÄ±', 'Onaylandı'],
  ['Ä°ptal Edildi', 'İptal Edildi'],
  ['Ã–dendi', 'Ödendi'],
  ['Ã–denmedi', 'Ödenmedi'],
  ['SÃ¼resi Doldu', 'Süresi Doldu'],
  ['DiÄŸer', 'Diğer'],
  ['TEPSÄ°DE', 'TEPSİDE']
]

const wordPatterns = [
  [/\bAcik\b/g, 'Açık'],
  [/\bacik\b/g, 'açık'],
  [/\bAtilmamis\b/g, 'Atılmamış'],
  [/\batilmamis\b/g, 'atılmamış'],
  [/\bBaglanti\b/g, 'Bağlantı'],
  [/\bbaglanti\b/g, 'bağlantı'],
  [/\bBakiyesi\b/g, 'Bakiyesi'],
  [/\bBasari\b/g, 'Başarı'],
  [/\bbasari\b/g, 'başarı'],
  [/\bBasarisiz\b/g, 'Başarısız'],
  [/\bbasarisiz\b/g, 'başarısız'],
  [/\bBasi\b/g, 'Başı'],
  [/\bbasi\b/g, 'başı'],
  [/\bBorc\b/g, 'Borç'],
  [/\bborc\b/g, 'borç'],
  [/\bBulunamadi\b/g, 'Bulunamadı'],
  [/\bbulunamadi\b/g, 'bulunamadı'],
  [/\bCanli\b/g, 'Canlı'],
  [/\bcanli\b/g, 'canlı'],
  [/\bCari musteriler\b/g, 'Cari müşteriler'],
  [/\bCikis\b/g, 'Çıkış'],
  [/\bcikis\b/g, 'çıkış'],
  [/\bDagilimi\b/g, 'Dağılımı'],
  [/\bdagilimi\b/g, 'dağılımı'],
  [/\bDegeri\b/g, 'Değeri'],
  [/\bdegeri\b/g, 'değeri'],
  [/\bDeger\b/g, 'Değer'],
  [/\bdeger\b/g, 'değer'],
  [/\bDegis\b/g, 'Değiş'],
  [/\bdegis\b/g, 'değiş'],
  [/\bDogrulaniyor\b/g, 'Doğrulanıyor'],
  [/\bdogrulaniyor\b/g, 'doğrulanıyor'],
  [/\bDon\b/g, 'Dön'],
  [/\bdon\b/g, 'dön'],
  [/\bDonem\b/g, 'Dönem'],
  [/\bdonem\b/g, 'dönem'],
  [/\bGeciken\b/g, 'Geciken'],
  [/\bGecmis\b/g, 'Geçmiş'],
  [/\bgecmis\b/g, 'geçmiş'],
  [/\bGeri Don\b/g, 'Geri Dön'],
  [/\bGonder\b/g, 'Gönder'],
  [/\bgonder\b/g, 'gönder'],
  [/\bGore\b/g, 'Göre'],
  [/\bgore\b/g, 'göre'],
  [/\bGormek\b/g, 'Görmek'],
  [/\bgormek\b/g, 'görmek'],
  [/\bGoster\b/g, 'Göster'],
  [/\bgoster\b/g, 'göster'],
  [/\bGuncel\b/g, 'Güncel'],
  [/\bguncel\b/g, 'güncel'],
  [/\bGuncelleme\b/g, 'Güncelleme'],
  [/\bguncelleme\b/g, 'güncelleme'],
  [/\bGuncellenemedi\b/g, 'Güncellenemedi'],
  [/\bguncellenemedi\b/g, 'güncellenemedi'],
  [/\bGunluk\b/g, 'Günlük'],
  [/\bgunluk\b/g, 'günlük'],
  [/\bGunun\b/g, 'Günün'],
  [/\bgunun\b/g, 'günün'],
  [/\bGun\b/g, 'Gün'],
  [/\bgun\b/g, 'gün'],
  [/\bHazir\b/g, 'Hazır'],
  [/\bhazir\b/g, 'hazır'],
  [/\bHazirlama\b/g, 'Hazırlama'],
  [/\bhazirlama\b/g, 'hazırlama'],
  [/\bHazirlanacak\b/g, 'Hazırlanacak'],
  [/\bhazirlanacak\b/g, 'hazırlanacak'],
  [/\bHazirlanan\b/g, 'Hazırlanan'],
  [/\bhazirlanan\b/g, 'hazırlanan'],
  [/\bHazirlaniyor\b/g, 'Hazırlanıyor'],
  [/\bhazirlaniyor\b/g, 'hazırlanıyor'],
  [/\bHizli\b/g, 'Hızlı'],
  [/\bhizli\b/g, 'hızlı'],
  [/\bIcerir\b/g, 'İçerir'],
  [/\bicerir\b/g, 'içerir'],
  [/\bIcin\b/g, 'İçin'],
  [/\bicin\b/g, 'için'],
  [/\bIndirim\b/g, 'İndirim'],
  [/\bindirim\b/g, 'indirim'],
  [/\bInceleyebilirsin\b/g, 'İnceleyebilirsin'],
  [/\binceleyebilirsin\b/g, 'inceleyebilirsin'],
  [/\bIptal\b/g, 'İptal'],
  [/\bIslem\b/g, 'İşlem'],
  [/\bislem\b/g, 'işlem'],
  [/\bKapanan siparisleri ac\b/g, 'Kapanan siparişleri aç'],
  [/\bKapat\b/g, 'Kapat'],
  [/\bKarsilastirmasi\b/g, 'Karşılaştırması'],
  [/\bkarsilastirmasi\b/g, 'karşılaştırması'],
  [/\bKarti\b/g, 'Kartı'],
  [/\bkarti\b/g, 'kartı'],
  [/\bKaybedersen\b/g, 'Kaybedersen'],
  [/\bKayip\b/g, 'Kayıp'],
  [/\bkayip\b/g, 'kayıp'],
  [/\bKisilik\b/g, 'Kişilik'],
  [/\bkisilik\b/g, 'kişilik'],
  [/\bKullanici\b/g, 'Kullanıcı'],
  [/\bkullanici\b/g, 'kullanıcı'],
  [/\bKullandigimiz\b/g, 'Kullandığımız'],
  [/\bkullandigimiz\b/g, 'kullandığımız'],
  [/\bMasasiz\b/g, 'Masasız'],
  [/\bmasasiz\b/g, 'masasız'],
  [/\bMenu\b/g, 'Menü'],
  [/\bmenu\b/g, 'menü'],
  [/\bMusteri\b/g, 'Müşteri'],
  [/\bmusteri\b/g, 'müşteri'],
  [/\bOcaga\b/g, 'Ocağa'],
  [/\bOcaktaki\b/g, 'Ocaktaki'],
  [/\bOdeme\b/g, 'Ödeme'],
  [/\bodeme\b/g, 'ödeme'],
  [/\bOlusturun\b/g, 'Oluşturun'],
  [/\bolusturun\b/g, 'oluşturun'],
  [/\bOnce\b/g, 'Önce'],
  [/\bonce\b/g, 'önce'],
  [/\bOrani\b/g, 'Oranı'],
  [/\borani\b/g, 'oranı'],
  [/\bOzet\b/g, 'Özet'],
  [/\bozet\b/g, 'özet'],
  [/\bPaket siparis\b/g, 'Paket sipariş'],
  [/\bPaket Siparis\b/g, 'Paket Sipariş'],
  [/\bRapor icin\b/g, 'Rapor için'],
  [/\brapor icin\b/g, 'rapor için'],
  [/\bSec\b/g, 'Seç'],
  [/\bsec\b/g, 'seç'],
  [/\bSecili\b/g, 'Seçili'],
  [/\bsecili\b/g, 'seçili'],
  [/\bSimdi\b/g, 'Şimdi'],
  [/\bsimdi\b/g, 'şimdi'],
  [/\bSinirsiz\b/g, 'Sınırsız'],
  [/\bsinirsiz\b/g, 'sınırsız'],
  [/\bSiparis\b/g, 'Sipariş'],
  [/\bsiparis\b/g, 'sipariş'],
  [/\bSira\b/g, 'Sıra'],
  [/\bsira\b/g, 'sıra'],
  [/\bSonuc\b/g, 'Sonuç'],
  [/\bsonuc\b/g, 'sonuç'],
  [/\bSube\b/g, 'Şube'],
  [/\bsube\b/g, 'şube'],
  [/\bSure\b/g, 'Süre'],
  [/\bsure\b/g, 'süre'],
  [/\bSuresi\b/g, 'Süresi'],
  [/\bsuresi\b/g, 'süresi'],
  [/\bSut\b/g, 'Süt'],
  [/\bsut\b/g, 'süt'],
  [/\bTalepleri\b/g, 'Talepleri'],
  [/\bTahsil edilmemis\b/g, 'Tahsil edilmemiş'],
  [/\btahsil edilmemis\b/g, 'tahsil edilmemiş'],
  [/\bTek Sube\b/g, 'Tek Şube'],
  [/\bTum\b/g, 'Tüm'],
  [/\btum\b/g, 'tüm'],
  [/\bUrun\b/g, 'Ürün'],
  [/\burun\b/g, 'ürün'],
  [/\bUst\b/g, 'Üst'],
  [/\bust\b/g, 'üst'],
  [/\bYanlis\b/g, 'Yanlış'],
  [/\byanlis\b/g, 'yanlış'],
  [/\bYapisini\b/g, 'Yapısını'],
  [/\byapisini\b/g, 'yapısını'],
  [/\bYazicisi\b/g, 'Yazıcısı'],
  [/\byazicisi\b/g, 'yazıcısı'],
  [/\bYazicilar\b/g, 'Yazıcılar'],
  [/\byazicilar\b/g, 'yazıcılar'],
  [/\bYazdirma\b/g, 'Yazdırma'],
  [/\byazdirma\b/g, 'yazdırma'],
  [/\bYenile'ye\b/g, "Yenile'ye"],
  [/\bYetkili Subeler\b/g, 'Yetkili Şubeler'],
  [/\bYogunluk\b/g, 'Yoğunluk'],
  [/\byogunluk\b/g, 'yoğunluk'],
  [/\bYonetimi\b/g, 'Yönetimi'],
  [/\byonetimi\b/g, 'yönetimi'],
  [/\bYukleniyor\b/g, 'Yükleniyor'],
  [/\byukleniyor\b/g, 'yükleniyor']
]

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_PARTS.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, files)
      continue
    }
    if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath)
    }
  }
  return files
}

function countMatches(text, regex) {
  return (text.match(regex) || []).length
}

function repairMojibake(text) {
  let current = text
  for (let i = 0; i < 3; i += 1) {
    const brokenScore = countMatches(current, /[ÃÄÅâ�]/g)
    if (brokenScore === 0) break
    const candidate = Buffer.from(current, 'latin1').toString('utf8')
    const candidateScore = countMatches(candidate, /[ÃÄÅâ�]/g)
    const currentTurkish = countMatches(current, /[ÇĞİÖŞÜçğıöşü]/g)
    const candidateTurkish = countMatches(candidate, /[ÇĞİÖŞÜçğıöşü]/g)
    if (candidateScore < brokenScore || (candidateScore === brokenScore && candidateTurkish > currentTurkish)) {
      current = candidate
      continue
    }
    break
  }
  for (const [from, to] of phraseReplacements) {
    current = current.split(from).join(to)
  }
  return current
}

function looksTechnical(text) {
  const sample = text.trim()
  if (!sample) return true
  if (sample.includes('/') || sample.includes('\\')) return true
  if (sample.includes('http://') || sample.includes('https://')) return true
  if (sample.includes('.js') || sample.includes('.jsx') || sample.includes('.ts') || sample.includes('.tsx')) return true
  if (/^[\w.-]+$/.test(sample) && !/\s/.test(sample) && !/[A-ZÇĞİÖŞÜa-zçğıöşü]/.test(sample.replace(/[_-]/g, ''))) return true
  return false
}

function replaceHumanText(text) {
  if (looksTechnical(text)) return text
  let next = text
  for (const [pattern, replacement] of wordPatterns) {
    next = next.replace(pattern, replacement)
  }
  return next
}

function processQuotedStrings(content) {
  let result = ''
  let i = 0
  while (i < content.length) {
    const ch = content[i]
    if (ch === '"' || ch === "'") {
      const quote = ch
      let j = i + 1
      let escaped = false
      while (j < content.length) {
        const current = content[j]
        if (escaped) {
          escaped = false
        } else if (current === '\\') {
          escaped = true
        } else if (current === quote) {
          break
        }
        j += 1
      }
      const inner = content.slice(i + 1, j)
      result += quote + replaceHumanText(inner) + (content[j] || '')
      i = j + 1
      continue
    }
    if (ch === '`') {
      let j = i + 1
      let escaped = false
      let braceDepth = 0
      let buffer = ''
      let rebuilt = '`'
      while (j < content.length) {
        const current = content[j]
        const next = content[j + 1]
        if (escaped) {
          buffer += current
          escaped = false
          j += 1
          continue
        }
        if (current === '\\') {
          buffer += current
          escaped = true
          j += 1
          continue
        }
        if (braceDepth === 0 && current === '$' && next === '{') {
          rebuilt += replaceHumanText(buffer) + '${'
          buffer = ''
          braceDepth = 1
          j += 2
          continue
        }
        if (braceDepth > 0) {
          rebuilt += current
          if (current === '{') braceDepth += 1
          if (current === '}') braceDepth -= 1
          j += 1
          continue
        }
        if (current === '`') {
          rebuilt += replaceHumanText(buffer) + '`'
          break
        }
        buffer += current
        j += 1
      }
      result += rebuilt
      i = j + 1
      continue
    }
    result += ch
    i += 1
  }
  return result
}

function processJsxText(content) {
  return content.replace(/>([^<>{]+)</g, (match, inner) => `>${replaceHumanText(inner)}<`)
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8')
  let next = repairMojibake(original)
  next = processQuotedStrings(next)
  next = processJsxText(next)
  if (next !== original) {
    fs.writeFileSync(filePath, next, 'utf8')
    return true
  }
  return false
}

const changedFiles = []
for (const target of TARGETS) {
  for (const filePath of walk(path.resolve(ROOT, target))) {
    if (processFile(filePath)) {
      changedFiles.push(path.relative(ROOT, filePath))
    }
  }
}

console.log(`Changed ${changedFiles.length} file(s).`)
for (const filePath of changedFiles) {
  console.log(filePath)
}
