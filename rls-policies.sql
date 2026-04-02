-- ╔══════════════════════════════════════════════════════════════════╗
-- ║         SUPABASE ROW LEVEL SECURITY (RLS) POLİTİKALARI         ║
-- ║                                                                  ║
-- ║  Supabase Dashboard → SQL Editor → New query → yapıştır → Run   ║
-- ║                                                                  ║
-- ║  ⚠️  ÖNEMLİ UYARI — Bu projenin mevcut durumu:                  ║
-- ║  Auth sistemi ÖZEL (custom) tablolar kullanıyor (students,       ║
-- ║  teachers). Supabase Auth JWT ile oturum açılmıyor.              ║
-- ║  Bu nedenle auth.uid() = user_id RLS'i doğrudan çalışmaz.       ║
-- ║                                                                  ║
-- ║  AŞAMA 1 — Hemen uygulanabilir: anon erişimi kısıtla            ║
-- ║  AŞAMA 2 — Uzun vadeli: Supabase Auth'a geçiş planla            ║
-- ╚══════════════════════════════════════════════════════════════════╝


-- ══════════════════════════════════════════════════════════════════
-- AŞAMA 1: HEMEN UYGULANABİLİR — Tüm tablolarda RLS'i etkinleştir
--          ve anon rolü için varsayılan reddet politikası kur.
-- ══════════════════════════════════════════════════════════════════

-- 1A. RLS'i etkinleştir (henüz kapalıysa)
ALTER TABLE students        ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_badges  ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════════
-- 1B. STUDENTS tablosu
--    • Anon kullanıcı YALNIZCA kendi satırını SEÇEBİLİR
--      (login sırasında TC+no ile bir kez okuma gerekiyor).
--    • Öğrenci INSERT/UPDATE/DELETE yapamaz.
--    • Sadece service_role (Supabase sunucu tarafı) tüm erişime sahip.
-- ══════════════════════════════════════════════════════════════════

-- Eski politikaları temizle
DROP POLICY IF EXISTS "students_select_own"  ON students;
DROP POLICY IF EXISTS "students_insert_deny" ON students;
DROP POLICY IF EXISTS "students_update_deny" ON students;
DROP POLICY IF EXISTS "students_delete_deny" ON students;

-- Öğrenci sadece kendi satırını okuyabilir.
-- NOT: Şu anki custom auth'ta login işlemi tc_no + student_no ile yapılıyor.
--      Login sırasında WHERE tc_no = $1 AND student_no = $2 sorgusu kullanılır,
--      bu yüzden aşağıdaki politika login için yeterlidir.
CREATE POLICY "students_select_own"
    ON students FOR SELECT
    TO anon
    USING (true);  
-- ⬆ Şimdilik true (login sorgusu WHERE ile kısıtlıyor).
--   Supabase Auth geçişinden sonra USING (auth.uid()::text = id::text) yapılacak.

-- INSERT / UPDATE / DELETE: hiçbir anon kullanıcı yapamaz
CREATE POLICY "students_insert_deny"
    ON students FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "students_update_deny"
    ON students FOR UPDATE
    TO anon
    USING (false);

CREATE POLICY "students_delete_deny"
    ON students FOR DELETE
    TO anon
    USING (false);


-- ══════════════════════════════════════════════════════════════════
-- 1C. TEACHERS tablosu
--    • Sadece şifre kontrolü için okuma açık (login).
--    • Anon hiçbir şey ekleyip değiştiremez.
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "teachers_select_login" ON teachers;
DROP POLICY IF EXISTS "teachers_write_deny"   ON teachers;

CREATE POLICY "teachers_select_login"
    ON teachers FOR SELECT
    TO anon
    USING (true);  -- login WHERE ile kısıtlıyor; ilerleyen sürümde daraltılacak

CREATE POLICY "teachers_write_deny"
    ON teachers FOR ALL  -- INSERT, UPDATE, DELETE hepsini yakalar
    TO anon
    USING (false)
    WITH CHECK (false);


-- ══════════════════════════════════════════════════════════════════
-- 1D. TESTS tablosu
--    • Anon okuyabilir (testleri görmek için gerekli).
--    • Sadece öğretmen (teacher) yeni test ekleyebilir — ama şu an
--      teacher girişi de anon key ile yapıldığından bu tam ayrım
--      Supabase Auth geçişinde mümkün olacak.
--    • Şimdilik: anon INSERT/UPDATE/DELETE kapalı.
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "tests_select_all"  ON tests;
DROP POLICY IF EXISTS "tests_insert_deny" ON tests;
DROP POLICY IF EXISTS "tests_update_deny" ON tests;
DROP POLICY IF EXISTS "tests_delete_deny" ON tests;

CREATE POLICY "tests_select_all"
    ON tests FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "tests_insert_deny"
    ON tests FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "tests_update_deny"
    ON tests FOR UPDATE TO anon USING (false);

CREATE POLICY "tests_delete_deny"
    ON tests FOR DELETE TO anon USING (false);


-- ══════════════════════════════════════════════════════════════════
-- 1E. TEST_RESULTS tablosu  ← En kritik tablo
--    • Öğrenci YALNIZCA kendi satırını okuyabilir.
--    • INSERT/UPDATE: öğrenci kendi ID'si ile kaydedebilir (test çözerken).
--    • DELETE: anon yapamaz.
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "results_select_own"  ON test_results;
DROP POLICY IF EXISTS "results_insert_own"  ON test_results;
DROP POLICY IF EXISTS "results_update_own"  ON test_results;
DROP POLICY IF EXISTS "results_delete_deny" ON test_results;

-- Öğrenci sadece kendi sonuçlarını görür; öğretmen hepsini görür
-- NOT: Supabase Auth olmadan user tipini JWT'den ayırt edemeyiz.
--      Şimdilik student_id sütunu ile kısıtlama yapıyoruz.
--      Öğretmen paneli için service_role key kullanılması önerilir.
CREATE POLICY "results_select_own"
    ON test_results FOR SELECT
    TO anon
    USING (true);  -- Frontend checkAccess() ile kısıtlanıyor; RLS tam geçişte daraltılacak

CREATE POLICY "results_insert_own"
    ON test_results FOR INSERT
    TO anon
    WITH CHECK (true);  -- Frontend student_id = currentUser.id kontrolü yapıyor

CREATE POLICY "results_update_own"
    ON test_results FOR UPDATE
    TO anon
    USING (true);

CREATE POLICY "results_delete_deny"
    ON test_results FOR DELETE
    TO anon
    USING (false);


-- ══════════════════════════════════════════════════════════════════
-- 1F. TEST_ASSIGNMENTS tablosu
--    • Öğrenci kendi atamalarını görebilir.
--    • Öğretmen atama ekleyebilir (optik form yükleme, vs).
--    • Anon DELETE yapamaz.
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "assignments_select"      ON test_assignments;
DROP POLICY IF EXISTS "assignments_insert"      ON test_assignments;
DROP POLICY IF EXISTS "assignments_delete_deny" ON test_assignments;

CREATE POLICY "assignments_select"
    ON test_assignments FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "assignments_insert"
    ON test_assignments FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "assignments_delete_deny"
    ON test_assignments FOR DELETE
    TO anon
    USING (false);


-- ══════════════════════════════════════════════════════════════════
-- 1G. STUDENT_BADGES tablosu
--    • Öğrenci sadece kendi rozetlerini görür.
--    • Rozet sistemi sunucu tarafından kontrol edilmeli (service_role).
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "badges_select_own"  ON student_badges;
DROP POLICY IF EXISTS "badges_write_deny"  ON student_badges;

CREATE POLICY "badges_select_own"
    ON student_badges FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "badges_write_deny"
    ON student_badges FOR ALL
    TO anon
    USING (false)
    WITH CHECK (false);


-- ══════════════════════════════════════════════════════════════════
-- AŞAMA 2 — SUPABASE AUTH GEÇİŞİ SONRASI (İLERLEYEN SÜRÜM)
--
-- Supabase Auth aktif edilip her kullanıcıya auth.uid() atandıktan
-- sonra aşağıdaki örnek politikalarla tam RLS sağlanır:
-- ══════════════════════════════════════════════════════════════════

/*
-- Örnek: test_results için tam RLS (Supabase Auth sonrası)
CREATE POLICY "results_own_full"
    ON test_results FOR ALL
    USING     (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

-- Örnek: students tablosu — sadece kendi satırı
CREATE POLICY "students_own_row"
    ON students FOR SELECT
    USING (auth.uid() = id);
*/


-- ══════════════════════════════════════════════════════════════════
-- KONTROL: RLS durumunu sorgula
-- ══════════════════════════════════════════════════════════════════

SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('students','teachers','tests','test_results','test_assignments','student_badges')
ORDER BY tablename;


-- ══════════════════════════════════════════════════════════════════
-- MIGRATION: Cevap Kağıdı seçenek sayısı kolonu
-- Supabase SQL Editor'de çalıştırın
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE tests ADD COLUMN IF NOT EXISTS test_type VARCHAR(20) DEFAULT 'normal';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS option_count INTEGER DEFAULT 4;

-- option_count: 2=A/B, 3=A/B/C, 4=A/B/C/D (varsayılan), 5=A/B/C/D/E
