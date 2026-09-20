# 🧪 Yeni Özellikleri Test Etme Rehberi

## ✅ Hızlı Test Senaryoları

### Test 1: Düşünme Seviyeleri

```bash
# SynAI'ı başlat
npm start

# 1. Status kontrolü
> /status
# Thinking: ⚖️ BALANCED görmeli

# 2. Fast mode test
> /think fast
# ⚡ FAST mesajı görünmeli

# 3. Genius mode test
> /think genius
# 🌟 GENIUS mesajı görünmeli

# 4. Tekrar status
> /status
# Thinking: 🌟 GENIUS görmeli

# ✅ BAŞARILI: Düşünme seviyeleri çalışıyor
```

### Test 2: Bildirimler

```bash
# 1. Bildirim ayarlarını gör
> /notifications
# Tüm ayarlar görünmeli

# 2. Bildirimleri test et
> /notify test
# Sırayla:
#   - Onay bildirimi + ding-ding ses 🔔
#   - Başarı bildirimi + do-mi-sol melodi 🎵
#   - Bilgi bildirimi

# 3. Sesleri kapat
> /notify sound-off
# 🔇 Sesler kapatıldı mesajı

# 4. Bildirimleri kapat
> /notify off
# 🔕 Bildirimler kapatıldı mesajı

# 5. Tekrar aç
> /notify on
# 🔔 Bildirimler açıldı mesajı

# ✅ BAŞARILI: Bildirimler çalışıyor
```

### Test 3: Gerçek Kullanım

```bash
# 1. Genius mode + bildirimler
> /think genius
> /notify on

# 2. Basit bir görev (onay gerektirecek)
> Create a new file called test.txt with "Hello SynAI!" content

# Beklenen:
#   - 🔔 Onay bildirimi gelir
#   - Terminalde onay sorusu
#   - [y] diyerek onayla
#   - Dosya oluşur
#   - 🎵 Başarı melodisi çalar

# 3. Dosyayı kontrol et
> /view test.txt
# "Hello SynAI!" görmeli

# ✅ BAŞARILI: Her şey çalışıyor!
```

---

## 🎯 Detaylı Test Planı

### A. Düşünme Seviyeleri

#### A1: Fast Mode
```bash
> /think fast
> What is 2+2?

Beklenti:
- Hızlı yanıt
- Minimum düşünme
- 4K token limit
```

#### A2: Balanced Mode  
```bash
> /think balanced
> Explain how async/await works in JavaScript

Beklenti:
- Dengeli detay
- Orta düşünme
- 8K token limit
```

#### A3: Deep Mode
```bash
> /think deep
> Design a rate limiting system

Beklenti:
- Detaylı analiz
- Alternatif çözümler
- Adım adım düşünme
- 16K token limit
```

#### A4: Genius Mode
```bash
> /think genius
> Design a distributed transaction system with SAGA pattern

Beklenti:
- Çok detaylı analiz
- Birden fazla çözüm yolu
- Kendi kendini eleştirme
- Gelecek gereksinimleri tahmin
- 32K token limit
```

### B. Bildirim Sistemi

#### B1: Onay Bildirimleri
```bash
> /mode confirm
> /notify on
> Write a file called example.js

Beklenti:
1. Masaüstü bildirimi: "write_file komutu çalıştırılacak"
2. Ding-ding sesi (800Hz, 1000Hz)
3. Terminalde onay sorusu
4. Windows Action Center'da bildirim
```

#### B2: Başarı Bildirimleri
```bash
> /notify on
> /mode auto
> Create a simple calculator function

Beklenti:
1. Görev tamamlandığında bildirim
2. Do-Mi-Sol melodisi (523Hz, 659Hz, 784Hz)
3. "Görev tamamlandı!" mesajı
```

#### B3: Hata Bildirimleri
```bash
> /notify on
> Read non-existent-file.txt

Beklenti:
1. Hata bildirimi
2. Sistem uyarı sesi
3. Hata mesajı gösterilir
```

### C. Entegrasyon Testleri

#### C1: Genius + Bildirimler
```bash
> /think genius
> /notify on
> /mode confirm

> Design and implement a REST API with authentication

Beklenti:
- Derin analiz
- Birden fazla onay istemi
- Her onayda bildirim
- Bitişte başarı melodisi
- Yüksek kalite kod
```

#### C2: Fast + Sessiz
```bash
> /think fast
> /notify sound-off

> Fix typo in README.md

Beklenti:
- Hızlı işlem
- Görsel bildirim (ses yok)
- Minimal düşünme
```

---

## 🔍 Manuel Kontroller

### Kod Kalitesi
```bash
# TypeScript derleme
npm run build
# ✅ Hatasız derlenmeli

# Dosya yapısı
ls packages/core/src/thinking/
# ✅ index.ts dosyası olmalı

ls packages/cli/src/utils/
# ✅ notifications.ts dosyası olmalı
```

### Bildirim Sistemi
```powershell
# PowerShell beep testi
powershell -c "[console]::beep(800, 200)"
# ✅ Ses çıkmalı

# Windows bildirim ayarları
# Win + I → Sistem → Bildirimler
# ✅ Bildirimler açık olmalı
```

### Dosya İçerikleri
```bash
# Thinking levels tanımları
cat packages/core/src/thinking/index.ts
# ✅ 4 seviye tanımlı olmalı

# Notification fonksiyonları
cat packages/cli/src/utils/notifications.ts
# ✅ showApprovalNotification, showCompletionNotification vb.
```

---

## 🎭 Kullanıcı Deneyimi Testleri

### UX Test 1: İlk Kullanım
```bash
npm start

Kontroller:
[ ] Banner güzel görünüyor
[ ] Model ve mode görünüyor
[ ] /help komutu yeni özellikleri gösteriyor
[ ] /status düşünme seviyesini gösteriyor
```

### UX Test 2: Komut Keşfi
```bash
> /

Kontroller:
[ ] Autocomplete çalışıyor
[ ] /think ve /notify önerilerde
[ ] Tab ile tamamlama çalışıyor
```

### UX Test 3: Bildirim Deneyimi
```bash
> /notify test

Kontroller:
[ ] Bildirimler Windows'ta doğru görünüyor
[ ] İkon güzel (varsa)
[ ] Sesler hoş
[ ] Tüm bildirimler Action Center'da
```

---

## 📊 Test Sonuçları Şablonu

```markdown
## Test Raporu - [Tarih]

### Düşünme Seviyeleri
- [ ] Fast mode çalışıyor
- [ ] Balanced mode çalışıyor
- [ ] Deep mode çalışıyor
- [ ] Genius mode çalışıyor
- [ ] Mode geçişleri sorunsuz
- [ ] Status doğru görünüyor

### Bildirimler
- [ ] Onay bildirimleri çalışıyor
- [ ] Başarı bildirimleri çalışıyor
- [ ] Hata bildirimleri çalışıyor
- [ ] Sesler hoş
- [ ] Ayarlar çalışıyor
- [ ] Test komutu çalışıyor

### Entegrasyon
- [ ] Thinking + notifications uyumlu
- [ ] Tüm modlar uyumlu
- [ ] CLI performansı iyi
- [ ] Hata yok
- [ ] Production ready

### Genel
- [ ] Build başarılı
- [ ] Dokümantasyon tam
- [ ] Kullanıcı deneyimi iyi
- [ ] Production ready

**Sonuç:** ✅ BAŞARILI / ⚠️ SORUNLU / ❌ BAŞARISIZ

**Notlar:**
[Ek gözlemler buraya]
```

---

## 🚨 Sorun Giderme

### Problem: Bildirim gelmiyor
```bash
# 1. Test komutu
> /notify test

# 2. Ayarları kontrol
> /notify

# 3. Windows ayarlarını kontrol
Win + I → Sistem → Bildirimler → Açık olmalı

# 4. Focus Assist'i kapat
Win + A → Focus Assist → Off
```

### Problem: Ses çalmıyor
```bash
# 1. Ses test
powershell -c "[console]::beep(800, 200)"

# 2. Sistem sesi kontrol
# Windows ses seviyesi > 0 olmalı

# 3. Sesleri aç
> /notify sound-on
```

### Problem: Thinking level değişmiyor
```bash
# 1. Mevcut durumu gör
> /status

# 2. Tekrar dene
> /think genius

# 3. Status tekrar
> /status

# 4. Restart
> /clear
> /think genius
```

---

## ✅ Başarı Kriterleri

Her şey düzgün çalışıyorsa:

✅ Build hatasız  
✅ 4 düşünme seviyesi seçilebilir  
✅ Bildirimler Windows'ta görünür  
✅ Sesler çalar  
✅ Status doğru bilgi gösterir  
✅ Help güncel  
✅ Autocomplete çalışır  
✅ Gerçek görevlerde kullanılabilir  

---

**🎉 Tüm testler başarılı olmalı!**

İyi testler! 🧪
