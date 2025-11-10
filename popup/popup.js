// ShieldSign - Popup Script

let currentHostname = '';
let currentStatus = null;

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentPageStatus();
  
  // Gestionnaires d'événements
  document.getElementById('approveDomainBtn').addEventListener('click', approveDomain);
  document.getElementById('openOptionsBtn').addEventListener('click', openOptions);
  document.getElementById('refreshBtn').addEventListener('click', refresh);
});

// Charger le statut de la page courante
async function loadCurrentPageStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      updateStatus('none', 'Aucune page active', null, false);
      return;
    }
    
    const url = new URL(tab.url);
    currentHostname = url.hostname;
    
    // Vérifier si la page a un champ password
    const hasPassword = await checkForPasswordField(tab.id);
    
    if (!hasPassword) {
      updateStatus('none', 'Cette page ne contient pas de champ mot de passe', null, false);
      document.getElementById('actionSection').style.display = 'none';
      return;
    }
    
    // Vérifier le statut avec toutes les listes
    const response = await chrome.runtime.sendMessage({
      action: 'CHECK_PAGE',
      hostname: currentHostname
    });
    
    currentStatus = response;
    
    if (response.status === 'VALIDATED') {
      // Récupérer toutes les listes qui valident ce domaine
      const allValidatingLists = await getAllValidatingLists(currentHostname);
      updateStatus('validated', 'Cette page est validée', allValidatingLists, true);
      document.getElementById('actionSection').style.display = 'none';
    } else {
      updateStatus('unknown', 'Cette page contient un champ mot de passe mais n\'est listée dans aucune source de confiance', null, true);
      document.getElementById('actionSection').style.display = 'block';
    }
    
  } catch (error) {
    console.error('[ShieldSign] Erreur lors du chargement du statut:', error);
    updateStatus('none', 'Erreur de chargement', null, false);
  }
}

// Récupérer toutes les listes qui valident un domaine
async function getAllValidatingLists(hostname) {
  try {
    const { lists, user_whitelist } = await chrome.storage.local.get(['lists', 'user_whitelist']);
    const validatingLists = [];
    
    // Vérifier la liste personnelle
    if (user_whitelist && user_whitelist.includes(hostname)) {
      validatingLists.push({ name: 'Liste personnelle', type: 'personal' });
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
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        return !!document.querySelector('input[type="password"]');
      }
    });
    
    return results && results[0] && results[0].result;
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
        validationSource.textContent = `Validé par : ${listNames}`;
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.reload(tab.id);
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
