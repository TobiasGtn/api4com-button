// API4Com Button Library v1.0
(function() {
  'use strict';
  
  // Configurações
  const CONFIG = {
    buttonId: 'call-api4com-btn',
    apiEndpoint: 'https://api.api4com.com/api/v1/dialer',
    apiToken: localStorage.getItem('api4com_token' ) || window.API4COM_TOKEN || null
  };

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Observar mudanças na página (para quando navegar entre contatos)
    const observer = new MutationObserver(function() {
      injetarBotao();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    // Chamar uma vez na inicialização
    injetarBotao();
  }

  function injetarBotao() {
    // Verificar se o botão já foi injetado
    if (document.getElementById(CONFIG.buttonId)) {
      return;
    }

    // Procurar pelo botão de WhatsApp (Stevo) para inserir ao lado
    const botaoWhatsApp = document.getElementById('call-stevo-btn');
    let containerBotoes = null;

    if (botaoWhatsApp) {
      containerBotoes = botaoWhatsApp.parentNode;
    } else {
      // Se não encontrar Stevo, procurar por outros containers de botões
      containerBotoes = document.querySelector('[class*="action"]') || 
                        document.querySelector('[class*="header"]') ||
                        document.querySelector('[class*="contact"]');
    }

    if (!containerBotoes) {
      return;
    }

    // Criar botão
    const botao = document.createElement('button');
    botao.id = CONFIG.buttonId;
    botao.title = 'Make call via API4Com';
    botao.textContent = '☎️';
    
    // Aplicar estilos (idêntico ao Stevo, mas cinza)
    botao.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      font-size: 13px;
      font-weight: 500;
      color: #ffffff;
      background: linear-gradient(135deg, #808080 0%, #606060 100%);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-right: 8px;
      box-shadow: 0 1px 3px rgba(128, 128, 128, 0.3);
      height: 32px;
      line-height: 1;
    `;

    // Hover effect
    botao.addEventListener('mouseover', function() {
      this.style.background = 'linear-gradient(135deg, #707070 0%, #505050 100%)';
    });
    botao.addEventListener('mouseout', function() {
      this.style.background = 'linear-gradient(135deg, #808080 0%, #606060 100%)';
    });

    // Evento de clique
    botao.addEventListener('click', function(e) {
      e.preventDefault();
      acionarDiscador();
    });

    // Inserir ANTES do botão de WhatsApp (fica à esquerda)
    if (botaoWhatsApp) {
      botaoWhatsApp.parentNode.insertBefore(botao, botaoWhatsApp);
    } else {
      containerBotoes.appendChild(botao);
    }
  }

  function acionarDiscador() {
    // Extrair telefone
    const telefone = extrairTelefone();
    if (!telefone) {
      alert('❌ Não foi possível encontrar o número de telefone');
      return;
    }

    // Extrair ramal
    const ramal = extrairRamal();
    if (!ramal) {
      alert('❌ Não foi possível obter seu ramal');
      return;
    }

    // Verificar token
    if (!CONFIG.apiToken) {
      alert('❌ Token da API4Com não configurado');
      return;
    }

    // Desabilitar botão durante a requisição
    const botao = document.getElementById(CONFIG.buttonId);
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = '⏳';

    // Fazer requisição
    fetch(CONFIG.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CONFIG.apiToken
      },
      body: JSON.stringify({
        extension: ramal,
        phone: telefone,
        metadata: {
          origem: 'GHL_API4Com_Library',
          timestamp: new Date().toISOString()
        }
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('✅ Discador acionado:', data);
      botao.textContent = '✅';
      setTimeout(() => {
        botao.textContent = textoOriginal;
        botao.disabled = false;
      }, 2000);
    })
    .catch(error => {
      console.error('❌ Erro:', error);
      botao.textContent = '❌';
      setTimeout(() => {
        botao.textContent = textoOriginal;
        botao.disabled = false;
      }, 2000);
    });
  }

  function extrairTelefone() {
    // Tentar várias formas de encontrar o telefone
    const telefoneInput = document.querySelector('input[type="tel"]');
    if (telefoneInput && telefoneInput.value) {
      return telefoneInput.value;
    }

    const telefoneData = document.querySelector('[data-phone]');
    if (telefoneData && telefoneData.textContent) {
      return telefoneData.textContent.trim();
    }

    // Procurar por padrão de telefone na página
    const pageText = document.body.innerText;
    const match = pageText.match(/\+?[\d\s\-\(\)]{10,}/);
    if (match) {
      return match[0];
    }

    return null;
  }

  function extrairRamal() {
    // Tentar várias formas de encontrar o ramal
    const ramalStorage = localStorage.getItem('user_ramal') || 
                         localStorage.getItem('extension') ||
                         localStorage.getItem('phone_extension');
    if (ramalStorage) return ramalStorage;

    if (window.userRamal) return window.userRamal;
    if (window.currentUser && window.currentUser.extension) return window.currentUser.extension;

    const ramalElement = document.querySelector('[data-ramal]') ||
                         document.querySelector('[class*="ramal"]') ||
                         document.querySelector('[class*="extension"]');
    if (ramalElement) return ramalElement.textContent.trim();

    return null;
  }

  // Expor função para configurar token dinamicamente
  window.API4ComButton = {
    setToken: function(token) {
      CONFIG.apiToken = token;
      localStorage.setItem('api4com_token', token);
    },
    getToken: function() {
      return CONFIG.apiToken;
    }
  };
})();
