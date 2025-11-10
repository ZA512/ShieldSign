// ShieldSign - Options Script

const DEFAULT_SETTINGS = {
  checkCN: false,
  ttl: 86400000, // 24h en millisecondes
  trainingMode: false,
  enterpriseMode: false, // Mode entreprise pour afficher l'onglet Source entreprise
  bannerColors: {
    enterprise: '#2ECC71',
    community: '#3498DB',
    personal: '#9B59B6'
  }
};

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  await loadSettings();
  await loadOfficialList();
  await loadLists();
  await loadPersonalDomains();
  
  // Gestionnaires d'événements
  document.getElementById('officialListToggle').addEventListener('click', toggleOfficialList);
  document.getElementById('reinstallOfficialBtn').addEventListener('click', reinstallOfficialList);
  document.getElementById('addEnterpriseBtn').addEventListener('click', () => addList('enterprise'));
  document.getElementById('addCommunityBtn').addEventListener('click', () => addList('community'));
  document.getElementById('addPersonalDomainBtn').addEventListener('click', addPersonalDomain);
  document.getElementById('exportPersonalBtn').addEventListener('click', exportPersonalList);
  document.getElementById('importPersonalBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
  document.getElementById('importFileInput').addEventListener('change', importPersonalList);
  document.getElementById('enterpriseMode').addEventListener('change', toggleEnterpriseMode);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);
});

// Gestion des onglets
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      
      // Désactiver tous les onglets
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Activer l'onglet ciblé
      btn.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });
}

// Charger les paramètres
async function loadSettings() {
  try {
    const { settings } = await chrome.storage.local.get(['settings']);
    const currentSettings = settings || DEFAULT_SETTINGS;
    
    document.getElementById('checkCN').checked = currentSettings.checkCN || false;
    document.getElementById('ttl').value = (currentSettings.ttl || DEFAULT_SETTINGS.ttl) / 3600000; // Convertir ms en heures
    document.getElementById('enterpriseMode').checked = currentSettings.enterpriseMode || false;
    document.getElementById('colorEnterprise').value = currentSettings.bannerColors?.enterprise || DEFAULT_SETTINGS.bannerColors.enterprise;
    document.getElementById('colorCommunity').value = currentSettings.bannerColors?.community || DEFAULT_SETTINGS.bannerColors.community;
    document.getElementById('colorPersonal').value = currentSettings.bannerColors?.personal || DEFAULT_SETTINGS.bannerColors.personal;
    
    // Afficher/masquer l'onglet entreprise
    updateEnterpriseTabVisibility(currentSettings.enterpriseMode || false);
  } catch (error) {
    showToast('Erreur lors du chargement des paramètres', true);
  }
}

// Sauvegarder les paramètres
async function saveSettings() {
  try {
    const settings = {
      checkCN: document.getElementById('checkCN').checked,
      ttl: parseInt(document.getElementById('ttl').value) * 3600000, // Convertir heures en ms
      trainingMode: false,
      enterpriseMode: document.getElementById('enterpriseMode').checked,
      bannerColors: {
        enterprise: document.getElementById('colorEnterprise').value,
        community: document.getElementById('colorCommunity').value,
        personal: document.getElementById('colorPersonal').value
      }
    };
    
    await chrome.storage.local.set({ settings });
    updateEnterpriseTabVisibility(settings.enterpriseMode);
    showToast('Paramètres enregistrés avec succès');
  } catch (error) {
    showToast('Erreur lors de la sauvegarde des paramètres', true);
  }
}

// Réinitialiser les paramètres
async function resetSettings() {
  try {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    await loadSettings();
    showToast('Paramètres réinitialisés');
  } catch (error) {
    showToast('Erreur lors de la réinitialisation', true);
  }
}

// Charger les listes
async function loadLists() {
  try {
    const { lists } = await chrome.storage.local.get(['lists']);
    
    const enterpriseList = document.getElementById('enterpriseList');
    const communityLists = document.getElementById('communityLists');
    
    if (!enterpriseList || !communityLists) {
      return;
    }
    
    enterpriseList.innerHTML = '<p class="no-list">Aucune liste entreprise configurée</p>';
    communityLists.innerHTML = '<p class="no-list">Aucune liste additionnelle configurée</p>';
    
    if (!lists || Object.keys(lists).length === 0) {
      return;
    }
    
    const OFFICIAL_URL = 'https://raw.githubusercontent.com/ZA512/ShieldSign/refs/heads/main/shieldsign_public_list_v1.json';
    let hasEnterprise = false;
    let hasCommunity = false;
    
    for (const [url, listData] of Object.entries(lists)) {
      // Ignorer la liste officielle (elle est gérée en dur)
      if (listData.isOfficial || url === OFFICIAL_URL) {
        continue;
      }
      
      const listItem = createListItem(url, listData);
      
      if (listData.localType === 'enterprise') {
        if (!hasEnterprise) {
          enterpriseList.innerHTML = '';
          hasEnterprise = true;
        }
        enterpriseList.appendChild(listItem);
      } else {
        if (!hasCommunity) {
          communityLists.innerHTML = '';
          hasCommunity = true;
        }
        communityLists.appendChild(listItem);
      }
    }
  } catch (error) {
    showToast('Erreur lors du chargement des listes', true);
  }
}

// Créer un élément de liste
function createListItem(url, listData) {
  const listItem = document.createElement('div');
  listItem.className = 'list-item';
  
  // Ajouter la classe disabled si la liste est désactivée
  if (listData.enabled === false) {
    listItem.classList.add('disabled');
  }
  
  const listInfo = document.createElement('div');
  listInfo.className = 'list-info';
  
  const listName = document.createElement('div');
  listName.className = 'list-name';
  listName.textContent = listData.data?.list_name || 'Liste sans nom';
  
  const listUrl = document.createElement('div');
  listUrl.className = 'list-url';
  listUrl.textContent = url;
  
  listInfo.appendChild(listName);
  listInfo.appendChild(listUrl);
  
  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  
  // Bouton activer/désactiver
  const toggleBtn = document.createElement('button');
  toggleBtn.className = `toggle-btn ${listData.enabled !== false ? 'enabled' : 'disabled'}`;
  toggleBtn.innerHTML = listData.enabled !== false ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-times-circle"></i>';
  toggleBtn.title = listData.enabled !== false ? 'Désactiver' : 'Activer';
  toggleBtn.addEventListener('click', () => toggleList(url, listData.enabled === false));
  
  actions.appendChild(toggleBtn);
  
  // Bouton supprimer (seulement si ce n'est pas la liste officielle)
  if (!listData.isOfficial) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.title = 'Supprimer';
    removeBtn.addEventListener('click', () => removeList(url));
    actions.appendChild(removeBtn);
  }
  
  listItem.appendChild(listInfo);
  listItem.appendChild(actions);
  
  return listItem;
}

// Ajouter une liste
async function addList(type) {
  const inputId = type === 'enterprise' ? 'enterpriseUrl' : 'communityUrl';
  const input = document.getElementById(inputId);
  const url = input.value.trim();
  
  if (!url) {
    showToast('Veuillez entrer une URL valide', true);
    return;
  }
  
  if (!isValidUrl(url)) {
    showToast('URL invalide', true);
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'ADD_LIST',
      url: url,
      type: type
    });
    
    if (response.success) {
      showToast('Liste ajoutée avec succès');
      input.value = '';
      await loadLists();
    } else {
      showToast(response.error || 'Erreur lors de l\'ajout de la liste', true);
    }
  } catch (error) {
    showToast('Erreur lors de l\'ajout de la liste', true);
  }
}

// Supprimer une liste
async function removeList(url) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'REMOVE_LIST',
      url: url
    });
    
    if (response.success) {
      showToast('Liste supprimée avec succès');
      await loadLists();
    } else {
      showToast(response.error || 'Erreur lors de la suppression de la liste', true);
    }
  } catch (error) {
    showToast('Erreur lors de la suppression de la liste', true);
  }
}

// Activer/désactiver une liste
async function toggleList(url, enabled) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'TOGGLE_LIST',
      url: url,
      enabled: enabled
    });
    
    if (response.success) {
      showToast(enabled ? 'Liste activée' : 'Liste désactivée');
      await loadLists();
    } else {
      showToast(response.error || 'Erreur lors de la modification de la liste', true);
    }
  } catch (error) {
    showToast('Erreur lors de la modification de la liste', true);
  }
}

// Charger la liste personnelle
async function loadPersonalDomains() {
  try {
    const { user_whitelist } = await chrome.storage.local.get(['user_whitelist']);
    const personalDomainsList = document.getElementById('personalDomainsList');
    
    personalDomainsList.innerHTML = '';
    
    if (!user_whitelist || user_whitelist.length === 0) {
      personalDomainsList.innerHTML = '<p class="no-list">Aucun domaine personnel configuré</p>';
      return;
    }
    
    for (const domain of user_whitelist) {
      const listItem = document.createElement('div');
      listItem.className = 'list-item';
      
      const listInfo = document.createElement('div');
      listInfo.className = 'list-info';
      
      const listName = document.createElement('div');
      listName.className = 'list-name';
      listName.textContent = domain;
      
      listInfo.appendChild(listName);
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.title = 'Supprimer';
      removeBtn.addEventListener('click', () => removePersonalDomain(domain));
      
      listItem.appendChild(listInfo);
      listItem.appendChild(removeBtn);
      
      personalDomainsList.appendChild(listItem);
    }
  } catch (error) {
    showToast('Erreur lors du chargement de la liste personnelle', true);
  }
}

// Ajouter un domaine personnel
async function addPersonalDomain() {
  const input = document.getElementById('personalDomain');
  const domain = input.value.trim().toLowerCase();
  
  if (!domain) {
    showToast('Veuillez entrer un domaine valide', true);
    return;
  }
  
  if (!isValidDomain(domain)) {
    showToast('Format de domaine invalide', true);
    return;
  }
  
  try {
    await chrome.runtime.sendMessage({
      action: 'ADD_PERSONAL_DOMAIN',
      domain: domain
    });
    
    showToast('Domaine ajouté avec succès');
    input.value = '';
    await loadPersonalDomains();
  } catch (error) {
    showToast('Erreur lors de l\'ajout du domaine', true);
  }
}

// Supprimer un domaine personnel
async function removePersonalDomain(domain) {
  try {
    await chrome.runtime.sendMessage({
      action: 'REMOVE_PERSONAL_DOMAIN',
      domain: domain
    });
    
    showToast('Domaine supprimé avec succès');
    await loadPersonalDomains();
  } catch (error) {
    showToast('Erreur lors de la suppression du domaine', true);
  }
}

// Valider une URL
function isValidUrl(url) {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}

// Valider un domaine
function isValidDomain(domain) {
  const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/;
  return domainRegex.test(domain);
}

// Afficher un toast
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Gérer la liste officielle en dur
async function loadOfficialList() {
  const toggle = document.getElementById('officialListToggle');
  
  if (!toggle) {
    return;
  }
  
  try {
    const { lists } = await chrome.storage.local.get(['lists']);
    
    // lists est un objet {url: listData}, pas un tableau
    const officialUrl = 'https://raw.githubusercontent.com/ZA512/ShieldSign/refs/heads/main/shieldsign_public_list_v1.json';
    let officialList = null;
    
    if (lists) {
      // Chercher par URL directement
      if (lists[officialUrl]) {
        officialList = lists[officialUrl];
      } else {
        // Sinon chercher par isOfficial
        for (const [url, listData] of Object.entries(lists)) {
          if (listData.isOfficial) {
            officialList = listData;
            break;
          }
        }
      }
    }
    
    // Déterminer l'état (par défaut activée si pas trouvée ou si enabled n'est pas false)
    const isEnabled = officialList ? (officialList.enabled !== false) : true;
    
    // Retirer les deux classes d'abord
    toggle.classList.remove('enabled', 'disabled');
    
    // Ajouter la bonne classe
    if (isEnabled) {
      toggle.classList.add('enabled');
      toggle.innerHTML = '<i class="fas fa-check-circle"></i>';
      toggle.title = 'Désactiver';
    } else {
      toggle.classList.add('disabled');
      toggle.innerHTML = '<i class="fas fa-times-circle"></i>';
      toggle.title = 'Activer';
    }
  } catch (error) {
  }
}

// Toggle liste officielle
async function toggleOfficialList() {
  const toggle = document.getElementById('officialListToggle');
  
  try {
    // Envoyer le toggle (le background.js gère l'inversion automatique)
    const response = await chrome.runtime.sendMessage({
      action: 'TOGGLE_LIST',
      url: 'https://raw.githubusercontent.com/ZA512/ShieldSign/refs/heads/main/shieldsign_public_list_v1.json'
    });
    
    if (response && response.success) {
      // Mettre à jour l'affichage avec le nouvel état
      const newEnabled = response.enabled;
      toggle.classList.toggle('enabled', newEnabled);
      toggle.classList.toggle('disabled', !newEnabled);
      toggle.innerHTML = newEnabled ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-times-circle"></i>';
      toggle.title = newEnabled ? 'Désactiver' : 'Activer';
      
      showToast(newEnabled ? 'Liste officielle activée' : 'Liste officielle désactivée');
    } else {
      showToast('Erreur lors de la mise à jour', true);
    }
  } catch (error) {
    showToast('Erreur lors de la mise à jour', true);
  }
}

// Réinstaller la liste officielle
async function reinstallOfficialList() {
  try {
    const url = 'https://raw.githubusercontent.com/ZA512/ShieldSign/refs/heads/main/shieldsign_public_list_v1.json';
    
    // Récupérer les listes actuelles
    const { lists } = await chrome.storage.local.get(['lists']);
    const currentLists = lists || {};
    
    // Réinstaller la liste officielle
    currentLists[url] = {
      etag: null,
      lastFetch: 0,
      data: null,
      localType: 'community',
      isOfficial: true,
      enabled: true
    };
    
    await chrome.storage.local.set({ lists: currentLists });
    
    // Forcer la mise à jour immédiate
    await chrome.runtime.sendMessage({ action: 'UPDATE_LISTS' });
    
    // Recharger l'affichage
    await loadOfficialList();
    
    showToast('Liste officielle réinstallée et mise à jour !');
  } catch (error) {
    showToast('Erreur lors de la réinstallation', true);
  }
}

// Gérer l'affichage de l'onglet entreprise
function updateEnterpriseTabVisibility(show) {
  const tab = document.getElementById('enterpriseTab');
  if (tab) {
    tab.style.display = show ? 'block' : 'none';
  }
}

// Toggle mode entreprise
async function toggleEnterpriseMode(e) {
  updateEnterpriseTabVisibility(e.target.checked);
  showToast(e.target.checked ? 'Mode entreprise activé' : 'Mode entreprise désactivé');
}

// Exporter la liste personnelle
async function exportPersonalList() {
  try {
    const { user_whitelist } = await chrome.storage.local.get(['user_whitelist']);
    
    if (!user_whitelist || user_whitelist.length === 0) {
      showToast('Aucun domaine personnel à exporter', true);
      return;
    }
    
    const exportData = {
      name: 'Ma liste personnelle ShieldSign',
      version: '1.0',
      exportDate: new Date().toISOString(),
      domains: user_whitelist
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shieldsign-personal-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Liste exportée avec succès');
  } catch (error) {
    showToast('Erreur lors de l\'export', true);
  }
}

// Importer la liste personnelle
async function importPersonalList(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.domains || !Array.isArray(data.domains)) {
      showToast('Format de fichier invalide', true);
      return;
    }
    
    // Valider tous les domaines
    const validDomains = data.domains.filter(d => isValidDomain(d));
    
    if (validDomains.length === 0) {
      showToast('Aucun domaine valide trouvé', true);
      return;
    }
    
    // Fusionner avec les domaines existants
    const { user_whitelist = [] } = await chrome.storage.local.get(['user_whitelist']);
    const mergedDomains = [...new Set([...user_whitelist, ...validDomains])];
    
    await chrome.storage.local.set({ user_whitelist: mergedDomains });
    await loadPersonalDomains();
    
    showToast(`${validDomains.length} domaine(s) importé(s)`);
  } catch (error) {
    showToast('Erreur lors de l\'import', true);
  } finally {
    e.target.value = ''; // Reset file input
  }
}
