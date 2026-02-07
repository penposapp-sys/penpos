# PM2 Log Rotate (Disk Şişmesini Önleme)

Bu proje backend loglarını `stdout/stderr` üzerinden üretir. Canlıda PM2 kullanılıyorsa, log dosyalarının sınırsız büyüyüp diski doldurmaması için `pm2-logrotate` kurulmalıdır.

## Kurulum

Canlı sunucuda (PM2 çalıştığı kullanıcı ile):

```bash
pm2 install pm2-logrotate
```

## Önerilen Ayarlar

```bash
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
pm2 set pm2-logrotate:workerInterval 30
```

## Notlar

- Bu ayarlar canlıda uygulanır; repoya herhangi bir secret yazılmaz.
- Log rotate devreye girdikten sonra log dosyaları 10MB ile sınırlanır, eski loglar sıkıştırılır ve en fazla 7 gün tutulur.

