# 🌐 SynAI - Chrome Browser Automation

## 🎯 Özellikler

SynAI artık **Google Chrome'u tam kontrol edebilir**! Web tarayıcısında her türlü otomasyonu yapabilir:

- 🌐 Web sitelerinde gezinme
- 🖱️ Butonlara tıklama
- ⌨️ Form doldurma
- 📸 Ekran görüntüsü alma
- 📝 İçerik çıkarma
- 🔍 Element bulma
- 🎨 JavaScript çalıştırma
- 📑 Sekme yönetimi
- 🍪 Cookie yönetimi

## 🚀 Hızlı Başlangıç

### Basit Örnek
```bash
npm start

> Launch Chrome and navigate to google.com
✅ Chrome browser launched successfully!
✅ Navigated to https://google.com
📄 Page Title: Google

> Take a screenshot and save it as google.png
✅ Screenshot saved to C:\Users\...\google.png

> Close the browser
✅ Browser closed
```

### Form Doldurma Örneği
```bash
> Launch Chrome and go to github.com/login

> Fill the username field with "testuser"
✅ Typed "testuser" into #login_field

> Fill the password field  
✅ Typed "..." into #password

> Click the sign in button
✅ Clicked element: button[type="submit"]
```

## 🛠️ Mevcut Browser Araçları

### 1. browser_launch
**Chrome tarayıcısını başlatır**

```bash
> Launch Chrome browser
> Open a headless browser
> Start Chrome with 1920x1080 resolution
```

**Parametreler:**
- `headless`: Boolean (default: false) - Görünmez mod
- `width`: Number (default: 1280) - Pencere genişliği  
- `height`: Number (default: 720) - Pencere yüksekliği

### 2. browser_navigate
**Bir URL'ye git**

```bash
> Navigate to https://github.com
> Go to reddit.com
> Open youtube.com
```

**Parametreler:**
- `url`: String - Gidilecek URL

### 3. browser_click
**Bir elemente tıkla**

```bash
> Click the login button
> Click element with ID "submit-btn"
> Click the first link
```

**Parametreler:**
- `selector`: String - CSS selector

**Örnek Selectorlar:**
- `button.submit` - Class ile
- `#login-btn` - ID ile
- `a[href="/about"]` - Attribute ile
- `div > span:first-child` - Kombinasyon

### 4. browser_type
**Input alanına yaz**

```bash
> Type "hello world" into the search box
> Fill the email field with test@example.com
```

**Parametreler:**
- `selector`: String - Input CSS selector
- `text`: String - Yazılacak metin

### 5. browser_press_key
**Klavye tuşuna bas**

```bash
> Press Enter key
> Press Tab
> Press Escape
```

**Parametreler:**
- `key`: String - Enter, Tab, Escape, ArrowDown, etc.

### 6. browser_screenshot
**Ekran görüntüsü al**

```bash
> Take a screenshot and save as homepage.png
> Screenshot the page
```

**Parametreler:**
- `filename`: String - Dosya adı

### 7. browser_extract_text
**Sayfadan metin çıkar**

```bash
> Extract all text from the page
> Get text from the main article
> Extract content from #description
```

**Parametreler:**
- `selector`: String (optional) - Element selector

### 8. browser_get_html
**HTML içeriği al**

```bash
> Get HTML of the page
> Extract HTML from the navbar
```

**Parametreler:**
- `selector`: String (optional) - Element selector

### 9. browser_evaluate
**JavaScript kodu çalıştır**

```bash
> Execute JavaScript: document.title
> Run: window.location.href
> Evaluate: document.querySelectorAll('a').length
```

**Parametreler:**
- `code`: String - JavaScript kodu

### 10. browser_wait_for
**Element görünene kadar bekle**

```bash
> Wait for the modal to appear
> Wait for element .loading to disappear
```

**Parametreler:**
- `selector`: String - CSS selector
- `timeout`: Number (optional, default: 10000) - Timeout (ms)

### 11. browser_fill_form
**Birden fazla form alanını doldur**

```bash
> Fill the login form
```

**Parametreler:**
- `fields`: Object - Selector: değer mapping

**Örnek:**
```json
{
  "#email": "user@example.com",
  "#password": "secret123",
  "#remember": "true"
}
```

### 12. browser_scroll
**Sayfayı kaydır**

```bash
> Scroll down
> Scroll to top
> Scroll to bottom
> Scroll up 300 pixels
```

**Parametreler:**
- `direction`: String - up, down, top, bottom
- `amount`: Number (optional) - Pixel miktarı

### 13. browser_new_tab
**Yeni sekme aç**

```bash
> Open a new tab
> Open new tab with github.com
```

**Parametreler:**
- `url`: String (optional) - URL

### 14. browser_close_tab
**Mevcut sekmeyi kapat**

```bash
> Close this tab
> Close current tab
```

### 15. browser_get_tabs
**Açık sekmeleri listele**

```bash
> List all open tabs
> Show tabs
```

### 16. browser_get_info
**Sayfa bilgilerini al**

```bash
> Get page info
> Show current URL and title
```

### 17. browser_close
**Tarayıcıyı kapat**

```bash
> Close the browser
> Quit Chrome
```

## 💡 Kullanım Senaryoları

### Senaryo 1: Web Scraping
```bash
> Launch Chrome and navigate to news.ycombinator.com

> Extract text from all article titles

> Take a screenshot

> Close browser
```

### Senaryo 2: Form Testing
```bash
> Launch Chrome and go to localhost:3000/signup

> Fill the form with:
  - Email: test@example.com
  - Password: Test123!
  - Name: Test User

> Click submit button

> Wait for success message

> Screenshot the result

> Close browser
```

### Senaryo 3: UI Monitoring
```bash
> Launch Chrome

> Navigate to my-app.com/dashboard

> Take screenshot as baseline.png

> Wait 5 seconds

> Take screenshot as current.png

> Compare screenshots

> Close browser
```

### Senaryo 4: Automated Login
```bash
> Launch Chrome headless

> Go to app.example.com/login

> Type username into #username

> Type password into #password  

> Click login button

> Wait for dashboard to load

> Extract session cookie

> Close browser
```

## 🎯 Advanced Examples

### E-Commerce Product Scraping
```bash
> Launch Chrome and navigate to amazon.com

> Type "mechanical keyboard" into search box

> Press Enter

> Wait for results to load

> Extract text from all product titles

> Extract prices

> Take screenshot of results page

> Close browser
```

### Social Media Automation
```bash
> Launch Chrome

> Go to twitter.com

> Click login button

> Fill email field

> Fill password field

> Click submit

> Wait for home feed

> Extract latest tweets

> Close browser
```

### Website Testing
```bash
> Launch Chrome with 1920x1080 resolution

> Navigate to my-website.com

> Click all navigation links one by one

> Take screenshot of each page

> Check for broken images

> Test all forms

> Generate test report

> Close browser
```

## 🔧 Teknik Detaylar

### Puppeteer Entegrasyonu
- **Kütüphane:** Puppeteer 25.10.0
- **Browser:** Chromium/Chrome
- **Mode:** Headful (görünür) veya headless
- **Platform:** Windows, macOS, Linux

### Browser Controller
- Birden fazla browser session yönetimi
- Otomatik session tracking
- Error handling ve recovery
- Screenshot ve content extraction
- Cookie ve storage yönetimi

### CSS Selectors
```css
/* ID ile */
#element-id

/* Class ile */
.class-name

/* Tag ile */
button, input, div

/* Attribute ile */
[type="submit"]
[href*="github"]

/* Kombinasyonlar */
div > span.highlight
ul li:first-child
a[href^="https"]
```

## 🎨 Best Practices

### 1. Selector Seçimi
```bash
# İyi ✅
> Click button#submit
> Click button[aria-label="Login"]

# Kötü ❌
> Click the second button
> Click div > div > div > button
```

### 2. Wait Stratejisi
```bash
# İyi ✅
> Wait for #modal to appear
> Wait for .loading to disappear

# Kötü ❌
> Click immediately without waiting
```

### 3. Error Handling
```bash
# İyi ✅
> Try to find element, if not found wait 10 seconds

# Kötü ❌
> Assume element exists
```

### 4. Screenshot Kullanımı
```bash
# İyi ✅
> Take screenshot as step1-homepage.png
> Take screenshot as step2-logged-in.png

# Kötü ❌
> Take screenshot as s.png
```

## 🚨 Dikkat Edilmesi Gerekenler

### Rate Limiting
- Web sitelerinin rate limit'leri olabilir
- Aşırı hızlı istek göndermekten kaçının
- Gerekirse bekleme süreleri ekleyin

### Headless vs Headful
- **Headful:** Debug için iyi, ne olduğunu görebilirsiniz
- **Headless:** Production ve hızlı tasklar için iyi

### Selector Stability
- Dynamic ID'ler değişebilir
- Stable selector'lar kullanın (aria-label, data-testid)
- Class name'ler tercih edilir

### Memory Management
- Kullanmadığınız sekmeleri kapatın
- İşiniz bitince tarayıcıyı kapatın
- Çok fazla screenshot almayın

## 📊 Performans

| İşlem | Süre |
|-------|------|
| Browser Launch | ~2-3s |
| Navigate | ~1-2s |
| Click | ~100ms |
| Type | ~50ms/char |
| Screenshot | ~500ms |
| Extract Text | ~200ms |
| Close | ~500ms |

## 🐛 Sorun Giderme

### Problem: Browser açılmıyor
```bash
# Puppeteer yüklü mü?
npm list puppeteer

# Tekrar yükle
npm install puppeteer
```

### Problem: Element bulunamıyor
```bash
# Doğru selector'ı test et
> Execute JavaScript: document.querySelector('#your-selector')

# Element yüklenene kadar bekle
> Wait for #your-selector with 15000ms timeout
```

### Problem: Screenshot boş
```bash
# Sayfa yüklendi mi kontrol et
> Wait for body

# Full page screenshot
> Take full page screenshot
```

## 💡 İpuçları

1. **Debug Modu:** Headful mode kullanın, ne olduğunu görün
2. **Wait Kullanın:** Elementler yüklenmeden tıklamayın
3. **Screenshot:** Her adımda screenshot alın
4. **Selector Inspector:** Browser DevTools ile selector test edin
5. **Error Messages:** Hata mesajlarını okuyun, çok bilgilendirici

## 🎓 Öğrenme Kaynakları

- **Puppeteer Docs:** https://pptr.dev
- **CSS Selectors:** https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors
- **Browser DevTools:** F12 tuşu ile açılır

---

**🌐 SynAI ile web otomasyonunun keyfini çıkarın!**

İyi otomasyonlar! 🤖🚀
