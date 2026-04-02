/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              UI.JS — KULLANICI ARAYÜZÜ SİSTEMİ              ║
 * ║  • Toast bildirim sistemi (animasyonlu, kuyruklu)            ║
 * ║  • Loading overlay & skeleton screen yönetimi                ║
 * ║  • Çevrimdışı (offline) algılama ve uyarı                   ║
 * ║  • Hamburger menü kontrolü                                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

/* ══════════════════════════════════════════════════════════════════
   1. TOAST BİLDİRİM SİSTEMİ
   Mevcut showNotification()'ı tamamen değiştirir.
   Özellikler:
     - Sağ-alt köşeden slide-up animasyonuyla çıkar
     - Üst üste gelen bildirimler kuyrukta sıralanır
     - İlerleme çubuğuyla kalan süre gösterilir
     - Tıklanınca anında kapanır
     - Başarı/hata/uyarı/bilgi tipleri
   ══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── CSS enjeksiyonu ────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* Toast konteyneri */
    #toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column-reverse;
      gap: 10px;
      pointer-events: none;
      max-width: calc(100vw - 48px);
    }

    @media (max-width: 639px) {
      #toast-container {
        bottom: 16px;
        right: 12px;
        left: 12px;
      }
    }

    /* Toast kartı */
    .toast-card {
      pointer-events: all;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 14px;
      min-width: 280px;
      max-width: 380px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10);
      cursor: pointer;
      user-select: none;
      position: relative;
      overflow: hidden;
      animation: toastIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      transform-origin: bottom right;
      backdrop-filter: blur(8px);
    }

    @media (max-width: 639px) {
      .toast-card {
        min-width: unset;
        max-width: 100%;
        width: 100%;
      }
    }

    .toast-card.toast-out {
      animation: toastOut 0.22s ease-in forwards;
    }

    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px) scale(0.9); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }

    @keyframes toastOut {
      from { opacity: 1; transform: translateY(0)   scale(1); }
      to   { opacity: 0; transform: translateY(12px) scale(0.92); }
    }

    /* Toast tipleri */
    .toast-success { background: linear-gradient(135deg, #065f46 0%, #047857 100%); color: white; }
    .toast-error   { background: linear-gradient(135deg, #991b1b 0%, #b91c1c 100%); color: white; }
    .toast-warning { background: linear-gradient(135deg, #92400e 0%, #b45309 100%); color: white; }
    .toast-info    { background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); color: white; }

    /* İkon alanı */
    .toast-icon {
      font-size: 18px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* Metin alanı */
    .toast-body {
      flex: 1;
    }
    .toast-title {
      font-weight: 700;
      font-size: 13px;
      line-height: 1.3;
      margin-bottom: 2px;
    }
    .toast-message {
      font-size: 12px;
      opacity: 0.88;
      line-height: 1.4;
    }

    /* Kapat butonu */
    .toast-close {
      font-size: 16px;
      opacity: 0.6;
      flex-shrink: 0;
      line-height: 1;
      padding: 2px;
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      min-height: unset;
      min-width: unset;
    }
    .toast-close:hover { opacity: 1; }

    /* İlerleme çubuğu */
    .toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: rgba(255,255,255,0.45);
      border-radius: 0 0 14px 14px;
      animation: toastProgress linear forwards;
    }

    @keyframes toastProgress {
      from { width: 100%; }
      to   { width: 0%; }
    }

    /* ── Loading Overlay ── */
    #loading-overlay {
      position: fixed;
      inset: 0;
      background: rgba(255,255,255,0.82);
      backdrop-filter: blur(4px);
      z-index: 8888;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    }

    #loading-overlay.visible {
      opacity: 1;
      pointer-events: all;
    }

    .loading-spinner {
      width: 44px;
      height: 44px;
      border: 4px solid #e5e7eb;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-text {
      font-size: 14px;
      font-weight: 600;
      color: #4b5563;
    }

    /* ── Skeleton Screen ── */
    .skeleton {
      background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 8px;
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .skeleton-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }

    .skeleton-line {
      height: 14px;
      margin-bottom: 10px;
      border-radius: 6px;
    }
    .skeleton-line.short  { width: 40%; }
    .skeleton-line.medium { width: 65%; }
    .skeleton-line.full   { width: 100%; }
    .skeleton-title {
      height: 20px;
      width: 55%;
      margin-bottom: 14px;
      border-radius: 6px;
    }

    /* ── Offline Banner ── */
    #offline-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(90deg, #dc2626, #b91c1c);
      color: white;
      text-align: center;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transform: translateY(-100%);
      transition: transform 0.3s ease;
    }

    #offline-banner.visible {
      transform: translateY(0);
    }

    /* Offline banner görünürkende body aşağı kayar */
    body.is-offline {
      padding-top: 44px;
    }
  `;
  document.head.appendChild(style);

  // ── Toast Konteyneri oluştur ─────────────────────────────────────
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  // ── Konfigürasyon ────────────────────────────────────────────────
  const TOAST_CONFIG = {
    success : { icon: 'fa-check-circle',       label: 'Başarılı',  duration: 4000 },
    error   : { icon: 'fa-exclamation-circle', label: 'Hata',      duration: 6000 },
    warning : { icon: 'fa-exclamation-triangle',label: 'Uyarı',    duration: 5000 },
    info    : { icon: 'fa-info-circle',        label: 'Bilgi',     duration: 4000 },
  };

  /**
   * Toast bildirimi göster.
   * showNotification(message, type) imzasıyla geriye dönük uyumludur.
   *
   * @param {string} message   Mesaj metni
   * @param {string} type      'success' | 'error' | 'warning' | 'info'
   * @param {object} [opts]    { title?: string, duration?: number }
   */
  function showNotification(message, type = 'info', opts = {}) {
    const cfg      = TOAST_CONFIG[type] || TOAST_CONFIG.info;
    const duration = opts.duration || cfg.duration;
    const title    = opts.title   || cfg.label;

    // Toast elemanı
    const card = document.createElement('div');
    card.className = `toast-card toast-${type}`;
    card.setAttribute('role', 'alert');
    card.setAttribute('aria-live', 'assertive');

    card.innerHTML = `
      <div class="toast-icon"><i class="fas ${cfg.icon}"></i></div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" aria-label="Kapat">✕</button>
      <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
    `;

    // Kapat fonksiyonu
    const dismiss = () => {
      card.classList.add('toast-out');
      card.addEventListener('animationend', () => card.remove(), { once: true });
    };

    card.addEventListener('click', dismiss);
    card.querySelector('.toast-close').addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });

    toastContainer.appendChild(card);

    // Otomatik kapat
    setTimeout(dismiss, duration);

    return card;
  }

  // Global'e aktar — app.js'deki mevcut çağrılar otomatik bu versiyonu kullanır
  window.showNotification = showNotification;


  /* ══════════════════════════════════════════════════════════════
     2. LOADING OVERLAY & SKELETON YÖNETİMİ
     ══════════════════════════════════════════════════════════════ */

  // Loading overlay DOM elemanı
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text" id="loading-text">Yükleniyor...</div>
  `;
  document.body.appendChild(overlay);

  let loadingCount = 0;  // İç içe çağrıları destekler

  /**
   * Global loading overlay'i göster.
   * @param {string} [text]  Yükleme mesajı
   */
  function showLoading(text = 'Yükleniyor...') {
    loadingCount++;
    document.getElementById('loading-text').textContent = text;
    overlay.classList.add('visible');
  }

  /**
   * Global loading overlay'i gizle.
   * İç içe showLoading çağrıları için sayaç tutulur.
   */
  function hideLoading() {
    loadingCount = Math.max(0, loadingCount - 1);
    if (loadingCount === 0) {
      overlay.classList.remove('visible');
    }
  }

  /**
   * Bir async fonksiyonu loading göstererek çalıştırır, hata olursa toast gösterir.
   *
   * Kullanım:
   *   const data = await withLoading(
   *     () => supabase.from('tests').select('*'),
   *     'Testler yükleniyor...'
   *   );
   *
   * @param {Function} asyncFn   async fonksiyon
   * @param {string}   [text]    Yükleme mesajı
   * @returns {*}                asyncFn'nin return değeri ya da null (hata durumunda)
   */
  async function withLoading(asyncFn, text = 'Yükleniyor...') {
    showLoading(text);
    try {
      return await asyncFn();
    } catch (err) {
      console.error('[withLoading] Hata:', err);
      showNotification(err.message || 'Bir hata oluştu.', 'error');
      return null;
    } finally {
      hideLoading();
    }
  }

  /**
   * Bir konteynere skeleton (iskelet) yükleme kartları yerleştir.
   *
   * Kullanım:
   *   showSkeleton('testsContainer', 3);
   *   // ... veri gelince:
   *   hideSkeleton('testsContainer');
   *
   * @param {string} containerId  Konteyner elemanının ID'si
   * @param {number} [count=3]    Kaç skeleton kart gösterilsin
   */
  function showSkeleton(containerId, count = 3) {
    const el = document.getElementById(containerId);
    if (!el) return;

    // Mevcut içeriği sakla
    el._originalContent = el.innerHTML;

    el.innerHTML = Array.from({ length: count }, () => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line full"></div>
        <div class="skeleton skeleton-line medium"></div>
        <div class="skeleton skeleton-line short"></div>
      </div>
    `).join('');
  }

  /**
   * Skeleton'ı kaldır ve gerçek içeriği göster.
   * @param {string} containerId
   */
  function hideSkeleton(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    // Gerçek içerik zaten app.js tarafından innerHTML ile yazıldıysa bir şey yapma
    // Bu fonksiyon sadece skeleton'ı temizlemek için çağrılır
    if (el._originalContent !== undefined) {
      delete el._originalContent;
    }
  }

  // Global'e aktar
  window.showLoading  = showLoading;
  window.hideLoading  = hideLoading;
  window.withLoading  = withLoading;
  window.showSkeleton = showSkeleton;
  window.hideSkeleton = hideSkeleton;


  /* ══════════════════════════════════════════════════════════════
     3. ÇEVRİMDIŞI (OFFLINE) ALGILAMA
     ══════════════════════════════════════════════════════════════ */

  const offlineBanner = document.createElement('div');
  offlineBanner.id = 'offline-banner';
  offlineBanner.innerHTML = `
    <i class="fas fa-wifi"></i>
    <span>İnternet bağlantısı kesildi. Veriler güncel olmayabilir.</span>
  `;
  document.body.insertAdjacentElement('afterbegin', offlineBanner);

  function handleOnline() {
    offlineBanner.classList.remove('visible');
    document.body.classList.remove('is-offline');
    showNotification('İnternet bağlantısı yeniden kuruldu.', 'success', {
      title: 'Bağlantı Sağlandı',
      duration: 3000
    });
  }

  function handleOffline() {
    offlineBanner.classList.add('visible');
    document.body.classList.add('is-offline');
    showNotification(
      'İnternet bağlantınız kesildi. Testlere girmeyin, veri kaybı yaşanabilir.',
      'error',
      { title: 'Bağlantı Kesildi', duration: 8000 }
    );
  }

  // Sayfa açılışında kontrol
  if (!navigator.onLine) handleOffline();

  window.addEventListener('online',  handleOnline);
  window.addEventListener('offline', handleOffline);


  /* ══════════════════════════════════════════════════════════════
     4. SUPABASE HATA YAKALAMA KATMANI
     Mevcut supabase istemcisini sararak otomatik hata toast'ı gösterir.
     ══════════════════════════════════════════════════════════════ */

  /**
   * Supabase sorgusunu çalıştırır ve hata varsa toast gösterir.
   *
   * Kullanım (mevcut kodda değişiklik gerekmez, ek güvenlik katmanı):
   *   const { data, error } = await safeQuery(
   *     supabase.from('tests').select('*'),
   *     'Testler yüklenemedi'
   *   );
   *
   * @param {Promise}  queryPromise  Supabase query promise
   * @param {string}  [errMsg]       Özel hata mesajı
   * @returns {{ data: any, error: any }}
   */
  async function safeQuery(queryPromise, errMsg = null) {
    try {
      const result = await queryPromise;
      if (result.error) {
        const msg = errMsg
          ? `${errMsg}: ${result.error.message}`
          : result.error.message;
        console.error('[safeQuery]', msg, result.error);
        showNotification(msg, 'error');
      }
      return result;
    } catch (err) {
      const msg = errMsg ? `${errMsg}: ${err.message}` : err.message;
      console.error('[safeQuery] Beklenmeyen hata:', err);
      showNotification(msg || 'Beklenmeyen bir hata oluştu.', 'error');
      return { data: null, error: err };
    }
  }

  window.safeQuery = safeQuery;


  /* ══════════════════════════════════════════════════════════════
     5. HAMBURGER MENÜ KONTROLÜ
     DOM hazır olunca çalışır.
     ══════════════════════════════════════════════════════════════ */

  // ── Hamburger: event delegation — tek seferlik, her zaman çalışır ──────────
  // Butonlara tek tek bağlamak yerine document'e tek listener koyuyoruz.
  // Bu sayede dashboard hidden/visible olsa da, birden çok çağrılsa da sorun yok.

  document.addEventListener('click', function(e) {
    // 1. Hamburger butonuna tıklandı mı?
    var btn = e.target.closest('.hamburger-btn');
    if (btn) {
      e.stopPropagation();
      var targetId = btn.getAttribute('data-target');
      var wrapper  = targetId ? document.getElementById(targetId) : null;
      if (!wrapper) return;

      var isOpen = wrapper.classList.toggle('is-open');
      btn.classList.toggle('is-open', isOpen);
      btn.setAttribute('aria-expanded', String(isOpen));
      return;
    }

    // 2. Tab butonuna tıklandı mı? → menüyü kapat
    var tabBtn = e.target.closest('.tab-button, .teacher-tab-button');
    if (tabBtn) {
      // Eğer bir öğretmen sekmesi tıklandıysa, etiketi güncelle
      if (tabBtn.classList.contains('teacher-tab-button')) {
        var label = document.getElementById('teacherActiveTabLabel');
        if (label) label.textContent = tabBtn.textContent.trim();
      }

      document.querySelectorAll('.mobile-nav-wrapper.is-open').forEach(function(w) {
        w.classList.remove('is-open');
      });
      document.querySelectorAll('.hamburger-btn.is-open').forEach(function(b) {
        b.classList.remove('is-open');
        b.setAttribute('aria-expanded', 'false');
      });
      return;
    }

    // 3. Dışarı tıklandı mı? → açık menüleri kapat
    var openWrappers = document.querySelectorAll('.mobile-nav-wrapper.is-open');
    openWrappers.forEach(function(w) {
      if (!w.contains(e.target)) {
        w.classList.remove('is-open');
        // İlgili hamburger butonunu da kapat
        var id = w.id;
        document.querySelectorAll('.hamburger-btn[data-target="' + id + '"]').forEach(function(b) {
          b.classList.remove('is-open');
          b.setAttribute('aria-expanded', 'false');
        });
      }
    });
  });

  /* ══════════════════════════════════════════════════════════════
     6. PERFORMANS — LAZY IMAGE LOADING
     data-src ile işaretlenmiş görselleri IntersectionObserver ile yükle.
     Kullanım: <img data-src="foto.jpg" class="lazy" alt="...">
     ══════════════════════════════════════════════════════════════ */

  function initLazyImages() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    if (!lazyImages.length) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            img.classList.remove('lazy');
            observer.unobserve(img);
          }
        });
      }, { rootMargin: '200px' });

      lazyImages.forEach(img => observer.observe(img));
    } else {
      // Fallback: direkt yükle
      lazyImages.forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyImages);
  } else {
    initLazyImages();
  }

  // ── Dışa aktar ─────────────────────────────────────────────────
  console.log('[ui.js] ✅ UI sistemi yüklendi — Toast, Loading, Offline, Hamburger aktif');

})();
