// ShieldSign - Options Script

const DEFAULT_SETTINGS = {
  checkCN: false,
  ttl: 86400000, // 24h en millisecondes
  trainingMode: false,
  enterpriseMode: false, // Mode entreprise pour afficher l'onglet Source entreprise
  language: 'auto', // auto, en, fr, etc.
  
  // Anti-phishing validation settings
  validationMode: 'banner-code', // 'badge-only' | 'banner-keyword' | 'banner-code'
  customKeyword: '', // Phrase personnalisée pour mode banner-keyword
  currentCode: '', // Code alphanumérique 2 caractères (regénéré quotidiennement)
  showUnknownPages: false, // Afficher badge rouge/gris pour pages non listées
  
  // Banner colors configuration
  bannerColors: {
    enterprise: '#2ECC71',
    community: '#3498DB',
    personal: '#9B59B6'
  },
  
  // Advanced banner styling
  bannerStyle: {
    enterprise: {
      mode: 'solid', // 'solid' | 'gradient' | 'random'
      solidColor: '#2ECC71',
      textColor: '#FFFFFF',
      gradientStart: '#2ECC71',
      gradientEnd: '#27AE60',
      fontFamily: 'inherit',
      useRandom: false
    },
    community: {
      mode: 'solid',
      solidColor: '#3498DB',
      textColor: '#FFFFFF',
      gradientStart: '#3498DB',
      gradientEnd: '#2980B9',
      fontFamily: 'inherit',
      useRandom: false
    },
    personal: {
      mode: 'solid',
      solidColor: '#9B59B6',
      textColor: '#FFFFFF',
      gradientStart: '#9B59B6',
      gradientEnd: '#8E44AD',
      fontFamily: 'inherit',
      useRandom: false
    }
  }
};

// Fonction d'internationalisation
function translatePage() {
  // Traduire tous les éléments avec data-i18n
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      // Utiliser innerHTML pour supporter les balises HTML dans les traductions
      element.innerHTML = message;
    }
  });
  
  // Traduire les placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      element.placeholder = message;
    }
  });
  
  // Traduire les titres
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      element.title = message;
    }
  });
}

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  translatePage();
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
  document.getElementById('languageSelect').addEventListener('change', changeLanguage);
  document.getElementById('enterpriseMode').addEventListener('change', toggleEnterpriseMode);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);
  document.getElementById('learnMoreBtn').addEventListener('click', showLearnMoreModal);
  document.getElementById('downloadExampleBtn').addEventListener('click', downloadExample);
  document.getElementById('closeModal').addEventListener('click', closeLearnMoreModal);
  
  // Nouveaux gestionnaires pour validation de sécurité
  setupValidationModeListeners();
  document.getElementById('regenerateCodeBtn')?.addEventListener('click', regenerateCode);
  
  // Fermer la modal en cliquant en dehors
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('learnMoreModal');
    if (e.target === modal) {
      closeLearnMoreModal();
    }
  });
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
    document.getElementById('languageSelect').value = currentSettings.language || DEFAULT_SETTINGS.language;
    document.getElementById('colorEnterprise').value = currentSettings.bannerColors?.enterprise || DEFAULT_SETTINGS.bannerColors.enterprise;
    document.getElementById('colorCommunity').value = currentSettings.bannerColors?.community || DEFAULT_SETTINGS.bannerColors.community;
    document.getElementById('colorPersonal').value = currentSettings.bannerColors?.personal || DEFAULT_SETTINGS.bannerColors.personal;
    
    // Charger les nouveaux paramètres de validation
    const validationMode = currentSettings.validationMode || 'banner-code';
    const modeRadio = document.querySelector(`input[name="validationMode"][value="${validationMode}"]`);
    if (modeRadio) {
      modeRadio.checked = true;
    }
    
    if (document.getElementById('customKeyword')) {
      document.getElementById('customKeyword').value = currentSettings.customKeyword || '';
    }
    
    if (document.getElementById('showUnknownPages')) {
      document.getElementById('showUnknownPages').checked = currentSettings.showUnknownPages || false;
    }
    
    // Charger et afficher le code actuel
    await loadCurrentCode();
    
    // Mettre à jour l'affichage des champs selon le mode
    handleValidationModeChange();
    
    // Afficher/masquer l'onglet entreprise
    updateEnterpriseTabVisibility(currentSettings.enterpriseMode || false);
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorLoading'), true);
  }
}

// Sauvegarder les paramètres
async function saveSettings() {
  try {
    const { settings } = await chrome.storage.local.get(['settings']);
    const currentSettings = settings || DEFAULT_SETTINGS;
    
    // Récupérer le mode de validation sélectionné
    const validationMode = document.querySelector('input[name="validationMode"]:checked')?.value || 'banner-code';
    
    // Vérification du mot-clé si mode banner-keyword
    let customKeyword = document.getElementById('customKeyword')?.value || '';
    if (validationMode === 'banner-keyword' && customKeyword.length < 5) {
      showToast(chrome.i18n.getMessage('warningKeywordTooShort') || 'Le mot-clé doit contenir au moins 5 caractères', true);
      return;
    }
    
    const newSettings = {
      checkCN: document.getElementById('checkCN').checked,
      ttl: parseInt(document.getElementById('ttl').value) * 3600000,
      trainingMode: false,
      enterpriseMode: document.getElementById('enterpriseMode').checked,
      language: document.getElementById('languageSelect').value,
      
      // Nouveaux paramètres de validation
      validationMode: validationMode,
      customKeyword: customKeyword,
      currentCode: currentSettings.currentCode || '', // Conserver le code existant
      showUnknownPages: document.getElementById('showUnknownPages')?.checked || false,
      
      bannerColors: {
        enterprise: document.getElementById('colorEnterprise').value,
        community: document.getElementById('colorCommunity').value,
        personal: document.getElementById('colorPersonal').value
      },
      
      // Conserver bannerStyle si présent
      bannerStyle: currentSettings.bannerStyle || DEFAULT_SETTINGS.bannerStyle
    };
    
    await chrome.storage.local.set({ settings: newSettings });
    updateEnterpriseTabVisibility(newSettings.enterpriseMode);
    showToast(chrome.i18n.getMessage('toastSettingsSaved'));
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorSaving'), true);
  }
}

// Réinitialiser les paramètres
async function resetSettings() {
  try {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    await loadSettings();
    showToast(chrome.i18n.getMessage('toastSettingsReset'));
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorResetting'), true);
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
    
    enterpriseList.innerHTML = `<p class="no-list">${chrome.i18n.getMessage('noListEnterprise')}</p>`;
    communityLists.innerHTML = `<p class="no-list">${chrome.i18n.getMessage('noListCommunity')}</p>`;
    
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
    showToast(chrome.i18n.getMessage('errorLoadingLists'), true);
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
  toggleBtn.title = listData.enabled !== false ? chrome.i18n.getMessage('toggleDisable') : chrome.i18n.getMessage('toggleEnable');
  toggleBtn.addEventListener('click', () => toggleList(url, listData.enabled === false));
  
  actions.appendChild(toggleBtn);
  
  // Bouton supprimer (seulement si ce n'est pas la liste officielle)
  if (!listData.isOfficial) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.title = chrome.i18n.getMessage('btnRemove') || 'Supprimer';
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
    showToast(chrome.i18n.getMessage('errorEnterValidUrl'), true);
    return;
  }
  
  if (!isValidUrl(url)) {
    showToast(chrome.i18n.getMessage('errorInvalidUrl'), true);
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'ADD_LIST',
      url: url,
      type: type
    });
    
    if (response.success) {
      showToast(chrome.i18n.getMessage('toastListAdded'));
      input.value = '';
      await loadLists();
    } else {
      showToast(response.error || chrome.i18n.getMessage('errorAddingList'), true);
    }
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorAddingList'), true);
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
      showToast(chrome.i18n.getMessage('toastListRemoved'));
      await loadLists();
    } else {
      showToast(response.error || chrome.i18n.getMessage('errorRemovingList'), true);
    }
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorRemovingList'), true);
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
      showToast(enabled ? chrome.i18n.getMessage('toastListEnabled') : chrome.i18n.getMessage('toastListDisabled'));
      await loadLists();
    } else {
      showToast(response.error || chrome.i18n.getMessage('errorTogglingList'), true);
    }
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorTogglingList'), true);
  }
}

// Charger la liste personnelle
async function loadPersonalDomains() {
  try {
    const { user_whitelist } = await chrome.storage.local.get(['user_whitelist']);
    const personalDomainsList = document.getElementById('personalDomainsList');
    
    personalDomainsList.innerHTML = '';
    
    if (!user_whitelist || user_whitelist.length === 0) {
      personalDomainsList.innerHTML = `<p class="no-list">${chrome.i18n.getMessage('noListPersonal')}</p>`;
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
      removeBtn.title = chrome.i18n.getMessage('btnRemove') || 'Supprimer';
      removeBtn.addEventListener('click', () => removePersonalDomain(domain));
      
      listItem.appendChild(listInfo);
      listItem.appendChild(removeBtn);
      
      personalDomainsList.appendChild(listItem);
    }
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorLoadingPersonal'), true);
  }
}

// Ajouter un domaine personnel
async function addPersonalDomain() {
  const input = document.getElementById('personalDomain');
  const domain = input.value.trim().toLowerCase();
  
  if (!domain) {
    showToast(chrome.i18n.getMessage('errorEnterValidDomain'), true);
    return;
  }
  
  if (!isValidDomain(domain)) {
    showToast(chrome.i18n.getMessage('errorInvalidDomain'), true);
    return;
  }
  
  try {
    await chrome.runtime.sendMessage({
      action: 'ADD_PERSONAL_DOMAIN',
      domain: domain
    });
    
    showToast(chrome.i18n.getMessage('toastDomainAdded'));
    input.value = '';
    await loadPersonalDomains();
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorAddingDomain'), true);
  }
}

// Supprimer un domaine personnel
async function removePersonalDomain(domain) {
  try {
    await chrome.runtime.sendMessage({
      action: 'REMOVE_PERSONAL_DOMAIN',
      domain: domain
    });
    
    showToast(chrome.i18n.getMessage('toastDomainRemoved'));
    await loadPersonalDomains();
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorRemovingDomain'), true);
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
      toggle.title = chrome.i18n.getMessage('toggleDisable');
    } else {
      toggle.classList.add('disabled');
      toggle.innerHTML = '<i class="fas fa-times-circle"></i>';
      toggle.title = chrome.i18n.getMessage('toggleEnable');
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
      toggle.title = newEnabled ? chrome.i18n.getMessage('toggleDisable') : chrome.i18n.getMessage('toggleEnable');
      
      showToast(newEnabled ? chrome.i18n.getMessage('toastOfficialEnabled') : chrome.i18n.getMessage('toastOfficialDisabled'));
    } else {
      showToast(chrome.i18n.getMessage('errorUpdating'), true);
    }
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorUpdating'), true);
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
    
    showToast(chrome.i18n.getMessage('toastOfficialReinstalled'));
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorReinstalling'), true);
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
  showToast(e.target.checked ? chrome.i18n.getMessage('toastEnterpriseModeEnabled') : chrome.i18n.getMessage('toastEnterpriseModeDisabled'));
}

// Changer la langue
async function changeLanguage() {
  const languageSelect = document.getElementById('languageSelect');
  const selectedLanguage = languageSelect.value;
  
  try {
    // Sauvegarder immédiatement la langue sélectionnée
    const { settings = DEFAULT_SETTINGS } = await chrome.storage.local.get(['settings']);
    settings.language = selectedLanguage;
    await chrome.storage.local.set({ settings });
    
    // Recharger la page pour appliquer la nouvelle langue
    window.location.reload();
  } catch (error) {
    showToast('Erreur lors du changement de langue', true);
  }
}

// Exporter la liste personnelle
async function exportPersonalList() {
  try {
    const { user_whitelist } = await chrome.storage.local.get(['user_whitelist']);
    
    if (!user_whitelist || user_whitelist.length === 0) {
      showToast(chrome.i18n.getMessage('errorNoPersonalDomain'), true);
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
    
    showToast(chrome.i18n.getMessage('toastListExported'));
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorExporting'), true);
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
      showToast(chrome.i18n.getMessage('errorInvalidFile'), true);
      return;
    }
    
    // Valider tous les domaines
    const validDomains = data.domains.filter(d => isValidDomain(d));
    
    if (validDomains.length === 0) {
      showToast(chrome.i18n.getMessage('errorNoValidDomain'), true);
      return;
    }
    
    // Fusionner avec les domaines existants
    const { user_whitelist = [] } = await chrome.storage.local.get(['user_whitelist']);
    const mergedDomains = [...new Set([...user_whitelist, ...validDomains])];
    
    await chrome.storage.local.set({ user_whitelist: mergedDomains });
    await loadPersonalDomains();
    
    showToast(chrome.i18n.getMessage('toastDomainsImported').replace('{count}', validDomains.length));
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorImporting'), true);
  } finally {
    e.target.value = ''; // Reset file input
  }
}

// Afficher la modal "En savoir plus"
function showLearnMoreModal() {
  const modal = document.getElementById('learnMoreModal');
  modal.classList.add('show');
}

// Fermer la modal "En savoir plus"
function closeLearnMoreModal() {
  const modal = document.getElementById('learnMoreModal');
  modal.classList.remove('show');
}

// Télécharger un exemple de fichier JSON
function downloadExample() {
  const exampleData = {
    "list_name": "Ma liste entreprise",
    "version": "1.0",
    "last_update": new Date().toISOString().split('T')[0],
    "domains": [
      "login.example.com",
      "sso.example.com",
      "auth.intranet.example.com"
    ]
  };
  
  const blob = new Blob([JSON.stringify(exampleData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'shieldsign-enterprise-example.json';
  a.click();
  URL.revokeObjectURL(url);
  
  showToast(chrome.i18n.getMessage('toastExampleDownloaded') || 'Exemple téléchargé');
}

// ========================================
// ALGORITHMES DE CONTRASTE ET COULEURS
// ========================================

// Calculer la luminance relative d'une couleur (WCAG)
function calculateLuminance(hexColor) {
  // Convertir hex en RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Appliquer la correction gamma
  const rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  
  // Calculer la luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculer le ratio de contraste entre deux couleurs
function calculateContrastRatio(color1, color2) {
  const lum1 = calculateLuminance(color1);
  const lum2 = calculateLuminance(color2);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

// S'assurer qu'une couleur de texte a un bon contraste avec le fond
function ensureContrast(bgColor, preferredTextColor = '#FFFFFF') {
  const ratio = calculateContrastRatio(bgColor, preferredTextColor);
  
  // WCAG AA requiert 4.5:1 pour le texte normal
  if (ratio >= 4.5) {
    return preferredTextColor;
  }
  
  // Essayer blanc ou noir selon la luminance du fond
  const bgLuminance = calculateLuminance(bgColor);
  return bgLuminance > 0.5 ? '#000000' : '#FFFFFF';
}

// Générer une couleur aléatoire
function generateRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Générer un dégradé harmonieux aléatoire
function generateRandomGradient() {
  // Générer une couleur de base
  const hue = Math.floor(Math.random() * 360);
  const saturation = 60 + Math.floor(Math.random() * 30); // 60-90%
  const lightness1 = 40 + Math.floor(Math.random() * 20); // 40-60%
  const lightness2 = lightness1 + 10 + Math.floor(Math.random() * 15); // +10 à +25
  
  // Convertir HSL en HEX
  const start = hslToHex(hue, saturation, lightness1);
  const end = hslToHex(hue, saturation, Math.min(lightness2, 75));
  
  // Déterminer la couleur de texte avec bon contraste
  const textColor = ensureContrast(start);
  
  return { start, end, textColor };
}

// Convertir HSL en HEX
function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Générer une couleur de texte aléatoire avec bon contraste
function generateRandomTextColor(bgColor) {
  return ensureContrast(bgColor, generateRandomColor());
}

// ========================================
// GESTION DES MODES DE VALIDATION
// ========================================

// Configurer les écouteurs pour les modes de validation
function setupValidationModeListeners() {
  const modeRadios = document.querySelectorAll('input[name="validationMode"]');
  modeRadios.forEach(radio => {
    radio.addEventListener('change', handleValidationModeChange);
  });
  
  // Afficher/masquer les champs selon le mode sélectionné au chargement
  handleValidationModeChange();
}

// Gérer le changement de mode de validation
function handleValidationModeChange() {
  const selectedMode = document.querySelector('input[name="validationMode"]:checked')?.value || 'banner-code';
  
  // Afficher/masquer le champ mot-clé
  const keywordContainer = document.getElementById('keywordInputContainer');
  if (keywordContainer) {
    keywordContainer.style.display = selectedMode === 'banner-keyword' ? 'block' : 'none';
  }
  
  // Le code display est toujours visible pour le mode banner-code (géré par défaut dans HTML)
  const codeContainer = document.getElementById('codeDisplayContainer');
  if (codeContainer) {
    codeContainer.style.display = selectedMode === 'banner-code' ? 'block' : 'none';
  }
}

// Charger et afficher le code actuel
async function loadCurrentCode() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_CURRENT_CODE' });
    const codeDisplay = document.getElementById('currentCodeDisplay');
    if (codeDisplay && response.code) {
      codeDisplay.textContent = response.code;
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors du chargement du code:', error);
  }
}

// Régénérer manuellement le code
async function regenerateCode() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'REGENERATE_CODE' });
    if (response.success) {
      const codeDisplay = document.getElementById('currentCodeDisplay');
      if (codeDisplay) {
        codeDisplay.textContent = response.code;
      }
      showToast(chrome.i18n.getMessage('toastCodeRegenerated') || 'Code régénéré avec succès');
    }
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorRegeneratingCode') || 'Erreur lors de la régénération du code', true);
  }
}
