const SUPABASE_URL      = 'https://gmzdeptaipfacmfdexnd.supabase.co';
const SUPABASE_ANON_KEY = 'var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtemRlcHRhaXBmYWNtZmRleG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3Mzk2NzAsImV4cCI6MjA3MjMxNTY3MH0.uFenHsXWA0esrAoAYJ3MK6UoEW-8uNOc8CzYrJVyt5k';      // Örn: eyJhbGci...
'; // Senin uzun anahtarın burada kalsın

// "window.supabase.createClient" yerine sadece "supabase.createClient" kullan
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// app.js içinde "supabase.from" diyebilmen için:
window.supabase = supabaseClient;
