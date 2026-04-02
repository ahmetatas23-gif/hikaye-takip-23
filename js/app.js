/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                      APP.JS — ANA UYGULAMA                   ║
 * ║  Auth fonksiyonları (login/logout/session) → js/auth.js      ║
 * ║  Supabase bağlantısı → js/supabase-config.js                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════
// GLOBAL STATE DEĞİŞKENLERİ
// Orijinal dosyada ayrı bir <script> bloğunda tanımlıydı.
// Tüm fonksiyonların erişebilmesi için dosyanın en üstünde olmalıdır.
// ═══════════════════════════════════════════════════════════════
let impersonatedStudent = null;
let currentUser = null;
let currentTest = null;
let testTimer = null;
let questionTimer = null;
let timeRemaining = 0;
let questionTimeRemaining = 75;
let currentFontSize = 16;
const fontSizes = [12, 14, 16, 18, 20, 22, 26, 32];
let currentCKAnswers = {}; // Cevap kağıdı seçimleri

// Test filtering state
let allTestsData = [];
let currentTestFilter = 'all';
let currentTestSearch = '';

// Student test filtering state
let allStudentTestsData = [];
let currentStudentTestFilter = 'all';

// Library filtering state
window.currentLibraryFilter = 'all';
window.currentLibrarySearch = '';

        // Initialize the application
        document.addEventListener('DOMContentLoaded', async function() {
            console.log('Türkçe Okuma Anlama Test Sistemi yüklendi!');
            
            // Önce oturumu geri yüklemeyi dene (sayfa yenileme)
            const restored = await restoreSession();
            if (restored) return;

	        // Load remembered credentials (form doldurma)
	        loadRememberedCredentials();
	        
	        // Test Supabase connection
	        testSupabaseConnection();
	    });
	
	    // --- JSON Edit Functions ---
	
	    // Show JSON Edit Modal
	    async function showJSONEditModal(testId) {
	        try {
	            const { data: test, error } = await supabase
	                .from('tests')
	                .select('id, questions')
	                .eq('id', testId)
	                .single();
	
	            if (error) throw error;
	
	            document.getElementById('jsonEditTestId').value = test.id;
	            
	            // Pretty print the JSON string for editing
	            let prettyJson = test.questions;
	            try {
	                const parsedQuestions = JSON.parse(test.questions);
	                prettyJson = JSON.stringify(parsedQuestions, null, 2);
	            } catch (e) {
	                console.warn("Questions field is not valid JSON, showing as raw text.");
	            }
	            
	            document.getElementById('jsonEditQuestions').value = prettyJson;
	            
	            showModal('jsonEditModal');
	        } catch (error) {
	            console.error('Error loading test for JSON edit:', error);
	            showNotification('Test verileri yüklenirken hata oluştu.', 'error');
	        }
	    }
	
	    // Save JSON Edit
	    async function saveJSONEdit(event) {
	        event.preventDefault();
	        const testId = document.getElementById('jsonEditTestId').value;
	        const questionsText = document.getElementById('jsonEditQuestions').value;
	        
	        // Validate JSON structure (without any automatic conversion)
	        let questionsJsonString = questionsText;
	        try {
	            // Attempt to parse to validate structure
	            const parsedQuestions = JSON.parse(questionsText);
	            
	            // Soruları olduğu gibi kaydet - hiçbir otomatik dönüştürme yapma
	            // (Kullanıcı 3 seçenekli sorular istiyorsa, 3 seçenekli kalacak)
	            questionsJsonString = JSON.stringify(parsedQuestions);
	            
	        } catch (e) {
	            // If parsing fails, assume the user intended to save the raw text as is (as requested by user)
	            console.warn('JSON parsing failed. Saving raw text as requested by user. Error:', e);
	            questionsJsonString = questionsText;
	        }
	        
	        // 2. Update Supabase
	        try {
	            const { error } = await supabase
	                .from('tests')
	                .update({ questions: questionsJsonString })
	                .eq('id', testId);
	
	            if (error) throw error;
	
	            showNotification('✅ Kaydedildi! Test verileri başarıyla güncellendi.', 'success');
	            closeModal('jsonEditModal');
	            
	            // Reload the tests list to reflect changes
	            loadTestsList();
	            
	        } catch (error) {
	            console.error('Error saving JSON edit:', error);
	            showNotification('Kaydetme sırasında hata oluştu: ' + error.message, 'error');
	        }
	    }
	
	    // --- End JSON Edit Functions ---

        // Remember Me functionality
        function saveCredentials(type, credentials) {
            if (type === 'student') {
                localStorage.setItem('rememberedStudent', JSON.stringify({
                    tc: credentials.tc,
                    studentNo: credentials.studentNo,
                    timestamp: Date.now()
                }));
            } else if (type === 'teacher') {
                localStorage.setItem('rememberedTeacher', JSON.stringify({
                    username: credentials.username,
                    timestamp: Date.now()
                }));
            }
        }

        // Oturum kaydet (sayfa yenilenmesine karşı)
        function saveSession(user) {
            try {
                sessionStorage.setItem('currentSession', JSON.stringify({
                    user: user,
                    timestamp: Date.now()
                }));
            } catch(e) {}
        }

        // Oturumu temizle
        function clearSession() {
            sessionStorage.removeItem('currentSession');
        }

        // Sayfa yüklenince oturumu geri yükle
        async function restoreSession() {
            try {
                const saved = sessionStorage.getItem('currentSession');
                if (!saved) return false;

                const { user, timestamp } = JSON.parse(saved);
                // 12 saat geçerli
                if (Date.now() - timestamp > 12 * 60 * 60 * 1000) {
                    clearSession();
                    return false;
                }

                if (!user || !user.id) return false;

                // Kullanıcıyı DB'den doğrula
                if (user.type === 'student') {
                    const { data, error } = await supabase
                        .from('students').select('*').eq('id', user.id).single();
                    if (error || !data) { clearSession(); return false; }
                    currentUser = { ...data, type: 'student' };
                    showStudentDashboard();
                } else if (user.type === 'teacher') {
                    const { data, error } = await supabase
                        .from('teachers').select('*').eq('id', user.id).single();
                    if (error || !data) { clearSession(); return false; }
                    currentUser = { ...data, type: 'teacher' };
                    showTeacherDashboard();
                } else {
                    clearSession();
                    return false;
                }
                return true;
            } catch(e) {
                console.error('Session restore error:', e);
                clearSession();
                return false;
            }
        }

        function loadRememberedCredentials() {
            // Load student credentials
            const rememberedStudent = localStorage.getItem('rememberedStudent');
            if (rememberedStudent) {
                try {
                    const studentData = JSON.parse(rememberedStudent);
                    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                    if (studentData.timestamp > thirtyDaysAgo) {
                        document.getElementById('studentTC').value = studentData.tc || '';
                        document.getElementById('studentNo').value = studentData.studentNo || '';
                        document.getElementById('rememberStudent').checked = true;
                    } else {
                        localStorage.removeItem('rememberedStudent');
                    }
                } catch (error) {
                    localStorage.removeItem('rememberedStudent');
                }
            }

            // Load teacher credentials
            const rememberedTeacher = localStorage.getItem('rememberedTeacher');
            if (rememberedTeacher) {
                try {
                    const teacherData = JSON.parse(rememberedTeacher);
                    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                    if (teacherData.timestamp > thirtyDaysAgo) {
                        document.getElementById('teacherUsername').value = teacherData.username || '';
                        document.getElementById('rememberTeacher').checked = true;
                    } else {
                        localStorage.removeItem('rememberedTeacher');
                    }
                } catch (error) {
                    localStorage.removeItem('rememberedTeacher');
                }
            }
        }

        function clearRememberedCredentials(type) {
            if (type === 'student') {
                localStorage.removeItem('rememberedStudent');
            } else if (type === 'teacher') {
                localStorage.removeItem('rememberedTeacher');
            }
        }

        async function testSupabaseConnection() {
            try {
                console.log('Supabase bağlantısı test ediliyor...');
                
                // Test basic connection
                const { data, error } = await supabase.from('teachers').select('count');
                if (error) {
                    console.error('Teachers table error:', error);
                    // If table doesn't exist, try to create tables
                    await createMissingTables();
                } else {
                    console.log('Supabase bağlantısı başarılı!');
                }
                
                // Verify all required tables exist
                await verifyTables();
                
            } catch (error) {
                console.error('Supabase bağlantı hatası:', error);
                showNotification('Veritabanı bağlantısı kurulamadı. Lütfen Supabase ayarlarını kontrol edin.', 'error');
            }
        }

        async function createMissingTables() {
            console.log('Eksik tablolar oluşturuluyor...');
            
            try {
                // Create teachers table
                try { await supabase.rpc('create_teachers_table'); } catch (e) { console.warn('create_teachers_table RPC not found, skipping:', e.message); }
                
                // Create students table  
                try { await supabase.rpc('create_students_table'); } catch (e) { console.warn('create_students_table RPC not found, skipping:', e.message); }
                
                // Create tests table
                try { await supabase.rpc('create_tests_table'); } catch (e) { console.warn('create_tests_table RPC not found, skipping:', e.message); }
                
                // Create test_assignments table
                try { await supabase.rpc('create_test_assignments_table'); } catch (e) { console.warn('create_test_assignments_table RPC not found, skipping:', e.message); }
                
                // Create test_results table
                try { await supabase.rpc('create_test_results_table'); } catch (e) { console.warn('create_test_results_table RPC not found, skipping:', e.message); }
                
                // Create student_badges table
                try { await supabase.rpc('create_student_badges_table'); } catch (e) { console.warn('create_student_badges_table RPC not found, skipping:', e.message); }
                
                console.log('Tablolar başarıyla oluşturuldu!');
                
            } catch (error) {
                console.error('Tablo oluşturma hatası:', error);
                // If RPC functions don't exist, show manual SQL
                showTableCreationSQL();
            }
        }

        async function verifyTables() {
            const requiredTables = ['teachers', 'students', 'tests', 'test_assignments', 'test_results', 'student_badges'];
            const missingTables = [];
            
            for (const table of requiredTables) {
                try {
                    const { error } = await supabase.from(table).select('*').limit(1);
                    if (error && error.code === 'PGRST116') {
                        missingTables.push(table);
                    }
                } catch (error) {
                    console.error(`Error checking table ${table}:`, error);
                    missingTables.push(table);
                }
            }
            
            if (missingTables.length > 0) {
                console.error('Eksik tablolar:', missingTables);
                showTableCreationSQL();
            } else {
                console.log('Tüm gerekli tablolar mevcut ✓');
                await insertSampleData();
            }
        }

        function showTableCreationSQL() {
            const sqlCommands = `
-- Supabase SQL Editor'da çalıştırmanız gereken komutlar:

-- 1. Teachers table
CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Students table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tc_no VARCHAR(11) UNIQUE NOT NULL,
    student_no VARCHAR(50) UNIQUE NOT NULL,
    class VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Tests table
CREATE TABLE IF NOT EXISTS tests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reading_text TEXT NOT NULL,
    text_display_mode VARCHAR(20) DEFAULT 'first_page_only',
    questions JSONB NOT NULL,
    time_limit INTEGER DEFAULT 30,
    created_by INTEGER REFERENCES teachers(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Add text_display_mode column if it doesn't exist (for existing tables)
ALTER TABLE tests ADD COLUMN IF NOT EXISTS text_display_mode VARCHAR(20) DEFAULT 'first_page_only';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS test_type VARCHAR(20) DEFAULT 'normal';
ALTER TABLE tests ADD COLUMN IF NOT EXISTS option_count INTEGER DEFAULT 4;

-- 4. Test assignments table
CREATE TABLE IF NOT EXISTS test_assignments (
    id SERIAL PRIMARY KEY,
    test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(test_id, student_id)
);

-- 5. Test results table
CREATE TABLE IF NOT EXISTS test_results (
    id SERIAL PRIMARY KEY,
    test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    answers JSONB,
    completed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(test_id, student_id)
);

-- 6. Student badges table
CREATE TABLE IF NOT EXISTS student_badges (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    badge_type VARCHAR(50) NOT NULL,
    earned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, badge_type)
);

-- 7. Insert sample teacher (username: admin, password: admin123)
INSERT INTO teachers (name, username, password) 
VALUES ('Örnek Öğretmen', 'admin', 'admin123')
ON CONFLICT (username) DO NOTHING;

-- 8. Insert sample students
INSERT INTO students (name, tc_no, student_no, class) VALUES
('Ahmet Yılmaz', '12345678901', '2024001', '8A'),
('Ayşe Demir', '12345678902', '2024002', '8A'),
('Mehmet Kaya', '12345678903', '2024003', '8B'),
('Fatma Şahin', '12345678904', '2024004', '8B'),
('Ali Özkan', '12345678905', '2024005', '8A')
ON CONFLICT (tc_no) DO NOTHING;
            `;
            
            console.log('SQL Komutları:');
            console.log(sqlCommands);
            
            // Show modal with SQL commands
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-semibold text-gray-900">Supabase Tablo Kurulumu Gerekli</h3>
                            <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                        
                        <div class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div class="flex items-center mb-2">
                                <i class="fas fa-exclamation-triangle text-yellow-600 mr-2"></i>
                                <h4 class="font-semibold text-yellow-800">Gerekli Tablolar Eksik</h4>
                            </div>
                            <p class="text-yellow-700 text-sm">
                                Sistem çalışması için gerekli veritabanı tabloları bulunamadı. 
                                Lütfen aşağıdaki SQL komutlarını Supabase SQL Editor'da çalıştırın.
                            </p>
                        </div>
                        
                        <div class="mb-4">
                            <h4 class="font-semibold text-gray-800 mb-2">Adımlar:</h4>
                            <ol class="list-decimal list-inside text-sm text-gray-700 space-y-1">
                                <li>Supabase Dashboard'a gidin</li>
                                <li>SQL Editor sekmesini açın</li>
                                <li>Aşağıdaki SQL kodunu kopyalayıp yapıştırın</li>
                                <li>RUN butonuna tıklayın</li>
                                <li>Sayfayı yenileyin</li>
                            </ol>
                        </div>
                        
                        <div class="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-gray-400">SQL Komutları:</span>
                                <button onclick="copyToClipboard(\`${sqlCommands.replace(/`/g, '\\`')}\`)" 
                                        class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                                    <i class="fas fa-copy mr-1"></i>Kopyala
                                </button>
                            </div>
                            <pre class="whitespace-pre-wrap">${sqlCommands}</pre>
                        </div>
                        
                        <div class="mt-4 flex justify-end space-x-3">
                            <button onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 text-gray-600 hover:text-gray-800">
                                Kapat
                            </button>
                            <button onclick="location.reload()" 
                                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                Sayfayı Yenile
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }

        async function insertSampleData() {
            try {
                // Check if sample teacher exists
                const { data: teachers } = await supabase
                    .from('teachers')
                    .select('*')
                    .limit(1);
                
                if (!teachers || teachers.length === 0) {
                    // Insert sample teacher
                    await supabase
                        .from('teachers')
                        .insert({
                            name: 'Örnek Öğretmen',
                            username: 'admin',
                            password: 'admin123'
                        });
                    console.log('Örnek öğretmen eklendi (admin/admin123)');
                }
                
                // Check if sample students exist
                const { data: students } = await supabase
                    .from('students')
                    .select('*')
                    .limit(1);
                
                if (!students || students.length === 0) {
                    // Insert sample students
                    await supabase
                        .from('students')
                        .insert([
                            { name: 'Ahmet Yılmaz', tc_no: '12345678901', student_no: '2024001', class: '8A' },
                            { name: 'Ayşe Demir', tc_no: '12345678902', student_no: '2024002', class: '8A' },
                            { name: 'Mehmet Kaya', tc_no: '12345678903', student_no: '2024003', class: '8B' },
                            { name: 'Fatma Şahin', tc_no: '12345678904', student_no: '2024004', class: '8B' },
                            { name: 'Ali Özkan', tc_no: '12345678905', student_no: '2024005', class: '8A' }
                        ]);
                    console.log('Örnek öğrenciler eklendi');
                }
                
            } catch (error) {
                console.error('Örnek veri ekleme hatası:', error);
            }
        }

        // Navigation functions
        window.showStudentLogin = function() {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('studentLoginScreen').classList.remove('hidden');
        }

        window.showTeacherLogin = function() {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('teacherLoginScreen').classList.remove('hidden');
        }

        window.showMainLogin = function() {
            document.getElementById('studentLoginScreen').classList.add('hidden');
            document.getElementById('teacherLoginScreen').classList.add('hidden');
            document.getElementById('loginScreen').classList.remove('hidden');
        }

        // Student login
        async function studentLogin(event) {
            event.preventDefault();
            const tc = document.getElementById('studentTC').value;
            const studentNo = document.getElementById('studentNo').value;
            const rememberMe = document.getElementById('rememberStudent').checked;

            try {
                const { data, error } = await supabase
                    .from('students')
                    .select('*')
                    .eq('tc_no', tc)
                    .eq('student_no', studentNo)
                    .single();

                if (error) throw error;

                if (data) {
                    currentUser = { ...data, type: 'student' };
                    saveSession(currentUser);
                    
                    // Handle remember me functionality
                    if (rememberMe) {
                        saveCredentials('student', { tc, studentNo });
                        showNotification('Giriş bilgileriniz hatırlandı! 📝', 'success');
                    } else {
                        clearRememberedCredentials('student');
                    }
                    
                    showStudentDashboard();
                } else {
                    showNotification('Öğrenci bulunamadı. TC ve öğrenci numaranızı kontrol edin.', 'error');
                }
            } catch (error) {
                console.error('Student login error:', error);
                if (!navigator.onLine) {
                    showNotification('İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.', 'error');
                } else {
                    showNotification('Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.', 'error');
                }
            }
        }

        // Teacher login
        async function teacherLogin(event) {
            event.preventDefault();
            const username = document.getElementById('teacherUsername').value;
            const password = document.getElementById('teacherPassword').value;
            const rememberMe = document.getElementById('rememberTeacher').checked;

            try {
                const { data, error } = await supabase
                    .from('teachers')
                    .select('*')
                    .eq('username', username)
                    .eq('password', password)
                    .single();

                if (error) throw error;

                if (data) {
                    currentUser = { ...data, type: 'teacher' };
                    saveSession(currentUser);
                    
                    // Handle remember me functionality
                    if (rememberMe) {
                        saveCredentials('teacher', { username });
                        showNotification('Giriş bilgileriniz hatırlandı! 📝', 'success');
                    } else {
                        clearRememberedCredentials('teacher');
                    }
                    
                    showTeacherDashboard();
                } else {
                    showNotification('Kullanıcı adı veya şifre hatalı.', 'error');
                }
            } catch (error) {
                console.error('Teacher login error:', error);
                if (!navigator.onLine) {
                    showNotification('İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.', 'error');
                } else {
                    showNotification('Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.', 'error');
                }
            }
        }

        // Show student dashboard
        async function showStudentDashboard() {
            hideAllScreens();
            document.getElementById('studentDashboard').classList.remove('hidden');
            document.getElementById('studentInfo').textContent = `${currentUser.name} (${currentUser.student_no})`;
            
            // Handle impersonation UI
            const isImpersonating = impersonatedStudent !== null;
            document.getElementById('impersonationBadge').classList.toggle('hidden', !isImpersonating);
            document.getElementById('exitImpersonationButton').classList.toggle('hidden', !isImpersonating);
            document.getElementById('studentLogoutButton').classList.toggle('hidden', isImpersonating);

            // Yükleme göstergesi (skeleton değil — testsContent içindeki assignedTests DOM'u korumak için)
            const assignedEl = document.getElementById('assignedTests');
            if (assignedEl) assignedEl.innerHTML = `
                <div class="flex items-center justify-center py-12 text-gray-400">
                    <div class="loading-spinner mr-3" style="width:24px;height:24px;border-width:3px;"></div>
                    <span class="text-sm">Testler yükleniyor...</span>
                </div>`;
            if (typeof showLoading === 'function') showLoading('Veriler yükleniyor...');
            try {
                await loadStudentData();
            } finally {
                if (typeof hideLoading === 'function') hideLoading();
            }
        }

        // Show teacher dashboard
        async function showTeacherDashboard() {
            closeResultModalIfOpen();
            hideAllScreens();
            document.getElementById('teacherDashboard').classList.remove('hidden');
            document.getElementById('teacherInfo').textContent = `${currentUser.name}`;

            if (typeof showLoading === 'function') showLoading('Panel yükleniyor...');
            try {
                await loadTeacherData();
            } finally {
                if (typeof hideLoading === 'function') hideLoading();
            }
        }

        function hideAllScreens() {
            const screens = ['loginScreen', 'studentLoginScreen', 'teacherLoginScreen', 'studentDashboard', 'teacherDashboard', 'testScreen', 'textReadingScreen', 'cevapKagiديScreen'];
            screens.forEach(screen => {
                const el = document.getElementById(screen);
                if (el) el.classList.add('hidden');
            });
        }

        // Sonuç modalını kapat (panel geçişlerinde çağrılır)
        function closeResultModalIfOpen() {
            const screen = document.getElementById('testResultScreen');
            if (screen) {
                screen.style.setProperty('display', 'none', 'important');
            }
            document.body.style.overflow = '';
            if (window._trsTimer) {
                clearInterval(window._trsTimer);
                window._trsTimer = null;
            }
            // Eski modal ID'si için geriye dönük uyumluluk
            const oldModal = document.getElementById('testResultModal');
            if (oldModal) oldModal.classList.add('hidden');
        }

        // Show text reading screen
        function showTextReadingScreen() {
            hideAllScreens();
            document.getElementById('textReadingScreen').classList.remove('hidden');
            
            document.getElementById('readingTestTitle').textContent = currentTest.title;
            document.getElementById('readingTestDescription').textContent = currentTest.description || '';
            document.getElementById('readingTextContent').textContent = currentTest.reading_text;
            
            // Reset font size to default
            currentFontSize = 16;
            document.getElementById('readingFontSizeIndicator').textContent = '16px';
            document.getElementById('readingTextContent').style.fontSize = '16px';
        }

        // Font size control for reading screen
        function changeReadingFontSize(direction) {
            const currentIndex = fontSizes.indexOf(currentFontSize);
            let newIndex = currentIndex + direction;
            
            // Clamp to valid range
            newIndex = Math.max(0, Math.min(fontSizes.length - 1, newIndex));
            currentFontSize = fontSizes[newIndex];
            
            // Update font size indicator
            document.getElementById('readingFontSizeIndicator').textContent = `${currentFontSize}px`;
            
            // Apply font size to reading text
            document.getElementById('readingTextContent').style.fontSize = `${currentFontSize}px`;
        }

        // Start questions from reading screen
        function startQuestionsFromReading() {
            showTestScreen();
            startTimer(currentTest.time_limit * 60); // Convert minutes to seconds
            displayQuestion();
        }

        // Start test timer
        function startTimer(seconds) {
            if (testTimer) clearInterval(testTimer);
            
            timeRemaining = seconds;
            
            testTimer = setInterval(() => {
                timeRemaining--;
                
                if (timeRemaining <= 0) {
                    clearInterval(testTimer);
                    // Auto submit when time runs out
                    submitTest();
                }
            }, 1000);
        }

        // Load student data
        async function loadStudentData() {
            try {
                // Load assigned tests
                const { data: assignments } = await supabase
                    .from('test_assignments')
                    .select(`*, tests (*)`)
                    .eq('student_id', currentUser.id);

                // Load test results - tüm sonuçları çek (sayfalama ile)
                let results = [];
                let fromSD = 0;
                while (true) {
                    const { data: page } = await supabase
                        .from('test_results').select('*')
                        .eq('student_id', currentUser.id)
                        .order('completed_at', { ascending: false })
                        .range(fromSD, fromSD + 999);
                    if (!page || page.length === 0) break;
                    results = results.concat(page);
                    if (page.length < 1000) break;
                    fromSD += 1000;
                }

                // Load badges
                const { data: badges } = await supabase
                    .from('student_badges')
                    .select('*')
                    .eq('student_id', currentUser.id);

                // Store results globally for filtering
                window.currentStudentResults = results;
                
                await updateStudentStats(assignments, results, badges);
                displayAssignedTests(assignments, results);
                displayStudentBadges(badges);
                // Liderlik tablosunu yükle (Ayın Yıldızları dahil)
                await loadLeaderboard();

            } catch (error) {
                console.error('Error loading student data:', error);
                if (typeof showNotification === 'function') {
                    if (!navigator.onLine) {
                        showNotification('İnternet bağlantısı yok. Veriler yüklenemedi.', 'error');
                    } else {
                        showNotification('Veriler yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'), 'error');
                    }
                }
            }
        }

        // Update student statistics
                // Update student statistics
        async function updateStudentStats(assignments, results, badges, forcedPeriod = null) {
            // Global verileri sakla (refresh için)
            window.lastAssignments = assignments;
            window.lastResults = results;
            window.lastBadges = badges;

            // Sadece normal tipindeki testleri say (liderlik/istatistik için)
            const normalAssignments = (assignments || []).filter(a => !a.tests?.test_type || a.tests.test_type === 'normal');
            const normalResults = (results || []).filter(r => {
                const assignment = (assignments || []).find(a => a.test_id === r.test_id);
                return !assignment || !assignment.tests?.test_type || assignment.tests.test_type === 'normal';
            });

            if (document.getElementById('totalTests')) document.getElementById('totalTests').textContent = normalAssignments.length;
            if (document.getElementById('completedTests')) document.getElementById('completedTests').textContent = normalResults.length;
            
            const avgScore = normalResults.length > 0 
                ? Math.round(normalResults.reduce((sum, r) => sum + r.score, 0) / normalResults.length)
                : 0;
            if (document.getElementById('averageScore')) document.getElementById('averageScore').textContent = avgScore;
            if (document.getElementById('badgeCount')) document.getElementById('badgeCount').textContent = badges?.length || 0;

            try {
                const periodSelect = document.getElementById('studentPeriodSelect');
                const selectedPeriod = forcedPeriod || (periodSelect ? periodSelect.value : 'current');

                // 1. Tarih hesapla (Basit ve güvenilir yöntem)
                const today = new Date();
                const dayOfWeek = today.getDay();
                const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                
                let weekStart = new Date(today);
                weekStart.setDate(today.getDate() - daysFromMonday);
                weekStart.setHours(0, 0, 0, 0);
                
                let weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);
                
                // Geçen hafta için 7 gün çıkar
                if (selectedPeriod === 'last') {
                    weekStart.setDate(weekStart.getDate() - 7);
                    weekEnd.setDate(weekEnd.getDate() - 7);
                }
                
                // Arayüzü güncelle
                const titleElem = document.getElementById('studentPerfTitle');
                if (titleElem) {
                    titleElem.textContent = selectedPeriod === 'last' ? 'Geçen Haftaki Okuma' : 'Bu Haftaki Okuma';
                }
                
                const options = { day: 'numeric', month: 'long' };
                const dateRangeText = `${weekStart.toLocaleDateString('tr-TR', options)} - ${weekEnd.toLocaleDateString('tr-TR', options)}`;
                const dateRangeElem = document.getElementById('currentWeekRange');
                if (dateRangeElem) {
                    dateRangeElem.textContent = dateRangeText;
                    console.log('Date range updated to:', dateRangeText);
                }

                // 2. Supabase'den veri çek - SQL View her zaman tüm verileri içerir, biz filtreleyiz
                const { data: statsData, error: statsError } = await supabase
                    .from('student_all_period_stats')
                    .select('*')
                    .eq('student_id', currentUser.id)
                    .single();
                
                console.log('Supabase statsData fetched:', statsData, 'selectedPeriod:', selectedPeriod);
                
                let successCount = 0;
                let failedCount = 0;
                let weekly = 0;
                let dailyStats = {};
                
                if (!statsError && statsData) {
                    console.log('Processing statsData for period:', selectedPeriod);
                    if (selectedPeriod === 'last') {
                        weekly = statsData.last_weekly_total_tests || 0;
                        successCount = statsData.last_weekly_successful_tests || 0;
                        failedCount = statsData.last_weekly_failed_tests || 0;
                        console.log('Last week selected - weekly:', weekly, 'success:', successCount, 'failed:', failedCount);
                        dailyStats = {
                            0: statsData.last_mon_total || 0,
                            1: statsData.last_tue_total || 0,
                            2: statsData.last_wed_total || 0,
                            3: statsData.last_thu_total || 0,
                            4: statsData.last_fri_total || 0,
                            5: statsData.last_sat_total || 0,
                            6: statsData.last_sun_total || 0
                        };
                    } else {
                        weekly = statsData.current_weekly_total_tests || 0;
                        successCount = statsData.current_weekly_successful_tests || 0;
                        failedCount = statsData.current_weekly_failed_tests || 0;
                        console.log('Current week selected - weekly:', weekly, 'success:', successCount, 'failed:', failedCount);
                        dailyStats = {
                            0: statsData.current_mon_total || 0,
                            1: statsData.current_tue_total || 0,
                            2: statsData.current_wed_total || 0,
                            3: statsData.current_thu_total || 0,
                            4: statsData.current_fri_total || 0,
                            5: statsData.current_sat_total || 0,
                            6: statsData.current_sun_total || 0
                        };
                    }
                    const monthly = statsData.monthly_total_tests || 0;
                    document.getElementById('studentMonthlyTotal').textContent = monthly;
                }

                // 3. Update Weekly Test Status (Öğretmen panelindeki gibi SQL View verilerini kullan)
                const daysShort = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
                const rowContainer = document.getElementById('studentWeeklyStatusRow');
                if (rowContainer) {
                    const today = new Date().getDay(); 
                    const currentDayIdx = today === 0 ? 6 : today - 1; 

	                    rowContainer.innerHTML = daysShort.map((dayName, idx) => {
	                        let content = '<span class="pill-tag pill-empty">-</span>';
	                        const count = dailyStats[idx] || 0;
	                        
	                        if (count > 0) {
	                            // AKILLI RENKLENDİRME: Haftalık toplamda hata varsa, test çözülen günleri KIRMIZI yap
	                            if (failedCount > 0) {
	                                content = `<span class="pill-tag pill-failed">${count} ✕</span>`;
	                            } else {
	                                // Hata yoksa ve test çözülmüşse YEŞİL yap
	                                content = `<span class="pill-tag pill-success">${count} ✓</span>`;
	                            }
	                        } else if (selectedPeriod === 'current' && idx === currentDayIdx) {
	                            content = '<span class="pill-tag pill-pending">!</span>';
	                        }
	                        return `<td class="px-2 py-4 text-center">${content}</td>`;
	                    }).join('');

                    // Update Summary Counts
                    
                    // Update Totals and Badge
                    document.getElementById('studentWeeklyTotal').textContent = `${weekly} Test`;
                    
                    let badgeHtml = '';
                    if (weekly >= 6) {
                        badgeHtml = '<span class="status-badge badge-very-active"><i class="fas fa-fire"></i> Çok Aktif</span>';
                    } else if (weekly >= 4) {
                        badgeHtml = '<span class="status-badge badge-active"><i class="fas fa-check-circle"></i> Aktif</span>';
                    } else {
                        badgeHtml = '<span class="status-badge badge-inactive"><i class="fas fa-exclamation-circle"></i> Harekete Geç</span>';
                    }
                    document.getElementById('studentStatusBadgeContainer').innerHTML = badgeHtml;
                }
            } catch (e) { console.error("Error updating modern card:", e); }
        }

        async function handleStudentPeriodChange() {
            const periodSelect = document.getElementById('studentPeriodSelect');
            if (!periodSelect) return;
            
            const selectedPeriod = periodSelect.value;
            console.log('Student period manual change triggered:', selectedPeriod);
            
            // Başlığı ve tarih aralığını anında güncellemek için updateStudentStats'ı zorunlu periyotla çağır
            if (window.lastAssignments && window.lastResults) {
                await updateStudentStats(window.lastAssignments, window.lastResults, window.lastBadges || [], selectedPeriod);
            } else {
                // Eğer veriler henüz yoksa, her şeyi yeniden yükle
                await refreshStudentStats();
            }
        }

        async function refreshStudentStats() {
            // Verileri yeniden yükle ve arayüzü güncelle
            if (currentUser && currentUser.id) {
                try {
                    // Öğrenci verilerini yeniden çekmek en güvenli yoldur - Tablo adı test_assignments olmalı
                    const { data: assignments } = await supabase.from('test_assignments').select('*, tests(*)').eq('student_id', currentUser.id);
                    const { data: results } = await supabase.from('test_results').select('*').eq('student_id', currentUser.id);
                    const { data: badges } = await supabase.from('student_badges').select('*').eq('student_id', currentUser.id);
                    
                    const periodSelect = document.getElementById('studentPeriodSelect');
                    const currentPeriod = periodSelect ? periodSelect.value : 'current';
                    
                    await updateStudentStats(assignments || [], results || [], badges || [], currentPeriod);
                } catch (error) {
                    console.error("Error refreshing student stats:", error);
                }
            }
        }

        // Display assigned tests with one-time completion logic
        function displayAssignedTests(assignments, results) {
            // Store all test data for filtering
            allStudentTestsData = assignments || [];
            
            // Apply current filter
            filterStudentTests(assignments, results);
        }

        // Filter student tests
        function filterStudentTests(assignments = null, results = null) {
            // Use stored data if not provided
            if (!assignments) assignments = allStudentTestsData;
            if (!results) {
                results = window.currentStudentResults || [];
            }
            
            const container = document.getElementById('assignedTests');
            container.innerHTML = '';

            if (!assignments || assignments.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-12">
                        <i class="fas fa-clipboard-list text-6xl text-gray-300 mb-4"></i>
                        <p class="text-gray-500 text-lg">Henüz atanmış test bulunmuyor.</p>
                        <p class="text-gray-400 text-sm mt-2">Öğretmeniniz size test atadığında burada görünecek.</p>
                    </div>
                `;
                updateStudentTestFilterInfo(0, 0);
                return;
            }

            // Arama terimi
            const searchTerm = (document.getElementById('studentTestSearchInput')?.value || '').toLowerCase().trim();

            // Filtrele
            let filteredAssignments = [...assignments];
            
            switch (currentStudentTestFilter) {
                case 'waiting':
                    filteredAssignments = assignments.filter(assignment => {
                        const result = results?.find(r => r.test_id === assignment.test_id);
                        return !result;
                    });
                    break;
                case 'successful':
                    filteredAssignments = assignments.filter(assignment => {
                        const result = results?.find(r => r.test_id === assignment.test_id);
                        return result && result.score >= 70;
                    });
                    break;
                case 'low_score':
                    filteredAssignments = assignments.filter(assignment => {
                        const result = results?.find(r => r.test_id === assignment.test_id);
                        return result && result.score < 70;
                    });
                    break;
                case 'alistirma':
                    filteredAssignments = assignments.filter(assignment =>
                        assignment.tests?.test_type === 'alistirma'
                    );
                    break;
                case 'sinav':
                    filteredAssignments = assignments.filter(assignment =>
                        assignment.tests?.test_type === 'sinav'
                    );
                    break;
                case 'cevap_kagidi':
                    filteredAssignments = assignments.filter(assignment =>
                        assignment.tests?.test_type === 'cevap_kagidi'
                    );
                    break;
                case 'all':
                default:
                    break;
            }

            // Arama filtresi uygula
            if (searchTerm) {
                filteredAssignments = filteredAssignments.filter(assignment =>
                    (assignment.tests?.title || '').toLowerCase().includes(searchTerm) ||
                    (assignment.tests?.description || '').toLowerCase().includes(searchTerm)
                );
            }

            // SIRALAMA: Bekleyenler (en son atanan) en üste, tamamlananlar alta
            filteredAssignments.sort((a, b) => {
                const aResult = results?.find(r => r.test_id === a.test_id);
                const bResult = results?.find(r => r.test_id === b.test_id);
                const aWaiting = !aResult;
                const bWaiting = !bResult;
                if (aWaiting && !bWaiting) return -1;
                if (!aWaiting && bWaiting) return 1;
                return new Date(b.assigned_at) - new Date(a.assigned_at);
            });

            if (filteredAssignments.length === 0) {
                const filterMessages = {
                    'waiting':       'Bekleyen test bulunmuyor.',
                    'successful':    'Başarılı test bulunmuyor.',
                    'low_score':     'Düşük puan alan test bulunmuyor.',
                    'alistirma':     'Alıştırma testi bulunmuyor.',
                    'sinav':         'Sınav testi bulunmuyor.',
                    'cevap_kagidi':  'Cevap kağıdı testi bulunmuyor.',
                    'all':           'Test bulunmuyor.'
                };
                const msg = searchTerm
                    ? `"${searchTerm}" ile eşleşen test bulunamadı.`
                    : filterMessages[currentStudentTestFilter];
                
                container.innerHTML = `
                    <div class="text-center py-12">
                        <i class="fas fa-search text-6xl text-gray-300 mb-4"></i>
                        <p class="text-gray-500 text-lg">${msg}</p>
                        <p class="text-gray-400 text-sm mt-2">Farklı bir filtre seçerek diğer testleri görebilirsiniz.</p>
                    </div>
                `;
                updateStudentTestFilterInfo(filteredAssignments.length, assignments.length);
                return;
            }

            // Testleri Normal ve Sınav olarak grupla
            const normalTests = filteredAssignments.filter(a => !a.tests?.test_type || a.tests.test_type === 'normal' || a.tests.test_type === 'alistirma');
            const sinavTests = filteredAssignments.filter(a => a.tests?.test_type === 'sinav');
            const cevapKagiديTests = filteredAssignments.filter(a => a.tests?.test_type === 'cevap_kagidi');

            // Normal / Alıştırma testler bölümü
            if (normalTests.length > 0) {
                const sectionHeader = document.createElement('div');
                sectionHeader.className = 'mb-3 mt-1';
                sectionHeader.innerHTML = `<h3 class="text-base font-bold text-gray-700 flex items-center"><span class="w-2 h-5 bg-blue-500 rounded mr-2 inline-block"></span>📝 Testler <span class="ml-2 text-xs font-normal text-gray-400">(${normalTests.length} adet)</span></h3>`;
                container.appendChild(sectionHeader);
                normalTests.forEach(a => renderStudentTestCard(a, results, container));
            }

            // Sınav testler bölümü
            if (sinavTests.length > 0) {
                const sinavHeader = document.createElement('div');
                sinavHeader.className = 'mb-3 mt-5';
                sinavHeader.innerHTML = `<h3 class="text-base font-bold text-gray-700 flex items-center"><span class="w-2 h-5 bg-orange-500 rounded mr-2 inline-block"></span>📋 Sınavlar <span class="ml-2 text-xs font-normal text-gray-400">(${sinavTests.length} adet)</span></h3>`;
                container.appendChild(sinavHeader);
                sinavTests.forEach(a => renderStudentTestCard(a, results, container));
            }

            // Cevap Kağıdı bölümü
            if (cevapKagiديTests.length > 0) {
                const ckHeader = document.createElement('div');
                ckHeader.className = 'mb-3 mt-5';
                ckHeader.innerHTML = `<h3 class="text-base font-bold text-gray-700 flex items-center"><span class="w-2 h-5 bg-cyan-500 rounded mr-2 inline-block"></span>📄 Cevap Kağıtları <span class="ml-2 text-xs font-normal text-gray-400">(${cevapKagiديTests.length} adet)</span></h3>`;
                container.appendChild(ckHeader);
                cevapKagiديTests.forEach(a => renderStudentTestCard(a, results, container));
            }

            updateStudentTestFilterInfo(filteredAssignments.length, assignments.length);
        }


        // Öğrenci kendi sonucunu görüntüler
        async function showStudentOwnResult(resultId) {
            try {
                showNotification('Sonuç yükleniyor...', 'info');

                const { data: result, error: rErr } = await supabase
                    .from('test_results').select('*').eq('id', resultId).single();
                if (rErr) throw rErr;

                const { data: test, error: tErr } = await supabase
                    .from('tests').select('*').eq('id', result.test_id).single();
                if (tErr) throw tErr;

                const answersData = result.answers ? JSON.parse(result.answers) : {};
                const isOptikForm = answersData.kaynak === 'optik_form';
                const score = result.score;
                const passed = score >= 70;

                let soruDetayHTML = '';

                if (isOptikForm) {
                    // ── Optik form: soruAnaliz grid ──────────────────────────
                    const soruAnaliz = answersData.soruAnaliz || [];
                    const dogru  = answersData.dogru  || 0;
                    const yanlis = answersData.yanlis || 0;
                    const bos    = answersData.bos    || 0;
                    const total  = soruAnaliz.length || (dogru + yanlis + bos);

                    const istatHTML =
                        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">' +
                        '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;text-align:center;">' +
                            '<div style="font-size:24px;font-weight:700;color:#16a34a;">' + dogru + '</div>' +
                            '<div style="font-size:11px;color:#15803d;">Doğru</div></div>' +
                        '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;text-align:center;">' +
                            '<div style="font-size:24px;font-weight:700;color:#dc2626;">' + yanlis + '</div>' +
                            '<div style="font-size:11px;color:#b91c1c;">Yanlış</div></div>' +
                        '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;text-align:center;">' +
                            '<div style="font-size:24px;font-weight:700;color:#6b7280;">' + bos + '</div>' +
                            '<div style="font-size:11px;color:#4b5563;">Boş</div></div>' +
                        '</div>';

                    let gridHTML = '';
                    if (soruAnaliz.length > 0) {
                        gridHTML = '<p style="font-size:11px;color:#6b7280;margin-bottom:8px;">🟢 Doğru &nbsp; 🔴 Yanlış (senin cevabın) &nbsp; ⚪ Boş</p>' +
                            '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px;">' +
                            soruAnaliz.map(function(s) {
                                var bg = s.sonuc === 'dogru' ? '#22c55e' : s.sonuc === 'yanlis' ? '#ef4444' : '#d1d5db';
                                var label = s.sonuc === 'dogru' ? '✓' : s.sonuc === 'yanlis' ? (s.ogrenciCevap || '✗') : '—';
                                var tip = s.sonuc === 'dogru'
                                    ? ('Soru ' + s.soruNo + ': Doğru (' + s.dogruCevap + ')')
                                    : s.sonuc === 'yanlis'
                                    ? ('Soru ' + s.soruNo + ': Sen ' + s.ogrenciCevap + ' işaretledin, doğrusu ' + s.dogruCevap)
                                    : ('Soru ' + s.soruNo + ': Boş bıraktın');
                                return '<div title="' + tip + '" style="width:36px;height:36px;border-radius:8px;background:' + bg + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;cursor:default;box-shadow:0 1px 3px rgba(0,0,0,.15);">' + label + '</div>';
                            }).join('') +
                            '</div>';

                        const hatalar = soruAnaliz.filter(function(s) { return s.sonuc !== 'dogru'; });
                        if (hatalar.length > 0) {
                            gridHTML += '<p style="font-size:11px;font-weight:700;color:#6b7280;margin-bottom:6px;">Hatalı / Boş Sorular:</p>' +
                                hatalar.map(function(s) {
                                    var isY = s.sonuc === 'yanlis';
                                    return '<div style="display:flex;align-items:center;gap:10px;padding:7px 12px;border-radius:8px;margin-bottom:4px;' +
                                        (isY ? 'background:#fef2f2;border:1px solid #fecaca;' : 'background:#f9fafb;border:1px solid #e5e7eb;') + '">' +
                                        '<span>' + (isY ? '❌' : '⬜') + '</span>' +
                                        '<span style="font-size:13px;font-weight:600;color:#374151;min-width:60px;">Soru ' + s.soruNo + '</span>' +
                                        '<span style="font-size:13px;color:#4b5563;">' +
                                            (isY ? ('Sen <strong>' + s.ogrenciCevap + '</strong> işaretledin, doğrusu <strong>' + s.dogruCevap + '</strong>') : 'Boş bıraktın') +
                                        '</span></div>';
                                }).join('');
                        } else {
                            gridHTML += '<p style="font-size:13px;color:#16a34a;font-weight:600;">🎯 Tüm soruları doğru yaptın!</p>';
                        }
                    } else {
                        gridHTML = '<p style="font-size:13px;color:#9ca3af;text-align:center;padding:12px 0;">Soru detayı bulunamadı.</p>';
                    }

                    soruDetayHTML =
                        '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;">' +
                            '<h4 style="font-size:14px;font-weight:700;color:#1f2937;margin-bottom:12px;display:flex;align-items:center;gap:8px;">' +
                                '<i class="fas fa-list-check" style="color:#6366f1;"></i> Soru Analizi</h4>' +
                            istatHTML + gridHTML +
                        '</div>';

                } else {
                    // ── Normal test: soru bazlı detay ────────────────────────
                    let questions = [];
                    try { questions = JSON.parse(test.questions); } catch(e) {}
                    let studentAnswers = [];
                    if (answersData.answers) {
                        if (Array.isArray(answersData.answers)) {
                            studentAnswers = answersData.answers;
                        } else {
                            for (let i = 0; i < questions.length; i++) {
                                studentAnswers[i] = answersData.answers[i] !== undefined ? answersData.answers[i] : answersData.answers[String(i)];
                            }
                        }
                    } else if (Array.isArray(answersData)) {
                        studentAnswers = answersData;
                    } else {
                        for (let i = 0; i < questions.length; i++) {
                            studentAnswers[i] = answersData[i] !== undefined ? answersData[i] : answersData[String(i)];
                        }
                    }

                    const qRows = questions.map((question, index) => {
                        const userAnswer = studentAnswers[index];
                        const correctAnswer = question.correct !== undefined ? question.correct : question.correct_answer;
                        let isCorrect = false, userDisp = '', correctDisp = '';

                        if (question.type === 'multiple_choice') {
                            isCorrect = parseInt(userAnswer) === parseInt(correctAnswer);
                            userDisp = userAnswer !== undefined && question.options && question.options[userAnswer]
                                ? String.fromCharCode(65 + parseInt(userAnswer)) + ') ' + question.options[userAnswer] : 'Cevaplanmadı';
                            correctDisp = question.options && question.options[correctAnswer]
                                ? String.fromCharCode(65 + parseInt(correctAnswer)) + ') ' + question.options[correctAnswer] : '';
                        } else if (question.type === 'true_false') {
                            const ub = (userAnswer === 'true' || userAnswer === true);
                            const cb = (correctAnswer === 'true' || correctAnswer === true);
                            isCorrect = ub === cb && userAnswer !== undefined && userAnswer !== null && userAnswer !== '';
                            userDisp = userAnswer === true || userAnswer === 'true' ? 'Doğru' : userAnswer === false || userAnswer === 'false' ? 'Yanlış' : 'Cevaplanmadı';
                            correctDisp = cb ? 'Doğru' : 'Yanlış';
                        } else if (question.type === 'fill_blank') {
                            if (!userAnswer && userAnswer !== 0) { userDisp = 'Cevaplanmadı'; correctDisp = String(correctAnswer); }
                            else if (question.options && !isNaN(parseInt(userAnswer)) && question.options[parseInt(userAnswer)] !== undefined) {
                                isCorrect = parseInt(userAnswer) === parseInt(correctAnswer);
                                userDisp = question.options[parseInt(userAnswer)];
                                correctDisp = question.options[parseInt(correctAnswer)] || String(correctAnswer);
                            } else {
                                isCorrect = String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
                                userDisp = String(userAnswer);
                                correctDisp = String(correctAnswer);
                            }
                        } else {
                            isCorrect = userAnswer && String(userAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
                            userDisp = userAnswer || 'Cevaplanmadı';
                            correctDisp = String(correctAnswer);
                        }

                        return '<div style="border:2px solid ' + (isCorrect ? '#bbf7d0' : '#fecaca') + ';background:' + (isCorrect ? '#f0fdf4' : '#fef2f2') + ';border-radius:10px;padding:12px;margin-bottom:8px;">' +
                            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
                                '<div style="flex:1;">' +
                                    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
                                        '<span style="font-size:16px;">' + (isCorrect ? '✅' : '❌') + '</span>' +
                                        '<span style="font-weight:700;color:#111827;">Soru ' + (index + 1) + '</span>' +
                                    '</div>' +
                                    '<p style="font-size:13px;color:#374151;margin-bottom:8px;">' + (question.text || question.question || '') + '</p>' +
                                    '<div style="background:#fff;border-radius:8px;padding:10px;border:1px solid #e5e7eb;">' +
                                        '<div style="display:flex;justify-content:space-between;font-size:13px;">' +
                                            '<span style="font-weight:600;color:#374151;">📝 Senin cevabın:</span>' +
                                            '<span style="font-weight:700;color:' + (isCorrect ? '#15803d' : '#b91c1c') + ';">' + userDisp + '</span>' +
                                        '</div>' +
                                        (!isCorrect ? '<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb;">' +
                                            '<span style="font-weight:600;color:#374151;">✓ Doğru cevap:</span>' +
                                            '<span style="font-weight:700;color:#15803d;">' + correctDisp + '</span>' +
                                        '</div>' : '') +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>';
                    }).join('');

                    soruDetayHTML =
                        '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;">' +
                            '<h4 style="font-size:14px;font-weight:700;color:#1f2937;margin-bottom:12px;display:flex;align-items:center;gap:8px;">' +
                                '<i class="fas fa-list-check" style="color:#6366f1;"></i> Soru Bazında Detay (' + questions.length + ' soru)</h4>' +
                            '<div style="max-height:400px;overflow-y:auto;">' + qRows + '</div>' +
                        '</div>';
                }

                // Modal oluştur
                const passed2 = score >= 70;
                const modalHTML = `
                    <div id="studentOwnResultModal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;overflow-y:auto;">
                        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;">
                            <div style="background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.2);max-width:680px;width:100%;margin:24px 0;">
                                <!-- Başlık -->
                                <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;background:linear-gradient(to right,#eff6ff,#f5f3ff);border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:flex-start;">
                                    <div>
                                        <h3 style="font-size:18px;font-weight:700;color:#111827;margin-bottom:4px;">
                                            <i class="fas fa-clipboard-check" style="color:#6366f1;margin-right:8px;"></i>Test Sonucun
                                        </h3>
                                        <p style="font-size:13px;color:#6b7280;">${test.title}</p>
                                    </div>
                                    <button onclick="document.getElementById('studentOwnResultModal').remove()" style="background:none;border:none;cursor:pointer;font-size:22px;color:#9ca3af;line-height:1;">✕</button>
                                </div>
                                <!-- İçerik -->
                                <div style="padding:20px 24px;max-height:75vh;overflow-y:auto;">
                                    <!-- Puan özet -->
                                    <div style="text-align:center;margin-bottom:20px;">
                                        <div style="width:80px;height:80px;border-radius:50%;background:${passed2 ? 'linear-gradient(135deg,#4ade80,#16a34a)' : 'linear-gradient(135deg,#fb923c,#ef4444)'};display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
                                            <i class="fas ${passed2 ? 'fa-trophy' : 'fa-exclamation-triangle'}" style="font-size:28px;color:#fff;"></i>
                                        </div>
                                        <div style="font-size:36px;font-weight:800;color:${passed2 ? '#16a34a' : '#dc2626'};">${score}%</div>
                                        <p style="font-size:14px;color:${passed2 ? '#15803d' : '#b91c1c'};font-weight:600;">${passed2 ? '🎉 Başarı puanına ulaştın!' : '⚠️ Başarı puanına ulaşamadın.'}</p>
                                        <p style="font-size:12px;color:#9ca3af;margin-top:4px;">Tamamlanma: ${new Date(result.completed_at).toLocaleDateString('tr-TR', {day:'numeric',month:'long',year:'numeric'})}</p>
                                    </div>
                                    <!-- Soru analizi -->
                                    ${soruDetayHTML}
                                </div>
                                <!-- Alt bar -->
                                <div style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;border-radius:0 0 16px 16px;display:flex;justify-content:flex-end;">
                                    <button onclick="document.getElementById('studentOwnResultModal').remove()" style="padding:10px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Kapat</button>
                                </div>
                            </div>
                        </div>
                    </div>`;

                // Eski modal varsa kaldır
                const existing = document.getElementById('studentOwnResultModal');
                if (existing) existing.remove();
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                showNotification('✅ Sonuç yüklendi!', 'success');

            } catch(err) {
                console.error('showStudentOwnResult error:', err);
                showNotification('Sonuç yüklenirken hata: ' + err.message, 'error');
            }
        }

        function renderStudentTestCard(assignment, results, container) {
            const result = results?.find(r => r.test_id === assignment.test_id);
            const isCompleted = !!result;
            const passed = result && result.score >= 70;
            const failed = result && result.score < 70;
            const testType = assignment.tests?.test_type || 'normal';
            const isCompact = testType === 'alistirma' || testType === 'sinav' || testType === 'cevap_kagidi';
            const resultId = result ? result.id : null;

            const testCard = document.createElement('div');

            if (isCompact) {
                // ── Kompakt kart: Alıştırma & Sınav ─────────────────────────────
                const questionCount = (() => { try { const q = JSON.parse(assignment.tests.questions); return Array.isArray(q) ? q.length : 0; } catch(e) { return 0; } })();

                let borderColor, accentColor, statusPill;
                if (!isCompleted) {
                    borderColor = 'border-yellow-300'; accentColor = 'bg-yellow-400';
                    statusPill = '<span class="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">⏳ Bekliyor</span>';
                } else if (passed) {
                    borderColor = 'border-green-300'; accentColor = 'bg-green-500';
                    statusPill = '<span class="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✅ Başarılı</span>';
                } else {
                    borderColor = 'border-red-300'; accentColor = 'bg-red-400';
                    statusPill = '<span class="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">🔴 Düşük</span>';
                }

                const typeIcon  = testType === 'sinav' ? '📋' : testType === 'cevap_kagidi' ? '📄' : '🔧';
                const typeColor = testType === 'sinav' ? 'text-orange-600 bg-orange-50' : testType === 'cevap_kagidi' ? 'text-cyan-600 bg-cyan-50' : 'text-green-600 bg-green-50';

                let actionBtn = '';
                if (!isCompleted) {
                    actionBtn = `<button onclick="startTest(${assignment.test_id})" class="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"><i class="fas fa-play text-xs"></i> Başla</button>`;
                } else if (resultId) {
                    actionBtn = `<button onclick="showStudentOwnResult(${resultId})" class="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg hover:bg-indigo-100 transition"><i class="fas fa-chart-bar text-xs"></i> Sonuç</button>`;
                }

                testCard.className = `bg-white rounded-xl border-2 ${borderColor} hover:shadow-md transition-all duration-200 overflow-hidden`;
                testCard.innerHTML = `
                    <div class="flex items-stretch">
                        <div class="w-1.5 ${accentColor} flex-shrink-0"></div>
                        <div class="flex-1 px-3 py-2.5 flex items-center gap-2.5 min-w-0">
                            <div class="flex-shrink-0 w-8 h-8 rounded-lg ${typeColor} flex items-center justify-center text-base">${typeIcon}</div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    <span class="font-bold text-gray-900 text-sm leading-tight truncate" style="max-width:150px">${assignment.tests.title}</span>
                                    ${statusPill}
                                </div>
                                <div class="flex items-center gap-2.5 text-xs text-gray-400">
                                    ${questionCount > 0 ? `<span><i class="fas fa-list-ol mr-0.5"></i>${questionCount} soru</span>` : ''}
                                    <span><i class="fas fa-clock mr-0.5"></i>${assignment.tests.time_limit} dk</span>
                                    ${result ? `<span class="font-bold ${result.score >= 70 ? 'text-green-600' : 'text-red-500'}">${result.score} puan</span>` : ''}
                                </div>
                            </div>
                            ${actionBtn}
                        </div>
                    </div>
                    ${failed ? `
                    <div class="mx-3 mb-2 px-2.5 py-1.5 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2">
                        <i class="fas fa-exclamation-triangle text-red-400 text-xs flex-shrink-0"></i>
                        <p class="text-red-600 text-xs">Tekrar çözebilmek için öğretmeninizden yeniden atama isteyin.</p>
                    </div>` : ''}
                `;
            } else {
                // ── Geniş kart: Normal test tipi (mevcut tasarım) ───────────────
                let statusBadge, statusColor, buttonContent, buttonAction, buttonClass;
                if (!isCompleted) {
                    statusBadge = '🟡 Bekliyor';
                    statusColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                    buttonContent = '<i class="fas fa-play mr-2"></i>Teste Başla';
                    buttonAction = `onclick="startTest(${assignment.test_id})"`;
                    buttonClass = 'px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 font-semibold';
                } else if (passed) {
                    statusBadge = '🟢 Başarılı';
                    statusColor = 'bg-green-100 text-green-800 border-green-200';
                    buttonContent = '<i class="fas fa-trophy mr-2"></i>Tamamlandı';
                    buttonAction = '';
                    buttonClass = 'px-6 py-3 bg-green-100 text-green-800 rounded-lg cursor-default font-semibold';
                } else {
                    statusBadge = '🔴 Düşük Puan';
                    statusColor = 'bg-red-100 text-red-800 border-red-200';
                    buttonContent = '<i class="fas fa-lock mr-2"></i>Tamamlandı';
                    buttonAction = 'onclick="showRetakeMessage()"';
                    buttonClass = 'px-6 py-3 bg-gray-400 text-white rounded-lg cursor-not-allowed font-semibold';
                }

                testCard.className = `bg-white rounded-xl p-6 border-2 ${statusColor.includes('yellow') ? 'border-yellow-200 hover:border-yellow-300' : statusColor.includes('green') ? 'border-green-200' : 'border-red-200'} hover:shadow-lg transition-all duration-300`;
                testCard.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center flex-wrap gap-2 mb-3">
                                <h4 class="font-bold text-gray-900 text-lg">${assignment.tests.title}</h4>
                                ${getTestTypeBadge(assignment.tests.test_type)}
                                <span class="px-3 py-1 text-sm font-medium rounded-full border ${statusColor}">${statusBadge}</span>
                            </div>
                            <p class="text-gray-600 mb-4">${assignment.tests.description || 'Test açıklaması bulunmuyor.'}</p>
                            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                                <div class="bg-gray-50 rounded-lg p-3 text-center">
                                    <div class="text-lg font-bold text-gray-800">${assignment.tests.time_limit}</div>
                                    <div class="text-xs text-gray-600">Dakika</div>
                                </div>
                                <div class="bg-blue-50 rounded-lg p-3 text-center">
                                    <div class="text-lg font-bold text-blue-800">${(() => { try { const q = JSON.parse(assignment.tests.questions); return Array.isArray(q) ? q.length : 7; } catch(e) { return 7; } })()}</div>
                                    <div class="text-xs text-blue-600">Soru</div>
                                </div>
                                ${result ? `
                                    <div class="bg-${result.score >= 70 ? 'green' : 'red'}-50 rounded-lg p-3 text-center">
                                        <div class="text-lg font-bold text-${result.score >= 70 ? 'green' : 'red'}-800">${result.score}</div>
                                        <div class="text-xs text-${result.score >= 70 ? 'green' : 'red'}-600">Puan</div>
                                    </div>
                                ` : `
                                    <div class="bg-gray-50 rounded-lg p-3 text-center">
                                        <div class="text-lg font-bold text-gray-800">-</div>
                                        <div class="text-xs text-gray-600">Puan</div>
                                    </div>
                                `}
                            </div>
                            <div class="text-sm text-gray-500">
                                <div class="flex items-center mb-1">
                                    <i class="fas fa-calendar mr-2"></i>
                                    Atanma: ${new Date(assignment.assigned_at).toLocaleDateString('tr-TR')}
                                </div>
                                ${result ? `<div class="flex items-center"><i class="fas fa-check-circle mr-2"></i>Tamamlanma: ${new Date(result.completed_at).toLocaleDateString('tr-TR')}</div>` : ''}
                            </div>
                            ${failed ? `
                                <div class="mt-4 p-3 bg-red-50 border-red-200 rounded-lg">
                                    <div class="flex items-center">
                                        <i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>
                                        <div>
                                            <p class="text-red-800 font-medium text-sm">Tekrar Çözme Hakkı</p>
                                            <p class="text-red-700 text-xs mt-1">Bu testi tekrar çözebilmek için öğretmeninizin size yeniden atama yapması gerekmektedir.</p>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="ml-6 flex flex-col items-end gap-2">
                            <button ${buttonAction} class="${buttonClass}">${buttonContent}</button>
                            ${!isCompleted ? `<div class="mt-2 text-xs text-gray-500 text-center"><i class="fas fa-info-circle mr-1"></i>Tek seferlik test</div>` : ''}
                        </div>
                    </div>
                `;
            }

            container.appendChild(testCard);
        }

        // Öğrencinin kendi sonucunu görüntüleme modalı
        async function showStudentOwnResult(resultId) {
            try {
                showNotification('Sonuç yükleniyor...', 'info');

                const { data: result, error: rErr } = await supabase
                    .from('test_results').select('*').eq('id', resultId).single();
                if (rErr) throw rErr;

                const { data: test, error: tErr } = await supabase
                    .from('tests').select('*').eq('id', result.test_id).single();
                if (tErr) throw tErr;

                const answersData = result.answers ? JSON.parse(result.answers) : {};
                const isOptikForm = answersData.kaynak === 'optik_form';
                const score = result.score;
                const passed = score >= 70;

                let soruBolumu = '';

                if (isOptikForm) {
                    const soruAnaliz = answersData.soruAnaliz || [];
                    const dogru  = answersData.dogru  || 0;
                    const yanlis = answersData.yanlis  || 0;
                    const bos    = answersData.bos     || 0;
                    soruBolumu = `
                        <div class="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                            <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                <i class="fas fa-list-check text-blue-600 mr-2"></i>
                                Soru Bazında Detay
                            </h4>
                            <div class="flex gap-4 mb-4 text-sm">
                                <span class="flex items-center gap-1"><span style="width:14px;height:14px;border-radius:4px;background:#22c55e;display:inline-block;"></span><strong>${dogru}</strong> Doğru</span>
                                <span class="flex items-center gap-1"><span style="width:14px;height:14px;border-radius:4px;background:#ef4444;display:inline-block;"></span><strong>${yanlis}</strong> Yanlış</span>
                                <span class="flex items-center gap-1"><span style="width:14px;height:14px;border-radius:4px;background:#d1d5db;display:inline-block;"></span><strong>${bos}</strong> Boş</span>
                            </div>
                            ${renderOptikSoruAnaliz(soruAnaliz)}
                        </div>`;
                } else {
                    let questions = [];
                    try { questions = JSON.parse(test.questions); } catch(e) {}

                    let studentAnswers = [];
                    if (answersData.answers) {
                        if (Array.isArray(answersData.answers)) {
                            studentAnswers = answersData.answers;
                        } else {
                            for (let i = 0; i < questions.length; i++) {
                                studentAnswers[i] = answersData.answers[i] !== undefined ? answersData.answers[i] : answersData.answers[String(i)];
                            }
                        }
                    } else if (Array.isArray(answersData)) {
                        studentAnswers = answersData;
                    } else {
                        for (let i = 0; i < questions.length; i++) {
                            studentAnswers[i] = answersData[i] !== undefined ? answersData[i] : answersData[String(i)];
                        }
                    }

                    if (questions.length === 0) {
                        soruBolumu = '<p class="text-sm text-gray-400 text-center py-4">Soru detay\u0131 bulunamad\u0131.</p>';
                    } else {
                        const soruRows = questions.map((q, idx) => {
                            const ua = studentAnswers[idx];
                            const correctAnswer = q.correct !== undefined ? q.correct : q.correct_answer;
                            let isCorrect = false;
                            let uaDisplay = 'Cevaplanmad\u0131';
                            let caDisplay = '';

                            if (q.type === 'multiple_choice') {
                                isCorrect = parseInt(ua) === parseInt(correctAnswer);
                                uaDisplay = ua !== undefined && q.options && q.options[ua] ? String.fromCharCode(65 + parseInt(ua)) + ') ' + q.options[ua] : 'Cevaplanmad\u0131';
                                caDisplay = q.options && q.options[correctAnswer] ? String.fromCharCode(65 + parseInt(correctAnswer)) + ') ' + q.options[correctAnswer] : String(correctAnswer);
                            } else if (q.type === 'fill_blank') {
                                if (ua === undefined || ua === null || ua === '') {
                                    isCorrect = false; uaDisplay = 'Cevaplanmad\u0131'; caDisplay = String(correctAnswer);
                                } else if (q.options && !isNaN(parseInt(ua)) && q.options[parseInt(ua)] !== undefined) {
                                    isCorrect = parseInt(ua) === parseInt(correctAnswer);
                                    uaDisplay = q.options[parseInt(ua)]; caDisplay = q.options[correctAnswer] || String(correctAnswer);
                                } else {
                                    isCorrect = String(ua).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
                                    uaDisplay = String(ua); caDisplay = String(correctAnswer);
                                }
                            } else if (q.type === 'true_false') {
                                const uaBool = (ua === 'true' || ua === true);
                                const caBool = (correctAnswer === 'true' || correctAnswer === true);
                                isCorrect = (ua !== undefined && ua !== null && ua !== '') && uaBool === caBool;
                                uaDisplay = (ua === true || ua === 'true') ? 'Do\u011fru' : (ua === false || ua === 'false') ? 'Yanl\u0131\u015f' : 'Cevaplanmad\u0131';
                                caDisplay = caBool ? 'Do\u011fru' : 'Yanl\u0131\u015f';
                            }

                            const bg = isCorrect ? 'background:#f0fdf4;border:1px solid #bbf7d0;' : 'background:#fef2f2;border:1px solid #fecaca;';
                            const icon = isCorrect ? '\u2705' : '\u274c';
                            return '<div style="' + bg + 'border-radius:8px;padding:8px 12px;margin-bottom:6px;display:flex;align-items:flex-start;gap:10px;">' +
                                '<span style="font-size:14px;flex-shrink:0;">' + icon + '</span>' +
                                '<div style="flex:1;min-width:0;">' +
                                    '<div style="font-size:12px;font-weight:700;color:#374151;">Soru ' + (idx+1) + '</div>' +
                                    '<div style="font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (q.text || q.question || '') + '</div>' +
                                    '<div style="font-size:12px;margin-top:3px;">' +
                                        '<span style="color:' + (isCorrect ? '#16a34a' : '#dc2626') + ';font-weight:600;">Cevab\u0131n\u0131z: ' + uaDisplay + '</span>' +
                                        (!isCorrect ? '<span style="color:#16a34a;margin-left:8px;font-weight:600;">\u2713 Do\u011fru: ' + caDisplay + '</span>' : '') +
                                    '</div>' +
                                '</div></div>';
                        }).join('');

                        soruBolumu = '<div class="bg-white border border-gray-200 rounded-xl p-4 mb-4">' +
                            '<h4 class="font-semibold text-gray-800 mb-3 flex items-center">' +
                            '<i class="fas fa-list-check text-blue-600 mr-2"></i>' +
                            'Soru Bazında Detay (' + questions.length + ' soru)</h4>' +
                            '<div style="max-height:320px;overflow-y:auto;">' + soruRows + '</div></div>';
                    }
                }

                const completedDate = new Date(result.completed_at).toLocaleDateString('tr-TR', {day:'numeric',month:'long',year:'numeric'});
                const gradientClass = passed ? 'from-green-400 to-green-600' : 'from-orange-400 to-red-500';
                const scoreColor   = passed ? 'text-green-700' : 'text-red-600';
                const borderClass  = passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
                const statusLabel  = passed ? '\ud83c\udf89 Ba\u015far\u0131l\u0131' : '\u26a0\ufe0f Ba\u015far\u0131s\u0131z';
                const statusColor2 = passed ? 'text-green-600' : 'text-red-500';
                const iconClass    = passed ? 'fa-trophy' : 'fa-exclamation-triangle';

                const modalHTML = '<div id="studentOwnResultModal" class="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto" style="z-index:1200;">' +
                    '<div class="min-h-screen flex items-center justify-center p-4">' +
                    '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">' +
                    '<div class="p-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-2xl flex justify-between items-start">' +
                        '<div><h3 class="text-lg font-bold text-gray-900">' + test.title + '</h3>' +
                        '<p class="text-xs text-gray-500 mt-1">' + completedDate + '</p></div>' +
                        '<button onclick="document.getElementById(\'studentOwnResultModal\').remove()" class="text-gray-400 hover:text-gray-600 ml-4"><i class="fas fa-times text-xl"></i></button>' +
                    '</div>' +
                    '<div class="p-5 max-h-[75vh] overflow-y-auto">' +
                        '<div class="flex items-center justify-center gap-6 mb-5 p-4 rounded-xl border ' + borderClass + '">' +
                            '<div class="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br ' + gradientClass + ' shadow-lg">' +
                                '<i class="fas ' + iconClass + ' text-2xl text-white"></i></div>' +
                            '<div class="text-center">' +
                                '<div class="text-4xl font-extrabold ' + scoreColor + '">' + score + '<span class="text-lg font-normal">%</span></div>' +
                                '<div class="text-sm font-semibold ' + statusColor2 + '">' + statusLabel + '</div>' +
                            '</div></div>' +
                        soruBolumu +
                    '</div></div></div></div>';

                const old = document.getElementById('studentOwnResultModal');
                if (old) old.remove();
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                showNotification('\u2705 Sonu\u00e7 y\u00fcklendi!', 'success');

            } catch(err) {
                console.error('showStudentOwnResult error:', err);
                showNotification('Sonu\u00e7 y\u00fcklenirken hata: ' + err.message, 'error');
            }
        }

        // Start test with assignment validation
        async function startTest(testId) {
            try {
                console.log('Starting test with ID:', testId, 'for student:', currentUser.id);
                
                if (!currentUser || !currentUser.id) {
                    console.error('No current user found');
                    showNotification('Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.', 'error');
                    return;
                }
                
                // First, check if student has valid assignment
                const { data: assignment, error: assignmentError } = await supabase
                    .from('test_assignments')
                    .select('*')
                    .eq('test_id', testId)
                    .eq('student_id', currentUser.id)
                    .maybeSingle(); // Use maybeSingle instead of single to handle no results

                console.log('Assignment query result:', { assignment, assignmentError });

                if (assignmentError) {
                    console.error('Assignment query error:', assignmentError);
                    showNotification('Atama kontrolü yapılırken hata oluştu.', 'error');
                    return;
                }

                if (!assignment) {
                    console.error('Assignment not found for student:', currentUser.id, 'test:', testId);
                    showNotification('Bu test size atanmamış veya erişim yetkiniz yok.', 'error');
                    return;
                }

                // Check if test is already completed (separate query for better reliability)
                const { data: existingResult, error: resultError } = await supabase
                    .from('test_results')
                    .select('*')
                    .eq('test_id', testId)
                    .eq('student_id', currentUser.id)
                    .maybeSingle(); // Use maybeSingle instead of single

                console.log('Existing result check:', { existingResult, resultError });

                if (resultError) {
                    console.error('Result query error:', resultError);
                    showNotification('Test sonucu kontrolü yapılırken hata oluştu.', 'error');
                    return;
                }

                if (existingResult) {
                    if (existingResult.score >= 70) {
                        showNotification('Bu testi zaten başarıyla tamamladınız. Tekrar çözemezsiniz.', 'warning');
                    } else {
                        showNotification('Bu testi zaten tamamladınız. Öğretmeninizin tekrar atamasını bekleyin.', 'warning');
                    }
                    return;
                }

                // Load test data
                const { data: test, error: testError } = await supabase
                    .from('tests')
                    .select('*')
                    .eq('id', testId)
                    .single();

                if (testError) {
                    console.error('Test loading error:', testError);
                    showNotification('Test verileri yüklenirken hata oluştu.', 'error');
                    return;
                }

                if (!test) {
                    console.error('Test not found:', testId);
                    showNotification('Test bulunamadı.', 'error');
                    return;
                }

                // Parse questions safely
                let questions;
                try {
                    questions = JSON.parse(test.questions);
                    if (!Array.isArray(questions) || questions.length === 0) {
                        throw new Error('Invalid questions format');
                    }
                } catch (parseError) {
                    console.error('Questions parsing error:', parseError);
                    showNotification('Test soruları yüklenirken hata oluştu.', 'error');
                    return;
                }

                currentTest = {
                    ...test,
                    questions: questions,
                    currentQuestion: 0,
                    answers: {},
                    startTime: new Date(),
                    assignmentId: assignment.id
                };

                console.log('Test loaded successfully:', currentTest);

                // Show mobile-friendly confirmation dialog
                const confirmStart = await showMobileConfirmDialog({
                    title: '🎯 Test Başlatma Onayı',
                    message: `Test: ${test.title}\nSüre: ${test.time_limit} dakika\nSoru Sayısı: ${questions.length}`,
                    warning: '⚠️ ÖNEMLİ UYARI:\n• Bu test sadece 1 kez çözülebilir\n• Test başladıktan sonra iptal edemezsiniz\n• Süre dolduğunda otomatik teslim edilir',
                    question: 'Teste başlamak istediğinizden emin misiniz?'
                });

                if (!confirmStart) {
                    console.log('Test start cancelled by user');
                    currentTest = null;
                    return;
                }

                console.log('Starting test with display mode:', test.text_display_mode);
                
                // ── Cevap kağıdı tipi: direkt optik form ekranına yönlendir ──
                if (test.test_type === 'cevap_kagidi') {
                    showCevapKagiديScreen();
                    return;
                }

                // Handle different text display modes
                const displayMode = test.text_display_mode || 'first_page_only';
                
                switch (displayMode) {
                    case 'first_page_only':
                        // Show text reading screen first (default behavior)
                        showTextReadingScreen();
                        break;
                    case 'with_questions':
                        // Show test screen with text visible alongside questions
                        showTestScreenWithText();
                        break;
                    case 'no_text':
                        // Skip text, go directly to questions
                        showTestScreen();
                        startTimer(currentTest.time_limit * 60);
                        displayQuestion();
                        break;
                    default:
                        // Fallback to default behavior
                        showTextReadingScreen();
                        break;
                }

            } catch (error) {
                console.error('Error starting test:', error);
                showNotification(`Test başlatılırken hata oluştu: ${error.message}`, 'error');
            }
        }

        // ═══════════════════════════════════════════════════
        // CEVAP KAĞIDI EKRANı — Optik form / bubble sheet
        // ═══════════════════════════════════════════════════
        function showCevapKagiديScreen() {
            hideAllScreens();
            const questionCount = currentTest.questions.length;
            // Seçenek sayısı: DB'den gelen option_count, yoksa default 4
            const optCount = parseInt(currentTest.option_count) || 4;
            const allOpts = ['A','B','C','D','E'];
            const opts = allOpts.slice(0, optCount);

            const screen = document.getElementById('cevapKagiديScreen');
            screen.classList.remove('hidden');

            document.getElementById('ckTestTitle').textContent = currentTest.title;
            document.getElementById('ckQuestionCount').textContent = questionCount + ' Soru · ' + opts.join('/') + ' seçenekli';

            // Header seçenek harflerini dinamik doldur
            const headerOpts = document.getElementById('ckHeaderOpts');
            if (headerOpts) {
                headerOpts.innerHTML = opts.map(o =>
                    `<span class="ck-header-opt">${o}</span>`
                ).join('')
            }

            // Cevap kağıdına özel zamanlayıcı
            if (testTimer) clearInterval(testTimer);
            timeRemaining = currentTest.time_limit * 60;
            function updateCkTimer() {
                const m = Math.floor(timeRemaining / 60);
                const s = timeRemaining % 60;
                const el = document.getElementById('ckTimerDisplay');
                if (el) el.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
                if (timeRemaining <= 60 && el) el.classList.add('text-red-600');
                else if (el) el.classList.remove('text-red-600');
            }
            updateCkTimer();
            testTimer = setInterval(() => {
                timeRemaining--;
                updateCkTimer();
                if (timeRemaining <= 0) {
                    clearInterval(testTimer);
                    submitCevapKagidi();
                }
            }, 1000);

            const list = document.getElementById('ckBubbleList');
            list.innerHTML = '';
            currentCKAnswers = {};

            for (let i = 0; i < questionCount; i++) {
                const row = document.createElement('div');
                row.className = 'ck-row';
                row.innerHTML = `
                    <span class="ck-num">${i + 1}.</span>
                    <div class="ck-options">
                        ${opts.map(opt => `
                            <label class="ck-bubble-label">
                                <input type="radio" name="ck_q${i}" value="${opt}" onchange="onCevapKagiديSelect(${i}, '${opt}')">
                                <span class="ck-bubble">${opt}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
                list.appendChild(row);
            }
            updateCkProgress();
        }

        function onCevapKagiديSelect(questionIndex, option) {
            currentCKAnswers[questionIndex] = option;
            updateCkProgress();
        }

        function updateCkProgress() {
            if (!currentTest) return;
            const total = currentTest.questions.length;
            const answered = Object.keys(currentCKAnswers).length;
            const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
            const bar = document.getElementById('ckProgressBar');
            const label = document.getElementById('ckProgressLabel');
            if (bar) bar.style.width = pct + '%';
            if (label) label.textContent = answered + ' / ' + total + ' cevaplandı';
        }

        async function submitCevapKagidi() {
            if (!currentTest) return;
            const total = currentTest.questions.length;
            const answered = Object.keys(currentCKAnswers).length;
            const unanswered = total - answered;

            if (unanswered > 0) {
                const ok = await showMobileConfirmDialog({
                    title: '⚠️ Boş Soru Var',
                    message: `${unanswered} soru boş bırakıldı.`,
                    warning: 'Boş sorular yanlış sayılmaz ama puana katkısı olmaz.',
                    question: 'Yine de göndermek istiyor musunuz?',
                    confirmLabel: '✅ Evet, Gönder'
                });
                if (!ok) return;
            }

            const optCount = parseInt(currentTest.option_count) || 4;
            const allOpts = ['A','B','C','D','E'];
            const opts = allOpts.slice(0, optCount);
            const optionMap = {};
            opts.forEach((o, i) => { optionMap[o] = i; });
            const revMap = opts; // index → harf
            let totalPoints = 0, earnedPoints = 0, correctAnswers = 0, wrongAnswers = 0, emptyAnswers = 0;

            // soruAnaliz: toggleOptikFormTable ve renderOptikSoruAnaliz'in beklediği format
            const soruAnaliz = currentTest.questions.map((question, index) => {
                const pts = question.points || 5;
                totalPoints += pts;
                const userOpt = currentCKAnswers[index]; // 'A','B','C','D' veya undefined
                const dogruCevap = revMap[question.correct] || '?';

                if (userOpt === undefined) {
                    emptyAnswers++;
                    return { soruNo: index + 1, ogrenciCevap: '', dogruCevap, sonuc: 'bos' };
                }
                const userIdx = optionMap[userOpt];
                const isCorrect = userIdx === question.correct;
                if (isCorrect) { correctAnswers++; earnedPoints += pts; return { soruNo: index + 1, ogrenciCevap: userOpt, dogruCevap, sonuc: 'dogru' }; }
                else { wrongAnswers++; return { soruNo: index + 1, ogrenciCevap: userOpt, dogruCevap, sonuc: 'yanlis' }; }
            });

            const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

            // showTestResult için currentTest'i hazırla
            currentTest.answers = {};
            currentTest.questions.forEach((_, index) => {
                const userOpt = currentCKAnswers[index];
                if (userOpt !== undefined) currentTest.answers[index] = optionMap[userOpt];
            });
            currentTest._isCevapKagidi = true;
            currentTest._ckAnswers = { ...currentCKAnswers };

            if (testTimer) clearInterval(testTimer);

            // ── Önce sonucu göster ────────────────────────────────────────
            showTestResult(score, correctAnswers, total, earnedPoints, totalPoints);

            // ── Arka planda kaydet ────────────────────────────────────────
            try {
                const { data: existing } = await supabase
                    .from('test_results').select('id')
                    .eq('student_id', currentUser.id).eq('test_id', currentTest.id).maybeSingle();
                if (existing) {
                    console.warn('Cevap kağıdı zaten kaydedilmiş.');
                    return;
                }

                const { error } = await supabase.from('test_results').insert({
                    student_id: currentUser.id,
                    test_id: currentTest.id,
                    score: score,
                    answers: JSON.stringify({
                        kaynak: 'optik_form',
                        answers: currentCKAnswers,
                        soruAnaliz,
                        dogru: correctAnswers,
                        yanlis: wrongAnswers,
                        bos: emptyAnswers,
                        earnedPoints, totalPoints, correctAnswers,
                        totalQuestions: total
                    }),
                    completed_at: new Date().toISOString()
                });
                if (error) {
                    console.error('Cevap kağıdı kayıt hatası:', error);
                    showNotification('⚠️ Sonuç kaydedilemedi: ' + error.message, 'error');
                    return;
                }

                awardBadges(score, Math.floor((new Date() - (currentTest.startTime || new Date())) / 1000))
                    .catch(e => console.warn('Rozet hatası:', e));

            } catch (err) {
                console.error('submitCevapKagidi arka plan hatası:', err);
                showNotification('⚠️ Sonuç kaydedilemedi: ' + err.message, 'error');
            }
        }

        // Show test screen
        function showTestScreen() {
            hideAllScreens();
            document.getElementById('testScreen').classList.remove('hidden');
            
            document.getElementById('testTitle').textContent = currentTest.title;
            document.getElementById('testDescription').textContent = currentTest.description || '';
            
            // Hide text in question screen (text was already shown separately)
            const readingTextColumn = document.getElementById('readingTextColumn');
            const questionColumn = document.getElementById('questionColumn');
            const testLayout = document.getElementById('testLayout');
            
            readingTextColumn.classList.add('hidden');
            questionColumn.className = 'col-span-full';
            testLayout.className = 'grid grid-cols-1 gap-6';
            
            // Reset font size to default
            currentFontSize = 16;
            document.getElementById('fontSizeIndicator').textContent = '16px';
        }

        // Show test screen with text visible alongside questions
        function showTestScreenWithText() {
            hideAllScreens();
            document.getElementById('testScreen').classList.remove('hidden');
            
            document.getElementById('testTitle').textContent = currentTest.title;
            document.getElementById('testDescription').textContent = currentTest.description || '';
            
            // Show text alongside questions
            const readingTextColumn = document.getElementById('readingTextColumn');
            const questionColumn = document.getElementById('questionColumn');
            const testLayout = document.getElementById('testLayout');
            
            readingTextColumn.classList.remove('hidden');
            questionColumn.className = 'lg:col-span-2';
            testLayout.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6';
            
            // Populate reading text
            document.getElementById('textContent').textContent = currentTest.reading_text;
            
            // Reset font size to default
            currentFontSize = 16;
            document.getElementById('fontSizeIndicator').textContent = '16px';
            
            // Start timer and display first question
            startTimer(currentTest.time_limit * 60);
            displayQuestion();
        }

        // Start question timer with custom time limit
        function startQuestionTimer() {
            if (questionTimer) clearInterval(questionTimer);
            
            // Get current question's time limit (default to 75 if not set)
            const currentQuestion = currentTest.questions[currentTest.currentQuestion];
            questionTimeRemaining = currentQuestion.timeLimit || 75;
            
            console.log(`Starting timer for question ${currentTest.currentQuestion + 1}: ${questionTimeRemaining} seconds`);
            
            updateQuestionTimerDisplay();
            
            questionTimer = setInterval(() => {
                questionTimeRemaining--;
                updateQuestionTimerDisplay();
                
                if (questionTimeRemaining <= 0) {
                    clearInterval(questionTimer);
                    // Auto advance to next question when time runs out
                    nextQuestion();
                }
            }, 1000);
        }

        // Update question timer display
        function updateQuestionTimerDisplay() {
            const timerEl = document.getElementById('questionTimer');
            timerEl.textContent = questionTimeRemaining;
            
            // Change color based on remaining time
            if (questionTimeRemaining <= 15) {
                timerEl.className = 'text-2xl font-bold text-red-600 mb-1 animate-pulse';
            } else if (questionTimeRemaining <= 30) {
                timerEl.className = 'text-2xl font-bold text-yellow-600 mb-1';
            } else {
                timerEl.className = 'text-2xl font-bold text-green-600 mb-1';
            }
        }

        // Font size control
        function changeFontSize(direction) {
            const currentIndex = fontSizes.indexOf(currentFontSize);
            let newIndex = currentIndex + direction;
            
            // Clamp to valid range
            newIndex = Math.max(0, Math.min(fontSizes.length - 1, newIndex));
            currentFontSize = fontSizes[newIndex];
            
            // Update font size indicator
            document.getElementById('fontSizeIndicator').textContent = `${currentFontSize}px`;
            
            // Apply font size to question text
            document.getElementById('questionText').style.fontSize = `${currentFontSize + 4}px`;
            
            // Apply to answer options
            const answerOptions = document.querySelectorAll('#answerOptions label span, #answerOptions input');
            answerOptions.forEach(el => {
                if (el.tagName === 'SPAN') {
                    el.style.fontSize = `${currentFontSize}px`;
                } else if (el.tagName === 'INPUT') {
                    el.style.fontSize = `${currentFontSize}px`;
                }
            });
        }

        // Display current question with specialized designs
        function displayQuestion() {
            const question = currentTest.questions[currentTest.currentQuestion];
            const questionNumber = currentTest.currentQuestion + 1;
            const totalQuestions = currentTest.questions.length;
            
            console.log('Displaying question:', questionNumber, 'of', totalQuestions, question);
            
            // Update progress - ensure correct total is shown
            document.getElementById('currentQuestionNumber').textContent = questionNumber;
            document.getElementById('progressText').textContent = `Soru ${questionNumber}/${totalQuestions}`;
            document.getElementById('progressBar').style.width = `${(questionNumber / totalQuestions) * 100}%`;
            
            // Set question type badge
            const typeMap = {
                'multiple_choice': { text: 'Çoktan Seçmeli', color: 'bg-blue-100 text-blue-800' },
                'fill_blank': { text: 'Boşluk Doldurma', color: 'bg-yellow-100 text-yellow-800' },
                'true_false': { text: 'Doğru/Yanlış', color: 'bg-green-100 text-green-800' }
            };
            const typeInfo = typeMap[question.type] || { text: 'Bilinmeyen', color: 'bg-gray-100 text-gray-800' };
            document.getElementById('questionType').textContent = typeInfo.text;
            document.getElementById('questionType').className = `px-3 py-1 rounded-full text-sm font-medium ${typeInfo.color}`;
            
            // Always set question text first, regardless of type
            document.getElementById('questionText').textContent = question.question || 'Soru metni bulunamadı';
            
            // Display answer options with specialized designs
            const optionsContainer = document.getElementById('answerOptions');
            optionsContainer.innerHTML = '';
            
            if (question.type === 'multiple_choice') {
                // A) Çoktan Seçmeli Sorular (3 Seçenekli)
                console.log('Rendering multiple choice question with options:', question.options);
                
                const availableOptions = question.options || [];
                
                availableOptions.forEach((option, index) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'mb-4';
                    
                    // Clean the option text by removing any existing letter prefixes
                    const cleanOption = option.replace(/^[A-Z]\)\s*/, '').trim();
                    const isSelected = currentTest.answers[currentTest.currentQuestion] == index;
                    
                    const letter = String.fromCharCode(65 + index);
                    
                    optionDiv.innerHTML = `
                        <div class="option-choice p-5 border-2 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'} rounded-xl hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all duration-200" 
                             onclick="selectMultipleChoice(${index})">
                            <div class="flex items-start space-x-4">
                                <div class="option-circle w-12 h-12 rounded-full border-2 ${isSelected ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-300 bg-white text-gray-600'} flex items-center justify-center font-bold text-lg flex-shrink-0 mt-1">
                                    ${letter}
                                </div>
                                <div class="option-text flex-1 min-w-0">
                                    <span class="text-lg font-medium text-gray-800 leading-relaxed block break-words">${cleanOption}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    optionsContainer.appendChild(optionDiv);
                });
                
            } else if (question.type === 'fill_blank') {
                // B) Boşluk Doldurma Soruları
                // Create interactive sentence with clickable blank
                const blankId = 'fillBlank_' + currentTest.currentQuestion;
                const selectedWord = currentTest.answers[currentTest.currentQuestion] || '';
                
                const sentenceWithBlank = question.question.replace(/___+/g, 
                    `<span id="${blankId}" class="inline-block min-w-[120px] px-3 py-1 mx-1 border-2 border-dashed border-gray-400 rounded cursor-pointer text-center font-semibold ${selectedWord ? 'bg-yellow-200 border-yellow-400' : 'bg-gray-100'}">${selectedWord || '[___]'}</span>`
                );
                
                document.getElementById('questionText').innerHTML = sentenceWithBlank;
                
                // Word options below the sentence
                const wordOptions = question.options || ['kelime1', 'kelime2', 'kelime3'];
                optionsContainer.innerHTML = `
                    <div class="mt-8">
                        <p class="text-sm font-medium text-gray-700 mb-4">Boşluğa uygun kelimeyi seçin:</p>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            ${wordOptions.map((word, index) => `
                                <div class="word-option p-3 border-2 border-gray-200 rounded-lg hover:border-yellow-400 hover:bg-yellow-50 cursor-pointer transition-all duration-200 text-center font-medium ${currentTest.answers[currentTest.currentQuestion] === word ? 'border-yellow-400 bg-yellow-100' : ''}"
                                     onclick="selectFillBlankWord('${word}', '${blankId}')">
                                    ${word}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                
            } else if (question.type === 'true_false') {
                // C) Doğru/Yanlış Soruları
                document.getElementById('questionText').textContent = question.question || 'Soru metni bulunamadı';
                
                optionsContainer.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div class="true-false-option p-8 border-3 border-green-200 rounded-2xl hover:border-green-400 hover:bg-green-50 cursor-pointer transition-all duration-200 text-center ${currentTest.answers[currentTest.currentQuestion] === 'true' ? 'border-green-500 bg-green-100 shadow-lg' : ''}"
                             onclick="selectTrueFalse('true')">
                            <div class="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4 mx-auto ${currentTest.answers[currentTest.currentQuestion] === 'true' ? 'ring-4 ring-green-300 shadow-lg' : ''}">
                                <i class="fas fa-check text-3xl text-white"></i>
                            </div>
                            <span class="text-2xl font-bold text-green-700">DOĞRU</span>
                        </div>
                        <div class="true-false-option p-8 border-3 border-red-200 rounded-2xl hover:border-red-400 hover:bg-red-50 cursor-pointer transition-all duration-200 text-center ${currentTest.answers[currentTest.currentQuestion] === 'false' ? 'border-red-500 bg-red-100 shadow-lg' : ''}"
                             onclick="selectTrueFalse('false')">
                            <div class="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mb-4 mx-auto ${currentTest.answers[currentTest.currentQuestion] === 'false' ? 'ring-4 ring-red-300 shadow-lg' : ''}">
                                <i class="fas fa-times text-3xl text-white"></i>
                            </div>
                            <span class="text-2xl font-bold text-red-700">YANLIŞ</span>
                        </div>
                    </div>
                `;
            }
            
            // Start question timer (75 seconds)
            startQuestionTimer();
            
            // Update navigation - only next button
            const nextButton = document.getElementById('nextButton');
            if (currentTest.currentQuestion === totalQuestions - 1) {
                nextButton.innerHTML = 'Testi Bitir <i class="fas fa-flag-checkered ml-2"></i>';
                nextButton.className = 'px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 text-lg font-semibold';
            } else {
                nextButton.innerHTML = 'İleri <i class="fas fa-arrow-right ml-2"></i>';
                nextButton.className = 'px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 text-lg font-semibold';
            }
        }

        // Interaction functions for different question types
        function selectMultipleChoice(index) {
            currentTest.answers[currentTest.currentQuestion] = index;
            
            // Update visual selection without changing layout
            const options = document.querySelectorAll('.option-choice');
            options.forEach((option, i) => {
                const circle = option.querySelector('.option-circle');
                const container = option.querySelector('.option-container');
                
                if (i === index) {
                    // Selected state - only change colors, not layout
                    option.classList.remove('border-gray-200', 'bg-white');
                    option.classList.add('border-blue-500', 'bg-blue-50');
                    
                    circle.classList.remove('border-gray-300', 'bg-white', 'text-gray-600');
                    circle.classList.add('border-blue-500', 'bg-blue-500', 'text-white');
                } else {
                    // Unselected state
                    option.classList.remove('border-blue-500', 'bg-blue-50');
                    option.classList.add('border-gray-200', 'bg-white');
                    
                    circle.classList.remove('border-blue-500', 'bg-blue-500', 'text-white');
                    circle.classList.add('border-gray-300', 'bg-white', 'text-gray-600');
                }
            });
        }

        function selectFillBlankWord(word, blankId) {
            currentTest.answers[currentTest.currentQuestion] = word;
            
            // Update the blank in the sentence with yellow highlight
            const blankElement = document.getElementById(blankId);
            blankElement.textContent = word;
            blankElement.className = 'inline-block min-w-[120px] px-3 py-1 mx-1 border-2 border-yellow-400 bg-yellow-200 rounded cursor-pointer text-center font-semibold';
            
            // Update word option selection
            const wordOptions = document.querySelectorAll('.word-option');
            wordOptions.forEach(option => {
                if (option.textContent.trim() === word) {
                    option.className = 'word-option p-3 border-2 border-yellow-400 bg-yellow-100 rounded-lg cursor-pointer transition-all duration-200 text-center font-medium';
                } else {
                    option.className = 'word-option p-3 border-2 border-gray-200 rounded-lg hover:border-yellow-400 hover:bg-yellow-50 cursor-pointer transition-all duration-200 text-center font-medium';
                }
            });
        }

        function selectTrueFalse(value) {
            currentTest.answers[currentTest.currentQuestion] = value;
            
            // Update visual selection
            const trueOption = document.querySelector('.true-false-option:first-child');
            const falseOption = document.querySelector('.true-false-option:last-child');
            const trueCircle = trueOption.querySelector('div');
            const falseCircle = falseOption.querySelector('div');
            
            if (value === 'true') {
                trueOption.className = 'true-false-option p-8 border-3 border-green-500 bg-green-100 shadow-lg rounded-2xl cursor-pointer transition-all duration-200 text-center';
                trueCircle.className = 'w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4 mx-auto ring-4 ring-green-300 shadow-lg';
                falseOption.className = 'true-false-option p-8 border-3 border-red-200 rounded-2xl hover:border-red-400 hover:bg-red-50 cursor-pointer transition-all duration-200 text-center';
                falseCircle.className = 'w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mb-4 mx-auto';
            } else {
                falseOption.className = 'true-false-option p-8 border-3 border-red-500 bg-red-100 shadow-lg rounded-2xl cursor-pointer transition-all duration-200 text-center';
                falseCircle.className = 'w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mb-4 mx-auto ring-4 ring-red-300 shadow-lg';
                trueOption.className = 'true-false-option p-8 border-3 border-green-200 rounded-2xl hover:border-green-400 hover:bg-green-50 cursor-pointer transition-all duration-200 text-center';
                trueCircle.className = 'w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4 mx-auto';
            }
        }

        // Save current answer (legacy support)
        function saveCurrentAnswer() {
            // Answer is already saved by the interaction functions above
            // This function is kept for compatibility
        }

        // Next question (only forward navigation)
        function nextQuestion() {
            saveCurrentAnswer();
            
            // Clear question timer
            if (questionTimer) clearInterval(questionTimer);
            
            if (currentTest.currentQuestion === currentTest.questions.length - 1) {
                submitTest();
            } else {
                currentTest.currentQuestion++;
                displayQuestion();
            }
        }

        // Submit test
        async function submitTest() {
            if (questionTimer) clearInterval(questionTimer);
            if (testTimer) clearInterval(testTimer);

            saveCurrentAnswer();

            // ── Puanı hesapla ─────────────────────────────────────────────
            let totalPoints = 0;
            let earnedPoints = 0;
            let correctAnswers = 0;

            currentTest.questions.forEach((question, index) => {
                const userAnswer = currentTest.answers[index];
                const questionPoints = question.points || 5;
                totalPoints += questionPoints;

                let isCorrect = false;

                if (question.type === 'multiple_choice') {
                    isCorrect = parseInt(userAnswer) === question.correct;
                } else if (question.type === 'fill_blank') {
                    if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
                        isCorrect = false;
                    } else if (question.options && question.options.length > 0 && !isNaN(parseInt(userAnswer)) && question.options[parseInt(userAnswer)] !== undefined) {
                        isCorrect = parseInt(userAnswer) === parseInt(question.correct);
                    } else {
                        isCorrect = String(userAnswer).trim().toLowerCase() === String(question.correct).trim().toLowerCase();
                    }
                } else if (question.type === 'true_false') {
                    let userAnswerBool = (userAnswer === 'true' || userAnswer === true);
                    let correctAnswerBool = (question.correct === 'true' || question.correct === true);
                    isCorrect = (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') && userAnswerBool === correctAnswerBool;
                }

                if (isCorrect) {
                    correctAnswers++;
                    earnedPoints += questionPoints;
                }
            });

            const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
            const totalQuestions = currentTest.questions.length;

            // ── Sonucu önce göster, sonra kaydet ─────────────────────────
            // Böylece kayıt hatası olsa bile öğrenci sonucunu görür.
            showTestResult(score, correctAnswers, totalQuestions, earnedPoints, totalPoints);

            // ── Arka planda Supabase'e kaydet ────────────────────────────
            try {
                // Daha önce kaydedilmiş mi?
                const { data: existing } = await supabase
                    .from('test_results')
                    .select('id')
                    .eq('student_id', currentUser.id)
                    .eq('test_id', currentTest.id)
                    .maybeSingle();

                if (existing) {
                    console.warn('Test zaten kaydedilmiş, tekrar kaydedilmedi.');
                    return;
                }

                const { error } = await supabase
                    .from('test_results')
                    .insert({
                        student_id: currentUser.id,
                        test_id: currentTest.id,
                        score: score,
                        answers: JSON.stringify({
                            answers: currentTest.answers,
                            earnedPoints,
                            totalPoints,
                            correctAnswers,
                            totalQuestions
                        }),
                        completed_at: new Date().toISOString()
                    });

                if (error) {
                    console.error('Kayıt hatası:', error);
                    showNotification('⚠️ Sonuç kaydedilirken hata oluştu: ' + error.message, 'error');
                    return;
                }

                console.log('Test sonucu başarıyla kaydedildi.');

                // Rozetleri arka planda ver
                const testDuration = Math.floor((new Date() - (currentTest.startTime || new Date())) / 1000);
                awardBadges(score, testDuration).catch(e => console.warn('Rozet hatası:', e));

            } catch (err) {
                console.error('submitTest arka plan hatası:', err);
                showNotification('⚠️ Sonuç kaydedilemedi: ' + (err.message || 'Bilinmeyen hata'), 'error');
            }
        }

        // Award badges
        async function awardBadges(score, testDuration) {
            try {
                // Get current student stats - en son sonuçları al, deduplicate et
                const { data: rawBadgeResults } = await supabase
                    .from('test_results')
                    .select('*')
                    .eq('student_id', currentUser.id)
                    .order('completed_at', { ascending: false });

                // Her test için sadece en son sonucu say
                const seenKeysBadge = new Set();
                const results = (rawBadgeResults || []).filter(r => {
                    if (seenKeysBadge.has(r.test_id)) return false;
                    seenKeysBadge.add(r.test_id);
                    return true;
                });

                const { data: existingBadges } = await supabase
                    .from('student_badges')
                    .select('*')
                    .eq('student_id', currentUser.id);

                const totalTestCount = results?.length || 0;
                const successfulTestCount = results?.filter(r => r.score >= 70).length || 0;
                const hasHighScore = results?.some(r => r.score >= 90) || false;
                const hasPerfectScore = results?.some(r => r.score === 100) || false;
                const newBadges = [];
                const existingBadgeTypes = existingBadges?.map(b => b.badge_type) || [];

                // Check for new badges - using successful test count for most badges
                const badgeChecks = [
                    { type: 'first_step', condition: totalTestCount >= 1, name: '🐣 İlk Adım' },
                    { type: 'bright_star', condition: score >= 90, name: '🌈 Parlak Yıldız' },
                    { type: 'perfect_hit', condition: score === 100, name: '🥇 Tam İsabet' },
                    { type: 'speed_fingers', condition: testDuration && currentTest && (testDuration / currentTest.questions.length) < 30, name: '⚡ Hızlı Parmaklar' },
                    { type: 'patient_hero', condition: successfulTestCount >= 5, name: '🐢 Sabırlı Kahraman' },
                    { type: 'super_student', condition: successfulTestCount >= 10, name: '🦸 Süper Öğrenci' },
                    { type: 'knowledge_dragon', condition: successfulTestCount >= 25, name: '🐉 Bilgi Ejderhası' },
                    { type: 'shining_mind', condition: successfulTestCount >= 50, name: '🌟 Parlayan Zihin' },
                    { type: 'class_leader', condition: successfulTestCount >= 100, name: '👑 Sınıf Lideri' },
                    { type: 'book_worm', condition: successfulTestCount >= 150, name: '📚🐛 Kitap Kurdu' }
                ];

                for (const badge of badgeChecks) {
                    if (badge.condition && !existingBadgeTypes.includes(badge.type)) {
                        newBadges.push({
                            student_id: currentUser.id,
                            badge_type: badge.type,
                            earned_at: new Date().toISOString()
                        });
                    }
                }

                // Insert new badges
                if (newBadges.length > 0) {
                    const { error } = await supabase
                        .from('student_badges')
                        .insert(newBadges);
                    
                    if (error) throw error;

                    // Show badge notification
                    setTimeout(() => {
                        newBadges.forEach((badge, index) => {
                            setTimeout(() => {
                                const badgeName = badgeChecks.find(b => b.type === badge.badge_type)?.name;
                                showBadgeNotification(badgeName);
                            }, index * 1000);
                        });
                    }, 2000);
                }

                return newBadges;

            } catch (error) {
                console.error('Error awarding badges:', error);
                return [];
            }
        }

        // Show test result (Yeni testResultScreen elementini kullanır)
        function showTestResult(score, correct, total, earnedPoints = null, totalPoints = null) {
            console.log('showTestResult triggered:', { score, correct, total, earnedPoints, totalPoints });
            
            if (window._trsTimer) { clearInterval(window._trsTimer); window._trsTimer = null; }

            // Ekranları gizle
            ['testScreen', 'textReadingScreen', 'cevapKagiديScreen'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            
            const studentDash = document.getElementById('studentDashboard');
            if (studentDash) studentDash.classList.remove('hidden');

            const screen = document.getElementById('testResultScreen');
            if (!screen) {
                console.error('testResultScreen element not found!');
                alert('Test tamamlandı! Puanınız: %' + score);
                return;
            }

            const passed = score >= 70;
            let startTime = new Date();
            if (currentTest && currentTest.startTime) {
                startTime = new Date(currentTest.startTime);
            }
            
            const testDuration = Math.floor((new Date() - startTime) / 1000);
            const minutes = Math.floor(testDuration / 60);
            const seconds = testDuration % 60;
            const displayEarnedPoints = earnedPoints !== null ? earnedPoints : (correct * 5);
            const displayTotalPoints = totalPoints !== null ? totalPoints : (total * 5);

            // Soru detaylarını oluştur
            let detailsHtml = '';
            try {
                if (currentTest && currentTest.questions) {
                    detailsHtml = currentTest.questions.map((question, index) => {
                        const userAnswer = currentTest.answers ? currentTest.answers[index] : undefined;
                        const questionPoints = question.points || 5;
                        let isCorrect = false;
                        let typeLabel = 'Soru';

                        if (currentTest._isCevapKagidi) {
                            const ckOptCount = parseInt(currentTest.option_count) || 4;
                            const revMap = ['A','B','C','D','E'].slice(0, ckOptCount);
                            const optMap = {};
                            revMap.forEach((o,i) => { optMap[o] = i; });
                            const userOpt = currentTest._ckAnswers ? currentTest._ckAnswers[index] : undefined;
                            const userIdx2 = userOpt !== undefined ? optMap[userOpt] : undefined;
                            isCorrect = userIdx2 !== undefined && userIdx2 === question.correct;
                            typeLabel = 'Cevap Kağıdı';
                        } else {
                            if (question.type === 'multiple_choice') {
                                isCorrect = parseInt(userAnswer) === question.correct;
                                typeLabel = 'Çoktan Seçmeli';
                            } else if (question.type === 'fill_blank') {
                                if (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') {
                                    if (question.options && question.options.length > 0 && !isNaN(parseInt(userAnswer))) {
                                        isCorrect = parseInt(userAnswer) === parseInt(question.correct);
                                    } else {
                                        isCorrect = String(userAnswer).trim().toLowerCase() === String(question.correct).trim().toLowerCase();
                                    }
                                }
                                typeLabel = 'Boşluk Doldurma';
                            } else if (question.type === 'true_false') {
                                isCorrect = (userAnswer === 'true' || userAnswer === true) === (question.correct === 'true' || question.correct === true);
                                typeLabel = 'Doğru/Yanlış';
                            }
                        }

                        return `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem; margin-bottom:0.5rem; border-radius:0.5rem; background:${isCorrect ? '#f0fdf4' : '#fef2f2'}; border:1px solid ${isCorrect ? '#bbf7d0' : '#fecaca'};">
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <span style="font-size:0.875rem; font-weight:500; color:${isCorrect ? '#15803d' : '#b91c1c'};">
                                        ${isCorrect ? '✅' : '❌'} Soru ${index + 1}
                                    </span>
                                    <span style="font-size:0.75rem; color:#6b7280;">(${typeLabel})</span>
                                </div>
                                <div style="font-size:0.875rem; font-weight:600; color:${isCorrect ? '#15803d' : '#b91c1c'};">
                                    ${isCorrect ? questionPoints : 0}/${questionPoints}
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            } catch (e) {
                console.error('Error generating details HTML:', e);
                detailsHtml = '<p style="color:red;">Soru detayları yüklenemedi.</p>';
            }

            screen.innerHTML = `
                <div style="background:white; width:100%; max-width:500px; border-radius:1rem; padding:2rem; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); text-align:center; margin:auto; position:relative; z-index:100000;">
                    <div style="width:80px; height:80px; margin:0 auto 1.5rem; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${passed ? 'linear-gradient(to bottom right, #4ade80, #16a34a)' : 'linear-gradient(to bottom right, #fb923c, #ef4444)'}; color:white; font-size:2rem; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
                        <i class="fas ${passed ? 'fa-trophy' : 'fa-exclamation-triangle'}"></i>
                    </div>
                    <h3 style="font-size:1.5rem; font-weight:700; color:${passed ? '#16a34a' : '#ea580c'}; margin-bottom:0.5rem;">
                        ${passed ? '🎉 Tebrikler!' : '⚠️ Test Tamamlandı'}
                    </h3>
                    <div style="font-size:2.5rem; font-weight:800; color:${passed ? '#15803d' : '#b91c1c'}; margin-bottom:1rem;">
                        ${score}%
                    </div>
                    <p style="color:#4b5563; font-size:0.875rem; margin-bottom:1.5rem;">
                        ${passed ? 'Başarı puanına (%70+) ulaştınız!' : 'Başarı puanına ulaşamadınız.'}<br>
                        <span style="font-size:0.75rem; color:#9ca3af;">Süre: ${minutes}dk ${seconds}sn</span>
                    </p>

                    <div style="background:#f8fafc; border-radius:0.75rem; padding:1rem; margin-bottom:1.5rem; border:1px solid #e2e8f0;">
                        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:0.75rem;">
                            <div style="background:white; padding:0.75rem; border-radius:0.5rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                                <div style="font-size:1.25rem; font-weight:700; color:#9333ea;">${displayEarnedPoints}</div>
                                <div style="font-size:0.75rem; color:#6b7280;">Puan</div>
                            </div>
                            <div style="background:white; padding:0.75rem; border-radius:0.5rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                                <div style="font-size:1.25rem; font-weight:700; color:#16a34a;">${correct}/${total}</div>
                                <div style="font-size:0.75rem; color:#6b7280;">Doğru</div>
                            </div>
                        </div>
                    </div>

                    <div style="text-align:left; margin-bottom:1.5rem;">
                        <h4 style="font-size:0.875rem; font-weight:600; color:#1f2937; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
                            <i class="fas fa-list-check text-blue-600"></i> Soru Detayları
                        </h4>
                        <div style="max-height:150px; overflow-y:auto; padding-right:0.5rem;">
                            ${detailsHtml}
                        </div>
                    </div>

                    <button onclick="closeResultAndGoHome()" style="width:100%; background:#2563eb; color:white; font-weight:600; padding:0.75rem; border-radius:0.5rem; border:none; cursor:pointer; transition:background 0.2s; margin-bottom:1rem;">
                        Tamam, Paneline Dön
                    </button>

                    <div style="font-size:0.75rem; color:#9ca3af;">
                        <i class="fas fa-clock"></i> Otomatik kapanma: <span id="trsCountdown">120</span>s
                    </div>
                </div>
            `;

            screen.style.display = 'flex';
            console.log('testResultScreen should be visible now.');

            let remaining = 120;
            window._trsTimer = setInterval(() => {
                remaining--;
                const cd = document.getElementById('trsCountdown');
                if (cd) cd.textContent = remaining;
                if (remaining <= 0) {
                    closeResultAndGoHome();
                }
            }, 1000);
        }

        // Test sonucu modalını kapat ve ana sayfaya dön
        function closeResultAndGoHome() {
            if (window._trsTimer) {
                clearInterval(window._trsTimer);
                window._trsTimer = null;
            }
            const screen = document.getElementById('testResultScreen');
            if (screen) {
                screen.style.setProperty('display', 'none', 'important');
            }
            document.body.style.overflow = ''; // Kaydırmayı geri aç
            showStudentDashboard();
        }

        // Load teacher data - KESİN ÇÖZÜM İÇİN YENİDEN YAZILDI
        async function loadTeacherData() {
            try {
                // ── Tüm bağımsız sorgular PARALEL çalışır (Promise.all) ──────────
                const [
                    { data: students },
                    { data: tests },
                    { data: results },
                    { data: studentStats, error: statsError },
                    { data: allAssignments },
                ] = await Promise.all([
                    supabase.from('students').select('id'),
                    supabase.from('tests').select('id'),
                    supabase.from('test_results').select('score, completed_at, student_id, test_id'),
                    supabase.from('student_stats').select('weekly_count, monthly_count'),
                    supabase.from('test_assignments').select('test_id, student_id'),
                ]);

                if (statsError) console.error('Teacher Dashboard Stats Error:', statsError);

                // Özet kartları hemen güncelle
                document.getElementById('totalStudents').textContent = students?.length || 0;
                document.getElementById('activeTests').textContent = tests?.length || 0;

                const allResults = results || [];
                const avgSuccess = allResults.length > 0
                    ? Math.round(allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length)
                    : 0;
                document.getElementById('averageSuccess').textContent = `%${avgSuccess}`;

                const weeklyTotal  = studentStats?.reduce((s, x) => s + (x.weekly_count  || 0), 0) || 0;
                const monthlyTotal = studentStats?.reduce((s, x) => s + (x.monthly_count || 0), 0) || 0;
                if (document.getElementById('classWeeklyTotal'))  document.getElementById('classWeeklyTotal').textContent  = weeklyTotal;
                if (document.getElementById('classMonthlyTotal')) document.getElementById('classMonthlyTotal').textContent = monthlyTotal;

                // Global cache — alt fonksiyonlar tekrar sorgu atmaz
                window._cache = {
                    allResults,
                    allAssignments: allAssignments || [],
                };
                window.dashboardStudents = studentStats || [];
                window.dashboardResults  = allResults;

                // Alt bölümleri paralel yükle
                await Promise.all([
                    loadTestsList(),
                    loadStudentsList(),
                    loadResultsList(),
                    updatePerformanceTable(),
                ]);

                renderPerformanceCharts(allResults);
                updateLeaderboardUI();

            } catch (error) {
                console.error('Error loading teacher data:', error);
            }
        }

        function renderPerformanceCharts(results) {
            const ctx = document.getElementById('performanceChart');
            if (!ctx) return;
            
            if (window.myPerformanceChart) {
                window.myPerformanceChart.destroy();
            }

            const allResults = Array.isArray(results) ? results : [];
            const now = new Date();
            const days = [];
            const counts = [];
            
            // Son 7 günü hesapla
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                const dayName = d.toLocaleDateString('tr-TR', { weekday: 'short' });
                days.push(dayName);
                
                // O güne ait test sonuçlarını filtrele
                const count = allResults.filter(r => {
                    const dateStr = r.completed_at;
                    if (!dateStr) return false;
                    const rd = new Date(dateStr);
                    // Tarih karşılaştırmasını güvenli yap (UTC/Yerel saat farkını önlemek için)
                    return rd.getFullYear() === d.getFullYear() && 
                           rd.getMonth() === d.getMonth() && 
                           rd.getDate() === d.getDate();
                }).length;
                counts.push(count);
            }

            window.myPerformanceChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: days,
                    datasets: [{
                        label: 'Çözülen Test Sayısı',
                        data: counts,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        function updateLeaderboardUI() {
            const period = document.getElementById('leaderboardPeriod')?.value || 'weekly';
            const container = document.getElementById('leaderboardContent');
            if (!container || !window.dashboardStudents || !window.dashboardStudents.length) return;

            const ranking = window.dashboardStudents.map(s => {
                const count = period === 'weekly' ? (s.weekly_total_tests || 0) : (s.monthly_total_tests || 0);
                const name = s.student_name || s.name || 'İsimsiz Öğrenci';
                return { name: name, count: count };
            }).sort((a, b) => b.count - a.count).slice(0, 10);

            container.innerHTML = ranking.map((item, index) => `
                <div class="flex items-center justify-between p-2 rounded-lg ${index < 3 ? 'bg-yellow-50' : 'hover:bg-gray-50'}">
                    <div class="flex items-center">
                        <span class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-3 
                            ${index === 0 ? 'bg-yellow-400 text-white' : index === 1 ? 'bg-gray-300 text-white' : index === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'}">
                            ${index + 1}
                        </span>
                        <span class="text-sm font-medium text-gray-700 truncate max-w-[120px]">${item.name}</span>
                    </div>
                    <span class="text-sm font-bold text-blue-600">${item.count} Test</span>
                </div>
            `).join('') || '<p class="text-center text-gray-400 text-sm py-4">Veri bulunamadı.</p>';
        }

        
        // Student Performance Tracking Logic
        let performanceData = [];
        window.currentPerfSort = { column: 'total', order: 'desc' };

        function sortPerformanceBy(column) {
            if (window.currentPerfSort.column === column) {
                window.currentPerfSort.order = window.currentPerfSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                window.currentPerfSort.column = column;
                window.currentPerfSort.order = 'desc';
            }
            
            const periodSelect = document.getElementById('perfPeriodSelect');
            const period = periodSelect ? periodSelect.value : 'current_week';
            
            renderPerformanceTable(performanceData, period);
            updateSortIcons();
        }

        function updateSortIcons() {
            const headers = document.querySelectorAll('#performanceTableHeaderRow th');
            headers.forEach(th => {
                const col = th.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
                if (col) {
                    let icon = th.querySelector('.sort-icon');
                    if (!icon) {
                        icon = document.createElement('i');
                        icon.className = 'fas fa-sort ml-1 text-gray-400 text-xs sort-icon';
                        th.appendChild(icon);
                    }
                    
                    if (col === window.currentPerfSort.column) {
                        icon.className = `fas fa-sort-${window.currentPerfSort.order === 'asc' ? 'up' : 'down'} ml-1 text-blue-500 text-xs sort-icon`;
                    } else {
                        icon.className = 'fas fa-sort ml-1 text-gray-400 text-xs sort-icon';
                    }
                }
            });
        }

        async function updatePerformanceTable() {
            try {
                const periodSelect = document.getElementById('perfPeriodSelect');
                const sortOrderSelect = document.getElementById('perfSortOrder');
                
                const period = periodSelect ? periodSelect.value : 'current_week';
                const sortOrder = sortOrderSelect ? sortOrderSelect.value : 'desc';
                
                // Tablo başlığını periyoda göre güncelle
                const periodHeader = document.getElementById('periodTotalHeader');
                if (periodHeader) {
                    if (period === 'monthly') {
                        periodHeader.innerHTML = 'Aylık<br>Toplam';
                    } else {
                        periodHeader.innerHTML = 'Haftalık<br>Toplam';
                    }
                }
                
                // Fetch from new SQL View with weekly stats
                const { data, error } = await supabase
                    .from('student_all_period_stats')
                    .select('*');
                
                if (error) throw error;
                
                performanceData = data || [];
                
                // Clear loading state if it exists
                const tbody = document.getElementById('performanceTableBody');
                if (tbody) tbody.innerHTML = '';
                
                console.log('Updating performance table with period:', period, 'sortOrder:', sortOrder);
                
                // Set initial sort from dropdown if needed
                window.currentPerfSort.order = sortOrder;
                
                renderPerformanceTable(performanceData, period);
                updateSortIcons();
            } catch (error) {
                console.error('Error updating performance table:', error);
                const tbody = document.getElementById('performanceTableBody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="13" class="px-4 py-12 text-center text-red-400">Hata: ' + error.message + '</td></tr>';
                }
            }
        }

	        function renderPerformanceTable(data, period = 'current_week') {
	            const tbody = document.getElementById('performanceTableBody');
	            if (!tbody) return;

            // Podyumlar icin tablo verilerini global degiskene kaydet
            window.teacherPanelTableData = data;
            window.teacherPanelCurrentPeriod = period;
            
            // Podyumu otomatik güncelle
            if (typeof renderStarList === 'function') renderStarList();
            if (typeof renderTeacherStarList === 'function') renderTeacherStarList();

            const selectedPeriod = period;
            const sortCol = window.currentPerfSort.column;
            const sortOrder = window.currentPerfSort.order;

            // Sort data
            const sortedData = [...data].sort((a, b) => {
                let valA, valB;
                
                const prefix = selectedPeriod === 'last_week' ? 'last_' : (selectedPeriod === 'monthly' ? '' : 'current_');
                
                switch(sortCol) {
                    case 'name':
                        valA = (a.student_name || a.name || '').toLowerCase();
                        valB = (b.student_name || b.name || '').toLowerCase();
                        return sortOrder === 'asc' ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
                    case 'mon': valA = a[prefix + 'mon_total'] || 0; valB = b[prefix + 'mon_total'] || 0; break;
                    case 'tue': valA = a[prefix + 'tue_total'] || 0; valB = b[prefix + 'tue_total'] || 0; break;
                    case 'wed': valA = a[prefix + 'wed_total'] || 0; valB = b[prefix + 'wed_total'] || 0; break;
                    case 'thu': valA = a[prefix + 'thu_total'] || 0; valB = b[prefix + 'thu_total'] || 0; break;
                    case 'fri': valA = a[prefix + 'fri_total'] || 0; valB = b[prefix + 'fri_total'] || 0; break;
                    case 'sat': valA = a[prefix + 'sat_total'] || 0; valB = b[prefix + 'sat_total'] || 0; break;
                    case 'sun': valA = a[prefix + 'sun_total'] || 0; valB = b[prefix + 'sun_total'] || 0; break;
                    case 'total':
                        if (selectedPeriod === 'monthly') {
                            valA = a.monthly_total_tests || 0;
                            valB = b.monthly_total_tests || 0;
                        } else {
                            valA = a[prefix + 'weekly_total_tests'] || 0;
                            valB = b[prefix + 'weekly_total_tests'] || 0;
                        }
                        break;
                    case 'success':
                        if (selectedPeriod === 'monthly') {
                            valA = a.monthly_successful_tests || 0;
                            valB = b.monthly_successful_tests || 0;
                        } else {
                            valA = a[prefix + 'weekly_successful_tests'] || 0;
                            valB = b[prefix + 'weekly_successful_tests'] || 0;
                        }
                        break;
                    case 'failed':
                        if (selectedPeriod === 'monthly') {
                            valA = a.monthly_failed_tests || 0;
                            valB = b.monthly_failed_tests || 0;
                        } else {
                            valA = a[prefix + 'weekly_failed_tests'] || 0;
                            valB = b[prefix + 'weekly_failed_tests'] || 0;
                        }
                        break;
                    case 'status':
                        valA = a.reading_status || '';
                        valB = b.reading_status || '';
                        return sortOrder === 'asc' ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
                    case 'activity':
                        valA = a.activity_level || '';
                        valB = b.activity_level || '';
                        return sortOrder === 'asc' ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
                    default:
                        valA = 0; valB = 0;
                }
                
                return sortOrder === 'asc' ? valA - valB : valB - valA;
            });

	            const rows = sortedData.map((student, studentIdx) => {
                // DEBUG: İlk öğrenci (Zeyneb) için ham veriyi konsola yazdır
                if (studentIdx === 0) {
                    console.log('=== ZEYNEB HAM VERİ ===');
                    console.log('Tüm sütunlar:', Object.keys(student));
                    console.log('Tam nesne:', student);
                    console.log('======================');
                }
                
                // Periyoda göre toplam, başarılı ve hatalı sayılarını seç (rozetler için)
                
                let badgeTotal = 0;
                if (selectedPeriod === 'current_week') {
                    badgeTotal = student.current_weekly_total_tests || 0;
                } else if (selectedPeriod === 'last_week') {
                    badgeTotal = student.last_weekly_total_tests || 0;
                } else if (selectedPeriod === 'monthly') {
                    badgeTotal = student.monthly_total_tests || 0;
                }
                
                // Aktiflik Rozeti
                let activityBadge = '';
                if (badgeTotal >= 6) {
                    activityBadge = '<span class="activity-badge badge-very-active">🔥 Çok Aktif</span>';
                } else if (badgeTotal >= 4) {
                    activityBadge = '<span class="activity-badge badge-active">✅ Aktif</span>';
                } else {
                    activityBadge = '<span class="activity-badge badge-inactive">⚡ Harekete Geç</span>';
                }
                
                // Okuma Durumu
                let readingStatus = '';
                if (badgeTotal >= 6) {
                    readingStatus = '<span class="reading-status reading-on-track"><i class="fas fa-check-circle"></i>Hedefinde</span>';
                } else if (badgeTotal >= 4) {
                    readingStatus = '<span class="reading-status reading-on-track"><i class="fas fa-arrow-up"></i>İyi Gidiyor</span>';
                } else {
                    readingStatus = '<span class="reading-status reading-behind"><i class="fas fa-exclamation-circle"></i>Geride</span>';
                }
                
                // SQL View sütun isimlerini güvenli bir şekilde al
                const sName = student.student_name || student.name || 'İsimsiz Öğrenci';
                const sId = student.student_id || student.id;
                const sNo = student.student_no || '-';
                
                // Öğrenci Avatarı
                const initials = sName.split(' ').filter(n => n).map(n => n[0]).join('').toUpperCase().slice(0, 2);

	                let displayTotal = 0;
                let displaySuccess = 0;
                let displayFailed = 0;
                let daysMapToUse = {};
                
                if (selectedPeriod === 'current_week') {
                    displayTotal = student.current_weekly_total_tests || 0;
                    displaySuccess = student.current_weekly_successful_tests || 0;
                    displayFailed = student.current_weekly_failed_tests || 0;
                    daysMapToUse = {
                        0: { total: student.current_mon_total || 0 },
                        1: { total: student.current_tue_total || 0 },
                        2: { total: student.current_wed_total || 0 },
                        3: { total: student.current_thu_total || 0 },
                        4: { total: student.current_fri_total || 0 },
                        5: { total: student.current_sat_total || 0 },
                        6: { total: student.current_sun_total || 0 }
                    };
                } else if (selectedPeriod === 'last_week') {
                    displayTotal = student.last_weekly_total_tests || 0;
                    displaySuccess = student.last_weekly_successful_tests || 0;
                    displayFailed = student.last_weekly_failed_tests || 0;
                    daysMapToUse = {
                        0: { total: student.last_mon_total || 0 },
                        1: { total: student.last_tue_total || 0 },
                        2: { total: student.last_wed_total || 0 },
                        3: { total: student.last_thu_total || 0 },
                        4: { total: student.last_fri_total || 0 },
                        5: { total: student.last_sat_total || 0 },
                        6: { total: student.last_sun_total || 0 }
                    };
                } else if (selectedPeriod === 'monthly') {
                    displayTotal = student.monthly_total_tests || 0;
                    displaySuccess = student.monthly_successful_tests || 0;
                    displayFailed = student.monthly_failed_tests || 0;
                    daysMapToUse = {
                        0: { total: student.current_mon_total || 0 },
                        1: { total: student.current_tue_total || 0 },
                        2: { total: student.current_wed_total || 0 },
                        3: { total: student.current_thu_total || 0 },
                        4: { total: student.current_fri_total || 0 },
                        5: { total: student.current_sat_total || 0 },
                        6: { total: student.current_sun_total || 0 }
                    };
                }
                
                // Günlük Veriler (7 gün) - Her gün bağımsız olarak kontrol edilir
                const dailyHtml = Object.entries(daysMapToUse).map(([idx, dayData]) => {
                    let pillClass = 'empty';
                    let content = '-';
                    
                    // Veritabanından gelen ham verileri sayıya çevir (null/undefined kontrolü)
                    const dTotal = parseInt(dayData.total) || 0;
                    
                    // Her gün için bağımsız kontrol: if/else ile her gün ayrı ayrı değerlendir
                    if (dTotal === 0) {
                        // Gün boş - veri yok
                        pillClass = 'empty';
                        content = '-';
                    } else if (displayFailed > 0) {
                        // DURUM 1: Haftalık toplamda hata varsa, test çözülen günleri KIRMIZI yap (Örn: Zeyneb Pzt/Sal)
                        pillClass = 'failed';
                        content = `${dTotal} ✕`;
                    } else if (displaySuccess > 0 && displayFailed === 0) {
                        // DURUM 2: Haftalık toplamda hata yoksa ve test çözülmüşse YEŞİL yap (Örn: Zeyneb Cmt/Paz)
                        pillClass = 'success';
                        content = `${dTotal} ✓`;
                    } else {
                        // Diğer durumlar
                        pillClass = 'success';
                        content = `${dTotal} ✓`;
                    }
                    return `<td><span class="day-pill ${pillClass}">${content}</span></td>`;
                }).join('');
                
                return `
                    <tr onclick="impersonateStudent('${sId}', '${sName.replace(/'/g, "\'")}')">  
                        <td>
                            <div class="student-name-cell">
                                <div class="student-avatar">${initials}</div>
                                <div>
                                    <div style="font-weight: 600; color: #1f2937;">${sName}</div>
                                    <div style="font-size: 10px; color: #9ca3af;">No: ${sNo}</div>
                                </div>
                            </div>
                        </td>
                        ${dailyHtml}
                        <td><strong>${displayTotal}</strong></td>
                        <td><strong style="color: #10b981;">${displaySuccess}</strong></td>
                        <td><strong style="color: #ef4444;">${displayFailed}</strong></td>
                        <td>${readingStatus}</td>
                        <td>${activityBadge}</td>
                    </tr>
                `;
            });
            
            tbody.innerHTML = rows.join('') || '<tr><td colspan="13" class="px-4 py-12 text-center text-gray-400">Eşleşen öğrenci bulunamadı.</td></tr>';
        }

        function filterPerformanceTable() {
            const searchTerm = document.getElementById('perfSearchInput').value.toLowerCase();
            const periodSelect = document.getElementById('perfPeriodSelect');
            const sortOrderSelect = document.getElementById('perfSortOrder');
            
            const period = periodSelect ? periodSelect.value : 'current_week';
            const sortOrder = sortOrderSelect ? sortOrderSelect.value : 'desc';
            
            const filtered = performanceData.filter(s => 
                ((s.student_name || s.name || '').toLowerCase().includes(searchTerm)) || 
                ((s.student_no || '').toString().includes(searchTerm)) ||
                ((s.class || '').toLowerCase().includes(searchTerm))
            );
            
            renderPerformanceTable(filtered, period, sortOrder);
        }


        // Tab functions
        function showTab(tabName) {
            // Student tabs
            const tabs = ['tests', 'badges', 'leaderboard'];
            const tabLabels = { tests: 'Testlerim', badges: 'Rozetlerim', leaderboard: 'Liderlik Tablosu' };
            tabs.forEach(tab => {
                const tabButton = document.getElementById(`${tab}Tab`);
                const tabContent = document.getElementById(`${tab}Content`);
                
                if (tab === tabName) {
                    if (tabButton) {
                        tabButton.classList.add('border-blue-500', 'text-blue-600', 'active-tab');
                        tabButton.classList.remove('border-transparent', 'text-gray-500');
                    }
                    if (tabContent) tabContent.classList.remove('hidden');
                } else {
                    if (tabButton) {
                        tabButton.classList.remove('border-blue-500', 'text-blue-600', 'active-tab');
                        tabButton.classList.add('border-transparent', 'text-gray-500');
                    }
                    if (tabContent) tabContent.classList.add('hidden');
                }
            });

            // Hamburger menü etiketini güncelle
            const label = document.getElementById('studentActiveTabLabel');
            if (label) label.textContent = tabLabels[tabName] || tabName;

            // Liderlik tablosu seçildiğinde verileri yükle
            if (tabName === 'leaderboard') {
                loadLeaderboard();
            }
        }

        function showTeacherTab(tabName) {
            const tabs = ['dashboard', 'tests', 'students', 'results', 'library', 'failedTests', 'dagitimTakibi', 'sinavLiderligi', 'topluYukleme'];
            tabs.forEach(tab => {
                const tabButtonId = tab === 'dashboard' ? 'dashboardTab' : 
                                  tab === 'tests' ? 'testsManageTab' :
                                  tab === 'students' ? 'studentsManageTab' : 
                                  tab === 'results' ? 'resultsTab' : 
                                  tab === 'library' ? 'libraryTab' : 
                                  tab === 'failedTests' ? 'failedTestsTab' :
                                  tab === 'dagitimTakibi' ? 'dagitimTakibiTab' :
                                  tab === 'sinavLiderligi' ? 'sinavLiderligiTab' : 'topluYuklemeTab';
                const tabContentId = tab === 'dashboard' ? 'dashboardContent' : 
                                   tab === 'tests' ? 'testsManageContent' :
                                   tab === 'students' ? 'studentsManageContent' : 
                                   tab === 'results' ? 'resultsContent' : 
                                   tab === 'library' ? 'libraryContent' : 
                                   tab === 'failedTests' ? 'failedTestsContent' :
                                   tab === 'dagitimTakibi' ? 'dagitimTakibiContent' :
                                   tab === 'sinavLiderligi' ? 'sinavLiderligiContent' : 'topluYuklemeContent';
                
                const tabButton = document.getElementById(tabButtonId);
                const tabContent = document.getElementById(tabContentId);
                
                if (tabButton && tabContent) {
                    if (tab === tabName) {
                        tabButton.classList.add('border-green-500', 'text-green-600', 'active-tab');
                        tabButton.classList.remove('border-transparent', 'text-gray-500');
                        tabContent.classList.remove('hidden');
                    } else {
                        tabButton.classList.remove('border-green-500', 'text-green-600', 'active-tab');
                        tabButton.classList.add('border-transparent', 'text-gray-500');
                        tabContent.classList.add('hidden');
                    }
                }
            });

            // Hamburger menü etiketini güncelle
            const teacherTabNames = {
                dashboard: 'Dashboard', tests: 'Testler', students: 'Öğrenciler',
                results: 'Sonuçlar', library: 'Kütüphane', failedTests: 'Başarısız',
                dagitimTakibi: 'Dağıtım Takibi', sinavLiderligi: 'Sınav Liderliği',
                topluYukleme: 'Toplu Yükleme'
            };
            const teacherLabel = document.getElementById('teacherActiveTabLabel');
            if (teacherLabel) teacherLabel.textContent = teacherTabNames[tabName] || tabName;

            if (tabName === 'library') loadLibraryStudents();
            if (tabName === 'dashboard') {
                loadLeaderboard();
                setTimeout(() => { renderTeacherStarList(); }, 500);
            }
            if (tabName === 'failedTests') loadFailedTestsList();
            if (tabName === 'dagitimTakibi') dagitimTakibiYukle();
            if (tabName === 'sinavLiderligi') loadSinavLeaderboard('sinav');
            // topluYukleme: sekmeye geçince sıfırlama — sadece kullanıcı manuel sıfırlarsa sıfırla
        }

        // Load tests list for teacher
        async function loadTestsList() {
            try {
                // 3 paralel sorgu — test başına N sorgu yerine toplamda 3 sorgu
                const [
                    { data: tests, error },
                    { data: allAsgn },
                    { data: allRes },
                ] = await Promise.all([
                    supabase.from('tests').select('*').order('created_at', { ascending: false }),
                    // cache varsa yeniden çekme
                    window._cache?.allAssignments
                        ? Promise.resolve({ data: window._cache.allAssignments })
                        : supabase.from('test_assignments').select('test_id, student_id'),
                    window._cache?.allResults
                        ? Promise.resolve({ data: window._cache.allResults })
                        : supabase.from('test_results').select('test_id, score'),
                ]);

                if (error) throw error;

                if (!tests || tests.length === 0) {
                    allTestsData = [];
                    displayFilteredTests([]);
                    return;
                }

                // Grupla: test_id → count
                const asgnByTest = {};
                (allAsgn || []).forEach(a => {
                    asgnByTest[a.test_id] = (asgnByTest[a.test_id] || 0) + 1;
                });

                const resCountByTest    = {};
                const resSuccByTest     = {};
                (allRes || []).forEach(r => {
                    resCountByTest[r.test_id] = (resCountByTest[r.test_id] || 0) + 1;
                    if (r.score >= 70) resSuccByTest[r.test_id] = (resSuccByTest[r.test_id] || 0) + 1;
                });

                allTestsData = tests.map(test => ({
                    ...test,
                    totalAssignments:    asgnByTest[test.id]    || 0,
                    completedAssignments:resCountByTest[test.id] || 0,
                    successfulAssignments:resSuccByTest[test.id] || 0,
                }));

                filterTests();

            } catch (error) {
                console.error('Error loading tests:', error);
                const container = document.getElementById('testsList');
                container.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-3"></i>
                        <p class="text-red-600">Testler yüklenirken hata oluştu.</p>
                        <button onclick="loadTestsList()" class="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                            Tekrar Dene
                        </button>
                    </div>
                `;
            }
        }

        // Display filtered tests
        function displayFilteredTests(filteredTests) {
            const container = document.getElementById('testsList');
            container.innerHTML = '';

            if (filteredTests.length === 0) {
                const message = currentTestSearch || currentTestFilter !== 'all' 
                    ? 'Arama kriterlerinize uygun test bulunamadı.' 
                    : 'Henüz test bulunmuyor.';
                container.innerHTML = `<p class="text-gray-500 text-center py-8">${message}</p>`;
                return;
            }

            filteredTests.forEach(test => {
                const isOptik = test.test_type === 'alistirma' || test.test_type === 'sinav' || test.test_type === 'cevap_kagidi';
                const testCard = document.createElement('div');
                testCard.className = 'bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-200';

                // Optik form testler için sol kenara renkli şerit
                if (isOptik) {
                    const accentColor = test.test_type === 'sinav' ? '#f97316' : test.test_type === 'cevap_kagidi' ? '#06b6d4' : '#22c55e';
                    testCard.style.cssText = `border-left: 4px solid ${accentColor};`;
                }

                testCard.innerHTML = `
                    <div class="flex justify-between items-start gap-4">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center flex-wrap gap-2 mb-2">
                                <h4 class="font-semibold text-gray-900 text-lg leading-tight">${test.title}</h4>
                                ${getTestTypeBadge(test.test_type)}
                            </div>
                            <p class="text-gray-600 text-sm mb-3">${test.description || ''}</p>

                            <!-- Test Statistics -->
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div class="bg-gray-50 rounded-lg p-2 text-center">
                                    <div class="text-lg font-bold text-gray-800">${test.time_limit}</div>
                                    <div class="text-xs text-gray-600">Dakika</div>
                                </div>
                                <div class="bg-blue-50 rounded-lg p-2 text-center">
                                    <div class="text-lg font-bold text-blue-800">${test.totalAssignments}</div>
                                    <div class="text-xs text-blue-600">Atanmış</div>
                                </div>
                                <div class="bg-yellow-50 rounded-lg p-2 text-center">
                                    <div class="text-lg font-bold text-yellow-800">${test.completedAssignments}</div>
                                    <div class="text-xs text-yellow-600">Tamamlanmış</div>
                                </div>
                                <div class="bg-green-50 rounded-lg p-2 text-center">
                                    <div class="text-lg font-bold text-green-800">${test.successfulAssignments}</div>
                                    <div class="text-xs text-green-600">Başarılı</div>
                                </div>
                            </div>

                            <div class="text-xs text-gray-500">
                                <i class="fas fa-calendar mr-1"></i>
                                Oluşturulma: ${new Date(test.created_at).toLocaleDateString('tr-TR')}
                            </div>
                        </div>

                        <div class="flex flex-col space-y-2 flex-shrink-0">
                            ${isOptik ? `
                            <button id="optikBtn_${test.id}"
                                    onclick="toggleOptikFormTable(${test.id}, this)"
                                    class="px-4 py-2 text-white text-sm rounded-lg transition duration-200 flex items-center justify-center"
                                    style="background:linear-gradient(135deg,#2563eb,#1d4ed8);">
                                <i class="fas fa-table mr-1"></i>📊 Sonuçları Göster
                            </button>` : ''}
                            <button onclick="showAnalysisPanel(${test.id})"
                                    class="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition duration-200 flex items-center justify-center">
                                <i class="fas fa-chart-bar mr-2"></i>📊 Analiz
                            </button>
                            <button onclick="showAssignmentModal(${test.id}, '${test.title.replace(/'/g, "\\'")}', ${test.totalAssignments}, ${test.completedAssignments})"
                                    class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center">
                                <i class="fas fa-clipboard-list mr-2"></i>🔄 Atamalar
                            </button>
                            <button onclick="showEditTestModal('${test.id}')"
                                    class="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition duration-200 flex items-center justify-center">
                                <i class="fas fa-edit mr-2"></i>Düzenle
                            </button>
                            <button onclick="deleteTest(${test.id})"
                                    class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition duration-200 flex items-center justify-center">
                                <i class="fas fa-trash mr-2"></i>Sil
                            </button>
                        </div>
                    </div>

                    ${isOptik ? `
                    <div class="border-t border-gray-100 mt-4 pt-4">
                        <div id="optikTable_${test.id}" class="hidden">
                            <!-- toggleOptikFormTable() tarafından doldurulur -->
                        </div>
                    </div>` : ''}
                `;
                container.appendChild(testCard);
            });

            // Update filter info
            updateTestFilterInfo(filteredTests.length);
        }

        // Function to switch to student dashboard
        async function impersonateStudent(studentId, studentName) {
            if (!confirm(`Öğretmen olarak "${studentName}" adlı öğrencinin arayüzüne geçmek istediğinizden emin misiniz?`)) {
                return;
            }

            try {
                // Get student data
                const { data: student, error } = await supabase
                    .from('students')
                    .select('*')
                    .eq('id', studentId)
                    .single();

                if (error) throw error;

                // Set global state for impersonation
                impersonatedStudent = student;
                
                // Save original user before switching
                window.originalUser = currentUser;
                currentUser = student; // Temporarily set current user to student

                // Show student dashboard
                showStudentDashboard();
                showNotification(`✅ Öğrenci arayüzüne geçildi: ${studentName}`, 'success');

            } catch (error) {
                console.error('Error impersonating student:', error);
                showNotification('Öğrenci arayüzüne geçilirken hata oluştu: ' + error.message, 'error');
                currentUser = window.originalUser; // Revert on error
            }
        }

        // Function to exit student impersonation
        function exitImpersonation() {
            if (window.originalUser) {
                currentUser = window.originalUser;
                impersonatedStudent = null;
                window.originalUser = null;
                showTeacherDashboard();
                showNotification('✅ Öğretmen paneline geri dönüldü.', 'success');
            }
        }

        // Load students list for teacher - SQL VIEW (student_stats) İLE KESİN ÇÖZÜM
        async function loadStudentsList() {
            try {
                // Fetch directly from our new SQL View
                const { data: studentStats, error } = await supabase
                    .from('student_stats')
                    .select('*')
                    .order('name');

                if (error) {
                    console.error('Error fetching student stats view:', error);
                    // Fallback to basic student list if view doesn't exist yet
                    const { data: basicStudents } = await supabase.from('students').select('*').order('name');
                    renderStudentsList(basicStudents || []);
                    return;
                }

                renderStudentsList(studentStats);
            } catch (error) {
                console.error('Error in loadStudentsList:', error);
            }
        }

        function renderStudentsList(students) {
            try {
            const container = document.getElementById('studentsList');
            container.innerHTML = '';

            if (!students || students.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8">Henüz öğrenci bulunmuyor.</p>';
                return;
            }

            students.forEach(student => {
                const weeklyCount = student.weekly_count || 0;
                const monthlyCount = student.monthly_count || 0;
                const studentCard = document.createElement('div');
                    studentCard.className = 'bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-lg transition duration-200 mb-3';
                    studentCard.setAttribute('onclick', `impersonateStudent('${student.id}', '${student.name.replace(/'/g, "\\'")}')`);
                    studentCard.innerHTML = `
                        <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                            <div class="flex-1">
                                <div class="flex flex-wrap items-center gap-2 mb-2">
                                    <h4 class="font-bold text-gray-900 text-lg">${student.name}</h4>
                                    <i class="fas fa-external-link-alt text-xs text-blue-500"></i>
                                    <div class="flex gap-2 ml-2">
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                            <i class="fas fa-calendar-week mr-1"></i> Haftalık: ${weeklyCount}
                                        </span>
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                            <i class="fas fa-calendar-alt mr-1"></i> Aylık: ${monthlyCount}
                                        </span>
                                    </div>
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-500">
                                    <span><i class="fas fa-id-card mr-1"></i> No: ${student.student_no}</span>
                                    <span><i class="fas fa-school mr-1"></i> Sınıf: ${student.class}</span>
                                    <span><i class="fas fa-fingerprint mr-1"></i> TC: ${student.tc_no}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0">
                                <button onclick="event.stopPropagation(); editStudent(${student.id}, '${student.name.replace(/'/g, "\\'")}', '${student.tc_no}', '${student.student_no}', '${student.class}')" 
                                        class="flex-1 md:flex-none px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition duration-200 flex items-center justify-center">
                                    <i class="fas fa-edit mr-2"></i>Düzenle
                                </button>
                                <button onclick="event.stopPropagation(); deleteStudent(${student.id})" 
                                        class="flex-1 md:flex-none px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition duration-200 flex items-center justify-center">
                                    <i class="fas fa-trash mr-2"></i>Sil
                                </button>
                            </div>
                        </div>
                    `;
                    container.appendChild(studentCard);
                });
            } catch (error) {
                console.error('Error loading students list:', error);
            }
        }

        // Load results list for teacher with comprehensive student-based data
        async function loadResultsList() {
            try {
                console.log('Loading results list...');
                
                // Load all students first
                const { data: students, error: studentsError } = await supabase
                    .from('students').select('*').order('name');
                if (studentsError) throw studentsError;

                // Tüm sonuçları çek - her çözüm ayrı sayılır (tekrar atama dahil)
                // Supabase 1000 satır limiti aşılabilir - tümünü çek
                let results = [];
                let from = 0;
                const pageSize = 1000;
                while (true) {
                    const { data: page, error: pageError } = await supabase
                        .from('test_results')
                        .select('*')
                        .order('completed_at', { ascending: false })
                        .range(from, from + pageSize - 1);
                    if (pageError) throw pageError;
                    if (!page || page.length === 0) break;
                    results = results.concat(page);
                    if (page.length < pageSize) break;
                    from += pageSize;
                }

                console.log(`Test results loaded: ${results.length}`);

                // Load tests
                const { data: allTests, error: testsError } = await supabase
                    .from('tests').select('*');
                if (testsError) throw testsError;

                // Load assignments
                const { data: assignments, error: assignmentsError } = await supabase
                    .from('test_assignments').select('*');
                if (assignmentsError) throw assignmentsError;

                const container = document.getElementById('resultsList');
                container.innerHTML = '';

                if (!students || students.length === 0) {
                    container.innerHTML = `
                        <div class="text-center py-12">
                            <i class="fas fa-users text-6xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500 text-lg">Henüz öğrenci bulunmuyor.</p>
                            <p class="text-gray-400 text-sm mt-2">Önce öğrenci ekleyin, sonra testler atayın.</p>
                        </div>
                    `;
                    return;
                }

                // Calculate comprehensive statistics
                const totalResults = results?.length || 0;
                const passedResults = results?.filter(r => r.score >= 70).length || 0;
                const excellentResults = results?.filter(r => r.score >= 90).length || 0;
                const perfectResults = results?.filter(r => r.score === 100).length || 0;
                const averageScore = totalResults > 0 ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalResults) : 0;
                const highestScore = totalResults > 0 ? Math.max(...results.map(r => r.score)) : 0;
                const lowestScore = totalResults > 0 ? Math.min(...results.map(r => r.score)) : 0;

                // Create test lookup map
                const testLookup = {};
                allTests?.forEach(test => {
                    testLookup[test.id] = test;
                });
                console.log('Test lookup created:', Object.keys(testLookup).length);

                // Enrich results with test information
                const enrichedResults = results?.map(result => ({
                    ...result,
                    test: testLookup[result.test_id] || { title: 'Unknown Test', time_limit: 30 }
                })) || [];
                console.log('Enriched results:', enrichedResults.length);

                // Group results by student for comprehensive student-based view
                // Ayrıca SQL View'dan kümülatif istatistikleri çek
                let viewStats = {};
                try {
                    const { data: statsData } = await supabase
                        .from('student_all_period_stats')
                        .select('student_id, current_weekly_successful_tests, last_weekly_successful_tests, monthly_total_tests, monthly_successful_tests, monthly_failed_tests');
                    if (statsData) {
                        statsData.forEach(s => { viewStats[s.student_id] = s; });
                    }
                } catch(e) { console.warn('student_all_period_stats fetch failed:', e); }

                // leaderboard_stats'tan toplam başarılı test sayısını çek
                let leaderboardStats = {};
                try {
                    const { data: lbData } = await supabase
                        .from('leaderboard_stats')
                        .select('student_id, successful_tests_count, total_tests_count, average_score');
                    if (lbData) {
                        lbData.forEach(s => { leaderboardStats[s.student_id] = s; });
                    }
                } catch(e) { console.warn('leaderboard_stats fetch failed:', e); }

                const studentResults = {};
                students.forEach(student => {
                    const studentTestResults = enrichedResults.filter(r => r.student_id === student.id) || [];
                    const studentAssignments = assignments?.filter(a => a.student_id === student.id) || [];
                    
                    console.log(`Student ${student.name}: ${studentTestResults.length} results, ${studentAssignments.length} assignments`);
                    
                    // Tamamlanan test ID'leri
                    const completedTestIds = new Set(studentTestResults.map(r => r.test_id));
                    
                    // Bekleyen: atanmış ama henüz çözülmemiş
                    const pendingCount = studentAssignments.filter(a => !completedTestIds.has(a.test_id)).length;

                    // Calculate detailed performance metrics
                    const scores = studentTestResults.map(r => r.score);
                    const averageScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
                    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
                    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
                    const passedTests = studentTestResults.filter(r => r.score >= 70).length;
                    const excellentTests = studentTestResults.filter(r => r.score >= 90).length;
                    const perfectScores = studentTestResults.filter(r => r.score === 100).length;
                    const failedTests = studentTestResults.filter(r => r.score < 70).length;
                    
                    // Calculate improvement trend (last 3 tests vs first 3 tests)
                    let improvementTrend = 'stable';
                    if (scores.length >= 3) {
                        const recentScores = scores.slice(0, 3);
                        const oldScores = scores.slice(-3);
                        const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
                        const oldAvg = oldScores.reduce((sum, score) => sum + score, 0) / oldScores.length;
                        
                        if (recentAvg > oldAvg + 5) improvementTrend = 'improving';
                        else if (recentAvg < oldAvg - 5) improvementTrend = 'declining';
                    }
                    
                    // Calculate consistency (standard deviation)
                    let consistency = 'stable';
                    if (scores.length >= 3) {
                        const mean = averageScore;
                        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
                        const stdDev = Math.sqrt(variance);
                        
                        if (stdDev < 10) consistency = 'very_consistent';
                        else if (stdDev < 20) consistency = 'consistent';
                        else if (stdDev < 30) consistency = 'moderate';
                        else consistency = 'inconsistent';
                    }
                    
                    // Calculate time-based performance
                    const lastWeekResults = studentTestResults.filter(r => {
                        const testDate = new Date(r.completed_at);
                        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                        return testDate >= weekAgo;
                    });
                    
                    const lastMonthResults = studentTestResults.filter(r => {
                        const testDate = new Date(r.completed_at);
                        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                        return testDate >= monthAgo;
                    });
                    
                    // Gerçek kümülatif istatistikler: direkt veriden hesapla
                    const lb = leaderboardStats[student.id];
                    const realTotalTests  = studentTestResults.length;
                    const realPassedTests = studentTestResults.filter(r => r.score >= 70).length;
                    const realFailedTests = studentTestResults.filter(r => r.score < 70).length;
                    const realAvgScore    = realTotalTests > 0
                        ? Math.round(studentTestResults.reduce((sum, r) => sum + r.score, 0) / realTotalTests)
                        : 0;

                    studentResults[student.id] = {
                        student: student,
                        results: studentTestResults,
                        assignments: studentAssignments,
                        
                        // Basic metrics
                        totalTests: realTotalTests,                     // Tüm çözümler (tekrar atamalar dahil)
                        totalAssignments: studentAssignments.length,    // Atanan test sayısı
                        pendingTests: pendingCount,                     // Atanmış ama çözülmemiş
                        
                        // Score metrics
                        averageScore: realAvgScore,
                        highestScore: highestScore,
                        lowestScore: lowestScore,
                        
                        // Performance categories
                        passedTests: realPassedTests,
                        failedTests: realFailedTests,
                        excellentTests: excellentTests,
                        perfectScores: perfectScores,
                        
                        // Success rates
                        passRate: realTotalTests > 0 ? Math.round((realPassedTests / realTotalTests) * 100) : 0,
                        excellenceRate: realTotalTests > 0 ? Math.round((excellentTests / realTotalTests) * 100) : 0,
                        
                        // Trends and patterns
                        improvementTrend: improvementTrend,
                        consistency: consistency,
                        
                        // Time-based performance
                        lastWeekTests: lastWeekResults.length,
                        lastMonthTests: lastMonthResults.length,
                        lastWeekAverage: lastWeekResults.length > 0 ? 
                            Math.round(lastWeekResults.reduce((sum, r) => sum + r.score, 0) / lastWeekResults.length) : 0,
                        lastMonthAverage: lastMonthResults.length > 0 ? 
                            Math.round(lastMonthResults.reduce((sum, r) => sum + r.score, 0) / lastMonthResults.length) : 0,
                        
                        // Activity metrics
                        firstTestDate: studentTestResults.length > 0 ? 
                            new Date(Math.min(...studentTestResults.map(r => new Date(r.completed_at)))).toLocaleDateString('tr-TR') : null,
                        lastTestDate: studentTestResults.length > 0 ? 
                            new Date(Math.max(...studentTestResults.map(r => new Date(r.completed_at)))).toLocaleDateString('tr-TR') : null,
                        
                        // Detailed test breakdown by difficulty/type
                        testsByScore: {
                            perfect: perfectScores,
                            excellent: excellentTests - perfectScores,
                            good: realPassedTests - excellentTests,
                            needsWork: realFailedTests
                        }
                    };
                });

                // Enhanced statistics header
                const activeStudents = Object.values(studentResults).filter(s => s.totalTests > 0).length;
                const totalAssignments = Object.values(studentResults).reduce((sum, s) => sum + s.totalAssignments, 0);
                const pendingAssignments = Object.values(studentResults).reduce((sum, s) => sum + s.pendingTests, 0);
                const improvingStudents = Object.values(studentResults).filter(s => s.improvementTrend === 'improving').length;
                const consistentStudents = Object.values(studentResults).filter(s => s.consistency === 'very_consistent' || s.consistency === 'consistent').length;
                
                const statsDiv = document.createElement('div');
                statsDiv.className = 'mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100';
                statsDiv.innerHTML = `
                    <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <i class="fas fa-chart-line text-blue-600 mr-3"></i>
                        Sınıf Performans Özeti
                    </h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                        <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                            <div class="text-2xl font-bold text-blue-600">${students.length}</div>
                            <div class="text-sm text-gray-600 font-medium">Toplam Öğrenci</div>
                        </div>
                        <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                            <div class="text-2xl font-bold text-green-600">${activeStudents}</div>
                            <div class="text-sm text-gray-600 font-medium">Aktif Öğrenci</div>
                            <div class="text-xs text-gray-500 mt-1">Test çözen</div>
                        </div>
                        <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                            <div class="text-2xl font-bold text-purple-600">${totalResults}</div>
                            <div class="text-sm text-gray-600 font-medium">Çözülen Test</div>
                            <div class="text-xs text-gray-500 mt-1">Tüm tamamlananlar</div>
                        </div>
                        <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                            <div class="text-2xl font-bold text-yellow-600">${passedResults}</div>
                            <div class="text-sm text-gray-600 font-medium">Başarılı (≥70)</div>
                            <div class="text-xs text-gray-500 mt-1">${totalResults > 0 ? Math.round((passedResults/totalResults)*100) : 0}% başarı oranı</div>
                        </div>
                        <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                            <div class="text-2xl font-bold text-indigo-600">${averageScore}</div>
                            <div class="text-sm text-gray-600 font-medium">Sınıf Ortalaması</div>
                            <div class="text-xs text-gray-500 mt-1">Puan ortalaması</div>
                        </div>
                        <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                            <div class="text-2xl font-bold text-orange-600">${pendingAssignments}</div>
                            <div class="text-sm text-gray-600 font-medium">Bekleyen Test</div>
                            <div class="text-xs text-gray-500 mt-1">Atanmış, çözülmemiş</div>
                        </div>
                        <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                            <div class="text-2xl font-bold text-emerald-600">${improvingStudents}</div>
                            <div class="text-sm text-gray-600 font-medium">Gelişen Öğrenci</div>
                            <div class="text-xs text-gray-500 mt-1">📈 Trend</div>
                        </div>
                        <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                            <div class="text-2xl font-bold text-teal-600">${consistentStudents}</div>
                            <div class="text-sm text-gray-600 font-medium">Tutarlı Öğrenci</div>
                            <div class="text-xs text-gray-500 mt-1">🎯 Kararlı</div>
                        </div>
                    </div>
                    
                    <!-- Performance Distribution -->
                    <div class="mt-6 p-4 bg-white rounded-lg border border-gray-200">
                        <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                            <i class="fas fa-chart-pie text-indigo-600 mr-2"></i>
                            Performans Dağılımı
                        </h4>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="text-center">
                                <div class="text-3xl font-bold text-purple-600">${perfectResults}</div>
                                <div class="text-sm text-gray-600">Mükemmel (100)</div>
                                <div class="text-xs text-purple-600">🏆 Tam Puan</div>
                            </div>
                            <div class="text-center">
                                <div class="text-3xl font-bold text-green-600">${excellentResults - perfectResults}</div>
                                <div class="text-sm text-gray-600">Harika (90-99)</div>
                                <div class="text-xs text-green-600">⭐ Mükemmel</div>
                            </div>
                            <div class="text-center">
                                <div class="text-3xl font-bold text-blue-600">${passedResults - excellentResults}</div>
                                <div class="text-sm text-gray-600">İyi (70-89)</div>
                                <div class="text-xs text-blue-600">👍 Başarılı</div>
                            </div>
                            <div class="text-center">
                                <div class="text-3xl font-bold text-red-600">${totalResults - passedResults}</div>
                                <div class="text-sm text-gray-600">Başarısız (<70)</div>
                                <div class="text-xs text-red-600">📚 Çalışmalı</div>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(statsDiv);

                // Enhanced filter and search controls
                const controlsDiv = document.createElement('div');
                controlsDiv.className = 'mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg';
                controlsDiv.innerHTML = `
                    <div class="space-y-4">
                        <!-- Öğrenci Seçimi -->
                        <div class="flex items-center gap-3 flex-wrap">
                            <div class="flex-1 min-w-48">
                                <select id="resultsStudentSelect" onchange="filterStudentResults()"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                    <option value="all">👤 Tüm Öğrenciler</option>
                                    ${students.sort((a,b) => (a.name||'').localeCompare(b.name||'','tr')).map(s =>
                                        `<option value="${s.id}">${s.name}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <button onclick="exportStudentResults()" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200">
                                <i class="fas fa-file-excel mr-2"></i>Excel İndir
                            </button>
                            <button onclick="exportStudentResultsPDF()" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200">
                                <i class="fas fa-file-pdf mr-2"></i>PDF İndir
                            </button>
                        </div>
                        
                        <!-- Filter Options -->
                        <div class="flex flex-wrap gap-2">
                            <select id="resultsFilterSelect" onchange="filterStudentResults()" 
                                    class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="all">🎯 Tüm Öğrenciler</option>
                                <option value="active">✅ Test Çözenler</option>
                                <option value="inactive">⏳ Test Çözmeyenler</option>
                                <option value="high_performers">🌟 Yüksek Performans (≥85)</option>
                                <option value="excellent_performers">🏆 Mükemmel Performans (≥90)</option>
                                <option value="low_performers">📚 Gelişmeli (<70)</option>
                                <option value="improving">📈 Gelişen Öğrenciler</option>
                                <option value="declining">📉 Düşen Performans</option>
                                <option value="consistent">🎯 Tutarlı Öğrenciler</option>
                                <option value="inconsistent">🔄 Değişken Performans</option>
                                <option value="pending">⏰ Bekleyen Testi Olanlar</option>
                                <option value="recent_active">🔥 Son Hafta Aktif</option>
                            </select>
                            
                            <select id="resultsSortSelect" onchange="filterStudentResults()" 
                                    class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="name_asc">📝 İsim (A-Z)</option>
                                <option value="name_desc">📝 İsim (Z-A)</option>
                                <option value="average_desc">📊 En Yüksek Ortalama</option>
                                <option value="average_asc">📊 En Düşük Ortalama</option>
                                <option value="test_count_desc">📈 En Çok Test</option>
                                <option value="test_count_asc">📉 En Az Test</option>
                                <option value="recent_activity">🕒 Son Aktivite</option>
                                <option value="improvement_desc">📈 En Çok Gelişen</option>
                                <option value="consistency_desc">🎯 En Tutarlı</option>
                            </select>
                            
                            <select id="resultsClassFilter" onchange="filterStudentResults()" 
                                    class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="all">🏫 Tüm Sınıflar</option>
                                ${[...new Set(students.map(s => s.class))].sort().map(className => 
                                    `<option value="${className}">📚 ${className}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <!-- Quick Stats -->
                        <div id="filterResultsInfo" class="text-sm text-gray-600 flex justify-between items-center">
                            <span>Tüm öğrenciler gösteriliyor</span>
                            <button onclick="clearStudentFilters()" class="text-blue-600 hover:text-blue-800 font-medium">
                                <i class="fas fa-times mr-1"></i>Filtreleri Temizle
                            </button>
                        </div>
                    </div>
                `;
                container.appendChild(controlsDiv);

                // Results container
                const resultsContainer = document.createElement('div');
                resultsContainer.id = 'filteredStudentResultsContainer';
                container.appendChild(resultsContainer);

                // Store all student results for filtering
                window.allStudentResultsData = Object.values(studentResults);
                console.log('Final student results data:', window.allStudentResultsData.length);
                
                // Debug: Log first student's data
                if (window.allStudentResultsData.length > 0) {
                    console.log('Sample student data:', window.allStudentResultsData[0]);
                }
                
                // Display all student results initially
                displayFilteredStudentResults(Object.values(studentResults));

            } catch (error) {
                console.error('Error loading results:', error);
                console.error('Error details:', {
                    message: error.message,
                    code: error.code,
                    details: error.details
                });
                
                const container = document.getElementById('resultsList');
                container.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-3"></i>
                        <p class="text-red-600 mb-3">Sonuçlar yüklenirken hata oluştu.</p>
                        <p class="text-sm text-gray-600 mb-4">${error.message || 'Bilinmeyen hata'}</p>
                        <div class="space-y-2">
                            <button onclick="loadResultsList()" class="block mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                <i class="fas fa-sync mr-2"></i>Tekrar Dene
                            </button>
                            <button onclick="showSimpleResults()" class="block mx-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                <i class="fas fa-list mr-2"></i>Basit Görünüm
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        // Display comprehensive filtered student results
        function displayFilteredStudentResults(studentResults) {
            const container = document.getElementById('filteredStudentResultsContainer');
            if (!container) return;
            
            container.innerHTML = '';

            if (studentResults.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-12">
                        <i class="fas fa-search text-6xl text-gray-300 mb-4"></i>
                        <p class="text-gray-500 text-lg">Arama kriterlerinize uygun öğrenci bulunamadı.</p>
                        <p class="text-gray-400 text-sm mt-2">Farklı filtreler deneyebilir veya arama terimini değiştirebilirsiniz.</p>
                    </div>
                `;
                return;
            }

            studentResults.forEach((studentData, index) => {
                const student = studentData.student;
                const results = studentData.results;
                
                // Determine performance level and styling
                let performanceLevel, performanceColor, performanceIcon, rankIcon, trendIcon, consistencyIcon;
                
                if (studentData.averageScore >= 95) {
                    performanceLevel = 'Mükemmel';
                    performanceColor = 'from-purple-500 to-pink-500';
                    performanceIcon = '🏆';
                    rankIcon = '👑';
                } else if (studentData.averageScore >= 85) {
                    performanceLevel = 'Çok İyi';
                    performanceColor = 'from-green-500 to-emerald-500';
                    performanceIcon = '⭐';
                    rankIcon = '🌟';
                } else if (studentData.averageScore >= 70) {
                    performanceLevel = 'İyi';
                    performanceColor = 'from-blue-500 to-cyan-500';
                    performanceIcon = '👍';
                    rankIcon = '✅';
                } else if (studentData.totalTests > 0) {
                    performanceLevel = 'Gelişmeli';
                    performanceColor = 'from-orange-500 to-red-500';
                    performanceIcon = '📚';
                    rankIcon = '📖';
                } else {
                    performanceLevel = 'Henüz Test Yok';
                    performanceColor = 'from-gray-400 to-gray-500';
                    performanceIcon = '⏳';
                    rankIcon = '⚪';
                }

                // Trend and consistency icons
                switch (studentData.improvementTrend) {
                    case 'improving': trendIcon = '📈'; break;
                    case 'declining': trendIcon = '📉'; break;
                    default: trendIcon = '➡️'; break;
                }

                switch (studentData.consistency) {
                    case 'very_consistent': consistencyIcon = '🎯'; break;
                    case 'consistent': consistencyIcon = '🔵'; break;
                    case 'moderate': consistencyIcon = '🟡'; break;
                    case 'inconsistent': consistencyIcon = '🔄'; break;
                    default: consistencyIcon = '⚪'; break;
                }

                const studentDiv = document.createElement('div');
                studentDiv.className = 'mb-8 bg-white border-2 border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1';
                
                studentDiv.innerHTML = `
                    <!-- Enhanced Student Header -->
                    <div class="bg-gradient-to-r ${performanceColor} p-6 text-white relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-white bg-opacity-10 rounded-full -mr-16 -mt-16"></div>
                        <div class="absolute bottom-0 left-0 w-24 h-24 bg-white bg-opacity-10 rounded-full -ml-12 -mb-12"></div>
                        
                        <div class="relative z-10">
                            <div class="flex items-center justify-between mb-4">
                                <div class="flex items-center space-x-4">
                                    <div class="text-5xl">${rankIcon}</div>
                                    <div>
                                        <h4 class="text-2xl font-bold">${student.name}</h4>
                                        <div class="flex items-center space-x-4 mt-2 text-sm opacity-90">
                                            <span class="bg-white bg-opacity-20 px-2 py-1 rounded">No: ${student.student_no}</span>
                                            <span class="bg-white bg-opacity-20 px-2 py-1 rounded">Sınıf: ${student.class}</span>
                                            <span class="bg-white bg-opacity-30 px-3 py-1 rounded-full font-medium">
                                                ${performanceIcon} ${performanceLevel}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Main Score Display -->
                                <div class="text-right">
                                    <div class="text-5xl font-bold mb-1">${studentData.averageScore || 0}</div>
                                    <div class="text-sm opacity-90 font-medium">Ortalama Puan</div>
                                    <div class="flex items-center justify-end space-x-2 mt-2">
                                        <span class="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">${trendIcon} Trend</span>
                                        <span class="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">${consistencyIcon} Tutarlılık</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Quick Performance Indicators -->
                            <div class="flex items-center space-x-6 text-sm">
                                <div class="flex items-center space-x-1">
                                    <span class="text-lg">🎯</span>
                                    <span>Başarı: %${studentData.passRate}</span>
                                </div>
                                <div class="flex items-center space-x-1">
                                    <span class="text-lg">⭐</span>
                                    <span>Mükemmellik: %${studentData.excellenceRate}</span>
                                </div>
                                ${studentData.lastWeekTests > 0 ? `
                                    <div class="flex items-center space-x-1">
                                        <span class="text-lg">🔥</span>
                                        <span>Bu hafta: ${studentData.lastWeekTests} test</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Comprehensive Statistics Grid -->
                    <div class="p-6 bg-gradient-to-br from-gray-50 to-blue-50">
                        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                            <!-- Basic Stats -->
                            <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-blue-100">
                                <div class="text-2xl font-bold text-blue-600">${studentData.totalTests}</div>
                                <div class="text-xs text-gray-600 font-medium">Çözülen Test</div>
                                <div class="text-xs text-blue-500 mt-1">📊 Tamamlanan</div>
                            </div>
                            <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-green-100">
                                <div class="text-2xl font-bold text-green-600">${studentData.passedTests}</div>
                                <div class="text-xs text-gray-600 font-medium">Başarılı (≥70)</div>
                                <div class="text-xs text-green-500 mt-1">✅ %${studentData.totalTests > 0 ? Math.round((studentData.passedTests / studentData.totalTests) * 100) : 0}</div>
                            </div>
                            <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-purple-100">
                                <div class="text-2xl font-bold text-purple-600">${studentData.perfectScores}</div>
                                <div class="text-xs text-gray-600 font-medium">Tam Puan</div>
                                <div class="text-xs text-purple-500 mt-1">🏆 100 Puan</div>
                            </div>
                            <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-yellow-100">
                                <div class="text-2xl font-bold text-yellow-600">${studentData.excellentTests}</div>
                                <div class="text-xs text-gray-600 font-medium">Mükemmel (≥90)</div>
                                <div class="text-xs text-yellow-500 mt-1">⭐ Harika</div>
                            </div>
                            
                            <!-- Performance Range -->
                            <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-emerald-100">
                                <div class="text-2xl font-bold text-emerald-600">${studentData.highestScore || 0}</div>
                                <div class="text-xs text-gray-600 font-medium">En Yüksek</div>
                                <div class="text-xs text-emerald-500 mt-1">📈 Zirve</div>
                            </div>
                            <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
                                <div class="text-2xl font-bold text-gray-600">${studentData.lowestScore || 0}</div>
                                <div class="text-xs text-gray-600 font-medium">En Düşük</div>
                                <div class="text-xs text-gray-500 mt-1">📉 Minimum</div>
                            </div>
                            <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-orange-100">
                                <div class="text-2xl font-bold text-orange-600">${studentData.pendingTests}</div>
                                <div class="text-xs text-gray-600 font-medium">Bekleyen</div>
                                <div class="text-xs text-orange-500 mt-1">⏰ Çözülmemiş</div>
                            </div>
                            <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-red-100">
                                <div class="text-2xl font-bold text-red-600">${studentData.failedTests}</div>
                                <div class="text-xs text-gray-600 font-medium">Başarısız (<70)</div>
                                <div class="text-xs text-red-500 mt-1">📚 Çalışmalı</div>
                            </div>
                        </div>
                    </div>

                    <!-- Advanced Analytics Section -->
                    ${studentData.totalTests > 0 ? `
                        <div class="p-6 bg-white border-t border-gray-100">
                            <h5 class="font-bold text-gray-900 mb-4 flex items-center">
                                <i class="fas fa-chart-line text-indigo-600 mr-2"></i>
                                Performans Analizi
                            </h5>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <!-- Trend Analysis -->
                                <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                                    <h6 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        ${trendIcon} Gelişim Trendi
                                    </h6>
                                    <div class="space-y-2">
                                        <div class="flex justify-between">
                                            <span class="text-sm text-gray-600">Durum:</span>
                                            <span class="text-sm font-medium ${
                                                studentData.improvementTrend === 'improving' ? 'text-green-600' :
                                                studentData.improvementTrend === 'declining' ? 'text-red-600' : 'text-gray-600'
                                            }">
                                                ${studentData.improvementTrend === 'improving' ? 'Gelişiyor' :
                                                  studentData.improvementTrend === 'declining' ? 'Düşüyor' : 'Stabil'}
                                            </span>
                                        </div>
                                        ${studentData.lastWeekAverage > 0 ? `
                                            <div class="flex justify-between">
                                                <span class="text-sm text-gray-600">Bu hafta:</span>
                                                <span class="text-sm font-medium text-blue-600">${studentData.lastWeekAverage}</span>
                                            </div>
                                        ` : ''}
                                        ${studentData.lastMonthAverage > 0 ? `
                                            <div class="flex justify-between">
                                                <span class="text-sm text-gray-600">Bu ay:</span>
                                                <span class="text-sm font-medium text-indigo-600">${studentData.lastMonthAverage}</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                                
                                <!-- Consistency Analysis -->
                                <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                                    <h6 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        ${consistencyIcon} Tutarlılık
                                    </h6>
                                    <div class="space-y-2">
                                        <div class="flex justify-between">
                                            <span class="text-sm text-gray-600">Seviye:</span>
                                            <span class="text-sm font-medium ${
                                                studentData.consistency === 'very_consistent' ? 'text-green-600' :
                                                studentData.consistency === 'consistent' ? 'text-blue-600' :
                                                studentData.consistency === 'moderate' ? 'text-yellow-600' : 'text-red-600'
                                            }">
                                                ${studentData.consistency === 'very_consistent' ? 'Çok Tutarlı' :
                                                  studentData.consistency === 'consistent' ? 'Tutarlı' :
                                                  studentData.consistency === 'moderate' ? 'Orta' : 'Değişken'}
                                            </span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-sm text-gray-600">Başarı oranı:</span>
                                            <span class="text-sm font-medium text-green-600">%${studentData.passRate}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-sm text-gray-600">Mükemmellik:</span>
                                            <span class="text-sm font-medium text-purple-600">%${studentData.excellenceRate}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Activity Timeline -->
                                <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                                    <h6 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        📅 Aktivite Zaman Çizelgesi
                                    </h6>
                                    <div class="space-y-2">
                                        ${studentData.firstTestDate ? `
                                            <div class="flex justify-between">
                                                <span class="text-sm text-gray-600">İlk test:</span>
                                                <span class="text-sm font-medium text-purple-600">${studentData.firstTestDate}</span>
                                            </div>
                                        ` : ''}
                                        ${studentData.lastTestDate ? `
                                            <div class="flex justify-between">
                                                <span class="text-sm text-gray-600">Son test:</span>
                                                <span class="text-sm font-medium text-pink-600">${studentData.lastTestDate}</span>
                                            </div>
                                        ` : ''}
                                        <div class="flex justify-between">
                                            <span class="text-sm text-gray-600">Bu hafta:</span>
                                            <span class="text-sm font-medium text-indigo-600">${studentData.lastWeekTests} test</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-sm text-gray-600">Bu ay:</span>
                                            <span class="text-sm font-medium text-blue-600">${studentData.lastMonthTests} test</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Test Results Details -->
                    ${results.length > 0 ? `
                        <div class="p-6 bg-gray-50 border-t border-gray-200">
                            <div class="flex justify-between items-center mb-4">
                                <h5 class="font-bold text-gray-900 flex items-center">
                                    <i class="fas fa-list-alt text-blue-600 mr-2"></i>
                                    Test Sonuçları Detayı (<span id="detailCount_${student.id}">${results.length}</span> / ${results.length})
                                </h5>
                                <div class="flex space-x-2">
                                    <button onclick="exportStudentDetail(${student.id})" class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition duration-200">
                                        <i class="fas fa-download mr-1"></i>Excel
                                    </button>
                                    <button onclick="toggleStudentDetails(${student.id})" class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition duration-200">
                                        <i class="fas fa-eye-slash mr-1"></i>Detayları Gizle
                                    </button>
                                </div>
                            </div>

                            <!-- Arama & Filtre -->
                            <div class="mb-4 flex flex-wrap gap-2 items-center">
                                <div class="relative flex-1 min-w-[200px]">
                                    <input type="text"
                                           id="detailSearch_${student.id}"
                                           placeholder="Test adı ile ara..."
                                           oninput="filterStudentDetailCards(${student.id})"
                                           class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <i class="fas fa-search text-gray-400 text-xs"></i>
                                    </div>
                                </div>
                                <select id="detailFilter_${student.id}"
                                        onchange="filterStudentDetailCards(${student.id})"
                                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white">
                                    <option value="all">Tümü</option>
                                    <option value="passed">✅ Başarılı (≥70)</option>
                                    <option value="failed">📚 Başarısız (&lt;70)</option>
                                    <option value="excellent">⭐ Harika (≥90)</option>
                                    <option value="perfect">🏆 Tam Puan (100)</option>
                                </select>
                                <button onclick="clearStudentDetailFilter(${student.id})"
                                        class="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg bg-white hover:bg-gray-50">
                                    <i class="fas fa-times mr-1"></i>Temizle
                                </button>
                            </div>
                            
                            <div id="studentDetails_${student.id}" class="">
                                <div id="detailGrid_${student.id}" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    ${results.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).map((result, idx) => `
                                        <div class="detail-card bg-white border-2 ${
                                            result.score === 100 ? 'border-purple-200 bg-purple-50' :
                                            result.score >= 90 ? 'border-green-200 bg-green-50' :
                                            result.score >= 70 ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'
                                        } rounded-xl p-4 hover:shadow-md transition-all duration-200"
                                             data-title="${(result.test?.title || '').toLowerCase().replace(/"/g, '&quot;')}"
                                             data-score="${result.score}">
                                            <div class="flex justify-between items-start mb-3">
                                                <div class="flex-1">
                                                    <div class="flex items-center space-x-2 mb-2">
                                                        <span class="text-lg">
                                                            ${result.score === 100 ? '🏆' :
                                                              result.score >= 90 ? '⭐' :
                                                              result.score >= 70 ? '✅' : '📚'}
                                                        </span>
                                                        <h6 class="font-bold text-gray-900 text-sm">${result.test?.title || 'Unknown Test'}</h6>
                                                    </div>
                                                    <div class="space-y-1 text-xs text-gray-600">
                                                        <div class="flex items-center">
                                                            <i class="fas fa-calendar-alt mr-2 w-3"></i>
                                                            <span>${new Date(result.completed_at).toLocaleDateString('tr-TR', { 
                                                                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                                                            })}</span>
                                                        </div>
                                                        <div class="flex items-center">
                                                            <i class="fas fa-clock mr-2 w-3"></i>
                                                            <span>${result.test?.time_limit || 30} dakika süre</span>
                                                        </div>
                                                        <div class="flex items-center">
                                                            <i class="fas fa-hashtag mr-2 w-3"></i>
                                                            <span>${idx + 1}. test (kronolojik)</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="text-right">
                                                    <div class="text-3xl font-bold ${
                                                        result.score === 100 ? 'text-purple-600' :
                                                        result.score >= 90 ? 'text-green-600' :
                                                        result.score >= 70 ? 'text-blue-600' : 'text-red-600'
                                                    }">${result.score}</div>
                                                    <div class="text-xs font-medium ${
                                                        result.score === 100 ? 'text-purple-600' :
                                                        result.score >= 90 ? 'text-green-600' :
                                                        result.score >= 70 ? 'text-blue-600' : 'text-red-600'
                                                    }">
                                                        ${result.score === 100 ? 'Mükemmel' :
                                                          result.score >= 90 ? 'Harika' :
                                                          result.score >= 70 ? 'Başarılı' : 'Gelişmeli'}
                                                    </div>
                                                    <div class="text-xs text-gray-500 mt-1">
                                                        ${(() => {
                                            try {
                                                if (result.test && result.test.questions) {
                                                    const questions = typeof result.test.questions === 'string' ? 
                                                        JSON.parse(result.test.questions) : result.test.questions;
                                                    const totalQuestions = Array.isArray(questions) ? questions.length : 7;
                                                    const correctAnswers = Math.round((result.score / 100) * totalQuestions);
                                                    return `${correctAnswers}/${totalQuestions} doğru`;
                                                } else {
                                                    return `${Math.round((result.score / 100) * 7)}/7 doğru`;
                                                }
                                            } catch (e) {
                                                return `${Math.round((result.score / 100) * 7)}/7 doğru`;
                                            }
                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="w-full bg-gray-200 rounded-full h-2 mt-3">
                                                <div class="h-2 rounded-full transition-all duration-300 ${
                                                    result.score === 100 ? 'bg-purple-500' :
                                                    result.score >= 90 ? 'bg-green-500' :
                                                    result.score >= 70 ? 'bg-blue-500' : 'bg-red-500'
                                                }" style="width: ${result.score}%"></div>
                                            </div>
                                            <div class="mt-3 flex gap-2">
                                                <button onclick="showDetailedResults(${result.id}, ${student.id}, '${student.name.replace(/'/g, "\\'")}', '${result.test?.title?.replace(/'/g, "\\'") || "Test"}')" 
                                                        class="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition duration-200 flex items-center justify-center">
                                                    <i class="fas fa-clipboard-check mr-2"></i>Detaylı Sonuçlar
                                                </button>
                                                <button onclick="downloadResultPDF(${result.id}, ${student.id}, '${student.name.replace(/'/g, "\\'")}', '${result.test?.title?.replace(/'/g, "\\'") || "Test"}')"
                                                        class="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition duration-200 flex items-center justify-center" title="PDF İndir">
                                                    <i class="fas fa-file-pdf mr-1"></i>PDF
                                                </button>
                                                <button onclick="deleteTestResult(${result.id}, '${student.name.replace(/'/g, "\\'")}', '${result.test?.title?.replace(/'/g, "\\'") || "Test"}')" 
                                                        class="px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition duration-200 flex items-center justify-center" title="Sil">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                                
                                <!-- Test Summary Stats -->
                                <div class="mt-6 p-4 bg-white rounded-xl border border-gray-200">
                                    <h6 class="font-semibold text-gray-800 mb-3">📊 Test Performans Özeti</h6>
                                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div class="text-center">
                                            <div class="text-2xl font-bold text-purple-600">${studentData.testsByScore.perfect}</div>
                                            <div class="text-xs text-gray-600">Mükemmel (100)</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-2xl font-bold text-green-600">${studentData.testsByScore.excellent}</div>
                                            <div class="text-xs text-gray-600">Harika (90-99)</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-2xl font-bold text-blue-600">${studentData.testsByScore.good}</div>
                                            <div class="text-xs text-gray-600">İyi (70-89)</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-2xl font-bold text-red-600">${studentData.testsByScore.needsWork}</div>
                                            <div class="text-xs text-gray-600">Gelişmeli (<70)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="p-8 text-center bg-gray-50 border-t border-gray-200">
                            <div class="text-gray-400 mb-4">
                                <i class="fas fa-clipboard-list text-6xl"></i>
                            </div>
                            <h5 class="text-lg font-semibold text-gray-700 mb-2">Henüz test sonucu bulunmuyor</h5>
                            <p class="text-gray-600 mb-4">
                                ${studentData.totalAssignments > 0 ? 
                                    `${studentData.totalAssignments} test atanmış, henüz çözülmemiş` : 
                                    'Henüz test atanmamış'}
                            </p>
                            ${studentData.totalAssignments > 0 ? `
                                <div class="inline-flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg">
                                    <i class="fas fa-hourglass-half mr-2"></i>
                                    <span class="font-medium">${studentData.pendingTests} test çözülmeyi bekliyor</span>
                                </div>
                            ` : `
                                <div class="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-lg">
                                    <i class="fas fa-plus-circle mr-2"></i>
                                    <span class="font-medium">Test atayarak başlayabilirsiniz</span>
                                </div>
                            `}
                        </div>
                    `}
                `;
                
                container.appendChild(studentDiv);
            });

            // Update filter info
            updateStudentFilterInfo(studentResults.length);
        }

        // Toggle student details
        function toggleStudentDetails(studentId) {
            const detailsDiv = document.getElementById(`studentDetails_${studentId}`);
            const button = detailsDiv.previousElementSibling.previousElementSibling.querySelector('button:last-child');
            
            if (detailsDiv.classList.contains('hidden')) {
                detailsDiv.classList.remove('hidden');
                if (button) button.innerHTML = '<i class="fas fa-eye-slash mr-1"></i>Detayları Gizle';
            } else {
                detailsDiv.classList.add('hidden');
                if (button) button.innerHTML = '<i class="fas fa-eye mr-1"></i>Detayları Göster';
            }
        }

        // Filter student detail cards by search term and status
        function filterStudentDetailCards(studentId) {
            const searchTerm = (document.getElementById(`detailSearch_${studentId}`)?.value || '').toLowerCase().trim();
            const filterVal  = document.getElementById(`detailFilter_${studentId}`)?.value || 'all';
            const grid       = document.getElementById(`detailGrid_${studentId}`);
            const noResult   = document.getElementById(`detailNoResult_${studentId}`);
            const countEl    = document.getElementById(`detailCount_${studentId}`);
            if (!grid) return;

            const cards = grid.querySelectorAll('.detail-card');
            let visible = 0;

            cards.forEach(card => {
                const title = (card.getAttribute('data-title') || '').toLowerCase();
                const score = parseInt(card.getAttribute('data-score') || '0');

                const matchSearch = !searchTerm || title.includes(searchTerm);
                let matchFilter = true;
                if (filterVal === 'passed')    matchFilter = score >= 70;
                else if (filterVal === 'failed')    matchFilter = score < 70;
                else if (filterVal === 'excellent') matchFilter = score >= 90;
                else if (filterVal === 'perfect')   matchFilter = score === 100;

                if (matchSearch && matchFilter) {
                    card.style.display = '';
                    visible++;
                } else {
                    card.style.display = 'none';
                }
            });

            if (countEl) countEl.textContent = visible;
            if (noResult) noResult.classList.toggle('hidden', visible > 0);
        }

        // Clear filter for a student
        function clearStudentDetailFilter(studentId) {
            const searchEl = document.getElementById(`detailSearch_${studentId}`);
            const filterEl = document.getElementById(`detailFilter_${studentId}`);
            if (searchEl) searchEl.value = '';
            if (filterEl) filterEl.value = 'all';
            filterStudentDetailCards(studentId);
        }

        // Enhanced filter student results function
        function filterStudentResults() {
            if (!window.allStudentResultsData) return;

            const selectedStudentId = document.getElementById('resultsStudentSelect')?.value || 'all';
            const filterType = document.getElementById('resultsFilterSelect')?.value || 'all';
            const sortType = document.getElementById('resultsSortSelect')?.value || 'name_asc';
            const classFilter = document.getElementById('resultsClassFilter')?.value || 'all';

            let filteredResults = [...window.allStudentResultsData];

            // Belirli öğrenci seçilmişse sadece onu göster
            if (selectedStudentId !== 'all') {
                filteredResults = filteredResults.filter(studentData =>
                    String(studentData.student.id) === String(selectedStudentId)
                );
            }

            // Apply class filter
            if (classFilter !== 'all') {
                filteredResults = filteredResults.filter(s => s.student.class === classFilter);
            }

            // Apply category filter
            switch (filterType) {
                case 'active':
                    filteredResults = filteredResults.filter(s => s.totalTests > 0);
                    break;
                case 'inactive':
                    filteredResults = filteredResults.filter(s => s.totalTests === 0);
                    break;
                case 'high_performers':
                    filteredResults = filteredResults.filter(s => s.averageScore >= 85);
                    break;
                case 'excellent_performers':
                    filteredResults = filteredResults.filter(s => s.averageScore >= 90);
                    break;
                case 'low_performers':
                    filteredResults = filteredResults.filter(s => s.totalTests > 0 && s.averageScore < 70);
                    break;
                case 'improving':
                    filteredResults = filteredResults.filter(s => s.improvementTrend === 'improving');
                    break;
                case 'declining':
                    filteredResults = filteredResults.filter(s => s.improvementTrend === 'declining');
                    break;
                case 'consistent':
                    filteredResults = filteredResults.filter(s => s.consistency === 'very_consistent' || s.consistency === 'consistent');
                    break;
                case 'inconsistent':
                    filteredResults = filteredResults.filter(s => s.consistency === 'inconsistent');
                    break;
                case 'pending':
                    filteredResults = filteredResults.filter(s => s.pendingTests > 0);
                    break;
                case 'recent_active':
                    filteredResults = filteredResults.filter(s => s.lastWeekTests > 0);
                    break;
            }

            // Apply sorting
            switch (sortType) {
                case 'name_desc':
                    filteredResults.sort((a, b) => b.student.name.localeCompare(a.student.name, 'tr'));
                    break;
                case 'average_desc':
                    filteredResults.sort((a, b) => b.averageScore - a.averageScore);
                    break;
                case 'average_asc':
                    filteredResults.sort((a, b) => a.averageScore - b.averageScore);
                    break;
                case 'test_count_desc':
                    filteredResults.sort((a, b) => b.totalTests - a.totalTests);
                    break;
                case 'test_count_asc':
                    filteredResults.sort((a, b) => a.totalTests - b.totalTests);
                    break;
                case 'recent_activity':
                    filteredResults.sort((a, b) => {
                        const aLastTest = a.results.length > 0 ? new Date(Math.max(...a.results.map(r => new Date(r.completed_at)))) : new Date(0);
                        const bLastTest = b.results.length > 0 ? new Date(Math.max(...b.results.map(r => new Date(r.completed_at)))) : new Date(0);
                        return bLastTest - aLastTest;
                    });
                    break;
                case 'improvement_desc':
                    filteredResults.sort((a, b) => {
                        const improvementOrder = { 'improving': 3, 'stable': 2, 'declining': 1 };
                        return (improvementOrder[b.improvementTrend] || 0) - (improvementOrder[a.improvementTrend] || 0);
                    });
                    break;
                case 'consistency_desc':
                    filteredResults.sort((a, b) => {
                        const consistencyOrder = { 'very_consistent': 4, 'consistent': 3, 'moderate': 2, 'inconsistent': 1 };
                        return (consistencyOrder[b.consistency] || 0) - (consistencyOrder[a.consistency] || 0);
                    });
                    break;
                case 'name_asc':
                default:
                    filteredResults.sort((a, b) => a.student.name.localeCompare(b.student.name, 'tr'));
                    break;
            }

            displayFilteredStudentResults(filteredResults);
        }

        // Update student filter info
        function updateStudentFilterInfo(filteredCount) {
            const totalCount = window.allStudentResultsData?.length || 0;
            const infoElement = document.getElementById('filterResultsInfo');
            
            if (!infoElement) return;
            
            const selectedStudentId = document.getElementById('resultsStudentSelect')?.value || 'all';
            const filterType = document.getElementById('resultsFilterSelect')?.value || 'all';
            const classFilter = document.getElementById('resultsClassFilter')?.value || 'all';
            const selectedStudentName = selectedStudentId !== 'all'
                ? (document.getElementById('resultsStudentSelect')?.options[document.getElementById('resultsStudentSelect')?.selectedIndex]?.text || '')
                : '';

            let infoText = '';
            if (selectedStudentName && filterType !== 'all') {
                infoText = `${selectedStudentName} — ${getStudentFilterDisplayName(filterType)}: ${filteredCount}/${totalCount} öğrenci`;
            } else if (selectedStudentName) {
                infoText = `${selectedStudentName} gösteriliyor`;
            } else if (filterType !== 'all' && classFilter !== 'all') {
                infoText = `${getStudentFilterDisplayName(filterType)} ve ${classFilter} sınıfı: ${filteredCount}/${totalCount} öğrenci`;
            } else if (filterType !== 'all') {
                infoText = `${getStudentFilterDisplayName(filterType)}: ${filteredCount}/${totalCount} öğrenci`;
            } else if (classFilter !== 'all') {
                infoText = `${classFilter} sınıfı: ${filteredCount}/${totalCount} öğrenci`;
            } else {
                infoText = `Tüm öğrenciler gösteriliyor: ${filteredCount} öğrenci`;
            }
            
            infoElement.querySelector('span').textContent = infoText;
        }

        // Get student filter display name
        function getStudentFilterDisplayName(filter) {
            const names = {
                'active': 'Test Çözenler',
                'inactive': 'Test Çözmeyenler',
                'high_performers': 'Yüksek Performans (≥85)',
                'excellent_performers': 'Mükemmel Performans (≥90)',
                'low_performers': 'Gelişmeli (<70)',
                'improving': 'Gelişen Öğrenciler',
                'declining': 'Düşen Performans',
                'consistent': 'Tutarlı Öğrenciler',
                'inconsistent': 'Değişken Performans',
                'pending': 'Bekleyen Testi Olanlar',
                'recent_active': 'Son Hafta Aktif'
            };
            return names[filter] || filter;
        }

        // Clear student filters
        function clearStudentFilters() {
            document.getElementById('resultsStudentSelect').value = 'all';
            document.getElementById('resultsFilterSelect').value = 'all';
            document.getElementById('resultsSortSelect').value = 'name_asc';
            document.getElementById('resultsClassFilter').value = 'all';
            filterStudentResults();
        }

        // Export student results (placeholder)
        async function exportStudentResults() {
            try {
                showNotification('Excel dosyası hazırlanıyor...', 'info');

                // Get all data
                const { data: students, error: studentsError } = await supabase
                    .from('students').select('*').order('name');
                if (studentsError) throw studentsError;

                const { data: results, error: resultsError } = await supabase
                    .from('test_results').select('*');
                if (resultsError) throw resultsError;

                const { data: tests, error: testsError } = await supabase
                    .from('tests').select('*');
                if (testsError) throw testsError;

                const { data: assignments, error: assignmentsError } = await supabase
                    .from('test_assignments').select('*');
                if (assignmentsError) throw assignmentsError;

                // Total active tests in the system
                const totalActiveTests = tests.length;

                // Create CSV content with UTF-8 BOM for proper Turkish character support in Excel
                let csvContent = '\uFEFF';
                
                // Header row
                csvContent += 'Öğrencinin Adı Soyadı,';
                csvContent += 'Başarılı Testler (≥70),';
                csvContent += 'Başarısız Testler (<70),';
                csvContent += 'Aktif Testler (Sistemdeki Toplam),';
                csvContent += 'Çözmediği Testler (Bekleyen),';
                csvContent += 'Öğrenciye Atanmamış Testler\n';

                // Process each student
                students.forEach(student => {
                    // Get student's completed tests
                    const studentResults = results.filter(r => r.student_id === student.id);
                    const completedTestIds = studentResults.map(r => r.test_id);
                    
                    // Calculate statistics
                    const successfulTests = studentResults.filter(r => r.score >= 70).length;
                    const failedTests = studentResults.filter(r => r.score < 70).length;
                    
                    // Find assigned and unsolved tests
                    const studentAssignments = assignments.filter(a => a.student_id === student.id);
                    const assignedTestIds = studentAssignments.map(a => a.test_id);
                    const unsolvedTestIds = assignedTestIds.filter(id => !completedTestIds.includes(id));
                    
                    // Get unsolved test names (assigned but not completed)
                    const unsolvedTestNames = unsolvedTestIds
                        .map(testId => {
                            const test = tests.find(t => t.id === testId);
                            return test ? test.title : `Test #${testId}`;
                        })
                        .join('; ');
                    
                    // Find unassigned tests (tests in system but not assigned to this student)
                    const allTestIds = tests.map(t => t.id);
                    const unassignedTestIds = allTestIds.filter(id => !assignedTestIds.includes(id));
                    
                    // Get unassigned test names
                    const unassignedTestNames = unassignedTestIds
                        .map(testId => {
                            const test = tests.find(t => t.id === testId);
                            return test ? test.title : `Test #${testId}`;
                        })
                        .join('; ');
                    
                    // Build CSV row
                    csvContent += `"${student.name}",`;
                    csvContent += `${successfulTests},`;
                    csvContent += `${failedTests},`;
                    csvContent += `${totalActiveTests},`;
                    csvContent += `"${unsolvedTestNames || 'Yok'}",`;
                    csvContent += `"${unassignedTestNames || 'Yok'}"\n`;
                });

                // Add summary section
                csvContent += '\n';
                csvContent += 'ÖZET İSTATİSTİKLER\n';
                csvContent += `Toplam Öğrenci Sayısı,${students.length}\n`;
                csvContent += `Sistemdeki Toplam Test Sayısı,${totalActiveTests}\n`;
                csvContent += `Çözülen Toplam Test,${results.length}\n`;
                
                const totalSuccessful = results.filter(r => r.score >= 70).length;
                const totalFailed = results.filter(r => r.score < 70).length;
                csvContent += `Başarılı Test Sayısı (≥70),${totalSuccessful}\n`;
                csvContent += `Başarısız Test Sayısı (<70),${totalFailed}\n`;
                
                const allScores = results.map(r => r.score);
                const classAvg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
                csvContent += `Sınıf Ortalaması,${classAvg}\n`;
                
                const totalPendingTests = assignments.length - results.length;
                csvContent += `Toplam Bekleyen Test,${totalPendingTests}\n`;

                // Create and download file
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                
                const timestamp = new Date().toISOString().slice(0, 10);
                link.setAttribute('href', url);
                link.setAttribute('download', `ogrenci-test-raporu-${timestamp}.csv`);
                link.style.visibility = 'hidden';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                showNotification('✅ Excel dosyası başarıyla indirildi!', 'success');

            } catch (error) {
                console.error('Excel export error:', error);
                showNotification('Excel dosyası oluşturulurken hata oluştu: ' + error.message, 'error');
            }
        }

        // Export student results as PDF
        async function exportStudentResultsPDF() {
            try {
                showNotification('PDF dosyası hazırlanıyor...', 'info');

                // Get all data
                const { data: students, error: studentsError } = await supabase
                    .from('students').select('*').order('name');
                if (studentsError) throw studentsError;

                const { data: results, error: resultsError } = await supabase
                    .from('test_results').select('*');
                if (resultsError) throw resultsError;

                const { data: tests, error: testsError } = await supabase
                    .from('tests').select('*');
                if (testsError) throw testsError;

                const { data: assignments, error: assignmentsError } = await supabase
                    .from('test_assignments').select('*');
                if (assignmentsError) throw assignmentsError;

                // Total active tests in the system
                const totalActiveTests = tests.length;

                // Create HTML content for PDF
                let htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Öğrenci Test Raporu</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            font-size: 12px;
        }
        h1 {
            color: #2563eb;
            text-align: center;
            margin-bottom: 10px;
        }
        .header-info {
            text-align: center;
            color: #666;
            margin-bottom: 20px;
            font-size: 11px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th {
            background-color: #2563eb;
            color: white;
            padding: 8px;
            text-align: left;
            font-size: 11px;
            border: 1px solid #1e40af;
        }
        td {
            padding: 6px 8px;
            border: 1px solid #ddd;
            font-size: 10px;
        }
        tr:nth-child(even) {
            background-color: #f9fafb;
        }
        .summary {
            background-color: #eff6ff;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
        }
        .summary h2 {
            color: #1e40af;
            margin-top: 0;
            font-size: 14px;
        }
        .summary-item {
            margin: 5px 0;
            font-size: 11px;
        }
        .summary-item strong {
            color: #1e40af;
        }
        .test-list {
            font-size: 9px;
            color: #666;
            max-width: 200px;
            word-wrap: break-word;
        }
    </style>

    <style>
        .shadow-soft {
            box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
        }
        .progress-bar-fill {
            transition: width 1s ease-in-out;
            background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
        }
        .day-indicator {
            width: 48px;
            height: 48px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            transition: all 0.2s;
        }
        .day-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-top: 4px;
        }
        /* Apple-esque Table Styles */
        .apple-table {
            border-collapse: separate;
            border-spacing: 0 8px;
            width: 100%;
        }
        .apple-table tr {
            background-color: white;
            transition: all 0.2s ease;
        }
        .apple-table tr:hover {
            transform: scale(1.002);
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .apple-table td {
            padding: 16px;
            border-top: 1px solid #f3f4f6;
            border-bottom: 1px solid #f3f4f6;
        }
        .apple-table td:first-child {
            border-left: 1px solid #f3f4f6;
            border-top-left-radius: 12px;
            border-bottom-left-radius: 12px;
        }
        .apple-table td:last-child {
            border-right: 1px solid #f3f4f6;
            border-top-right-radius: 12px;
            border-bottom-right-radius: 12px;
        }
        .pill-tag {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
            gap: 4px;
            min-width: 45px;
        }
        .pill-success { background-color: #10b981; color: white; }
        .pill-pending { background-color: #fef3c7; color: #92400e; }
        .pill-failed { background-color: #fee2e2; color: #b91c1c; }
        .pill-empty { background-color: #f3f4f6; color: #9ca3af; }
        
        /* Gelişmiş Matris Tablosu Stilleri */
        .matrix-table {
            border-collapse: collapse;
            width: 100%;
        }
        .matrix-table thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        .matrix-table th {
            padding: 12px 8px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #e5e7eb;
        }
        .matrix-table tbody tr {
            border-bottom: 1px solid #e5e7eb;
            transition: all 0.2s ease;
        }
        .matrix-table tbody tr:hover {
            background-color: #f9fafb;
            box-shadow: inset 0 0 10px rgba(102, 126, 234, 0.05);
        }
        .matrix-table td {
            padding: 10px 8px;
            font-size: 13px;
            text-align: center;
        }
        .matrix-table td:first-child {
            text-align: left;
            padding-left: 16px;
            font-weight: 600;
            color: #1f2937;
        }
        .student-name-cell {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 180px;
        }
        .student-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
        }
        .day-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            gap: 2px;
        }
        .day-pill.success {
            background-color: #d1fae5;
            color: #065f46;
            border: 1px solid #6ee7b7;
        }
        .day-pill.failed {
            background-color: #fee2e2;
            color: #991b1b;
            border: 1px solid #fca5a5;
        }
        .day-pill.pending {
            background-color: #fef3c7;
            color: #92400e;
            border: 1px solid #fcd34d;
        }
        .day-pill.empty {
            background-color: #f3f4f6;
            color: #9ca3af;
            border: 1px solid #d1d5db;
        }
        .activity-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            gap: 4px;
        }
        .badge-very-active {
            background: linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%);
            color: white;
        }
        .badge-active {
            background: linear-gradient(135deg, #51cf66 0%, #69db7c 100%);
            color: white;
        }
        .badge-inactive {
            background: linear-gradient(135deg, #ffd43b 0%, #ffe066 100%);
            color: #1f2937;
        }
        .reading-status {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
        }
        .reading-on-track {
            background-color: #d1fae5;
            color: #065f46;
        }
        .reading-behind {
            background-color: #fee2e2;
            color: #991b1b;
        }
        
        /* Durum Rozetleri */
        .status-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }
        .status-badge:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        }
        .badge-very-active {
            background: linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%);
            color: white;
        }
        .badge-very-active i {
            animation: flameFlicker 1.5s ease-in-out infinite;
        }
        @keyframes flameFlicker {
            0%, 100% { transform: scale(1) rotate(0deg); }
            25% { transform: scale(1.1) rotate(-2deg); }
            50% { transform: scale(0.95) rotate(2deg); }
            75% { transform: scale(1.05) rotate(-1deg); }
        }
        .badge-active {
            background: linear-gradient(135deg, #51cf66 0%, #69db7c 100%);
            color: white;
        }
        .badge-inactive {
            background: linear-gradient(135deg, #ffd43b 0%, #ffe066 100%);
            color: #1f2937;
        }
    </style>

</head>
<body>
    <h1>📊 Öğrenci Test Performans Raporu</h1>
    <div class="header-info">
        Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}<br>
        Türkçe Okuma Anlama Test Sistemi
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Öğrencinin Adı Soyadı</th>
                <th>Başarılı<br>Testler<br>(≥70)</th>
                <th>Başarısız<br>Testler<br>(<70)</th>
                <th>Aktif<br>Testler</th>
                <th>Çözmediği Testler (Bekleyen)</th>
                <th>Öğrenciye Atanmamış Testler</th>
            </tr>
        </thead>
        <tbody>
`;

                // Process each student
                students.forEach(student => {
                    // Get student's completed tests
                    const studentResults = results.filter(r => r.student_id === student.id);
                    const completedTestIds = studentResults.map(r => r.test_id);
                    
                    // Calculate statistics
                    const successfulTests = studentResults.filter(r => r.score >= 70).length;
                    const failedTests = studentResults.filter(r => r.score < 70).length;
                    
                    // Find assigned and unsolved tests
                    const studentAssignments = assignments.filter(a => a.student_id === student.id);
                    const assignedTestIds = studentAssignments.map(a => a.test_id);
                    const unsolvedTestIds = assignedTestIds.filter(id => !completedTestIds.includes(id));
                    
                    // Get unsolved test names
                    const unsolvedTestNames = unsolvedTestIds
                        .map(testId => {
                            const test = tests.find(t => t.id === testId);
                            return test ? test.title : `Test #${testId}`;
                        })
                        .join(', ');
                    
                    // Find unassigned tests
                    const allTestIds = tests.map(t => t.id);
                    const unassignedTestIds = allTestIds.filter(id => !assignedTestIds.includes(id));
                    
                    // Get unassigned test names
                    const unassignedTestNames = unassignedTestIds
                        .map(testId => {
                            const test = tests.find(t => t.id === testId);
                            return test ? test.title : `Test #${testId}`;
                        })
                        .join(', ');
                    
                    htmlContent += `
            <tr>
                <td><strong>${student.name}</strong></td>
                <td style="text-align: center; color: green;"><strong>${successfulTests}</strong></td>
                <td style="text-align: center; color: red;"><strong>${failedTests}</strong></td>
                <td style="text-align: center;"><strong>${totalActiveTests}</strong></td>
                <td class="test-list">${unsolvedTestNames || 'Yok'}</td>
                <td class="test-list">${unassignedTestNames || 'Yok'}</td>
            </tr>
`;
                });

                htmlContent += `
        </tbody>
    </table>
    
    <div class="summary">
        <h2>📈 Özet İstatistikler</h2>
        <div class="summary-item"><strong>Toplam Öğrenci Sayısı:</strong> ${students.length}</div>
        <div class="summary-item"><strong>Sistemdeki Toplam Test Sayısı:</strong> ${totalActiveTests}</div>
        <div class="summary-item"><strong>Çözülen Toplam Test:</strong> ${results.length}</div>
        <div class="summary-item"><strong>Başarılı Test Sayısı (≥70):</strong> ${results.filter(r => r.score >= 70).length}</div>
        <div class="summary-item"><strong>Başarısız Test Sayısı (<70):</strong> ${results.filter(r => r.score < 70).length}</div>
        <div class="summary-item"><strong>Sınıf Ortalaması:</strong> ${results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0}</div>
        <div class="summary-item"><strong>Toplam Bekleyen Test:</strong> ${assignments.length - results.length}</div>
    </div>
</body>
</html>
`;

                // Create a new window for printing
                const printWindow = window.open('', '_blank');
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                
                // Wait for content to load, then trigger print dialog
                setTimeout(() => {
                    printWindow.print();
                    showNotification('✅ PDF yazdırma penceresi açıldı! "PDF olarak kaydet" seçeneğini kullanın.', 'success');
                }, 500);

            } catch (error) {
                console.error('PDF export error:', error);
                showNotification('PDF dosyası oluşturulurken hata oluştu: ' + error.message, 'error');
            }
        }

        // Export individual student detail (placeholder)
        function exportStudentDetail(studentId) {
            showNotification('Öğrenci detay export özelliği yakında eklenecek.', 'info');
        }

        // Show simple results view as fallback
        async function showSimpleResults() {
            try {
                console.log('Loading simple results view...');
                
                const { data: results, error: resultsError } = await supabase
                    .from('test_results')
                    .select('*')
                    .order('completed_at', { ascending: false });
                if (resultsError) throw resultsError;

                const { data: students, error: studentsError } = await supabase
                    .from('students').select('*');
                if (studentsError) throw studentsError;

                const { data: tests, error: testsError } = await supabase
                    .from('tests').select('*');
                if (testsError) throw testsError;

                const container = document.getElementById('resultsList');
                container.innerHTML = `
                    <div class="mb-6">
                        <h3 class="text-lg font-bold text-gray-900 mb-4">📊 Test Sonuçları (Basit Görünüm)</h3>
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div>
                                    <div class="text-2xl font-bold text-blue-600">${students?.length || 0}</div>
                                    <div class="text-sm text-gray-600">Toplam Öğrenci</div>
                                </div>
                                <div>
                                    <div class="text-2xl font-bold text-green-600">${tests?.length || 0}</div>
                                    <div class="text-sm text-gray-600">Toplam Test</div>
                                </div>
                                <div>
                                    <div class="text-2xl font-bold text-purple-600">${results?.length || 0}</div>
                                    <div class="text-sm text-gray-600">Tamamlanan Test</div>
                                </div>
                                <div>
                                    <div class="text-2xl font-bold text-yellow-600">${results?.filter(r => r.score >= 70).length || 0}</div>
                                    <div class="text-sm text-gray-600">Başarılı Sonuç</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                if (!results || results.length === 0) {
                    container.innerHTML += `
                        <div class="text-center py-12">
                            <i class="fas fa-clipboard-list text-6xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500 text-lg">Henüz test sonucu bulunmuyor.</p>
                            <p class="text-gray-400 text-sm mt-2">Öğrenciler test çözdükçe sonuçlar burada görünecek.</p>
                        </div>
                    `;
                    return;
                }

                // Create lookup maps
                const studentLookup = {};
                students?.forEach(s => studentLookup[s.id] = s);
                
                const testLookup = {};
                tests?.forEach(t => testLookup[t.id] = t);

                // Display results in simple table format
                const resultsHtml = results.map(result => {
                    const student = studentLookup[result.student_id] || { name: 'Unknown Student', student_no: 'N/A', class: 'N/A' };
                    const test = testLookup[result.test_id] || { title: 'Unknown Test' };
                    
                    return `
                        <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div class="flex justify-between items-center">
                                <div class="flex-1">
                                    <div class="flex items-center space-x-3 mb-2">
                                        <div class="text-2xl">
                                            ${result.score === 100 ? '🏆' :
                                              result.score >= 90 ? '⭐' :
                                              result.score >= 70 ? '✅' : '📚'}
                                        </div>
                                        <div>
                                            <h4 class="font-semibold text-gray-900">${student.name}</h4>
                                            <p class="text-sm text-gray-600">No: ${student.student_no} | Sınıf: ${student.class}</p>
                                        </div>
                                    </div>
                                    <div class="text-sm text-gray-700">
                                        <strong>Test:</strong> ${test.title}
                                    </div>
                                    <div class="text-xs text-gray-500 mt-1">
                                        <i class="fas fa-calendar mr-1"></i>
                                        ${new Date(result.completed_at).toLocaleDateString('tr-TR', { 
                                            weekday: 'short', 
                                            year: 'numeric', 
                                            month: 'short', 
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-3xl font-bold ${
                                        result.score === 100 ? 'text-purple-600' :
                                        result.score >= 90 ? 'text-green-600' :
                                        result.score >= 70 ? 'text-blue-600' : 'text-red-600'
                                    }">${result.score}</div>
                                    <div class="text-sm font-medium ${
                                        result.score === 100 ? 'text-purple-600' :
                                        result.score >= 90 ? 'text-green-600' :
                                        result.score >= 70 ? 'text-blue-600' : 'text-red-600'
                                    }">
                                        ${result.score === 100 ? 'Mükemmel' :
                                          result.score >= 90 ? 'Harika' :
                                          result.score >= 70 ? 'Başarılı' : 'Gelişmeli'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                container.innerHTML += `
                    <div class="space-y-4">
                        ${resultsHtml}
                    </div>
                    
                    <div class="mt-8 text-center">
                        <button onclick="loadResultsList()" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-chart-bar mr-2"></i>Detaylı Görünüme Geç
                        </button>
                    </div>
                `;

                console.log('Simple results loaded successfully');

            } catch (error) {
                console.error('Error loading simple results:', error);
                showNotification('Basit görünüm yüklenirken hata oluştu.', 'error');
            }
        }

        // Display filtered results (legacy function - keeping for compatibility)
        function displayFilteredResults(results) {
            const container = document.getElementById('filteredResultsContainer');
            if (!container) return;
            
            container.innerHTML = '';

            if (results.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-search text-4xl text-gray-300 mb-3"></i>
                        <p class="text-gray-500">Arama kriterlerinize uygun sonuç bulunamadı.</p>
                    </div>
                `;
                return;
            }

            // Group results by test for better organization
            const resultsByTest = {};
            results.forEach(result => {
                const testId = result.test_id;
                if (!resultsByTest[testId]) {
                    resultsByTest[testId] = {
                        testInfo: result.tests,
                        results: []
                    };
                }
                resultsByTest[testId].results.push(result);
            });

            Object.values(resultsByTest).forEach(testGroup => {
                const testResults = testGroup.results;
                const testAverage = Math.round(testResults.reduce((sum, r) => sum + r.score, 0) / testResults.length);
                const testPassRate = Math.round((testResults.filter(r => r.score >= 70).length / testResults.length) * 100);

                // Test group header
                const testGroupDiv = document.createElement('div');
                testGroupDiv.className = 'mb-8';
                testGroupDiv.innerHTML = `
                    <div class="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
                        <!-- Test Header -->
                        <div class="bg-gradient-to-r from-gray-50 to-blue-50 p-4 border-b border-gray-200">
                            <div class="flex justify-between items-center">
                                <div>
                                    <h4 class="text-lg font-bold text-gray-900 flex items-center">
                                        <i class="fas fa-clipboard-list text-blue-600 mr-2"></i>
                                        ${testGroup.testInfo.title}
                                    </h4>
                                    <div class="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                                        <span><i class="fas fa-users mr-1"></i>${testResults.length} öğrenci</span>
                                        <span><i class="fas fa-clock mr-1"></i>${testGroup.testInfo.time_limit} dakika</span>
                                        <span><i class="fas fa-chart-line mr-1"></i>Ortalama: ${testAverage}</span>
                                        <span><i class="fas fa-percentage mr-1"></i>Başarı: %${testPassRate}</span>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <button onclick="exportTestResults(${testGroup.results[0].test_id})" 
                                            class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition duration-200">
                                        <i class="fas fa-download mr-1"></i>Excel
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Results List -->
                        <div class="divide-y divide-gray-100">
                `;

                // Sort results by score (highest first) within each test
                testResults.sort((a, b) => b.score - a.score);

                testResults.forEach((result, index) => {
                    const completedDate = new Date(result.completed_at);
                    const timeAgo = getTimeAgo(completedDate);
                    
                    // Determine performance level and styling
                    let performanceLevel, performanceColor, performanceIcon, rankIcon;
                    
                    if (result.score === 100) {
                        performanceLevel = 'Mükemmel';
                        performanceColor = 'text-purple-600 bg-purple-50 border-purple-200';
                        performanceIcon = '🏆';
                        rankIcon = '👑';
                    } else if (result.score >= 90) {
                        performanceLevel = 'Harika';
                        performanceColor = 'text-green-600 bg-green-50 border-green-200';
                        performanceIcon = '⭐';
                        rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🌟';
                    } else if (result.score >= 70) {
                        performanceLevel = 'Başarılı';
                        performanceColor = 'text-blue-600 bg-blue-50 border-blue-200';
                        performanceIcon = '👍';
                        rankIcon = '✅';
                    } else {
                        performanceLevel = 'Gelişmeli';
                        performanceColor = 'text-red-600 bg-red-50 border-red-200';
                        performanceIcon = '📚';
                        rankIcon = '📖';
                    }

                    const resultDiv = document.createElement('div');
                    resultDiv.className = 'p-4 hover:bg-gray-50 transition-colors duration-200';
                    resultDiv.innerHTML = `
                        <div class="flex items-center justify-between">
                            <!-- Left: Student Info -->
                            <div class="flex items-center space-x-4">
                                <div class="text-2xl">${rankIcon}</div>
                                <div>
                                    <div class="flex items-center space-x-2">
                                        <h5 class="font-semibold text-gray-900">${result.students.name}</h5>
                                        <span class="px-2 py-1 text-xs font-medium rounded-full border ${performanceColor}">
                                            ${performanceIcon} ${performanceLevel}
                                        </span>
                                    </div>
                                    <div class="flex items-center space-x-3 mt-1 text-sm text-gray-600">
                                        <span>No: ${result.students.student_no}</span>
                                        <span>Sınıf: ${result.students.class}</span>
                                        <span><i class="fas fa-calendar mr-1"></i>${timeAgo}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Right: Score and Actions -->
                            <div class="flex items-center space-x-4">
                                <!-- Score Display -->
                                <div class="text-center">
                                    <div class="text-3xl font-bold ${
                                        result.score === 100 ? 'text-purple-600' :
                                        result.score >= 90 ? 'text-green-600' :
                                        result.score >= 70 ? 'text-blue-600' : 'text-red-600'
                                    }">${result.score}</div>
                                    <div class="text-xs text-gray-600 font-medium">puan</div>
                                </div>

                                <!-- Action Button -->
                                <button onclick="showDetailedResult(${result.id})" 
                                        class="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition duration-200">
                                    <i class="fas fa-eye mr-1"></i>Detay
                                </button>
                            </div>
                        </div>
                    `;
                    
                    testGroupDiv.querySelector('.divide-y').appendChild(resultDiv);
                });

                testGroupDiv.innerHTML += `
                        </div>
                    </div>
                `;

                container.appendChild(testGroupDiv);
            });
        }

        // Filter results function
        function filterResults() {
            if (!window.allResultsData) return;

            const searchTerm = ''; // Öğrenci arama text input kaldırıldı, dropdown kullanılıyor
            const filterType = document.getElementById('resultsFilterSelect')?.value || 'all';
            const sortType = document.getElementById('resultsSortSelect')?.value || 'newest';

            let filteredResults = [...window.allResultsData];

            // Apply search filter
            if (searchTerm) {
                filteredResults = filteredResults.filter(result => 
                    result.student(s.student_name || s.name || '').toLowerCase().includes(searchTerm) ||
                    result.tests.title.toLowerCase().includes(searchTerm) ||
                    result.students.student_no.toLowerCase().includes(searchTerm)
                );
            }

            // Apply category filter
            switch (filterType) {
                case 'passed':
                    filteredResults = filteredResults.filter(result => result.score >= 70);
                    break;
                case 'failed':
                    filteredResults = filteredResults.filter(result => result.score < 70);
                    break;
                case 'excellent':
                    filteredResults = filteredResults.filter(result => result.score >= 90);
                    break;
                case 'perfect':
                    filteredResults = filteredResults.filter(result => result.score === 100);
                    break;
            }

            // Apply sorting
            switch (sortType) {
                case 'oldest':
                    filteredResults.sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
                    break;
                case 'highest_score':
                    filteredResults.sort((a, b) => b.score - a.score);
                    break;
                case 'lowest_score':
                    filteredResults.sort((a, b) => a.score - b.score);
                    break;
                case 'student_name':
                    filteredResults.sort((a, b) => a.students.name.localeCompare(b.students.name, 'tr'));
                    break;
                case 'newest':
                default:
                    filteredResults.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
                    break;
            }

            displayFilteredResults(filteredResults);
        }

        // Get time ago string
        function getTimeAgo(date) {
            const now = new Date();
            const diffInSeconds = Math.floor((now - date) / 1000);
            
            if (diffInSeconds < 60) return 'Az önce';
            if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dakika önce`;
            if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} saat önce`;
            if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} gün önce`;
            
            return date.toLocaleDateString('tr-TR');
        }

        // Show detailed result (placeholder for future implementation)
        function showDetailedResult(resultId) {
            showNotification('Detaylı sonuç görüntüleme özelliği yakında eklenecek.', 'info');
        }

        // Export test results to Excel (placeholder for future implementation)
        function exportTestResults(testId) {
            showNotification('Excel export özelliği yakında eklenecek.', 'info');
        }

        // Display student badges
        async function displayStudentBadges(badges) {
            const container = document.getElementById('studentBadges');
            container.innerHTML = '';

            // Tüm sonuçları çek (sayfalama ile)
            let allResults = [];
            let fromIdx = 0;
            while (true) {
                const { data: page } = await supabase
                    .from('test_results').select('*')
                    .eq('student_id', currentUser.id)
                    .order('completed_at', { ascending: false })
                    .range(fromIdx, fromIdx + 999);
                if (!page || page.length === 0) break;
                allResults = allResults.concat(page);
                if (page.length < 1000) break;
                fromIdx += 1000;
            }
            
            const totalTestCount = allResults.length;
            const successfulTestCount = allResults.filter(r => r.score >= 70).length;
            const hasHighScore = allResults.some(r => r.score >= 90);
            const hasPerfectScore = allResults.some(r => r.score === 100);

            const allBadges = [
                { type: 'first_step', name: '🐣 İlk Adım', description: 'İlk testi tamamla', requirement: 1, current: totalTestCount },
                { type: 'bright_star', name: '🌈 Parlak Yıldız', description: '90+ puan al', requirement: '90+ puan', current: hasHighScore ? 'Kazanıldı' : 'Henüz yok' },
                { type: 'perfect_hit', name: '🥇 Tam İsabet', description: '%100 puan al', requirement: '100 puan', current: hasPerfectScore ? 'Kazanıldı' : 'Henüz yok' },
                { type: 'speed_fingers', name: '⚡ Hızlı Parmaklar', description: 'Soru başına ort. 30sn altında bitir', requirement: '<30sn/soru', current: 'Süre bazlı' },
                { type: 'patient_hero', name: '🐢 Sabırlı Kahraman', description: '5 başarılı test', requirement: 5, current: successfulTestCount },
                { type: 'super_student', name: '🦸 Süper Öğrenci', description: '10 başarılı test', requirement: 10, current: successfulTestCount },
                { type: 'knowledge_dragon', name: '🐉 Bilgi Ejderhası', description: '25 başarılı test', requirement: 25, current: successfulTestCount },
                { type: 'shining_mind', name: '🌟 Parlayan Zihin', description: '50 başarılı test', requirement: 50, current: successfulTestCount },
                { type: 'class_leader', name: '👑 Sınıf Lideri', description: '100 başarılı test', requirement: 100, current: successfulTestCount },
                { type: 'book_worm', name: '📚🐛 Kitap Kurdu', description: '150 başarılı test', requirement: 150, current: successfulTestCount }
            ];

            allBadges.forEach(badge => {
                // Check if badge is earned based on actual conditions
                let earned = false;
                
                if (badge.type === 'first_step' && totalTestCount >= 1) earned = true;
                else if (badge.type === 'bright_star' && hasHighScore) earned = true;
                else if (badge.type === 'perfect_hit' && hasPerfectScore) earned = true;
                else if (badge.type === 'patient_hero' && successfulTestCount >= 5) earned = true;
                else if (badge.type === 'super_student' && successfulTestCount >= 10) earned = true;
                else if (badge.type === 'knowledge_dragon' && successfulTestCount >= 25) earned = true;
                else if (badge.type === 'shining_mind' && successfulTestCount >= 50) earned = true;
                else if (badge.type === 'class_leader' && successfulTestCount >= 100) earned = true;
                else if (badge.type === 'book_worm' && successfulTestCount >= 150) earned = true;
                else if (badges?.some(b => b.badge_type === badge.type)) earned = true;
                
                const progress = typeof badge.requirement === 'number' ? 
                    Math.min(100, (badge.current / badge.requirement) * 100) : 0;
                
                const badgeDiv = document.createElement('div');
                badgeDiv.className = `relative text-center p-6 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                    earned ? 'badge-earned' : 'badge-locked'
                } text-white cursor-pointer`;
                
                badgeDiv.innerHTML = `
                    <div class="text-4xl mb-3">${badge.name.split(' ')[0]}</div>
                    <h4 class="font-bold text-sm mb-1">${badge.name.substring(2)}</h4>
                    <p class="text-xs opacity-90 mb-2">${badge.description}</p>
                    
                    ${!earned && typeof badge.requirement === 'number' ? `
                        <div class="mt-3">
                            <div class="bg-black bg-opacity-20 rounded-full h-2 mb-1">
                                <div class="bg-white rounded-full h-2 transition-all duration-300" style="width: ${progress}%"></div>
                            </div>
                            <div class="text-xs opacity-75">${badge.current}/${badge.requirement}</div>
                        </div>
                    ` : earned ? `
                        <div class="mt-3">
                            <div class="text-xs font-bold opacity-90">✨ KAZANILDI ✨</div>
                        </div>
                    ` : ''}
                    
                    ${earned ? `
                        <div class="absolute -top-2 -right-2 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center">
                            <i class="fas fa-check text-xs text-white"></i>
                        </div>
                    ` : ''}
                `;
                
                container.appendChild(badgeDiv);
            });
        }
        // Global leaderboard data to avoid re-fetching
        window.currentLeaderboardData = [];
        window.currentStarMode = 'weekly'; // Default

        // Ogrenci Paneli Podyum Fonksiyonlari
        function switchStarTab(mode) {
            window.currentStarMode = mode;
            const weeklyBtn = document.getElementById('starTabWeekly');
            const monthlyBtn = document.getElementById('starTabMonthly');
            
            if (mode === 'weekly') {
                weeklyBtn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm');
                weeklyBtn.classList.remove('text-white', 'hover:bg-white/5');
                monthlyBtn.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm');
                monthlyBtn.classList.add('text-white', 'hover:bg-white/5');
                document.getElementById('starListTitle').innerHTML = '<i class="fas fa-star mr-2 text-yellow-400"></i>Haftanın Yıldızları';
                document.getElementById('starPeriodName').textContent = 'Bu Hafta';
                document.getElementById('starHintText').textContent = 'Bu hafta en çok test çözen ve en yüksek puanı alan ilk 5 öğrenci "Haftanın Yıldızı" seçilir.';
            } else {
                monthlyBtn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm');
                monthlyBtn.classList.remove('text-white', 'hover:bg-white/5');
                weeklyBtn.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm');
                weeklyBtn.classList.add('text-white', 'hover:bg-white/5');
                document.getElementById('starListTitle').innerHTML = '<i class="fas fa-medal mr-2 text-yellow-400"></i>Ayın Yıldızları';
                const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                document.getElementById('starPeriodName').textContent = monthNames[new Date().getMonth()];
                document.getElementById('starHintText').textContent = 'Bu ay en çok test çözen ve en yüksek puanı alan ilk 3 öğrenci "Ayın Yıldızı" seçilir.';
            }
            
            renderStarList();
        }

        async function renderStarList() {
            const starsContainer = document.getElementById('starListContent');
            if (!starsContainer) return;
            
            starsContainer.innerHTML = '<div class="text-center py-8 text-white/50"><i class="fas fa-spinner fa-spin mr-2"></i>Veriler yükleniyor...</div>';
            
            let data = window.currentLeaderboardData;
            
            if (!data || data.length === 0) {
                try {
                    const { data: perfData, error } = await supabase
                        .from('student_all_period_stats')
                        .select('*')
                        .limit(50);
                    if (error) throw error;
                    data = perfData || [];
                    window.currentLeaderboardData = data;
                } catch (err) {
                    console.error('Veri çekme hatası:', err);
                    starsContainer.innerHTML = '<div class="text-center py-8 text-white/50">Veriler yüklenemedi.</div>';
                    return;
                }
            }
            
            if (!data || data.length === 0) {
                starsContainer.innerHTML = '<div class="text-center py-8 text-white/50">Veri bulunamadı.</div>';
                return;
            }

            const sortedData = [...data].sort((a, b) => {
                let valA = 0, valB = 0;
                if (window.currentStarMode === 'weekly') {
                    valA = a.current_weekly_total_tests || 0;
                    valB = b.current_weekly_total_tests || 0;
                } else {
                    valA = a.monthly_total_tests || 0;
                    valB = b.monthly_total_tests || 0;
                }
                if (valB !== valA) return valB - valA;
                return (b.average_score || 0) - (a.average_score || 0);
            });

            const limit = window.currentStarMode === 'weekly' ? 5 : 3;
            const topStudents = sortedData.slice(0, limit);
            
            starsContainer.innerHTML = '';
            topStudents.forEach((student, index) => {
                let count = 0;
                if (window.currentStarMode === 'weekly') {
                    count = student.current_weekly_total_tests || 0;
                } else {
                    count = student.monthly_total_tests || 0;
                }
                const colors = [
                    'from-yellow-300 to-yellow-500', 
                    'from-gray-200 to-gray-400',    
                    'from-orange-300 to-orange-500', 
                    'from-blue-300 to-blue-500',    
                    'from-green-300 to-green-500'   
                ];
                const icons = ['👑', '🥈', '🥉', '4', '5'];
                const roundedScore = Math.round(parseFloat(student.average_score) || 0);
                
                const starDiv = document.createElement('div');
                starDiv.className = 'flex items-center space-x-4 bg-white/10 p-4 rounded-xl border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/20';
                starDiv.innerHTML = `
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br ${colors[index]} flex items-center justify-center text-xl shadow-lg font-bold">
                        ${icons[index]}
                    </div>
                    <div class="flex-1">
                        <div class="font-bold text-white truncate text-sm">${student.student_name || student.name || 'İsimsiz Öğrenci'}</div>
                        <div class="text-[10px] text-indigo-200 uppercase tracking-wider">${count} Okuma</div>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-yellow-400 text-base">${roundedScore}</div>
                        <div class="text-[9px] text-indigo-300 uppercase font-bold">Puan</div>
                    </div>
                `;
                starsContainer.appendChild(starDiv);
            });
        }

        // Ogrenci Paneli Podyum Fonksiyonlari Bitti
        // ============================================
        // Ogrenci Paneli Podyum Fonksiyonlari Bitti
        // ============================================

        // OGRETMEN PANELI PODYUM FONKSIYONLARI
        window.teacherStarMode = 'current_weekly';
        window.teacherLeaderboardData = [];

        function switchTeacherStarMode(mode) {
            window.teacherStarMode = mode;
            const currentWeeklyBtn = document.getElementById('teacherCurrentWeeklyStarBtn');
            const lastWeeklyBtn = document.getElementById('teacherLastWeeklyStarBtn');
            const monthlyBtn = document.getElementById('teacherMonthlyStarBtn');
            
            // Tum butonlari resetle
            [currentWeeklyBtn, lastWeeklyBtn, monthlyBtn].forEach(btn => {
                if (btn) {
                    btn.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm');
                    btn.classList.add('text-white', 'hover:bg-white/10');
                }
            });
            
            if (mode === 'current_weekly') {
                if (currentWeeklyBtn) {
                    currentWeeklyBtn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm');
                    currentWeeklyBtn.classList.remove('text-white', 'hover:bg-white/10');
                }
                document.getElementById('teacherStarHintText').textContent = 'Bu hafta en cok test cozen ve en yuksek puani alan ilk 5 ogrenci Haftanin Yildizi secilir.';
            } else if (mode === 'last_weekly') {
                if (lastWeeklyBtn) {
                    lastWeeklyBtn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm');
                    lastWeeklyBtn.classList.remove('text-white', 'hover:bg-white/10');
                }
                document.getElementById('teacherStarHintText').textContent = 'Gecen hafta en cok test cozen ve en yuksek puani alan ilk 5 ogrenci Haftanin Yildizi secilir.';
            } else if (mode === 'monthly') {
                if (monthlyBtn) {
                    monthlyBtn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm');
                    monthlyBtn.classList.remove('text-white', 'hover:bg-white/10');
                }
                document.getElementById('teacherStarHintText').textContent = 'Bu ay en cok test cozen ve en yuksek puani alan ilk 3 ogrenci Ayin Yildizi secilir.';
            }
            
            renderTeacherStarList();
        }

        async function renderTeacherStarList() {
            const starsContainer = document.getElementById('teacherStarListContent');
            if (!starsContainer) return;
            
            starsContainer.innerHTML = '';
            
            let data = window.teacherLeaderboardData;
            
            if (!data || data.length === 0) {
                try {
                    const { data: perfData, error } = await supabase
                        .from('student_all_period_stats')
                        .select('*')
                        .limit(50);
                    if (error) throw error;
                    data = perfData || [];
                    window.teacherLeaderboardData = data;
                } catch (err) {
                    console.error('Veri cekme hatasi:', err);
                    starsContainer.innerHTML = '<div class="text-center py-8 text-white/50">Veriler yukleniyor...</div>';
                    return;
                }
            }
            
            if (!data || data.length === 0) {
                starsContainer.innerHTML = '<div class="text-center py-8 text-white/50">Veri bulunamadi.</div>';
                return;
            }

            const sortedData = [...data].sort((a, b) => {
                let valA = 0, valB = 0;
                if (window.teacherStarMode === 'current_weekly') {
                    valA = a.current_weekly_total_tests || 0;
                    valB = b.current_weekly_total_tests || 0;
                } else if (window.teacherStarMode === 'last_weekly') {
                    valA = a.last_weekly_total_tests || 0;
                    valB = b.last_weekly_total_tests || 0;
                } else {
                    valA = a.monthly_total_tests || 0;
                    valB = b.monthly_total_tests || 0;
                }
                if (valB !== valA) return valB - valA;
                return (b.average_score || 0) - (a.average_score || 0);
            });

            const limit = (window.teacherStarMode === 'current_weekly' || window.teacherStarMode === 'last_weekly') ? 5 : 3;
            const topStudents = sortedData.slice(0, limit);

            topStudents.forEach((student, index) => {
                let count = 0;
                if (window.teacherStarMode === 'current_weekly') {
                    count = student.current_weekly_total_tests || 0;
                } else if (window.teacherStarMode === 'last_weekly') {
                    count = student.last_weekly_total_tests || 0;
                } else {
                    count = student.monthly_total_tests || 0;
                }
                const colors = [
                    'from-yellow-300 to-yellow-500',
                    'from-gray-200 to-gray-400',
                    'from-orange-300 to-orange-500',
                    'from-blue-300 to-blue-500',
                    'from-green-300 to-green-500'
                ];
                const icons = ['👑', '🥈', '🥉', '4', '5'];
                
                const avgScore = parseFloat(student.average_score) || 0;
                const roundedScore = Math.round(avgScore);
                
                const starDiv = document.createElement('div');
                starDiv.className = 'flex items-center space-x-4 bg-white/10 p-4 rounded-xl border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/20';
                starDiv.innerHTML = `
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br ${colors[index]} flex items-center justify-center text-xl shadow-lg font-bold">
                        ${icons[index]}
                    </div>
                    <div class="flex-1">
                        <div class="font-bold text-white truncate text-sm">${student.student_name || 'Isimsiz Ogrenci'}</div>
                        <div class="text-[10px] text-indigo-200 uppercase tracking-wider">${count} Okuma</div>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-yellow-400 text-base">${isNaN(roundedScore) ? '-' : roundedScore}</div>
                        <div class="text-[9px] text-indigo-300 uppercase font-bold">Puan</div>
                    </div>
                `;
                starsContainer.appendChild(starDiv);
            });
        }

        // Load leaderboard by querying the 'leaderboard_stats' view (Optimized)
        async function loadLeaderboard() {
            try {
                // 1. Genel Liste için 'leaderboard_stats' sorgula (Eskisi gibi kalsın)
                const { data: generalLeaderboard, error: genError } = await supabase
                    .from('leaderboard_stats')
                    .select('*')
                    .order('successful_tests_count', { ascending: false })
                    .order('average_score', { ascending: false })
                    .limit(30);

                // 2. Yıldızlar Podyumu için Performans verilerini sorgula (Öğretmen paneli mantığı)
                const { data: performanceData, error: perfError } = await supabase
                    .from('student_all_period_stats')
                    .select('*')
                    .limit(50);

                if (genError) {
                    console.warn("leaderboard_stats görünümü sorgulanamadı, eski yönteme geçiliyor.");
                    return await loadLeaderboardLegacy();
                }

                window.currentLeaderboardData = performanceData || [];

                // Yıldızlar Listesini Render Et (Performans verilerine göre)
                renderStarList();

                // Öğrenci sayısını güncelle
                if (document.getElementById('leaderboardStudentCount')) {
                    document.getElementById('leaderboardStudentCount').textContent = generalLeaderboard.length;
                }

                const container = document.getElementById('leaderboardList');
                container.innerHTML = '';

                if (generalLeaderboard.length === 0) {
                    container.innerHTML = `
                        <div class="text-center py-12">
                            <i class="fas fa-trophy text-6xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500 text-lg">Henüz liderlik tablosu verisi bulunmuyor.</p>
                        </div>
                    `;
                    return;
                }

                // Genel Liste Arayüzünü oluşturma (Eski verilerle)
                addLeaderboardHeader(container);

                generalLeaderboard.forEach((student, index) => {
                    const position = index + 1;
                    const isCurrentUser = currentUser.type === 'student' && student.student_id === currentUser.id;
                    
                    const averageScore = Math.round(student.average_score || 0);

                    // Performans seviyesini belirle
                    let performanceLevel, performanceIcon, performanceColor;
                    if (averageScore >= 95) {
                        performanceLevel = 'Mükemmel'; performanceIcon = '🔥'; performanceColor = 'text-red-600 bg-red-50';
                    } else if (averageScore >= 90) {
                        performanceLevel = 'Harika'; performanceIcon = '⭐'; performanceColor = 'text-yellow-600 bg-yellow-50';
                    } else if (averageScore >= 80) {
                        performanceLevel = 'İyi'; performanceIcon = '👍'; performanceColor = 'text-green-600 bg-green-50';
                    } else {
                        performanceLevel = 'Gelişiyor'; performanceIcon = '📚'; performanceColor = 'text-blue-600 bg-blue-50';
                    }

                    // Madalya ve sıralama ikonu
                    let medalColor, medalIcon;
                    if (position === 1) { medalColor = 'bg-gradient-to-br from-yellow-400 to-yellow-600'; medalIcon = '👑'; } 
                    else if (position === 2) { medalColor = 'bg-gradient-to-br from-gray-300 to-gray-500'; medalIcon = '🥈'; } 
                    else if (position === 3) { medalColor = 'bg-gradient-to-br from-orange-400 to-orange-600'; medalIcon = '🥉'; } 
                    else { medalColor = 'bg-gradient-to-br from-blue-400 to-blue-600'; medalIcon = position.toString(); }
                    
                    const studentDiv = document.createElement('div');
                    studentDiv.className = `mb-4 p-5 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${isCurrentUser ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-md' : 'bg-white border-gray-200 hover:border-gray-300'}`;
                    
                    studentDiv.innerHTML = `
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-4">
                                <div class="relative">
                                    <div class="w-12 h-12 rounded-full ${medalColor} flex items-center justify-center text-white font-bold shadow-lg">${medalIcon}</div>
                                </div>
                                <div>
                                    <div class="flex items-center space-x-2">
                                        <h4 class="font-bold text-lg text-gray-900">${student.student_name}</h4>
                                        ${isCurrentUser ? '<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">SEN</span>' : ''}
                                    </div>
                                    <div class="flex items-center space-x-3 mt-1">
                                        <span class="px-2 py-1 rounded-full text-xs font-medium ${performanceColor}">${performanceIcon} ${performanceLevel}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-3xl font-bold ${averageScore >= 90 ? 'text-green-600' : 'text-blue-600'}">${averageScore}</div>
                                <div class="text-sm text-gray-600 font-medium">Ortalama Puan</div>
                            </div>
                        </div>
                        <div class="mt-4 pt-4 border-t border-gray-100">
                            <div class="grid grid-cols-3 gap-3 text-center">
                                <div class="bg-green-50 rounded-lg p-3 border-2 border-green-200">
                                    <div class="text-xl font-bold text-green-700">${student.successful_tests_count || 0} ✅</div>
                                    <div class="text-xs text-green-700 font-medium">Başarılı Test</div>
                                </div>
                                <div class="bg-yellow-50 rounded-lg p-3">
                                    <div class="text-xl font-bold text-yellow-700">${student.perfect_scores_count || 0} 💯</div>
                                    <div class="text-xs text-yellow-700 font-medium">Tam Puan</div>
                                </div>
                                <div class="bg-purple-50 rounded-lg p-3">
                                    <div class="text-xl font-bold text-purple-700">${student.harika_count || 0} ⭐</div>
                                    <div class="text-xs text-purple-700 font-medium">Harika (90-99)</div>
                                </div>
                            </div>
                        </div>
                    `;
                    container.appendChild(studentDiv);
                });

            } catch (error) {
                console.error('Liderlik tablosu yüklenirken hata oluştu:', error);
                const container = document.getElementById('leaderboardList');
                container.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-3"></i>
                        <p class="text-red-600">Liderlik tablosu yüklenirken bir hata oluştu.</p>
                        <p class="text-sm text-gray-500 mt-2">${error.message}</p>
                    </div>
                `;
            }
        }

        // Liderlik tablosu için başlık ve açıklama ekleyen yardımcı fonksiyon
        function addLeaderboardHeader(container) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100';
            headerDiv.innerHTML = `
                <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center">
                    <i class="fas fa-trophy text-yellow-500 mr-2"></i>
                    Liderlik Tablosu
                </h3>
                <div class="mb-4 p-3 bg-blue-100 border border-blue-200 rounded-lg">
                    <h4 class="font-semibold text-blue-900 mb-2 flex items-center">
                        🏆 Yeni Sıralama Sistemi
                    </h4>
                    <div class="text-sm text-blue-800 space-y-1">
                        <div><strong>Öncelik:</strong> Başarılı (70 puan ve üzeri) Test Sayısı</div>
                        <div><strong>Eşitlik Durumunda:</strong> Ortalama Puan</div>
                        <div class="mt-2 pt-2 border-t border-blue-200 flex items-center gap-2">
                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-200 text-blue-900 border border-blue-300">📝 Sadece Normal Testler</span>
                            <span class="text-xs text-blue-700">Sınav ve Alıştırma testleri sayılmaz</span>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(headerDiv);
        }

        // Güvenlik ağı olarak eski fonksiyonu yeniden adlandırarak saklayalım
        async function loadLeaderboardLegacy() {
            try {
                // Sadece normal tipindeki testlerin sonuçlarını al
                const { data: normalTests, error: ntError } = await supabase
                    .from('tests')
                    .select('id')
                    .or('test_type.eq.normal,test_type.is.null');

                const normalTestIds = (normalTests || []).map(t => t.id);

                const { data: results, error } = await supabase
                    .from('test_results')
                    .select('*, students(name)')
                    .in('test_id', normalTestIds.length > 0 ? normalTestIds : [0]);

                if (error) throw error;

                const stats = {};
                results.forEach(r => {
                    const id = r.student_id;
                    if (!stats[id]) {
                        stats[id] = { student_id: id, student_name: r.students?.name || 'İsimsiz', scores: [], successful: 0 };
                    }
                    stats[id].scores.push(r.score);
                    if (r.score >= 70) stats[id].successful++;
                });

                const leaderboard = Object.values(stats).map(s => ({
                    ...s,
                    average_score: s.scores.reduce((a, b) => a + b, 0) / s.scores.length,
                    successful_tests_count: s.successful
                })).sort((a, b) => b.successful_tests_count - a.successful_tests_count || b.average_score - a.average_score);

                const container = document.getElementById('leaderboardList');
                if (container) {
                    container.innerHTML = '<p class="text-center py-4 text-gray-500">Liderlik tablosu (Legacy Modu — Sadece Normal Testler)</p>';
                    leaderboard.slice(0, 15).forEach((s, i) => {
                        const div = document.createElement('div');
                        div.className = 'p-4 bg-white border rounded-lg mb-2 flex justify-between items-center';
                        div.innerHTML = `<span>${i+1}. ${s.student_name}</span> <b>${s.successful_tests_count} Başarılı</b>`;
                        container.appendChild(div);
                    });
                }
            } catch (err) {
                console.error("Legacy leaderboard error:", err);
            }
        }

        // ── Sınav & Alıştırma Liderlik Tablosu ────────────────────────────────
        async function loadSinavLeaderboard(tip = 'sinav') {
            const list = document.getElementById('sinavLiderList');
            const yukleniyor = document.getElementById('sinavLiderYukleniyor');
            const sinavBtn = document.getElementById('sinavLiderBtn');
            const alistirmaBtn = document.getElementById('alistirmaLiderBtn');

            if (!list) return;

            // Buton stillerini güncelle
            if (tip === 'sinav') {
                sinavBtn.className = 'px-5 py-2 rounded-full text-sm font-semibold bg-orange-500 text-white shadow transition';
                alistirmaBtn.className = 'px-5 py-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700 transition';
            } else {
                alistirmaBtn.className = 'px-5 py-2 rounded-full text-sm font-semibold bg-green-500 text-white shadow transition';
                sinavBtn.className = 'px-5 py-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700 transition';
            }

            list.innerHTML = '';
            if (yukleniyor) yukleniyor.classList.remove('hidden');

            try {
                // Bu tipteki testlerin ID'lerini al
                const { data: testler } = await supabase
                    .from('tests')
                    .select('id, title')
                    .eq('test_type', tip);

                const testIds = (testler || []).map(t => t.id);

                if (testIds.length === 0) {
                    if (yukleniyor) yukleniyor.classList.add('hidden');
                    list.innerHTML = `
                        <div class="text-center py-12">
                            <i class="fas fa-trophy text-6xl text-gray-200 mb-4"></i>
                            <p class="text-gray-400 text-lg">${tip === 'sinav' ? 'Henüz sınav testi' : 'Henüz alıştırma testi'} bulunmuyor.</p>
                            <p class="text-gray-300 text-sm mt-1">Test yüklerken tip seçmeyi unutmayın.</p>
                        </div>`;
                    return;
                }

                // Bu testlere ait sonuçları öğrencilerle birlikte çek
                const { data: results } = await supabase
                    .from('test_results')
                    .select('*, students(name)')
                    .in('test_id', testIds);

                if (yukleniyor) yukleniyor.classList.add('hidden');

                if (!results || results.length === 0) {
                    list.innerHTML = `
                        <div class="text-center py-12">
                            <i class="fas fa-trophy text-6xl text-gray-200 mb-4"></i>
                            <p class="text-gray-400 text-lg">Henüz sonuç bulunmuyor.</p>
                        </div>`;
                    return;
                }

                // Öğrenci bazlı grupla
                const stats = {};
                results.forEach(r => {
                    const id = r.student_id;
                    if (!stats[id]) {
                        stats[id] = {
                            student_id: id,
                            student_name: r.students?.name || 'İsimsiz',
                            scores: [],
                            successful: 0,
                            perfect: 0,
                            harika: 0
                        };
                    }
                    stats[id].scores.push(r.score);
                    if (r.score >= 70) stats[id].successful++;
                    if (r.score === 100) stats[id].perfect++;
                    if (r.score >= 90 && r.score <= 99) stats[id].harika++;
                });

                const leaderboard = Object.values(stats)
                    .map(s => ({
                        ...s,
                        average_score: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length),
                        successful_tests_count: s.successful,
                        perfect_scores_count: s.perfect,
                        harika_count: s.harika
                    }))
                    .sort((a, b) => b.successful_tests_count - a.successful_tests_count || b.average_score - a.average_score);

                // Başlık
                const tipRenk = tip === 'sinav' ? 'orange' : 'green';
                const tipLabel = tip === 'sinav' ? '📋 Sınav' : '🔧 Alıştırma';
                const headerDiv = document.createElement('div');
                headerDiv.className = `mb-6 p-4 bg-${tipRenk}-50 rounded-xl border border-${tipRenk}-100`;
                headerDiv.innerHTML = `
                    <h3 class="text-lg font-bold text-gray-800 mb-2 flex items-center">
                        <i class="fas fa-trophy text-${tipRenk}-500 mr-2"></i>${tipLabel} Liderlik Tablosu
                    </h3>
                    <div class="text-sm text-gray-600 space-y-1">
                        <div><strong>Sıralama:</strong> Başarılı test sayısı (70 puan ve üzeri)</div>
                        <div><strong>Eşitlikte:</strong> Ortalama puan</div>
                        <div><strong>Toplam öğrenci:</strong> ${leaderboard.length}</div>
                    </div>`;
                list.appendChild(headerDiv);

                // Kartlar
                leaderboard.forEach((student, index) => {
                    const position = index + 1;
                    const avg = student.average_score;

                    let performanceLevel, performanceIcon, performanceColor;
                    if (avg >= 95) { performanceLevel = 'Mükemmel'; performanceIcon = '🔥'; performanceColor = 'text-red-600 bg-red-50'; }
                    else if (avg >= 90) { performanceLevel = 'Harika'; performanceIcon = '⭐'; performanceColor = 'text-yellow-600 bg-yellow-50'; }
                    else if (avg >= 80) { performanceLevel = 'İyi'; performanceIcon = '👍'; performanceColor = 'text-green-600 bg-green-50'; }
                    else { performanceLevel = 'Gelişiyor'; performanceIcon = '📚'; performanceColor = 'text-blue-600 bg-blue-50'; }

                    let medalColor, medalIcon;
                    if (position === 1) { medalColor = 'bg-gradient-to-br from-yellow-400 to-yellow-600'; medalIcon = '👑'; }
                    else if (position === 2) { medalColor = 'bg-gradient-to-br from-gray-300 to-gray-500'; medalIcon = '🥈'; }
                    else if (position === 3) { medalColor = 'bg-gradient-to-br from-orange-400 to-orange-600'; medalIcon = '🥉'; }
                    else { medalColor = 'bg-gradient-to-br from-blue-400 to-blue-600'; medalIcon = position.toString(); }

                    const card = document.createElement('div');
                    card.className = 'mb-4 p-5 rounded-xl border-2 bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300';
                    card.innerHTML = `
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-4">
                                <div class="w-12 h-12 rounded-full ${medalColor} flex items-center justify-center text-white font-bold shadow-lg">${medalIcon}</div>
                                <div>
                                    <div class="flex items-center space-x-2">
                                        <h4 class="font-bold text-lg text-gray-900">${student.student_name}</h4>
                                    </div>
                                    <div class="flex items-center space-x-3 mt-1">
                                        <span class="px-2 py-1 rounded-full text-xs font-medium ${performanceColor}">${performanceIcon} ${performanceLevel}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-3xl font-bold ${avg >= 90 ? 'text-green-600' : 'text-blue-600'}">${avg}</div>
                                <div class="text-sm text-gray-600 font-medium">Ortalama Puan</div>
                            </div>
                        </div>
                        <div class="mt-4 pt-4 border-t border-gray-100">
                            <div class="grid grid-cols-3 gap-3 text-center">
                                <div class="bg-green-50 rounded-lg p-3 border-2 border-green-200">
                                    <div class="text-xl font-bold text-green-700">${student.successful_tests_count} ✅</div>
                                    <div class="text-xs text-green-700 font-medium">Başarılı Test</div>
                                </div>
                                <div class="bg-yellow-50 rounded-lg p-3">
                                    <div class="text-xl font-bold text-yellow-700">${student.perfect_scores_count} 💯</div>
                                    <div class="text-xs text-yellow-700 font-medium">Tam Puan</div>
                                </div>
                                <div class="bg-purple-50 rounded-lg p-3">
                                    <div class="text-xl font-bold text-purple-700">${student.harika_count} ⭐</div>
                                    <div class="text-xs text-purple-700 font-medium">Harika (90-99)</div>
                                </div>
                            </div>
                        </div>
                    `;
                    list.appendChild(card);
                });

            } catch (err) {
                if (yukleniyor) yukleniyor.classList.add('hidden');
                console.error('Sınav liderliği hatası:', err);
                list.innerHTML = `<p class="text-red-500 text-center py-8">Yüklenirken hata oluştu: ${err.message}</p>`;
            }
        }
        // ──────────────────────────────────────────────────────────────────────

        // ── Test Tipi Yardımcı Fonksiyonlar ────────────────────────────────────
        function getTestTypeBadge(testType) {
            const types = {
                'normal':       { label: 'Normal',       icon: '📝', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
                'sinav':        { label: 'Sınav',        icon: '📋', cls: 'bg-orange-100 text-orange-800 border-orange-200' },
                'alistirma':    { label: 'Alıştırma',    icon: '🔧', cls: 'bg-green-100 text-green-800 border-green-200' },
                'deneme':       { label: 'Deneme',       icon: '🔬', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
                'cevap_kagidi': { label: 'Cevap Kağıdı', icon: '📄', cls: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
            };
            const t = types[testType] || types['normal'];
            return `<span class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${t.cls} ml-2">${t.icon} ${t.label}</span>`;
        }

        function updateTestTypeLabels() {
            document.querySelectorAll('.test-type-label').forEach(label => {
                const val = label.dataset.value;
                const radio = label.querySelector('input[type="radio"]');
                if (radio && radio.checked) {
                    label.classList.add('border-blue-400', 'bg-blue-50');
                    label.classList.remove('border-gray-200', 'bg-white');
                } else {
                    label.classList.remove('border-blue-400', 'bg-blue-50');
                    label.classList.add('border-gray-200', 'bg-white');
                }
            });
            toggleOptionCountSelector();
        }

        function toggleOptionCountSelector() {
            const selector = document.getElementById('optionCountSelector');
            if (!selector) return;
            const isCK = document.querySelector('input[name="testType"]:checked')?.value === 'cevap_kagidi';
            selector.classList.toggle('hidden', !isCK);
        }

        // Seçenek sayısı label aktif/pasif stili
        document.addEventListener('change', function(e) {
            if (e.target && e.target.name === 'optionCount') {
                document.querySelectorAll('.ck-opt-count-label').forEach(lbl => {
                    const inp = lbl.querySelector('input');
                    if (inp && inp.checked) {
                        lbl.classList.add('border-cyan-400', 'bg-cyan-50');
                        lbl.classList.remove('border-gray-200', 'bg-white');
                    } else {
                        lbl.classList.remove('border-cyan-400', 'bg-cyan-50');
                        lbl.classList.add('border-gray-200', 'bg-white');
                    }
                });
            }
        });
        // ──────────────────────────────────────────────────────────────────────

        // ══════════════════════════════════════════════════════════════════════
        // OPTİK FORM SONUÇ TABLOSU — Alıştırma & Sınav testleri için
        // Test kartında "📊 Sonuçları Göster" butonuna tıklanınca çağrılır.
        // Veriler test_results.answers (JSON) içindeki soruAnaliz alanından okunur.
        // ══════════════════════════════════════════════════════════════════════

        async function toggleOptikFormTable(testId, btnEl) {
            const containerId = 'optikTable_' + testId;
            const container   = document.getElementById(containerId);
            if (!container) return;

            const isOpen = !container.classList.contains('hidden');

            if (isOpen) {
                container.classList.add('hidden');
                btnEl.innerHTML = '<i class="fas fa-table mr-1"></i>📊 Sonuçları Göster';
                return;
            }

            // İlk açılışta veri çek (daha önce çekildiyse cache'den)
            if (!container.dataset.loaded) {
                container.innerHTML = `
                    <div class="flex items-center justify-center py-6 text-gray-400 text-sm">
                        <div class="loading-spinner mr-3" style="width:20px;height:20px;border-width:3px;"></div>
                        Sonuçlar yükleniyor...
                    </div>`;
                container.classList.remove('hidden');
                btnEl.innerHTML = '<i class="fas fa-table mr-1"></i>Gizle';

                try {
                    // Sonuçları öğrenci bilgileriyle birlikte çek
                    const { data: results, error } = await supabase
                        .from('test_results')
                        .select('score, answers, student_id, students(student_no, name, class)')
                        .eq('test_id', testId)
                        .order('student_id');

                    if (error) throw error;

                    if (!results || results.length === 0) {
                        container.innerHTML = `
                            <div class="text-center py-6 text-gray-400 text-sm">
                                <i class="fas fa-inbox text-2xl mb-2 block"></i>
                                Bu test için henüz sonuç yüklenmemiş.
                            </div>`;
                        container.dataset.loaded = '1';
                        return;
                    }

                    container.innerHTML = buildOptikFormTable(results);
                    container.dataset.loaded = '1';

                } catch (err) {
                    console.error('Optik form tablosu hatası:', err);
                    container.innerHTML = `
                        <div class="text-center py-4 text-red-500 text-sm">
                            <i class="fas fa-exclamation-circle mr-1"></i>
                            Veriler yüklenirken hata: ${err.message}
                        </div>`;
                }
            } else {
                container.classList.remove('hidden');
                btnEl.innerHTML = '<i class="fas fa-table mr-1"></i>Gizle';
            }
        }

        function buildOptikFormTable(results) {
            // Kaç soru var? tüm satırlardaki max soruAnaliz uzunluğunu bul
            let maxSoru = 0;
            results.forEach(r => {
                try {
                    const ans = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {});
                    const sa  = ans.soruAnaliz || [];
                    if (sa.length > maxSoru) maxSoru = sa.length;
                } catch {}
            });

            // ── Başlık satırı ─────────────────────────────────────────────────
            let headHtml = `
                <tr style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;">
                    <th class="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap">Numara</th>
                    <th class="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider">Ad Soyad</th>
                    <th class="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">Sınıf</th>
                    <th class="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-green-200">D</th>
                    <th class="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-red-200">Y</th>
                    <th class="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-gray-300">B</th>
                    <th class="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">Puan</th>`;

            for (let i = 1; i <= maxSoru; i++) {
                headHtml += `<th class="px-2 py-2 text-center text-xs font-semibold text-blue-100">${i}</th>`;
            }
            headHtml += '</tr>';

            // ── Veri satırları ─────────────────────────────────────────────────
            // Numaraya göre sırala
            const sorted = [...results].sort((a, b) => {
                const noA = parseInt((a.students?.student_no || '0'), 10);
                const noB = parseInt((b.students?.student_no || '0'), 10);
                return noA - noB;
            });

            let bodyHtml = sorted.map(r => {
                let ans = {};
                try { ans = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {}); } catch {}

                const soruAnaliz = ans.soruAnaliz || [];
                const dogru      = ans.dogru  ?? soruAnaliz.filter(s => s.sonuc === 'dogru').length;
                const yanlis     = ans.yanlis  ?? soruAnaliz.filter(s => s.sonuc === 'yanlis').length;
                const bos        = ans.bos     ?? soruAnaliz.filter(s => s.sonuc === 'bos' || s.sonuc === '').length;
                const puan       = r.score;

                const student    = r.students || {};
                const no         = student.student_no || '-';
                const ad         = student.name       || '-';
                const sinif      = student.class      || '-';

                // Puan rengı
                const puanCls = puan >= 70
                    ? 'background:#dcfce7;color:#166534;'
                    : puan >= 50
                    ? 'background:#fef9c3;color:#854d0e;'
                    : 'background:#fee2e2;color:#991b1b;';

                let row = `
                    <tr class="hover:bg-gray-50 border-b border-gray-100">
                        <td class="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">${no}</td>
                        <td class="px-3 py-2 text-sm font-medium text-gray-800 whitespace-nowrap">${ad}</td>
                        <td class="px-3 py-2 text-center text-xs text-gray-600">${sinif}</td>
                        <td class="px-3 py-2 text-center text-sm font-bold text-green-700">${dogru}</td>
                        <td class="px-3 py-2 text-center text-sm font-semibold text-red-500">${yanlis}</td>
                        <td class="px-3 py-2 text-center text-sm text-gray-400">${bos}</td>
                        <td class="px-3 py-2 text-center">
                            <span style="padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:700;${puanCls}">${puan}</span>
                        </td>`;

                // Soru hücreleri — maxSoru kadar (eksik sorular için — göster)
                for (let i = 0; i < maxSoru; i++) {
                    const s = soruAnaliz[i];
                    if (!s) {
                        row += `<td class="px-1 py-2 text-center bg-gray-50 text-gray-300 text-xs">—</td>`;
                    } else if (s.sonuc === 'dogru') {
                        row += `<td class="px-1 py-2 text-center bg-green-50" title="Soru ${s.soruNo}: Doğru (${s.dogruCevap})">
                                    <span class="text-green-600 font-bold text-xs">✓</span></td>`;
                    } else if (s.sonuc === 'yanlis') {
                        row += `<td class="px-1 py-2 text-center bg-red-50"
                                    title="Soru ${s.soruNo}: Sen ${s.ogrenciCevap} işaretledin, doğrusu ${s.dogruCevap}">
                                    <span class="text-red-600 font-bold text-xs">${s.ogrenciCevap || '✗'}</span></td>`;
                    } else {
                        row += `<td class="px-1 py-2 text-center bg-gray-50" title="Soru ${s.soruNo}: Boş">
                                    <span class="text-gray-400 text-xs">—</span></td>`;
                    }
                }

                row += '</tr>';
                return row;
            }).join('');

            // ── Özet satırı ────────────────────────────────────────────────────
            const avg = results.length
                ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
                : 0;
            const passed  = results.filter(r => r.score >= 70).length;
            const failed  = results.length - passed;

            const summaryRow = `
                <tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0;">
                    <td colspan="3" class="px-3 py-2 text-xs text-gray-500 uppercase tracking-wide">
                        Toplam ${results.length} öğrenci
                    </td>
                    <td colspan="4" class="px-3 py-2 text-center text-xs text-gray-600">
                        <span class="text-green-700">✓ ${passed} başarılı</span>
                        &nbsp;|&nbsp;
                        <span class="text-red-600">✗ ${failed} başarısız</span>
                        &nbsp;|&nbsp;
                        Ort: <span class="text-blue-700">${avg}</span>
                    </td>
                    ${Array(maxSoru).fill('<td></td>').join('')}
                </tr>`;

            return `
                <div class="overflow-x-auto rounded-xl border border-gray-200 mt-1">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>${headHtml}</thead>
                        <tbody>${bodyHtml}${summaryRow}</tbody>
                    </table>
                </div>`;
        }

        window.toggleOptikFormTable = toggleOptikFormTable;

        

        function showAddStudent() {
            document.getElementById('addStudentModal').classList.remove('hidden');
        }

        function showBulkUpload() {
            showNotification('Excel yükleme özelliği yakında eklenecek.', 'info');
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.add('hidden');
        }

        // Upload tab switching
        function switchUploadTab(tabType) {
            const fileTab = document.getElementById('fileUploadTab');
            const pasteTab = document.getElementById('pasteUploadTab');
            const fileContent = document.getElementById('fileUploadContent');
            const pasteContent = document.getElementById('pasteUploadContent');

            if (tabType === 'file') {
                fileTab.classList.add('border-green-500', 'text-green-600');
                fileTab.classList.remove('border-transparent', 'text-gray-500');
                pasteTab.classList.remove('border-green-500', 'text-green-600');
                pasteTab.classList.add('border-transparent', 'text-gray-500');
                fileContent.classList.remove('hidden');
                pasteContent.classList.add('hidden');
            } else {
                pasteTab.classList.add('border-green-500', 'text-green-600');
                pasteTab.classList.remove('border-transparent', 'text-gray-500');
                fileTab.classList.remove('border-green-500', 'text-green-600');
                fileTab.classList.add('border-transparent', 'text-gray-500');
                pasteContent.classList.remove('hidden');
                fileContent.classList.add('hidden');
            }
        }

        // Get example JSON with proper question formats
        function getExampleJSON() {
            return {
                title: "Türkçe Okuma Anlama Testi",
                description: "2. Sınıf Türkçe Okuma Anlama Testi",
                readingText: `Kitap okumak, insanın zihinsel gelişimi için en önemli faaliyetlerden biridir. Kitaplar sayesinde farklı dünyaları keşfeder, yeni bilgiler öğrenir ve hayal gücümüzü geliştiririz. Düzenli kitap okuma alışkanlığı olan çocuklar, hem akademik başarılarında hem de sosyal ilişkilerinde daha başarılı olurlar.

Araştırmalar gösteriyor ki, günde en az 30 dakika kitap okuyan öğrencilerin kelime hazinesi daha geniş oluyor. Ayrıca kitap okuma, empati yeteneğini de geliştiriyor. Farklı karakterlerin duygularını anlayarak, gerçek hayatta da insanları daha iyi anlayabiliyoruz.

Teknolojinin hızla geliştiği günümüzde, dijital kitaplar da popüler hale geldi. Ancak basılı kitapların da kendine özgü avantajları var. Hangi türü tercih ederseniz edin, önemli olan düzenli okuma alışkanlığı kazanmaktır.`,
                textDisplayMode: "first_page_only",
                timeLimit: 25,
                questions: [
                    {
                        type: "multiple_choice",
                        question: "Metne göre, kitap okumanın faydaları arasında hangisi yer almaz?",
                        options: ["A) Zihinsel gelişimi destekler", "B) Hayal gücünü geliştirir", "C) Fiziksel güçü artırır"],
                        correct: 2,
                        points: 5,
                        timeLimit: 75
                    },
                    {
                        type: "multiple_choice",
                        question: "Metne göre, günde kaç dakika kitap okumak kelime hazinesini genişletir?",
                        options: ["A) 15 dakika", "B) 30 dakika", "C) 45 dakika"],
                        correct: 1,
                        points: 5,
                        timeLimit: 75
                    },
                    {
                        type: "multiple_choice",
                        question: "Metinde 'empati' kelimesi hangi anlamda kullanılmıştır?",
                        options: ["A) Başkalarını eleştirme", "B) Başkalarını anlama", "C) Başkalarından kaçınma"],
                        correct: 1,
                        points: 5,
                        timeLimit: 75
                    },
                    {
                        type: "true_false",
                        question: "Metne göre, düzenli kitap okuyan çocuklar sadece akademik başarıda öne çıkar.",
                        correct: false,
                        points: 5,
                        timeLimit: 75
                    },
                    {
                        type: "true_false", 
                        question: "Metne göre, dijital kitaplar günümüzde popüler hale gelmiştir.",
                        correct: true,
                        points: 5,
                        timeLimit: 75
                    },
                    {
                        type: "fill_blank",
                        question: "Metne göre, kitap okuma _____ yeteneğini geliştiriyor.",
                        options: ["empati", "zeka", "güç"],
                        correct: "empati",
                        points: 5,
                        timeLimit: 75
                    },
                    {
                        type: "fill_blank",
                        question: "Metne göre, önemli olan düzenli _____ alışkanlığı kazanmaktır.",
                        options: ["okuma", "yazma", "dinleme"],
                        correct: "okuma",
                        points: 5,
                        timeLimit: 75
                    }
                ]
            };
        }

        // Copy to clipboard
        async function copyToClipboard(data) {
            try {
                const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                await navigator.clipboard.writeText(text);
                showNotification('Panoya kopyalandı!', 'success');
            } catch (error) {
                console.error('Copy failed:', error);
                showNotification('Kopyalama başarısız oldu.', 'error');
            }
        }

        // Copy example JSON to textarea
        function copyExampleJSON() {
            const exampleJSON = getExampleJSON();
            document.getElementById('jsonTextArea').value = JSON.stringify(exampleJSON, null, 2);
            showNotification('Örnek JSON yapıştırıldı!', 'success');
        }

        // Validate JSON
        function validateJSON() {
            const jsonText = document.getElementById('jsonTextArea').value.trim();
            const resultDiv = document.getElementById('jsonValidationResult');
            
            if (!jsonText) {
                showValidationResult('JSON kodu boş olamaz.', 'error');
                return false;
            }

            try {
                const testData = JSON.parse(jsonText);
                const validation = validateTestStructure(testData);
                
                if (validation.isValid) {
                    showValidationResult('✅ JSON formatı geçerli ve test yapısı doğru!', 'success');
                    return true;
                } else {
                    showValidationResult(`❌ ${validation.errors.join(', ')}`, 'error');
                    return false;
                }
            } catch (error) {
                showValidationResult(`❌ Geçersiz JSON formatı: ${error.message}`, 'error');
                return false;
            }
        }

        // Validate test structure
        function validateTestStructure(testData) {
            const errors = [];
            
            // Check required fields
            if (!testData.title || typeof testData.title !== 'string') {
                errors.push('Test başlığı gerekli (string)');
            }
            
            if (!testData.readingText || typeof testData.readingText !== 'string') {
                errors.push('Okuma metni gerekli (string)');
            }
            
            if (!testData.timeLimit || typeof testData.timeLimit !== 'number') {
                errors.push('Süre limiti gerekli (number)');
            }
            
            if (!testData.questions || !Array.isArray(testData.questions)) {
                errors.push('Sorular dizisi gerekli (array)');
            } else {
                // Validate questions
                testData.questions.forEach((question, index) => {
                    const qErrors = validateQuestion(question, index + 1);
                    errors.push(...qErrors);
                });
            }
            
            return {
                isValid: errors.length === 0,
                errors: errors
            };
        }

        // Validate individual question
        function validateQuestion(question, questionNumber) {
            const errors = [];
            const validTypes = ['multiple_choice', 'fill_blank', 'true_false'];
            
            if (!question.type || !validTypes.includes(question.type)) {
                errors.push(`Soru ${questionNumber}: Geçersiz soru tipi`);
            }
            
            if (!question.question || typeof question.question !== 'string') {
                errors.push(`Soru ${questionNumber}: Soru metni gerekli`);
            }
            
            if (question.type === 'multiple_choice') {
                if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
                    errors.push(`Soru ${questionNumber}: En az 2 seçenek gerekli`);
                }
                if (typeof question.correct !== 'number' || question.correct < 0 || question.correct >= (question.options?.length || 0)) {
                    errors.push(`Soru ${questionNumber}: Geçerli doğru cevap indeksi gerekli`);
                }
            } else if (question.type === 'fill_blank') {
                if (!question.correct || typeof question.correct !== 'string') {
                    errors.push(`Soru ${questionNumber}: Doğru cevap string olmalı`);
                }
            } else if (question.type === 'true_false') {
                if (typeof question.correct !== 'boolean') {
                    errors.push(`Soru ${questionNumber}: Doğru cevap boolean olmalı`);
                }
            }
            
            return errors;
        }

        // Show validation result
        function showValidationResult(message, type) {
            const resultDiv = document.getElementById('jsonValidationResult');
            resultDiv.className = `mt-2 text-sm p-2 rounded ${
                type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`;
            resultDiv.textContent = message;
            resultDiv.classList.remove('hidden');
        }

        // Format JSON
        function formatJSON() {
            const jsonText = document.getElementById('jsonTextArea').value.trim();
            
            if (!jsonText) {
                showNotification('JSON kodu boş olamaz.', 'error');
                return;
            }

            try {
                const parsed = JSON.parse(jsonText);
                const formatted = JSON.stringify(parsed, null, 2);
                document.getElementById('jsonTextArea').value = formatted;
                showNotification('JSON biçimlendirildi!', 'success');
            } catch (error) {
                showNotification('Geçersiz JSON formatı!', 'error');
            }
        }

        // Clear JSON
        function clearJSON() {
            document.getElementById('jsonTextArea').value = '';
            document.getElementById('jsonValidationResult').classList.add('hidden');
            showNotification('JSON temizlendi!', 'info');
        }

        // Load sample test data
        function loadSampleTest() {
            const sampleTest = getExampleJSON();

            document.getElementById('testName').value = sampleTest.title;
            document.getElementById('testDescription').value = sampleTest.description;
            
            // Check which tab is active
            const pasteContent = document.getElementById('pasteUploadContent');
            if (!pasteContent.classList.contains('hidden')) {
                // If paste tab is active, fill the textarea
                document.getElementById('jsonTextArea').value = JSON.stringify(sampleTest, null, 2);
                showNotification('Örnek test verileri yapıştırıldı!', 'success');
            } else {
                // If file tab is active, create a file
                const blob = new Blob([JSON.stringify(sampleTest, null, 2)], { type: 'application/json' });
                const file = new File([blob], 'sample-test.json', { type: 'application/json' });
                
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                document.getElementById('testFile').files = dataTransfer.files;
                
                // Show selected file name
                document.getElementById('selectedFileName').textContent = 'Seçilen dosya: sample-test.json';
                document.getElementById('selectedFileName').classList.remove('hidden');
                
                showNotification('Örnek test dosyası yüklendi!', 'success');
            }
        }

        // File input change handler
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('testFile').addEventListener('change', function(e) {
                const file = e.target.files[0];
                const fileNameDiv = document.getElementById('selectedFileName');
                
                if (file) {
                    fileNameDiv.textContent = `Seçilen dosya: ${file.name}`;
                    fileNameDiv.classList.remove('hidden');
                } else {
                    fileNameDiv.classList.add('hidden');
                }
            });
        });

        // Upload test
        async function uploadTest(event) {
            event.preventDefault();
            
            console.log('Test yükleme başlatıldı...');
            
            const name = document.getElementById('testName').value;
            const description = document.getElementById('testDescription').value;
            
            console.log('Test bilgileri:', { name, description });
            
            if (!name.trim()) {
                showNotification('Test adı boş olamaz!', 'error');
                return;
            }
            
            let testData;
            
            // Check which tab is active and get data accordingly
            const pasteContent = document.getElementById('pasteUploadContent');
            if (!pasteContent.classList.contains('hidden')) {
                // Paste tab is active
                const jsonText = document.getElementById('jsonTextArea').value.trim();
                
                if (!jsonText) {
                    showNotification('Lütfen JSON kodunu yapıştırın.', 'error');
                    return;
                }
                
                try {
                    testData = JSON.parse(jsonText);
                    console.log('JSON başarıyla parse edildi:', testData);
                } catch (error) {
                    console.error('JSON parse hatası:', error);
                    showNotification(`Geçersiz JSON formatı: ${error.message}`, 'error');
                    return;
                }
            } else {
                // File tab is active
                const file = document.getElementById('testFile').files[0];
                
                if (!file) {
                    showNotification('Lütfen bir JSON dosyası seçin.', 'error');
                    return;
                }
                
                try {
                    const text = await file.text();
                    testData = JSON.parse(text);
                    console.log('Dosyadan JSON başarıyla okundu:', testData);
                } catch (error) {
                    console.error('Dosya okuma hatası:', error);
                    showNotification(`Dosya okunamadı: ${error.message}`, 'error');
                    return;
                }
            }
            
            // Validate test structure
            console.log('Test yapısı doğrulanıyor...');
            const validation = validateTestStructure(testData);
            if (!validation.isValid) {
                console.error('Validasyon hataları:', validation.errors);
                showNotification(`Test yapısı geçersiz: ${validation.errors.join(', ')}`, 'error');
                return;
            }
            console.log('Test yapısı geçerli ✓');
            

            
            // Get text display mode from form
            const textDisplayMode = document.querySelector('input[name="textDisplayMode"]:checked')?.value || 'first_page_only';
            
            // Get test type from form
            const testType = document.querySelector('input[name="testType"]:checked')?.value || 'normal';

            // Cevap kağıdı seçenek sayısı (sadece cevap_kagidi tipinde)
            const optionCount = testType === 'cevap_kagidi'
                ? parseInt(document.querySelector('input[name="optionCount"]:checked')?.value || '4')
                : null;

            // Prepare data for database
            const dbData = {
                title: name.trim(),
                description: description ? description.trim() : null,
                reading_text: testData.readingText || testData.reading_text || '',
                text_display_mode: testData.textDisplayMode || textDisplayMode,
                time_limit: parseInt(testData.timeLimit || testData.time_limit || 30),
                questions: JSON.stringify(testData.questions),
                created_by: currentUser?.id || null,
                test_type: testType
            };

            // option_count kolonunu sadece cevap_kagidi tipinde ve değer varsa ekle
            // (Supabase'de kolon yoksa hata vermemesi için)
            if (optionCount !== null) {
                try {
                    // Kolonun var olup olmadığını test et, yoksa sessizce geç
                    dbData.option_count = optionCount;
                } catch(e) {
                    console.warn('option_count kolonu eklenemedi:', e);
                }
            }
            
            console.log('Veritabanına gönderilecek veri:', dbData);
            
            try {
                console.log('Supabase\'e veri gönderiliyor...');
                const { data, error } = await supabase
                    .from('tests')
                    .insert(dbData)
                    .select();
                
                if (error) {
                    console.error('Supabase hatası:', error);
                    throw error;
                }
                
                console.log('Test başarıyla kaydedildi:', data);
                showNotification('Test başarıyla yüklendi!', 'success');
                closeModal('uploadTestModal');
                await loadTestsList();
                
                // Clear form
                document.getElementById('testName').value = '';
                document.getElementById('testDescription').value = '';
                document.getElementById('jsonTextArea').value = '';
                document.getElementById('testFile').value = '';
                document.getElementById('selectedFileName').classList.add('hidden');
                document.getElementById('jsonValidationResult').classList.add('hidden');
                // Reset test type to default
                const normalRadio = document.querySelector('input[name="testType"][value="normal"]');
                if (normalRadio) { normalRadio.checked = true; updateTestTypeLabels(); }
                
            } catch (error) {
                console.error('Test yükleme hatası:', error);
                
                // option_count kolonu eksikse: otomatik retry (kolonsuz)
                if (error.code === 'PGRST204' && error.message && error.message.includes('option_count')) {
                    console.warn('option_count kolonu bulunamadı, kolon olmadan tekrar deneniyor...');
                    try {
                        delete dbData.option_count;
                        const { data: data2, error: error2 } = await supabase
                            .from('tests')
                            .insert(dbData)
                            .select();
                        if (!error2) {
                            console.log('Test başarıyla kaydedildi (option_count olmadan):', data2);
                            showNotification('Test yüklendi! (Not: Seçenek sayısı kaydedilemedi. Supabase\'de migration_option_count.sql dosyasını çalıştırın.)', 'warning');
                            closeModal('uploadTestModal');
                            await loadTestsList();
                            document.getElementById('testName').value = '';
                            document.getElementById('testDescription').value = '';
                            document.getElementById('jsonTextArea').value = '';
                            document.getElementById('testFile').value = '';
                            document.getElementById('selectedFileName').classList.add('hidden');
                            document.getElementById('jsonValidationResult').classList.add('hidden');
                            const normalRadio = document.querySelector('input[name="testType"][value="normal"]');
                            if (normalRadio) { normalRadio.checked = true; updateTestTypeLabels(); }
                            return;
                        }
                    } catch(retryErr) {
                        console.error('Retry da başarısız:', retryErr);
                    }
                }

                // Detailed error message
                let errorMessage = 'Test yüklenirken hata oluştu.';
                if (error.message) {
                    errorMessage += ` Detay: ${error.message}`;
                }
                if (error.code) {
                    errorMessage += ` (Kod: ${error.code})`;
                }
                
                showNotification(errorMessage, 'error');
                
                // Show detailed error in console for debugging
                console.log('Hata detayları:');
                console.log('- Error message:', error.message);
                console.log('- Error code:', error.code);
                console.log('- Error details:', error.details);
                console.log('- Error hint:', error.hint);
                console.log('- Gönderilen veri:', dbData);
            }
        }

        // Add student
        async function addStudent(event) {
            event.preventDefault();
            
            const name = document.getElementById('studentName').value;
            const tc = document.getElementById('studentTCAdd').value;
            const studentNo = document.getElementById('studentNoAdd').value;
            const studentClass = document.getElementById('studentClass').value;
            
            try {
                const { error } = await supabase
                    .from('students')
                    .insert({
                        name: name,
                        tc_no: tc,
                        student_no: studentNo,
                        class: studentClass
                    });
                
                if (error) throw error;
                
                showNotification('Öğrenci başarıyla eklendi!', 'success');
                closeModal('addStudentModal');
                
                // Clear form
                document.getElementById('studentName').value = '';
                document.getElementById('studentTCAdd').value = '';
                document.getElementById('studentNoAdd').value = '';
                document.getElementById('studentClass').value = '';
                
                await loadStudentsList();
                
            } catch (error) {
                console.error('Error adding student:', error);
                if (error.code === '23505') {
                    showNotification('Bu TC kimlik numarası veya öğrenci numarası zaten kayıtlı!', 'error');
                } else {
                    showNotification('Öğrenci eklenirken hata oluştu.', 'error');
                }
            }
        }

        // Edit student
        function editStudent(studentId, name, tcNo, studentNo, studentClass) {
            document.getElementById('editStudentId').value = studentId;
            document.getElementById('editStudentName').value = name;
            document.getElementById('editStudentTC').value = tcNo;
            document.getElementById('editStudentNo').value = studentNo;
            document.getElementById('editStudentClass').value = studentClass;
            
            document.getElementById('editStudentModal').classList.remove('hidden');
        }

        // Update student
        async function updateStudent(event) {
            event.preventDefault();
            
            const studentId = document.getElementById('editStudentId').value;
            const name = document.getElementById('editStudentName').value;
            const tc = document.getElementById('editStudentTC').value;
            const studentNo = document.getElementById('editStudentNo').value;
            const studentClass = document.getElementById('editStudentClass').value;
            
            try {
                const { error } = await supabase
                    .from('students')
                    .update({
                        name: name,
                        tc_no: tc,
                        student_no: studentNo,
                        class: studentClass
                    })
                    .eq('id', studentId);
                
                if (error) throw error;
                
                showNotification('Öğrenci bilgileri başarıyla güncellendi!', 'success');
                closeModal('editStudentModal');
                await loadStudentsList();
                
            } catch (error) {
                console.error('Error updating student:', error);
                if (error.code === '23505') {
                    showNotification('Bu TC kimlik numarası veya öğrenci numarası başka bir öğrenci tarafından kullanılıyor!', 'error');
                } else {
                    showNotification('Öğrenci güncellenirken hata oluştu.', 'error');
                }
            }
        }

        // Global variables for assignment management
        let currentAssignmentTestId = null;
        let currentAssignmentFilter = 'all';

        // Show assignment management modal
        async function showAssignmentModal(testId, testTitle, totalAssignments, completedAssignments) {
            console.log('Opening assignment modal for test:', testId, testTitle);
            
            if (!testId) {
                showNotification('Geçersiz test ID!', 'error');
                return;
            }
            
            currentAssignmentTestId = testId;
            currentAssignmentFilter = 'all';
            
            // Safely update title
            const titleElement = document.getElementById('assignmentTestTitle');
            if (titleElement) {
                titleElement.textContent = `${testTitle} - Atama Yönetimi`;
            }
            
            // Show modal
            const modal = document.getElementById('assignmentModal');
            if (modal) {
                modal.classList.remove('hidden');
            }
            
            // Load students with error handling
            try {
                await loadAssignmentStudents();
            } catch (error) {
                console.error('Failed to load assignment students:', error);
                showNotification('Atama verileri yüklenemedi. Lütfen tekrar deneyin.', 'error');
            }
        }

        // Load students for assignment management
        async function loadAssignmentStudents() {
            console.log('Loading assignment students for test ID:', currentAssignmentTestId);
            
            try {
                // Load students with better error handling
                console.log('Fetching students...');
                const { data: students, error: studentsError } = await supabase
                    .from('students')
                    .select('*')
                    .order('name');

                if (studentsError) {
                    console.error('Students fetch error:', studentsError);
                    throw studentsError;
                }
                console.log('Students loaded:', students?.length || 0);

                // Load assignments with safer query structure
                console.log('Fetching assignments...');
                const { data: assignments, error: assignmentsError } = await supabase
                    .from('test_assignments')
                    .select('*')
                    .eq('test_id', currentAssignmentTestId);

                if (assignmentsError) {
                    console.error('Assignments fetch error:', assignmentsError);
                    throw assignmentsError;
                }
                console.log('Assignments loaded:', assignments?.length || 0);

                // Load test results separately to avoid join issues
                console.log('Fetching test results...');
                const { data: testResults, error: resultsError } = await supabase
                    .from('test_results')
                    .select('*')
                    .eq('test_id', currentAssignmentTestId);

                if (resultsError) {
                    console.error('Test results fetch error:', resultsError);
                    // Don't throw error for results, just log it
                    console.log('Continuing without test results...');
                }
                console.log('Test results loaded:', testResults?.length || 0);

                const container = document.getElementById('assignmentStudentsList');
                container.innerHTML = '';

                if (!students || students.length === 0) {
                    container.innerHTML = '<p class="text-gray-500 text-center py-8">Henüz öğrenci bulunmuyor.</p>';
                    return;
                }

                let totalStudents = 0;
                let assignedStudents = 0;
                let completedStudents = 0;

                students.forEach(student => {
                    const assignment = assignments?.find(a => a.student_id === student.id);
                    // Find result by matching both student_id and test_id
                    const result = testResults?.find(r => r.student_id === student.id && r.test_id === currentAssignmentTestId);
                    
                    let status, statusColor, statusIcon, actionButton;
                    
                    if (!assignment) {
                        status = 'Atanmamış';
                        statusColor = 'bg-gray-100 text-gray-600 border-gray-200';
                        statusIcon = '⚪';
                        actionButton = `
                            <button onclick="assignToStudent(${student.id})" class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition duration-200">
                                📋 Ata
                            </button>
                        `;
                    } else if (!result) {
                        status = 'Bekliyor';
                        statusColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                        statusIcon = '🟡';
                        assignedStudents++;
                        actionButton = `
                            <button onclick="removeAssignment(${assignment.id})" class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition duration-200">
                                🗑️ Kaldır
                            </button>
                        `;
                    } else if (result.score >= 70) {
                        status = `Başarılı (${result.score})`;
                        statusColor = 'bg-green-100 text-green-800 border-green-200';
                        statusIcon = '🟢';
                        assignedStudents++;
                        completedStudents++;
                        actionButton = `
                            <div class="flex space-x-1">
                                <button onclick="reassignToStudent(${student.id})" class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition duration-200">
                                    🔄 Tekrar Ata
                                </button>
                                <button onclick="removeAssignment(${assignment.id})" class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition duration-200">
                                    🗑️ Kaldır
                                </button>
                            </div>
                        `;
                    } else {
                        status = `Düşük Puan (${result.score})`;
                        statusColor = 'bg-red-100 text-red-800 border-red-200';
                        statusIcon = '🔴';
                        assignedStudents++;
                        completedStudents++;
                        actionButton = `
                            <div class="flex space-x-1">
                                <button onclick="reassignToStudent(${student.id})" class="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition duration-200">
                                    🔄 Tekrar Ata
                                </button>
                                <button onclick="removeAssignment(${assignment.id})" class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition duration-200">
                                    🗑️ Kaldır
                                </button>
                            </div>
                        `;
                    }

                    // Apply filter
                    let shouldShow = true;
                    switch (currentAssignmentFilter) {
                        case 'waiting':
                            // Show only students who have assignment but no result
                            shouldShow = assignment && !result;
                            break;
                        case 'completed':
                            // Show only students who have result with score >= 70
                            shouldShow = result && result.score >= 70;
                            break;
                        case 'failed':
                            // Show only students who have result with score < 70
                            shouldShow = result && result.score < 70;
                            break;
                        case 'not_assigned':
                            // Show only students who don't have assignment
                            shouldShow = !assignment;
                            break;
                        case 'all':
                        default:
                            // Show all students
                            shouldShow = true;
                            break;
                    }

                    if (shouldShow) {
                        const studentDiv = document.createElement('div');
                        studentDiv.className = `student-item bg-white border-2 ${statusColor.split(' ')[2]} rounded-lg p-4 hover:shadow-md transition-all duration-200`;
                        studentDiv.innerHTML = `
                            <div class="flex justify-between items-center">
                                <div class="flex items-center space-x-3">
                                    <div class="text-2xl">${statusIcon}</div>
                                    <div>
                                        <h5 class="font-semibold text-gray-900">${student.name}</h5>
                                        <div class="text-sm text-gray-600">
                                            <span>No: ${student.student_no}</span>
                                            <span class="ml-3">Sınıf: ${student.class}</span>
                                        </div>
                                        <div class="mt-1">
                                            <span class="px-2 py-1 text-xs font-medium rounded-full border ${statusColor}">
                                                ${status}
                                            </span>
                                        </div>
                                        ${result ? `
                                            <div class="text-xs text-gray-500 mt-1">
                                                <i class="fas fa-clock mr-1"></i>
                                                ${new Date(result.completed_at).toLocaleDateString('tr-TR')}
                                            </div>
                                        ` : assignment ? `
                                            <div class="text-xs text-gray-500 mt-1">
                                                <i class="fas fa-calendar mr-1"></i>
                                                Atanma: ${new Date(assignment.assigned_at).toLocaleDateString('tr-TR')}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="ml-4">
                                    ${actionButton}
                                </div>
                            </div>
                        `;
                        container.appendChild(studentDiv);
                    }

                    totalStudents++;
                });

                // Update statistics
                document.getElementById('assignmentStats').textContent = 
                    `Toplam: ${totalStudents} | Atanmış: ${assignedStudents} | Tamamlanmış: ${completedStudents}`;

                // Update filter button states
                updateFilterButtons();

            } catch (error) {
                console.error('Error loading assignment students:', error);
                console.error('Error details:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                });
                
                // Show detailed error message
                let errorMessage = 'Öğrenci listesi yüklenirken hata oluştu.';
                if (error.message) {
                    errorMessage += ` Detay: ${error.message}`;
                }
                
                showNotification(errorMessage, 'error');
                
                // Show fallback content
                const container = document.getElementById('assignmentStudentsList');
                container.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-3"></i>
                        <p class="text-red-600 mb-3">Veri yüklenirken hata oluştu</p>
                        <p class="text-sm text-gray-600 mb-4">${error.message || 'Bilinmeyen hata'}</p>
                        <button onclick="loadAssignmentStudents()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-sync mr-2"></i>Tekrar Dene
                        </button>
                    </div>
                `;
            }
        }

        // Update filter button states
        function updateFilterButtons() {
            const buttons = ['filterAll', 'filterWaiting', 'filterCompleted', 'filterFailed', 'filterNotAssigned'];
            buttons.forEach(buttonId => {
                const button = document.getElementById(buttonId);
                const filterValue = buttonId.replace('filter', '').toLowerCase();
                const isActive = (filterValue === 'all' && currentAssignmentFilter === 'all') ||
                                (filterValue === 'waiting' && currentAssignmentFilter === 'waiting') ||
                                (filterValue === 'completed' && currentAssignmentFilter === 'completed') ||
                                (filterValue === 'failed' && currentAssignmentFilter === 'failed') ||
                                (filterValue === 'notassigned' && currentAssignmentFilter === 'not_assigned');
                
                if (isActive) {
                    button.classList.add('ring-2', 'ring-blue-500', 'font-semibold');
                } else {
                    button.classList.remove('ring-2', 'ring-blue-500', 'font-semibold');
                }
            });
        }

        // Filter assignments
        function filterAssignments(filter) {
            currentAssignmentFilter = filter;
            loadAssignmentStudents();
        }

        // Assign to single student
        async function assignToStudent(studentId) {
            try {
                // Check if already assigned
                const { data: existing } = await supabase
                    .from('test_assignments')
                    .select('*')
                    .eq('test_id', currentAssignmentTestId)
                    .eq('student_id', studentId);

                if (existing && existing.length > 0) {
                    showNotification('Bu öğrenciye test zaten atanmış.', 'warning');
                    return;
                }

                const { error } = await supabase
                    .from('test_assignments')
                    .insert({
                        test_id: currentAssignmentTestId,
                        student_id: studentId,
                        assigned_at: new Date().toISOString()
                    });

                if (error) throw error;

                showNotification('Test öğrenciye atandı!', 'success');
                await loadAssignmentStudents();

            } catch (error) {
                console.error('Error assigning to student:', error);
                showNotification('Test atanırken hata oluştu.', 'error');
            }
        }

        // Reassign to student (for retakes)
        async function reassignToStudent(studentId) {
            try {
                // Remove existing assignment and result
                const { error: deleteAssignmentError } = await supabase
                    .from('test_assignments')
                    .delete()
                    .eq('test_id', currentAssignmentTestId)
                    .eq('student_id', studentId);

                if (deleteAssignmentError) throw deleteAssignmentError;

                const { error: deleteResultError } = await supabase
                    .from('test_results')
                    .delete()
                    .eq('test_id', currentAssignmentTestId)
                    .eq('student_id', studentId);

                if (deleteResultError) throw deleteResultError;

                // Create new assignment
                const { error: insertError } = await supabase
                    .from('test_assignments')
                    .insert({
                        test_id: currentAssignmentTestId,
                        student_id: studentId,
                        assigned_at: new Date().toISOString()
                    });

                if (insertError) throw insertError;

                showNotification('Test tekrar atandı! Öğrenci yeniden çözebilir.', 'success');
                await loadAssignmentStudents();

            } catch (error) {
                console.error('Error reassigning to student:', error);
                showNotification('Test tekrar atanırken hata oluştu.', 'error');
            }
        }

        // Remove assignment
        async function removeAssignment(assignmentId) {
            if (!confirm('Bu atamayı kaldırmak istediğinizden emin misiniz?')) return;

            try {
                const { error } = await supabase
                    .from('test_assignments')
                    .delete()
                    .eq('id', assignmentId);

                if (error) throw error;

                showNotification('Atama kaldırıldı!', 'success');
                await loadAssignmentStudents();

            } catch (error) {
                console.error('Error removing assignment:', error);
                showNotification('Atama kaldırılırken hata oluştu.', 'error');
            }
        }

        // Assign to all students
        async function assignToAllStudents() {
            const confirmAssign = await showAssignmentConfirmDialog({
                title: '👥 Tüm Öğrencilere Atama',
                message: 'Bu testi tüm öğrencilere atamak istediğinizden emin misiniz?',
                warning: '⚠️ UYARI:\n• Daha önce atanmamış tüm öğrencilere test atanacak\n• Zaten atanmış öğrenciler etkilenmeyecek\n• Öğrenciler hemen teste başlayabilecek',
                confirmText: 'Evet, Tüm Öğrencilere Ata',
                cancelText: 'İptal'
            });

            if (!confirmAssign) return;

            try {
                const { data: students } = await supabase.from('students').select('*');
                
                if (!students || students.length === 0) {
                    showNotification('Önce öğrenci eklemelisiniz.', 'error');
                    return;
                }

                // Get existing assignments
                const { data: existingAssignments } = await supabase
                    .from('test_assignments')
                    .select('student_id')
                    .eq('test_id', currentAssignmentTestId);

                const existingStudentIds = existingAssignments?.map(a => a.student_id) || [];
                
                // Create assignments for students who don't have one
                const newAssignments = students
                    .filter(student => !existingStudentIds.includes(student.id))
                    .map(student => ({
                        test_id: currentAssignmentTestId,
                        student_id: student.id,
                        assigned_at: new Date().toISOString()
                    }));

                if (newAssignments.length === 0) {
                    showNotification('Tüm öğrencilere zaten atanmış.', 'info');
                    return;
                }

                const { error } = await supabase
                    .from('test_assignments')
                    .insert(newAssignments);

                if (error) throw error;

                showNotification(`Test ${newAssignments.length} yeni öğrenciye atandı!`, 'success');
                await loadAssignmentStudents();

            } catch (error) {
                console.error('Error assigning to all students:', error);
                showNotification('Toplu atama yapılırken hata oluştu.', 'error');
            }
        }

        // Assign to class
        async function assignToClass() {
            // First get available classes
            const { data: students } = await supabase.from('students').select('class');
            const availableClasses = [...new Set(students?.map(s => s.class))].sort();
            
            if (availableClasses.length === 0) {
                showNotification('Henüz öğrenci bulunmuyor.', 'error');
                return;
            }

            const className = await showClassSelectionDialog(availableClasses);
            if (!className) return;

            const confirmAssign = await showAssignmentConfirmDialog({
                title: `🏫 ${className} Sınıfına Atama`,
                message: `Bu testi ${className} sınıfındaki öğrencilere atamak istediğinizden emin misiniz?`,
                warning: `⚠️ UYARI:\n• ${className} sınıfındaki tüm öğrencilere test atanacak\n• Zaten atanmış öğrenciler etkilenmeyecek\n• Öğrenciler hemen teste başlayabilecek`,
                confirmText: `Evet, ${className} Sınıfına Ata`,
                cancelText: 'İptal'
            });

            if (!confirmAssign) return;

            try {
                const { data: classStudents } = await supabase
                    .from('students')
                    .select('*')
                    .eq('class', className);

                if (!classStudents || classStudents.length === 0) {
                    showNotification(`${className} sınıfında öğrenci bulunamadı.`, 'error');
                    return;
                }

                // Get existing assignments
                const { data: existingAssignments } = await supabase
                    .from('test_assignments')
                    .select('student_id')
                    .eq('test_id', currentAssignmentTestId);

                const existingStudentIds = existingAssignments?.map(a => a.student_id) || [];
                
                // Create assignments for students who don't have one
                const newAssignments = classStudents
                    .filter(student => !existingStudentIds.includes(student.id))
                    .map(student => ({
                        test_id: currentAssignmentTestId,
                        student_id: student.id,
                        assigned_at: new Date().toISOString()
                    }));

                if (newAssignments.length === 0) {
                    showNotification(`${className} sınıfındaki tüm öğrencilere zaten atanmış.`, 'info');
                    return;
                }

                const { error } = await supabase
                    .from('test_assignments')
                    .insert(newAssignments);

                if (error) throw error;

                showNotification(`Test ${className} sınıfındaki ${newAssignments.length} öğrenciye atandı!`, 'success');
                await loadAssignmentStudents();

            } catch (error) {
                console.error('Error assigning to class:', error);
                showNotification('Sınıfa atama yapılırken hata oluştu.', 'error');
            }
        }

        // Remove all assignments
        async function removeAllAssignments() {
            const confirmRemove = await showAssignmentConfirmDialog({
                title: '🗑️ Tüm Atamaları Kaldır',
                message: 'Bu testin TÜM atamalarını kaldırmak istediğinizden emin misiniz?',
                warning: '⚠️ UYARI:\n• Bu işlem GERİ ALINAMAZ!\n• Tüm öğrenci atamaları silinecek\n• Test sonuçları etkilenmeyecek\n• Öğrenciler artık bu testi göremeyecek',
                confirmText: 'Evet, Tüm Atamaları Kaldır',
                cancelText: 'İptal',
                isDestructive: true
            });

            if (!confirmRemove) return;

            try {
                const { error } = await supabase
                    .from('test_assignments')
                    .delete()
                    .eq('test_id', currentAssignmentTestId);

                if (error) throw error;

                showNotification('Tüm atamalar kaldırıldı!', 'success');
                await loadAssignmentStudents();

            } catch (error) {
                console.error('Error removing all assignments:', error);
                showNotification('Atamalar kaldırılırken hata oluştu.', 'error');
            }
        }

        // Refresh assignments
        async function refreshAssignments() {
            await loadAssignmentStudents();
            showNotification('Liste yenilendi!', 'info');
        }

        // Delete test with enhanced confirmation dialog
        async function deleteTest(testId) {
            // Create custom confirmation modal
            const confirmDelete = await showDeleteConfirmDialog({
                title: '🗑️ Test Silme Onayı',
                message: 'Bu testi silmek istediğinizden emin misiniz?',
                warning: '⚠️ UYARI:\n• Bu işlem geri alınamaz\n• Test ile ilgili tüm atamalar silinecek\n• Öğrenci sonuçları da silinecek',
                confirmText: 'Evet, Sil',
                cancelText: 'İptal'
            });

            if (!confirmDelete) return;
            
            try {
                const { error } = await supabase
                    .from('tests')
                    .delete()
                    .eq('id', testId);
                
                if (error) throw error;
                
                showNotification('Test başarıyla silindi!', 'success');
                await loadTestsList();
                
            } catch (error) {
                console.error('Error deleting test:', error);
                showNotification('Test silinirken hata oluştu.', 'error');
            }
        }

        // Delete student with enhanced confirmation dialog
        async function deleteStudent(studentId) {
            // Create custom confirmation modal
            const confirmDelete = await showDeleteConfirmDialog({
                title: '🗑️ Öğrenci Silme Onayı',
                message: 'Bu öğrenciyi silmek istediğinizden emin misiniz?',
                warning: '⚠️ UYARI:\n• Bu işlem geri alınamaz\n• Öğrencinin tüm test sonuçları silinecek\n• Tüm atamaları kaldırılacak',
                confirmText: 'Evet, Sil',
                cancelText: 'İptal'
            });

            if (!confirmDelete) return;
            
            try {
                const { error } = await supabase
                    .from('students')
                    .delete()
                    .eq('id', studentId);
                
                if (error) throw error;
                
                showNotification('Öğrenci başarıyla silindi!', 'success');
                await loadStudentsList();
                
            } catch (error) {
                console.error('Error deleting student:', error);
                showNotification('Öğrenci silinirken hata oluştu.', 'error');
            }
        }

        // Enhanced delete confirmation dialog
        function showDeleteConfirmDialog({ title, message, warning, confirmText, cancelText }) {
            return new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
                modal.innerHTML = `
                    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
                        <div class="mb-6">
                            <h3 class="text-xl font-bold text-gray-900 mb-4">${title}</h3>
                            
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                                <div class="text-sm text-blue-800">${message}</div>
                            </div>
                            
                            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-left">
                                <div class="text-sm text-red-800 whitespace-pre-line">${warning}</div>
                            </div>
                        </div>
                        
                        <div class="flex space-x-3">
                            <button onclick="handleDeleteResponse(false)" class="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition duration-300 font-semibold">
                                ${cancelText}
                            </button>
                            <button onclick="handleDeleteResponse(true)" class="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 font-semibold">
                                ${confirmText}
                            </button>
                        </div>
                    </div>
                `;
                
                // Add response handler to window temporarily
                window.handleDeleteResponse = (response) => {
                    modal.remove();
                    delete window.handleDeleteResponse;
                    resolve(response);
                };
                
                document.body.appendChild(modal);
                
                // Auto-focus on cancel button for safety
                setTimeout(() => {
                    const cancelBtn = modal.querySelector('button:first-child');
                    if (cancelBtn) cancelBtn.focus();
                }, 100);
            });
        }

        // Assignment confirmation dialog
        function showAssignmentConfirmDialog({ title, message, warning, confirmText, cancelText, isDestructive = false }) {
            return new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
                modal.innerHTML = `
                    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
                        <div class="mb-6">
                            <h3 class="text-xl font-bold text-gray-900 mb-4">${title}</h3>
                            
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                                <div class="text-sm text-blue-800">${message}</div>
                            </div>
                            
                            <div class="${isDestructive ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4 mb-4 text-left">
                                <div class="text-sm ${isDestructive ? 'text-red-800' : 'text-yellow-800'} whitespace-pre-line">${warning}</div>
                            </div>
                        </div>
                        
                        <div class="flex space-x-3">
                            <button onclick="handleAssignmentResponse(false)" class="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition duration-300 font-semibold">
                                ${cancelText}
                            </button>
                            <button onclick="handleAssignmentResponse(true)" class="flex-1 px-6 py-3 ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition duration-300 font-semibold">
                                ${confirmText}
                            </button>
                        </div>
                    </div>
                `;
                
                // Add response handler to window temporarily
                window.handleAssignmentResponse = (response) => {
                    modal.remove();
                    delete window.handleAssignmentResponse;
                    resolve(response);
                };
                
                document.body.appendChild(modal);
                
                // Auto-focus on cancel button for safety
                setTimeout(() => {
                    const cancelBtn = modal.querySelector('button:first-child');
                    if (cancelBtn) cancelBtn.focus();
                }, 100);
            });
        }

        // Class selection dialog
        function showClassSelectionDialog(availableClasses) {
            return new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
                modal.innerHTML = `
                    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div class="mb-6">
                            <h3 class="text-xl font-bold text-gray-900 mb-4">🏫 Sınıf Seçimi</h3>
                            <p class="text-gray-600 mb-4">Hangi sınıfa test atamak istiyorsunuz?</p>
                            
                            <div class="space-y-2">
                                ${availableClasses.map(className => `
                                    <label class="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                                        <input type="radio" name="selectedClass" value="${className}" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300">
                                        <span class="ml-3 text-gray-900 font-medium">${className}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="flex space-x-3">
                            <button onclick="handleClassSelection(null)" class="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition duration-300 font-semibold">
                                İptal
                            </button>
                            <button onclick="handleClassSelection(getSelectedClass())" class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 font-semibold">
                                Seç
                            </button>
                        </div>
                    </div>
                `;
                
                // Add helper functions to window temporarily
                window.getSelectedClass = () => {
                    const selected = modal.querySelector('input[name="selectedClass"]:checked');
                    return selected ? selected.value : null;
                };
                
                window.handleClassSelection = (selectedClass) => {
                    modal.remove();
                    delete window.getSelectedClass;
                    delete window.handleClassSelection;
                    resolve(selectedClass);
                };
                
                document.body.appendChild(modal);
                
                // Auto-focus on first radio button
                setTimeout(() => {
                    const firstRadio = modal.querySelector('input[type="radio"]');
                    if (firstRadio) firstRadio.focus();
                }, 100);
            });
        }

        // Logout
        function logout() {
            // Show logout confirmation with remember me option
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
                    <div class="mb-6">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                            <i class="fas fa-sign-out-alt text-2xl text-blue-600"></i>
                        </div>
                        <h3 class="text-xl font-bold text-gray-900 mb-2">Çıkış Yapıyor Musunuz?</h3>
                        <p class="text-gray-600 mb-4">Oturumunuz sonlandırılacak.</p>
                        
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                            <div class="flex items-center">
                                <input type="checkbox" id="forgetCredentials" class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded">
                                <label for="forgetCredentials" class="ml-2 block text-sm text-yellow-800">
                                    <i class="fas fa-trash mr-1"></i>
                                    Hatırlanan giriş bilgilerimi sil
                                </label>
                            </div>
                            <p class="text-xs text-yellow-700 mt-1 ml-6">
                                Bu seçeneği işaretlerseniz bir dahaki sefere bilgilerinizi tekrar girmeniz gerekecek.
                            </p>
                        </div>
                    </div>
                    
                    <div class="flex space-x-3">
                        <button onclick="cancelLogout()" class="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition duration-300 font-semibold">
                            İptal
                        </button>
                        <button onclick="confirmLogout()" class="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 font-semibold">
                            Çıkış Yap
                        </button>
                    </div>
                </div>
            `;
            
            // Add logout handlers to window temporarily
            window.cancelLogout = () => {
                modal.remove();
                delete window.cancelLogout;
                delete window.confirmLogout;
            };
            
            window.confirmLogout = () => {
                const forgetCredentials = document.getElementById('forgetCredentials').checked;
                
                if (forgetCredentials) {
                    // Clear all remembered credentials
                    clearRememberedCredentials('student');
                    clearRememberedCredentials('teacher');
                    showNotification('Hatırlanan giriş bilgileri silindi! 🗑️', 'info');
                }
                
                // Perform logout
                currentUser = null;
                currentTest = null;
                clearSession();
                if (testTimer) clearInterval(testTimer);
                
                modal.remove();
                delete window.cancelLogout;
                delete window.confirmLogout;
                
                showMainLogin();
                showNotification('Başarıyla çıkış yaptınız! 👋', 'success');
            };
            
            document.body.appendChild(modal);
        }

        // Show badge notification
        function showBadgeNotification(badgeName) {
            const notification = document.createElement('div');
            notification.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-8 rounded-2xl shadow-2xl text-center badge-new';
            notification.innerHTML = `
                <div class="text-6xl mb-4">${badgeName.split(' ')[0]}</div>
                <h3 class="text-2xl font-bold mb-2">Yeni Rozet Kazandın!</h3>
                <p class="text-lg">${badgeName}</p>
                <div class="mt-4">
                    <i class="fas fa-sparkles text-2xl animate-pulse"></i>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translate(-50%, -50%) scale(0.5)';
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        }

        // Mobile-friendly confirmation dialog
        function showMobileConfirmDialog({ title, message, warning, question, confirmLabel }) {
            return new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
                modal.innerHTML = `
                    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
                        <div class="mb-6">
                            <h3 class="text-xl font-bold text-gray-900 mb-4">${title}</h3>
                            
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                                <div class="text-sm text-blue-800 whitespace-pre-line">${message}</div>
                            </div>
                            
                            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-left">
                                <div class="text-sm text-red-800 whitespace-pre-line">${warning}</div>
                            </div>
                            
                            <p class="text-gray-700 font-medium">${question}</p>
                        </div>
                        
                        <div class="flex space-x-3">
                            <button onclick="handleConfirmResponse(false)" class="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition duration-300 font-semibold">
                                İptal
                            </button>
                            <button onclick="handleConfirmResponse(true)" class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 font-semibold">
                                ${confirmLabel || 'Teste Başla'}
                            </button>
                        </div>
                    </div>
                `;
                
                // Add response handler to window temporarily
                window.handleConfirmResponse = (response) => {
                    modal.remove();
                    delete window.handleConfirmResponse;
                    resolve(response);
                };
                
                document.body.appendChild(modal);
                
                // Auto-focus on confirm button for better UX
                setTimeout(() => {
                    const confirmBtn = modal.querySelector('button:last-child');
                    if (confirmBtn) confirmBtn.focus();
                }, 100);
            });
        }

        // Show retake message for failed tests
        function showRetakeMessage() {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
                    <div class="mb-6">
                        <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                            <i class="fas fa-lock text-3xl text-red-600"></i>
                        </div>
                        <h3 class="text-xl font-bold text-gray-900 mb-2">Test Tamamlandı</h3>
                        <p class="text-gray-600">Bu testi zaten çözdünüz ve düşük puan aldınız.</p>
                    </div>
                    
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <div class="flex items-start">
                            <i class="fas fa-exclamation-triangle text-red-600 mr-3 mt-1"></i>
                            <div class="text-left">
                                <h4 class="font-semibold text-red-800 mb-1">Tekrar Çözme Koşulları</h4>
                                <ul class="text-sm text-red-700 space-y-1">
                                    <li>• Her test sadece 1 kez çözülebilir</li>
                                    <li>• Düşük puan aldığınız testler için öğretmeninizin yeniden atama yapması gerekir</li>
                                    <li>• Öğretmeniniz size tekrar şans verirse test yeniden görünecektir</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-3">
                        <div class="text-sm text-gray-600">
                            <i class="fas fa-lightbulb mr-2 text-yellow-500"></i>
                            <strong>İpucu:</strong> Diğer testleri çözerek kendinizi geliştirebilirsiniz!
                        </div>
                        
                        <button onclick="this.closest('.fixed').remove()" class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 font-semibold">
                            Anladım
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Auto remove after 10 seconds
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.remove();
                }
            }, 10000);
        }

        // Show notification
        // showNotification → js/ui.js dosyasında gelişmiş Toast sistemi olarak tanımlandı.
        // Bu eski versiyon kaldırıldı; window.showNotification ui.js tarafından set edilir.

        // Filter tests based on search and filter criteria
        function filterTests() {
            currentTestSearch = document.getElementById('testSearchInput')?.value.toLowerCase().trim() || '';
            const sortBy = document.getElementById('testSortSelect')?.value || 'newest';
            
            let filteredTests = [...allTestsData];

            // Apply search filter
            if (currentTestSearch) {
                filteredTests = filteredTests.filter(test => 
                    test.title.toLowerCase().includes(currentTestSearch) ||
                    (test.description && test.description.toLowerCase().includes(currentTestSearch))
                );
            }

            // Apply category filter
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            switch (currentTestFilter) {
                case 'recent':
                    filteredTests = filteredTests.filter(test => 
                        new Date(test.created_at) >= sevenDaysAgo
                    );
                    break;
                case 'active':
                    filteredTests = filteredTests.filter(test => 
                        test.totalAssignments > 0 && test.completedAssignments < test.totalAssignments
                    );
                    break;
                case 'completed':
                    filteredTests = filteredTests.filter(test => 
                        test.totalAssignments > 0 && test.completedAssignments === test.totalAssignments
                    );
                    break;
                case 'no_assignments':
                    filteredTests = filteredTests.filter(test => 
                        test.totalAssignments === 0
                    );
                    break;
                case 'all':
                default:
                    // No additional filtering
                    break;
            }

            // Apply sorting
            switch (sortBy) {
                case 'oldest':
                    filteredTests.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                    break;
                case 'name_asc':
                    filteredTests.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
                    break;
                case 'name_desc':
                    filteredTests.sort((a, b) => b.title.localeCompare(a.title, 'tr'));
                    break;
                case 'most_assigned':
                    filteredTests.sort((a, b) => b.totalAssignments - a.totalAssignments);
                    break;
                case 'least_assigned':
                    filteredTests.sort((a, b) => a.totalAssignments - b.totalAssignments);
                    break;
                case 'newest':
                default:
                    filteredTests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    break;
            }

            displayFilteredTests(filteredTests);
        }

        // Set test filter
        function setTestFilter(filter) {
            currentTestFilter = filter;
            
            // Update button states
            const buttons = document.querySelectorAll('.test-filter-btn');
            buttons.forEach(btn => {
                btn.classList.remove('bg-green-100', 'text-green-800', 'border-green-200', 'font-medium');
                btn.classList.add('bg-gray-100', 'text-gray-700', 'border-gray-200');
            });
            
            const activeButton = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1).replace('_', '')}Tests`);
            if (activeButton) {
                activeButton.classList.remove('bg-gray-100', 'text-gray-700', 'border-gray-200');
                activeButton.classList.add('bg-green-100', 'text-green-800', 'border-green-200', 'font-medium');
            }
            
            filterTests();
        }

        // Clear all filters
        function clearTestFilters() {
            currentTestFilter = 'all';
            currentTestSearch = '';
            
            document.getElementById('testSearchInput').value = '';
            document.getElementById('testSortSelect').value = 'newest';
            
            setTestFilter('all');
        }

        // Update filter info
        function updateTestFilterInfo(filteredCount) {
            const totalCount = allTestsData.length;
            const infoElement = document.getElementById('testFilterInfo');
            
            if (!infoElement) return;
            
            let infoText = '';
            
            if (currentTestSearch && currentTestFilter !== 'all') {
                infoText = `"${currentTestSearch}" araması ve ${getFilterDisplayName(currentTestFilter)} filtresi: ${filteredCount}/${totalCount} test`;
            } else if (currentTestSearch) {
                infoText = `"${currentTestSearch}" araması: ${filteredCount}/${totalCount} test`;
            } else if (currentTestFilter !== 'all') {
                infoText = `${getFilterDisplayName(currentTestFilter)} filtresi: ${filteredCount}/${totalCount} test`;
            } else {
                infoText = `Tüm testler gösteriliyor: ${filteredCount} test`;
            }
            
            infoElement.textContent = infoText;
        }

        // Get filter display name
        function getFilterDisplayName(filter) {
            const names = {
                'recent': 'Son Eklenenler',
                'active': 'Aktif Testler',
                'completed': 'Tamamlananlar',
                'no_assignments': 'Atanmamış Testler'
            };
            return names[filter] || filter;
        }

        // Global variable for current test data being edited
        let currentTestData = null;

        // Preview test function
        function previewTest() {
            const testData = getTestDataFromForm();
            if (!testData) return;

            currentTestData = testData;
            displayTestPreview(testData);
            document.getElementById('testPreviewModal').classList.remove('hidden');
        }

        // Edit test function
        function editTest() {
            const testData = getTestDataFromForm();
            if (!testData) return;

            currentTestData = testData;
            populateEditForm(testData);
            document.getElementById('testEditModal').classList.remove('hidden');
        }

        // Edit from preview
        function editFromPreview() {
            closeModal('testPreviewModal');
            populateEditForm(currentTestData);
            document.getElementById('testEditModal').classList.remove('hidden');
        }

        // Get test data from upload form
        function getTestDataFromForm() {
            const name = document.getElementById('testName').value.trim();
            const description = document.getElementById('testDescription').value.trim();

            if (!name) {
                showNotification('Test adı boş olamaz!', 'error');
                return null;
            }

            let testData;
            const pasteContent = document.getElementById('pasteUploadContent');
            
            if (!pasteContent.classList.contains('hidden')) {
                // Paste tab is active
                const jsonText = document.getElementById('jsonTextArea').value.trim();
                if (!jsonText) {
                    showNotification('Lütfen JSON kodunu yapıştırın.', 'error');
                    return null;
                }

                try {
                    testData = JSON.parse(jsonText);
                } catch (error) {
                    showNotification(`Geçersiz JSON formatı: ${error.message}`, 'error');
                    return null;
                }
            } else {
                // File tab is active
                const file = document.getElementById('testFile').files[0];
                if (!file) {
                    showNotification('Lütfen bir JSON dosyası seçin veya JSON kodunu yapıştırın.', 'error');
                    return null;
                }

                showNotification('Dosya önizlemesi için JSON kodunu yapıştırma sekmesini kullanın.', 'info');
                return null;
            }

            // Validate test structure
            const validation = validateTestStructure(testData);
            if (!validation.isValid) {
                showNotification(`Test yapısı geçersiz: ${validation.errors.join(', ')}`, 'error');
                return null;
            }

            // Merge form data with JSON data
            return {
                title: name,
                description: description || testData.description || '',
                readingText: testData.readingText || testData.reading_text || '',
                timeLimit: parseInt(testData.timeLimit || testData.time_limit || 30),
                questions: testData.questions || []
            };
        }

        // Display test preview
        function displayTestPreview(testData) {
            document.getElementById('previewTitle').textContent = testData.title;
            document.getElementById('previewDescription').textContent = testData.description || 'Açıklama bulunmuyor';
            document.getElementById('previewTimeLimit').textContent = testData.timeLimit;
            
            // Calculate and display total points
            const totalPoints = testData.questions.reduce((sum, q) => sum + (q.points || 5), 0);
            document.getElementById('previewQuestionCount').innerHTML = `${testData.questions.length}<br><small class="text-sm text-purple-500">${totalPoints} toplam puan</small>`;
            
            document.getElementById('previewReadingText').textContent = testData.readingText;

            const questionsContainer = document.getElementById('previewQuestions');
            questionsContainer.innerHTML = '';

            testData.questions.forEach((question, index) => {
                const questionDiv = document.createElement('div');
                questionDiv.className = 'bg-gray-50 border border-gray-200 rounded-lg p-4';
                
                let questionTypeText = '';
                let questionTypeColor = '';
                let optionsHtml = '';

                switch (question.type) {
                    case 'multiple_choice':
                        questionTypeText = 'Çoktan Seçmeli';
                        questionTypeColor = 'bg-blue-100 text-blue-800';
                        optionsHtml = question.options.map((option, i) => 
                            `<div class="flex items-center space-x-2 ${i === question.correct ? 'font-semibold text-green-700' : ''}">
                                <span class="w-6 h-6 rounded-full border-2 ${i === question.correct ? 'bg-green-500 border-green-500' : 'border-gray-300'} flex items-center justify-center text-xs text-white">
                                    ${String.fromCharCode(65 + i)}
                                </span>
                                <span>${option.replace(/^[A-Z]\)\s*/, '')}</span>
                                ${i === question.correct ? '<i class="fas fa-check text-green-600 ml-2"></i>' : ''}
                            </div>`
                        ).join('');
                        break;
                    case 'fill_blank':
                        questionTypeText = 'Boşluk Doldurma';
                        questionTypeColor = 'bg-yellow-100 text-yellow-800';
                        optionsHtml = `
                            <div class="bg-white p-3 rounded border">
                                <p class="mb-2"><strong>Doğru Cevap:</strong> <span class="text-green-700 font-semibold">${question.correct}</span></p>
                                ${question.options ? `<p><strong>Seçenekler:</strong> ${question.options.join(', ')}</p>` : ''}
                            </div>
                        `;
                        break;
                    case 'true_false':
                        questionTypeText = 'Doğru/Yanlış';
                        questionTypeColor = 'bg-green-100 text-green-800';
                        optionsHtml = `
                            <div class="flex space-x-4">
                                <div class="flex items-center space-x-2 ${question.correct ? 'font-semibold text-green-700' : ''}">
                                    <div class="w-8 h-8 rounded-full ${question.correct ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center">
                                        <i class="fas fa-check text-white text-sm"></i>
                                    </div>
                                    <span>DOĞRU</span>
                                    ${question.correct ? '<i class="fas fa-check text-green-600 ml-2"></i>' : ''}
                                </div>
                                <div class="flex items-center space-x-2 ${!question.correct ? 'font-semibold text-green-700' : ''}">
                                    <div class="w-8 h-8 rounded-full ${!question.correct ? 'bg-red-500' : 'bg-gray-300'} flex items-center justify-center">
                                        <i class="fas fa-times text-white text-sm"></i>
                                    </div>
                                    <span>YANLIŞ</span>
                                    ${!question.correct ? '<i class="fas fa-check text-green-600 ml-2"></i>' : ''}
                                </div>
                            </div>
                        `;
                        break;
                }

                questionDiv.innerHTML = `
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center space-x-3">
                            <h5 class="font-semibold text-gray-900">Soru ${index + 1}</h5>
                            <span class="px-2 py-1 text-xs font-medium rounded-full ${questionTypeColor}">
                                ${questionTypeText}
                            </span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                ${question.points || 5} puan
                            </span>
                            <span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                                ${question.timeLimit || 75}s
                            </span>
                        </div>
                    </div>
                    <p class="text-gray-800 mb-4 font-medium">${question.question}</p>
                    <div class="space-y-2">
                        ${optionsHtml}
                    </div>
                `;

                questionsContainer.appendChild(questionDiv);
            });
        }

        // Populate edit form
        function populateEditForm(testData) {
            document.getElementById('editTestName').value = testData.title;
            document.getElementById('editTestDescription').value = testData.description || '';
            document.getElementById('editTimeLimit').value = testData.timeLimit;
            document.getElementById('editReadingText').value = testData.readingText;

            const questionsEditor = document.getElementById('questionsEditor');
            questionsEditor.innerHTML = '';

            testData.questions.forEach((question, index) => {
                addQuestionToEditor(question, index);
            });
        }

        // Add question to editor
        function addQuestionToEditor(question = null, index = null) {
            const questionsEditor = document.getElementById('questionsEditor');
            const questionIndex = index !== null ? index : questionsEditor.children.length;
            
            const questionDiv = document.createElement('div');
            questionDiv.className = 'bg-gray-50 border border-gray-200 rounded-lg p-4';
            questionDiv.dataset.questionIndex = questionIndex;

            const questionType = question?.type || 'multiple_choice';
            const questionText = question?.question || '';
            const questionOptions = question?.options || ['', '', ''];
            const questionCorrect = question?.correct !== undefined ? question.correct : 0;

            questionDiv.innerHTML = `
                <div class="flex justify-between items-center mb-4">
                    <h5 class="font-semibold text-gray-900">Soru ${questionIndex + 1}</h5>
                    <div class="flex space-x-2">
                        <select onchange="changeQuestionType(${questionIndex}, this.value)" class="px-3 py-1 text-sm border border-gray-300 rounded">
                            <option value="multiple_choice" ${questionType === 'multiple_choice' ? 'selected' : ''}>Çoktan Seçmeli</option>
                            <option value="fill_blank" ${questionType === 'fill_blank' ? 'selected' : ''}>Boşluk Doldurma</option>
                            <option value="true_false" ${questionType === 'true_false' ? 'selected' : ''}>Doğru/Yanlış</option>
                        </select>
                        <button type="button" onclick="removeQuestion(${questionIndex})" class="px-2 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Soru Metni</label>
                    <textarea rows="2" class="question-text w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" required>${questionText}</textarea>
                </div>

                <!-- Question Settings -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Puan Değeri</label>
                        <input type="number" min="1" max="20" value="${question?.points || 5}" 
                               class="question-points w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" 
                               placeholder="5">
                        <p class="text-xs text-gray-500 mt-1">1-20 arası puan değeri</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Süre Limiti (saniye)</label>
                        <input type="number" min="30" max="300" value="${question?.timeLimit || 75}" 
                               class="question-time-limit w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" 
                               placeholder="75">
                        <p class="text-xs text-gray-500 mt-1">30-300 saniye arası</p>
                    </div>
                </div>

                <div class="question-options-container">
                    ${generateQuestionOptionsEditor(questionType, questionOptions, questionCorrect)}
                </div>
            `;

            questionsEditor.appendChild(questionDiv);
        }

        // Generate question options editor based on type
        function addOptionToQuestion(btn) {
            const container = btn.closest('.space-y-3').querySelector('.options-list');
            const optionsCount = container.children.length;
            if (optionsCount >= 6) {
                showNotification('En fazla 6 seçenek ekleyebilirsiniz.', 'warning');
                return;
            }
            
            const uniqueId = container.querySelector('input[type="radio"]').name;
            const newIndex = optionsCount;
            const letter = String.fromCharCode(65 + newIndex);
            
            const optionDiv = document.createElement('div');
            optionDiv.className = 'flex items-center space-x-3';
            optionDiv.innerHTML = `
                <input type="radio" name="${uniqueId}" value="${newIndex}" class="correct-answer">
                <span class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center font-semibold text-sm option-letter">
                    ${letter}
                </span>
                <input type="text" class="option-text flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" 
                       placeholder="Seçenek ${letter}" value="" required>
                <button type="button" onclick="removeOptionFromQuestion(this)" class="text-red-500 hover:text-red-700">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(optionDiv);
        }

        function removeOptionFromQuestion(btn) {
            const container = btn.closest('.options-list');
            if (container.children.length <= 2) {
                showNotification('En az 2 seçenek olmalıdır.', 'warning');
                return;
            }
            
            btn.closest('.flex').remove();
            
            // Re-index remaining options
            const options = container.querySelectorAll('.flex');
            options.forEach((opt, i) => {
                const radio = opt.querySelector('input[type="radio"]');
                const letterSpan = opt.querySelector('.option-letter');
                const textInput = opt.querySelector('.option-text');
                
                radio.value = i;
                letterSpan.textContent = String.fromCharCode(65 + i);
                textInput.placeholder = `Seçenek ${String.fromCharCode(65 + i)}`;
            });
        }

        function generateQuestionOptionsEditor(type, options, correct) {
            const uniqueId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            switch (type) {
                case 'multiple_choice':
                    return `
                        <div class="space-y-3">
                            <div class="flex justify-between items-center">
                                <label class="block text-sm font-medium text-gray-700">Seçenekler</label>
                                <button type="button" onclick="addOptionToQuestion(this)" class="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
                                    <i class="fas fa-plus mr-1"></i>Seçenek Ekle
                                </button>
                            </div>
                            <div class="options-list space-y-3">
                                ${options.map((option, i) => `
                                    <div class="flex items-center space-x-3">
                                        <input type="radio" name="correct_${uniqueId}" value="${i}" ${i === correct || i === parseInt(correct) ? 'checked' : ''} class="correct-answer">
                                        <span class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center font-semibold text-sm option-letter">
                                            ${String.fromCharCode(65 + i)}
                                        </span>
                                        <input type="text" class="option-text flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" 
                                               placeholder="Seçenek ${String.fromCharCode(65 + i)}" value="${option.replace(/^[A-Z]\)\s*/, '')}" required>
                                        <button type="button" onclick="removeOptionFromQuestion(this)" class="text-red-500 hover:text-red-700">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                            <p class="text-xs text-gray-600">Doğru cevabı seçmek için sol taraftaki radio butonları kullanın.</p>
                        </div>
                    `;
                case 'fill_blank':
                    return `
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Doğru Cevap</label>
                                <input type="text" class="correct-answer w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" 
                                       value="${typeof correct === 'string' ? correct : ''}" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Seçenekler (virgülle ayırın)</label>
                                <input type="text" class="question-options w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" 
                                       value="${Array.isArray(options) ? options.join(', ') : ''}" placeholder="seçenek1, seçenek2, seçenek3, seçenek4...">
                            </div>
                        </div>
                    `;
                case 'true_false':
                    return `
                        <div class="space-y-3">
                            <label class="block text-sm font-medium text-gray-700">Doğru Cevap</label>
                            <div class="flex space-x-4">
                                <label class="flex items-center space-x-2">
                                    <input type="radio" name="tf_correct_${Date.now()}_${Math.random()}" value="true" ${correct === true ? 'checked' : ''} class="correct-answer">
                                    <span class="text-green-700 font-semibold">DOĞRU</span>
                                </label>
                                <label class="flex items-center space-x-2">
                                    <input type="radio" name="tf_correct_${Date.now()}_${Math.random()}" value="false" ${correct === false ? 'checked' : ''} class="correct-answer">
                                    <span class="text-red-700 font-semibold">YANLIŞ</span>
                                </label>
                            </div>
                        </div>
                    `;
                default:
                    return '';
            }
        }

        // Change question type
        function changeQuestionType(questionIndex, newType) {
            const questionDiv = document.querySelector(`[data-question-index="${questionIndex}"]`);
            const optionsContainer = questionDiv.querySelector('.question-options-container');
            
            // Reset options based on new type
            let options, correct;
            switch (newType) {
                case 'multiple_choice':
                    options = ['', '', ''];
                    correct = 0;
                    break;
                case 'fill_blank':
                    options = [];
                    correct = '';
                    break;
                case 'true_false':
                    options = [];
                    correct = true;
                    break;
            }
            
            optionsContainer.innerHTML = generateQuestionOptionsEditor(newType, options, correct);
        }

        // Add new question
        function addNewQuestion() {
            addQuestionToEditor();
        }

        // Remove question
        function removeQuestion(questionIndex) {
            if (!confirm('Bu soruyu silmek istediğinizden emin misiniz?')) return;
            
            const questionDiv = document.querySelector(`[data-question-index="${questionIndex}"]`);
            questionDiv.remove();
            
            // Reindex remaining questions
            const questionsEditor = document.getElementById('questionsEditor');
            Array.from(questionsEditor.children).forEach((div, index) => {
                div.dataset.questionIndex = index;
                div.querySelector('h5').textContent = `Soru ${index + 1}`;
                
                // Update remove button onclick
                const removeBtn = div.querySelector('button[onclick*="removeQuestion"]');
                removeBtn.setAttribute('onclick', `removeQuestion(${index})`);
                
                // Update change type select
                const typeSelect = div.querySelector('select[onchange*="changeQuestionType"]');
                typeSelect.setAttribute('onchange', `changeQuestionType(${index}, this.value)`);
            });
        }

        // Preview edited test
        function previewEditedTest() {
            const testData = getEditedTestData();
            if (!testData) return;

            currentTestData = testData;
            displayTestPreview(testData);
            closeModal('testEditModal');
            document.getElementById('testPreviewModal').classList.remove('hidden');
        }

        // Get edited test data
        function getEditedTestData() {
            const titleElement = document.getElementById('editTestName');
            const descriptionElement = document.getElementById('editTestDescription');
            const timeLimitElement = document.getElementById('editTimeLimit');
            const readingTextElement = document.getElementById('editReadingText');
            
            if (!titleElement || !descriptionElement || !timeLimitElement || !readingTextElement) {
                showNotification('Form elemanları bulunamadı!', 'error');
                console.error('Missing form elements');
                return null;
            }
            
            const title = titleElement.value.trim();
            const description = descriptionElement.value.trim();
            const timeLimit = parseInt(timeLimitElement.value);
            const readingText = readingTextElement.value.trim();

            if (!title || !readingText || !timeLimit) {
                showNotification('Lütfen tüm gerekli alanları doldurun.', 'error');
                return null;
            }

            const questions = [];
            const questionDivs = document.querySelectorAll('#questionsEditor > div');

            for (let i = 0; i < questionDivs.length; i++) {
                const questionDiv = questionDivs[i];
                const questionText = questionDiv.querySelector('.question-text').value.trim();
                const typeSelect = questionDiv.querySelector('select');
                const questionType = typeSelect.value;

                if (!questionText) {
                    showNotification(`Soru ${i + 1} metni boş olamaz.`, 'error');
                    return null;
                }

                const question = {
                    type: questionType,
                    question: questionText
                };

                // Get question settings (points and time limit)
                const pointsInput = questionDiv.querySelector('.question-points');
                const timeLimitInput = questionDiv.querySelector('.question-time-limit');
                
                question.points = pointsInput ? parseInt(pointsInput.value) || 5 : 5;
                question.timeLimit = timeLimitInput ? parseInt(timeLimitInput.value) || 75 : 75;

                // Get type-specific data
                switch (questionType) {
                    case 'multiple_choice':
                        const optionInputs = questionDiv.querySelectorAll('.option-text');
                        const correctRadios = questionDiv.querySelectorAll('input[type="radio"].correct-answer');
                        let correctAnswer = 0;
                        
                        // Tüm radyo butonlarını kontrol et
                        for (let j = 0; j < correctRadios.length; j++) {
                            if (correctRadios[j].checked) {
                                correctAnswer = parseInt(correctRadios[j].value);
                                break;
                            }
                        }
                        
                        question.options = Array.from(optionInputs).map(input => input.value.trim());
                        question.correct = correctAnswer;
                        
                        if (question.options.some(opt => !opt)) {
                            showNotification(`Soru ${i + 1} seçenekleri boş olamaz.`, 'error');
                            return null;
                        }
                        
                        if (question.correct === undefined || question.correct === null || isNaN(question.correct)) {
                            showNotification(`Soru ${i + 1} için doğru cevabı seçmelisiniz.`, 'error');
                            return null;
                        }
                        break;
                        
                    case 'fill_blank':
                        const correctInput = questionDiv.querySelector('.correct-answer');
                        const optionsInput = questionDiv.querySelector('.question-options');
                        
                        question.correct = correctInput.value.trim();
                        question.options = optionsInput.value.trim() ? 
                            optionsInput.value.split(',').map(opt => opt.trim()).filter(opt => opt) : 
                            [question.correct];
                        
                        if (!question.correct) {
                            showNotification(`Soru ${i + 1} doğru cevabı boş olamaz.`, 'error');
                            return null;
                        }
                        break;
                        
                    case 'true_false':
                        const tfRadio = questionDiv.querySelector('.correct-answer:checked');
                        question.correct = tfRadio ? tfRadio.value === 'true' : true;
                        break;
                }

                questions.push(question);
            }

            if (questions.length === 0) {
                showNotification('En az bir soru eklemelisiniz.', 'error');
                return null;
            }

            return {
                title,
                description,
                timeLimit,
                readingText,
                questions
            };
        }

        // Save edited test
        function saveEditedTestLocal(event) {
            event.preventDefault();
            
            const testData = getEditedTestData();
            if (!testData) return;
            // Update the upload form with edited data
            document.getElementById('testName').value = testData.title;
            document.getElementById('testDescription').value = testData.description;
            
            // Update JSON textarea
            const jsonData = {
                title: testData.title,
                description: testData.description,
                readingText: testData.readingText,
                timeLimit: testData.timeLimit,
                questions: testData.questions
            };
            
            document.getElementById('jsonTextArea').value = JSON.stringify(jsonData, null, 2);
            
            // Switch to paste tab if not already active
            switchUploadTab('paste');
            
            closeModal('testEditModal');
            showNotification('Test düzenlemeleri kaydedildi! Artık yükleyebilirsiniz.', 'success');
        }

        // Set student test filter
        function setStudentTestFilter(filter) {
            currentStudentTestFilter = filter;
            
            // Update button states
            const buttons = document.querySelectorAll('.student-test-filter-btn');
            buttons.forEach(btn => {
                btn.classList.remove('bg-blue-100', 'text-blue-800', 'border-blue-200', 'font-medium');
                btn.classList.add('bg-gray-100', 'text-gray-700', 'border-gray-200');
            });
            
            const activeButton = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1).replace('_', '')}StudentTests`);
            if (activeButton) {
                activeButton.classList.remove('bg-gray-100', 'text-gray-700', 'border-gray-200');
                activeButton.classList.add('bg-blue-100', 'text-blue-800', 'border-blue-200', 'font-medium');
            }
            
            // Apply filter
            filterStudentTests();
        }

        // Clear student test filters
        function clearStudentTestFilters() {
            const searchInput = document.getElementById('studentTestSearchInput');
            if (searchInput) searchInput.value = '';
            setStudentTestFilter('all');
        }

        // Update student test filter info
        function updateStudentTestFilterInfo(filteredCount, totalCount) {
            const infoElement = document.getElementById('studentTestFilterInfo');
            if (!infoElement) return;
            
            let infoText = '';
            
            switch (currentStudentTestFilter) {
                case 'waiting':
                    infoText = `🟡 Bekleyen testler: ${filteredCount}/${totalCount}`;
                    break;
                case 'successful':
                    infoText = `🟢 Başarılı testler: ${filteredCount}/${totalCount}`;
                    break;
                case 'low_score':
                    infoText = `🔴 Düşük puan alan testler: ${filteredCount}/${totalCount}`;
                    break;
                case 'alistirma':
                    infoText = `🔧 Alıştırma testleri: ${filteredCount}/${totalCount}`;
                    break;
                case 'sinav':
                    infoText = `📋 Sınav testleri: ${filteredCount}/${totalCount}`;
                    break;
                case 'all':
                default:
                    infoText = `Tüm testler gösteriliyor: ${filteredCount} test`;
                    break;
            }
            
            infoElement.textContent = infoText;
        }

        // Refresh student tests
        async function refreshStudentTests() {
            try {
                showNotification('Testler yenileniyor...', 'info');
                await loadStudentData();
                showNotification('Testler başarıyla yenilendi!', 'success');
            } catch (error) {
                console.error('Error refreshing student tests:', error);
                showNotification('Testler yenilenirken hata oluştu.', 'error');
            }
        }

        // Initialize tabs
        document.addEventListener('DOMContentLoaded', function() {
            showTab('tests');
            showTeacherTab('dashboard');
        });

        // ============================================
        // YEDEKLEME FONKSİYONLARI
        // ============================================

        // Tüm verileri yedekleme fonksiyonu
        async function backupAllData() {
            const confirmBackup = await showAssignmentConfirmDialog({
                title: '📥 Tüm Verileri Yedekle',
                message: 'Sistemdeki tüm verileri JSON formatında yedeklemek istediğinizden emin misiniz?',
                warning: '⚠️ UYARI:\n• Bu işlem tüm tabloları (öğretmenler, öğrenciler, testler, atamalar, sonuçlar, rozetler) içerecektir.\n• İşlem, veri miktarına bağlı olarak biraz zaman alabilir.',
                confirmText: 'Evet, Yedekle',
                cancelText: 'İptal'
            });

            if (!confirmBackup) {
                showNotification('Yedekleme işlemi iptal edildi.', 'info');
                return;
            }

            showNotification('Yedekleme işlemi başlatıldı, lütfen bekleyin...', 'info');

            try {
                const tablesToBackup = [
                    'teachers',
                    'students',
                    'tests',
                    'test_assignments',
                    'test_results',
                    'student_badges'
                ];

                const backupData = {
                    backup_date: new Date().toISOString(),
                    backup_version: '1.0',
                    system_name: 'Türkçe Okuma Anlama Test Sistemi',
                    tables: {}
                };
                
                let hasError = false;
                let totalRecords = 0;

                for (const tableName of tablesToBackup) {
                    try {
                        const { data, error } = await supabase.from(tableName).select('*');
                        if (error) {
                            console.error(`'${tableName}' tablosu yedeklenirken hata oluştu:`, error);
                            showNotification(`'${tableName}' tablosu yedeklenemedi.`, 'error');
                            hasError = true;
                            continue;
                        }
                        backupData.tables[tableName] = data;
                        totalRecords += data.length;
                        console.log(`✓ ${tableName}: ${data.length} kayıt yedeklendi`);
                    } catch (error) {
                        console.error(`'${tableName}' tablosu yedeklenirken beklenmeyen hata:`, error);
                        hasError = true;
                    }
                }

                if (hasError) {
                    showNotification('Yedekleme sırasında bazı hatalar oluştu, ancak mevcut veriler indiriliyor.', 'warning');
                }

                if (Object.keys(backupData.tables).length === 0) {
                    showNotification('Yedeklenecek veri bulunamadı.', 'error');
                    return;
                }

                // JSON dosyasını oluştur ve indir
                const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
                const fileName = `test-sistemi-yedek-${timestamp}.json`;
                downloadObjectAsJson(backupData, fileName);

                showNotification(`✅ Toplam ${totalRecords} kayıt başarıyla yedeklendi ve indirildi!`, 'success');
                console.log('Yedekleme özeti:', {
                    tarih: backupData.backup_date,
                    toplam_tablo: Object.keys(backupData.tables).length,
                    toplam_kayit: totalRecords,
                    dosya_adi: fileName
                });

            } catch (error) {
                console.error('Yedekleme sırasında genel bir hata oluştu:', error);
                showNotification('Yedekleme işlemi sırasında bir hata oluştu.', 'error');
            }
        }

        // Veriyi JSON dosyası olarak indirme yardımcı fonksiyonu
        function downloadObjectAsJson(exportObj, exportName) {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", exportName);
            document.body.appendChild(downloadAnchorNode); // Firefox için gerekli
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }

        // ============================================
        // SINIF KİTAPLIĞI FONKSİYONLARI
        // ============================================

        // Load students for library dropdown
        async function loadLibraryStudents() {
            try {
                const { data: students, error } = await supabase
                    .from('students')
                    .select('*')
                    .order('name');

                if (error) throw error;

                const select = document.getElementById('libraryStudentSelect');
                select.innerHTML = '<option value="">-- Öğrenci Seçin --</option>';
                
                if (!students || students.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'Henüz öğrenci eklenmemiş';
                    option.disabled = true;
                    select.appendChild(option);
                    return;
                }
                
                students.forEach(student => {
                    const option = document.createElement('option');
                    option.value = student.id;
                    option.textContent = `${student.name} (${student.class})`;
                    select.appendChild(option);
                });

                console.log(`✓ ${students.length} öğrenci yüklendi`);

            } catch (error) {
                console.error('Error loading library students:', error);
                showNotification('Öğrenciler yüklenirken hata oluştu: ' + error.message, 'error');
            }
        }

        // Load library for selected student
        async function loadLibraryForStudent() {
            const studentId = document.getElementById('libraryStudentSelect').value;
            
            if (!studentId) {
                // Reset view
                document.getElementById('libraryLegend').classList.add('hidden');
                document.getElementById('libraryStats').classList.add('hidden');
                document.getElementById('librarySearchFilter').classList.add('hidden');
                document.getElementById('libraryTestsGrid').innerHTML = `
                    <div class="text-center text-gray-500 py-8 col-span-full">
                        <i class="fas fa-book text-4xl mb-2"></i>
                        <p>Yukarıdan bir öğrenci seçin</p>
                    </div>
                `;
                return;
            }

            try {
                showNotification('Kitaplık yükleniyor...', 'info');

                // Get all tests
                const { data: tests, error: testsError } = await supabase
                    .from('tests')
                    .select('*')
                    .order('title');

                if (testsError) throw testsError;

                // Get student's assignments
                const { data: assignments, error: assignmentsError } = await supabase
                    .from('test_assignments')
                    .select('*')
                    .eq('student_id', studentId);

                if (assignmentsError) throw assignmentsError;

                // Get student's results
                const { data: results, error: resultsError } = await supabase
                    .from('test_results')
                    .select('*')
                    .eq('student_id', studentId);

                if (resultsError) throw resultsError;

                // Show legend, stats, and search/filter
                document.getElementById('libraryLegend').classList.remove('hidden');
                document.getElementById('libraryStats').classList.remove('hidden');
                document.getElementById('librarySearchFilter').classList.remove('hidden');
                
                // Reset search and filter
                document.getElementById('librarySearchInput').value = '';
                window.currentLibraryFilter = 'all';
                updateFilterButtons();

                // Calculate stats
                const assignedTestIds = assignments.map(a => a.test_id);
                const completedTestIds = results.map(r => r.test_id);
                
                let successCount = 0;
                let failedCount = 0;
                let pendingCount = 0;
                let unassignedCount = 0;

                tests.forEach(test => {
                    const result = results.find(r => r.test_id === test.id);
                    const isAssigned = assignedTestIds.includes(test.id);
                    
                    if (result) {
                        if (result.score >= 70) successCount++;
                        else failedCount++;
                    } else if (isAssigned) {
                        pendingCount++;
                    } else {
                        unassignedCount++;
                    }
                });

                // Update stats
                document.getElementById('libTotalTests').textContent = tests.length;
                document.getElementById('libSuccessTests').textContent = successCount;
                document.getElementById('libFailedTests').textContent = failedCount;
                document.getElementById('libPendingTests').textContent = pendingCount;
                document.getElementById('libUnassignedTests').textContent = unassignedCount;

                // Render tests grid
                const grid = document.getElementById('libraryTestsGrid');
                grid.innerHTML = '';

                tests.forEach(test => {
                    const result = results.find(r => r.test_id === test.id);
                    const isAssigned = assignedTestIds.includes(test.id);
                    
                    let status = 'unassigned';
                    let bgColor = 'bg-gray-100';
                    let borderColor = 'border-gray-300';
                    let textColor = 'text-gray-700';
                    let statusText = '⚪ Atanmamış';
                    let statusIcon = 'fa-circle';
                    let clickable = true;
                    
                    if (result) {
                        if (result.score >= 70) {
                            status = 'success';
                            bgColor = 'bg-green-50';
                            borderColor = 'border-green-400';
                            textColor = 'text-green-700';
                            statusText = `🟢 Başarılı (${result.score})`;
                            statusIcon = 'fa-check-circle';
                            clickable = false;
                        } else {
                            status = 'failed';
                            bgColor = 'bg-red-50';
                            borderColor = 'border-red-400';
                            textColor = 'text-red-700';
                            statusText = `🔴 Başarısız (${result.score})`;
                            statusIcon = 'fa-times-circle';
                            clickable = false;
                        }
                    } else if (isAssigned) {
                        status = 'pending';
                        bgColor = 'bg-yellow-50';
                        borderColor = 'border-yellow-400';
                        textColor = 'text-yellow-700';
                        statusText = '🟡 Bekleyen';
                        statusIcon = 'fa-clock';
                        clickable = false;
                    }

                    const card = document.createElement('div');
                    card.className = `library-test-card ${bgColor} border-2 ${borderColor} rounded-lg p-4 transition-all ${clickable ? 'cursor-pointer hover:shadow-lg hover:scale-105' : ''}`;
                    card.setAttribute('data-status', status);
                    card.setAttribute('data-title', test.title.toLowerCase());
                    
                    if (clickable) {
                        card.onclick = () => quickAssignTest(studentId, test.id, test.title);
                    }

                    card.innerHTML = `
                        <div class="flex items-start justify-between mb-2">
                            <div class="flex-1">
                                <h4 class="font-semibold ${textColor} text-sm mb-1">${test.title}</h4>
                                <p class="text-xs text-gray-600">${test.question_count} Soru</p>
                            </div>
                            <i class="fas ${statusIcon} ${textColor} text-lg"></i>
                        </div>
                        <div class="mt-3 pt-3 border-t ${borderColor}">
                            <p class="text-xs ${textColor} font-medium">${statusText}</p>
                            ${clickable ? '<p class="text-xs text-gray-500 mt-1">Tıklayarak atayın</p>' : ''}
                        </div>
                    `;

                    grid.appendChild(card);
                });
                
                // Store tests data globally for filtering
                window.libraryTestsData = { tests, results, assignments, studentId };

                // Restore previous search term if exists
                const searchInput = document.getElementById('librarySearchInput');
                if (searchInput && window.currentLibrarySearch) {
                    searchInput.value = window.currentLibrarySearch;
                }

                // Apply current filter and search after loading
                filterLibraryTests();
                updateFilterButtons();

                showNotification('✅ Kitaplık yüklendi!', 'success');

            } catch (error) {
                console.error('Error loading library:', error);
                showNotification('Kitaplık yüklenirken hata oluştu: ' + error.message, 'error');
            }
        }

        // Quick assign test from library
        async function quickAssignTest(studentId, testId, testTitle) {
            const confirmAssign = await showAssignmentConfirmDialog({
                title: '📚 Hızlı Test Ataması',
                message: `"${testTitle}" testini seçili öğrenciye atamak istiyor musunuz?`,
                confirmText: 'Evet, Ata',
                cancelText: 'İptal'
            });

            if (!confirmAssign) return;

            try {
                showNotification('Test atanıyor...', 'info');

                // Check if already assigned
                const { data: existing, error: checkError } = await supabase
                    .from('test_assignments')
                    .select('*')
                    .eq('student_id', studentId)
                    .eq('test_id', testId)
                    .single();

                if (existing) {
                    showNotification('Bu test zaten öğrenciye atanmış.', 'warning');
                    return;
                }

                // Assign test
                const { error: assignError } = await supabase
                    .from('test_assignments')
                    .insert([{
                        student_id: studentId,
                        test_id: testId,
                        assigned_by: currentUser.id,
                        assigned_at: new Date().toISOString()
                    }]);

                if (assignError) throw assignError;

                showNotification('✅ Test başarıyla atandı!', 'success');
                
                // Reload library
                loadLibraryForStudent();

            } catch (error) {
                console.error('Error assigning test:', error);
                showNotification('Test atanırken hata oluştu: ' + error.message, 'error');
            }
        }

        // Set library filter
        function setLibraryFilter(filterType) {
            window.currentLibraryFilter = filterType;
            updateFilterButtons();
            filterLibraryTests();
        }

        // Update filter button styles
        function updateFilterButtons() {
            const buttons = {
                'all': document.getElementById('filterAll'),
                'success': document.getElementById('filterSuccess'),
                'failed': document.getElementById('filterFailed'),
                'pending': document.getElementById('filterPending'),
                'unassigned': document.getElementById('filterUnassigned')
            };

            Object.keys(buttons).forEach(key => {
                const btn = buttons[key];
                if (btn) {
                    if (key === window.currentLibraryFilter) {
                        btn.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
                        btn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
                    } else {
                        btn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700');
                        btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
                    }
                }
            });
        }

        // Filter library tests based on search and status
        function filterLibraryTests() {
            const searchInput = document.getElementById('librarySearchInput');
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : (window.currentLibrarySearch || '').toLowerCase();
            
            // Update global search state
            if (searchInput) {
                window.currentLibrarySearch = searchInput.value;
            }
            
            const cards = document.querySelectorAll('.library-test-card');
            
            let visibleCount = 0;

            cards.forEach(card => {
                const status = card.getAttribute('data-status');
                const title = card.getAttribute('data-title');
                
                // Check status filter
                let statusMatch = window.currentLibraryFilter === 'all' || status === window.currentLibraryFilter;
                
                // Check search term
                let searchMatch = !searchTerm || title.includes(searchTerm);
                
                // Show/hide card
                if (statusMatch && searchMatch) {
                    card.style.display = 'block';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            // Show message if no results
            const grid = document.getElementById('libraryTestsGrid');
            let noResultsMsg = grid.querySelector('.no-results-message');
            
            if (visibleCount === 0) {
                if (!noResultsMsg) {
                    noResultsMsg = document.createElement('div');
                    noResultsMsg.className = 'no-results-message text-center text-gray-500 py-8 col-span-full';
                    noResultsMsg.innerHTML = `
                        <i class="fas fa-search text-4xl mb-2"></i>
                        <p>Arama kriterlerine uygun test bulunamadı</p>
                        <button onclick="resetLibraryFilters()" class="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                            Filtreleri Temizle
                        </button>
                    `;
                    grid.appendChild(noResultsMsg);
                }
            } else {
                if (noResultsMsg) {
                    noResultsMsg.remove();
                }
            }
        }

        // Reset library filters
        function resetLibraryFilters() {
            document.getElementById('librarySearchInput').value = '';
            window.currentLibraryFilter = 'all';
            updateFilterButtons();
            filterLibraryTests();
        }

        // ============================================
        // DETAYLI SONUÇLAR FONKSİYONLARI
        // ============================================

        // Optik form soru analizi HTML üretici
        function renderOptikSoruAnaliz(soruAnaliz) {
            if (!soruAnaliz || soruAnaliz.length === 0) {
                return '<p class="text-sm text-gray-400 text-center py-4">Soru analizi verisi bulunamadı.</p>';
            }
            // Özet grid: her soru için renkli küçük kutu
            var grid = soruAnaliz.map(function(s) {
                var bg = s.sonuc === 'dogru' ? 'background:#22c55e' : s.sonuc === 'yanlis' ? 'background:#ef4444' : 'background:#d1d5db';
                var label = s.sonuc === 'dogru' ? '✓' : s.sonuc === 'yanlis' ? (s.ogrenciCevap || '✗') : '—';
                var tip = s.sonuc === 'dogru'
                    ? ('S' + s.soruNo + ': Doğru (' + s.dogruCevap + ')')
                    : s.sonuc === 'yanlis'
                    ? ('S' + s.soruNo + ': Yanlış — Öğrenci: ' + s.ogrenciCevap + ', Doğru: ' + s.dogruCevap)
                    : ('S' + s.soruNo + ': Boş');
                return '<div title="' + tip + '" style="' + bg + ';color:#fff;width:36px;height:36px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;cursor:default;box-shadow:0 1px 3px rgba(0,0,0,.2);margin:2px;">' + label + '</div>';
            }).join('');
            // Detay satırları: sadece yanlış ve boş olanlar
            var hatalar = soruAnaliz.filter(function(s) { return s.sonuc !== 'dogru'; });
            var detaylar = hatalar.map(function(s) {
                var isYanlis = s.sonuc === 'yanlis';
                var bg = isYanlis ? 'background:#fef2f2;border:1px solid #fecaca;' : 'background:#f9fafb;border:1px solid #e5e7eb;';
                var icon = isYanlis ? '❌' : '⬜';
                var text = isYanlis
                    ? ('Öğrenci <strong>' + s.ogrenciCevap + '</strong> işaretledi, doğrusu <strong>' + s.dogruCevap + '</strong>')
                    : 'Boş bıraktı';
                return '<div style="' + bg + 'display:flex;align-items:center;gap:12px;padding:6px 12px;border-radius:8px;margin-bottom:4px;">' +
                    '<span style="font-size:14px;">' + icon + '</span>' +
                    '<span style="font-size:13px;font-weight:600;color:#374151;min-width:56px;">Soru ' + s.soruNo + '</span>' +
                    '<span style="font-size:13px;color:#4b5563;">' + text + '</span></div>';
            }).join('');
            var detayHTML = hatalar.length > 0
                ? '<p style="font-size:11px;font-weight:600;color:#6b7280;margin:12px 0 6px;">Hatalı / Boş Sorular:</p>' + detaylar
                : '<p style="font-size:12px;color:#16a34a;font-weight:600;">🎯 Tüm sorular doğru!</p>';
            return '<div style="margin-bottom:12px;">' +
                '<p style="font-size:11px;color:#6b7280;margin-bottom:8px;">🟢 Doğru &nbsp;🔴 Yanlış (öğrenci cevabı) &nbsp;⚪ Boş</p>' +
                '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">' + grid + '</div></div>' +
                detayHTML;
        }

        // Show detailed results modal (using student result view)
        async function showDetailedResults(resultId, studentId, studentName, testTitle) {
            try {
                showNotification('Detaylı sonuçlar yükleniyor...', 'info');

                // Get test result with test data
                const { data: result, error: resultError } = await supabase
                    .from('test_results')
                    .select('*')
                    .eq('id', resultId)
                    .single();

                if (resultError) throw resultError;

                // Get test data
                const { data: test, error: testError } = await supabase
                    .from('tests')
                    .select('*')
                    .eq('id', result.test_id)
                    .single();

                if (testError) throw testError;

                // Parse questions and student answers
                const questions = JSON.parse(test.questions);
                let answersData = result.answers ? JSON.parse(result.answers) : {};
                
                // Extract answers array from nested structure
                let studentAnswers = [];
                if (answersData.answers) {
                    // New format: {answers: {...} or [...], earnedPoints: ..., totalPoints: ...}
                    if (Array.isArray(answersData.answers)) {
                        studentAnswers = answersData.answers;
                    } else if (typeof answersData.answers === 'object') {
                        // Convert object to array: {"0": 2, "1": 1, ...} -> [2, 1, ...]
                        const answersArray = [];
                        for (let i = 0; i < questions.length; i++) {
                            answersArray[i] = answersData.answers[i] !== undefined ? answersData.answers[i] : answersData.answers[String(i)];
                        }
                        studentAnswers = answersArray;
                    }
                } else if (Array.isArray(answersData)) {
                    // Old format: direct array
                    studentAnswers = answersData;
                } else {
                    // Object format: convert to array
                    const answersArray = [];
                    for (let i = 0; i < questions.length; i++) {
                        answersArray[i] = answersData[i] !== undefined ? answersData[i] : answersData[String(i)];
                    }
                    studentAnswers = answersArray;
                }
                
                console.log('Parsed answers data:', answersData);
                console.log('Student answers array:', studentAnswers);
                
                // Calculate time
                const timeSpent = result.time_spent || 0;
                const minutes = Math.floor(timeSpent / 60);
                const seconds = timeSpent % 60;

                // Optik form kaynağını kontrol et
                const isOptikForm = answersData.kaynak === 'optik_form';
                const soruAnaliz = isOptikForm ? (answersData.soruAnaliz || []) : [];

                // Calculate statistics - exactly like student submitTest
                let totalPoints = 0;
                let earnedPoints = 0;
                let correctCount = 0;
                let totalQuestions;

                if (isOptikForm) {
                    totalQuestions = soruAnaliz.length;
                    correctCount = answersData.dogru || 0;
                    const yanlis = answersData.yanlis || 0;
                    const bos = answersData.bos || 0;
                    totalPoints = totalQuestions * 10;
                    earnedPoints = correctCount * 10;
                } else {
                    totalQuestions = questions.length;
                }

                if (!isOptikForm) questions.forEach((question, index) => {
                    const userAnswer = studentAnswers[index];
                    const questionPoints = question.points || 10;
                    totalPoints += questionPoints;
                    
                    let isCorrect = false;
                    
                    // Use correct field (not correct_answer)
                    const correctAnswer = question.correct !== undefined ? question.correct : question.correct_answer;
                    
                    if (question.type === 'multiple_choice') {
                        isCorrect = parseInt(userAnswer) === parseInt(correctAnswer);
                    } else if (question.type === 'fill_blank') {
                        if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
                            isCorrect = false;
                        } else if (question.options && question.options.length > 0 && !isNaN(parseInt(userAnswer)) && question.options[parseInt(userAnswer)] !== undefined) {
                            // Eski format: index ile kaydedilmiş
                            isCorrect = parseInt(userAnswer) === parseInt(correctAnswer);
                        } else {
                            // Yeni format: kelime olarak kaydedilmiş
                            isCorrect = String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
                        }
                    } else if (question.type === 'true_false') {
                        // Handle both boolean and string formats
                        let userAnswerBool = userAnswer;
                        if (typeof userAnswer === 'string') {
                            userAnswerBool = userAnswer === 'true' || userAnswer === true;
                        }
                        let correctAnswerBool = correctAnswer;
                        if (typeof correctAnswer === 'string') {
                            correctAnswerBool = correctAnswer === 'true' || correctAnswer === true;
                        }
                        isCorrect = userAnswerBool === correctAnswerBool && userAnswer !== undefined && userAnswer !== null && userAnswer !== '';
                    } else {
                        // Text questions
                        if (typeof userAnswer === 'string') {
                            isCorrect = userAnswer.toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
                        }
                    }
                    
                    if (isCorrect) {
                        correctCount++;
                        earnedPoints += questionPoints;
                    }
                });
                
                const score = result.score;
                const passed = score >= 70;

                // Create modal HTML (student result view style)
                const modalHTML = `
                    <div id="detailedResultsModal" class="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto" style="z-index:1100;">
                        <div class="min-h-screen flex items-center justify-center p-4">
                            <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full my-8">
                                <!-- Header -->
                                <div class="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <h3 class="text-xl font-bold text-gray-900 mb-2">
                                                <i class="fas fa-clipboard-check text-indigo-600 mr-2"></i>
                                                ${studentName} - Test Sonuçları
                                            </h3>
                                            <div class="space-y-1 text-sm text-gray-600">
                                                <p><strong>Test:</strong> ${testTitle}</p>
                                                <p><strong>Tarih:</strong> ${new Date(result.completed_at).toLocaleDateString('tr-TR', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}</p>
                                            </div>
                                        </div>
                                        <button onclick="closeDetailedResultsModal()" class="text-gray-400 hover:text-gray-600">
                                            <i class="fas fa-times text-2xl"></i>
                                        </button>
                                    </div>
                                </div>

                                <!-- Content -->
                                <div class="p-6 max-h-[70vh] overflow-y-auto">
                                    <div class="text-center mb-6">
                                        <div class="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${passed ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-orange-400 to-red-500'} shadow-lg">
                                            <i class="fas ${passed ? 'fa-trophy' : 'fa-exclamation-triangle'} text-3xl text-white"></i>
                                        </div>
                                        <h3 class="text-xl font-bold ${passed ? 'text-green-600' : 'text-orange-600'} mb-2">
                                            ${passed ? '🎉 Tebrikler!' : '⚠️ Test Tamamlandı'}
                                        </h3>
                                        <div class="text-3xl font-bold ${passed ? 'text-green-700' : 'text-red-600'} mb-2">
                                            ${score}%
                                        </div>
                                        <p class="text-sm text-gray-600 mb-1">
                                            ${passed ? 'Başarı puanına ulaştı!' : 'Başarı puanına ulaşamadı.'}
                                        </p>
                                        <p class="text-xs text-gray-500">
                                            Süre: ${minutes}dk ${seconds}sn
                                        </p>
                                    </div>
                                    
                                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 border border-blue-100">
                                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                                            <div class="bg-white rounded-lg p-3 shadow-sm">
                                                <div class="text-2xl font-bold ${score >= 90 ? 'text-green-600' : score >= 70 ? 'text-blue-600' : 'text-red-600'}">${score}%</div>
                                                <div class="text-xs text-gray-600 font-medium">Başarı Oranı</div>
                                                <div class="text-xs text-gray-500">
                                                    ${score >= 90 ? '🌟' : score >= 70 ? '✅' : '❌'}
                                                </div>
                                            </div>
                                            <div class="bg-white rounded-lg p-3 shadow-sm">
                                                <div class="text-2xl font-bold text-purple-600">${earnedPoints}</div>
                                                <div class="text-xs text-gray-600 font-medium">Kazanılan Puan</div>
                                                <div class="text-xs text-gray-500">
                                                    /${totalPoints} puan
                                                </div>
                                            </div>
                                            <div class="bg-white rounded-lg p-3 shadow-sm">
                                                <div class="text-2xl font-bold text-green-600">${correctCount}</div>
                                                <div class="text-xs text-gray-600 font-medium">Doğru Cevap</div>
                                                <div class="text-xs text-gray-500">
                                                    /${totalQuestions} soru
                                                </div>
                                            </div>
                                            <div class="bg-white rounded-lg p-3 shadow-sm">
                                                <div class="text-2xl font-bold text-red-600">${totalQuestions - correctCount}</div>
                                                <div class="text-xs text-gray-600 font-medium">Yanlış Cevap</div>
                                                <div class="text-xs text-gray-500">
                                                    ${totalQuestions - correctCount === 0 ? '🎯 Mükemmel!' : '📚 Çalış'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Performance Analysis Section -->
                                    <div class="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4 mb-4">
                                        <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                            <i class="fas fa-chart-line text-indigo-600 mr-2"></i>
                                            Performans Analizi
                                        </h4>
                                        <div class="grid grid-cols-3 gap-3">
                                            <div class="bg-white rounded-lg p-3 text-center border border-green-200">
                                                <div class="text-2xl font-bold text-green-600">${correctCount}</div>
                                                <div class="text-xs text-gray-600">Doğru Cevap</div>
                                                <div class="text-xs text-green-600 font-medium">${Math.round((correctCount/totalQuestions)*100)}%</div>
                                            </div>
                                            <div class="bg-white rounded-lg p-3 text-center border border-red-200">
                                                <div class="text-2xl font-bold text-red-600">${totalQuestions - correctCount}</div>
                                                <div class="text-xs text-gray-600">Yanlış Cevap</div>
                                                <div class="text-xs text-red-600 font-medium">${Math.round(((totalQuestions - correctCount)/totalQuestions)*100)}%</div>
                                            </div>
                                            <div class="bg-white rounded-lg p-3 text-center border border-purple-200">
                                                <div class="text-2xl font-bold text-purple-600">${earnedPoints}/${totalPoints}</div>
                                                <div class="text-xs text-gray-600">Toplam Puan</div>
                                                <div class="text-xs text-purple-600 font-medium">${Math.round((earnedPoints/totalPoints)*100)}%</div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Detailed Question Breakdown -->
                                    <div class="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                                        <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                            <i class="fas fa-list-check text-blue-600 mr-2"></i>
                                            Soru Bazında Detay (${totalQuestions} soru)
                                        </h4>
                                        <div class="space-y-2 max-h-96 overflow-y-auto">
                                                                                        ${isOptikForm ? renderOptikSoruAnaliz(soruAnaliz) : questions.map((question, index) => {
                                                const userAnswer = studentAnswers[index];
                                                const questionPoints = question.points || 10;
                                                let isCorrect = false;
                                                let userAnswerDisplay = '';
                                                let correctAnswerDisplay = '';
                                                
                                                // Get correct answer - try both field names
                                                const correctAnswer = question.correct !== undefined ? question.correct : question.correct_answer;
                                                
                                                if (question.type === 'multiple_choice') {
                                                    isCorrect = parseInt(userAnswer) === parseInt(correctAnswer);
                                                    userAnswerDisplay = userAnswer !== undefined && question.options[userAnswer] ? 
                                                        `${String.fromCharCode(65 + userAnswer)}) ${question.options[userAnswer]}` : 'Cevaplanmadı';
                                                    correctAnswerDisplay = `${String.fromCharCode(65 + correctAnswer)}) ${question.options[correctAnswer]}`;
                                                } else if (question.type === 'fill_blank') {
                                                    if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
                                                        isCorrect = false;
                                                        userAnswerDisplay = 'Cevaplanmadı';
                                                        correctAnswerDisplay = String(correctAnswer);
                                                    } else if (question.options && question.options.length > 0 && !isNaN(parseInt(userAnswer)) && question.options[parseInt(userAnswer)] !== undefined) {
                                                        // Eski format: index ile kaydedilmiş cevap
                                                        const answerIndex = parseInt(userAnswer);
                                                        isCorrect = answerIndex === parseInt(correctAnswer);
                                                        userAnswerDisplay = question.options[answerIndex] || 'Cevaplanmadı';
                                                        correctAnswerDisplay = typeof correctAnswer === 'number' ? 
                                                            (question.options[correctAnswer] || String(correctAnswer)) : String(correctAnswer);
                                                    } else {
                                                        // Yeni format: kelime olarak kaydedilmiş cevap (selectFillBlankWord)
                                                        const userWord = String(userAnswer).trim();
                                                        const correctWord = String(correctAnswer).trim();
                                                        isCorrect = userWord.toLowerCase() === correctWord.toLowerCase();
                                                        userAnswerDisplay = userWord;
                                                        correctAnswerDisplay = correctWord;
                                                    }
                                                } else if (question.type === 'true_false') {
                                                    // Handle both boolean and string formats for true_false questions
                                                    let userAnswerBool = userAnswer;
                                                    if (typeof userAnswer === 'string') {
                                                        userAnswerBool = userAnswer === 'true' || userAnswer === true;
                                                    }
                                                    let correctAnswerBool = correctAnswer;
                                                    if (typeof correctAnswer === 'string') {
                                                        correctAnswerBool = correctAnswer === 'true' || correctAnswer === true;
                                                    }
                                                    isCorrect = userAnswerBool === correctAnswerBool && userAnswer !== undefined && userAnswer !== null && userAnswer !== '';
                                                    userAnswerDisplay = userAnswer === true || userAnswer === 'true' ? 'Doğru' : userAnswer === false || userAnswer === 'false' ? 'Yanlış' : 'Cevaplanmadı';
                                                    correctAnswerDisplay = correctAnswer === true || correctAnswer === 'true' ? 'Doğru' : 'Yanlış';
                                                } else {
                                                    isCorrect = userAnswer && userAnswer.toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
                                                    userAnswerDisplay = userAnswer || 'Cevaplanmadı';
                                                    correctAnswerDisplay = correctAnswer;
                                                }
                                                
                                                return `
                                                    <div class="bg-white border-2 ${isCorrect ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'} rounded-lg p-4 mb-3">
                                                        <div class="flex justify-between items-start mb-3">
                                                            <div class="flex-1">
                                                                <div class="flex items-center space-x-2 mb-2">
                                                                    <span class="text-lg">${isCorrect ? '✅' : '❌'}</span>
                                                                    <span class="font-bold text-gray-900">Soru ${index + 1}</span>
                                                                    <span class="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded font-medium">
                                                                        ${question.type === 'multiple_choice' ? 'Çoktan Seçmeli' : 
                                                                           question.type === 'fill_blank' ? 'Boşluk Doldurma' : 
                                                                           question.type === 'true_false' ? 'Doğru/Yanlış' : 'Metin'}
                                                                    </span>
                                                                </div>
                                                                <p class="text-sm text-gray-900 font-medium mb-3">${question.text || question.question || 'Soru metni yok'}</p>
                                                            </div>
                                                            <div class="text-right">
                                                                <div class="text-3xl font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}">${isCorrect ? questionPoints : 0}</div>
                                                                <div class="text-xs text-gray-600">/${questionPoints} puan</div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div class="space-y-2 bg-white rounded p-3 border border-gray-200">
                                                            <div class="flex justify-between items-start">
                                                                <span class="text-sm font-semibold text-gray-700">📝 Öğrenci Cevabı:</span>
                                                                <span class="text-sm ${isCorrect ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}">${userAnswerDisplay}</span>
                                                            </div>
                                                            ${!isCorrect ? `
                                                                <div class="flex justify-between items-start pt-2 border-t border-gray-300">
                                                                    <span class="text-sm font-semibold text-gray-700">✓ Doğru Cevap:</span>
                                                                    <span class="text-sm text-green-700 font-bold">${correctAnswerDisplay}</span>
                                                                </div>
                                                            ` : ''}
                                                            ${question.explanation ? `
                                                                <div class="mt-3 pt-3 border-t border-gray-300 bg-blue-50 rounded p-2">
                                                                    <span class="text-xs font-semibold text-blue-900">💡 Açıklama:</span>
                                                                    <p class="text-xs text-blue-900 mt-1">${question.explanation}</p>
                                                                </div>
                                                            ` : ''}
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                    
                                    ${!passed ? `
                                        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                            <div class="flex items-center mb-2">
                                                <i class="fas fa-exclamation-circle text-red-600 mr-2"></i>
                                                <h4 class="text-sm font-semibold text-red-800">Önemli Bilgi</h4>
                                            </div>
                                            <p class="text-red-800 text-sm font-medium mb-1">
                                                Öğrenci başarı puanına ulaşamadı.
                                            </p>
                                            <p class="text-red-700 text-xs">
                                                Tekrar çözebilmesi için yeniden atama yapmanız gerekir.
                                            </p>
                                        </div>
                                    ` : `
                                        <div class="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                                            <div class="flex items-center mb-2">
                                                <i class="fas fa-star text-green-600 mr-2"></i>
                                                <h4 class="text-sm font-semibold text-green-800">Başarılı!</h4>
                                            </div>
                                            <p class="text-green-800 text-sm">
                                                Öğrenci testi başarıyla geçti. Yeni rozetler kazanmış olabilir.
                                            </p>
                                        </div>
                                    `}
                                </div>

                                <!-- Footer -->
                                <div class="p-6 border-t border-gray-200 bg-gray-50">
                                    <div class="flex justify-between items-center">
                                        <div class="text-sm text-gray-600">
                                            <i class="fas fa-info-circle mr-1"></i>
                                            Yeşil: Doğru | Kırmızı: Yanlış
                                        </div>
                                        <button onclick="closeDetailedResultsModal()" 
                                                class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                            <i class="fas fa-times mr-2"></i>Kapat
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                // Add modal to body
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                showNotification('✅ Detaylı sonuçlar yüklendi!', 'success');

            } catch (error) {
                console.error('Error loading detailed results:', error);
                showNotification('Detaylı sonuçlar yüklenirken hata oluştu: ' + error.message, 'error');
            }
        }

        // Close detailed results modal
        function closeDetailedResultsModal() {
            const modal = document.getElementById('detailedResultsModal');
            if (modal) {
                modal.remove();
            }
        }

        // PDF İndir - tek test sonucu
        async function downloadResultPDF(resultId, studentId, studentName, testTitle) {
            try {
                showNotification('PDF hazırlanıyor...', 'info');

                // Verileri çek
                const { data: result, error: resultError } = await supabase
                    .from('test_results').select('*').eq('id', resultId).single();
                if (resultError) throw resultError;

                const { data: test, error: testError } = await supabase
                    .from('tests').select('*').eq('id', result.test_id).single();
                if (testError) throw testError;

                const questions = JSON.parse(test.questions || '[]');
                let answersData = result.answers ? JSON.parse(result.answers) : {};
                let studentAnswers = [];
                if (answersData.answers) {
                    if (Array.isArray(answersData.answers)) {
                        studentAnswers = answersData.answers;
                    } else {
                        for (let i = 0; i < questions.length; i++) {
                            studentAnswers[i] = answersData.answers[i] !== undefined ? answersData.answers[i] : answersData.answers[String(i)];
                        }
                    }
                } else if (Array.isArray(answersData)) {
                    studentAnswers = answersData;
                } else {
                    for (let i = 0; i < questions.length; i++) {
                        studentAnswers[i] = answersData[i] !== undefined ? answersData[i] : answersData[String(i)];
                    }
                }

                // Puan hesapla
                let totalPoints = 0, earnedPoints = 0, correctCount = 0;
                const questionDetails = questions.map((q, idx) => {
                    const userAnswer = studentAnswers[idx];
                    const qPoints = q.points || 10;
                    totalPoints += qPoints;
                    const correctAnswer = q.correct !== undefined ? q.correct : q.correct_answer;
                    let isCorrect = false;
                    let userDisplay = 'Cevaplanmadı';
                    let correctDisplay = '';

                    if (q.type === 'multiple_choice') {
                        isCorrect = parseInt(userAnswer) === parseInt(correctAnswer);
                        userDisplay = (userAnswer !== undefined && userAnswer !== null && userAnswer !== '' && q.options?.[parseInt(userAnswer)])
                            ? `${String.fromCharCode(65 + parseInt(userAnswer))}) ${q.options[parseInt(userAnswer)]}` : 'Cevaplanmadı';
                        correctDisplay = q.options?.[parseInt(correctAnswer)]
                            ? `${String.fromCharCode(65 + parseInt(correctAnswer))}) ${q.options[parseInt(correctAnswer)]}` : String(correctAnswer);
                    } else if (q.type === 'fill_blank') {
                        if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
                            isCorrect = false; userDisplay = 'Cevaplanmadı';
                        } else if (q.options?.length > 0 && !isNaN(parseInt(userAnswer)) && q.options[parseInt(userAnswer)] !== undefined) {
                            isCorrect = parseInt(userAnswer) === parseInt(correctAnswer);
                            userDisplay = q.options[parseInt(userAnswer)];
                        } else {
                            isCorrect = String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
                            userDisplay = String(userAnswer);
                        }
                        correctDisplay = String(correctAnswer);
                    } else if (q.type === 'true_false') {
                        const uBool = userAnswer === true || userAnswer === 'true';
                        const cBool = correctAnswer === true || correctAnswer === 'true';
                        isCorrect = (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') && uBool === cBool;
                        userDisplay = userAnswer === true || userAnswer === 'true' ? 'Doğru' : (userAnswer === false || userAnswer === 'false') ? 'Yanlış' : 'Cevaplanmadı';
                        correctDisplay = cBool ? 'Doğru' : 'Yanlış';
                    } else {
                        isCorrect = userAnswer && String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
                        userDisplay = userAnswer || 'Cevaplanmadı';
                        correctDisplay = String(correctAnswer);
                    }

                    if (isCorrect) { correctCount++; earnedPoints += qPoints; }
                    return { q, idx, isCorrect, userDisplay, correctDisplay, qPoints };
                });

                const score = result.score;
                const passed = score >= 70;
                const completedDate = new Date(result.completed_at).toLocaleDateString('tr-TR', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                const typeLabel = { multiple_choice: 'Çoktan Seçmeli', fill_blank: 'Boşluk Doldurma', true_false: 'Doğru/Yanlış' };

                // Soru satırları HTML
                const questionsHtml = questionDetails.map(({ q, idx, isCorrect, userDisplay, correctDisplay, qPoints }) => `
                    <tr style="border-bottom: 1px solid #e5e7eb; background: ${isCorrect ? '#f0fdf4' : '#fef2f2'};">
                        <td style="padding:10px 8px; font-weight:600; color:${isCorrect ? '#166534' : '#991b1b'}; white-space:nowrap;">
                            ${isCorrect ? '✅' : '❌'} Soru ${idx + 1}
                        </td>
                        <td style="padding:10px 8px; font-size:11px; color:#6b7280;">${typeLabel[q.type] || q.type}</td>
                        <td style="padding:10px 8px; font-size:12px; color:#1f2937;">${(q.question || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
                        <td style="padding:10px 8px; font-size:12px; font-weight:600; color:${isCorrect ? '#166534' : '#991b1b'};">${userDisplay}</td>
                        <td style="padding:10px 8px; font-size:12px; color:#166534; font-weight:600;">${correctDisplay}</td>
                        <td style="padding:10px 8px; text-align:center; font-weight:700; color:${isCorrect ? '#166534' : '#991b1b'};">${isCorrect ? qPoints : 0}/${qPoints}</td>
                    </tr>
                `).join('');

                const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${studentName} - ${testTitle}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 30px; color: #1f2937; font-size: 13px; }
  .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
  .header h1 { margin: 0 0 6px 0; font-size: 20px; }
  .header p { margin: 3px 0; opacity: 0.9; font-size: 13px; }
  .summary { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat-box { flex: 1; min-width: 100px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; text-align: center; }
  .stat-box .val { font-size: 28px; font-weight: 800; }
  .stat-box .lbl { font-size: 11px; color: #6b7280; margin-top: 3px; }
  .result-banner { padding: 14px 18px; border-radius: 10px; margin-bottom: 24px; font-size: 15px; font-weight: 700; }
  .pass { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .fail { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead tr { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; }
  thead th { padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer { margin-top: 28px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 14px; }
  @media print { body { margin: 15px; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="header">
    <h1>📋 Test Sonuç Raporu</h1>
    <p><strong>Öğrenci:</strong> ${studentName}</p>
    <p><strong>Test:</strong> ${testTitle}</p>
    <p><strong>Tarih:</strong> ${completedDate}</p>
  </div>

  <div class="${passed ? 'result-banner pass' : 'result-banner fail'}">
    ${passed ? '🎉 BAŞARILI' : '❌ BAŞARISIZ'} &nbsp;|&nbsp; Puan: ${score} / 100 &nbsp;|&nbsp; ${passed ? 'Geçme sınırı aşıldı (≥70)' : 'Geçme sınırı aşılamadı (<70)'}
  </div>

  <div class="summary">
    <div class="stat-box"><div class="val" style="color:#4f46e5">${score}</div><div class="lbl">Başarı Puanı</div></div>
    <div class="stat-box"><div class="val" style="color:#16a34a">${correctCount}</div><div class="lbl">Doğru Cevap</div></div>
    <div class="stat-box"><div class="val" style="color:#dc2626">${questions.length - correctCount}</div><div class="lbl">Yanlış Cevap</div></div>
    <div class="stat-box"><div class="val" style="color:#7c3aed">${earnedPoints}</div><div class="lbl">Kazanılan Puan</div></div>
    <div class="stat-box"><div class="val" style="color:#6b7280">${totalPoints}</div><div class="lbl">Toplam Puan</div></div>
    <div class="stat-box"><div class="val" style="color:#0891b2">${questions.length}</div><div class="lbl">Soru Sayısı</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Soru</th>
        <th>Tür</th>
        <th>Soru Metni</th>
        <th>Verilen Cevap</th>
        <th>Doğru Cevap</th>
        <th style="text-align:center">Puan</th>
      </tr>
    </thead>
    <tbody>
      ${questionsHtml}
    </tbody>
  </table>

  <div class="footer">
    Türkçe Okuma Anlama Test Sistemi &nbsp;|&nbsp; Oluşturulma: ${new Date().toLocaleDateString('tr-TR')}
  </div>
</body>
</html>`;

                const printWin = window.open('', '_blank');
                printWin.document.write(html);
                printWin.document.close();
                setTimeout(() => {
                    printWin.print();
                    showNotification('✅ PDF yazdırma penceresi açıldı!', 'success');
                }, 600);

            } catch (error) {
                console.error('PDF error:', error);
                showNotification('❌ PDF oluşturulurken hata: ' + error.message, 'error');
            }
        }

        // Show pending tests modal


        // Refresh teacher data without page reload
        async function refreshTeacherData() {
            const refreshBtn = event.target.closest('button');
            const icon = refreshBtn.querySelector('i');
            
            // Add spinning animation
            icon.classList.add('fa-spin');
            refreshBtn.disabled = true;
            
            try {
                // Get current active tab
                const activeTab = document.querySelector('.teacher-tab-button.border-green-500');
                const tabName = activeTab ? activeTab.id.replace('Tab', '') : 'dashboard';
                
                // Reload data based on active tab
                switch(tabName) {
                    case 'dashboard':
                        await loadDashboardData();
                        break;
                    case 'students':
                        await loadStudentsList();
                        break;
                    case 'tests':
                        await loadTestsList();
                        break;
                    case 'results':
                        await loadResultsList();
                await updatePerformanceTable();
                        break;
                    case 'library':
                        // Reload library if student is selected
                        const selectedStudent = document.getElementById('libraryStudentSelect')?.value;
                        if (selectedStudent) {
                            await loadLibraryForStudent(selectedStudent);
                        }
                        break;
                }
                
                showNotification('✅ Veriler güncellendi!', 'success');
            } catch (error) {
                console.error('Refresh error:', error);
                showNotification('❌ Yenileme sırasında hata oluştu!', 'error');
            } finally {
                // Remove spinning animation
                icon.classList.remove('fa-spin');
                refreshBtn.disabled = false;
            }
        }

        // Delete test result
        async function deleteTestResult(resultId, studentName, testTitle) {
            if (!confirm(`${studentName} adlı öğrencinin "${testTitle}" testindeki sonucunu silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`)) {
                return;
            }

            try {
                const { error } = await supabase
                    .from('test_results')
                    .delete()
                    .eq('id', resultId);

                if (error) throw error;

                showNotification('✅ Test sonucu başarıyla silindi!', 'success');
                loadResultsList(); // Refresh the list
            } catch (error) {
                console.error('Error deleting test result:', error);
                showNotification('❌ Test sonucu silinirken hata oluştu: ' + error.message, 'error');
            }
        }
            // Show pending tests modal with SUPABASE VIEW logic (FINAL & CORRECTED VERSION)
        async function showPendingTestsModal() {
            try {
                showNotification('Bekleyen testler yükleniyor...', 'info');

                // 1. Doğrudan View'dan bekleyen test verilerini çek
                // NOT: Bu View'ı Supabase'de oluşturduğunuz varsayılmıştır.
                const { data: rawPendingData, error } = await supabase
                    .from('pending_tests_view')
                    .select('*')
                    .order('student_name'); // İsim sırasına göre sırala

                if (error) throw error;

                // 2. Veriyi öğrenci bazında grupla (Modal için gerekli format)
                const pendingDataMap = new Map();
                let totalPendingAssignments = 0;

                for (const item of rawPendingData) {
                    const studentKey = item.student_id;
                    
                    if (!pendingDataMap.has(studentKey)) {
                        pendingDataMap.set(studentKey, {
                            studentId: item.student_id,
                            studentName: item.student_name,
                            studentClass: item.student_class,
                            pendingTests: []
                        });
                    }
                    
                        pendingDataMap.get(studentKey).pendingTests.push({
                            testId: item.test_id, // Hatanın çözümü: testId'yi ekle
                            testTitle: item.test_title
                        });
                    totalPendingAssignments++;
                }

                const pendingData = Array.from(pendingDataMap.values());
                
                // 3. Modalı oluştur ve göster
                const modalHTML = `
                    <div id="pendingTestsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                            <!-- Header -->
                            <div class="flex justify-between items-center p-6 border-b border-gray-200">
                                <h3 class="text-xl font-semibold text-gray-900">
                                    <i class="fas fa-user-clock text-yellow-600 mr-2"></i>Öğrenci Bazında Bekleyen Testler
                                </h3>
                                <button onclick="closePendingTestsModal()" class="text-gray-400 hover:text-gray-600">
                                    <i class="fas fa-times text-2xl"></i>
                                </button>
                            </div>

                            <!-- Content -->
                            <div class="p-6 overflow-y-auto flex-1">
                                ${pendingData.length === 0 ? `
                                    <div class="text-center py-12">
                                        <i class="fas fa-check-circle text-6xl text-green-400 mb-4"></i>
                                        <p class="text-xl text-gray-600 font-semibold">Harika! Bekleyen test yok.</p>
                                        <p class="text-gray-500 mt-2">Tüm öğrenciler kendilerine atanan testleri tamamlamış.</p>
                                    </div>
                                ` : `
                                    <!-- Özet + Toplu İşlem Araç Çubuğu -->
                                    <div class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <div class="flex flex-wrap items-center justify-between gap-3">
                                            <div class="flex items-center gap-6">
                                                <div class="text-center">
                                                    <div class="text-2xl font-bold text-yellow-700">${pendingData.length}</div>
                                                    <div class="text-xs text-yellow-600 font-medium">Öğrenci</div>
                                                </div>
                                                <div class="text-center">
                                                    <div class="text-2xl font-bold text-yellow-700">${totalPendingAssignments}</div>
                                                    <div class="text-xs text-yellow-600 font-medium">Bekleyen Test</div>
                                                </div>
                                                <div class="text-center">
                                                    <div id="pendingSelectedCount" class="text-2xl font-bold text-red-600">0</div>
                                                    <div class="text-xs text-red-500 font-medium">Seçili</div>
                                                </div>
                                            </div>
                                            <div class="flex gap-2 flex-wrap">
                                                <button onclick="selectAllPendingTests(true)"
                                                        class="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition">
                                                    <i class="fas fa-check-square mr-1"></i>Tümünü Seç
                                                </button>
                                                <button onclick="selectAllPendingTests(false)"
                                                        class="px-3 py-2 bg-gray-400 text-white text-sm rounded-lg hover:bg-gray-500 transition">
                                                    <i class="fas fa-square mr-1"></i>Seçimi Temizle
                                                </button>
                                                <button onclick="removeSelectedPendingTests()"
                                                        class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition font-semibold">
                                                    <i class="fas fa-trash mr-1"></i>Seçilenleri Kaldır
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Öğrenci Listesi -->
                                    <div class="space-y-3">
                                        ${pendingData.map(student => `
                                            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                                <!-- Öğrenci Başlığı -->
                                                <div class="flex items-center gap-3 mb-3">
                                                    <input type="checkbox"
                                                           class="pending-student-cb w-4 h-4 accent-red-600 cursor-pointer rounded"
                                                           data-student-id="${student.studentId}"
                                                           onchange="toggleStudentPendingAll(${student.studentId}, this.checked)"
                                                           title="Öğrencinin tüm testlerini seç">
                                                    <div class="w-9 h-9 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                        <i class="fas fa-user text-yellow-600 text-sm"></i>
                                                    </div>
                                                    <div class="flex-1">
                                                        <h4 class="font-semibold text-gray-900">${student.studentName}</h4>
                                                        <p class="text-xs text-gray-500">${student.studentClass}</p>
                                                    </div>
                                                    <span class="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                                                        ${student.pendingTests.length} Test
                                                    </span>
                                                </div>
                                                <!-- Test Listesi -->
                                                <div class="pl-7 space-y-1">
                                                    ${student.pendingTests.map((test, index) => `
                                                        <div class="flex items-center gap-3 text-sm p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
                                                            <input type="checkbox"
                                                                   class="pending-test-cb w-4 h-4 accent-red-600 cursor-pointer rounded"
                                                                   data-student-id="${student.studentId}"
                                                                   data-test-id="${test.testId}"
                                                                   data-student-name="${student.studentName}"
                                                                   data-test-title="${test.testTitle}"
                                                                   onchange="updatePendingCount()">
                                                            <i class="fas fa-file-alt text-yellow-500 flex-shrink-0"></i>
                                                            <span class="text-gray-700 flex-1">${test.testTitle}</span>
                                                            <button onclick="removePendingAssignment(${student.studentId}, ${test.testId}, \`${student.studentName}\`, \`${test.testTitle}\`)"
                                                                    class="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition flex-shrink-0">
                                                                <i class="fas fa-times"></i>
                                                            </button>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                `}
                            </div>

                            <!-- Footer -->
                            <div class="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                                <button onclick="closePendingTestsModal()" 
                                        class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                                    <i class="fas fa-times mr-2"></i>Kapat
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', modalHTML);
                showNotification('✅ Bekleyen testler başarıyla listelendi!', 'success');

            } catch (error) {
                console.error('Error loading pending tests:', error);
                showNotification('Bekleyen testler yüklenirken bir hata oluştu: ' + error.message, 'error');
            }
        }

        // Seçili sayısını güncelle
        function updatePendingCount() {
            const checked = document.querySelectorAll('.pending-test-cb:checked').length;
            const el = document.getElementById('pendingSelectedCount');
            if (el) el.textContent = checked;
        }

        // Öğrencinin tüm testlerini seç/kaldır
        function toggleStudentPendingAll(studentId, checked) {
            document.querySelectorAll(`.pending-test-cb[data-student-id="${studentId}"]`)
                .forEach(cb => { cb.checked = checked; });
            updatePendingCount();
        }

        // Tüm testleri seç/kaldır
        function selectAllPendingTests(checked) {
            document.querySelectorAll('.pending-test-cb').forEach(cb => { cb.checked = checked; });
            document.querySelectorAll('.pending-student-cb').forEach(cb => { cb.checked = checked; });
            updatePendingCount();
        }

        // Seçilenleri toplu kaldır
        async function removeSelectedPendingTests() {
            const checked = document.querySelectorAll('.pending-test-cb:checked');
            if (checked.length === 0) {
                showNotification('Lütfen kaldırmak istediğiniz testleri seçin.', 'warning');
                return;
            }

            if (!confirm(`${checked.length} test ataması kaldırılacak. Emin misiniz?`)) return;

            showNotification(`${checked.length} atama kaldırılıyor...`, 'info');

            const toDelete = Array.from(checked).map(cb => ({
                studentId: cb.getAttribute('data-student-id'),
                testId: cb.getAttribute('data-test-id')
            }));

            let success = 0, fail = 0;
            for (const item of toDelete) {
                try {
                    const { error } = await supabase
                        .from('test_assignments')
                        .delete()
                        .eq('student_id', item.studentId)
                        .eq('test_id', item.testId);
                    if (error) throw error;
                    success++;
                } catch (e) {
                    fail++;
                    console.error('Delete error:', e);
                }
            }

            if (fail === 0) {
                showNotification(`✅ ${success} atama başarıyla kaldırıldı!`, 'success');
            } else {
                showNotification(`⚠️ ${success} başarılı, ${fail} hatalı.`, 'warning');
            }

            closePendingTestsModal();
            showPendingTestsModal();
        }

        // Tek atama kaldır
        async function removePendingAssignment(studentId, testId, studentName, testTitle) {
            if (!confirm(`"${testTitle}" testinin "${studentName}" adlı öğrenciden atamasını kaldırmak istediğinizden emin misiniz?`)) {
                return;
            }

            try {
                showNotification('Atama kaldırılıyor...', 'info');

                const { error } = await supabase
                    .from('test_assignments')
                    .delete()
                    .eq('student_id', studentId)
                    .eq('test_id', testId);

                if (error) throw error;

                showNotification('✅ Atama başarıyla kaldırıldı!', 'success');
                closePendingTestsModal();
                showPendingTestsModal();

            } catch (error) {
                console.error('Error removing assignment:', error);
                showNotification('❌ Atama kaldırılırken hata oluştu: ' + error.message, 'error');
            }
        }

        // Close pending tests modal
        function closePendingTestsModal() {
            const modal = document.getElementById('pendingTestsModal');
            if (modal) modal.remove();
        }

        // Show edit test modal
        async function showEditTestModal(testId) {
            try {
                // Fetch test data
                const { data: test, error } = await supabase
                    .from('tests')
                    .select('*')
                    .eq('id', testId)
                    .single();

                if (error) throw error;

                const questions = JSON.parse(test.questions);
                
                // Build modal content
                let questionsHTML = '';
                questions.forEach((q, index) => {
                    const questionTypeLabel = {
                        'multiple_choice': '📝 Çoktan Seçmeli',
                        'true_false': '✓✗ Doğru/Yanlış',
                        'fill_blank': '📄 Boşluk Doldurma',
                        'text': '📋 Metin'
                    }[q.type] || '❓ Bilinmeyen';

                    questionsHTML += `
                        <div class="question-card border border-gray-200 rounded-lg p-4 mb-4" data-question-index="${index}">
                            <div class="flex justify-between items-start mb-3">
                                <h4 class="font-semibold text-gray-800">Soru ${index + 1}</h4>
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-1 text-xs rounded ${
                                        q.type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' :
                                        q.type === 'true_false' ? 'bg-green-100 text-green-700' :
                                        q.type === 'fill_blank' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-purple-100 text-purple-700'
                                    }">${questionTypeLabel}</span>
                                    <button type="button" onclick="deleteQuestion(${index})" class="px-2 py-1 bg-red-100 text-red-600 text-xs rounded hover:bg-red-200">
                                        <i class="fas fa-trash mr-1"></i>Soruyu Sil
                                    </button>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Soru Metni:</label>
                                <textarea name="question_${index}_text" class="w-full px-3 py-2 border border-gray-300 rounded-lg" rows="3">${q.question || ''}</textarea>
                            </div>
                    `;

                    if (q.type === 'multiple_choice') {
                        questionsHTML += `
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Seçenekler:</label>
                                ${(q.options || ['', '', '', '', '']).map((opt, i) => `
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="font-medium">${String.fromCharCode(65 + i)})</span>
                                        <input type="text" name="question_${index}_option_${i}" value="${opt || ''}" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg">
                                        <label class="flex items-center">
                                            <input type="radio" name="question_${index}_correct" value="${i}" ${parseInt(q.correct) === i ? 'checked' : ''} class="mr-1">
                                            <span class="text-sm">Doğru</span>
                                        </label>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    } else if (q.type === 'true_false') {
                        questionsHTML += `
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Doğru Cevap:</label>
                                <div class="flex gap-4">
                                    <label class="flex items-center">
                                        <input type="radio" name="question_${index}_correct" value="true" ${q.correct === true ? 'checked' : ''} class="mr-2">
                                        <span>Doğru</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="radio" name="question_${index}_correct" value="false" ${q.correct === false ? 'checked' : ''} class="mr-2">
                                        <span>Yanlış</span>
                                    </label>
                                </div>
                            </div>
                        `;
                    } else if (q.type === 'fill_blank') {
                        const optionsString = (q.options && Array.isArray(q.options)) ? q.options.join(', ') : '';
                        questionsHTML += `
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Seçenekler (virgülle ayrılmış):</label>
                                <input type="text" name="question_${index}_options_text" value="${optionsString}" placeholder="Örnek: Seçenek 1, Seçenek 2, Seçenek 3, Seçenek 4..." class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                                <p class="text-xs text-gray-500 mt-1">Seçenekleri virgül ve boşlukla ayırarak yazın</p>
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Doğru Cevap:</label>
                                <input type="text" name="question_${index}_correct_text" value="${q.correct || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Doğru cevabı yazın">
                            </div>
                        `;
                    } else {
                        questionsHTML += `
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Doğru Cevap:</label>
                                <textarea name="question_${index}_correct_text" class="w-full px-3 py-2 border border-gray-300 rounded-lg" rows="2">${q.correct || ''}</textarea>
                            </div>
                        `;
                    }

                    questionsHTML += `
                            <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                                <div class="flex items-center gap-2">
                                    <label class="text-sm font-medium text-gray-700">⭐ Puan:</label>
                                    <input type="number" name="question_${index}_points" value="${q.points || 10}" min="1" max="100" class="w-20 px-2 py-1 border border-gray-300 rounded">
                                </div>
                            </div>
                        </div>
                    `;
                });

                const modalContent = `
                    <form id="editTestForm" onsubmit="saveEditedTest(event, '${testId}')">
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Test Başlığı:</label>
                            <input type="text" id="editTestTitle" value="${test.title || ''}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Açıklama:</label>
                            <textarea id="editTestDescription" class="w-full px-3 py-2 border border-gray-300 rounded-lg" rows="2">${test.description || ''}</textarea>
                        </div>
                        
                        <div class="mb-4">
                            <div class="flex items-center justify-between mb-3">
                                <h4 class="font-semibold text-gray-800">Sorular:</h4>
                                <div class="flex gap-2">
                                    <button type="button" onclick="yeniSoruEkle('multiple_choice')" class="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">
                                        <i class="fas fa-plus mr-1"></i>Çoktan Seçmeli
                                    </button>
                                    <button type="button" onclick="yeniSoruEkle('true_false')" class="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition">
                                        <i class="fas fa-plus mr-1"></i>Doğru/Yanlış
                                    </button>
                                    <button type="button" onclick="yeniSoruEkle('fill_blank')" class="px-3 py-1.5 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600 transition">
                                        <i class="fas fa-plus mr-1"></i>Boşluk Doldurma
                                    </button>
                                </div>
                            </div>
                            <div id="questionsContainer">
                                ${questionsHTML}
                            </div>
                        </div>
                        
                        <div class="flex justify-end gap-3 pt-4 border-t border-gray-200">
                            <button type="button" onclick="closeModal('editTestModal')" class="px-6 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">
                                İptal
                            </button>
                            <button type="submit" class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                <i class="fas fa-save mr-2"></i>Değişiklikleri Kaydet
                            </button>
                        </div>
                    </form>
                `;

                document.getElementById('editTestContent').innerHTML = modalContent;
                document.getElementById('editTestModal').classList.remove('hidden');
                
                // Scroll to top
                setTimeout(() => {
                    document.getElementById('editTestContent').scrollTop = 0;
                }, 100);

            } catch (error) {
                console.error('Error loading test for edit:', error);
                showNotification('❌ Test yüklenirken hata oluştu!', 'error');
            }
        }

        // Delete question from edit modal
        function deleteQuestion(index) {
            if (!confirm(`Soru ${index + 1}'i silmek istediğinizden emin misiniz?`)) {
                return;
            }
            const questionCard = document.querySelector(`[data-question-index="${index}"]`);
            if (questionCard) {
                questionCard.style.display = 'none';
                questionCard.dataset.deleted = 'true';
            }
        }

        // Yeni soru ekle — mevcut en yüksek index'i bulup +1 yapar
        function yeniSoruEkle(type) {
            const container = document.getElementById('questionsContainer');
            if (!container) return;

            // Mevcut en yüksek data-question-index'i bul
            const cards = container.querySelectorAll('.question-card');
            let maxIndex = -1;
            cards.forEach(c => {
                const idx = parseInt(c.dataset.questionIndex);
                if (!isNaN(idx) && idx > maxIndex) maxIndex = idx;
            });
            const newIndex = maxIndex + 1;
            const soruNo = container.querySelectorAll('.question-card:not([data-deleted="true"])').length + 1;

            const typeLabel = {
                'multiple_choice': '📝 Çoktan Seçmeli',
                'true_false': '✓✗ Doğru/Yanlış',
                'fill_blank': '📄 Boşluk Doldurma'
            }[type];

            const typeBadgeCls = {
                'multiple_choice': 'bg-blue-100 text-blue-700',
                'true_false': 'bg-green-100 text-green-700',
                'fill_blank': 'bg-yellow-100 text-yellow-700'
            }[type];

            let typeHTML = '';
            if (type === 'multiple_choice') {
                typeHTML = `
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Seçenekler:</label>
                        ${['A','B','C','D','E'].map((ltr, i) => `
                            <div class="flex items-center gap-2 mb-2">
                                <span class="font-medium">${ltr})</span>
                                <input type="text" name="question_${newIndex}_option_${i}" value="" placeholder="${ltr} seçeneği..." class="flex-1 px-3 py-2 border border-gray-300 rounded-lg">
                                <label class="flex items-center">
                                    <input type="radio" name="question_${newIndex}_correct" value="${i}" class="mr-1">
                                    <span class="text-sm">Doğru</span>
                                </label>
                            </div>
                        `).join('')}
                    </div>`;
            } else if (type === 'true_false') {
                typeHTML = `
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Doğru Cevap:</label>
                        <div class="flex gap-4">
                            <label class="flex items-center">
                                <input type="radio" name="question_${newIndex}_correct" value="true" class="mr-2">
                                <span>Doğru</span>
                            </label>
                            <label class="flex items-center">
                                <input type="radio" name="question_${newIndex}_correct" value="false" class="mr-2">
                                <span>Yanlış</span>
                            </label>
                        </div>
                    </div>`;
            } else if (type === 'fill_blank') {
                typeHTML = `
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Seçenekler (virgülle ayrılmış):</label>
                        <input type="text" name="question_${newIndex}_options_text" value="" placeholder="Örnek: Seçenek 1, Seçenek 2, Seçenek 3..." class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                        <p class="text-xs text-gray-500 mt-1">Seçenekleri virgül ve boşlukla ayırarak yazın</p>
                    </div>
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Doğru Cevap:</label>
                        <input type="text" name="question_${newIndex}_correct_text" value="" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Doğru cevabı yazın">
                    </div>`;
            }

            const div = document.createElement('div');
            div.className = 'question-card border-2 border-blue-300 bg-blue-50 rounded-lg p-4 mb-4';
            div.dataset.questionIndex = newIndex;
            div.dataset.newQuestion = 'true';
            div.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-semibold text-gray-800">Soru ${soruNo} <span class="text-xs text-blue-600 font-normal">(Yeni)</span></h4>
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 text-xs rounded ${typeBadgeCls}">${typeLabel}</span>
                        <button type="button" onclick="this.closest('.question-card').remove()" class="px-2 py-1 bg-red-100 text-red-600 text-xs rounded hover:bg-red-200">
                            <i class="fas fa-trash mr-1"></i>Sil
                        </button>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Soru Metni:</label>
                    <textarea name="question_${newIndex}_text" class="w-full px-3 py-2 border border-gray-300 rounded-lg" rows="3" placeholder="Soru metnini buraya yazın..."></textarea>
                </div>
                ${typeHTML}
                <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                    <div class="flex items-center gap-2">
                        <label class="text-sm font-medium text-gray-700">⭐ Puan:</label>
                        <input type="number" name="question_${newIndex}_points" value="10" min="1" max="100" class="w-20 px-2 py-1 border border-gray-300 rounded">
                    </div>
                </div>
            `;

            container.appendChild(div);

            // Yeni soruya scroll et
            div.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Save edited test
        async function saveEditedTest(event, testId) {
            event.preventDefault();
            console.log('Saving test with ID:', testId);
            
            if (!testId || testId === 'undefined') {
                showNotification('❌ Hata: Test ID bulunamadı!', 'error');
                return;
            }
            
            try {
                // Validate inputs
                const titleElement = document.getElementById('editTestTitle') || document.getElementById('editTestName');
                const title = titleElement?.value?.trim();
                const description = document.getElementById('editTestDescription')?.value?.trim();
                
                console.log('Form validation - Title element:', titleElement, 'Title value:', title);
                
                if (!title) {
                    throw new Error('Test başlığı boş olamaz!');
                }
                
                // Collect questions
                const questionCards = document.querySelectorAll('.question-card');
                const questions = [];
                
                questionCards.forEach((card, index) => {
                    if (card.dataset.deleted === 'true') return; // Skip deleted questions
                    
                    const originalIndex = card.dataset.questionIndex;
                    console.log('Processing question index:', originalIndex);
                    
                    // Safely get question text from WITHIN the card
                    const questionTextElement = card.querySelector(`[name="question_${originalIndex}_text"]`);
                    if (!questionTextElement) {
                        throw new Error(`Soru ${questions.length + 1} metin alani bulunamadi!`);
                    }
                    const questionText = questionTextElement.value?.trim();
                    if (!questionText) {
                        throw new Error(`Soru ${questions.length + 1} metni bos olamaz!`);
                    }
                    
                    // Get and validate points from WITHIN the card
                    const pointsElement = card.querySelector(`[name="question_${originalIndex}_points"]`);
                    const points = pointsElement ? (parseInt(pointsElement.value) || 10) : 10;
                    if (points <= 0) {
                        throw new Error(`Soru ${questions.length + 1} puani 0'dan buyuk olmali!`);
                    }
                    
                    // Determine question type from card - check for form elements
                    let type = 'text'; // default
                    
                    // Check which type of input fields exist
                    const hasOptions = card.querySelector(`[name="question_${originalIndex}_option_0"]`);
                    const hasOptionsText = card.querySelector(`[name="question_${originalIndex}_options_text"]`);
                    const hasCorrectRadio = card.querySelector(`[name="question_${originalIndex}_correct"][type="radio"]`);
                    const hasCorrectText = card.querySelector(`[name="question_${originalIndex}_correct_text"]`);
                    console.log('Form elements check:', {hasOptions, hasOptionsText, hasCorrectRadio, hasCorrectText});
                    
                    // Determine type based on form elements
                    if (hasOptionsText) {
                        // Virgülle ayrılmış seçenekler = fill_blank
                        type = 'fill_blank';
                    } else if (hasOptions && hasCorrectRadio) {
                        // Check if it's true/false or multiple choice
                        const firstOption = card.querySelector(`[name="question_${originalIndex}_option_0"]`);
                        if (firstOption && (firstOption.value === 'true' || firstOption.value === 'false')) {
                            type = 'true_false';
                        } else {
                            type = 'multiple_choice';
                        }
                    } else if (hasCorrectRadio && !hasOptions) {
                        // Radio without options = true/false
                        type = 'true_false';
                    } else if (hasCorrectText) {
                        // Only text input = text type
                        type = 'text';
                    }
                    
                    // Also check the badge label as fallback
                    const typeElement = card.querySelector('.px-2.py-1.text-xs');
                    if (typeElement) {
                        const typeLabel = typeElement.textContent;
                        if (typeLabel.includes('Coktan Secmeli')) type = 'multiple_choice';
                        else if (typeLabel.includes('Dogru/Yanlis')) type = 'true_false';
                        else if (typeLabel.includes('Bosluk Doldurma')) type = 'fill_blank';
                        else if (typeLabel.includes('Metin')) type = 'text';
                    }
                    console.log('Determined question type:', type);
                    
                    const question = {
                        id: questions.length + 1,
                        type: type,
                        question: questionText,
                        points: points,
                        timeLimit: 90 // Default time limit
                    };
                    
                    if (type === 'multiple_choice') {
                        question.options = [];
                        // Get all option inputs for this question
                        const optionInputs = card.querySelectorAll(`input[name^="question_${originalIndex}_option_"]`);
                        optionInputs.forEach(input => {
                            const val = input.value?.trim();
                            if (val) question.options.push(val);
                        });
                        
                        if (question.options.length < 2) {
                            throw new Error(`Soru ${questions.length + 1} icin en az iki secenek gereklidir!`);
                        }
                        
                        const correctRadio = card.querySelector(`input[name="question_${originalIndex}_correct"]:checked`);
                        if (!correctRadio) {
                            throw new Error(`Soru ${questions.length + 1} icin dogru cevap secilmemis!`);
                        }
                        question.correct = parseInt(correctRadio.value);
                        
                        if (isNaN(question.correct)) {
                            throw new Error(`Soru ${questions.length + 1} icin gecersiz dogru cevap indeksi!`);
                        }
                    } else if (type === 'true_false') {
                        const correctRadio = card.querySelector(`[name="question_${originalIndex}_correct"]:checked`);
                        if (!correctRadio) {
                            throw new Error(`Soru ${questions.length + 1} icin dogru cevap secilmemis!`);
                        }
                        question.correct = correctRadio.value === 'true';
                    } else if (type === 'fill_blank') {
                        // Virgülle ayrılmış seçenekleri oku
                        const optionsTextInput = card.querySelector(`[name="question_${originalIndex}_options_text"]`);
                        if (optionsTextInput && optionsTextInput.value?.trim()) {
                            const optionsText = optionsTextInput.value?.trim();
                            question.options = optionsText.split(',').map(opt => opt.trim()).filter(opt => opt);
                            if (question.options.length === 0) {
                                throw new Error(`Soru ${questions.length + 1} icin en az bir secenegi gerekli!`);
                            }
                        } else {
                            question.options = [];
                        }
                        
                        const correctInput = card.querySelector(`[name="question_${originalIndex}_correct_text"]`);
                        const correctValue = correctInput ? correctInput.value?.trim() : '';
                        question.correct = correctValue || '';
                    } else if (type === 'text') {
                        // Text type questions
                        const correctInput = card.querySelector(`[name="question_${originalIndex}_correct_text"]`);
                        const correctValue = correctInput ? correctInput.value?.trim() : '';
                        question.correct = correctValue || '';
                    } else {
                        // Fallback for unknown types
                        const correctInput = card.querySelector(`[name="question_${originalIndex}_correct_text"]`);
                        if (correctInput) {
                            const correctValue = correctInput.value?.trim() || '';
                            question.correct = correctValue;
                        } else {
                            // If no text input found, try to get from radio buttons
                            const correctRadio = card.querySelector(`[name="question_${originalIndex}_correct"]:checked`);
                            if (correctRadio) {
                                question.correct = correctRadio.value;
                            } else {
                                question.correct = '';
                            }
                        }
                    }
                    
                    questions.push(question);
                });
                
                if (questions.length === 0) {
                    throw new Error('En az bir soru olmali!');
                }
                
                // Validate JSON before sending
                let questionsJSON;
                try {
                    questionsJSON = JSON.stringify(questions);
                    // Verify it can be parsed back
                    JSON.parse(questionsJSON);
                } catch (jsonError) {
                    throw new Error('Soru verileri JSON formatina donusturulemedi: ' + jsonError.message);
                }
                
                // Update test in database
                // Supabase expects the questions column to be a stringified JSON (wrapped in quotes)
                const { error } = await supabase
                    .from('tests')
                    .update({
                        title: title,
                        description: description || '',
                        questions: questionsJSON // This is already a string from JSON.stringify
                    })
                    .eq('id', testId);
                
                if (error) {
                    throw new Error('Veritabani hatasi: ' + (error.message || 'Bilinmeyen hata'));
                }
                
                showNotification('✅ Test basariyla guncellendi!', 'success');
                closeModal('editTestModal');
                loadTestsList(); // Refresh list
                
            } catch (error) {
                console.error('Error saving test:', error);
                showNotification('❌ ' + error.message, 'error');
            }
        }



        // Load failed tests list
        // Load failed tests list using the Supabase View for performance and consistency
        async function loadFailedTestsList() {
            try {
                showNotification('Başarısız testler yükleniyor...', 'info');

                // 1. Doğrudan View'dan başarısız test verilerini çek
                // NOT: Bu View'ı Supabase'de oluşturduğunuz varsayılmıştır.
                const { data: rawFailedData, error } = await supabase
                    .from('failed_tests_view')
                    .select('*');

                if (error) throw error;

                // 2. Veriyi işleyerek gerekli formatı oluştur
                const allMapped = rawFailedData.map(item => ({
                    resultId: item.result_id,
                    studentId: item.student_id,
                    studentName: item.student_name,
                    studentClass: item.student_class,
                    testId: item.test_id,
                    testTitle: item.test_title,
                    score: item.score_percentage, // View'dan gelen yüzde
                    maxScore: 100, // Yüzde olduğu için max 100
                    completedAt: item.result_date,
                    percentage: item.score_percentage, // Zaten yüzde
                    testType: item.test_type || null // View'da test_type varsa kullan
                }));

                // test_type view'da yoksa tests tablosundan çek
                let failedTestsData = allMapped;
                const missingType = allMapped.some(m => m.testType === null || m.testType === undefined);
                if (missingType) {
                    const uniqueTestIds = [...new Set(allMapped.map(m => m.testId))];
                    if (uniqueTestIds.length > 0) {
                        const { data: testsInfo } = await supabase
                            .from('tests')
                            .select('id, test_type')
                            .in('id', uniqueTestIds);
                        const typeMap = {};
                        (testsInfo || []).forEach(t => { typeMap[t.id] = t.test_type; });
                        failedTestsData = allMapped.map(m => ({
                            ...m,
                            testType: typeMap[m.testId] || 'normal'
                        }));
                    }
                }

                // Sadece 'normal' tipindeki testleri göster (sinav ve alistirma hariç)
                failedTestsData = failedTestsData.filter(m =>
                    !m.testType || m.testType === 'normal'
                );

                // 3. İstatistikleri hesapla
                const failedStudentsSet = new Set(failedTestsData.map(f => f.studentId));
                const failedTestsCount = new Set(failedTestsData.map(f => f.testId)).size;
                const failedStudentsCount = failedStudentsSet.size;
                
                const totalScore = failedTestsData.reduce((sum, f) => sum + f.score, 0);
                const scoreCount = failedTestsData.length;
                const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

                // 4. İstatistikleri güncelle
                document.getElementById('failedTestsCount').textContent = failedTestsCount;
                document.getElementById('failedStudentsCount').textContent = failedStudentsCount;
                document.getElementById('failedTestsAvgScore').textContent = avgScore + '%';
                document.getElementById('failedTestsStats').classList.remove('hidden');

                // 5. Global olarak sakla ve göster
                window.allFailedTestsData = failedTestsData;
                window.currentFailedTestsFilter = 'all';
                window.currentFailedTestsSearch = '';

                displayFailedTests(failedTestsData);

                showNotification('✅ Başarısız testler yüklendi!', 'success');

            } catch (error) {
                console.error('Error loading failed tests:', error);
                showNotification('❌ Başarısız testler yüklenirken hata oluştu: ' + error.message, 'error');
            }
        }

        // Display failed tests
        function displayFailedTests(failedTests) {
            const container = document.getElementById('failedTestsList');
            container.innerHTML = '';

            // Araç çubuğunu göster/gizle
            const bulkBar = document.getElementById('failedBulkBar');
            if (bulkBar) bulkBar.classList.toggle('hidden', !failedTests || failedTests.length === 0);

            if (!failedTests || failedTests.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-12">
                        <i class="fas fa-check-circle text-6xl text-green-400 mb-4"></i>
                        <p class="text-xl text-gray-600 font-semibold">Tüm testler başarılı!</p>
                        <p class="text-gray-500 mt-2">Hiç başarısız test bulunmamaktadır.</p>
                    </div>
                `;
                updateFailedSelectedCount();
                return;
            }

            failedTests.forEach(failed => {
                const card = document.createElement('div');
                card.className = 'bg-white border-2 border-red-200 rounded-lg p-4 hover:shadow-lg transition duration-200';
                card.innerHTML = `
                    <div class="flex items-start gap-3">
                        <input type="checkbox"
                               class="failed-test-cb mt-1 w-4 h-4 accent-red-600 cursor-pointer rounded flex-shrink-0"
                               data-result-id="${failed.resultId}"
                               data-student-name="${failed.studentName}"
                               data-test-title="${failed.testTitle}"
                               onchange="updateFailedSelectedCount()">
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                                        <h4 class="font-semibold text-gray-900">${failed.studentName}</h4>
                                        <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">${failed.studentNo}</span>
                                        <span class="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">${failed.studentClass}</span>
                                    </div>
                                    <p class="text-sm text-gray-600 mb-2">
                                        <i class="fas fa-book mr-1"></i>${failed.testTitle}
                                    </p>
                                </div>
                                <div class="text-right ml-3">
                                    <div class="text-2xl font-bold text-red-600">${failed.percentage}%</div>
                                    <div class="text-xs text-gray-500">${failed.score}/${failed.maxScore} puan</div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div class="bg-red-500 h-2 rounded-full" style="width: ${failed.percentage}%"></div>
                                </div>
                            </div>
                            <div class="flex justify-between items-center text-xs text-gray-500 mb-3">
                                <span><i class="fas fa-calendar mr-1"></i>${new Date(failed.completedAt).toLocaleDateString('tr-TR')}</span>
                                <span class="text-red-600 font-semibold">Başarısız</span>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="reassignFailedTest('${failed.studentId}', '${failed.testId}', '${failed.testTitle}', '${failed.studentName}')" class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition duration-200">
                                    <i class="fas fa-redo mr-1"></i>Tekrar Ata
                                </button>
                                <button onclick="deleteFailedTestResult('${failed.resultId}', '${failed.studentName}', '${failed.testTitle}')" class="px-4 py-2 bg-red-100 text-red-600 text-sm rounded hover:bg-red-200 transition duration-200">
                                    <i class="fas fa-trash mr-1"></i>Sil
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });

            updateFailedSelectedCount();
            updateFailedTestsFilterInfo(failedTests.length);
        }

        // Seçili sayısını güncelle
        function updateFailedSelectedCount() {
            const count = document.querySelectorAll('.failed-test-cb:checked').length;
            const total = document.querySelectorAll('.failed-test-cb').length;
            const el = document.getElementById('failedSelectedCount');
            if (el) el.textContent = count;
            const allCb = document.getElementById('failedSelectAll');
            if (allCb) allCb.checked = total > 0 && count === total;
        }

        // Tümünü seç / kaldır
        function selectAllFailedTests(checked) {
            document.querySelectorAll('.failed-test-cb').forEach(cb => { cb.checked = checked; });
            updateFailedSelectedCount();
        }

        // Seçilenleri toplu sil
        async function deleteSelectedFailedTests() {
            const checked = document.querySelectorAll('.failed-test-cb:checked');
            if (checked.length === 0) {
                showNotification('Lütfen silmek istediğiniz testleri seçin.', 'warning');
                return;
            }
            if (!confirm(`${checked.length} test sonucu silinecek. Bu işlem geri alınamaz. Emin misiniz?`)) return;

            showNotification(`${checked.length} sonuç siliniyor...`, 'info');

            const toDelete = Array.from(checked).map(cb => ({
                resultId: cb.getAttribute('data-result-id'),
                studentName: cb.getAttribute('data-student-name'),
                testTitle: cb.getAttribute('data-test-title')
            }));

            let success = 0, fail = 0;
            for (const item of toDelete) {
                try {
                    const { error } = await supabase
                        .from('test_results').delete().eq('id', item.resultId);
                    if (error) throw error;
                    success++;
                } catch (e) {
                    fail++;
                    console.error('Delete error:', e);
                }
            }

            if (fail === 0) {
                showNotification(`✅ ${success} test sonucu başarıyla silindi!`, 'success');
            } else {
                showNotification(`⚠️ ${success} başarılı, ${fail} hatalı.`, 'warning');
            }
            loadFailedTestsList();
        }

        // Filter failed tests
        function filterFailedTests() {
            const searchTerm = document.getElementById('failedTestsSearchInput')?.value.toLowerCase().trim() || '';
            const sortBy = document.getElementById('failedTestsSortSelect')?.value || 'recent';

            let filteredTests = [...(window.allFailedTestsData || [])];

            // Apply search filter
            if (searchTerm) {
                filteredTests = filteredTests.filter(test =>
                    test.studentName.toLowerCase().includes(searchTerm) ||
                    test.testTitle.toLowerCase().includes(searchTerm) ||
                    test.studentNo.includes(searchTerm)
                );
            }

            // Apply sorting
            switch (sortBy) {
                case 'oldest':
                    filteredTests.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
                    break;
                case 'student_asc':
                    filteredTests.sort((a, b) => a.studentName.localeCompare(b.studentName, 'tr'));
                    break;
                case 'student_desc':
                    filteredTests.sort((a, b) => b.studentName.localeCompare(a.studentName, 'tr'));
                    break;
                case 'score_asc':
                    filteredTests.sort((a, b) => a.score - b.score);
                    break;
                case 'score_desc':
                    filteredTests.sort((a, b) => b.score - a.score);
                    break;
                case 'recent':
                default:
                    filteredTests.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
                    break;
            }

            displayFailedTests(filteredTests);
        }

        // Clear failed tests filters
        function clearFailedTestsFilters() {
            document.getElementById('failedTestsSearchInput').value = '';
            document.getElementById('failedTestsSortSelect').value = 'recent';
            filterFailedTests();
        }

        // Update failed tests filter info
        function updateFailedTestsFilterInfo(filteredCount) {
            const totalCount = window.allFailedTestsData?.length || 0;
            const infoElement = document.getElementById('failedTestsFilterInfo');

            if (!infoElement) return;

            let infoText = '';
            if (totalCount === 0) {
                infoText = 'Başarısız test bulunmamaktadır.';
            } else if (filteredCount === totalCount) {
                infoText = `Toplam ${totalCount} başarısız test gösteriliyor`;
            } else {
                infoText = `${filteredCount}/${totalCount} başarısız test gösteriliyor`;
            }

            infoElement.textContent = infoText;
        }

        // Reassign failed test
        async function reassignFailedTest(studentId, testId, testTitle, studentName) {
            if (!confirm(`"${testTitle}" testini "${studentName}" adlı öğrenciye tekrar atamak istediğinizden emin misiniz?`)) {
                return;
            }

            try {
                showNotification('Test tekrar atanıyor...', 'info');

                // Check if already assigned
                const { data: existing, error: checkError } = await supabase
                    .from('test_assignments')
                    .select('*')
                    .eq('student_id', studentId)
                    .eq('test_id', testId);

                if (existing && existing.length > 0) {
                    // Already assigned, just notify
                    showNotification('Bu test zaten öğrenciye atanmış.', 'warning');
                    return;
                }

                // Create new assignment
                const { error: assignError } = await supabase
                    .from('test_assignments')
                    .insert([{
                        student_id: studentId,
                        test_id: testId,
                        assigned_by: currentUser.id,
                        assigned_at: new Date().toISOString()
                    }]);

                if (assignError) throw assignError;

                showNotification('✅ Test başarıyla tekrar atandı!', 'success');

                // Reload failed tests
                loadFailedTestsList();

            } catch (error) {
                console.error('Error reassigning test:', error);
                showNotification('❌ Test tekrar atanırken hata oluştu: ' + error.message, 'error');
            }
        }

        // Delete failed test result
        async function deleteFailedTestResult(resultId, studentName, testTitle) {
            if (!confirm(`${studentName} adlı öğrencinin "${testTitle}" testindeki sonucunu silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`)) {
                return;
            }

            try {
                const { error } = await supabase
                    .from('test_results')
                    .delete()
                    .eq('id', resultId);

                if (error) throw error;

                showNotification('✅ Test sonucu başarıyla silindi!', 'success');
                loadFailedTestsList(); // Refresh the list
            } catch (error) {
                console.error('Error deleting test result:', error);
                showNotification('❌ Test sonucu silinirken hata oluştu: ' + error.message, 'error');
            }
        }