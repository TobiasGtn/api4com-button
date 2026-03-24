/**
 * ============================================================
 *  Api4com Click-to-Call — GHL Whitelabel v5.3
 *
 *  INSTALAÇÃO:
 *  Settings > Whitelabel > Custom Scripts:
 *  <script src="https://tobiasgtn.github.io/api4com-button/api4com-ghl.js"></script>
 *
 *  v5.2: Intercepta o botão nativo de ligar do GHL
 *        - 1 número: intercepta clique e abre webphone
 *        - 2+ números: deixa dropdown abrir, intercepta botões "Ligação"
 *        - Sem número visível: abre webphone vazio
 * ============================================================
 */

(function () {
  'use strict';

  const WEBPHONE_BASE = 'https://tobiasgtn.github.io/api4com-button/webphone.html';
  let popupRef = null;
  let bypassNextClick = false;

  /* ─── Popup ─── */
  function isPopupOpen() { return popupRef && !popupRef.closed; }

  function openWebphone(phone) {
    const w = 380, h = 620;
    const left = window.screenX + window.outerWidth - w - 40;
    const top  = window.screenY + 80;
    const features = 'width=' + w + ',height=' + h
      + ',left=' + left + ',top=' + top
      + ',resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no';

    if (isPopupOpen()) {
      popupRef.focus();
      if (phone) popupRef.postMessage({ type: 'api4com:dial', phone: phone }, '*');
    } else {
      const url = phone
        ? WEBPHONE_BASE + '?phone=' + encodeURIComponent(phone)
        : WEBPHONE_BASE;
      popupRef = window.open(url, 'api4com_webphone', features);
    }
  }

  /* ─── Extração de telefone do DOM ─── */
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

  function extractPhoneFromText(text) {
    if (!text) return null;
    const cleaned = text.replace(/\(Mobile\)|\(Home\)|\(Work\)|\(Other\)/gi, '').trim();
    return sanitize(cleaned);
  }

  /* ─── Detectar se contato tem múltiplos números ─── */
  function hasMultipleNumbers() {
    // O botão nativo tem uma seta (chevron/caret) quando há múltiplos números
    const btn = document.getElementById('phone-calls');
    if (!btn) return false;
    const parent = btn.parentElement;
    if (!parent) return false;
    // Verifica se tem SVG de seta/dropdown próximo ao botão
    const siblings = parent.querySelectorAll('svg');
    // Se o container do botão tem mais de 1 SVG, provavelmente tem a seta de dropdown
    if (siblings.length > 1) return true;
    // Também verifica se tem um botão de dropdown ao lado
    const dropdownArrow = parent.querySelector('[class*="chevron"], [class*="arrow"], [class*="caret"]');
    if (dropdownArrow) return true;
    return false;
  }

  /* ─── Interceptar botão nativo #phone-calls ─── */
  function hijackNativeButton() {
    const btn = document.getElementById('phone-calls');
    if (!btn || btn.dataset.api4comHijacked) return;

    btn.addEventListener('click', function (e) {
      // Se é um clique de bypass (nós mesmos disparamos), deixa passar
      if (bypassNextClick) {
        bypassNextClick = false;
        return;
      }

      // Tenta extrair telefone do DOM
      const phone = extractPhone();

      if (phone) {
        // Encontrou número → bloqueia clique nativo e abre webphone
        e.stopImmediatePropagation();
        e.preventDefault();
        openWebphone(phone);
      } else {
        // Não encontrou número → deixa o clique passar para abrir o dropdown
        // O MutationObserver vai interceptar os botões "Ligação" do dropdown
        console.log('[Api4com v5.2] Número não encontrado, aguardando dropdown...');
      }
    }, true); // capture phase

    btn.dataset.api4comHijacked = 'true';
    console.log('[Api4com v5.2] Botão nativo interceptado ✓');
  }

  /* ─── Interceptar dropdown de múltiplos números ─── */
  function hijackDropdownButtons() {
    // Busca popovers/dropdowns visíveis
    const popovers = document.querySelectorAll(
      '.hr-popover, [class*="hr-popover"], [class*="follower-container"], [class*="popover"]'
    );

    popovers.forEach(popover => {
      const buttons = popover.querySelectorAll('button');
      buttons.forEach(btn => {
        if (btn.dataset.api4comHijacked) return;
        const text = btn.innerText || btn.textContent || '';
        if (!text.includes('Ligação') && !text.includes('Call')) return;

        btn.addEventListener('click', function (e) {
          e.stopImmediatePropagation();
          e.preventDefault();

          // Busca o número no mesmo container/row
          let phone = null;
          const row = btn.closest('.flex, [class*="justify"], [class*="py-2"]');
          if (row) {
            // Busca spans/textos no row que contenham número
            const textEls = row.querySelectorAll('span, p, div');
            for (const s of textEls) {
              const t = s.textContent.trim();
              // Ignora o próprio botão
              if (t === 'Ligação' || t === 'Call') continue;
              const p = extractPhoneFromText(t);
              if (p) { phone = p; break; }
            }
            // Fallback: tenta no texto inteiro do row
            if (!phone) {
              const rowText = row.textContent.replace('Ligação', '').replace('Call', '');
              phone = extractPhoneFromText(rowText);
            }
          }

          openWebphone(phone);

          // Fecha o popover
          setTimeout(() => document.body.click(), 100);
        }, true);

        btn.dataset.api4comHijacked = 'true';
        console.log('[Api4com v5.2] Botão dropdown "Ligação" interceptado ✓');
      });
    });
  }

  /* ─── Observer para SPA + dropdowns ─── */
  let lastUrl = location.href;

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
    }

    // Re-hijack botão nativo se reapareceu
    const btn = document.getElementById('phone-calls');
    if (btn && !btn.dataset.api4comHijacked) {
      hijackNativeButton();
    }

    // Intercepta botões "Ligação" em dropdowns que apareçam
    hijackDropdownButtons();

  }).observe(document.body, { childList: true, subtree: true });

  // Init
  function init() {
    hijackNativeButton();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

  console.log('[Api4com GHL] v5.3 — Native button intercept ✓');
})();
