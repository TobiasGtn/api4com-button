/**
 * GHL — Menu "Tarefas" na Sidebar v1.2
 */
(function () {
  'use strict';

  const MENU_ID     = 'ghl-tarefas-menu';
  const TASKS_URL   = 'https://app.gohighlevel.com/v2/location/QZyr1menFJpgYcMsi9a7/tasks';

  const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="2" width="6" height="4" rx="1"/>
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>`;

  function injectMenuItem() {
    if (document.getElementById(MENU_ID)) return;

    /* Encontra âncora "Oportunidades" */
    let anchor = null;
    for (const el of document.querySelectorAll('a, li, [role="menuitem"]')) {
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

    /* Atualiza texto — encontra o nó de texto folha */
    const allEls = menuItem.querySelectorAll('*');
    for (const el of allEls) {
      const t = el.textContent.trim().toLowerCase();
      if (t === 'oportunidades' || t === 'opportunities') {
        /* Altera apenas o textNode direto */
        for (const node of el.childNodes) {
          if (node.nodeType === 3 &&
              node.textContent.trim().toLowerCase()
                .match(/oportunidades|opportunities/)) {
            node.textContent = node.textContent
              .replace(/Oportunidades/i, 'Tarefas')
              .replace(/Opportunities/i, 'Tasks');
          }
        }
        break;
      }
    }

    /* Substitui o ícone SVG */
    const existingSvg = menuItem.querySelector('svg');
    if (existingSvg) {
      const tmp = document.createElement('span');
      tmp.innerHTML = ICON_SVG;
      existingSvg.parentNode.replaceChild(tmp.firstChild, existingSvg);
    }

    /* Navegação direta */
    menuItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = TASKS_URL;
    });

    anchor.parentNode.insertBefore(menuItem, anchor.nextSibling);
    console.log('[Tarefas v1.2] Menu injetado');
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
