/**
 * GHL — Menu "Tarefas" na Sidebar v1.4
 */
(function () {
  'use strict';

  const MENU_ID   = 'ghl-tarefas-menu';
  const TASKS_URL = 'https://app.gohighlevel.com/v2/location/QZyr1menFJpgYcMsi9a7/tasks';

  const TASKS_PATH = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01';

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

    /* Substitui ícone via createElementNS */
    const existingSvg = menuItem.querySelector('svg');
    if (existingSvg) {
      while (existingSvg.firstChild) existingSvg.removeChild(existingSvg.firstChild);
      const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      newPath.setAttribute('stroke-linecap', 'round');
      newPath.setAttribute('stroke-linejoin', 'round');
      newPath.setAttribute('d', TASKS_PATH);
      existingSvg.appendChild(newPath);
    }

    const iconEl = menuItem.querySelector('[id*="sidebar"]');
    if (iconEl) iconEl.removeAttribute('id');

    menuItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = TASKS_URL;
    });

    anchor.parentNode.insertBefore(menuItem, anchor.nextSibling);
    console.log('[Tarefas v1.4] Injetado');
  }

  let lastUrl = location.href;
  let timer = null;

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
