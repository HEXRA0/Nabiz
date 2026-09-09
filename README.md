# Nabız (nabiz.thedemir.com)

Modern, yüksek performanslı ve bağımsız Uptime İzleme (Uptime Monitoring), Kalp Atışı (Cron Heartbeat), Olay Yönetimi (Incident Management) ve Genel Durum Sayfası (Status Page) platformu.

---

## 🌟 Özellikler

- **Uptime İzleme**:
  - HTTP & HTTPS (durum kodları, yanıt süreleri, gövde arama, SSL sertifika kalan gün kontrolü)
  - TCP Port kontrolü (veritabanları, redis, mail sunucuları vb.)
  - ICMP / Ping erişilebilirlik takibi
- **90 Günlük Uptime Çubukları & Gecikme Grafikleri**:
  - BetterStack ve Datadog standartlarında günlük durum görselleştirme
  - Detaylı yanıt süresi (ms) geçmişi
- **Kalp Atışı (Heartbeat / Cron) Takibi**:
  - Yedekleme betikleri ve sunucu işleri için token bazlı `/api/push/:token` uç noktası
  - Geciken veya çalışmayan görevler için otomatik alarm
- **Olay & Kesinti Yönetimi (Incidents)**:
  - Araştırılıyor, Tespit Edildi, İzleniyor, Çözüldü süreç adımları
  - Canlı durum güncelleme akışı
- **Herkese Açık Durum Sayfası (Public Status Page)**:
  - `nabiz.thedemir.com` (veya `/status`) üzerinden ziyaretçilerin erişebileceği şık durum ekranı
- **Anlık Bildirim Kanalları**:
  - Telegram Botu
  - Discord Webhook
  - Genel Webhook
- **Sıfır Dış Bağımlılık**:
  - Yüksek hızlı SQLite (WAL modunda), bağımsız Node.js + React mimarisi

---

## 🚀 Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükleyin
```bash
pnpm install
```

### 2. Geliştirme Modu (Development)
```bash
# Frontend ve Backend'i eşzamanlı başlatır:
pnpm dev:all
```
- Arayüz: `http://localhost:5173`
- API Sunucusu: `http://localhost:3001`

### 3. Üretim Derlemesi ve Çalıştırma (Production)
```bash
# Frontend derlemesi
pnpm build:client

# PM2 ile başlatma
pm2 start ecosystem.config.cjs
```
Veya doğrudan çalıştırma:
```bash
pnpm start
```

---

## 🔒 İlk Kurulum
Uygulama ilk kez açıldığında yönetici kurulum sihirbazı görüntülenir. Yönetici kullanıcı adı, e-posta ve parolanızı tanımlayarak sisteme giriş yapabilirsiniz.

## 💾 Veri Yedekleme
Tüm veriler `data/nabiz.db` dosyasında saklanır. Yedekleme için bu dosyayı kopyalamanız yeterlidir.
