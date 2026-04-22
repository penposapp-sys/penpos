# MongoDB Atlas Gecis Notlari

Bu proje artik MongoDB baglantisini zorunlu olarak `MONGODB_URI` veya `MONGO_URI` degiskeninden okur.

## 1. Atlas tarafinda yapilacaklar

1. MongoDB Atlas'ta bir cluster olusturun.
2. `Database Access` altindan bir kullanici tanimlayin.
3. `Network Access` altindan uygulamanin baglanacagi IP adreslerini izinli listeye ekleyin.
4. `Connect` -> `Drivers` ekranindan baglanti metnini alin.

## 2. Projede yapilacaklar

`backend/.env` dosyasi olusturun ve su alanı doldurun:

```env
MONGODB_URI=mongodb+srv://KULLANICI_ADI:SIFRE@CLUSTER_ADI.mongodb.net/pos_saas?retryWrites=true&w=majority&appName=PenPos
```

Not:
- `pos_saas` veritabani adi olarak kullanilir. Isterseniz Atlas URI icinde baska bir veritabani adi verebilirsiniz.
- Sifre icinde `@`, `:`, `/` gibi karakterler varsa URL encode edilmelidir.

## 3. Veri tasima

MongoDB Compass tek basina veritabani degildir; genelde yerel MongoDB sunucusuna baglanmak icin kullanilir.
Yereldeki veriyi Atlas'a tasimak icin yaygin yollar:

1. Compass Export/Import
2. `mongodump` + `mongorestore`
3. Atlas `mongorestore` ile dogrudan geri yukleme

Ornek:

```powershell
mongodump --uri="mongodb://127.0.0.1:27017/pos_saas" --out=./dump
mongorestore --uri="mongodb+srv://KULLANICI_ADI:SIFRE@CLUSTER_ADI.mongodb.net/pos_saas?retryWrites=true&w=majority&appName=PenPos" ./dump/pos_saas
```

## 4. Dogrulama

Backend acildiginda hata almadan calismali ve `/api/health` uzerinden kontrol edilmelidir.
Baglanti kurulamazsa uygulama artik sessizce devam etmez; hata verip durur.
