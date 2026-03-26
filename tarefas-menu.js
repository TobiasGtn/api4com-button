/**
 * GHL — Menu "Tarefas" + Badge Conversas v3.3
 * Base: v2.0 (estável) + badge de conversas via setInterval seguro
 *
 * No GHL Whitelabel > Custom Scripts:
 * <script
 *   src="https://tobiasgtn.github.io/api4com-button/tarefas-menu.js?v=3.3"
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

  function createBadge(id) {
    const b = document.createElement('span');
    b.id = id;
    Object.assign(b.style, {
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
    return b;
  }

  function updateBadge(id, count) {
    const b = document.getElementById(id);
    if (!b) return;
    b.textContent      = count > 99 ? '99+' : String(count);
    b.style.display    = 'flex';
    b.style.background = count === 0 ? '#6b7280' : '#ef4444';
  }

  /* ─── Badge de Conversas ─── */
  function readConvCount() {
    const tabs = document.querySelectorAll('button, [role="tab"]');
    for (const tab of tabs) {
      if (/não lidos|unread/i.test(tab.textContent)) {
        const num = tab.textContent.match(/\d+/);
        if (num) return parseInt(num[0]);
      }
    }
    return 0;
  }

  function injectConvBadge() {
    if (document.getElementById(CONV_BADGE_ID)) return;
    let anchor = null;
    for (const el of document.querySelectorAll('a, li, button, [role="menuitem"]')) {
      const t = el.textContent.trim().toLowerCase();
      if (t === 'conversas' || t === 'conversations') {
        anchor = el;
        break;
      }
    }
    if (!anchor) return;
    Object.assign(anchor.style, { display: 'flex', alignItems: 'center' });
    anchor.appendChild(createBadge(CONV_BADGE_ID));
    console.log('[Conversas v3.3] Badge injetado');
  }

  function syncConvBadge() {
    const b = document.getElementById(CONV_BADGE_ID);
    if (!b) { injectConvBadge(); return; }
    updateBadge(CONV_BADGE_ID, readConvCount());
  }

  /* ─── Badge de Tarefas ─── */
  async function fetchTaskCount(locationId, userId) {
    if (!_n8nUrl || !locationId || !userId) return 0;
    try {
      const r = await fetch(`${_n8nUrl}?locationId=${locationId}&userId=${userId}`);
      if (!r.ok) return 0;
      const d = await r.json();
      return typeof d.count === 'number' ? d.count : 0;
    } catch { return 0; }
  }

  /* ─── Menu Tarefas ─── */
  function injectTasksMenu() {
    if (document.getElementById(MENU_ID)) return;

    let anchor = null;
    for (const el of document.querySelectorAll('a, li, button, [role="menuitem"]')) {
      const t = el.textContent.trim().toLowerCase();
      if (t === 'oportunidades' || t === 'opportunities') {
        anchor = el; break;
      }
    }
    if (!anchor) return;

    const locationId = getLocationId();
    const tasksUrl   = locationId
      ? `https://app.gohighlevel.com/v2/location/${locationId}/tasks`
      : 'https://app.gohighlevel.com/contacts';

    const item = anchor.cloneNode(true);
    item.id = MENU_ID;
    item.classList.remove('active', 'router-link-active', 'router-link-exact-active');
    item.removeAttribute('aria-current');
    item.removeAttribute('href');
    item.style.cursor = 'pointer';

    const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      if (/oportunidades|opportunities/i.test(node.textContent)) {
        node.textContent = node.textContent
          .replace(/Oportunidades/i, 'Tarefas')
          .replace(/Opportunities/i, 'Tasks');
      }
    }

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

    item.appendChild(createBadge(BADGE_ID));
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = tasksUrl;
    });

    anchor.parentNode.insertBefore(item, anchor.nextSibling);
    console.log('[Tarefas v3.3] Injetado | locationId:', locationId);

    waitForUserId((userId) => {
      fetchTaskCount(locationId, userId).then(c => updateBadge(BADGE_ID, c));
      setInterval(() => fetchTaskCount(locationId, userId).then(c => updateBadge(BADGE_ID, c)), 2 * 60 * 1000);
    });
  }

  /* ─── Observer — igual à v2, sem nenhuma chamada DOM dentro ─── */
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
    /* SEM syncConversationsBadge() aqui — era o causador do travamento */
  }).observe(document.body, { childList: true, subtree: true });

  /* Badge de conversas atualiza via setInterval — só começa 5s após load */
  setTimeout(() => {
    syncConvBadge();
    setInterval(syncConvBadge, 30 * 1000);
  }, 5000);

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', schedule)
    : schedule();
})();
