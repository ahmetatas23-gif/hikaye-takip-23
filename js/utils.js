/**
 * utils.js — Modal açma/kapama ve küçük yardımcı fonksiyonlar
 */
/* ── Global olarak erişilmesi gereken fonksiyonlar ── */
    function showUploadTest() {
        document.getElementById('uploadTestModal').classList.remove('hidden');
    }
    function showAddStudent() {
        var m = document.getElementById('addStudentModal');
        if (m) m.classList.remove('hidden');
    }
    function closeModal(modalId) {
        var m = document.getElementById(modalId);
        if (m) m.classList.add('hidden');
    }
    function updateTestTypeLabels() {
        document.querySelectorAll('.test-type-label').forEach(function(label) {
            var radio = label.querySelector('input[type="radio"]');
            if (radio && radio.checked) {
                label.classList.add('border-blue-400', 'bg-blue-50');
                label.classList.remove('border-gray-200', 'bg-white');
            } else {
                label.classList.remove('border-blue-400', 'bg-blue-50');
                label.classList.add('border-gray-200', 'bg-white');
            }
        });
    }