/**
 * ÖRNEK YAPILANDIRMA DOSYASI — GitHub'a bu dosya yüklenir.
 * Gerçek bilgiler içermez. Kullanmak için kopyalayın:
 *   cp js/supabase-config.example.js js/supabase-config.js
 * Ardından gerçek değerleri supabase-config.js içine yazın.
 */

const SUPABASE_URL      = 'BURAYA_PROJECT_URL_YAZIN';
const SUPABASE_ANON_KEY = 'BURAYA_ANON_KEY_YAZIN';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabaseClient = supabase;
