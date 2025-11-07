// ShieldSign - Options Script

const DEFAULT_SETTINGS = {
  checkCN: false,
  ttl: 86400000, // 24h en millisecondes
  trainingMode: false,
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
  await loadLists();
  await loadPersonalDomains();
  
  // Gestionnaires d'événements
  document.getElementById('addEnterpriseBtn').addEventListener('click', () => addList('enterprise'));
  document.getElementById('addCommunityBtn').addEventListener('click', () => addList('community'));
  document.getElementById('addPersonalDomainBtn').addEventListener('click', addPersonalDomain);
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
    document.getElementById('colorEnterprise').value = currentSettings.bannerColors?.enterprise || DEFAULT_SETTINGS.bannerColors.enterprise;
    document.getElementById('colorCommunity').value = currentSettings.bannerColors?.community || DEFAULT_SETTINGS.bannerColors.community;
    document.getElementById('colorPersonal').value = currentSettings.bannerColors?.personal || DEFAULT_SETTINGS.bannerColors.personal;
  } catch (error) {
    console.error('[ShieldSign] Erreur lors du chargement des paramètres:', error);
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
      bannerColors: {
        enterprise: document.getElementById('colorEnterprise').value,
        community: document.getElementById('colorCommunity').value,
        personal: document.getElementById('colorPersonal').value
      }
    };
    
    await chrome.storage.local.set({ settings });
    showToast('Paramètres enregistrés avec succès');
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la sauvegarde des paramètres:', error);
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
    console.error('[ShieldSign] Erreur lors de la réinitialisation:', error);
    showToast('Erreur lors de la réinitialisation', true);
  }
}

// Charger les listes
async function loadLists() {
  try {
    const { lists } = await chrome.storage.local.get(['lists']);
    
    const enterpriseList = document.getElementById('enterpriseList');
    const communityLists = document.getElementById('communityLists');
    
    enterpriseList.innerHTML = '<p class="no-list">Aucune liste entreprise configurée</p>';
    communityLists.innerHTML = '<p class="no-list">Aucune liste communautaire configurée</p>';
    
    if (!lists || Object.keys(lists).length === 0) {
      return;
    }
    
    let hasEnterprise = false;
    let hasCommunity = false;
    
    for (const [url, listData] of Object.entries(lists)) {
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
    console.error('[ShieldSign] Erreur lors du chargement des listes:', error);
    showToast('Erreur lors du chargement des listes', true);
  }
}

// Créer un élément de liste
function createListItem(url, listData) {
  const listItem = document.createElement('div');
  listItem.className = 'list-item';
  
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
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = '🗑️';
  removeBtn.title = 'Supprimer';
  removeBtn.addEventListener('click', () => removeList(url));
  
  listItem.appendChild(listInfo);
  listItem.appendChild(removeBtn);
  
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
    console.error('[ShieldSign] Erreur lors de l\'ajout de la liste:', error);
    showToast('Erreur lors de l\'ajout de la liste', true);
  }
}

// Supprimer une liste
async function removeList(url) {
  try {
    await chrome.runtime.sendMessage({
      action: 'REMOVE_LIST',
      url: url
    });
    
    showToast('Liste supprimée avec succès');
    await loadLists();
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la suppression de la liste:', error);
    showToast('Erreur lors de la suppression de la liste', true);
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
      removeBtn.textContent = '🗑️';
      removeBtn.title = 'Supprimer';
      removeBtn.addEventListener('click', () => removePersonalDomain(domain));
      
      listItem.appendChild(listInfo);
      listItem.appendChild(removeBtn);
      
      personalDomainsList.appendChild(listItem);
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors du chargement de la liste personnelle:', error);
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
    console.error('[ShieldSign] Erreur lors de l\'ajout du domaine:', error);
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
    console.error('[ShieldSign] Erreur lors de la suppression du domaine:', error);
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
