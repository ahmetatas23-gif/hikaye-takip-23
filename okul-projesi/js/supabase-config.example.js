/**
 * ÖRNEK YAPILANDIRMA DOSYASI — GitHub'a bu dosya yüklenir.
 * Gerçek bilgiler içermez. Kullanmak için kopyalayın:
 *   cp js/supabase-config.example.js js/supabase-config.js
 * Ardından gerçek değerleri supabase-config.js içine yazın.
 */

const SUPABASE_URL      = 'https://gmzdeptaipfacmfdexnd.supabase.co';
const SUPABASE_ANON_KEY = 'var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtemRlcHRhaXBmYWNtZmRleG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mzk2NzAsImV4cCI6MjA3MjMxNTY3MH0.uFenHsXWA0esrAoAYJ3MK6UoEW-8uNOc8CzYrJVyt5k';      // Örn: eyJhbGci...
';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabaseClient = supabase;
