/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           SUPABASE YAPILANDIRMA DOSYASI                      ║
 * ║   ⚠️  Bu dosyayı .gitignore ile GitHub'a yüklemeyin!        ║
 * ║   ✅  Paylaşmak istiyorsanız supabase-config.example.js     ║
 * ║       dosyasını kullanın (gerçek key olmadan).               ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * KURULUM:
 *  1. Bu dosyayı kopyalayın: supabase-config.example.js → supabase-config.js
 *  2. Gerçek değerleri aşağıya yazın.
 *  3. .gitignore dosyanıza "js/supabase-config.js" ekleyin.
 */

// ─── Supabase Bağlantı Bilgileri ───────────────────────────────
// Supabase Dashboard → Project Settings → API bölümünden alınır.
var SUPABASE_URL      = 'https://gmzdeptaipfacmfdexnd.supabase.co';   // Örn: https://xyz.supabase.co
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtemRlcHRhaXBmYWNtZmRleG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mzk2NzAsImV4cCI6MjA3MjMxNTY3MH0.uFenHsXWA0esrAoAYJ3MK6UoEW-8uNOc8CzYrJVyt5k';      // Örn: eyJhbGci...

// ─── İstemci Oluşturma ─────────────────────────────────────────
// window.supabase: CDN üzerinden yüklenen @supabase/supabase-js v2
if (!window.supabase) {
    throw new Error('Supabase CDN yüklenmedi! index.html içinde CDN <script> etiketinin bu dosyadan önce geldiğinden emin olun.');
}

var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        // Bu proje özel (custom) auth kullandığından Supabase Auth oturumu devre dışı.
        // Tam RLS desteği için ilerleyen sürümde Supabase Auth'a geçiş planlanabilir.
        persistSession: false
    }
});

// "supabase" değişkeni var ile tanımlandığından tüm script dosyaları erişebilir.

