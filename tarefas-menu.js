/**
 * GHL — Menu "Tarefas" na Sidebar v1.5
 */
(function () {
  'use strict';

  const MENU_ID   = 'ghl-tarefas-menu';
  const TASKS_URL = 'https://app.gohighlevel.com/v2/location/QZyr1menFJpgYcMsi9a7/tasks';
  const ICON_URL  = 'https://cdn.msgsndr.com/sidebar-v2/icon_tasks.svg';
  const ICON_FALLBACK = 'https://cdn.msgsndr.com/sidebar-v2/icon_contacts.svg';

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

    /* Troca o src da <img> do ícone */
    const img = menuItem.querySelector('img');
    if (img) {
      img.src = ICON_URL;
      img.alt = 'Tarefas icon';
      /* Se icon_tasks.svg não existir, cai no fallback */
      img.onerror = function () {
        this.src = ICON_FALLBACK;
        this.onerror = null;
      };
    }

    menuItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = TASKS_URL;
    });

    anchor.parentNode.insertBefore(menuItem, anchor.nextSibling);
    console.log('[Tarefas v1.5] Injetado');
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
