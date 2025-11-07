// ShieldSign - Popup Script

let currentHostname = '';
let currentStatus = null;

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentPageStatus();
  await loadActiveLists();
  await loadPersonalDomains();
  
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
      updateStatus('none', 'Aucune page active');
      return;
    }
    
    const url = new URL(tab.url);
    currentHostname = url.hostname;
    
    // Vérifier le statut
    const response = await chrome.runtime.sendMessage({
      action: 'CHECK_PAGE',
      hostname: currentHostname
    });
    
    currentStatus = response;
    
    if (response.status === 'VALIDATED') {
      updateStatus('validated', `Page validée`, response);
      document.getElementById('actionSection').style.display = 'none';
    } else {
      updateStatus('unknown', 'Page non validée');
      
      // Vérifier si la page a un champ password
      const hasPassword = await checkForPasswordField(tab.id);
      
      if (hasPassword) {
        document.getElementById('actionSection').style.display = 'block';
      } else {
        document.getElementById('actionSection').style.display = 'none';
      }
    }
    
  } catch (error) {
    console.error('[ShieldSign] Erreur lors du chargement du statut:', error);
    updateStatus('none', 'Erreur de chargement');
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

// Mettre à jour l'affichage du statut
function updateStatus(type, text, details = null) {
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
      
      if (details) {
        const typeName = details.type === 'enterprise' ? 'Liste entreprise' :
                        details.type === 'personal' ? 'Liste personnelle' :
                        details.listName;
        validationSource.textContent = `Validé par : ${typeName}`;
      }
      break;
      
    case 'unknown':
      statusIcon.textContent = '❓';
      statusIndicator.classList.add('status-unknown');
      statusDetails.style.display = 'none';
      break;
      
    case 'none':
    default:
      statusIcon.textContent = '⚪';
      statusIndicator.classList.add('status-none');
      statusDetails.style.display = 'none';
      break;
  }
  
  statusText.textContent = text;
}

// Charger les listes actives
async function loadActiveLists() {
  try {
    const { lists } = await chrome.storage.local.get(['lists']);
    const listsContainer = document.getElementById('listsContainer');
    const noLists = document.getElementById('noLists');
    
    if (!lists || Object.keys(lists).length === 0) {
      noLists.style.display = 'block';
      listsContainer.innerHTML = '';
      listsContainer.appendChild(noLists);
      return;
    }
    
    noLists.style.display = 'none';
    listsContainer.innerHTML = '';
    
    for (const [url, listData] of Object.entries(lists)) {
      const listItem = document.createElement('div');
      listItem.className = 'list-item';
      
      const listName = document.createElement('span');
      listName.className = 'list-name';
      listName.textContent = listData.data?.list_name || url;
      listName.title = url;
      
      const listType = document.createElement('span');
      listType.className = `list-type type-${listData.localType || 'community'}`;
      listType.textContent = listData.localType === 'enterprise' ? 'Entreprise' :
                            listData.localType === 'personal' ? 'Personnelle' : 'Communautaire';
      
      listItem.appendChild(listName);
      listItem.appendChild(listType);
      
      listsContainer.appendChild(listItem);
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors du chargement des listes:', error);
  }
}

// Charger la liste personnelle
async function loadPersonalDomains() {
  try {
    const { user_whitelist } = await chrome.storage.local.get(['user_whitelist']);
    const personalDomains = document.getElementById('personalDomains');
    
    personalDomains.innerHTML = '';
    
    if (!user_whitelist || user_whitelist.length === 0) {
      const noDomains = document.createElement('p');
      noDomains.className = 'no-domains';
      noDomains.textContent = 'Aucun domaine personnel';
      personalDomains.appendChild(noDomains);
      return;
    }
    
    for (const domain of user_whitelist) {
      const domainItem = document.createElement('div');
      domainItem.className = 'domain-item';
      
      const domainName = document.createElement('span');
      domainName.className = 'domain-name';
      domainName.textContent = domain;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '🗑️';
      removeBtn.title = 'Supprimer';
      removeBtn.addEventListener('click', () => removeDomain(domain));
      
      domainItem.appendChild(domainName);
      domainItem.appendChild(removeBtn);
      
      personalDomains.appendChild(domainItem);
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors du chargement de la liste personnelle:', error);
  }
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
    await loadPersonalDomains();
    
    // Recharger la page pour injecter le bandeau
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.reload(tab.id);
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de l\'approbation du domaine:', error);
  }
}

// Supprimer un domaine de la liste personnelle
async function removeDomain(domain) {
  try {
    await chrome.runtime.sendMessage({
      action: 'REMOVE_PERSONAL_DOMAIN',
      domain: domain
    });
    
    // Recharger l'interface
    await loadCurrentPageStatus();
    await loadPersonalDomains();
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la suppression du domaine:', error);
  }
}

// Ouvrir la page des options
function openOptions() {
  chrome.runtime.openOptionsPage();
}

// Actualiser les listes
async function refresh() {
  try {
    await chrome.runtime.sendMessage({ action: 'UPDATE_LISTS' });
    await loadCurrentPageStatus();
    await loadActiveLists();
    await loadPersonalDomains();
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de l\'actualisation:', error);
  }
}
