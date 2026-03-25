/**
 * Api4com GHL — Menu "Tarefas" na Sidebar v1.0
 * Settings > Whitelabel > Custom Scripts
 */
(function () {
  'use strict';

  const MENU_ID = 'api4com-tarefas-menu';

  /* Ícone de checklist (estilo dos ícones nativos do GHL) */
  const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>`;

  function navigateToTasks() {
    /* Navega para /contacts via SPA */
    const currentPath = window.location.pathname;
    const isContacts = currentPath.includes('/contacts');

    function clickTasksTab() {
      /* Aguarda a aba "Tarefas" renderizar e clica */
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        const tabs = document.querySelectorAll(
          'a, button, [role="tab"], .nav-link, span'
        );
        for (const el of tabs) {
          const text = el.textContent.trim().toLowerCase();
          if (text === 'tarefas' || text === 'tasks') {
            el.click();
            clearInterval(interval);
            return;
          }
        }
        if (attempts > 30) clearInterval(interval); // timeout 3s
      }, 100);
    }

    if (isContacts) {
      clickTasksTab();
    } else {
      /* Usa o router do GHL (window.history) */
      window.history.pushState({}, '', '/contacts');
      window.dispatchEvent(new PopStateEvent('popstate'));
      setTimeout(clickTasksTab, 800);
    }
  }

  function injectMenuItem() {
    if (document.getElementById(MENU_ID)) return;

    /* Encontra o item "Oportunidades" como âncora */
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

    /* Clona o estilo do item nativo */
    const menuItem = anchor.cloneNode(true);
    menuItem.id = MENU_ID;

    /* Remove links/hrefs e sobrescreve conteúdo */
    menuItem.removeAttribute('href');
    menuItem.removeAttribute('data-link-type');
    menuItem.style.cursor = 'pointer';

    /* Substitui texto e ícone mantendo estrutura */
    const textNode = [...menuItem.querySelectorAll('*')]
      .find(el => el.textContent.trim().toLowerCase() === 'oportunidades'
               || el.textContent.trim().toLowerCase() === 'opportunities');

    if (textNode) {
      textNode.textContent = 'Tarefas';
    } else {
      menuItem.textContent = 'Tarefas';
    }

    /* Substitui o ícone SVG interno */
    const existingSvg = menuItem.querySelector('svg');
    if (existingSvg) {
      existingSvg.outerHTML = ICON_SVG;
      const newSvg = menuItem.querySelector('svg');
      if (newSvg) newSvg.outerHTML = ICON_SVG;
    }

    /* Injeta o HTML do ícone manualmente se não houver SVG */
    menuItem.innerHTML = menuItem.innerHTML
      .replace(/<svg[\s\S]*?<\/svg>/, ICON_SVG);

    /* Limpa estado "ativo" copiado do Oportunidades */
    menuItem.classList.remove(
      'active', 'router-link-active', 'router-link-exact-active'
    );
    menuItem.removeAttribute('aria-current');

    menuItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      /* Remove active de todos e ativa este */
      document.querySelectorAll('[id^="api4com"]').forEach(el =>
        el.classList.remove('active', 'router-link-active')
      );
      menuItem.classList.add('router-link-active');

      navigateToTasks();
    });

    /* Insere após o Oportunidades */
    anchor.parentNode.insertBefore(menuItem, anchor.nextSibling);
    console.log('[Api4com] Menu Tarefas injetado');
  }

  /* Observer para SPA */
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
