/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                 AUTH & OTURUM YÖNETİMİ                       ║
 * ║  Giriş, çıkış, session yükleme ve frontend erişim kontrolleri║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * ⚠️  ÖNEMLI GÜVENLİK NOTU:
 *  Bu dosyadaki kontroller yalnızca FRONTEND tarafındadır.
 *  Gerçek veri güvenliği için Supabase tarafında RLS politikaları
 *  (rls-policies.sql) aktif edilmelidir.
 *
 *  Mevcut auth sistemi: Özel (custom) — students/teachers tablosuna
 *  TC+şifre ile sorgu. Supabase Auth JWT'si kullanılmıyor.
 *  RLS tam desteği için ilerleyen sürümde Supabase Auth'a geçiş önerilir.
 */

// ─── Oturum Yönetimi ───────────────────────────────────────────

/**
 * Aktif kullanıcıyı sessionStorage'a kaydeder.
 * TC no, şifre gibi hassas alanları SAKLAMAZ.
 */
function saveSession(user) {
    const safeCopy = { ...user };
    delete safeCopy.tc_no;      // TC no saklanmaz
    delete safeCopy.password;   // Şifre kesinlikle saklanmaz

    sessionStorage.setItem('currentUser', JSON.stringify(safeCopy));
}

/**
 * Sayfa yenilendiğinde oturumu yeniden yükler.
 */
function loadSession() {
    try {
        const raw = sessionStorage.getItem('currentUser');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        sessionStorage.removeItem('currentUser');
        return null;
    }
}

/**
 * Oturumu temizler.
 */
function clearSession() {
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('rememberedStudent');
    localStorage.removeItem('rememberedTeacher');
}

// ─── Erişim Kontrol Yardımcıları ──────────────────────────────

/**
 * Sadece giriş yapmış kullanıcının kendi verisine erişmesini sağlar.
 * Her Supabase sorgusundan önce çağrılmalıdır.
 *
 * @param {string} requiredType  'student' | 'teacher' | null (her ikisi de)
 * @param {string} [studentId]   Öğrenci işlemlerinde hedef öğrencinin ID'si
 * @returns {{ ok: boolean, reason?: string }}
 */
function checkAccess(requiredType = null, studentId = null) {
    // 1. Kullanıcı giriş yapmış mı?
    if (!currentUser || !currentUser.id) {
        return { ok: false, reason: 'Oturum açık değil.' };
    }

    // 2. Doğru tip mi? (öğrenci/öğretmen)
    if (requiredType && currentUser.type !== requiredType) {
        return { ok: false, reason: `Bu işlem için ${requiredType === 'teacher' ? 'öğretmen' : 'öğrenci'} girişi gereklidir.` };
    }

    // 3. Öğrenci kendi verisini mi istiyor? (başka öğrencinin verisine erişim engeli)
    if (studentId && currentUser.type === 'student' && currentUser.id !== studentId) {
        return { ok: false, reason: 'Sadece kendi verilerinize erişebilirsiniz.' };
    }

    return { ok: true };
}

/**
 * Öğretmen yetkisi gerektiren işlevler için kısa yardımcı.
 */
function requireTeacher() {
    const { ok, reason } = checkAccess('teacher');
    if (!ok) {
        showNotification(reason || 'Yetki hatası.', 'error');
        return false;
    }
    return true;
}

/**
 * Öğrenci yetkisi + kendi verisine erişim kontrolü.
 * @param {string} targetStudentId  İşlem yapılacak öğrenci ID'si
 */
function requireOwnStudentData(targetStudentId) {
    const { ok, reason } = checkAccess('student', targetStudentId);
    if (!ok) {
        showNotification(reason || 'Yetki hatası.', 'error');
        return false;
    }
    return true;
}

// ─── Öğrenci Girişi ───────────────────────────────────────────

async function studentLogin(event) {
    event.preventDefault();
    const tc        = document.getElementById('studentTC').value.trim();
    const studentNo = document.getElementById('studentNo').value.trim();
    const rememberMe = document.getElementById('rememberStudent').checked;

    if (!tc || !studentNo) {
        showNotification('TC ve öğrenci numarasını doldurun.', 'error');
        return;
    }

    try {
        // ⚠️  Güvenlik notu: Şu an şifresiz TC+no kontrolü yapılıyor.
        // İleride hash'li şifre veya Supabase Auth ile güçlendirilebilir.
        const { data, error } = await supabase
            .from('students')
            .select('id, name, student_no, class_name') // tc_no'yu çekme!
            .eq('tc_no', tc)
            .eq('student_no', studentNo)
            .single();

        if (error || !data) {
            showNotification('Öğrenci bulunamadı. TC ve öğrenci numaranızı kontrol edin.', 'error');
            return;
        }

        currentUser = { ...data, type: 'student' };
        saveSession(currentUser);

        if (rememberMe) {
            saveCredentials('student', { tc, studentNo });
        } else {
            clearRememberedCredentials('student');
        }

        showStudentDashboard();

    } catch (err) {
        console.error('Öğrenci girişi hatası:', err);
        showNotification('Giriş yapılırken hata oluştu.', 'error');
    }
}

// ─── Öğretmen Girişi ──────────────────────────────────────────

async function teacherLogin(event) {
    event.preventDefault();
    const username   = document.getElementById('teacherUsername').value.trim();
    const password   = document.getElementById('teacherPassword').value;
    const rememberMe = document.getElementById('rememberTeacher').checked;

    if (!username || !password) {
        showNotification('Kullanıcı adı ve şifre gereklidir.', 'error');
        return;
    }

    try {
        // ⚠️  Güvenlik notu: Şifre düz metin olarak karşılaştırılıyor.
        // Üretim ortamında bcrypt hash + Supabase Auth kullanılmalıdır.
        const { data, error } = await supabase
            .from('teachers')
            .select('id, name, username')  // password kolonu seçilmez
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            showNotification('Kullanıcı adı veya şifre hatalı.', 'error');
            return;
        }

        currentUser = { ...data, type: 'teacher' };
        saveSession(currentUser);

        if (rememberMe) {
            saveCredentials('teacher', { username });
        } else {
            clearRememberedCredentials('teacher');
        }

        showTeacherDashboard();

    } catch (err) {
        console.error('Öğretmen girişi hatası:', err);
        showNotification('Giriş yapılırken hata oluştu.', 'error');
    }
}

// ─── Çıkış ────────────────────────────────────────────────────

function logout() {
    currentUser = null;
    clearSession();

    // Tüm panelleri gizle, giriş ekranını göster
    ['studentDashboard', 'teacherDashboard'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.classList.remove('hidden');
}

// ─── Hatırlanan Giriş Bilgileri ───────────────────────────────

function saveCredentials(type, data) {
    // ⚠️  localStorage düz metin saklar — sadece cihaz güvenli ise kullanılabilir.
    localStorage.setItem(`remembered_${type}`, JSON.stringify(data));
}

function loadRememberedCredentials(type) {
    try {
        const raw = localStorage.getItem(`remembered_${type}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function clearRememberedCredentials(type) {
    localStorage.removeItem(`remembered_${type}`);
}

// ─── Dışa aktar ───────────────────────────────────────────────
window.studentLogin               = studentLogin;
window.teacherLogin               = teacherLogin;
window.logout                     = logout;
window.checkAccess                = checkAccess;
window.requireTeacher             = requireTeacher;
window.requireOwnStudentData      = requireOwnStudentData;
window.saveSession                = saveSession;
window.loadSession                = loadSession;
window.saveCredentials            = saveCredentials;
window.loadRememberedCredentials  = loadRememberedCredentials;
window.clearRememberedCredentials = clearRememberedCredentials;
