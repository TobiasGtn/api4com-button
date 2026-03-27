/**
 * GHL — Menu "Tarefas" + Badge Conversas v3.6
 * - Navegação SPA nativa (sem reload)
 * - Badge estilo nativo GHL (azul, quadrado com cantos arredondados)
 * - Atualização por debounce (3s após interação)
 *
 * No GHL Whitelabel > Custom Scripts:
 * <script
 *   src="https://tobiasgtn.github.io/api4com-button/tarefas-menu.js?v=3.6"
 *   data-n8n="https://n8n.imperadorautomacoes.com.br/webhook/ghl-tasks-count">
 * </script>
 */
(function () {
  'use strict';

  const _script = document.currentScript;
  const _n8nUrl = _script?.dataset.n8n || null;

  const MENU_ID       = 'ghl-tarefas-menu';
  const BADGE_ID      = 'ghl-tarefas-badge';
  const CONV_BADGE_ID = 'ghl-conversas-badge';

  const TASKS_PATH = 'M16 4c.93 0 1.395 0 1.776.102a3 3 0 012.122 2.122C20 6.605 20 7.07 20 8v9.2c0 1.68 0 2.52-.327 3.162a3 3 0 01-1.311 1.311C17.72 22 16.88 22 15.2 22H8.8c-1.68 0-2.52 0-3.162-.327a3 3 0 01-1.311-1.311C4 19.72 4 18.88 4 17.2V8c0-.93 0-1.395.102-1.776a3 3 0 012.122-2.122C6.605 4 7.07 4 8 4m1 1l2 2 4.5-4.5M9.6 6h4.8c.56 0 .84 0 1.054-.109a1 1 0 00.437-.437C16 5.24 16 4.96 16 4.4v-.8c0-.56 0-.84-.109-1.054a1 1 0 00-.437-.437C15.24 2 14.96 2 14.4 2H9.6c-.56 0-.84 0-1.054.109a1 1 0 00-.437.437C8 2.76 8 3.04 8 3.6v.8c0 .56 0 .84.109 1.054a1 1 0 00.437.437C8.76 6 9.04 6 9.6 6z';

  /* ─── Helpers ─── */
  function getLocationId() {
    const match = window.location.pathname.match(/\/location\/([^/]+)/);
    return match ? match[1] : null;
  }

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

  function waitForUserId(callback) {
    const id = getUserId();
    if (id) { callback(id); return; }
    let attempts = 0;
    const iv = setInterval(() => {
      attempts++;
      const uid = getUserId();
      if (uid) { clearInterval(iv); callback(uid); return; }
      if (attempts > 100) { clearInterval(iv); callback(null); }
    }, 100);
  }

  /* ─── Badge estilo nativo GHL ─── */
  function createBadge(id) {
    const b = document.createElement('span');
    b.id = id;
    Object.assign(b.style, {
      display:        'none',
      alignItems:     'center',
      justifyContent: 'center',
      minWidth:       '18px',
      height:         '18px',
      padding:        '0 5px',
      borderRadius:   '4px',       /* quadrado com cantos arredondados */
      background:     '#155eef',   /* azul nativo do GHL */
      color:          '#fff',
      fontSize:       '11px',
      fontWeight:     '700',
      lineHeight:     '1',
      marginLeft:     'auto',
      letterSpacing:  '0px',
    });
    return b;
  }

  function updateBadge(id, count) {
    const b = document.getElementById(id);
    if (!b) return;
    b.textContent   = count > 99 ? '99+' : String(count);
    b.style.display = 'flex';
    /* Azul quando zerado, vermelho quando há pendências */
    b.style.background = count === 0 ? '#6b7280' : '#0891b2';
  }

  /* ─── Busca tarefas + conversas em uma única chamada ao N8N ─── */
  async function fetchCounts(locationId, userId) {
    if (!_n8nUrl || !locationId || !userId) {
      return { tasks: 0, conversations: 0 };
    }
    try {
      const url = `${_n8nUrl}?locationId=${locationId}&userId=${userId}`;
      const r = await fetch(url);
      if (!r.ok) return { tasks: 0, conversations: 0 };
      const d = await r.json();
      return {
        tasks:         typeof d.tasks         === 'number' ? d.tasks         : 0,
        conversations: typeof d.conversations === 'number' ? d.conversations : 0,
      };
    } catch {
      return { tasks: 0, conversations: 0 };
    }
  }

  /* ─── Badge de Conversas no menu ─── */
  function injectConvBadge() {
    if (document.getElementById(CONV_BADGE_ID)) return;

    const anchor = document.querySelector('[meta="conversations"]')
      || (() => {
        for (const el of document.querySelectorAll('a, li, button, [role="menuitem"]')) {
          const t = el.textContent.trim().toLowerCase();
          if (t === 'conversas' || t === 'conversations') return el;
        }
        return null;
      })();

    if (!anchor) return;
    Object.assign(anchor.style, { display: 'flex', alignItems: 'center' });
    anchor.appendChild(createBadge(CONV_BADGE_ID));
    console.log('[Conversas v3.6] Badge injetado');
  }

  /* ─── Menu Tarefas ─── */
  function injectTasksMenu() {
    if (document.getElementById(MENU_ID)) return;

    /* Âncora robusta: atributo meta="contacts" — fixo em todas as subcontas */
    const anchor = document.querySelector('[meta="contacts"]');
    if (!anchor) return;

    const locationId = getLocationId();
    const tasksUrl   = locationId
      ? `/v2/location/${locationId}/tasks`
      : '/contacts';

    const item = anchor.cloneNode(true);
    item.id = MENU_ID;
    item.classList.remove('active', 'router-link-active', 'router-link-exact-active');
    item.removeAttribute('aria-current');
    item.removeAttribute('meta');

    /* Navegação SPA — deixa o Vue Router do GHL interceptar o clique */
    item.setAttribute('href', tasksUrl);
    item.style.cursor = 'pointer';

    /* Atualiza texto */
    const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      if (/contatos|contacts/i.test(node.textContent)) {
        node.textContent = node.textContent
          .replace(/Contatos/i, 'Tarefas')
          .replace(/Contacts/i, 'Tasks');
      }
    }

    /* Substitui ícone */
    const img = item.querySelector('img');
    if (img) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('class', img.className);
      svg.style.cssText = img.style.cssText;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('d', TASKS_PATH);
      svg.appendChild(p);
      img.parentNode.replaceChild(svg, img);
    }

    item.id = MENU_ID;
    item.appendChild(createBadge(BADGE_ID));

    /* Insere depois de Contatos */
    anchor.parentNode.insertBefore(item, anchor.nextSibling);
    console.log('[Tarefas v3.6] Injetado | locationId:', locationId);

    /* Aguarda userId e configura refresh por interação */
    waitForUserId((userId) => {
      console.log('[Tarefas v3.6] userId:', userId);

      function refresh() {
        fetchCounts(locationId, userId).then(({ tasks, conversations }) => {
          updateBadge(BADGE_ID, tasks);
          updateBadge(CONV_BADGE_ID, conversations);
        });
      }

      /* Primeira carga imediata */
      refresh();

      /* Debounce — atualiza 3s após última interação do usuário */
      let debounceTimer = null;
      function scheduleRefresh() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(refresh, 3000);
      }

      document.addEventListener('click', scheduleRefresh, true);
      document.addEventListener('keydown', scheduleRefresh, true);

      console.log('[Tarefas v3.6] Debounce ativo');
    });
  }

  /* ─── Observer ─── */
  let lastUrl = location.href;
  let timer   = null;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      injectTasksMenu();
      injectConvBadge();
    }, 800);
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
