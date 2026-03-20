/**
 * ============================================================
 *  Api4com Click-to-Call — Integração GHL Whitelabel v3.3
 *
 *  INSTALAÇÃO:
 *  Settings > Whitelabel > Custom Scripts:
 *  <script src="https://SEU-DOMINIO/api4com-ghl.js"></script>
 * ============================================================
 */

(function () {
  'use strict';

  const STORAGE_KEY  = 'api4com_cfg_v1';
  const API_BASE     = 'https://api.api4com.com/api/v1';
  const BTN_ID       = 'api4com-dial-btn';
  const CFG_BTN_ID   = 'api4com-cfg-btn';

  /* ─── Config (localStorage) ─────────────────────────────── */
  function getConfig() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }
  function isConfigured() {
    const c = getConfig();
    return !!(c.extension);
  }

  /* ─── Detecção de página relevante ──────────────────────── */
  function isRelevantPage() {
    const url = location.href;
    return url.includes('/conversations') || url.includes('/contacts');
  }

  /* ─── Extração de telefone (corrigida) ───────────────────
   *
   *  Estratégias em ordem de confiabilidade:
   *  1. Links <a href="tel:..."> — mais confiável
   *  2. <input type="tel"> com valor preenchido
   *  3. Campos rotulados como "Telefone / Phone / Celular"
   *  4. Texto com formato E.164 explícito (+55...)
   *
   *  O que NÃO fazemos mais:
   *  - Varrer todo o texto da página (capturava timestamps e badges)
   *  - Aceitar qualquer sequência de 10+ dígitos
   * ──────────────────────────────────────────────────────── */
  function extractPhone() {

    // 1) Link tel: (o GHL renderiza isso na ficha do contato)
    const telLink = document.querySelector('a[href^="tel:"]');
    if (telLink) {
      const p = sanitize(telLink.href.replace('tel:', ''));
      if (p) return p;
    }

    // 2) Input type=tel
    const telInput = document.querySelector('input[type="tel"]');
    if (telInput && telInput.value) {
      const p = sanitize(telInput.value);
      if (p) return p;
    }

    // 3) Campos com rótulo de telefone
    //    O GHL renderiza "Telefone" como label/span antes do valor
    const labelKeywords = ['telefone', 'phone', 'celular', 'mobile', 'fone', 'whatsapp'];
    const allEls = Array.from(document.querySelectorAll('label, span, p, div, td, th'));

    for (const el of allEls) {
      const txt = el.textContent.trim().toLowerCase();
      if (!labelKeywords.includes(txt)) continue;

      // Procura o valor no elemento seguinte
      const candidates = [
        el.nextElementSibling,
        el.parentElement?.nextElementSibling,
        el.closest('tr')?.nextElementSibling,
      ].filter(Boolean);

      for (const cand of candidates) {
        const p = extractBrazilianPhone(cand.textContent);
        if (p) return p;
      }
    }

    // 4) Formato E.164 explícito (+55XXXXXXXXXXX) em qualquer lugar
    //    Só aceita se começa com +55 — evita ambiguidade com outros números
    const allText = document.body.innerText || '';
    const e164 = allText.match(/\+55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/g);
    if (e164 && e164.length > 0) {
      const p = sanitize(e164[0]);
      if (p) return p;
    }

    return null;
  }

  /* Extrai número brasileiro de um bloco de texto */
  function extractBrazilianPhone(text) {
    if (!text) return null;

    // Exclui claramente timestamps: "04:45 PM", "3:47 PM", "16:30"
    if (/^\s*\d{1,2}:\d{2}(\s*(AM|PM))?\s*$/.test(text)) return null;

    // Exclui badges/contagens curtas: "88", "1", "2"
    if (/^\s*\d{1,3}\s*$/.test(text)) return null;

    // Padrões de telefone brasileiro (10 ou 11 dígitos com DDD)
    const patterns = [
      /\+55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/,  // +55 (48) 99999-9999
      /\(?\d{2}\)?\s?\d{5}[-\s]?\d{4}/,             // (48) 99999-9999
      /\(?\d{2}\)?\s?\d{4}[-\s]?\d{4}/,             // (48) 9999-9999
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const cleaned = match[0].replace(/\D/g, '');
        // Valida: com DDD deve ter 10 ou 11 dígitos (sem +55) ou 12/13 (com +55)
        if (cleaned.length >= 10 && cleaned.length <= 13) {
          return sanitize(match[0]);
        }
      }
    }
    return null;
  }

  function sanitize(raw) {
    if (!raw) return null;
    let num = raw.replace(/[^\d+]/g, '');
    if (!num.startsWith('+')) {
      if (num.startsWith('55') && num.length >= 12) num = '+' + num;
      else if (num.length === 10 || num.length === 11) num = '+55' + num;
    }
    return (num.startsWith('+') && num.length >= 12 && num.length <= 14) ? num : null;
  }

  /* ─── Abre o Webphone com o número pré-carregado ──────────────────────────
   *
   *  Cria um link tel: e clica nele programaticamente.
   *  O Chrome detecta o protocolo tel: e passa para a extensão Api4com,
   *  que registra a si mesma como handler — abrindo o discador com o
   *  número já preenchido, mas SEM iniciar a chamada automaticamente.
   *
   *  É exatamente assim que as integrações oficiais (Kommo, Pipedrive etc.)
   *  funcionam quando implementadas via botão de click-to-call na página.
   * ─────────────────────────────────────────────────────────────────────── */
  function openDialer(phone) {
    // Cria link tel: temporário e clica
    const a = document.createElement('a');
    a.href = 'tel:' + phone;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 500);

    showToast('📞 Abrindo Webphone com ' + phone, 'success');
    console.log('[Api4com] tel: link clicado para', phone);
  }

  /* ─── Toast ─────────────────────────────────────────────── */
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
      color: '#fff', padding: '11px 22px',
      borderRadius: '10px', fontSize: '13.5px',
      fontFamily: 'system-ui,sans-serif', fontWeight: '500',
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      zIndex: '2147483647', opacity: '1',
      transition: 'opacity 0.4s', maxWidth: '360px',
      textAlign: 'center', pointerEvents: 'none',
    });
    t.textContent = msg;
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.style.opacity = '0'; }, 4500);
  }

  /* ─── Modal de configuração ─────────────────────────────── */
  function openModal() {
    if (document.getElementById('api4com-modal')) return;
    const cfg = getConfig();

    const overlay = document.createElement('div');
    overlay.id = 'api4com-modal';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(4px)',
      zIndex: '2147483646',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    });

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:32px;width:390px;
                  box-shadow:0 24px 60px rgba(0,0,0,0.3);">

        <div style="display:flex;align-items:center;gap:12px;margin-bottom:22px;">
          <div style="width:42px;height:42px;
                      background:linear-gradient(135deg,#1e40af,#3b82f6);
                      border-radius:11px;display:flex;align-items:center;
                      justify-content:center;font-size:20px;flex-shrink:0;">📞</div>
          <div>
            <div style="font-size:16px;font-weight:700;color:#111;">Api4com</div>
            <div style="font-size:12px;color:#6b7280;">Configuração do agente</div>
          </div>
          <button id="a4c-close"
            style="margin-left:auto;background:none;border:none;
                   cursor:pointer;font-size:20px;color:#9ca3af;padding:4px;">✕</button>
        </div>

        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;
                    padding:14px;margin-bottom:20px;font-size:13px;
                    color:#1e40af;line-height:1.75;">
          <strong>Como encontrar seu Ramal?</strong><br>
          Abra o Webphone Api4com no Chrome (ícone da extensão).<br>
          O número do <strong>Ramal</strong> aparece ao lado do ícone verde de status.
        </div>

        <label style="display:block;margin-bottom:24px;">
          <span style="font-size:13px;font-weight:600;color:#374151;
                       display:block;margin-bottom:5px;">Número do Ramal</span>
          <input id="a4c-ramal" type="text" value="${cfg.extension || ''}"
            placeholder="Ex: 1001"
            style="width:100%;box-sizing:border-box;padding:10px 13px;
                   border:1.5px solid #d1d5db;border-radius:8px;
                   font-size:14px;outline:none;"/>
        </label>

        <label style="display:block;margin-bottom:24px;">
          <span style="font-size:13px;font-weight:600;color:#374151;
                       display:block;margin-bottom:5px;">Token de Acesso</span>
          <span style="font-size:12px;color:#9ca3af;display:block;margin-bottom:5px;">
            Opcional — necessário apenas para funcionalidades futuras
          </span>
          <input id="a4c-token" type="password" value="${cfg.token || ''}"
            placeholder="Cole aqui seu token…"
            style="width:100%;box-sizing:border-box;padding:10px 13px;
                   border:1.5px solid #d1d5db;border-radius:8px;
                   font-size:14px;outline:none;"/>
        </label>

        <button id="a4c-save"
          style="width:100%;padding:13px;
                 background:linear-gradient(135deg,#1e40af,#3b82f6);
                 color:#fff;border:none;border-radius:10px;
                 font-size:15px;font-weight:600;cursor:pointer;">
          Salvar configuração
        </button>

        <div id="a4c-msg"
          style="margin-top:12px;text-align:center;font-size:13px;min-height:18px;"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#a4c-close').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.querySelector('#a4c-save').onclick = () => {
      const ext   = overlay.querySelector('#a4c-ramal').value.trim();
      const token = overlay.querySelector('#a4c-token')?.value.trim() || '';
      const msg   = overlay.querySelector('#a4c-msg');
      if (!ext) { msg.style.color='#dc2626'; msg.textContent='⚠️ Informe o Ramal.'; return; }
      saveConfig({ extension: ext, token });
      msg.style.color = '#16a34a';
      msg.textContent = '✅ Configuração salva!';
      setTimeout(() => overlay.remove(), 1200);
    };

    // Focus automático
    setTimeout(() => {
      const inp = overlay.querySelector('#a4c-ramal');
      inp && inp.focus();
    }, 100);
  }

  /* ─── Criação dos botões ─────────────────────────────────
   *
   *  Posição: ao lado do botão verde "Call" (WA) do GHL,
   *  que fica no header da conversa/contato aberto.
   *
   *  Seletores tentados em ordem:
   *  1. Botão com texto "Call" que tem classe/style verde (Stevo WA btn)
   *  2. Qualquer botão com "Call" no texto visível no header
   *  3. O header da conversa (container de ações)
   *
   *  O botão é inserido ANTES do elemento encontrado.
   * ──────────────────────────────────────────────────────── */
  function findCallButtonAnchor() {
    // Tenta encontrar o botão verde "Call" do WA (Stevo ou nativo)
    const allBtns = Array.from(document.querySelectorAll('button, a'));

    // Prioridade 1: botão com exatamente "Call" no texto e algum estilo verde
    for (const btn of allBtns) {
      const text = btn.textContent.trim();
      if (text === 'Call' || text === '📞 Call' || text.endsWith('Call')) {
        const style = window.getComputedStyle(btn);
        const bg = style.backgroundColor;
        // Verde aproximado em RGB
        if (bg.includes('rgb(') ) {
          const [r, g, b] = bg.match(/\d+/g).map(Number);
          if (g > r && g > b && g > 100) return btn; // predominantemente verde
        }
      }
    }

    // Prioridade 2: botão com ID/classe contendo "call" ou "wa"
    const byClass = document.querySelector(
      'button[id*="call"], button[class*="call"], button[id*="wa-"], button[class*="waCall"]'
    );
    if (byClass) return byClass;

    // Prioridade 3: container de ações no header da conversa
    const headerActions = document.querySelector(
      '[class*="header-action"], [class*="headerAction"], [class*="conversation-action"]'
    );
    if (headerActions) return headerActions.firstElementChild || headerActions;

    return null;
  }

  function buildButton(id, label, icon, onClick) {
    const btn = document.createElement('button');
    btn.id = id;
    Object.assign(btn.style, {
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '7px',
      padding:       '6px 14px',
      height:        '36px',
      background:    'linear-gradient(135deg, #1e3a8a, #2563eb)',
      color:         '#fff',
      border:        'none',
      borderRadius:  '8px',
      fontSize:      '13px',
      fontWeight:    '600',
      cursor:        'pointer',
      fontFamily:    'system-ui,-apple-system,sans-serif',
      boxShadow:     '0 2px 10px rgba(37,99,235,0.45)',
      letterSpacing: '0.2px',
      whiteSpace:    'nowrap',
      transition:    'transform 0.12s, box-shadow 0.12s, opacity 0.12s',
      marginRight:   '6px',
      verticalAlign: 'middle',
    });
    btn.innerHTML = icon + label;
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.04)';
      btn.style.boxShadow = '0 4px 16px rgba(37,99,235,0.65)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 2px 10px rgba(37,99,235,0.45)';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  function buildCfgButton(id, onClick) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.title = 'Configurar Api4com';
    Object.assign(btn.style, {
      display:        'inline-flex',
      alignItems:     'center',
      justifyContent: 'center',
      width:          '32px',
      height:         '32px',
      background:     '#fff',
      border:         '1.5px solid #e5e7eb',
      borderRadius:   '8px',
      cursor:         'pointer',
      fontSize:       '15px',
      boxShadow:      '0 1px 4px rgba(0,0,0,0.1)',
      transition:     'transform 0.3s, border-color 0.2s',
      marginRight:    '8px',
      verticalAlign:  'middle',
    });
    btn.textContent = '⚙️';
    btn.addEventListener('mouseenter', () => {
      btn.style.transform   = 'rotate(60deg)';
      btn.style.borderColor = '#3b82f6';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform   = 'rotate(0deg)';
      btn.style.borderColor = '#e5e7eb';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  function injectButtons() {
    if (document.getElementById(BTN_ID)) return;

    const anchor = findCallButtonAnchor();
    if (!anchor) return; // header ainda não renderizou

    const dialBtn = buildButton(
      BTN_ID,
      'Ligar',
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
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
      </svg>`,
      () => {
        if (!isConfigured()) { openModal(); return; }
        const phone = extractPhone();
        if (!phone) {
          // Debug: mostra o que foi encontrado no console
          console.warn('[Api4com] Nenhum telefone válido encontrado. Verifique o console.');
          debugPhoneSearch();
          showToast('⚠️ Telefone não encontrado. Abra a ficha do contato e tente novamente.', 'error');
          return;
        }
        openDialer(phone);
      }
    );

    const cfgBtn = buildCfgButton(CFG_BTN_ID, openModal);

    // Insere ANTES do anchor (botão Call do WA)
    anchor.parentNode.insertBefore(dialBtn, anchor);
    anchor.parentNode.insertBefore(cfgBtn, anchor);

    console.log('[Api4com] Botões injetados ao lado do botão Call ✓');
  }

  /* Debug: ajuda a diagnosticar o problema de número errado */
  function debugPhoneSearch() {
    console.group('[Api4com] Debug de extração de telefone');
    console.log('URL atual:', location.href);
    console.log('Links tel: encontrados:', document.querySelectorAll('a[href^="tel:"]').length);
    console.log('Inputs tel: encontrados:', document.querySelectorAll('input[type="tel"]').length);
    const e164 = (document.body.innerText || '').match(/\+55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/g);
    console.log('Números E.164 (+55...) encontrados no texto:', e164);
    console.groupEnd();
  }

  function removeButtons() {
    [BTN_ID, CFG_BTN_ID].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  /* ─── Observer: detecta navegação SPA e re-renders ──────── */
  let lastUrl = location.href;
  let injectTimer = null;

  function scheduleInject() {
    clearTimeout(injectTimer);
    injectTimer = setTimeout(() => {
      if (isRelevantPage()) {
        injectButtons();
      } else {
        removeButtons();
      }
    }, 800);
  }

  new MutationObserver(() => {
    // Rota mudou?
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      removeButtons();
      scheduleInject();
      return;
    }
    // Botão sumiu por re-render?
    if (isRelevantPage() && !document.getElementById(BTN_ID)) {
      scheduleInject();
    }
  }).observe(document.body, { childList: true, subtree: true });

  /* ─── Init ───────────────────────────────────────────────── */
  function init() {
    if (isRelevantPage()) {
      injectButtons();
      if (!isConfigured()) setTimeout(openModal, 1500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Api4com GHL] v3.3 carregado ✓');
})();
