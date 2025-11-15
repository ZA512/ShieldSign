// ShieldSign - Popup Script

// ShieldSign - Popup Script

let currentHostname = '';
let currentStatus = null;

// Fonction de traduction des éléments avec data-i18n
function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.placeholder = message;
      } else if (element.tagName === 'OPTION') {
        element.textContent = message;
      } else {
        element.innerHTML = message;
      }
    }
  });
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
  translatePage();
  await loadCurrentPageStatus();
  await loadValidationInfo();
  
  // Gestionnaires d'événements
  document.getElementById('approveDomainBtn').addEventListener('click', approveDomain);
  document.getElementById('openOptionsBtn').addEventListener('click', openOptions);
  document.getElementById('refreshBtn').addEventListener('click', refresh);
});

// Afficher les informations de validation
async function loadValidationInfo() {
  try {
    // Ne plus afficher le pavé de validation code
    const codeSection = document.getElementById('validationCodeSection');
    if (codeSection) {
      codeSection.style.display = 'none';
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors du chargement des infos:', error);
  }
}

// Helper to get active tab in a cross-browser way
async function getActiveTab() {
  try {
    // Prefer Compat if available
    if (window.Compat && Compat.getActiveTab) return await Compat.getActiveTab();
  } catch (e) {}
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TAB' }, (tab) => { resolve(tab); });
    } catch (e) { resolve(null); }
  });
}

// Helper storageGet for popup (callback vs promise)
function storageGet(keys) {
  try { if (window.Compat && Compat.storageGet) return Compat.storageGet(keys); } catch (e) {}
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (res) => { resolve(res || {}); });
    } catch (e) {
      try {
        browser.storage.local.get(keys).then(res => resolve(res)).catch(() => resolve({}));
      } catch (err) { resolve({}); }
    }
  });
}

// Charger le statut de la page courante
async function loadCurrentPageStatus() {
  try {
    const tab = await getActiveTab();

    if (!tab || !tab.url) {
      updateStatus('none', chrome.i18n.getMessage('popupNoActivePage'), null, false);
      return;
    }
    
    const url = new URL(tab.url);
    currentHostname = url.hostname;
    
    // Vérifier si la page a un champ password
    const hasPassword = await checkForPasswordField(tab.id);
    
    if (!hasPassword) {
      updateStatus('none', chrome.i18n.getMessage('popupNoPasswordField'), null, false);
      document.getElementById('actionSection').style.display = 'none';
      return;
    }
    
    // Vérifier le statut avec toutes les listes
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'CHECK_PAGE', hostname: currentHostname }, (res) => resolve(res));
    });
    
    currentStatus = response;
    
    if (response && response.status === 'VALIDATED') {
      // Récupérer toutes les listes qui valident ce domaine
      const allValidatingLists = await getAllValidatingLists(currentHostname);
      updateStatus('validated', chrome.i18n.getMessage('popupValidated'), allValidatingLists, true);
      document.getElementById('actionSection').style.display = 'none';
    } else {
      updateStatus('unknown', chrome.i18n.getMessage('popupUnknown'), null, true);
      document.getElementById('actionSection').style.display = 'block';
    }
    
  } catch (error) {
    console.error('[ShieldSign] Erreur lors du chargement du statut:', error);
    updateStatus('none', chrome.i18n.getMessage('popupLoadError'), null, false);
  }
}

// Récupérer toutes les listes qui valident un domaine
async function getAllValidatingLists(hostname) {
  try {
    const { lists, user_whitelist } = await storageGet(['lists', 'user_whitelist']);
    const validatingLists = [];
    
    // Vérifier la liste personnelle
    if (user_whitelist && user_whitelist.includes(hostname)) {
      validatingLists.push({ name: chrome.i18n.getMessage('contentPersonalList'), type: 'personal' });
    }
    
    // Vérifier toutes les listes distantes
    if (lists) {
      for (const [url, listData] of Object.entries(lists)) {
        const enabled = listData.enabled !== false;
        
        if (enabled && listData.data && listData.data.domains) {
          if (listData.data.domains.includes(hostname)) {
            const type = listData.localType || 'community';
            const name = listData.data.list_name || url;
            validatingLists.push({ name, type });
          }
        }
      }
    }
    
    return validatingLists;
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la récupération des listes:', error);
    return [];
  }
}

// Vérifier si la page a un champ password
async function checkForPasswordField(tabId) {
  try {
    let results = null;
    // Prefer Compat wrapper if available
    if (window.Compat && Compat.executeScriptCompat) {
      results = await Compat.executeScriptCompat(tabId, () => !!document.querySelector('input[type="password"]'));
    } else if (chrome.scripting && chrome.scripting.executeScript) {
      results = await chrome.scripting.executeScript({ target: { tabId }, func: () => !!document.querySelector('input[type="password"]') });
    } else {
      // Fallback to string-based executeScript
      results = await new Promise((resolve) => {
        try {
          chrome.tabs.executeScript(tabId, { code: '!!document.querySelector("input[type=\\"password\\"]")' }, (res) => resolve(res));
        } catch (e) { resolve(null); }
      });
    }

    if (!results) return false;
    const first = Array.isArray(results) ? results[0] : results;
    if (first && typeof first.result !== 'undefined') return first.result;
    if (typeof first === 'boolean') return first;
    return !!first;
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la vérification du champ password:', error);
    return false;
  }
}

// Ouvrir la page des options
function openOptions() {
  chrome.runtime.openOptionsPage();
}

// Mettre à jour l'affichage du statut
function updateStatus(type, text, validatingLists = null, hasPassword = false) {
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');
  const statusIndicator = document.querySelector('.status-indicator');
  const statusDetails = document.getElementById('statusDetails');
  const validationSource = document.getElementById('validationSource');
  
  // Réinitialiser les classes
  statusIndicator.className = 'status-indicator';
  
  switch (type) {
    case 'validated':
      statusIcon.textContent = '✅';
      statusIndicator.classList.add('status-validated');
      statusDetails.style.display = 'block';
      // Masquer la section code si page validée
      const codeSection = document.getElementById('validationCodeSection');
      if (codeSection) codeSection.style.display = 'none';
      
      if (validatingLists && validatingLists.length > 0) {
        // Grouper par type pour l'affichage
        const enterprise = validatingLists.filter(l => l.type === 'enterprise');
        const personal = validatingLists.filter(l => l.type === 'personal');
        const community = validatingLists.filter(l => l.type === 'community');
        
        const parts = [];
        if (enterprise.length > 0) parts.push(...enterprise.map(l => l.name));
        if (personal.length > 0) parts.push(...personal.map(l => l.name));
        if (community.length > 0) parts.push(...community.map(l => l.name));
        
        const listNames = parts.join(', ');
        validationSource.textContent = chrome.i18n.getMessage('popupValidatedBy').replace('{0}', listNames);
      }
      break;
      
    case 'unknown':
      statusIcon.textContent = '🔍';
      statusIndicator.classList.add('status-unknown');
      statusDetails.style.display = 'none';
      break;
      
    case 'none':
    default:
      statusIcon.textContent = hasPassword ? '❓' : '⚪';
      statusIndicator.classList.add('status-none');
      statusDetails.style.display = 'none';
      break;
  }
  
  statusText.textContent = text;
}

// Approuver le domaine actuel
async function approveDomain() {
  if (!currentHostname) return;
  
  try {
    await chrome.runtime.sendMessage({
      action: 'ADD_PERSONAL_DOMAIN',
      domain: currentHostname
    });
    
    // Recharger l'interface
    await loadCurrentPageStatus();
    
    // Recharger la page pour injecter le bandeau
    const tab = await getActiveTab();
    if (tab && tab.id) {
      try { chrome.tabs.reload(tab.id); } catch (e) { try { browser.tabs.reload(tab.id); } catch (err) {} }
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de l\'approbation du domaine:', error);
  }
}

// Actualiser les listes
async function refresh() {
  try {
    await chrome.runtime.sendMessage({ action: 'UPDATE_LISTS' });
    await loadCurrentPageStatus();
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de l\'actualisation:', error);
  }
}
