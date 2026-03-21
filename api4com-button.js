/**
 * ============================================================
 *  Api4com Click-to-Call — GHL Whitelabel v5.0
 *
 *  INSTALAÇÃO:
 *  Settings > Whitelabel > Custom Scripts:
 *  <script src="https://tobiasgtn.github.io/api4com-button/api4com-ghl.js"></script>
 *
 *  MUDANÇAS v5.0:
 *  - Abre webphone.html como popup (janela separada)
 *  - Login com email/senha da Api4com (busca ramal automaticamente)
 *  - Chamada SIP direta pelo navegador via libwebphone.js
 *  - Sem dependência da extensão Chrome Api4com
 *  - Comunicação GHL ↔ Popup via postMessage
 * ============================================================
 */

(function () {
  'use strict';

  /* ─── Config ─────────────────────────────────────────────── */
  const WEBPHONE_BASE = 'https://tobiasgtn.github.io/api4com-button/webphone.html';
  const WRAP_ID       = 'api4com-btn-wrap';

  let popupRef = null;

  /* ─── Página relevante ───────────────────────────────────── */
  function isRelevantPage() {
    return location.href.includes('/conversations') || location.href.includes('/contacts');
  }

  /* ─── Extração de telefone ───────────────────────────────── */
  function extractPhone() {
    const telLink = document.querySelector('a[href^="tel:"]');
    if (telLink) { const p = sanitize(telLink.href.replace('tel:', '')); if (p) return p; }

    const telInput = document.querySelector('input[type="tel"]');
    if (telInput?.value) { const p = sanitize(telInput.value); if (p) return p; }

    const labelKeywords = ['telefone', 'phone', 'celular', 'mobile', 'fone', 'whatsapp'];
    for (const el of document.querySelectorAll('label, span, p, div, td, th')) {
      if (!labelKeywords.includes(el.textContent.trim().toLowerCase())) continue;
      const candidates = [
        el.nextElementSibling,
        el.parentElement?.nextElementSibling,
        el.closest('tr')?.nextElementSibling,
      ].filter(Boolean);
      for (const c of candidates) {
        const p = extractBR(c.textContent);
        if (p) return p;
      }
    }

    const match = (document.body.innerText || '').match(/\+55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/);
    if (match) { const p = sanitize(match[0]); if (p) return p; }

    return null;
  }

  function extractBR(text) {
    if (!text) return null;
    if (/^\s*\d{1,3}\s*$/.test(text)) return null;
    if (/^\s*\d{1,2}:\d{2}(\s*(AM|PM))?\s*$/.test(text)) return null;
    const patterns = [
      /\+55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/,
      /\(?\d{2}\)?\s?\d{5}[-\s]?\d{4}/,
      /\(?\d{2}\)?\s?\d{4}[-\s]?\d{4}/,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const d = m[0].replace(/\D/g, '');
        if (d.length >= 10 && d.length <= 13) return sanitize(m[0]);
      }
    }
    return null;
  }

  function sanitize(raw) {
    if (!raw) return null;
    let n = raw.replace(/[^\d+]/g, '');
    if (!n.startsWith('+')) {
      if (n.startsWith('55') && n.length >= 12) n = '+' + n;
      else if (n.length === 10 || n.length === 11) n = '+55' + n;
    }
    return (n.startsWith('+') && n.length >= 12 && n.length <= 14) ? n : null;
  }

  /* ─── Popup management ──────────────────────────────────── */
  function isPopupOpen() {
    return popupRef && !popupRef.closed;
  }

  function openWebphone(phone) {
    const w = 360;
    const h = 520;
    const left = window.screenX + window.outerWidth - w - 40;
    const top  = window.screenY + 80;
    const features = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no`;

    if (isPopupOpen()) {
      // Popup already open — send phone via postMessage
      popupRef.focus();
      if (phone) {
        popupRef.postMessage({ type: 'api4com:dial', phone: phone }, '*');
      }
    } else {
      // Open new popup with phone in URL
      const url = phone
        ? WEBPHONE_BASE + '?phone=' + encodeURIComponent(phone)
        : WEBPHONE_BASE;
      popupRef = window.open(url, 'api4com_webphone', features);
    }
  }

  /* ─── Listen for messages from popup ─────────────────────── */
  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    // Future: update button status based on popup state
    if (e.data.type === 'api4com:status') {
      updateButtonStatus(e.data.state);
    }
  });

  function updateButtonStatus(sipState) {
    const dot = document.getElementById('api4com-status-dot');
    if (!dot) return;
    dot.style.background = sipState === 'registered' ? '#22c55e' : '#6b7280';
  }

  /* ─── Toast ──────────────────────────────────────────────── */
  function showToast(msg, type) {
    const colors = { info: '#2563eb', success: '#16a34a', error: '#dc2626' };
    let t = document.getElementById('api4com-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'api4com-toast';
      document.body.appendChild(t);
    }
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', left: '50%',
      transform: 'translateX(-50%)',
      background: colors[type] || colors.info,
      color: '#fff', padding: '10px 20px',
      borderRadius: '10px', fontSize: '13px',
      fontFamily: 'system-ui,sans-serif', fontWeight: '500',
      boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
      zIndex: '2147483647', opacity: '1',
      transition: 'opacity 0.4s', pointerEvents: 'none',
    });
    t.textContent = msg;
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.style.opacity = '0'; }, 4500);
  }

  /* ─── Botão split [📞 Ligar | ⚙️] ───────────────────────── */
  function findAnchor() {
    for (const btn of document.querySelectorAll('button')) {
      const text = btn.textContent.trim();
      if (text === 'Call' || text.endsWith('Call')) {
        const rgb = window.getComputedStyle(btn).backgroundColor.match(/\d+/g);
        if (rgb) {
          const [r, g, b] = rgb.map(Number);
          if (g > r && g > b && g > 80) return btn;
        }
      }
    }
    return document.querySelector('button[id*="call"],button[class*="call"],button[id*="wa-"]');
  }

  function injectButton() {
    if (document.getElementById(WRAP_ID)) return;
    const anchor = findAnchor();
    if (!anchor) return;

    const h = anchor.offsetHeight || 32;

    const wrap = document.createElement('div');
    wrap.id = WRAP_ID;
    Object.assign(wrap.style, {
      display:       'inline-flex',
      alignItems:    'center',
      height:        h + 'px',
      borderRadius:  '8px',
      overflow:      'hidden',
      boxShadow:     '0 2px 8px rgba(37,99,235,0.35)',
      marginRight:   '8px',
      verticalAlign: 'middle',
      flexShrink:    '0',
    });

    /* Parte esquerda: Ligar */
    const dialPart = document.createElement('button');
    Object.assign(dialPart.style, {
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '6px',
      padding:       '0 14px',
      height:        '100%',
      background:    'linear-gradient(135deg,#1e3a8a,#2563eb)',
      color:         '#fff',
      border:        'none',
      borderRight:   '1px solid rgba(255,255,255,0.2)',
      fontSize:      '13px',
      fontWeight:    '600',
      fontFamily:    'system-ui,-apple-system,sans-serif',
      cursor:        'pointer',
      whiteSpace:    'nowrap',
      letterSpacing: '0.2px',
      transition:    'filter 0.15s',
    });
    dialPart.innerHTML = `
      <span id="api4com-status-dot" style="width:6px;height:6px;border-radius:50%;
        background:#6b7280;flex-shrink:0;"></span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
        <path d="M22 16.92v3a2 2 0 01-2.18 2
                 19.79 19.79 0 01-8.63-3.07
                 A19.5 19.5 0 013.07 9.81
                 a19.79 19.79 0 01-3.07-8.67
                 A2 2 0 012 .91h3a2 2 0 012 1.72
                 c.127.96.361 1.903.7 2.81
                 a2 2 0 01-.45 2.11L6.09 8.91
                 a16 16 0 006 6l1.27-1.27
                 a2 2 0 012.11-.45
                 c.907.339 1.85.573 2.81.7
                 A2 2 0 0122 16.92z"/>
      </svg>
      Ligar
    `;
    dialPart.addEventListener('mouseenter', () => dialPart.style.filter = 'brightness(1.15)');
    dialPart.addEventListener('mouseleave', () => dialPart.style.filter = 'brightness(1)');
    dialPart.addEventListener('click', () => {
      const phone = extractPhone();
      if (!phone) {
        showToast('⚠️ Telefone não encontrado nesta tela.', 'error');
        console.warn('[Api4com] Debug:', {
          telLinks: document.querySelectorAll('a[href^="tel:"]').length,
          telInputs: document.querySelectorAll('input[type="tel"]').length,
        });
        // Open popup anyway (user can type number)
        openWebphone(null);
        return;
      }
      openWebphone(phone);
    });

    /* Parte direita: abrir webphone */
    const cfgPart = document.createElement('button');
    Object.assign(cfgPart.style, {
      display:        'inline-flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '0 10px',
      height:         '100%',
      background:     'linear-gradient(135deg,#1e3a8a,#2563eb)',
      color:          '#fff',
      border:         'none',
      cursor:         'pointer',
      transition:     'filter 0.15s',
    });
    cfgPart.title = 'Abrir Webphone Api4com';
    cfgPart.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.2"
           stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    `;
    cfgPart.addEventListener('mouseenter', () => cfgPart.style.filter = 'brightness(1.15)');
    cfgPart.addEventListener('mouseleave', () => cfgPart.style.filter = 'brightness(1)');
    cfgPart.addEventListener('click', () => openWebphone(null));

    wrap.appendChild(dialPart);
    wrap.appendChild(cfgPart);
    anchor.parentNode.insertBefore(wrap, anchor);
    console.log('[Api4com v5.0] Botão injetado ✓');
  }

  function removeButton() {
    const el = document.getElementById(WRAP_ID);
    if (el) el.remove();
  }

  /* ─── SPA Observer + Init ────────────────────────────────── */
  let lastUrl = location.href;
  let timer   = null;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (isRelevantPage()) injectButton();
      else removeButton();
    }, 800);
  }

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href; removeButton(); schedule(); return;
    }
    if (isRelevantPage() && !document.getElementById(WRAP_ID)) schedule();
  }).observe(document.body, { childList: true, subtree: true });

  function init() {
    if (isRelevantPage()) injectButton();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

  console.log('[Api4com GHL] v5.0 — Webphone mode ✓');
})();
