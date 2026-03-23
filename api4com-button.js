/**
 * ============================================================
 *  Api4com Click-to-Call — GHL Whitelabel v5.1
 *
 *  INSTALAÇÃO:
 *  Settings > Whitelabel > Custom Scripts:
 *  <script src="https://tobiasgtn.github.io/api4com-button/api4com-ghl.js"></script>
 *
 *  v5.1: Botão único compacto (ícone telefone)
 * ============================================================
 */

(function () {
  'use strict';

  const WEBPHONE_BASE = 'https://tobiasgtn.github.io/api4com-button/webphone.html';
  const BTN_ID        = 'api4com-btn';

  let popupRef = null;

  /* ─── Página relevante ─── */
  function isRelevantPage() {
    return location.href.includes('/conversations') || location.href.includes('/contacts');
  }

  /* ─── Extração de telefone ─── */
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

  /* ─── Popup ─── */
  function isPopupOpen() { return popupRef && !popupRef.closed; }

  function openWebphone(phone) {
    const w = 380, h = 620;
    const left = window.screenX + window.outerWidth - w - 40;
    const top  = window.screenY + 80;
    const features = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no`;

    if (isPopupOpen()) {
      popupRef.focus();
      if (phone) popupRef.postMessage({ type: 'api4com:dial', phone }, '*');
    } else {
      const url = phone
        ? WEBPHONE_BASE + '?phone=' + encodeURIComponent(phone)
        : WEBPHONE_BASE;
      popupRef = window.open(url, 'api4com_webphone', features);
    }
  }

  /* ─── Botão compacto ─── */
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
    if (document.getElementById(BTN_ID)) return;
    const anchor = findAnchor();
    if (!anchor) return;

    const h = anchor.offsetHeight || 32;
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    Object.assign(btn.style, {
      display:        'inline-flex',
      alignItems:     'center',
      justifyContent: 'center',
      width:          h + 'px',
      height:         h + 'px',
      borderRadius:   '8px',
      background:     'linear-gradient(135deg,#1e3a8a,#2563eb)',
      color:          '#fff',
      border:         'none',
      cursor:         'pointer',
      marginRight:    '8px',
      verticalAlign:  'middle',
      flexShrink:     '0',
      boxShadow:      '0 2px 8px rgba(37,99,235,0.35)',
      transition:     'filter 0.15s',
    });
    btn.title = 'Api4com — Ligar';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
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
    `;
    btn.addEventListener('mouseenter', () => btn.style.filter = 'brightness(1.15)');
    btn.addEventListener('mouseleave', () => btn.style.filter = 'brightness(1)');
    btn.addEventListener('click', () => {
      const phone = extractPhone();
      openWebphone(phone);
    });

    anchor.parentNode.insertBefore(btn, anchor);
    console.log('[Api4com v5.1] Botão injetado ✓');
  }

  function removeButton() {
    const el = document.getElementById(BTN_ID);
    if (el) el.remove();
  }

  /* ─── SPA Observer ─── */
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
    if (location.href !== lastUrl) { lastUrl = location.href; removeButton(); schedule(); return; }
    if (isRelevantPage() && !document.getElementById(BTN_ID)) schedule();
  }).observe(document.body, { childList: true, subtree: true });

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', () => { if (isRelevantPage()) injectButton(); })
    : (isRelevantPage() && injectButton());

  console.log('[Api4com GHL] v5.1 ✓');
})();
