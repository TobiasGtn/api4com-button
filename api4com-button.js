// API4Com Button Library v2.0 - Improved Version
(function() {
  'use strict';
  
  // Configurações
  const CONFIG = {
    buttonId: 'call-api4com-btn',
    apiEndpoint: 'https://api.api4com.com/api/v1/dialer',
    apiToken: localStorage.getItem('api4com_token' ) || window.API4COM_TOKEN || null,
    maxAttempts: 20,
    attemptDelay: 500
  };

  let attempts = 0;

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  function iniciar() {
    // Aguardar um pouco para o Stevo carregar
    setTimeout(function() {
      tentarInjetarBotao();
      
      // Observar mudanças na página (para quando navegar entre contatos)
      const observer = new MutationObserver(function() {
        tentarInjetarBotao();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }, 1000);
  }

  function tentarInjetarBotao() {
    // Verificar se o botão já foi injetado
    if (document.getElementById(CONFIG.buttonId)) {
      return;
    }

    // Procurar pelo botão de WhatsApp (Stevo)
    const botaoWhatsApp = document.getElementById('call-stevo-btn');
    
    if (botaoWhatsApp) {
      // Se encontrou o Stevo, injetar o botão
      injetarBotao(botaoWhatsApp);
      attempts = 0; // Reset attempts
    } else if (attempts < CONFIG.maxAttempts) {
      // Se não encontrou, tentar novamente
      attempts++;
      setTimeout(tentarInjetarBotao, CONFIG.attemptDelay);
    } else {
      // Se esgotou as tentativas, procurar por um container alternativo
      injetarBotaoEmContainerAlternativo();
    }
  }

  function injetarBotao(botaoWhatsApp) {
    const containerBotoes = botaoWhatsApp.parentNode;
    
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
    containerBotoes.insertBefore(botao, botaoWhatsApp);
    
    console.log('✅ Botão API4Com injetado com sucesso!');
  }

  function injetarBotaoEmContainerAlternativo() {
    // Se não encontrou o Stevo, procurar por containers alternativos
    const containerBotoes = document.querySelector('[class*="action"]') || 
                            document.querySelector('[class*="header"]') ||
                            document.querySelector('[class*="contact"]') ||
                            document.querySelector('header') ||
                            document.querySelector('[role="toolbar"]');

    if (!containerBotoes) {
      console.warn('⚠️ Não foi possível encontrar um container para o botão');
      return;
    }

    // Criar botão
    const botao = document.createElement('button');
    botao.id = CONFIG.buttonId;
    botao.title = 'Make call via API4Com';
    botao.textContent = '☎️';
    
    // Aplicar estilos
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

    // Inserir no container
    containerBotoes.appendChild(botao);
    
    console.log('✅ Botão API4Com injetado em container alternativo!');
  }

  function acionarDiscador() {
    // Extrair telefone
    const telefone = extrairTelefone();
    if (!telefone) {
      alert('❌ Não foi possível encontrar o número de telefone');
      console.error('Telefone não encontrado');
      return;
    }

    console.log('📞 Telefone encontrado:', telefone);

    // Extrair ramal
    const ramal = extrairRamal();
    if (!ramal) {
      alert('❌ Não foi possível obter seu ramal');
      console.error('Ramal não encontrado');
      return;
    }

    console.log('📱 Ramal encontrado:', ramal);

    // Verificar token
    if (!CONFIG.apiToken) {
      alert('❌ Token da API4Com não configurado');
      console.error('Token não configurado');
      return;
    }

    console.log('🔑 Token configurado');

    // Desabilitar botão durante a requisição
    const botao = document.getElementById(CONFIG.buttonId);
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = '⏳';

    console.log('🚀 Enviando requisição para API4Com...');

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
          origem: 'GHL_API4Com_Library_v2',
          timestamp: new Date().toISOString()
        }
      })
    })
    .then(response => {
      console.log('📡 Resposta recebida:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('✅ Discador acionado com sucesso:', data);
      botao.textContent = '✅';
      setTimeout(() => {
        botao.textContent = textoOriginal;
        botao.disabled = false;
      }, 2000);
    })
    .catch(error => {
      console.error('❌ Erro ao acionar discador:', error);
      botao.textContent = '❌';
      setTimeout(() => {
        botao.textContent = textoOriginal;
        botao.disabled = false;
      }, 2000);
    });
  }

  function extrairTelefone() {
    // Tentar várias formas de encontrar o telefone
    
    // 1. Input de telefone
    const telefoneInput = document.querySelector('input[type="tel"]');
    if (telefoneInput && telefoneInput.value) {
      return telefoneInput.value;
    }

    // 2. Data attribute
    const telefoneData = document.querySelector('[data-phone]');
    if (telefoneData && telefoneData.textContent) {
      return telefoneData.textContent.trim();
    }

    // 3. Procurar por padrão de telefone na página
    const pageText = document.body.innerText;
    const match = pageText.match(/\+?[\d\s\-\(\)]{10,}/);
    if (match) {
      return match[0];
    }

    // 4. Procurar em inputs com placeholder de telefone
    const inputs = document.querySelectorAll('input');
    for (let input of inputs) {
      if ((input.placeholder && input.placeholder.toLowerCase().includes('phone')) ||
          (input.name && input.name.toLowerCase().includes('phone'))) {
        if (input.value) {
          return input.value;
        }
      }
    }

    return null;
  }

  function extrairRamal() {
    // Tentar várias formas de encontrar o ramal
    
    // 1. localStorage
    const ramalStorage = localStorage.getItem('user_ramal') || 
                         localStorage.getItem('extension') ||
                         localStorage.getItem('phone_extension');
    if (ramalStorage) return ramalStorage;

    // 2. window object
    if (window.userRamal) return window.userRamal;
    if (window.currentUser && window.currentUser.extension) return window.currentUser.extension;

    // 3. Data attribute
    const ramalElement = document.querySelector('[data-ramal]') ||
                         document.querySelector('[class*="ramal"]') ||
                         document.querySelector('[class*="extension"]');
    if (ramalElement) return ramalElement.textContent.trim();

    // 4. Pedir ao usuário
    return prompt('Digite seu ramal/extensão:');
  }

  // Expor função para configurar token dinamicamente
  window.API4ComButton = {
    setToken: function(token) {
      CONFIG.apiToken = token;
      localStorage.setItem('api4com_token', token);
      console.log('✅ Token configurado com sucesso');
    },
    getToken: function() {
      return CONFIG.apiToken;
    },
    debug: function() {
      console.log('=== API4Com Button Debug ===');
      console.log('Token:', CONFIG.apiToken ? '✅ Configurado' : '❌ Não configurado');
      console.log('Botão Stevo:', document.getElementById('call-stevo-btn') ? '✅ Encontrado' : '❌ Não encontrado');
      console.log('Botão API4Com:', document.getElementById(CONFIG.buttonId) ? '✅ Encontrado' : '❌ Não encontrado');
      console.log('Telefone:', extrairTelefone() || '❌ Não encontrado');
      console.log('Ramal:', extrairRamal() || '❌ Não encontrado');
    }
  };

  console.log('✅ API4Com Button Library v2.0 carregada');
})();
