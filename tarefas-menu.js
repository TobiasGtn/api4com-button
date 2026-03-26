(function () {
  'use strict';
  
  setTimeout(function() {
    try {
      var anchor = null;
      var els = document.querySelectorAll('a, li, button');
      for (var i = 0; i < els.length; i++) {
        var t = els[i].textContent.trim().toLowerCase();
        if (t === 'oportunidades' || t === 'opportunities') {
          anchor = els[i];
          break;
        }
      }
      if (!anchor) return;

      var item = anchor.cloneNode(true);
      item.id = 'ghl-tarefas-menu';
      item.style.cursor = 'pointer';

      var walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while ((node = walker.nextNode())) {
        if (/oportunidades|opportunities/i.test(node.textContent)) {
          node.textContent = node.textContent.replace(/Oportunidades/i, 'Tarefas');
        }
      }

      item.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var loc = window.location.pathname.match(/\/location\/([^/]+)/);
        if (loc) window.location.href = 'https://app.gohighlevel.com/v2/location/' + loc[1] + '/tasks';
      });

      anchor.parentNode.insertBefore(item, anchor.nextSibling);
      console.log('[Tarefas v3.2] OK');
    } catch(e) {
      console.error('[Tarefas v3.2] Erro:', e);
    }
  }, 2000);
})();
