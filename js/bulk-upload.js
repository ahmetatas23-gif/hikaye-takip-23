/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              BULK-UPLOAD.JS — TOPLU EXCEL YÜKLEMESİ         ║
 * ║  Optik form Excel dosyalarını parse eder, Supabase'e yazar.  ║
 * ║  supabase değişkeni: window._supabaseClient (supabase-config.js) ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

/* ===== ANALİZ PANELİ - GELIŞMIŞ VERSIYON ===== */

// Global state
let currentAnalysisData = {
    test: null,
    results: [],
    questions: [],
    filteredResults: []
};

// CSS Stilleri
const analysisPanelStyles = `
    /* Modal Container */
    .analysis-modal {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 1000;
        backdrop-filter: blur(5px);
        animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    .analysis-content {
        background: white;
        width: 95%;
        max-width: 1400px;
        height: 90vh;
        margin: 5vh auto;
        border-radius: 1rem;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        animation: slideUp 0.3s ease;
    }
    
    @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    
    /* Header */
    .analysis-header {
        padding: 1.5rem;
        border-bottom: 2px solid #e5e7eb;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .analysis-header h2 {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
    }
    
    .analysis-header p {
        font-size: 0.875rem;
        opacity: 0.9;
        margin: 0.25rem 0 0 0;
    }
    
    /* Body */
    .analysis-body {
        display: flex;
        flex: 1;
        overflow: hidden;
    }
    
    /* Sidebar */
    .analysis-sidebar {
        width: 320px;
        border-right: 1px solid #e5e7eb;
        overflow-y: auto;
        background: #f9fafb;
        padding: 1.5rem;
    }
    
    .analysis-sidebar h3 {
        font-size: 0.875rem;
        font-weight: 700;
        text-transform: uppercase;
        color: #6b7280;
        margin: 0 0 1rem 0;
        letter-spacing: 0.5px;
    }
    
    .student-item {
        background: white;
        padding: 0.75rem;
        border-radius: 0.5rem;
        border: 1px solid #e5e7eb;
        margin-bottom: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .student-item:hover {
        border-color: #667eea;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
        transform: translateX(4px);
    }
    
    .student-name {
        font-weight: 600;
        color: #1f2937;
        font-size: 0.875rem;
        margin-bottom: 0.25rem;
    }
    
    .student-stats {
        display: flex;
        gap: 0.75rem;
        font-size: 0.75rem;
    }
    
    .stat-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-weight: 600;
    }
    
    .stat-correct {
        background: #d1fae5;
        color: #065f46;
    }
    
    .stat-wrong {
        background: #fee2e2;
        color: #991b1b;
    }
    
    .stat-score {
        background: #dbeafe;
        color: #1e40af;
    }
    
    /* Main Content */
    .analysis-main {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
        background: white;
    }
    
    /* Filters */
    .analysis-filters {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
    }
    
    .filter-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .filter-group label {
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
    }
    
    .filter-group select {
        padding: 0.5rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        outline: none;
        transition: all 0.2s;
    }
    
    .filter-group select:focus {
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    /* Questions Grid */
    .questions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(550px, 1fr));
        gap: 1.5rem;
    }
    
    @media (max-width: 1024px) {
        .questions-grid {
            grid-template-columns: 1fr;
        }
        .analysis-sidebar {
            display: none;
        }
    }
    
    /* Question Card */
    .question-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.75rem;
        padding: 1.5rem;
        transition: all 0.3s;
        position: relative;
    }
    
    .question-card:hover {
        border-color: #667eea;
        box-shadow: 0 10px 25px -5px rgba(102, 126, 234, 0.1);
    }
    
    .question-card.low-success {
        border-left: 4px solid #ef4444;
    }
    
    .question-card.high-success {
        border-left: 4px solid #10b981;
    }
    
    .question-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }
    
    .question-number {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        font-weight: 700;
    }
    
    .success-rate {
        font-size: 0.875rem;
        font-weight: 700;
    }
    
    .success-rate.high {
        color: #10b981;
    }
    
    .success-rate.medium {
        color: #f59e0b;
    }
    
    .success-rate.low {
        color: #ef4444;
    }
    
    .question-text {
        color: #1f2937;
        font-weight: 600;
        margin-bottom: 1rem;
        line-height: 1.5;
        font-size: 0.95rem;
    }
    
    /* Options */
    .options-container {
        space-y: 1rem;
    }
    
    .option-item {
        margin-bottom: 1rem;
    }
    
    .option-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
    }
    
    .option-label {
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .option-label.correct {
        color: #10b981;
    }
    
    .option-label.distractor {
        color: #ef4444;
    }
    
    .option-label.normal {
        color: #6b7280;
    }
    
    .option-stats {
        color: #6b7280;
        font-size: 0.75rem;
    }
    
    .option-bar {
        height: 12px;
        background: #e5e7eb;
        border-radius: 0.375rem;
        overflow: hidden;
        margin-bottom: 0.5rem;
        position: relative;
    }
    
    .option-bar-fill {
        height: 100%;
        transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        border-radius: 0.375rem;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 4px;
    }
    
    .option-bar-fill.correct {
        background: linear-gradient(90deg, #10b981 0%, #6ee7b7 100%);
    }
    
    .option-bar-fill.wrong {
        background: linear-gradient(90deg, #ef4444 0%, #fca5a5 100%);
    }
    
    .option-bar-fill.distractor {
        background: linear-gradient(90deg, #f59e0b 0%, #fcd34d 100%);
    }
    
    .option-bar-fill.normal {
        background: linear-gradient(90deg, #9ca3af 0%, #d1d5db 100%);
    }
    
    /* Student Badges */
    .students-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }
    
    .student-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.7rem;
        font-weight: 600;
        white-space: nowrap;
        border: 1px solid;
    }
    
    .student-badge.correct {
        background: #ecfdf5;
        color: #065f46;
        border-color: #a7f3d0;
    }
    
    .student-badge.wrong {
        background: #fef2f2;
        color: #991b1b;
        border-color: #fecaca;
    }
    
    .student-badge.distractor {
        background: #fffbeb;
        color: #92400e;
        border-color: #fde68a;
    }
    
    .student-badge.normal {
        background: #f3f4f6;
        color: #374151;
        border-color: #d1d5db;
    }
    
    /* Close Button */
    .analysis-close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.5rem;
        transition: transform 0.2s;
    }
    
    .analysis-close-btn:hover {
        transform: scale(1.2);
    }
    
    /* Scrollbar Styling */
    .analysis-sidebar::-webkit-scrollbar,
    .analysis-main::-webkit-scrollbar {
        width: 8px;
    }
    
    .analysis-sidebar::-webkit-scrollbar-track,
    .analysis-main::-webkit-scrollbar-track {
        background: #f3f4f6;
    }
    
    .analysis-sidebar::-webkit-scrollbar-thumb,
    .analysis-main::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 4px;
    }
    
    .analysis-sidebar::-webkit-scrollbar-thumb:hover,
    .analysis-main::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
    }
`;

// HTML Template
const analysisModalTemplate = `
<div id="analysisModal" class="analysis-modal">
    <div class="analysis-content">
        <!-- Header -->
        <div class="analysis-header">
            <div>
                <h2 id="analysisTestTitle">Test Analizi</h2>
                <p id="analysisTestStats">Yükleniyor...</p>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <button onclick="downloadAnalysisPDF()" title="PDF İndir"
                        style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.4); color:white; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; display:flex; align-items:center; gap:6px; transition:background 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.35)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    <i class="fas fa-file-pdf"></i> PDF İndir
                </button>
                <button class="analysis-close-btn" onclick="closeAnalysisModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
        
        <!-- Body -->
        <div class="analysis-body">
            <!-- Sidebar: Katılımcı Listesi -->
            <div class="analysis-sidebar">
                <h3><i class="fas fa-users mr-2"></i>Katılımcılar</h3>
                <div id="analysisStudentList">
                    <!-- Öğrenciler buraya gelecek -->
                </div>
            </div>
            
            <!-- Main: Analiz İçeriği -->
            <div class="analysis-main">
                <!-- Filtreler -->
                <div class="analysis-filters">
                    <div class="filter-group">
                        <label for="analysisFilterSelect">Filtre:</label>
                        <select id="analysisFilterSelect" onchange="applyAnalysisFilter()">
                            <option value="all">Tüm Öğrenciler</option>
                            <option value="wrong">Sadece Yanlış Yapanlar</option>
                            <option value="correct">Sadece Doğru Yapanlar</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="analysisSortSelect">Sırala:</label>
                        <select id="analysisSortSelect" onchange="applyAnalysisFilter()">
                            <option value="order">Soru Sırasına Göre</option>
                            <option value="difficulty">Zorluk Derecesine Göre</option>
                        </select>
                    </div>
                </div>
                
                <!-- Sorular Grid -->
                <div class="questions-grid" id="analysisQuestionsGrid">
                    <!-- Soru kartları buraya gelecek -->
                </div>
            </div>
        </div>
    </div>
</div>
`;

// Ana Fonksiyonlar
async function showAnalysisPanel(testId) {
    try {
        showNotification('📊 Analiz verileri hazırlanıyor...', 'info');
        
        // Test verilerini çek
        const { data: test, error: testError } = await supabase
            .from('tests')
            .select('*')
            .eq('id', testId)
            .single();
            
        if (testError) throw testError;
        
        // Sonuçları çek
        const { data: results, error: resultsError } = await supabase
            .from('test_results')
            .select('*')
            .eq('test_id', testId)
            .order('completed_at', { ascending: false });
            
        if (resultsError) throw resultsError;

        // Öğrenci bilgilerini ayrı çek (join güvenilmez olabilir)
        const studentIds = [...new Set((results || []).map(r => r.student_id).filter(Boolean))];
        let studentMap = {};
        if (studentIds.length > 0) {
            const { data: students } = await supabase
                .from('students')
                .select('id, name')
                .in('id', studentIds);
            (students || []).forEach(s => { studentMap[s.id] = s; });
        }
        // results'a students bilgisini ekle
        const enrichedResults = (results || []).map(r => ({
            ...r,
            students: studentMap[r.student_id] || { id: r.student_id, name: 'İsimsiz' }
        }));
        
        // Veriyi global state'e kaydet
        currentAnalysisData = {
            test: test,
            results: enrichedResults,
            questions: JSON.parse(test.questions || '[]'),
            filteredResults: enrichedResults
        };
        
        // Modalı render et
        renderAnalysisPanel();
        document.getElementById('analysisModal').style.display = 'block';
        
        showNotification('✅ Analiz yüklendi!', 'success');
        
    } catch (error) {
        console.error('Analiz hatası:', error);
        showNotification('❌ Analiz yüklenirken bir hata oluştu: ' + error.message, 'error');
    }
}

function renderAnalysisPanel() {
    const { test, results, questions } = currentAnalysisData;
    
    // Header güncelleme
    document.getElementById('analysisTestTitle').textContent = `📊 ${test.title}`;
    
    const avgScore = results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
        : 0;
    
    document.getElementById('analysisTestStats').textContent = 
        `${results.length} Katılımcı • Ortalama Puan: %${avgScore}`;
    
    // Katılımcı Listesi
    renderStudentList();
    
    // Soru Analizleri
    renderQuestionsAnalysis();
}

function renderStudentList() {
    const { results } = currentAnalysisData;
    const studentList = document.getElementById('analysisStudentList');

    if (!results || results.length === 0) {
        studentList.innerHTML = '<p style="color:#aaa; font-size:13px; padding:12px 0;">Henüz katılımcı yok.</p>';
        return;
    }

    studentList.innerHTML = results.map((result) => {
        let answers = {};
        try { answers = typeof result.answers === 'string' ? JSON.parse(result.answers) : (result.answers || {}); } catch(e) {}
        const correctCount = answers.correctAnswers || 0;
        const totalQuestions = answers.totalQuestions || 0;
        const wrongCount = totalQuestions - correctCount;
        const passed = result.score >= 70;
        const scoreColor = passed ? '#22c55e' : '#ef4444';

        return `
            <div class="student-item" 
                 style="cursor:pointer; border-left: 3px solid ${scoreColor}; transition: background 0.15s;"
                 title="${result.students?.name} — Detaylı sonuçlar için tıkla"
                 onmouseover="this.style.background='rgba(255,255,255,0.15)'"
                 onmouseout="this.style.background=''"
                 onclick="analizdenDetayAc(${result.id}, ${result.students?.id || 'null'}, '${(result.students?.name || 'İsimsiz').replace(/'/g, "\'")}', '${currentAnalysisData.test.title.replace(/'/g, "\'")}')">
                <div class="student-name" style="display:flex; align-items:center; gap:6px;">
                    <i class="fas fa-user-circle" style="opacity:0.6; font-size:11px;"></i>
                    ${result.students?.name || 'İsimsiz'}
                </div>
                <div class="student-stats">
                    <span class="stat-badge stat-score" style="background:${passed ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}; color:${scoreColor};">${result.score}%</span>
                    <span class="stat-badge stat-correct">✓ ${correctCount}</span>
                    <span class="stat-badge stat-wrong">✗ ${wrongCount}</span>
                </div>
                <div style="font-size:10px; opacity:0.5; margin-top:3px; text-align:right;">
                    <i class="fas fa-mouse-pointer" style="font-size:9px;"></i> Detay
                </div>
            </div>
        `;
    }).join('');
}

// Analiz panelinden detaylı sonuç aç
async function analizdenDetayAc(resultId, studentId, studentName, testTitle) {
    try {
        // Önce detaylı modalı oluştur (showDetailedResults içi)
        await showDetailedResults(resultId, studentId, studentName, testTitle);
        // detailedResultsModal analiz modalının üstünde z-index:1100 ile görünür
    } catch(e) {
        console.error('[AnalizDetay] hata:', e);
        showNotification('Detay yüklenemedi: ' + e.message, 'error');
    }
}

function renderQuestionsAnalysis() {
    const { results, questions } = currentAnalysisData;
    const filterValue = document.getElementById('analysisFilterSelect').value;
    const sortValue = document.getElementById('analysisSortSelect').value;

    // ── Optik form algılama ──────────────────────────────────────────────────
    // Optik form testlerinde questions=[] ama her result.answers.soruAnaliz dolu
    const firstAnswers = (() => {
        try { return typeof results[0]?.answers === 'string'
            ? JSON.parse(results[0].answers) : (results[0]?.answers || {}); } catch { return {}; }
    })();
    const isOptikForm = firstAnswers.kaynak === 'optik_form' ||
        ((!questions || questions.length === 0) && firstAnswers.soruAnaliz?.length > 0);

    if (isOptikForm) {
        renderOptikQuestionsAnalysis(results, filterValue, sortValue);
        return;
    }

    // Soru analizini hesapla
    let questionsAnalysis = questions.map((q, qIdx) => {
        const optionStats = {};
        let correctCount = 0;
        
        // Başlangıç seçeneklerini ayarla
        if (q.type === 'multiple_choice') {
            (q.options || []).forEach((_, i) => optionStats[i] = []);
        } else if (q.type === 'true_false') {
            optionStats[true] = [];
            optionStats[false] = [];
        } else if (q.type === 'fill_blank') {
            // fill_blank için seçenekleri kelime bazlı ön-doldur
            if (q.options && q.options.length > 0) {
                q.options.forEach(opt => { optionStats[String(opt).trim()] = []; });
            }
        }
        
        results.forEach(r => {
            let answers = {};
            try {
                answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {});
            } catch(e) { console.error("Answer parse error", e); }
            
            const studentAnswers = answers.answers || [];
            const userAnswer = studentAnswers[qIdx];
            
            if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
                const emptyKey = "(Boş)";
                if (!optionStats[emptyKey]) optionStats[emptyKey] = [];
                optionStats[emptyKey].push({
                    name: r.students?.name || 'İsimsiz',
                    isCorrect: false
                });
                return;
            }

            let isCorrect = false;
            let statsKey = userAnswer;

            if (q.type === 'multiple_choice') {
                isCorrect = parseInt(userAnswer) === parseInt(q.correct);
                statsKey = parseInt(userAnswer);
            } else if (q.type === 'fill_blank') {
                // Cevap kelime mi (yeni format) yoksa index mi (eski format) olduğunu belirle
                const correctWord = String(q.correct).trim();
                let userWord;
                if (q.options && q.options.length > 0 && !isNaN(parseInt(userAnswer)) && q.options[parseInt(userAnswer)] !== undefined) {
                    // Eski format: index kaydedilmiş -> kelimeye çevir
                    userWord = String(q.options[parseInt(userAnswer)]).trim();
                } else {
                    // Yeni format: kelime kaydedilmiş
                    userWord = String(userAnswer).trim();
                }
                isCorrect = userWord.toLowerCase() === correctWord.toLowerCase();
                statsKey = userWord; // Her zaman kelime bazlı key kullan
            } else if (q.type === 'true_false') {
                const userBool = userAnswer === true || userAnswer === 'true';
                const correctBool = q.correct === true || q.correct === 'true';
                isCorrect = userBool === correctBool;
                statsKey = userBool;
            }

            if (!optionStats[statsKey]) optionStats[statsKey] = [];
            optionStats[statsKey].push({
                name: r.students?.name || 'İsimsiz',
                isCorrect: isCorrect
            });
            if (isCorrect) correctCount++;
        });
        
        const successRate = results.length > 0 ? (correctCount / results.length) * 100 : 0;
        
        return {
            index: qIdx,
            question: q,
            optionStats,
            correctCount,
            successRate,
            wrongCount: results.length - correctCount
        };
    });
    
    // Filtreleme
    if (filterValue === 'wrong') {
        questionsAnalysis = questionsAnalysis.filter(q => q.wrongCount > 0);
    } else if (filterValue === 'correct') {
        questionsAnalysis = questionsAnalysis.filter(q => q.wrongCount === 0);
    }
    
    // Sıralama
    if (sortValue === 'difficulty') {
        questionsAnalysis.sort((a, b) => a.successRate - b.successRate);
    }
    
    // Render
    const questionsGrid = document.getElementById('analysisQuestionsGrid');
    questionsGrid.innerHTML = questionsAnalysis.map(analysis => renderQuestionCard(analysis)).join('');
}

function renderQuestionCard(analysis) {
    const { index, question, optionStats, correctCount, successRate, wrongCount } = analysis;
    const totalResponses = currentAnalysisData.results.length;
    
    let successClass = 'high';
    if (successRate < 50) successClass = 'low'; 
    else if (successRate < 80) successClass = 'medium';
    
    const cardClass = successRate >= 80 ? 'high-success' : 'low-success';
    
    let optionsHtml = '';
    const typeLabel = {
        'multiple_choice': 'Çoktan Seçmeli',
        'true_false': 'Doğru/Yanlış',
        'fill_blank': 'Boşluk Doldurma'
    }[question.type] || question.type;

    if (question.type === 'multiple_choice') {
        optionsHtml = (question.options || []).map((option, oIdx) => {
            const students = optionStats[oIdx] || [];
            const count = students.length;
            const percent = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
            const isCorrect = parseInt(oIdx) === parseInt(question.correct);
            return renderAnalysisOptionItem(oIdx, option, count, percent, isCorrect, students, 'multiple_choice');
        }).join('');
    } else if (question.type === 'true_false') {
        optionsHtml = [true, false].map((val, i) => {
            const students = optionStats[val] || [];
            const count = students.length;
            const percent = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
            const isCorrect = val === (question.correct === true || question.correct === 'true');
            return renderAnalysisOptionItem(i, val ? "Doğru" : "Yanlış", count, percent, isCorrect, students);
        }).join('');
    } else if (question.type === 'fill_blank') {
        // Tüm kelime bazlı bucket'ları göster
        const correctVal = String(question.correct || '').trim();
        
        // optionStats'taki tüm anahtarları al (kelime bazlı)
        let allKeys = Object.keys(optionStats);
        
        // Doğru cevap anahtarda yoksa başa ekle (sıfır cevaplı da olsa gösterilsin)
        if (!allKeys.some(k => k.toLowerCase() === correctVal.toLowerCase())) {
            allKeys.unshift(correctVal);
        }
        
        // Doğru cevabı en üste al
        allKeys.sort((a, b) => {
            const aCorrect = a.toLowerCase() === correctVal.toLowerCase();
            const bCorrect = b.toLowerCase() === correctVal.toLowerCase();
            if (aCorrect) return -1;
            if (bCorrect) return 1;
            return 0;
        });
        
        optionsHtml = allKeys.map((key, i) => {
            if (key === '(Boş)') return ''; // Boş cevaplar aşağıda ayrıca eklenir
            const students = optionStats[key] || [];
            const count = students.length;
            const percent = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
            const isCorrect = key.toLowerCase() === correctVal.toLowerCase();
            
            if (count === 0 && !isCorrect) return ''; // Kimse seçmediyse ve doğru değilse gösterme
            
            return renderAnalysisOptionItem(i, key, count, percent, isCorrect, students);
        }).join('');
    }
    
    // Boş cevapları her soru tipi için alta ekle
    if (optionStats["(Boş)"] && optionStats["(Boş)"].length > 0) {
        const students = optionStats["(Boş)"];
        const count = students.length;
        const percent = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
        optionsHtml += renderAnalysisOptionItem(-1, "(Boş / Cevaplanmadı)", count, percent, false, students);
    }
    
    return `
        <div class="question-card ${cardClass}">
            <div class="question-header">
                <span class="question-number">Soru ${index + 1} (${typeLabel})</span>
                <span class="success-rate ${successClass}">%${Math.round(successRate)} Başarı</span>
            </div>
            <p class="question-text">${question.question}</p>
            <div class="options-container">
                ${optionsHtml}
            </div>
        </div>
    `;
}

function renderAnalysisOptionItem(idx, label, count, percent, isCorrect, students, questionType = '') {
    const isDistractor = !isCorrect && percent > 30;
    let barClass = 'normal';
    let labelClass = 'normal';
    let badgeClass = 'normal';
    
    if (isCorrect) {
        barClass = 'correct';
        labelClass = 'correct';
        badgeClass = 'correct';
    } else if (isDistractor) {
        barClass = 'wrong';
        labelClass = 'distractor';
        badgeClass = 'distractor';
    }
    
    // Sadece çoktan seçmeli seçenekleri için A, B, C... öneki ekle
    const labelPrefix = (questionType === 'multiple_choice' && idx >= 0 && idx < 26) ? String.fromCharCode(65 + idx) + ") " : "";

    return `
        <div class="option-item">
            <div class="option-header">
                <span class="option-label ${labelClass}">
                    ${isCorrect ? '<i class="fas fa-check-circle"></i>' : ''}
                    ${labelPrefix}${label}
                </span>
                <span class="option-stats">${count} kişi (%${Math.round(percent)})</span>
            </div>
            <div class="option-bar">
                <div class="option-bar-fill ${barClass}" style="width: ${percent}%"></div>
            </div>
            <div class="students-list">
                ${students.map(s => `
                    <span class="student-badge ${badgeClass}">${s.name}</span>
                `).join('')}
            </div>
        </div>
    `;
}

function renderOptikQuestionsAnalysis(results, filterValue, sortValue) {
    var questionsGrid = document.getElementById('analysisQuestionsGrid');
    var totalStudents = results.length;

    if (totalStudents === 0) {
        questionsGrid.innerHTML = '<p style="color:#aaa;padding:16px;">Henüz sonuç yok.</p>';
        return;
    }

    // Her soruya ait istatistikleri soruAnaliz verilerinden topla
    var soruMap = {};

    results.forEach(function(r) {
        var ans = {};
        try { ans = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {}); } catch(e) {}
        var soruAnaliz = ans.soruAnaliz || [];
        var studentName = (r.students && r.students.name) ? r.students.name : 'İsimsiz';

        soruAnaliz.forEach(function(s) {
            var key = s.soruNo;
            if (!soruMap[key]) {
                soruMap[key] = { soruNo: key, dogruCevap: s.dogruCevap,
                    options: {}, dogru: [], yanlis: [], bos: [] };
            }
            var entry = soruMap[key];
            if (s.sonuc === 'dogru') {
                entry.dogru.push(studentName);
                var k = s.dogruCevap || '✓';
                if (!entry.options[k]) entry.options[k] = { students: [], isCorrect: true };
                entry.options[k].students.push(studentName);
            } else if (s.sonuc === 'yanlis') {
                entry.yanlis.push(studentName);
                var kk = s.ogrenciCevap || '?';
                if (!entry.options[kk]) entry.options[kk] = { students: [], isCorrect: false };
                entry.options[kk].students.push(studentName);
            } else {
                entry.bos.push(studentName);
                if (!entry.options['—']) entry.options['—'] = { students: [], isCorrect: false, isBlank: true };
                entry.options['—'].students.push(studentName);
            }
        });
    });

    // Soru numarasına göre sırala
    var soruList = Object.values(soruMap).sort(function(a, b) {
        return parseInt(a.soruNo) - parseInt(b.soruNo);
    }).map(function(s) {
        return Object.assign({}, s, {
            successRate: totalStudents > 0 ? (s.dogru.length / totalStudents) * 100 : 0,
            wrongCount:  s.yanlis.length + s.bos.length,
        });
    });

    // Filtreleme
    if (filterValue === 'wrong') soruList = soruList.filter(function(s) { return s.wrongCount > 0; });
    else if (filterValue === 'correct') soruList = soruList.filter(function(s) { return s.wrongCount === 0; });

    // Sıralama
    if (sortValue === 'difficulty') soruList.sort(function(a, b) { return a.successRate - b.successRate; });

    if (soruList.length === 0) {
        questionsGrid.innerHTML = '<p style="color:#aaa;padding:16px;">Filtreye uyan soru bulunamadı.</p>';
        return;
    }

    questionsGrid.innerHTML = soruList.map(function(s) {
        var successRate  = s.successRate;
        var successClass = successRate >= 80 ? 'high' : successRate >= 50 ? 'medium' : 'low';
        var cardClass    = successRate >= 80 ? 'high-success' : 'low-success';
        var dogruCevap   = s.dogruCevap;

        // Seçenekler: doğru cevap önce, boş en sona
        var optionKeys = Object.keys(s.options).sort(function(a, b) {
            if (a === dogruCevap) return -1;
            if (b === dogruCevap) return  1;
            if (a === '—') return  1;
            if (b === '—') return -1;
            return a.localeCompare(b);
        });

        var optionsHtml = optionKeys.map(function(key) {
            var opt     = s.options[key];
            var count   = opt.students.length;
            var percent = totalStudents > 0 ? (count / totalStudents) * 100 : 0;
            var isCorrect = (key === dogruCevap);
            var isBlank   = (opt.isBlank || key === '—');
            var barCls    = isCorrect ? 'correct' : 'wrong';
            var labelCls  = isCorrect ? 'correct' : (percent > 30 ? 'distractor' : 'normal');
            var badgeCls  = isCorrect ? 'correct' : (percent > 30 ? 'distractor' : 'normal');
            var icon      = isCorrect ? '<i class="fas fa-check-circle"></i> ' : '';
            var dispKey   = isBlank ? '(Boş / Cevaplanmadı)' : key;
            var bars = '<div class="option-bar"><div class="option-bar-fill ' + barCls + '" style="width:' + percent + '%"></div></div>';
            var badges = opt.students.map(function(n) {
                return '<span class="student-badge ' + badgeCls + '">' + n + '</span>';
            }).join('');
            return '<div class="option-item">'
                 + '<div class="option-header">'
                 + '<span class="option-label ' + labelCls + '">' + icon + dispKey + '</span>'
                 + '<span class="option-stats">' + count + ' kişi (%' + Math.round(percent) + ')</span>'
                 + '</div>' + bars
                 + '<div class="students-list">' + badges + '</div></div>';
        }).join('');

        return '<div class="question-card ' + cardClass + '">'
             + '<div class="question-header">'
             + '<span class="question-number">Soru ' + s.soruNo + ' (Optik Form)</span>'
             + '<span class="success-rate ' + successClass + '">'
             + '%' + Math.round(successRate) + ' Başarı</span></div>'
             + '<p class="question-text">Doğru Cevap: <strong style="color:#16a34a;">' + dogruCevap + '</strong>'
             + ' &nbsp;|&nbsp; '
             + '<span style="color:#16a34a;">✓ ' + s.dogru.length + ' doğru</span>'
             + ' <span style="color:#dc2626;">✗ ' + s.yanlis.length + ' yanlış</span>'
             + ' <span style="color:#9ca3af;">— ' + s.bos.length + ' boş</span></p>'
             + '<div class="options-container">' + optionsHtml + '</div></div>';
    }).join('');
}

function applyAnalysisFilter() {
    renderQuestionsAnalysis();
}

function closeAnalysisModal() {
    document.getElementById('analysisModal').style.display = 'none';
}

function downloadAnalysisPDF() {
    const { test, results, questions } = currentAnalysisData;
    if (!test || !questions.length) {
        showNotification('❌ Önce analiz panelini açın.', 'error');
        return;
    }

    showNotification('PDF hazırlanıyor...', 'info');

    const avgScore = results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0;
    const passedCount = results.filter(r => r.score >= 70).length;
    const typeLabel = { multiple_choice: 'Çoktan Seçmeli', fill_blank: 'Boşluk Doldurma', true_false: 'Doğru/Yanlış' };

    // Her soru için istatistik hesapla (renderQuestionsAnalysis mantığıyla aynı)
    const questionsAnalysis = questions.map((q, qIdx) => {
        const optionStats = {};
        let correctCount = 0;

        // fill_blank için başlangıçta index bazlı key OLUŞTURMA — kelime bazlı çalışacak
        if (q.type === 'multiple_choice') {
            (q.options || []).forEach((opt, i) => { optionStats[i] = []; });
        } else if (q.type === 'true_false') {
            optionStats[true] = []; optionStats[false] = [];
        }
        // fill_blank: boş bırak, öğrenci cevaplarından dinamik doldur

        results.forEach(r => {
            let answers = {};
            try { answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {}); } catch(e) {}
            const studentAnswers = answers.answers || [];
            const userAnswer = studentAnswers[qIdx];

            if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
                if (!optionStats['(Boş)']) optionStats['(Boş)'] = [];
                optionStats['(Boş)'].push({ name: r.students?.name || 'İsimsiz', isCorrect: false });
                return;
            }

            let isCorrect = false, statsKey = userAnswer;
            if (q.type === 'multiple_choice') {
                isCorrect = parseInt(userAnswer) === parseInt(q.correct);
                statsKey = parseInt(userAnswer);
            } else if (q.type === 'fill_blank') {
                const cWord = String(q.correct).trim();
                let uWord;
                // Eski format: index kaydedilmiş
                if (q.options?.length > 0 && !isNaN(parseInt(userAnswer)) && q.options[parseInt(userAnswer)] !== undefined) {
                    uWord = String(q.options[parseInt(userAnswer)]).trim();
                } else {
                    // Yeni format: kelime kaydedilmiş
                    uWord = String(userAnswer).trim();
                }
                isCorrect = uWord.toLowerCase() === cWord.toLowerCase();
                statsKey = uWord; // Her zaman kelime bazlı key
            } else if (q.type === 'true_false') {
                const uBool = userAnswer === true || userAnswer === 'true';
                const cBool = q.correct === true || q.correct === 'true';
                isCorrect = uBool === cBool;
                statsKey = uBool;
            }
            if (!optionStats[statsKey]) optionStats[statsKey] = [];
            optionStats[statsKey].push({ name: r.students?.name || 'İsimsiz', isCorrect });
            if (isCorrect) correctCount++;
        });

        const successRate = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
        return { q, qIdx, optionStats, correctCount, successRate, wrongCount: results.length - correctCount };
    });

    // Katılımcı satırları
    const participantRows = results.map(r => {
        const ans = (() => { try { return JSON.parse(r.answers || '{}'); } catch(e) { return {}; } })();
        const correct = ans.correctAnswers || 0;
        const total = ans.totalQuestions || questions.length;
        const statusColor = r.score >= 70 ? '#166534' : '#991b1b';
        const statusBg   = r.score >= 70 ? '#dcfce7'  : '#fee2e2';
        return `<tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:8px 10px; font-weight:600;">${r.students?.name || 'İsimsiz'}</td>
            <td style="padding:8px 10px; text-align:center; font-weight:700; color:${statusColor}; background:${statusBg}; border-radius:6px;">${r.score}%</td>
            <td style="padding:8px 10px; text-align:center; color:#166534; font-weight:600;">✓ ${correct}</td>
            <td style="padding:8px 10px; text-align:center; color:#991b1b; font-weight:600;">✗ ${total - correct}</td>
            <td style="padding:8px 10px; text-align:center; color:#6b7280; font-size:11px;">${new Date(r.completed_at).toLocaleDateString('tr-TR')}</td>
        </tr>`;
    }).join('');

    // Soru analiz kartları
    const questionCards = questionsAnalysis.map(({ q, qIdx, optionStats, correctCount, successRate }) => {
        const cardBorder = successRate >= 80 ? '#10b981' : successRate >= 50 ? '#f59e0b' : '#ef4444';
        const cardBg     = successRate >= 80 ? '#f0fdf4' : successRate >= 50 ? '#fffbeb' : '#fef2f2';
        const rateColor  = successRate >= 80 ? '#166534' : successRate >= 50 ? '#92400e' : '#991b1b';

        // Seçenek satırları
        let optionRows = '';
        const keys = Object.keys(optionStats);

        if (q.type === 'multiple_choice') {
            // Çoktan seçmeli: index bazlı
            (q.options || []).forEach((opt, i) => {
                const students = optionStats[i] || [];
                const pct = results.length > 0 ? Math.round((students.length / results.length) * 100) : 0;
                const isCorrect = parseInt(i) === parseInt(q.correct);
                const barColor = isCorrect ? '#10b981' : pct > 30 ? '#f59e0b' : '#9ca3af';
                const label = `${String.fromCharCode(65 + i)}) ${String(opt).replace(/^[A-Z]\)\s*/, '')}`;
                const names = students.map(s => s.name).join(', ');
                optionRows += `<tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:6px 8px; font-weight:${isCorrect ? '700' : '400'}; color:${isCorrect ? '#166534' : '#374151'};">${isCorrect ? '✓ ' : ''}${label}</td>
                    <td style="padding:6px 8px; text-align:center; font-weight:600;">${students.length} kişi (${pct}%)</td>
                    <td style="padding:6px 8px; width:120px;">
                        <div style="height:10px; background:#e5e7eb; border-radius:5px; overflow:hidden;">
                            <div style="height:10px; width:${pct}%; background:${barColor}; border-radius:5px;"></div>
                        </div>
                    </td>
                    <td style="padding:6px 8px; font-size:11px; color:#6b7280;">${names}</td>
                </tr>`;
            });
        } else if (q.type === 'true_false') {
            [true, false].forEach(val => {
                const students = optionStats[val] || [];
                const pct = results.length > 0 ? Math.round((students.length / results.length) * 100) : 0;
                const isCorrect = val === (q.correct === true || q.correct === 'true');
                const barColor = isCorrect ? '#10b981' : '#ef4444';
                const label = val ? 'Doğru' : 'Yanlış';
                const names = students.map(s => s.name).join(', ');
                optionRows += `<tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:6px 8px; font-weight:${isCorrect ? '700' : '400'}; color:${isCorrect ? '#166534' : '#374151'};">${isCorrect ? '✓ ' : ''}${label}</td>
                    <td style="padding:6px 8px; text-align:center; font-weight:600;">${students.length} kişi (${pct}%)</td>
                    <td style="padding:6px 8px; width:120px;">
                        <div style="height:10px; background:#e5e7eb; border-radius:5px; overflow:hidden;">
                            <div style="height:10px; width:${pct}%; background:${barColor}; border-radius:5px;"></div>
                        </div>
                    </td>
                    <td style="padding:6px 8px; font-size:11px; color:#6b7280;">${students.map(s => s.name).join(', ')}</td>
                </tr>`;
            });
        } else {
            // fill_blank: her zaman kelime bazlı
            const correctWord = String(q.correct).trim();
            // Doğru cevabı başa al, sonra diğer verilen cevaplar
            const otherKeys = Object.keys(optionStats).filter(k => k !== '(Boş)' && k.toLowerCase() !== correctWord.toLowerCase());
            const allKeys = [correctWord, ...otherKeys];
            allKeys.forEach(word => {
                // optionStats'ta bu kelimeyi case-insensitive ara
                const matchingKey = Object.keys(optionStats).find(k => k !== '(Boş)' && k.toLowerCase() === word.toLowerCase());
                const students = matchingKey ? optionStats[matchingKey] : [];
                const pct = results.length > 0 ? Math.round((students.length / results.length) * 100) : 0;
                const isCorrect = word.toLowerCase() === correctWord.toLowerCase();
                const barColor = isCorrect ? '#10b981' : '#ef4444';
                const names = students.map(s => s.name).join(', ');
                optionRows += `<tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:6px 8px; font-weight:${isCorrect ? '700' : '400'}; color:${isCorrect ? '#166534' : '#374151'};">${isCorrect ? '✓ ' : ''}${word}</td>
                    <td style="padding:6px 8px; text-align:center; font-weight:600;">${students.length} kişi (${pct}%)</td>
                    <td style="padding:6px 8px; width:120px;">
                        <div style="height:10px; background:#e5e7eb; border-radius:5px; overflow:hidden;">
                            <div style="height:10px; width:${pct}%; background:${barColor}; border-radius:5px;"></div>
                        </div>
                    </td>
                    <td style="padding:6px 8px; font-size:11px; color:#6b7280;">${names}</td>
                </tr>`;
            });
        }

        // Boş cevap varsa ekle
        if (optionStats['(Boş)']?.length > 0) {
            const students = optionStats['(Boş)'];
            const pct = results.length > 0 ? Math.round((students.length / results.length) * 100) : 0;
            optionRows += `<tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:6px 8px; color:#9ca3af; font-style:italic;">(Boş bırakıldı)</td>
                <td style="padding:6px 8px; text-align:center; font-weight:600; color:#9ca3af;">${students.length} kişi (${pct}%)</td>
                <td></td>
                <td style="padding:6px 8px; font-size:11px; color:#9ca3af;">${students.map(s => s.name).join(', ')}</td>
            </tr>`;
        }

        return `
        <div style="margin-bottom:20px; border:2px solid ${cardBorder}; border-radius:10px; overflow:hidden; background:${cardBg}; page-break-inside:avoid;">
            <div style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid ${cardBorder};">
                <div>
                    <span style="background:linear-gradient(135deg,#4f46e5,#7c3aed); color:white; padding:3px 10px; border-radius:4px; font-size:11px; font-weight:700; margin-right:8px;">Soru ${qIdx + 1}</span>
                    <span style="font-size:11px; color:#6b7280;">${typeLabel[q.type] || q.type}</span>
                </div>
                <span style="font-weight:700; color:${rateColor};">%${successRate} Başarı &nbsp;|&nbsp; ${correctCount}/${results.length} doğru</span>
            </div>
            <div style="padding:12px 16px;">
                <p style="margin:0 0 12px 0; font-weight:600; color:#1f2937; font-size:13px;">${(q.question || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead>
                        <tr style="background:#f3f4f6;">
                            <th style="padding:6px 8px; text-align:left; font-size:11px; color:#6b7280;">Cevap</th>
                            <th style="padding:6px 8px; text-align:center; font-size:11px; color:#6b7280;">Sayı</th>
                            <th style="padding:6px 8px; font-size:11px; color:#6b7280;">Dağılım</th>
                            <th style="padding:6px 8px; font-size:11px; color:#6b7280;">Öğrenciler</th>
                        </tr>
                    </thead>
                    <tbody>${optionRows}</tbody>
                </table>
            </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Test Analizi - ${test.title}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 30px; color: #1f2937; font-size: 13px; }
  h1 { margin:0 0 4px 0; font-size:20px; }
  @media print {
    .header { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page-break { page-break-before: always; }
  }
</style>
</head>
<body>

  <!-- Başlık -->
  <div class="header" style="background:linear-gradient(135deg,#4f46e5,#7c3aed); color:white; padding:24px; border-radius:12px; margin-bottom:24px;">
    <h1>📊 Test Analiz Raporu</h1>
    <p style="margin:4px 0 0 0; opacity:0.9; font-size:14px;"><strong>${test.title}</strong></p>
    <p style="margin:3px 0 0 0; opacity:0.8; font-size:12px;">Oluşturulma: ${new Date().toLocaleDateString('tr-TR', {year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
  </div>

  <!-- Özet İstatistikler -->
  <div style="display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap;">
    <div style="flex:1; min-width:100px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px; text-align:center;">
      <div style="font-size:28px; font-weight:800; color:#4f46e5;">${results.length}</div>
      <div style="font-size:11px; color:#6b7280; margin-top:3px;">Katılımcı</div>
    </div>
    <div style="flex:1; min-width:100px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px; text-align:center;">
      <div style="font-size:28px; font-weight:800; color:#0891b2;">${questions.length}</div>
      <div style="font-size:11px; color:#6b7280; margin-top:3px;">Soru Sayısı</div>
    </div>
    <div style="flex:1; min-width:100px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px; text-align:center;">
      <div style="font-size:28px; font-weight:800; color:#7c3aed;">${avgScore}</div>
      <div style="font-size:11px; color:#6b7280; margin-top:3px;">Ortalama Puan</div>
    </div>
    <div style="flex:1; min-width:100px; background:#dcfce7; border:1px solid #86efac; border-radius:10px; padding:14px; text-align:center;">
      <div style="font-size:28px; font-weight:800; color:#166534;">${passedCount}</div>
      <div style="font-size:11px; color:#166534; margin-top:3px;">Başarılı (≥70)</div>
    </div>
    <div style="flex:1; min-width:100px; background:#fee2e2; border:1px solid #fca5a5; border-radius:10px; padding:14px; text-align:center;">
      <div style="font-size:28px; font-weight:800; color:#991b1b;">${results.length - passedCount}</div>
      <div style="font-size:11px; color:#991b1b; margin-top:3px;">Başarısız (<70)</div>
    </div>
  </div>

  <!-- Katılımcı Tablosu -->
  <div style="margin-bottom:28px;">
    <h2 style="font-size:15px; font-weight:700; color:#1f2937; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid #4f46e5;">
      👥 Katılımcı Listesi
    </h2>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead>
        <tr style="background:linear-gradient(135deg,#4f46e5,#7c3aed); color:white;">
          <th style="padding:9px 10px; text-align:left;">Öğrenci</th>
          <th style="padding:9px 10px; text-align:center;">Puan</th>
          <th style="padding:9px 10px; text-align:center;">Doğru</th>
          <th style="padding:9px 10px; text-align:center;">Yanlış</th>
          <th style="padding:9px 10px; text-align:center;">Tarih</th>
        </tr>
      </thead>
      <tbody>${participantRows}</tbody>
    </table>
  </div>

  <!-- Soru Analizleri -->
  <div class="page-break">
    <h2 style="font-size:15px; font-weight:700; color:#1f2937; margin-bottom:16px; padding-bottom:6px; border-bottom:2px solid #4f46e5;">
      📋 Soru Bazında Analiz
    </h2>
    ${questionCards}
  </div>

  <div style="margin-top:28px; text-align:center; font-size:11px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:14px;">
    Türkçe Okuma Anlama Test Sistemi &nbsp;|&nbsp; ${test.title} &nbsp;|&nbsp; ${new Date().toLocaleDateString('tr-TR')}
  </div>

</body>
</html>`;

    const printWin = window.open('', '_blank');
    printWin.document.write(html);
    printWin.document.close();
    setTimeout(() => {
        printWin.print();
        showNotification('✅ PDF yazdırma penceresi açıldı!', 'success');
    }, 700);
}

// Global scope'a ekle
window.downloadAnalysisPDF = downloadAnalysisPDF;

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    // CSS ekle
    const styleTag = document.createElement('style');
    styleTag.textContent = analysisPanelStyles;
    document.head.appendChild(styleTag);
    
    // Modal HTML'i ekle
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = analysisModalTemplate;
    document.body.appendChild(modalContainer.firstElementChild);
});

// Modal dışında tıklandığında kapat
document.addEventListener('click', (e) => {
    const modal = document.getElementById('analysisModal');
    if (modal && e.target === modal) {
        closeAnalysisModal();
    }
});

// =============================================
// DAĞITIM TAKİBİ
// =============================================

// localStorage key
const DT_KEY = 'dagitimTakibi_v1';
const DT_OGRENCI_KEY = 'dagitimTakibi_ogrenciler_v1';

// Varsayılan öğrenci listesi (28 kişi - düzenlenebilir)
const VARSAYILAN_OGRENCILER = [
    'Öğrenci 1','Öğrenci 2','Öğrenci 3','Öğrenci 4','Öğrenci 5',
    'Öğrenci 6','Öğrenci 7','Öğrenci 8','Öğrenci 9','Öğrenci 10',
    'Öğrenci 11','Öğrenci 12','Öğrenci 13','Öğrenci 14','Öğrenci 15',
    'Öğrenci 16','Öğrenci 17','Öğrenci 18','Öğrenci 19','Öğrenci 20',
    'Öğrenci 21','Öğrenci 22','Öğrenci 23','Öğrenci 24','Öğrenci 25',
    'Öğrenci 26','Öğrenci 27','Öğrenci 28'
];

// { testId: [ogrenciAdi, ...] }
let dagitimVerisi = {};
let dagitimTestListesi = []; // { id, title }
let dagitimOgrenciler = [];
let dagitimFiltreli = [];
let dagitimAtamaVerisi = {}; // { testId: { studentName: 'bekliyor'|'basarili'|'dusuk' } }
let dagitimOgrenciIdMap = {}; // { ad: id }

function dagitimVeriYukle() {
    const raw = localStorage.getItem(DT_KEY);
    dagitimVerisi = raw ? JSON.parse(raw) : {};
}

function dagitimVeriKaydet() {
    localStorage.setItem(DT_KEY, JSON.stringify(dagitimVerisi));
}

function dagitimOgrencileriYukle() {
    const raw = localStorage.getItem(DT_OGRENCI_KEY);
    dagitimOgrenciler = raw ? JSON.parse(raw) : [...VARSAYILAN_OGRENCILER];
}

function dagitimOgrencileriKaydet() {
    localStorage.setItem(DT_OGRENCI_KEY, JSON.stringify(dagitimOgrenciler));
}

async function dagitimTakibiYukle() {
    dagitimVeriYukle();

    // Gerçek öğrenci isimlerini Supabase'den çek
    try {
        const { data: students, error } = await supabase
            .from('students')
            .select('id, name')
            .order('name');
        if (!error && students && students.length > 0) {
            dagitimOgrenciler = students.map(s => s.name);
            dagitimOgrenciIdMap = {};
            students.forEach(s => { dagitimOgrenciIdMap[s.name] = s.id; });
            dagitimOgrencileriKaydet();
        } else {
            dagitimOgrencileriYukle();
        }
    } catch(e) {
        dagitimOgrencileriYukle();
    }

    // Test listesini çek
    try {
        const { data: tests, error } = await supabase
            .from('tests')
            .select('id, title')
            .order('title', { ascending: true });
        if (error) throw error;
        dagitimTestListesi = tests || [];
    } catch(e) {
        if (window.allTestsData && allTestsData.length > 0) {
            dagitimTestListesi = allTestsData.map(t => ({ id: t.id, title: t.title }));
        } else {
            dagitimTestListesi = [];
        }
    }

    // Her test için atama durumunu çek — Test Atama Yönetimi ile aynı mantık:
    // students tablosunun tamamı baz alınır; her öğrenci için test_assignments ve test_results'a bakılır.
    try {
        const idToAd = {};
        Object.entries(dagitimOgrenciIdMap).forEach(([ad, id]) => { idToAd[Number(id)] = ad; });
        const ogrenciIdleri = Object.keys(idToAd).map(Number);

        dagitimAtamaVerisi = {};

        if (ogrenciIdleri.length > 0) {
            // Supabase varsayılan limiti 1000 satır — sayfalayarak tüm veriyi çek
            async function supabaseTumunuCek(tablo, kolonlar, studentIds) {
                const PAGE = 1000;
                let tumVeri = [];
                let sayfa = 0;
                while (true) {
                    const { data, error } = await supabase
                        .from(tablo)
                        .select(kolonlar)
                        .in('student_id', studentIds)
                        .range(sayfa * PAGE, (sayfa + 1) * PAGE - 1);
                    if (error) { console.error('[DagitimTakibi] sayfalama hatası:', tablo, error); break; }
                    if (!data || data.length === 0) break;
                    tumVeri = tumVeri.concat(data);
                    if (data.length < PAGE) break; // Son sayfa
                    sayfa++;
                }
                return tumVeri;
            }

            const assignments = await supabaseTumunuCek('test_assignments', 'test_id, student_id', ogrenciIdleri);
            const results     = await supabaseTumunuCek('test_results', 'test_id, student_id, score', ogrenciIdleri);

            console.log('[DagitimTakibi] assignments:', assignments.length, 'results:', results.length);

            // results hızlı lookup: "testId_studentId" -> score
            const resultsMap = {};
            (results || []).forEach(r => {
                resultsMap[`${r.test_id}_${r.student_id}`] = r.score;
            });

            // assignments hızlı lookup: "testId_studentId" -> true
            const assignedSet = new Set();
            (assignments || []).forEach(a => {
                assignedSet.add(`${a.test_id}_${a.student_id}`);
            });

            // Her test için her öğrenciye bak (Test Atama Yönetimi ile birebir aynı mantık)
            dagitimTestListesi.forEach(test => {
                const testAtamalar = {};
                ogrenciIdleri.forEach(sid => {
                    const key = `${test.id}_${sid}`;
                    const atandi = assignedSet.has(key);
                    if (!atandi) return; // Atanmamış → hiç gösterme
                    const ad = idToAd[sid];
                    if (!ad) return;
                    const score = resultsMap[key];
                    let durum;
                    if (score === undefined || score === null) {
                        durum = 'bekliyor';
                    } else if (score >= 70) {
                        durum = 'basarili';
                    } else {
                        durum = 'dusuk';
                    }
                    testAtamalar[ad] = durum;
                });
                if (Object.keys(testAtamalar).length > 0) {
                    dagitimAtamaVerisi[test.id] = testAtamalar;
                }
            });
        }
        console.log('[DagitimTakibi] atama verisi hazır:', Object.keys(dagitimAtamaVerisi).length, 'test');
    } catch(e) {
        console.error('[DagitimTakibi] hata:', e);
        dagitimAtamaVerisi = {};
    }
    dagitimOgrenciEtiketleriniGoster();
    dagitimOgrenciFiltereYukle();
    dagitimFiltreli = [...dagitimTestListesi];
    dagitimTabloyuRender(dagitimFiltreli);
    dagitimIstatistikleriGuncelle();
}

function dagitimOgrenciEtiketleriniGoster() {
    const kapsayici = document.getElementById('ogrenciEtiketleri');
    if (!kapsayici) return;
    kapsayici.innerHTML = dagitimOgrenciler.map(ad =>
        `<span class="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">${ad}</span>`
    ).join('');
    // Input alanını da güncelle
    const input = document.getElementById('ogrenciListesiInput');
    if (input) input.value = dagitimOgrenciler.join('\n');
}

function dagitimOgrenciFiltereYukle() {
    const sel = document.getElementById('dagitimOgrenciFiltre');
    if (!sel) return;
    sel.innerHTML = '<option value="hepsi">Tüm Öğrenciler</option>' +
        dagitimOgrenciler.map(ad => `<option value="${ad}">${ad}</option>`).join('');
}

function toggleOgrenciDuzenle() {
    const panel = document.getElementById('ogrenciDuzenlePanel');
    if (panel) panel.classList.toggle('hidden');
}

function ogrenciListesiKaydet() {
    const input = document.getElementById('ogrenciListesiInput');
    if (!input) return;
    const satirlar = input.value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    if (satirlar.length === 0) { alert('En az 1 öğrenci adı girin.'); return; }
    dagitimOgrenciler = satirlar;
    dagitimOgrencileriKaydet();
    dagitimOgrenciEtiketleriniGoster();
    dagitimOgrenciFiltereYukle();
    dagitimTabloyuRender(dagitimFiltreli);
    document.getElementById('ogrenciDuzenlePanel').classList.add('hidden');
}

function dagitimTabloyuRender(testler) {
    const tbody = document.getElementById('dagitimTakibiTablosu');
    const bosUyari = document.getElementById('dagitimBosUyari');
    if (!tbody) return;

    if (testler.length === 0) {
        tbody.innerHTML = '';
        if (bosUyari) bosUyari.classList.remove('hidden');
        return;
    }
    if (bosUyari) bosUyari.classList.add('hidden');

    tbody.innerHTML = testler.map((test, idx) => {
        const sistemAtamalari = dagitimAtamaVerisi[test.id] || {}; // { ad: durum }

        // Öğrenci rozet butonları
        const rozetler = dagitimOgrenciler.map(ad => {
            const sistemDurumu = sistemAtamalari[ad];

            let cls, title, icon, onclick;

            if (sistemDurumu === 'basarili') {
                cls = 'bg-green-500 text-white cursor-default';
                title = ad + ' — 🟢 Başarılı';
                icon = '🟢 ';
                onclick = '';
            } else if (sistemDurumu === 'dusuk') {
                cls = 'bg-red-400 text-white cursor-default';
                title = ad + ' — 🔴 Düşük Puan';
                icon = '🔴 ';
                onclick = '';
            } else if (sistemDurumu === 'bekliyor') {
                cls = 'bg-yellow-400 text-white cursor-default';
                title = ad + ' — 🟡 Bekliyor';
                icon = '🟡 ';
                onclick = '';
            } else {
                cls = 'bg-gray-100 text-gray-500 hover:bg-yellow-200 hover:text-yellow-800 cursor-pointer';
                title = ad + ' — Tıkla: testi ata (🟡 Bekliyor olur)';
                icon = '';
                onclick = 'onclick="dagitimAta(' + JSON.stringify(test.id) + ', ' + JSON.stringify(ad) + ')"';
            }

            const atanabilir = !sistemDurumu;
            const dataAttr = atanabilir ? 'data-dt-ata="1" data-test-id="' + test.id + '" data-ogrenci="' + ad.replace(/"/g, '&quot;') + '"' : '';
            return '<button ' + dataAttr + ' title="' + title.replace(/"/g,'&quot;') + '" class="px-2 py-0.5 rounded text-xs font-medium transition-all ' + cls + '">' + icon + ad + '</button>';
        }).join('');

        // Özet sayaçlar
        const bekleyenler = Object.values(sistemAtamalari).filter(d => d === 'bekliyor').length;
        const basarililar = Object.values(sistemAtamalari).filter(d => d === 'basarili').length;
        const dusukler = Object.values(sistemAtamalari).filter(d => d === 'dusuk').length;
        const ozet = [
            basarililar > 0 ? `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">🟢 ${basarililar}</span>` : '',
            dusukler > 0 ? `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">🔴 ${dusukler}</span>` : '',
            bekleyenler > 0 ? `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">🟡 ${bekleyenler}</span>` : '',
        ].filter(Boolean).join(' ') || '<span class="text-gray-300 text-xs">—</span>';

        return `<tr class="hover:bg-gray-50 transition">
            <td class="px-4 py-3 text-gray-400 text-xs">${idx + 1}</td>
            <td class="px-4 py-3 font-medium text-gray-800 max-w-xs">
                <div class="truncate" title="${test.title}">${test.title}</div>
            </td>
            <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">${rozetler}</div>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex flex-col gap-1 items-center">${ozet}</div>
            </td>
        </tr>`;
    }).join('');
}


// Event delegation — tablo üzerindeki tüm "ata" butonlarını yakala
document.addEventListener('click', async function(e) {
    const btn = e.target.closest('[data-dt-ata="1"]');
    if (!btn) return;
    const testId = Number(btn.dataset.testId);
    const ogrenciAdi = btn.dataset.ogrenci;
    if (!testId || !ogrenciAdi) return;

    const studentId = dagitimOgrenciIdMap[ogrenciAdi];
    if (!studentId) { showNotification('Öğrenci ID bulunamadı: ' + ogrenciAdi, 'error'); return; }

    // Butonu hemen devre dışı bırak
    btn.disabled = true;
    btn.textContent = '...';
    btn.className = btn.className.replace('bg-gray-100', 'bg-gray-300');

    console.log('[DagitimAta] testId:', testId, 'ogrenci:', ogrenciAdi, 'studentId:', studentId);

    try {
        const { error } = await supabase
            .from('test_assignments')
            .insert({
                test_id: testId,
                student_id: Number(studentId),
                assigned_at: new Date().toISOString()
            });

        console.log('[DagitimAta] sonuç:', error);

        if (error) {
            if (error.code === '23505') {
                showNotification('Bu öğrenciye test zaten atanmış.', 'warning');
            } else {
                throw error;
            }
        } else {
            showNotification(ogrenciAdi + ' adlı öğrenciye test atandı! 🟡', 'success');
            // Lokal veriyi güncelle → sarıya çevir
            if (!dagitimAtamaVerisi[testId]) dagitimAtamaVerisi[testId] = {};
            dagitimAtamaVerisi[testId][ogrenciAdi] = 'bekliyor';
            dagitimTabloyuRender(dagitimFiltreli);
            dagitimIstatistikleriGuncelle();
        }
    } catch(e) {
        console.error('[DagitimAta] hata:', e);
        showNotification('Hata: ' + (e.message || 'Bilinmeyen hata'), 'error');
        btn.disabled = false;
    }
});

function dagitimFiltrele() {
    const arama = (document.getElementById('dagitimArama')?.value || '').toLowerCase();
    const durum = document.getElementById('dagitimDurumFiltre')?.value || 'hepsi';
    const ogrenci = document.getElementById('dagitimOgrenciFiltre')?.value || 'hepsi';

    dagitimFiltreli = dagitimTestListesi.filter(test => {
        const baslik = (test.title || '').toLowerCase();

        if (arama && !baslik.includes(arama)) return false;
        const sistemAtamalar = dagitimAtamaVerisi[test.id] || {};
        const sistemAtananlar = Object.keys(sistemAtamalar);
        if (durum === 'atanan' && sistemAtananlar.length === 0) return false;
        if (durum === 'atanmayan' && sistemAtananlar.length > 0) return false;
        if (ogrenci !== 'hepsi' && !sistemAtananlar.includes(ogrenci)) return false;

        return true;
    });

    dagitimTabloyuRender(dagitimFiltreli);
}

function dagitimIstatistikleriGuncelle() {
    const toplam = dagitimTestListesi.length;
    // Sistemde en az 1 öğrenciye atanmış testler
    const sistemAtanan = dagitimTestListesi.filter(t => dagitimAtamaVerisi[t.id] && Object.keys(dagitimAtamaVerisi[t.id]).length > 0).length;
    const atanmayan = toplam - sistemAtanan;
    // Toplam sistem ataması
    const toplamAtama = Object.values(dagitimAtamaVerisi).reduce((s, obj) => s + Object.keys(obj).length, 0);

    const el = (id, val) => { const e = document.getElementById(id); if(e) e.textContent = val; };
    el('dtToplamTest', toplam);
    el('dtAtananTest', sistemAtanan);
    el('dtAtanmayanTest', atanmayan);
    el('dtToplamAtama', toplamAtama);
}

function dagitimSifirla() {
    if (!confirm('Manuel notlarınız (📌) silinecek. Sistem atamaları (🟢🔴🟡) etkilenmez. Emin misiniz?')) return;
    dagitimVerisi = {};
    dagitimVeriKaydet();
    dagitimTabloyuRender(dagitimFiltreli);
    dagitimIstatistikleriGuncelle();
}

function dagitimDışaAktar() {
    let csv = 'Test Adı,Başarılı,Düşük Puan,Bekliyor,Toplam Atanan\n';
    dagitimTestListesi.forEach(test => {
        const durumlar = dagitimAtamaVerisi[test.id] || {};
        const basarili = Object.values(durumlar).filter(d => d === 'basarili').length;
        const dusuk = Object.values(durumlar).filter(d => d === 'dusuk').length;
        const bekliyor = Object.values(durumlar).filter(d => d === 'bekliyor').length;
        const toplam = Object.keys(durumlar).length;
        csv += `"${test.title}",${basarili},${dusuk},${bekliyor},${toplam}\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dagitim_takibi.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════
// TOPLU OPTİK FORM SONUÇ YÜKLEME SİSTEMİ — v2
// ═══════════════════════════════════════════════════════

(function() {
    // XLSX kütüphanesini yükle
    if (!window.XLSX) {
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = function() {
            var el = document.getElementById('bulkXlsxStatus');
            if (el) { el.textContent = 'XLSX hazır ✓'; el.className = 'text-xs text-green-500'; }
        };
        s.onerror = function() {
            var el = document.getElementById('bulkXlsxStatus');
            if (el) { el.textContent = 'XLSX yüklenemedi!'; el.className = 'text-xs text-red-500'; }
        };
        document.head.appendChild(s);
    }
})();

var bulk2Sheets = [];
var bulk2ActiveSheet = 0;

function bulk2Log(msg, type) {
    var log = document.getElementById('bulk2Log');
    if (!log) return;
    var d = document.createElement('div');
    var colors = { ok: 'text-green-600', error: 'text-red-500', warn: 'text-yellow-600', info: 'text-gray-500' };
    var icons  = { ok: '✓', error: '✗', warn: '!', info: '→' };
    d.className = colors[type] || 'text-gray-500';
    d.textContent = (icons[type] || '→') + ' ' + msg;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
}

function bulk2Reset() {
    bulk2Sheets = [];
    bulk2ActiveSheet = 0;
    var inp = document.getElementById('bulkExcelInput');
    if (inp) inp.value = '';
    var lbl = document.getElementById('bulkFileNameLabel');
    if (lbl) lbl.textContent = 'Dosya seçilmedi';
    ['bulk2', 'bulk2Progress', 'bulk2Result', 'bulk2Match'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    var nameEl = document.getElementById('bulk2TestName');
    if (nameEl) nameEl.value = '';
    var tabsEl = document.getElementById('bulk2Tabs');
    if (tabsEl) tabsEl.innerHTML = '';
}

function bulk2SwitchTab(idx) {
    bulk2ActiveSheet = idx;
    document.querySelectorAll('[id^="bulk2Tab_"]').forEach(function(btn, i) {
        btn.className = 'px-3 py-1.5 rounded-full text-sm font-semibold transition ' +
            (i === idx ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-100');
    });
    bulk2RenderTable(idx);
}

function bulk2RenderTable(idx) {
    var sheet = bulk2Sheets[idx];
    if (!sheet) return;

    // Kaç soru var? (ilk satırdan bul)
    var maxSoru = 0;
    sheet.rows.forEach(function(r) { if (r.soruAnaliz && r.soruAnaliz.length > maxSoru) maxSoru = r.soruAnaliz.length; });

    // Başlık
    var headHtml = '<tr><th class="px-3 py-2 text-left">Numara</th><th class="px-3 py-2 text-left">Ad Soyad</th>' +
        '<th class="px-3 py-2 text-center">Sınıf</th><th class="px-3 py-2 text-center">D</th>' +
        '<th class="px-3 py-2 text-center">Y</th><th class="px-3 py-2 text-center">B</th>' +
        '<th class="px-3 py-2 text-center">Puan</th>';
    if (maxSoru > 0) {
        sheet.rows[0].soruAnaliz.forEach(function(s) {
            headHtml += '<th class="px-2 py-2 text-center text-xs text-gray-500">' + s.soruNo + '</th>';
        });
    }
    headHtml += '</tr>';
    document.getElementById('bulk2Head').innerHTML = headHtml;

    // Satırlar
    document.getElementById('bulk2Body').innerHTML = sheet.rows.map(function(r) {
        var cls = r.puan >= 70 ? 'bg-green-100 text-green-800' : r.puan >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
        var html = '<tr class="hover:bg-gray-50">' +
            '<td class="px-3 py-1.5 font-mono text-xs text-gray-600">' + r.numara + '</td>' +
            '<td class="px-3 py-1.5 text-sm">' + r.adSoyad + '</td>' +
            '<td class="px-3 py-1.5 text-center text-xs">' + r.sinif + '</td>' +
            '<td class="px-3 py-1.5 text-center text-green-700 font-semibold">' + r.dogru + '</td>' +
            '<td class="px-3 py-1.5 text-center text-red-500">' + r.yanlis + '</td>' +
            '<td class="px-3 py-1.5 text-center text-gray-400">' + r.bos + '</td>' +
            '<td class="px-3 py-1.5 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-bold ' + cls + '">' + r.puan + '</span></td>';
        // Soru hücreleri
        (r.soruAnaliz || []).forEach(function(s) {
            var bg, icon, title;
            if (s.sonuc === 'dogru') {
                bg = 'bg-green-50 text-green-700';
                icon = '✓';
                title = s.dogruCevap;
            } else if (s.sonuc === 'yanlis') {
                bg = 'bg-red-50 text-red-600';
                icon = s.ogrenciCevap;
                title = 'Doğru: ' + s.dogruCevap + ' | Öğrenci: ' + s.ogrenciCevap;
            } else {
                bg = 'bg-gray-50 text-gray-400';
                icon = '—';
                title = 'Boş';
            }
            html += '<td class="px-1 py-1.5 text-center ' + bg + '" title="' + title + '">' +
                '<span class="text-xs font-bold">' + icon + '</span></td>';
        });
        html += '</tr>';
        return html;
    }).join('');
}

async function bulk2ShowMatch() {
    try {
        var res = await supabase.from('students').select('id, student_no');
        var sMap = {};
        (res.data || []).forEach(function(s) { sMap[String(s.student_no).trim()] = s.id; });
        var total = 0, matched = 0, unmatched = [];
        bulk2Sheets.forEach(function(sheet) {
            sheet.rows.forEach(function(row) {
                total++;
                if (sMap[String(row.numara).trim()]) { matched++; row._sid = sMap[String(row.numara).trim()]; }
                else { unmatched.push(row.numara + ' – ' + row.adSoyad); }
            });
        });
        var el = document.getElementById('bulk2Match');
        var ct = document.getElementById('bulk2MatchContent');
        el.classList.remove('hidden');
        ct.innerHTML = '<div class="flex gap-4 flex-wrap text-sm">' +
            '<span>Toplam: <strong>' + total + '</strong></span>' +
            '<span class="text-green-700">✅ Eşleşti: <strong>' + matched + '</strong></span>' +
            '<span class="text-red-600">❌ Eşleşmedi: <strong>' + unmatched.length + '</strong></span></div>' +
            (unmatched.length > 0
                ? '<details class="mt-2"><summary class="cursor-pointer text-red-600 text-xs font-medium">Eşleşmeyenleri gör</summary>' +
                  '<ul class="pl-4 text-xs text-red-400 mt-1">' + unmatched.map(function(u) { return '<li>• ' + u + '</li>'; }).join('') + '</ul>' +
                  '<p class="text-xs text-gray-400 mt-1">Eşleşmeyenler atlanır. Öğrenci Yönetimi\'nden kontrol edin.</p></details>'
                : '');
    } catch(e) { console.warn('Eşleştirme hatası:', e); }
}

async function bulk2HandleFile(event) {
    var file = event.target.files[0];
    if (!file) return;

    document.getElementById('bulkFileNameLabel').textContent = file.name;
    document.getElementById('bulk2TestName').value = file.name.replace(/\.(xlsx|xls)$/i, '');

    // XLSX hazır olana kadar bekle (maks 6 saniye)
    var waited = 0;
    while (!window.XLSX && waited < 30) {
        await new Promise(function(r) { setTimeout(r, 200); });
        waited++;
    }
    if (!window.XLSX) {
        alert('Excel kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.');
        return;
    }

    try {
        var arrayBuf = await file.arrayBuffer();
        var wb = window.XLSX.read(arrayBuf, { type: 'array' });
        bulk2Sheets = [];

        wb.SheetNames.forEach(function(sheetName) {
            var ws = wb.Sheets[sheetName];
            var raw = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

            // Başlık satırını bul (ilk 5 satırda 'Numara' sütunu ara)
            var headerRow = -1;
            for (var i = 0; i < Math.min(raw.length, 5); i++) {
                var cells = raw[i].map(function(c) { return String(c).trim(); });
                if (cells.indexOf('Numara') !== -1) { headerRow = i; break; }
            }
            if (headerRow === -1) return; // Bu sayfada geçerli başlık yok, atla

            var h = raw[headerRow].map(function(c) { return String(c).trim(); });
            var cN = h.indexOf('Numara');
            var cA = h.findIndex(function(x) { return x === 'Ad Soyad' || x === 'Adı Soyadı' || x === 'Ad' || x.includes('Ad'); });
            var cS = h.indexOf('Sınıf');
            // Yeni şablon: Doğru/Yanlış/Boş — eski şablon: D/Y/B
            var cD = h.indexOf('Doğru'); if (cD === -1) cD = h.indexOf('D');
            var cY = h.indexOf('Yanlış'); if (cY === -1) cY = h.indexOf('Y');
            var cB = h.indexOf('Boş'); if (cB === -1) cB = h.indexOf('B');
            var cNet = h.indexOf('Net');
            var cP = h.indexOf('Puan');
            var cR = h.indexOf('Sıralama');

            // Soru sütunlarını bul: başlığı sayısal olan sütunlar (1, 2, 3, ...)
            var questionCols = []; // [{col: idx, soruNo: 1}, ...]
            h.forEach(function(hdr, idx) {
                var n = parseInt(hdr);
                if (!isNaN(n) && n >= 1 && n <= 50 && String(n) === hdr) {
                    questionCols.push({ col: idx, soruNo: n });
                }
            });
            questionCols.sort(function(a, b) { return a.soruNo - b.soruNo; });

            var rows = [];
            for (var j = headerRow + 1; j < raw.length; j++) {
                var r = raw[j];
                var numara = String(r[cN] || '').trim();
                var adSoyad = cA >= 0 ? String(r[cA] || '').trim() : '';
                if (!numara || isNaN(parseInt(numara))) continue;

                // Soru bazlı analizi çözümle
                // Format: "DOĞRU-öğrenci" — DOĞRU büyük harf, öğrenci küçük harf (yanlış) veya büyük (doğru)
                // ".-" veya ".- " = bu soru testte yok, " - " = boş bıraktı
                var soruAnaliz = []; // [{soruNo, dogruCevap, ogrenciCevap, sonuc}]
                questionCols.forEach(function(qc) {
                    var cell = String(r[qc.col] || '').trim();
                    if (!cell || cell === '.-' || cell.startsWith('.-')) return; // Bu soru yok
                    var parts = cell.split('-');
                    if (parts.length < 2) return;
                    var dogruCevap = parts[0].trim();   // Büyük harf
                    var ogrenciCevap = parts[1].trim(); // Büyük=doğru, küçük=yanlış, boş=boş
                    var sonuc;
                    if (!ogrenciCevap || ogrenciCevap === ' ' || ogrenciCevap === '') {
                        sonuc = 'bos';
                        ogrenciCevap = '';
                    } else if (ogrenciCevap === ogrenciCevap.toUpperCase()) {
                        sonuc = 'dogru';
                    } else {
                        sonuc = 'yanlis';
                        ogrenciCevap = ogrenciCevap.toUpperCase(); // normalize
                    }
                    soruAnaliz.push({
                        soruNo: qc.soruNo,
                        dogruCevap: dogruCevap,
                        ogrenciCevap: ogrenciCevap,
                        sonuc: sonuc
                    });
                });

                rows.push({
                    numara:     numara,
                    adSoyad:    adSoyad,
                    sinif:      cS >= 0 ? String(r[cS] || '').trim() : '',
                    dogru:      cD >= 0 ? (parseInt(r[cD]) || 0) : 0,
                    yanlis:     cY >= 0 ? (parseInt(r[cY]) || 0) : 0,
                    bos:        cB >= 0 ? (parseInt(r[cB]) || 0) : 0,
                    net:        cNet >= 0 ? (parseFloat(r[cNet]) || 0) : 0,
                    puan:       cP >= 0 ? Math.round(parseFloat(r[cP]) || 0) : 0,
                    siralama:   cR >= 0 ? String(r[cR] || '').trim() : '',
                    soruAnaliz: soruAnaliz
                });
            }
            if (rows.length > 0) bulk2Sheets.push({ sheetName: sheetName, rows: rows });
        });

        if (bulk2Sheets.length === 0) {
            alert('Geçerli veri bulunamadı.\n\nDosyanızda "Numara" başlıklı bir sütun var mı?\nSütun başlıkları ilk 5 satırda olmalıdır.');
            return;
        }

        // Sekmeleri oluştur
        document.getElementById('bulk2Tabs').innerHTML = bulk2Sheets.map(function(s, i) {
            return '<button id="bulk2Tab_' + i + '" onclick="bulk2SwitchTab(' + i + ')" class="px-3 py-1.5 rounded-full text-sm font-semibold transition ' +
                (i === 0 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-100') + '">📄 ' + s.sheetName +
                ' <span class="opacity-70">(' + s.rows.length + ')</span></button>';
        }).join('');

        bulk2RenderTable(0);
        await bulk2ShowMatch();
        document.getElementById('bulk2').classList.remove('hidden');

    } catch(err) {
        console.error('Excel okuma hatası:', err);
        alert('Excel okunurken hata: ' + err.message);
    }
}

async function bulk2Run() {
    var testName = document.getElementById('bulk2TestName').value.trim();
    var testType = document.getElementById('bulk2TestType').value;

    if (!testName) { alert('Lütfen test adını girin.'); document.getElementById('bulk2TestName').focus(); return; }
    if (!bulk2Sheets || bulk2Sheets.length === 0) { alert('Önce Excel dosyası seçin.'); return; }

    document.getElementById('bulk2').classList.add('hidden');
    document.getElementById('bulk2Progress').classList.remove('hidden');
    document.getElementById('bulk2Result').classList.add('hidden');
    document.getElementById('bulk2Log').innerHTML = '';

    var totalUploaded = 0, totalSkipped = 0, totalErrors = 0;

    bulk2Log('Öğrenci listesi alınıyor...', 'info');
    var stuRes = await supabase.from('students').select('id, student_no');
    if (stuRes.error) {
        bulk2Log('Öğrenci listesi alınamadı: ' + stuRes.error.message, 'error');
        bulk2ShowResult(false, stuRes.error.message, 0, 0, 1);
        return;
    }
    var sMap = {};
    (stuRes.data || []).forEach(function(s) { sMap[String(s.student_no).trim()] = s.id; });
    bulk2Log((stuRes.data || []).length + ' öğrenci yüklendi.', 'ok');

    for (var si = 0; si < bulk2Sheets.length; si++) {
        var sheet = bulk2Sheets[si];
        var sName = testName + ' - ' + sheet.sheetName;

        document.getElementById('bulk2Bar').style.width = Math.round((si / bulk2Sheets.length) * 85) + '%';
        document.getElementById('bulk2ProgressText').textContent = 'İşleniyor: ' + sheet.sheetName + ' (' + (si + 1) + '/' + bulk2Sheets.length + ')';
        bulk2Log('━━━ ' + sheet.sheetName + ' ━━━', 'info');

        // Aynı başlıkta test var mı?
        var existRes = await supabase.from('tests').select('id').eq('title', sName).maybeSingle();
        var testId = null;

        if (existRes.data && existRes.data.id) {
            testId = existRes.data.id;
            await supabase.from('tests').update({ test_type: testType, description: 'Optik form - ' + new Date().toLocaleDateString('tr-TR') }).eq('id', testId);
            bulk2Log('Mevcut test güncellendi (ID:' + testId + ')', 'ok');
        } else {
            var insRes = await supabase.from('tests').insert({
                title:             sName,
                description:       'Optik form - ' + new Date().toLocaleDateString('tr-TR'),
                reading_text:      '[Optik Form] ' + sName,
                questions:         JSON.stringify([]),
                text_display_mode: 'first_page_only',
                time_limit:        30,
                test_type:         testType,
                created_by:        (currentUser && currentUser.id) ? currentUser.id : null
            }).select('id').single();

            if (insRes.error) {
                bulk2Log('Test oluşturulamadı: ' + insRes.error.message + ' [' + insRes.error.code + ']', 'error');
                if (insRes.error.hint) bulk2Log('İpucu: ' + insRes.error.hint, 'warn');
                totalErrors++;
                continue;
            }
            testId = insRes.data.id;
            bulk2Log('Test oluşturuldu (ID:' + testId + ')', 'ok');
        }

        for (var ri = 0; ri < sheet.rows.length; ri++) {
            var row = sheet.rows[ri];
            var sid = sMap[String(row.numara).trim()];
            if (!sid) {
                bulk2Log(row.numara + ' [' + row.adSoyad + ']: eşleşmedi, atlandı.', 'warn');
                totalSkipped++;
                continue;
            }
            var upsRes = await supabase.from('test_results').upsert(
                {
                    test_id:      testId,
                    student_id:   sid,
                    score:        row.puan,
                    answers:      JSON.stringify({ dogru: row.dogru, yanlis: row.yanlis, bos: row.bos, net: row.net, siralama: row.siralama, kaynak: 'optik_form', soruAnaliz: row.soruAnaliz || [] }),
                    completed_at: new Date().toISOString()
                },
                { onConflict: 'test_id,student_id' }
            );
            if (upsRes.error) {
                bulk2Log(row.adSoyad + ': hata – ' + upsRes.error.message, 'error');
                totalErrors++;
            } else {
                // test_assignments kaydı oluştur (öğrenci ekranında ve liderlikte görünmesi için)
                await supabase.from('test_assignments').upsert(
                    { test_id: testId, student_id: sid, assigned_at: new Date().toISOString() },
                    { onConflict: 'test_id,student_id' }
                );
                bulk2Log(row.adSoyad + ': ' + row.puan + ' puan kaydedildi', 'ok');
                totalUploaded++;
            }
        }
    }

    document.getElementById('bulk2Bar').style.width = '100%';
    document.getElementById('bulk2ProgressText').textContent = 'Tamamlandı!';
    setTimeout(function() {
        document.getElementById('bulk2Progress').classList.add('hidden');
        bulk2ShowResult(true, null, totalUploaded, totalSkipped, totalErrors);
    }, 700);
}

function bulk2ShowResult(success, errMsg, uploaded, skipped, errors) {
    var section = document.getElementById('bulk2Result');
    var title   = document.getElementById('bulk2ResultTitle');
    var body    = document.getElementById('bulk2ResultBody');
    section.classList.remove('hidden');

    if (!success) {
        title.innerHTML = '<i class="fas fa-times-circle text-red-500 mr-2"></i>Yükleme Başarısız';
        body.innerHTML  = '<p class="text-red-600">' + errMsg + '</p>' +
            '<button onclick="document.getElementById(\'bulk2\').classList.remove(\'hidden\')" class="mt-3 px-4 py-2 bg-gray-100 rounded-lg text-sm">← Geri Dön</button>';
        return;
    }

    title.innerHTML = errors === 0
        ? '<i class="fas fa-check-circle text-green-500 mr-2"></i>Yükleme Tamamlandı!'
        : '<i class="fas fa-exclamation-triangle text-yellow-500 mr-2"></i>Yükleme Tamamlandı (bazı hatalar)';

    body.innerHTML =
        '<div class="grid grid-cols-3 gap-3 mb-4">' +
            '<div class="text-center p-3 bg-green-50 rounded-xl"><div class="text-2xl font-bold text-green-700">' + uploaded + '</div><div class="text-xs text-green-600">Kaydedildi</div></div>' +
            '<div class="text-center p-3 bg-yellow-50 rounded-xl"><div class="text-2xl font-bold text-yellow-700">' + skipped + '</div><div class="text-xs text-yellow-600">Atlandı</div></div>' +
            '<div class="text-center p-3 bg-red-50 rounded-xl"><div class="text-2xl font-bold text-red-700">' + errors + '</div><div class="text-xs text-red-600">Hata</div></div>' +
        '</div>' +
        '<p class="text-gray-500 text-sm mb-4">Sonuçlar öğrenci panellerinde ve Sınav Liderliği\'nde görünüyor.</p>' +
        '<div class="flex gap-3 flex-wrap">' +
            '<button onclick="showTeacherTab(\'sinavLiderligi\')" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition"><i class="fas fa-medal mr-1"></i>Sınav Liderliğini Gör</button>' +
            '<button onclick="bulk2Reset()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition"><i class="fas fa-upload mr-1"></i>Yeni Dosya Yükle</button>' +
        '</div>';
}

// Event bağlama — DOM hazır olduktan sonra
(function() {
    function bindBulkInput() {
        var inp = document.getElementById('bulkExcelInput');
        if (inp) {
            inp.addEventListener('change', bulk2HandleFile);
            var statusEl = document.getElementById('bulkXlsxStatus');
            if (window.XLSX && statusEl) { statusEl.textContent = 'XLSX hazır ✓'; statusEl.className = 'text-xs text-green-500'; }
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindBulkInput);
    } else {
        bindBulkInput();
    }
})();

// Global scope
window.bulk2HandleFile  = bulk2HandleFile;
window.bulk2Run         = bulk2Run;
window.bulk2Reset       = bulk2Reset;
window.bulk2SwitchTab   = bulk2SwitchTab;