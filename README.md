# 📍 Konum Paylaş

Haritadan seçtiğiniz konumları kolayca paylaşmanızı sağlayan mobil öncelikli web uygulaması.

🔗 **Canlı Demo**: [sahinbolukbasi.github.io/location-shared](https://sahinbolukbasi.github.io/location-shared/)

---

## 🎯 Ne İşe Yarar?

Bir konumu birisiyle paylaşmak istediğinizde:

1. **Haritaya dokunun** → konum seçin
2. **Paylaş** butonuna basın
3. WhatsApp, QR kod veya paylaşım kodu ile gönderin

Karşı taraf linki açtığında **Google Haritalar**, **Apple Haritalar** veya **Yandex Haritalar** arasından seçim yapabilir.

---

## 📱 Nasıl Kullanılır?

### 1. Konum Seçme
- Haritaya dokunarak istediğiniz noktaya pin bırakın
- Veya üst arama çubuğundan adres/yer adı arayın
- 📌 Konum otomatik olarak adreslendirilir

### 2. Konum Kaydetme
- Alt panelde **Kaydet** butonuna basın
- Konuma özel bir ad verin (ör: "Ev", "İş", "Buluşma Noktası")
- Veya **Otomatik Ad** ile sistem tarafından belirlenen adresi kullanın
- Kaydedilen konumlar cihazınızda saklanır

### 3. Paylaşım Yöntemleri

| Yöntem | Açıklama |
|--------|----------|
| 💬 **WhatsApp** | Konum linkini doğrudan WhatsApp ile gönderin |
| 📷 **QR Kod** | QR kod oluşturun, karşı taraf telefonuyla okutarak konuma ulaşsın |
| 🔢 **Paylaşım Kodu** | 6 haneli kod oluşturun ve paylaşın *(Beta)* |

### 4. Kayıtlı Konumları Yönetme
- Sağ alttaki **📑** butonundan kayıtlı konumlarınızı görün
- Her konumu tekrar haritada gösterebilir, paylaşabilir veya silebilirsiniz

### 5. Kod ile Konum Bulma *(Beta)*
- Sol alttaki **123** butonuna veya menüden **Kod ile Konum Bul**'a basın
- 6 haneli kodu girin
- ⚠️ *Bu özellik beta aşamasındadır, şu anda yalnızca aynı cihazda oluşturulan kodlar geçerlidir*

---

## 🛠️ Teknolojiler

- **Leaflet.js** — Açık kaynak harita kütüphanesi
- **OpenStreetMap / CARTO** — Harita karoları
- **Nominatim** — Adres arama ve ters geocoding
- **QRCode.js** — QR kod oluşturma
- **localStorage** — Kayıtlı konumlar ve kodlar (sunucu gerektirmez)

## 📂 Dosya Yapısı

```
├── index.html      # Ana uygulama sayfası
├── style.css       # Stiller ve animasyonlar
├── app.js          # Harita ve UI kontrolleri
├── sharing.js      # Paylaşım modülü (WhatsApp, QR, Kod)
└── open.html       # QR/link açıldığında harita seçim sayfası
```

## 🚀 Kurulum

Sunucu gerektirmez, statik dosyalardan oluşur.

```bash
# Klonla
git clone https://github.com/sahinbolukbasi/location-shared.git

# Aç
cd location-shared
open index.html
# veya local server ile:
python3 -m http.server 8080
```

GitHub Pages üzerinde çalıştırmak için:
**Settings → Pages → Branch: main → Save**

---

## 👤 Geliştirici

**Şahin Bölükbaşı** tarafından yapılmıştır.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/sahinbolukbasi/)

---

*Beta v1.0 • 2026*
