/**
 * GHL — Menu "Tarefas" na Sidebar v1.3
 */
(function () {
  'use strict';

  const MENU_ID   = 'ghl-tarefas-menu';
  const TASKS_URL = 'https://app.gohighlevel.com/v2/location/QZyr1menFJpgYcMsi9a7/tasks';

  /* Path do ícone de Tasks nativo do GHL (clipboard com checklist) */
  const TASKS_PATH = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4';

  function injectMenuItem() {
    if (document.getElementById(MENU_ID)) return;

    /* Encontra âncora "Oportunidades" */
    let anchor = null;
    for (const el of document.querySelectorAll('a, li, button, [role="menuitem"]')) {
      const text = el.textContent.trim().toLowerCase();
      if (text === 'oportunidades' || text === 'opportunities') {
        anchor = el;
        break;
      }
    }
    if (!anchor) return;

    /* Clona e limpa */
    const menuItem = anchor.cloneNode(true);
    menuItem.id = MENU_ID;
    menuItem.classList.remove(
      'active', 'router-link-active', 'router-link-exact-active'
    );
    menuItem.removeAttribute('aria-current');
    menuItem.removeAttribute('href');
    menuItem.style.cursor = 'pointer';

    /* Atualiza o texto — percorre todos os nós de texto */
    const walker = document.createTreeWalker(
      menuItem, NodeFilter.SHOW_TEXT, null, false
    );
    let node;
    while ((node = walker.nextNode())) {
      if (/oportunidades|opportunities/i.test(node.textContent)) {
        node.textContent = node.textContent
          .replace(/Oportunidades/i, 'Tarefas')
          .replace(/Opportunities/i, 'Tasks');
      }
    }

    /* Substitui APENAS o path dentro do SVG existente
       (preserva o <i> e o <svg> com todas as classes do GHL) */
    const existingSvg = menuItem.querySelector('svg');
    if (existingSvg) {
      existingSvg.innerHTML =
        `<path stroke-linecap="round" stroke-linejoin="round" d="${TASKS_PATH}"/>`;
    }

    /* Remove ID do ícone herdado do Oportunidades */
    const iconEl = menuItem.querySelector('[id*="sidebar"]');
    if (iconEl) iconEl.removeAttribute('id');

    /* Navegação direta para tasks */
    menuItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = TASKS_URL;
    });

    anchor.parentNode.insertBefore(menuItem, anchor.nextSibling);
    console.log('[Tarefas v1.3] Menu injetado com ícone correto');
  }

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
