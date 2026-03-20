/**
 * ============================================================
 *  Api4com Webphone GHL — v5.2.1
 *  Webphone SIP próprio integrado ao GoHighLevel
 *
 *  INSTALAÇÃO:
 *  Settings > Whitelabel > Custom Scripts:
 *  <script src="https://SEU-DOMINIO/api4com-ghl.js"></script>
 *
 *  FLUXO:
 *  1. Operador clica em "Ligar" → painel flutuante abre
 *  2. Se não logado → tela de login (email + senha da Api4com)
 *  3. Login busca ramal/senha SIP automaticamente
 *  4. Conecta SIP via libwebphone.js (sem extensão Chrome)
 *  5. Discador abre com número do contato já preenchido
 *  6. Operador clica em ligar → chamada WebRTC direto no browser
 * ============================================================
 */

(function () {
  'use strict';

  var API         = 'https://api.api4com.com/api/v1';
  var JSSIP_URL  = 'https://cdnjs.cloudflare.com/ajax/libs/jssip/3.10.0/jssip.min.js';
  var STORE_KEY   = 'a4c_wp_v5';
  var BTN_ID      = 'a4c-ligar-btn';
  var PANEL_ID    = 'a4c-panel';

  /* ─── Estado global ──────────────────────────────────────── */
  var state = {
    screen:      'login',
    token:       null,
    domain:      null,
    extensions:  [],
    extension:   null,
    phone:       '',
    webphone:    null,
    currentCall: null,
    callTimer:   null,
    callSeconds: 0,
    muted:       false,
    sipStatus:   'offline',
  };

  /* ─── Estilos reutilizáveis ──────────────────────────────── */
  var S = {
    inp: 'width:100%;box-sizing:border-box;padding:10px 13px;border:1.5px solid #e5e7eb;border-radius:9px;font-size:14px;outline:none;font-family:system-ui,sans-serif;color:#111;',
    lbl: 'font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:5px;',
    btnPrimary: 'width:100%;display:flex;align-items:center;justify-content:center;padding:12px 16px;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:system-ui,sans-serif;',
    btnSecondary: 'width:100%;padding:11px;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:10px;color:#374151;font-size:13px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif;',
  };

  /* ─── Persistência ───────────────────────────────────────── */
  function loadSession() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      if (s.token) {
        state.token      = s.token;
        state.domain     = s.domain;
        state.extension  = s.extension;
        state.extensions = s.extensions || [];
        state.screen     = 'connecting';
      }
    } catch(e) {}
  }

  function saveSession() {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      token:      state.token,
      domain:     state.domain,
      extension:  state.extension,
      extensions: state.extensions,
    }));
  }

  function clearSession() {
    localStorage.removeItem(STORE_KEY);
    state.token = null; state.domain = null;
    state.extension = null; state.extensions = [];
    state.webphone = null; state.currentCall = null;
    state.sipStatus = 'offline'; state.screen = 'login';
  }

  /* ─── Carrega JsSIP (SIP browser-native) ────────────────── */
  function loadJsSIP() {
    return new Promise(function(resolve, reject) {
      if (window.JsSIP) { resolve(); return; }
      var s = document.createElement('script');
      s.src = JSSIP_URL;
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ─── API helpers ────────────────────────────────────────── */
  function apiPost(path, body, token) {
    var h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = token;
    return fetch(API + path, {
      method: 'POST',
      headers: h,
      body: JSON.stringify(body),
    }).then(function(r) { return r.json(); });
  }

  function apiGet(path, token) {
    return fetch(API + path, {
      headers: { 'Authorization': token },
    }).then(function(r) { return r.json(); });
  }

  /* ─── Extração de telefone ───────────────────────────────── */
  function extractPhone() {
    var telLink = document.querySelector('a[href^="tel:"]');
    if (telLink) { var p = sanitize(telLink.href.replace('tel:', '')); if (p) return p; }
    var telInput = document.querySelector('input[type="tel"]');
    if (telInput && telInput.value) { var p2 = sanitize(telInput.value); if (p2) return p2; }
    var kw = ['telefone','phone','celular','mobile','fone','whatsapp'];
    var els = document.querySelectorAll('label,span,p,div,td,th');
    for (var i=0; i<els.length; i++) {
      var el = els[i];
      if (kw.indexOf(el.textContent.trim().toLowerCase()) === -1) continue;
      var candidates = [el.nextElementSibling, el.parentElement && el.parentElement.nextElementSibling].filter(Boolean);
      for (var j=0; j<candidates.length; j++) {
        var p3 = extractBR(candidates[j].textContent);
        if (p3) return p3;
      }
    }
    var m = (document.body.innerText||'').match(/\+55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/);
    if (m) { var p4 = sanitize(m[0]); if (p4) return p4; }
    return '';
  }

  function extractBR(text) {
    if (!text) return null;
    if (/^\s*\d{1,3}\s*$/.test(text)) return null;
    if (/^\s*\d{1,2}:\d{2}(\s*(AM|PM))?\s*$/.test(text)) return null;
    var patterns = [/\+55\s?\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/,/\(?\d{2}\)?\s?\d{5}[-\s]?\d{4}/,/\(?\d{2}\)?\s?\d{4}[-\s]?\d{4}/];
    for (var i=0; i<patterns.length; i++) {
      var m = text.match(patterns[i]);
      if (m) { var d = m[0].replace(/\D/g,''); if (d.length>=10&&d.length<=13) return sanitize(m[0]); }
    }
    return null;
  }

  function sanitize(raw) {
    if (!raw) return null;
    var n = raw.replace(/[^\d+]/g,'');
    if (!n.startsWith('+')) {
      if (n.startsWith('55')&&n.length>=12) n='+'+n;
      else if (n.length===10||n.length===11) n='+55'+n;
    }
    return (n.startsWith('+')&&n.length>=12&&n.length<=14) ? n : null;
  }

  /* ─── Timer ──────────────────────────────────────────────── */
  function startTimer() {
    stopTimer();
    state.callTimer = setInterval(function() {
      state.callSeconds++;
      var el = document.getElementById('a4c-call-timer');
      if (el) el.textContent = fmtTime(state.callSeconds);
    }, 1000);
  }
  function stopTimer() { clearInterval(state.callTimer); state.callSeconds = 0; }
  function fmtTime(s) {
    return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
  }

  /* ─── SIP via JsSIP ─────────────────────────────────────── */
  var _sipTimeout = null;

  function initSip() {
    return loadJsSIP().then(function() {
      var ext    = state.extension;
      var domain = ext.domain;
      var wsUri  = 'wss://' + domain + ':6443';

      console.group('[Api4com] Iniciando SIP via JsSIP');
      console.log('Domínio:', domain);
      console.log('Ramal:', ext.ramal);
      console.log('WSS:', wsUri);
      console.groupEnd();

      // Para UA anterior se existir
      if (state.webphone) {
        try { state.webphone.stop(); } catch(e) {}
        state.webphone = null;
      }

      // Timeout 20s
      clearTimeout(_sipTimeout);
      _sipTimeout = setTimeout(function() {
        if (state.sipStatus !== 'online') {
          console.error('[Api4com] Timeout SIP — sem resposta em 20s');
          state.sipStatus = 'offline';
          state.screen = 'error';
          render();
        }
      }, 20000);

      try {
        // Habilita logs completos do JsSIP para diagnóstico
        JsSIP.debug.enable('JsSIP:*');

        var socket = new JsSIP.WebSocketInterface(wsUri);
        var ua = new JsSIP.UA({
          sockets:           [socket],
          uri:               'sip:' + ext.ramal + '@' + domain,
          password:          ext.senha,
          realm:             domain,
          register:          true,
          register_expires:  600,
          user_agent:        'api4com-ghl-webphone',
          no_answer_timeout: 30,
          connection_recovery_min_interval: 2,
          connection_recovery_max_interval: 30,
        });

        state.webphone = ua;

        // WebSocket abriu — boa notícia, chegou ao servidor
        ua.on('connected', function() {
          console.log('[Api4com] ✅ WebSocket conectado ao servidor SIP — aguardando registro…');
          var el = document.getElementById('a4c-connecting-msg');
          if (el) el.textContent = 'WebSocket conectado — registrando ramal…';
        });

        // WebSocket fechou — problema de rede ou servidor recusou
        ua.on('disconnected', function(e) {
          console.error('[Api4com] ❌ WebSocket desconectado:', e);
          if (state.sipStatus !== 'online') {
            clearTimeout(_sipTimeout);
            state.sipStatus = 'offline';
            state.screen = 'error';
            render();
          }
        });

        ua.on('registered', function() {
          clearTimeout(_sipTimeout);
          console.log('[Api4com] ✅ SIP registrado com sucesso!');
          state.sipStatus = 'online';
          state.screen    = 'dialer';
          var phone = extractPhone();
          if (phone) state.phone = phone;
          render();
        });

        ua.on('unregistered', function() {
          console.warn('[Api4com] SIP desregistrado');
          state.sipStatus = 'offline';
          if (state.screen === 'dialer') render();
        });

        ua.on('registrationFailed', function(data) {
          clearTimeout(_sipTimeout);
          console.error('[Api4com] ❌ Falha no registro SIP — causa:', data.cause, data);
          state.sipStatus = 'offline';
          state.screen = 'error';
          render();
        });

        ua.on('newRTCSession', function(data) {
          var session = data.session;
          if (session.direction === 'incoming') {
            // Chamada recebida — aceita automaticamente se integrada
            var headers = session.request.headers;
            var integrated = headers['X-Api4comintegratedcall'];
            if (integrated && integrated[0] && integrated[0].raw === 'true') {
              session.answer({ mediaConstraints: { audio: true, video: false } });
            } else {
              // Toca e mostra chamada recebida
              state.currentCall = session;
              state.screen = 'calling';
              state.muted = false;
              startTimer();
              render();
            }
          } else {
            // Chamada sainte
            state.currentCall = session;
            state.screen = 'calling';
            state.muted = false;
            startTimer();
            render();
          }

          session.on('ended',   function() { stopTimer(); state.currentCall = null; state.screen = 'dialer'; render(); });
          session.on('failed',  function() { stopTimer(); state.currentCall = null; state.screen = 'dialer'; render(); });
          session.on('accepted',function() { render(); });
        });

        ua.start();
        console.log('[Api4com] UA.start() chamado');

      } catch(e) {
        clearTimeout(_sipTimeout);
        console.error('[Api4com] Erro ao iniciar JsSIP:', e);
        state.screen = 'error';
        render();
      }
    }).catch(function(e) {
      clearTimeout(_sipTimeout);
      console.error('[Api4com] Erro ao carregar JsSIP:', e);
      state.screen = 'error';
      render();
    });
  }

  /* ─── Ações de chamada ───────────────────────────────────── */
  function dial(phone) {
    if (state.sipStatus !== 'online') { showMsg('Aguarde a conexão SIP.', 'error'); return; }
    if (!phone) { showMsg('Digite um número.', 'error'); return; }
    try {
      var options = {
        mediaConstraints: { audio: true, video: false },
        pcConfig: { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] },
      };
      state.webphone.call('sip:' + phone + '@' + state.extension.domain, options);
    } catch(e) { showMsg('Erro ao discar: ' + e.message, 'error'); console.error('[Api4com] Erro dial:', e); }
  }

  function hangup() {
    if (state.currentCall) {
      try { state.currentCall.terminate(); } catch(e) {}
    }
  }

  function toggleMute() {
    if (!state.currentCall) return;
    try {
      if (state.muted) state.currentCall.unmute({ audio: true });
      else             state.currentCall.mute({ audio: true });
      state.muted = !state.muted; render();
    } catch(e) {}
  }

  /* ─── Mensagem interna ───────────────────────────────────── */
  function showMsg(msg, type) {
    var el = document.getElementById('a4c-msg');
    if (!el) return;
    var colors = { error:'#fef2f2', info:'#eff6ff', success:'#f0fdf4' };
    var texts  = { error:'#dc2626', info:'#2563eb',  success:'#16a34a' };
    el.style.cssText = 'padding:9px 14px;font-size:12px;border-radius:8px;margin:10px 14px 0;display:block;' +
      'background:' + (colors[type]||colors.info) + ';color:' + (texts[type]||texts.info) + ';';
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(function() { el.style.display = 'none'; }, 5000);
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  function hdr(title, showSettings, showBack) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px 12px;' +
      'background:linear-gradient(135deg,#1e3a8a,#2563eb);cursor:move;user-select:none;" id="a4c-drag-handle">' +
      '<div style="width:28px;height:28px;background:rgba(255,255,255,0.2);border-radius:7px;' +
      'display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">📞</div>' +
      '<span style="color:#fff;font-weight:700;font-size:14px;flex:1;">' + title + '</span>' +
      (showBack ? '<button id="a4c-back" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:13px;">←</button>' : '') +
      (showSettings ? '<button id="a4c-settings-btn" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:13px;">⚙</button>' : '') +
      '<button id="a4c-close-panel" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:15px;">✕</button>' +
      '</div>';
  }

  function msgBar() {
    return '<div id="a4c-msg" style="display:none;"></div>';
  }

  function renderLogin() {
    return hdr('Api4com — Login') + msgBar() +
      '<div style="padding:16px;">' +
      '<p style="font-size:12px;color:#6b7280;margin:0 0 14px;line-height:1.6;">Use o e-mail e senha da sua conta em ' +
      '<a href="https://app.api4com.com" target="_blank" style="color:#2563eb;">app.api4com.com</a></p>' +
      '<label style="display:block;margin-bottom:10px;"><span style="' + S.lbl + '">E-mail</span>' +
      '<input id="a4c-email" type="email" placeholder="seu@email.com" style="' + S.inp + '"/></label>' +
      '<label style="display:block;margin-bottom:16px;"><span style="' + S.lbl + '">Senha</span>' +
      '<input id="a4c-pass" type="password" placeholder="••••••••" style="' + S.inp + '"/></label>' +
      '<button id="a4c-login-btn" style="' + S.btnPrimary + '">Entrar</button>' +
      '</div>';
  }

  function renderConnecting() {
    return hdr('Api4com — Conectando') +
      '<div style="padding:32px 16px;display:flex;flex-direction:column;align-items:center;gap:14px;">' +
      '<div style="width:34px;height:34px;border:3px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:a4c-spin 0.8s linear infinite;"></div>' +
      '<span style="font-size:13px;color:#6b7280;"<span id=\"a4c-connecting-msg\">Registrando ramal SIP…</span></span>' +
      '<button id="a4c-logout-sm" style="font-size:12px;color:#6b7280;background:none;border:none;cursor:pointer;text-decoration:underline;">Sair / trocar conta</button>' +
      '</div>';
  }

  function renderDialer() {
    var ext   = state.extension;
    var ramal = ext ? ext.ramal : '—';
    var isOnline = state.sipStatus === 'online';
    var digits = ['1','2','3','4','5','6','7','8','9','*','0','#'];
    var keys = digits.map(function(d) {
      return '<button class="a4c-key" data-digit="' + d + '" style="height:42px;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:9px;font-size:16px;font-weight:600;color:#1f2937;cursor:pointer;">' + d + '</button>';
    }).join('');

    return hdr('Api4com', true) + msgBar() +
      '<div style="padding:14px 16px 16px;">' +

      // Status
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">' +
      '<div style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + (isOnline?'#22c55e':'#f59e0b') + ';box-shadow:0 0 0 2px ' + (isOnline?'#dcfce7':'#fef3c7') + ';"></div>' +
      '<span style="font-size:12px;color:#6b7280;">' + (isOnline?'Online':'Conectando…') + ' — Ramal ' + ramal + '</span>' +
      '</div>' +

      // Campo número
      '<div style="position:relative;margin-bottom:10px;">' +
      '<input id="a4c-phone-input" type="tel" value="' + (state.phone||'') + '" placeholder="+55 (00) 00000-0000" style="' + S.inp + 'padding-right:38px;font-size:16px;font-weight:600;"/>' +
      '<button id="a4c-clear-phone" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#9ca3af;cursor:pointer;font-size:15px;padding:0;">✕</button>' +
      '</div>' +

      // Teclado
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;">' + keys + '</div>' +

      // Botão ligar
      '<button id="a4c-dial-btn" style="' + S.btnPrimary + 'height:46px;border-radius:12px;' + (!isOnline?'opacity:0.5;cursor:not-allowed;':'') + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:7px"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .91h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>' +
      'Ligar</button>' +
      '</div>';
  }

  function renderCalling() {
    return hdr('Em chamada') +
      '<div style="padding:22px 16px;display:flex;flex-direction:column;align-items:center;gap:16px;">' +
      '<div style="width:58px;height:58px;background:linear-gradient(135deg,#1e3a8a,#3b82f6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;">👤</div>' +
      '<div style="text-align:center;">' +
      '<div style="font-size:17px;font-weight:700;color:#111;letter-spacing:0.5px;">' + state.phone + '</div>' +
      '<div id="a4c-call-timer" style="font-size:13px;color:#6b7280;margin-top:3px;">00:00</div>' +
      '</div>' +
      '<div style="display:flex;gap:14px;margin-top:4px;">' +
      '<button id="a4c-mute-btn" style="width:52px;height:52px;border-radius:50%;border:2px solid #e5e7eb;background:' + (state.muted?'#fee2e2':'#f9fafb') + ';color:' + (state.muted?'#dc2626':'#374151') + ';font-size:20px;cursor:pointer;">' + (state.muted?'🔇':'🎙') + '</button>' +
      '<button id="a4c-hangup-btn" style="width:64px;height:64px;border-radius:50%;border:none;background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;font-size:22px;cursor:pointer;box-shadow:0 4px 14px rgba(220,38,38,0.4);">📵</button>' +
      '<div style="width:52px;height:52px;border-radius:50%;border:2px solid #e5e7eb;background:#f9fafb;display:flex;align-items:center;justify-content:center;font-size:20px;opacity:0.35;">🔊</div>' +
      '</div></div>';
  }

  function renderSettings() {
    var ext = state.extension;
    var extOptions = state.extensions.map(function(e) {
      return '<option value="' + e.id + '"' + (state.extension && state.extension.id===e.id?' selected':'') + '>' + e.ramal + ' — ' + (e.first_name||'') + ' ' + (e.last_name||'') + '</option>';
    }).join('');

    return hdr('Configurações', false, true) + msgBar() +
      '<div style="padding:14px 16px 18px;">' +

      // Ramal ativo
      '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin-bottom:14px;">' +
      '<div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Ramal ativo</div>' +
      '<div style="font-size:14px;font-weight:700;color:#111;">' + (ext ? ext.ramal + ' — ' + (ext.first_name||'') + ' ' + (ext.last_name||'') : 'Nenhum') + '</div>' +
      '<div style="font-size:12px;color:#6b7280;margin-top:2px;">' + (ext&&ext.domain||'') + '</div>' +
      '</div>' +

      // Seleção de ramal (se houver mais de um)
      (state.extensions.length > 1 ?
        '<label style="display:block;margin-bottom:10px;"><span style="' + S.lbl + '">Trocar ramal</span>' +
        '<select id="a4c-ext-select" style="' + S.inp + 'cursor:pointer;">' + extOptions + '</select></label>' +
        '<button id="a4c-apply-ext" style="' + S.btnSecondary + 'margin-bottom:14px;">Aplicar ramal</button>'
      : '') +

      // Logout
      '<button id="a4c-logout" style="width:100%;padding:11px;background:#fff;border:1.5px solid #fca5a5;border-radius:10px;color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif;">Sair da conta Api4com</button>' +
      '</div>';
  }

  function renderError() {
    var ext = state.extension;
    return hdr('Api4com — Erro de Conexão') +
      '<div style="padding:20px 16px;">' +
      '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#dc2626;line-height:1.7;">' +
      '<strong>Não foi possível conectar ao servidor SIP.</strong><br>' +
      'Possíveis causas:<br>' +
      '• Ramal ou senha incorretos<br>' +
      '• Conexão bloqueada pelo navegador<br>' +
      '• Servidor SIP temporariamente indisponível' +
      '</div>' +
      '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:11px;color:#6b7280;font-family:monospace;word-break:break-all;">' +
      'WSS: wss://' + (ext && ext.domain || '?') + ':6443<br>' +
      'Ramal: ' + (ext && ext.ramal || '?') +
      '</div>' +
      '<p style="font-size:12px;color:#6b7280;margin:0 0 14px;line-height:1.6;">Abra o Console do Chrome (F12) e procure por erros <strong>[Api4com]</strong> para diagnóstico detalhado.</p>' +
      '<button id="a4c-retry-sip" style="' + S.btnPrimary + 'margin-bottom:10px;">Tentar novamente</button>' +
      '<button id="a4c-goto-settings" style="' + S.btnSecondary + 'margin-bottom:10px;">Verificar credenciais</button>' +
      '<button id="a4c-logout" style="width:100%;padding:10px;background:#fff;border:1.5px solid #fca5a5;border-radius:10px;color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif;">Sair da conta</button>' +
      '</div>';
  }

  function render() {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    var screens = { login:renderLogin, connecting:renderConnecting, dialer:renderDialer, calling:renderCalling, settings:renderSettings, error:renderError };
    panel.innerHTML = (screens[state.screen] || renderLogin)();
    bindEvents();
  }

  /* ─── Bind events ────────────────────────────────────────── */
  function on(id, ev, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  }

  function bindEvents() {
    on('a4c-close-panel', 'click', function() {
      document.getElementById(PANEL_ID).style.display = 'none';
    });
    on('a4c-settings-btn', 'click', function() { state.screen='settings'; render(); });
    on('a4c-back',         'click', function() { state.screen='dialer';   render(); });
    on('a4c-login-btn',    'click', doLogin);
    on('a4c-logout',       'click', doLogout);
    on('a4c-retry-sip',    'click', function() { state.screen='connecting'; render(); initSip(); });
    on('a4c-goto-settings','click', function() { state.screen='settings';   render(); });
    on('a4c-logout-sm',    'click', doLogout);
    on('a4c-dial-btn',     'click', function() {
      if (state.sipStatus !== 'online') return;
      var inp = document.getElementById('a4c-phone-input');
      var phone = inp ? inp.value.trim() : state.phone;
      if (phone) { state.phone = phone; dial(phone); }
      else showMsg('Digite um número para ligar.', 'error');
    });
    on('a4c-hangup-btn',  'click', hangup);
    on('a4c-mute-btn',    'click', toggleMute);
    on('a4c-clear-phone', 'click', function() {
      state.phone = '';
      var inp = document.getElementById('a4c-phone-input');
      if (inp) inp.value = '';
    });
    on('a4c-apply-ext', 'click', function() {
      var sel = document.getElementById('a4c-ext-select');
      if (!sel) return;
      var chosen = null;
      for (var i=0; i<state.extensions.length; i++) {
        if (String(state.extensions[i].id) === sel.value) { chosen = state.extensions[i]; break; }
      }
      if (chosen) {
        state.extension = chosen; saveSession();
        state.screen = 'connecting'; render();
        initSip();
      }
    });

    // Enter no login
    var passEl = document.getElementById('a4c-pass');
    if (passEl) passEl.addEventListener('keydown', function(e) { if (e.key==='Enter') doLogin(); });

    // Teclado numérico
    var keys = document.querySelectorAll('.a4c-key');
    for (var k=0; k<keys.length; k++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var inp = document.getElementById('a4c-phone-input');
          if (inp) { inp.value += btn.dataset.digit; state.phone = inp.value; }
        });
        btn.addEventListener('mouseenter', function() { btn.style.background='#e5e7eb'; });
        btn.addEventListener('mouseleave', function() { btn.style.background='#f9fafb'; });
      })(keys[k]);
    }

    // Campo telefone sync
    var phoneInp = document.getElementById('a4c-phone-input');
    if (phoneInp) phoneInp.addEventListener('input', function(e) { state.phone = e.target.value; });

    makeDraggable(document.getElementById(PANEL_ID), document.getElementById('a4c-drag-handle'));
  }

  /* ─── Login ──────────────────────────────────────────────── */
  function doLogin() {
    var email = (document.getElementById('a4c-email') || {}).value || '';
    var pass  = (document.getElementById('a4c-pass')  || {}).value || '';
    email = email.trim(); pass = pass.trim();
    if (!email || !pass) { showMsg('Preencha e-mail e senha.', 'error'); return; }

    var btn = document.getElementById('a4c-login-btn');
    if (btn) { btn.textContent = 'Entrando…'; btn.disabled = true; }

    apiPost('/users/login', { email: email, password: pass })
      .then(function(res) {
        if (!res.id) {
          showMsg('E-mail ou senha incorretos.', 'error');
          if (btn) { btn.textContent = 'Entrar'; btn.disabled = false; }
          return;
        }
        state.token = res.id;
        return apiGet('/extensions', state.token).then(function(exts) {
          if (!Array.isArray(exts) || exts.length === 0) {
            showMsg('Nenhum ramal encontrado para esta conta.', 'error');
            if (btn) { btn.textContent = 'Entrar'; btn.disabled = false; }
            return;
          }
          state.extensions = exts;
          state.extension  = exts[0];
          state.domain     = exts[0].domain;
          saveSession();
          state.screen = 'connecting';
          render();
          initSip();
        });
      })
      .catch(function(e) {
        showMsg('Erro de conexão com a Api4com.', 'error');
        console.error('[Api4com]', e);
        if (btn) { btn.textContent = 'Entrar'; btn.disabled = false; }
      });
  }

  function doLogout() {
    if (state.webphone) {
      try { state.webphone.stop(); } catch(e) {}
    }
    clearSession(); render();
  }

  /* ─── Drag ───────────────────────────────────────────────── */
  function makeDraggable(panel, handle) {
    if (!handle || !panel) return;
    var ox=0, oy=0, drag=false;
    handle.addEventListener('mousedown', function(e) {
      drag=true;
      var r = panel.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!drag) return;
      panel.style.left   = (e.clientX - ox) + 'px';
      panel.style.top    = (e.clientY - oy) + 'px';
      panel.style.right  = 'auto';
      panel.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', function() { drag = false; });
  }

  /* ─── Cria painel ────────────────────────────────────────── */
  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    if (!document.getElementById('a4c-styles')) {
      var style = document.createElement('style');
      style.id  = 'a4c-styles';
      style.textContent = [
        '@keyframes a4c-spin { to { transform:rotate(360deg); } }',
        '@keyframes a4c-fadein { from { opacity:0;transform:scale(0.95) translateY(8px); } to { opacity:1;transform:scale(1) translateY(0); } }',
        '#' + PANEL_ID + ' { animation:a4c-fadein 0.2s ease; }',
        '#' + PANEL_ID + ' input:focus { border-color:#3b82f6 !important; box-shadow:0 0 0 3px rgba(59,130,246,0.15); }',
      ].join('');
      document.head.appendChild(style);
    }

    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
      position:     'fixed',
      bottom:       '72px',
      right:        '24px',
      width:        '300px',
      background:   '#ffffff',
      borderRadius: '16px',
      boxShadow:    '0 8px 40px rgba(0,0,0,0.2),0 2px 8px rgba(0,0,0,0.08)',
      zIndex:       '2147483640',
      fontFamily:   'system-ui,-apple-system,sans-serif',
      overflow:     'hidden',
      display:      'none',
    });

    document.body.appendChild(panel);
    render();
  }

  function openPanel() {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    if (panel.style.display === 'none' || panel.style.display === '') {
      panel.style.display = 'block';
      if (state.screen === 'dialer') {
        var phone = extractPhone();
        if (phone) state.phone = phone;
        render();
      }
    } else {
      panel.style.display = 'none';
    }
  }

  /* ─── Botão GHL header ───────────────────────────────────── */
  function findAnchor() {
    var btns = document.querySelectorAll('button');
    for (var i=0; i<btns.length; i++) {
      var btn = btns[i];
      var text = btn.textContent.trim();
      if (text==='Call'||text.endsWith('Call')) {
        var rgb = window.getComputedStyle(btn).backgroundColor.match(/\d+/g);
        if (rgb) {
          var r=+rgb[0],g=+rgb[1],b=+rgb[2];
          if (g>r&&g>b&&g>80) return btn;
        }
      }
    }
    return document.querySelector('button[id*="call"],button[class*="call"],button[id*="wa-"]');
  }

  function isRelevantPage() {
    return location.href.includes('/conversations') || location.href.includes('/contacts');
  }

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;
    var anchor = findAnchor();
    if (!anchor) return;

    var h = anchor.offsetHeight || 32;
    var btn = document.createElement('button');
    btn.id = BTN_ID;
    Object.assign(btn.style, {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '0 14px', height: h+'px',
      background: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
      color: '#fff', border: 'none', borderRadius: '8px',
      fontSize: '13px', fontWeight: '600',
      fontFamily: 'system-ui,-apple-system,sans-serif',
      cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
      letterSpacing: '0.2px', whiteSpace: 'nowrap',
      transition: 'filter 0.15s', marginRight: '8px', verticalAlign: 'middle',
    });
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .91h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> Ligar';
    btn.addEventListener('mouseenter', function() { btn.style.filter='brightness(1.15)'; });
    btn.addEventListener('mouseleave', function() { btn.style.filter='brightness(1)'; });
    btn.addEventListener('click', openPanel);
    anchor.parentNode.insertBefore(btn, anchor);
    console.log('[Api4com] Botão v5 injetado ✓');
  }

  function removeButton() {
    var el = document.getElementById(BTN_ID);
    if (el) el.remove();
  }

  /* ─── SPA Observer + Init ────────────────────────────────── */
  var lastUrl = location.href;
  var timer   = null;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function() {
      if (isRelevantPage()) injectButton();
      else removeButton();
    }, 800);
  }

  new MutationObserver(function() {
    if (location.href !== lastUrl) {
      lastUrl = location.href; removeButton(); schedule(); return;
    }
    if (isRelevantPage() && !document.getElementById(BTN_ID)) schedule();
  }).observe(document.body, { childList: true, subtree: true });

  function init() {
    loadSession();
    createPanel();
    if (isRelevantPage()) {
      injectButton();
      if (state.screen === 'connecting') {
        setTimeout(function() { initSip(); }, 1000);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Api4com GHL] v5.2 — JsSIP debug ✓');
})();
