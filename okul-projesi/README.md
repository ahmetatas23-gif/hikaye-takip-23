# 📚 Türkçe Okuma Anlama Test Sistemi

Supabase destekli okul yönetim platformu.

## Klasör Yapısı

```
okul-projesi/
├── index.html                      ← Ana sayfa (HTML paneller)
├── css/
│   └── style.css                   ← Tüm stiller
├── js/
│   ├── supabase-config.js          ← ⚠️ .gitignore'da — GİTHUB'A YÜKLEME!
│   ├── supabase-config.example.js  ← Boş şablon (commit edilir)
│   ├── auth.js                     ← Giriş/çıkış/session/erişim kontrolleri
│   ├── app.js                      ← Ana uygulama mantığı
│   ├── bulk-upload.js              ← Toplu Excel (optik form) yükleme
│   └── utils.js                    ← Modal yardımcıları
├── rls-policies.sql                ← Supabase SQL Editor'e yapıştır
├── GITHUB-GUVENLIK-REHBERI.md     ← API key güvenliği rehberi
└── .gitignore                      ← supabase-config.js burada gizli
```

## Kurulum

```bash
# 1. supabase-config.js oluştur
cp js/supabase-config.example.js js/supabase-config.js

# 2. Gerçek değerleri yaz
# supabase-config.js içindeki BURAYA_... alanlarını doldurun

# 3. RLS politikalarını uygula
# rls-policies.sql → Supabase Dashboard → SQL Editor → Run

# 4. index.html'i tarayıcıda aç (veya bir HTTP sunucusu kullan)
```

## Önemli Güvenlik Notları

- `js/supabase-config.js` asla GitHub'a yüklenmemelidir
- Detaylar için `GITHUB-GUVENLIK-REHBERI.md` dosyasına bakın
- Supabase RLS politikaları için `rls-policies.sql` dosyasını uygulayın
