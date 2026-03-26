/**
 * GHL — Menu "Tarefas" com Badge v2.0
 * Funciona para qualquer subconta e qualquer usuário automaticamente
 *
 * No GHL Whitelabel > Custom Scripts:
 * <script
 *   src="https://tobiasgtn.github.io/api4com-button/tarefas-menu.js?v=2.0"
 *   data-n8n="https://n8n.imperadorautomacoes.com.br/webhook/ghl-tasks-count">
 * </script>
 */
(function () {
  'use strict';

  const _script  = document.currentScript;
  const _n8nUrl  = _script?.dataset.n8n || null;

  const MENU_ID  = 'ghl-tarefas-menu';
  const BADGE_ID = 'ghl-tarefas-badge';

  const TASKS_PATH = 'M16 4c.93 0 1.395 0 1.776.102a3 3 0 012.122 2.122C20 6.605 20 7.07 20 8v9.2c0 1.68 0 2.52-.327 3.162a3 3 0 01-1.311 1.311C17.72 22 16.88 22 15.2 22H8.8c-1.68 0-2.52 0-3.162-.327a3 3 0 01-1.311-1.311C4 19.72 4 18.88 4 17.2V8c0-.93 0-1.395.102-1.776a3 3 0 012.122-2.122C6.605 4 7.07 4 8 4m1 1l2 2 4.5-4.5M9.6 6h4.8c.56 0 .84 0 1.054-.109a1 1 0 00.437-.437C16 5.24 16 4.96 16 4.4v-.8c0-.56 0-.84-.109-1.054a1 1 0 00-.437-.437C15.24 2 14.96 2 14.4 2H9.6c-.56 0-.84 0-1.054.109a1 1 0 00-.437.437C8 2.76 8 3.04 8 3.6v.8c0 .56 0 .84.109 1.054a1 1 0 00.437.437C8.76 6 9.04 6 9.6 6z';

  /* ─── Extrai locationId da URL do browser ─── */
  function getLocationId() {
    const match = window.location.pathname.match(/\/location\/([^/]+)/);
    return match ? match[1] : null;
  }

  /* ─── Extrai userId das requisições já feitas pelo GHL ─── */
  function getUserId() {
    try {
      const entries = performance.getEntriesByType('resource');
      for (const entry of entries) {
        const match = entry.name.match(/[?&]userId=([^&]+)/);
        if (match) return match[1];
      }
    } catch (e) {}
    return null;
  }

  /* ─── Aguarda userId aparecer nas requisições (até 10s) ─── */
  function waitForUserId(callback) {
    const userId = getUserId();
    if (userId) { callback(userId); return; }
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const id = getUserId();
      if (id) {
        clearInterval(interval);
        callback(id);
        return;
      }
      if (attempts > 100) {
        clearInterval(interval);
        console.warn('[Tarefas] userId não encontrado após 10s');
        callback(null);
      }
    }, 100);
  }

  /* ─── Busca contagem no N8N ─── */
  async function fetchTaskCount(locationId, userId) {
    if (!_n8nUrl) {
      console.warn('[Tarefas] data-n8n não configurado');
      return 0;
    }
    if (!locationId || !userId) {
      console.warn('[Tarefas] locationId ou userId ausente', { locationId, userId });
      return 0;
    }
    try {
      const url = `${_n8nUrl}?locationId=${locationId}&userId=${userId}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn('[Tarefas] N8N retornou:', resp.status);
        return 0;
      }
      const data = await resp.json();
      return typeof data.count === 'number' ? data.count : 0;
    } catch (err) {
      console.warn('[Tarefas] Erro ao buscar contagem:', err);
      return 0;
    }
  }

  /* ─── Atualiza badge ─── */
  function updateBadge(count) {
    const badge = document.getElementById(BADGE_ID);
    if (!badge) return;
    badge.textContent      = count > 99 ? '99+' : String(count);
    badge.style.display    = 'flex';
    badge.style.background = count === 0 ? '#6b7280' : '#ef4444';
  }

  /* ─── Cria badge ─── */
  function createBadge() {
    const badge = document.createElement('span');
    badge.id = BADGE_ID;
    Object.assign(badge.style, {
      display:        'none',
      alignItems:     'center',
      justifyContent: 'center',
      minWidth:       '18px',
      height:         '18px',
      padding:        '0 4px',
      borderRadius:   '9px',
      background:     '#6b7280',
      color:          '#fff',
      fontSize:       '11px',
      fontWeight:     '600',
      lineHeight:     '1',
      marginLeft:     'auto',
    });
    return badge;
  }

  /* ─── Injeta menu ─── */
  function injectMenuItem() {
    if (document.getElementById(MENU_ID)) return;

    let anchor = null;
    for (const el of document.querySelectorAll('a, li, button, [role="menuitem"]')) {
      const text = el.textContent.trim().toLowerCase();
      if (text === 'oportunidades' || text === 'opportunities') {
        anchor = el;
        break;
      }
    }
    if (!anchor) return;

    const locationId = getLocationId();
    const tasksUrl   = locationId
      ? `https://app.gohighlevel.com/v2/location/${locationId}/tasks`
      : 'https://app.gohighlevel.com/contacts';

    const menuItem = anchor.cloneNode(true);
    menuItem.id = MENU_ID;
    menuItem.classList.remove('active', 'router-link-active', 'router-link-exact-active');
    menuItem.removeAttribute('aria-current');
    menuItem.removeAttribute('href');
    menuItem.style.cursor = 'pointer';

    /* Atualiza texto */
    const walker = document.createTreeWalker(menuItem, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      if (/oportunidades|opportunities/i.test(node.textContent)) {
        node.textContent = node.textContent
          .replace(/Oportunidades/i, 'Tarefas')
          .replace(/Opportunities/i, 'Tasks');
      }
    }

    /* Substitui ícone */
    const img = menuItem.querySelector('img');
    if (img) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('class', img.className);
      svg.style.cssText = img.style.cssText;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('d', TASKS_PATH);
      svg.appendChild(path);
      img.parentNode.replaceChild(svg, img);
    }

    /* Badge */
    menuItem.appendChild(createBadge());

    /* Navegação */
    menuItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = tasksUrl;
    });

    anchor.parentNode.insertBefore(menuItem, anchor.nextSibling);
    console.log('[Tarefas v2.0] Injetado | locationId:', locationId);

    /* Busca contagem aguardando userId */
    waitForUserId((userId) => {
      console.log('[Tarefas v2.0] userId:', userId);
      fetchTaskCount(locationId, userId).then(updateBadge);

      /* Atualiza a cada 2 minutos */
      setInterval(() => {
        fetchTaskCount(locationId, userId).then(updateBadge);
      }, 2 * 60 * 1000);
    });
  }

  /* ─── Observer SPA ─── */
  let lastUrl = location.href;
  let timer   = null;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(injectMenuItem, 700);
  }

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      schedule();
      return;
    }
    if (!document.getElementById(MENU_ID)) schedule();
  }).observe(document.body, { childList: true, subtree: true });

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', schedule)
    : schedule();
})();
