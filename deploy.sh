#!/usr/bin/env bash
set -e

echo "🚀 [Nabız] Sunucuya kurulum ve derleme başlatılıyor..."

# 1. Bağımlılıkları yükle
pnpm install

# 2. Üretim için derle (Frontend & Backend)
pnpm build

# 3. PM2 ile başlat veya yeniden yükle
if command -v pm2 &> /dev/null; then
  pm2 reload ecosystem.config.cjs || pm2 start ecosystem.config.cjs
  pm2 save
  echo "✅ [Nabız] PM2 servisi başarıyla güncellendi ve çalışıyor!"
else
  echo "⚠️ PM2 bulunamadı. Servisi 'pnpm start' ile başlatabilirsiniz."
fi
