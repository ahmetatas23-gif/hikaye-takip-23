# 🔐 GitHub Güvenlik Rehberi
## API Anahtarlarını Geçmişten Silme ve Gizleme

---

## 🚨 Durum Değerlendirmesi

Dosyanızda şu bilgiler **açık metin** olarak bulunuyordu:

| Bilgi | Risk Seviyesi |
|---|---|
| `SUPABASE_URL` | ⚠️ Orta — projeyi tanımlar |
| `SUPABASE_ANON_KEY` | 🔴 Yüksek — herkese açık erişim anahtarı |

> **Not:** Supabase `anon` key, RLS açık olmadan veritabanınıza tam okuma/yazma erişimi sağlar.  
> Bu key GitHub'a yüklendiyse, arama motorlarına indexlenmiş olabilir.

---

## ADIM 1 — Supabase Tarafında Hasarı Sınırla (Hemen Yapın)

### 1a. Mevcut Anahtarı Geçersiz Kıl
```
Supabase Dashboard
  → Project Settings
  → API
  → "Reveal" düğmesiyle anon key'i görüntüle
  → Değişmemişse sorun yok; ama yeni proje oluşturmak en temiz çözümdür.
```

> Supabase anon key'i doğrudan rotate edemezsiniz (proje başına sabittir).  
> Asıl koruma **RLS politikaları**dır — `rls-policies.sql` dosyasını uygulayın.

### 1b. RLS'i Hemen Etkinleştir
`rls-policies.sql` dosyasını Supabase SQL Editor'e yapıştırın ve çalıştırın.

---

## ADIM 2 — Yerel Dosyayı Temizle (.gitignore)

Modüler yapıya geçtikten sonra:

```bash
# Proje klasörünüzde .gitignore dosyasını kontrol edin
cat .gitignore

# js/supabase-config.js satırının var olduğundan emin olun
# Yoksa ekleyin:
echo "js/supabase-config.js" >> .gitignore
```

**Kritik:** `.gitignore` sadece henüz commit edilmemiş dosyaları korur.  
Daha önce commit ettiyseniz ADIM 3'e geçin.

---

## ADIM 3 — Git Geçmişinden API Anahtarını Sil

### Seçenek A: `git filter-repo` (Önerilen — Modern Yöntem)

```bash
# Kurulum (pip veya brew ile)
pip install git-filter-repo
# veya: brew install git-filter-repo

# Proje klasörüne girin
cd okul-projesi

# API anahtarını geçmişten sil (tüm commitleri tarar)
git filter-repo --replace-text <(echo "eyJhbGci...SİZİN_ESKİ_ANAHTARINIZ...==>REMOVED_KEY")

# GitHub'a zorla gönder
git push --force --all
git push --force --tags
```

### Seçenek B: BFG Repo Cleaner (Daha Hızlı)

```bash
# BFG indir: https://rtyley.github.io/bfg-repo-cleaner/
# Bir "passwords.txt" dosyası oluşturun, anahtarı içine yazın:
echo "eyJhbGci...anahtarınız..." > passwords.txt

# Geçmişi temizle
java -jar bfg.jar --replace-text passwords.txt okul-projesi.git

# Repoyu temizle ve push et
cd okul-projesi
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

### Seçenek C: Hızlı Çözüm — Repoyu Sıfırdan Başlat

Repo geçmişi çok kritik değilse en temiz yol:

```bash
# Eski repoyu GitHub'dan SİL (Settings → Delete repository)
# Yeni repo oluştur, sadece temiz kodu push et

git init
git add .
git commit -m "İlk commit — temiz yapı, API key yok"
git remote add origin https://github.com/KULLANICI/REPO.git
git push -u origin main
```

---

## ADIM 4 — GitHub Secret Scanning Uyarısı

GitHub, bilinen formatlardaki API anahtarlarını otomatik tarar.  
Eğer daha önce push ettiyseniz:

1. GitHub repo → **Security** sekmesi → **Secret scanning alerts**
2. Uyarıları görüyorsanız "Revoke" butonuna tıklayın (Supabase key için geçerli değil ama iyi alışkanlık)
3. Alert'leri "Resolved" olarak işaretleyin

---

## ADIM 5 — Gelecek İçin Güvenli Geliştirme Alışkanlıkları

### Proje Yapısı
```
okul-projesi/
├── .gitignore                    ← Repo'nun köküne koyun
├── js/
│   ├── supabase-config.js        ← .gitignore'da → GitHub'a GİTMEZ
│   └── supabase-config.example.js ← Boş şablon → GitHub'a GİDER
```

### .gitignore Kuralı (Her Projede)
```
# Supabase / API anahtarları
js/supabase-config.js
.env
.env.local
.env*.local
```

### Commit Öncesi Kontrol
```bash
# Commit etmeden önce anahtarın staged alanda olmadığını doğrula:
git diff --staged | grep -i "supabase\|key\|secret\|password"

# Hiç çıktı gelmemesi beklenir.
```

---

## 📊 Özet Eylem Listesi

| # | Eylem | Aciliyet | Süre |
|---|---|---|---|
| 1 | `rls-policies.sql` çalıştır | 🔴 Hemen | 2 dk |
| 2 | `.gitignore` dosyasını kontrol et | 🔴 Hemen | 1 dk |
| 3 | `js/supabase-config.js`'e gerçek keyleri yaz | 🔴 Hemen | 2 dk |
| 4 | Git geçmişini temizle (filter-repo/BFG) | 🟡 Bu hafta | 15 dk |
| 5 | GitHub Secret Scanning uyarılarını kapat | 🟡 Bu hafta | 5 dk |
| 6 | Takım varsa: Herkese bildir, anahtarı rotate et | 🟢 Planlı | — |

---

> **Uzun vadeli öneri:** Supabase'in kendi Auth sistemine (magic link veya email+şifre)
> geçmek, `auth.uid()` ile tam RLS koruması sağlar ve her kullanıcı sadece
> kendi satırına erişebilir hale gelir. Bu proje için `rls-policies.sql`
> içinde Aşama 2 bölümü planlanmıştır.
