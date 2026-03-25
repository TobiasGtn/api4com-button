/**
 * GHL — Menu "Tarefas" na Sidebar v1.1
 * Settings > Whitelabel > Custom Scripts
 */
(function () {
  'use strict';

  const MENU_ID = 'api4com-tarefas-menu';

  /* Ícone de atividades do GHL (clipboard com check) */
  const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="2" width="6" height="4" rx="1" ry="1"/>
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>`;

  function getLocationId() {
    const match = window.location.pathname.match(
      /\/v2\/location\/([^/]+)/
    );
    return match ? match[1] : null;
  }

  function navigateToTasks() {
    const locationId = getLocationId();
    if (!locationId) {
      console.warn('[Tarefas] locationId não encontrado na URL');
      return;
    }
    const target = `/v2/location/${locationId}/tasks`;
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  function injectMenuItem() {
    if (document.getElementById(MENU_ID)) return;

    let anchor = null;
    const allLinks = document.querySelectorAll(
      'a, [role="menuitem"], li, .hl-nav-item'
    );

    for (const el of allLinks) {
      const text = el.textContent.trim().toLowerCase();
      if (
        (text === 'oportunidades' || text === 'opportunities') &&
        el.closest('nav, aside, [class*="sidebar"], [class*="menu"]')
      ) {
        anchor = el;
        break;
      }
    }

    if (!anchor) return;

    const menuItem = anchor.cloneNode(true);
    menuItem.id = MENU_ID;
    menuItem.removeAttribute('href');
    menuItem.removeAttribute('data-link-type');
    menuItem.style.cursor = 'pointer';

    /* Atualiza o texto */
    const textNode = [...menuItem.querySelectorAll('*')]
      .find(el =>
        el.textContent.trim().toLowerCase() === 'oportunidades' ||
        el.textContent.trim().toLowerCase() === 'opportunities'
      );
    if (textNode) textNode.textContent = 'Tarefas';

    /* Substitui o ícone */
    menuItem.innerHTML = menuItem.innerHTML
      .replace(/<svg[\s\S]*?<\/svg>/, ICON_SVG);

    /* Remove estado ativo herdado */
    menuItem.classList.remove(
      'active', 'router-link-active', 'router-link-exact-active'
    );
    menuItem.removeAttribute('aria-current');

    menuItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigateToTasks();
    });

    anchor.parentNode.insertBefore(menuItem, anchor.nextSibling);
    console.log('[Tarefas] Menu injetado');
  }

  let lastUrl = location.href;
  let timer = null;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(injectMenuItem, 600);
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
