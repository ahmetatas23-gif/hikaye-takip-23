// js/supabase-config.js

// 1. Kendi panelinden aldığın URL ve Key'i tırnak içine yapıştır
const SUPABASE_URL      = 'https://gmzdeptaipfacmfdexnd.supabase.co'; 
const SUPABASE_ANON_KEY = 'var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtemRlcHRhaXBmYWNtZmRleG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mzk2NzAsImV4cCI6MjA3MjMxNTY3MH0.uFenHsXWA0esrAoAYJ3MK6UoEW-8uNOc8CzYrJVyt5k';      // Örn: eyJhbGci...
';

// 2. Client oluştururken doğrudan 'supabase.createClient' kullanın
// (Eğer CDN kullanıyorsan 'supabase' objesi globaldir)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3. Diğer dosyalardan (app.js gibi) erişmek için window'a bağla
window.supabase = supabaseClient;
