/**
 * ============================================================
 *  Api4com Click-to-Call — Integração GHL Whitelabel
 *  Versão: 1.0.0
 *
 *  INSTALAÇÃO:
 *  1. Hospede este arquivo em qualquer CDN/servidor HTTPS
 *  2. No GHL: Settings > Whitelabel > Custom Scripts/JS
 *     Cole: <script src="https://SEU-DOMINIO/api4com-ghl.js"></script>
 *
 *  USO:
 *  - Na primeira vez, clique no botão 📞 e configure Token + Ramal
 *  - Depois disso, clique no botão para ligar direto para o contato
 *  - Clique no ⚙️ para alterar as configurações a qualquer momento
 * ============================================================
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     CONSTANTES
  ───────────────────────────────────────────── */
  const STORAGE_KEY  = 'api4com_cfg_v1';
  const BTN_ID       = 'api4com-dial-btn';
  const SETTINGS_ID  = 'api4com-settings-btn';
  const MODAL_ID     = 'api4com-modal';
  const TOAST_ID     = 'api4com-toast';
  const API_BASE     = 'https://api.api4com.com/api/v1';
  const INJECT_DELAY = 900; // ms aguarda o GHL renderizar

  /* ─────────────────────────────────────────────
     UTILITÁRIOS DE CONFIG (localStorage)
  ───────────────────────────────────────────── */
  function getConfig() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c.token && c.extension);
  }

  /* ─────────────────────────────────────────────
     EXTRAÇÃO DO TELEFONE DO CONTATO
     Tenta múltiplas estratégias no DOM do GHL
  ───────────────────────────────────────────── */
  function extractPhone() {
    // 1) Links tel: (mais confiável)
    const telLink = document.querySelector('a[href^="tel:"]');
    if (telLink) {
      return sanitizePhone(telLink.getAttribute('href').replace('tel:', ''));
    }

    // 2) Campos de input com rótulos de telefone
    const labels = document.querySelectorAll('label, span, div');
    for (const el of labels) {
      const txt = el.textContent.trim().toLowerCase();
      if (txt === 'telefone' || txt === 'phone' || txt === 'celular' || txt === 'mobile') {
        const sibling = el.nextElementSibling || el.parentElement?.nextElementSibling;
        if (sibling) {
          const phone = extractPhoneFromText(sibling.textContent);
          if (phone) return phone;
        }
      }
    }

    // 3) Qualquer texto que pareça um número de telefone brasileiro
    const allText = document.querySelectorAll(
      '[class*="phone"], [class*="Phone"], [class*="telefone"], [data-field="phone"]'
    );
    for (const el of allText) {
      const phone = extractPhoneFromText(el.textContent);
      if (phone) return phone;
    }

    // 4) Varredura ampla no painel de info do contato
    const infoPanels = document.querySelectorAll(
      '[class*="contact-info"], [class*="contactInfo"], [class*="details"], [class*="sidebar"]'
    );
    for (const panel of infoPanels) {
      const phone = extractPhoneFromText(panel.textContent);
      if (phone) return phone;
    }

    return null;
  }

  function extractPhoneFromText(text) {
    if (!text) return null;
    // Aceita formatos: +55..., 55..., (48)..., 048..., números com 10-13 dígitos
    const match = text.match(/(\+?55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}|\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4})/);
    if (match) return sanitizePhone(match[1]);
    return null;
  }

  function sanitizePhone(raw) {
    // Remove tudo que não é dígito ou +
    let num = raw.replace(/[^\d+]/g, '');
    // Garante que começa com + ou adiciona +55
    if (!num.startsWith('+')) {
      if (num.startsWith('55') && num.length >= 12) {
        num = '+' + num;
      } else if (num.length === 10 || num.length === 11) {
        num = '+55' + num;
      }
    }
    return num.length >= 10 ? num : null;
  }

  /* ─────────────────────────────────────────────
     CHAMADA À API DA API4COM
  ───────────────────────────────────────────── */
  async function makeCall(phone) {
    const cfg = getConfig();
    showToast('⏳ Iniciando chamada para ' + phone + '...', 'info');

    try {
      const resp = await fetch(API_BASE + '/dialer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': cfg.token,
        },
        body: JSON.stringify({
          extension: cfg.extension,
          phone: phone,
          metadata: {
            gateway: 'ghl-whitelabel',
            source:  window.location.href,
          },
        }),
      });

      const data = await resp.json();

      if (resp.ok && data.id) {
        showToast('✅ Chamada iniciada! Atenda o Webphone.', 'success');
      } else {
        const errMsg = data.message || data.error || 'Erro desconhecido';
        showToast('❌ Erro: ' + errMsg, 'error');
        console.error('[Api4com] Erro na chamada:', data);
      }
    } catch (err) {
      showToast('❌ Falha de conexão com a Api4com.', 'error');
      console.error('[Api4com] Erro de rede:', err);
    }
  }

  /* ─────────────────────────────────────────────
     SISTEMA DE TOAST (notificação)
  ───────────────────────────────────────────── */
  function showToast(msg, type = 'info') {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }

    const colors = {
      info:    '#2563eb',
      success: '#16a34a',
      error:   '#dc2626',
    };

    Object.assign(toast.style, {
      position:     'fixed',
      bottom:       '28px',
      left:         '50%',
      transform:    'translateX(-50%)',
      background:   colors[type] || colors.info,
      color:        '#fff',
      padding:      '12px 22px',
      borderRadius: '10px',
      fontSize:     '14px',
      fontFamily:   'system-ui, sans-serif',
      fontWeight:   '500',
      boxShadow:    '0 4px 20px rgba(0,0,0,0.25)',
      zIndex:       '2147483647',
      opacity:      '1',
      transition:   'opacity 0.4s ease',
      maxWidth:     '360px',
      textAlign:    'center',
    });

    toast.textContent = msg;

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
    }, 4000);
  }

  /* ─────────────────────────────────────────────
     MODAL DE CONFIGURAÇÃO
  ───────────────────────────────────────────── */
  function openModal() {
    if (document.getElementById(MODAL_ID)) return;

    const cfg = getConfig();

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    Object.assign(overlay.style, {
      position:        'fixed',
      inset:           '0',
      background:      'rgba(0,0,0,0.55)',
      backdropFilter:  'blur(4px)',
      zIndex:          '2147483646',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      fontFamily:      'system-ui, -apple-system, sans-serif',
    });

    // Card
    const card = document.createElement('div');
    Object.assign(card.style, {
      background:   '#ffffff',
      borderRadius: '16px',
      padding:      '32px',
      width:        '380px',
      boxShadow:    '0 24px 60px rgba(0,0,0,0.3)',
      position:     'relative',
    });

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <div style="width:40px;height:40px;background:linear-gradient(135deg,#1e40af,#3b82f6);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">📞</div>
        <div>
          <div style="font-size:16px;font-weight:700;color:#111;">Api4com</div>
          <div style="font-size:12px;color:#6b7280;">Configuração do agente</div>
        </div>
        <button id="api4com-close-modal" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:20px;color:#9ca3af;line-height:1;">✕</button>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;margin-bottom:20px;font-size:13px;color:#1e40af;line-height:1.6;">
        <strong>Onde encontrar suas credenciais?</strong><br>
        Acesse <a href="https://app.api4com.com" target="_blank" style="color:#1d4ed8;">app.api4com.com</a> → seu perfil → Token de Acesso.<br>
        O <strong>Ramal</strong> aparece no Webphone (ícone verde no Chrome).
      </div>

      <label style="display:block;margin-bottom:16px;">
        <span style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Token de Acesso</span>
        <input id="api4com-token-input" type="password"
          placeholder="Cole aqui seu token..."
          value="${cfg.token || ''}"
          style="width:100%;box-sizing:border-box;padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;transition:border 0.2s;"
        />
      </label>

      <label style="display:block;margin-bottom:24px;">
        <span style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px;">Número do Ramal</span>
        <input id="api4com-ramal-input" type="text"
          placeholder="Ex: 1001"
          value="${cfg.extension || ''}"
          style="width:100%;box-sizing:border-box;padding:10px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;transition:border 0.2s;"
        />
      </label>

      <button id="api4com-save-btn"
        style="width:100%;padding:12px;background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;letter-spacing:0.3px;transition:opacity 0.2s;">
        Salvar configuração
      </button>

      <div id="api4com-modal-msg" style="margin-top:12px;text-align:center;font-size:13px;min-height:18px;"></div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Foco nos inputs
    setTimeout(() => {
      const tokenInput = document.getElementById('api4com-token-input');
      const ramalInput = document.getElementById('api4com-ramal-input');

      // Estilo de foco
      [tokenInput, ramalInput].forEach(input => {
        input.addEventListener('focus', () => input.style.borderColor = '#3b82f6');
        input.addEventListener('blur',  () => input.style.borderColor = '#d1d5db');
      });

      // Fechar
      document.getElementById('api4com-close-modal').addEventListener('click', () => {
        overlay.remove();
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });

      // Salvar
      document.getElementById('api4com-save-btn').addEventListener('click', () => {
        const token = tokenInput.value.trim();
        const ext   = ramalInput.value.trim();
        const msg   = document.getElementById('api4com-modal-msg');

        if (!token) {
          msg.style.color = '#dc2626';
          msg.textContent = '⚠️ Informe o Token de Acesso.';
          return;
        }
        if (!ext) {
          msg.style.color = '#dc2626';
          msg.textContent = '⚠️ Informe o número do Ramal.';
          return;
        }

        saveConfig({ token, extension: ext });
        msg.style.color   = '#16a34a';
        msg.textContent   = '✅ Configuração salva!';

        setTimeout(() => overlay.remove(), 1200);
      });

      if (!cfg.token) tokenInput.focus();
    }, 50);
  }

  /* ─────────────────────────────────────────────
     INJEÇÃO DOS BOTÕES NO HEADER DO GHL
  ───────────────────────────────────────────── */
  function injectButtons() {
    // Evita duplicatas
    if (document.getElementById(BTN_ID)) return;

    // Localiza o container dos botões de ação (header da conversa/contato)
    // O GHL usa múltiplas classes possíveis - tentamos todas
    const selectors = [
      // Botão de WA do Stevo (referência mais confiável)
      '#stevo-wa-btn',
      // Containers comuns do GHL
      '[class*="conversation-header"] [class*="actions"]',
      '[class*="conversationHeader"] [class*="action"]',
      '[class*="contact-header"] [class*="action"]',
      // Fallback: onde o botão Call verde está
      'button[class*="wa-call"], button[class*="waCall"]',
    ];

    let anchor = null;

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { anchor = el; break; }
    }

    // Fallback final: procura o botão verde "Call" visualmente
    if (!anchor) {
      const allBtns = Array.from(document.querySelectorAll('button'));
      anchor = allBtns.find(b =>
        b.textContent.trim() === 'Call' ||
        b.getAttribute('aria-label')?.toLowerCase().includes('call') ||
        b.id?.includes('stevo')
      );
    }

    if (!anchor) return; // GHL ainda não renderizou o header

    // ── Botão principal: Ligar via Api4com ──
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.title = 'Ligar com Api4com';
    Object.assign(btn.style, {
      display:        'inline-flex',
      alignItems:     'center',
      gap:            '6px',
      padding:        '6px 14px',
      background:     'linear-gradient(135deg, #1e40af, #3b82f6)',
      color:          '#fff',
      border:         'none',
      borderRadius:   '8px',
      fontSize:       '13px',
      fontWeight:     '600',
      cursor:         'pointer',
      fontFamily:     'system-ui, sans-serif',
      marginRight:    '8px',
      transition:     'opacity 0.2s, transform 0.15s',
      boxShadow:      '0 2px 8px rgba(59,130,246,0.4)',
      letterSpacing:  '0.2px',
      whiteSpace:     'nowrap',
    });
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .91h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
      </svg>
      Ligar Api4com
    `;

    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; btn.style.transform = 'scale(1.03)'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1';    btn.style.transform = 'scale(1)'; });

    btn.addEventListener('click', () => {
      if (!isConfigured()) {
        openModal();
        return;
      }
      const phone = extractPhone();
      if (!phone) {
        showToast('⚠️ Número de telefone não encontrado na tela.', 'error');
        return;
      }
      makeCall(phone);
    });

    // ── Botão de engrenagem (configurações) ──
    const settingsBtn = document.createElement('button');
    settingsBtn.id = SETTINGS_ID;
    settingsBtn.title = 'Configurar Api4com';
    Object.assign(settingsBtn.style, {
      display:      'inline-flex',
      alignItems:   'center',
      justifyContent: 'center',
      width:        '30px',
      height:       '30px',
      background:   'transparent',
      border:       '1.5px solid #d1d5db',
      borderRadius: '7px',
      cursor:       'pointer',
      marginRight:  '8px',
      color:        '#6b7280',
      transition:   'border-color 0.2s, color 0.2s, transform 0.3s',
      fontSize:     '15px',
    });
    settingsBtn.textContent = '⚙️';

    settingsBtn.addEventListener('mouseenter', () => {
      settingsBtn.style.borderColor = '#3b82f6';
      settingsBtn.style.color       = '#3b82f6';
      settingsBtn.style.transform   = 'rotate(45deg)';
    });
    settingsBtn.addEventListener('mouseleave', () => {
      settingsBtn.style.borderColor = '#d1d5db';
      settingsBtn.style.color       = '#6b7280';
      settingsBtn.style.transform   = 'rotate(0deg)';
    });
    settingsBtn.addEventListener('click', openModal);

    // Insere antes do elemento âncora
    anchor.parentNode.insertBefore(btn, anchor);
    anchor.parentNode.insertBefore(settingsBtn, anchor);
  }

  /* ─────────────────────────────────────────────
     OBSERVER: detecta mudanças de rota no GHL (SPA)
  ───────────────────────────────────────────── */
  let lastUrl = location.href;
  let injectTimer = null;

  function scheduleInject() {
    clearTimeout(injectTimer);
    injectTimer = setTimeout(() => {
      // Remove botões antigos se a URL mudou
      const oldBtn = document.getElementById(BTN_ID);
      const oldSet = document.getElementById(SETTINGS_ID);
      if (oldBtn) oldBtn.remove();
      if (oldSet) oldSet.remove();

      injectButtons();
    }, INJECT_DELAY);
  }

  // Observa mudanças no DOM (SPA do GHL)
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleInject();
    }
    // Reinjecta se o botão sumiu (ex: re-render do GHL)
    if (!document.getElementById(BTN_ID)) {
      scheduleInject();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Primeira injeção ao carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInject);
  } else {
    scheduleInject();
  }

  console.log('[Api4com GHL] Script carregado ✓');
})();
