# 🔔 SynAI Bildirim Sistemi

## 🌟 Özellikler

SynAI artık şu durumlarda **Windows masaüstü bildirimleri** ve **tatlı sesler** ile sizi uyarır:

### 1. 🤖 **Onay İsteği Bildirimleri**
AI bir komut çalıştırmak için izin istediğinde:
- ✅ Masaüstü bildirimi gösterilir
- 🔔 Soru tonu çalar (ding-ding ses efekti)
- 💬 Terminale geri dönmenizi hatırlatır

### 2. ✨ **Tamamlanma Bildirimleri**
AI görevi tamamladığında:
- ✅ "Görev tamamlandı!" bildirimi
- 🎵 Başarı melodisi (3 notadan oluşan güzel bir melodi)
- 😊 İşinizin bittiğini anında öğrenirsiniz

### 3. ⚠️ **Hata Bildirimleri**
Bir hata oluştuğunda:
- ✅ Hata detayları ile bildirim
- 🔊 Sistem uyarı sesi
- 🐛 Sorunu hemen fark edersiniz

## 🎵 Ses Efektleri

### Onay İsteği Sesi
```
🔔 Ding-Ding (800Hz, 1000Hz)
Dikkat çekici ama rahatsız etmeyen ton
```

### Başarı Melodisi
```
🎵 C - E - G (Do-Mi-Sol)
523Hz (150ms) → 659Hz (150ms) → 784Hz (200ms)
Tatlı ve motive edici melodi
```

### Hata Sesi
```
⚠️ Sistem uyarı tonu
Standart Windows uyarı sesi
```

## 🎮 Kullanım

### Bildirim Ayarlarını Görüntüleme

```bash
synai
> /notifications

🔔 Bildirim Ayarları
─────────────────────────────────────────────
Bildirimler:        ✓ Açık
Sesler:             ✓ Açık
Onay İstekleri:    ✓
Tamamlanma:        ✓
Hatalar:           ✓

Komutlar: /notify on|off|sound-on|sound-off|test
```

### Bildirimleri Açma/Kapama

```bash
# Tüm bildirimleri kapat
> /notify off
🔕 Bildirimler kapatıldı

# Tüm bildirimleri aç
> /notify on
🔔 Bildirimler açıldı

# Sadece sesleri kapat (görsel bildirimler açık kalır)
> /notify sound-off
🔇 Sesler kapatıldı

# Sesleri tekrar aç
> /notify sound-on
🔊 Sesler açıldı
```

### Bildirimleri Test Etme

```bash
> /notify test

Testing notification system...

1. Approval notification...
   [Masaüstü bildirimi + ding-ding sesi]

2. Success notification...
   [Başarı bildirimi + melodi]

3. Info notification...
   [Bilgi bildirimi]

Test completed!
```

## 💡 Kullanım Senaryoları

### Senaryo 1: Arka Planda Çalışırken
```bash
# SynAI'a karmaşık bir görev verin
> Create a full REST API with authentication, database models, and tests

# Başka bir pencerede çalışmaya devam edin
# AI onay istediğinde → Bildirim gelir 🔔
# AI işi bitirdiğinde → Başarı melodisi çalar 🎵
```

### Senaryo 2: Sessiz Çalışma
```bash
# Kütüphanede veya toplantıdayken
> /notify sound-off
🔇 Sesler kapatıldı

# Sadece görsel bildirimler gelir, ses çıkmaz
```

### Senaryo 3: Bildirim İstemeyen Kullanım
```bash
# Odaklanmış çalışma modunda
> /notify off
🔕 Bildirimler kapatıldı

# Terminalde çalışmaya devam edin, bildirim gelmez
```

## 🎯 Bildirim Türleri

### 1. Onay İsteği (Approval Request)
**Ne Zaman:** AI bir dosya yazacak, komut çalıştıracak veya değişiklik yapacakken

**Görünüm:**
```
┌─────────────────────────────────┐
│ 🤖 SynAI - Onay Gerekiyor      │
├─────────────────────────────────┤
│ "write_file" komutu             │
│ çalıştırılacak.                 │
│                                 │
│ Terminale dön ve onayla veya    │
│ reddet.                         │
└─────────────────────────────────┘
```

**Ses:** 🔔 Ding-Ding (dikkat çekici)

### 2. Görev Tamamlandı (Completion)
**Ne Zaman:** AI görevi başarıyla tamamladığında

**Görünüm:**
```
┌─────────────────────────────────┐
│ ✨ SynAI - Tamamlandı          │
├─────────────────────────────────┤
│ Görev tamamlandı!               │
│                                 │
│ REST API başarıyla oluşturuldu  │
└─────────────────────────────────┘
```

**Ses:** 🎵 Do-Mi-Sol melodisi (motivasyonel)

### 3. Hata (Error)
**Ne Zaman:** Bir hata veya sorun oluştuğunda

**Görünüm:**
```
┌─────────────────────────────────┐
│ ⚠️ SynAI - Hata                │
├─────────────────────────────────┤
│ File not found: config.json     │
└─────────────────────────────────┘
```

**Ses:** ⚠️ Sistem uyarı tonu

## ⚙️ Teknik Detaylar

### Windows Entegrasyonu
- `node-notifier` kütüphanesi kullanılır
- Native Windows bildirim sistemi
- Action Center ile entegre
- Bildirim geçmişi Windows'ta tutulur

### Ses Sistemi
- PowerShell `[console]::beep()` API kullanılır
- Frekans ve süre ile özelleştirilebilir
- Sistem ses seviyesine bağlı
- Fallback: Terminal beep (\x07)

### Performans
- Asenkron çalışır, CLI'yi bloklamaz
- Minimal kaynak kullanımı
- Bildirimler timeout ile otomatik kapanır

## 🔧 Ayarlar

### Varsayılan Ayarlar
```typescript
{
  enabled: true,              // Bildirimler açık
  soundEnabled: true,         // Sesler açık
  showApprovalRequests: true, // Onay istekleri gösterilsin
  showCompletion: true,       // Tamamlanma gösterilsin
  showErrors: true,           // Hatalar gösterilsin
}
```

### Programatik Ayarlama
```typescript
import { setNotificationPreferences } from './utils/notifications';

// Sadece hatalar için bildirim
setNotificationPreferences({
  showApprovalRequests: false,
  showCompletion: false,
  showErrors: true,
});
```

## 🎨 Özelleştirme

### Özel Sesler Eklemek
`packages/cli/src/utils/notifications.ts` dosyasında:

```typescript
function playCustomSound() {
  // Frekanslar: C-D-E-F-G-A-B (Do-Re-Mi-Fa-Sol-La-Si)
  const notes = {
    C: 523, D: 587, E: 659, F: 698,
    G: 784, A: 880, B: 988
  };
  
  const command = `powershell -c "[console]::beep(${notes.C}, 150); [console]::beep(${notes.E}, 150)"`;
  exec(command);
}
```

### Özel Bildirim İkonları
Logo dosyasını şu konumlara yerleştirin:
- `packages/web/public/logo.svg`
- `packages/web/public/icon.png`
- Workspace root'a `logo.png`

## 🚀 Örnek Kullanım

### Tam Bir Çalışma Oturumu

```bash
# SynAI'ı başlat
npm start

# Bildirimleri kontrol et
> /status
Thinking:      🌟 GENIUS
Notifications: 🔔 Enabled

# Karmaşık bir görev
> Design and implement a microservices architecture with Docker

[AI çalışırken başka bir şey yapabilirsiniz]

# 5 dakika sonra...
🔔 Ding! → Onay bildirimi gelir
[Terminale dönüp onaylarsınız]

# 20 dakika sonra...
🎵 Do-Mi-Sol! → Görev tamamlandı bildirimi
[Koda bakıp harika olduğunu görürsünüz]

> /status
✨ Task completed successfully!
```

## 📝 Notlar

- **Windows Odaklı:** Şu an sadece Windows için optimize edilmiş
- **macOS/Linux:** Basit terminal beep ile çalışır
- **WSL:** Windows bildirim sistemi kullanılabilir
- **SSH:** Uzak bağlantılarda sesler lokal olarak çalar

## 🐛 Sorun Giderme

### Bildirim Gelmiyor
```bash
# Test komutu ile kontrol edin
> /notify test

# Ayarları kontrol edin
> /notify
```

### Ses Çalmıyor
```bash
# PowerShell beep fonksiyonunu test edin
powershell -c "[console]::beep(800, 200)"

# Sistem ses seviyesini kontrol edin
# Windows ses ayarlarından "Bildirimler" açık olmalı
```

### Bildirimi Görmüyorum
- Windows Bildirim Ayarları → Focus Assist kapalı olmalı
- Windows Bildirim Ayarları → Bildirimlere izin verilmeli
- Action Center'ı kontrol edin (Win+A)

## 💡 İpuçları

1. **Arka Plan Çalışma:** Uzun görevlerde bildirimler çok faydalı
2. **Sessiz Mod:** Toplantılarda `/notify sound-off` kullanın
3. **Özel Melodi:** Ses efektlerini kişiselleştirin
4. **Test Edin:** Yeni kullanıcılar için `/notify test` harika
5. **Action Center:** Kaçırdığınız bildirimleri Win+A ile görün

---

**🔔 Artık SynAI sizi her zaman bilgilendirir! 🎵**

Mutlu kodlamalar! 🚀
