// ShieldSign - Options Script

// Fonction utilitaire pour débouncer les sauvegardes
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

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
  autoAddUnknown: 'prompt', // 'never' | 'always' | 'prompt' - Comportement lors de la soumission d'un formulaire sur un site inconnu
  
  // Banner size: 'small' | 'medium' | 'large'
  bannerSize: 'large',
  
  // Platform detection done flag
  platformDefaultsApplied: false,
  
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
      // Prefer textContent for safety; messages that require HTML should be reviewed
      element.textContent = message;
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

// Platform detection using Compat layer
let _platformInfo = { isMobile: false, isFirefoxMobile: false };

async function detectPlatformForOptions() {
  try {
    if (typeof Compat !== 'undefined' && Compat.detectPlatform) {
      _platformInfo = await Compat.detectPlatform();
    }
  } catch (e) {
    // Fallback: use user agent
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      const ua = navigator.userAgent;
      _platformInfo.isMobile = /Android|Mobile|Tablet/i.test(ua);
      _platformInfo.isFirefoxMobile = /Firefox/i.test(ua) && _platformInfo.isMobile;
    }
  }
  return _platformInfo;
}

// Apply mobile restrictions: disable badge-only and banner-code modes
function applyMobileRestrictions() {
  if (!_platformInfo.isMobile && !_platformInfo.isFirefoxMobile) {
    return; // Desktop, no restrictions
  }
  
  // Show mobile warning
  const warningBox = document.getElementById('mobileWarningBox');
  if (warningBox) {
    warningBox.style.display = 'block';
  }
  
  // Disable and grey out badge-only option
  const badgeOnlyRadio = document.getElementById('modeBadgeOnly');
  const bannerCodeRadio = document.getElementById('modeBannerCode');
  
  if (badgeOnlyRadio) {
    badgeOnlyRadio.disabled = true;
    const parentOption = badgeOnlyRadio.closest('.validation-mode-option');
    if (parentOption) {
      parentOption.style.opacity = '0.5';
      parentOption.style.pointerEvents = 'none';
    }
  }
  
  if (bannerCodeRadio) {
    bannerCodeRadio.disabled = true;
    const parentOption = bannerCodeRadio.closest('.validation-mode-option');
    if (parentOption) {
      parentOption.style.opacity = '0.5';
      parentOption.style.pointerEvents = 'none';
    }
  }
  
  // If currently on a disabled mode, switch to banner-keyword
  const currentMode = document.querySelector('input[name="validationMode"]:checked');
  if (currentMode && (currentMode.value === 'badge-only' || currentMode.value === 'banner-code')) {
    const keywordRadio = document.getElementById('modeBannerKeyword');
    if (keywordRadio) {
      keywordRadio.checked = true;
      handleValidationModeChange();
    }
  }
}

// Promisified storage helpers to unify callback vs promise behavior
function storageGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (res) => { resolve(res || {}); });
    } catch (e) {
      resolve({});
    }
  });
}

function storageSet(obj) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(obj, () => {
        if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve();
      });
    } catch (e) { resolve(); }
  });
}

function storageRemove(key) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.remove(key, () => { resolve(); });
    } catch (e) { resolve(); }
  });
}

function setRadioGroupValue(name, value, fallback) {
  const target = document.querySelector(`input[name="${name}"][value="${value}"]`) || document.querySelector(`input[name="${name}"][value="${fallback}"]`);
  if (target) {
    target.checked = true;
  }
}

function getRadioGroupValue(name, fallback) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
}

function attachRadioGroupChange(name, handler) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(input => {
    input.addEventListener('change', handler);
  });
}

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  translatePage();
  
  // Detect platform first for mobile restrictions
  await detectPlatformForOptions();
  
  setupTabs();
  await loadSettings();
  await loadOfficialList();
  await loadLists();
  await loadPersonalDomains();
  
  // Apply mobile restrictions after settings are loaded
  applyMobileRestrictions();
  
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
  document.getElementById('learnMoreBtn').addEventListener('click', showLearnMoreModal);
  document.getElementById('downloadExampleBtn').addEventListener('click', downloadExample);
  document.getElementById('closeModal').addEventListener('click', closeLearnMoreModal);
  // Simplified sharing: only Google Forms (hardcoded). Remove Gist/proxy buttons.
  document.getElementById('shareToFormBtn')?.addEventListener('click', sharePersonalToForm);
  document.getElementById('shareToFormAboutBtn')?.addEventListener('click', sharePersonalToForm);
  
  // Auto-sauvegarde sur changements
  document.getElementById('checkCN')?.addEventListener('change', saveSettings);
  document.getElementById('trainingMode')?.addEventListener('change', saveSettings);
  document.getElementById('showUnknownPages')?.addEventListener('change', saveSettings);
  document.getElementById('cacheDuration')?.addEventListener('change', saveSettings);
  document.getElementById('customKeyword')?.addEventListener('input', debounce(saveSettings, 500));
  attachRadioGroupChange('autoAddUnknown', saveSettings);
  attachRadioGroupChange('bannerSize', saveSettings);
  
  // Nouveaux gestionnaires pour validation de sécurité
  setupValidationModeListeners();
  document.getElementById('regenerateCodeBtn')?.addEventListener('click', regenerateCode);
  
  // Nouveaux gestionnaires pour personnalisation des couleurs
  setupBannerStyleListeners();
  
  // Fermer la modal en cliquant en dehors
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('learnMoreModal');
    if (e.target === modal) {
      closeLearnMoreModal();
    }
  });
});

// Lightweight logger (mirrors background SSLog): debug controlled by settings.debug
const SSLog = (function(){
  let DEBUG = false;
  async function init() {
    try {
      const { settings } = await storageGet(['settings']);
      DEBUG = !!(settings && settings.debug);
    } catch (e) { DEBUG = false; }
  }
  function debug(...args) { if (DEBUG) console.debug('[ShieldSign]', ...args); }
  function info(...args) { if (DEBUG) console.info('[ShieldSign]', ...args); }
  function warn(...args) { console.warn('[ShieldSign]', ...args); }
  function error(...args) { console.error('[ShieldSign]', ...args); }
  init().catch(()=>{});
  return { init, debug, info, warn, error };
})();

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
    const { settings } = await storageGet(['settings']);
      const currentSettings = settings || DEFAULT_SETTINGS;
    
    document.getElementById('checkCN').checked = currentSettings.checkCN || false;
    document.getElementById('ttl').value = (currentSettings.ttl || DEFAULT_SETTINGS.ttl) / 3600000; // Convertir ms en heures
    document.getElementById('enterpriseMode').checked = currentSettings.enterpriseMode || false;
    
    // NE PLUS CHARGER les anciennes couleurs simples (commenté pour compatibilité)
    // document.getElementById('colorEnterprise').value = currentSettings.bannerColors?.enterprise || DEFAULT_SETTINGS.bannerColors.enterprise;
    // document.getElementById('colorCommunity').value = currentSettings.bannerColors?.community || DEFAULT_SETTINGS.bannerColors.community;
    // document.getElementById('colorPersonal').value = currentSettings.bannerColors?.personal || DEFAULT_SETTINGS.bannerColors.personal;
    
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
    
    setRadioGroupValue('autoAddUnknown', currentSettings.autoAddUnknown || 'prompt', 'prompt');
    
    // Charger la taille du bandeau
    setRadioGroupValue('bannerSize', currentSettings.bannerSize || 'large', 'large');
    
    // Charger et afficher le code actuel
    await loadCurrentCode();
    
    // Mettre à jour l'affichage des champs selon le mode
    handleValidationModeChange();
    
    // Charger les paramètres de style des bandeaux
    loadBannerStyleSettings(currentSettings);
    
    // Afficher/masquer l'onglet entreprise
    updateEnterpriseTabVisibility(currentSettings.enterpriseMode || false);
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorLoading'), true);
  }
}

// Sauvegarder les paramètres
async function saveSettings() {
  try {
    const { settings } = await storageGet(['settings']);
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
      language: currentSettings.language || 'auto', // Conserver la langue existante ou auto
      
      // Nouveaux paramètres de validation
      validationMode: validationMode,
      customKeyword: customKeyword,
      currentCode: currentSettings.currentCode || '', // Conserver le code existant
      showUnknownPages: document.getElementById('showUnknownPages')?.checked || false,
      autoAddUnknown: getRadioGroupValue('autoAddUnknown', 'prompt'),
      
      // Taille du bandeau
      bannerSize: getRadioGroupValue('bannerSize', 'large'),
      
      // Platform defaults already applied
      platformDefaultsApplied: currentSettings.platformDefaultsApplied || false,
      
      // Sauvegarder les nouveaux paramètres de style des bandeaux
      bannerStyle: saveBannerStyleSettings(),
      
      // Anciennes couleurs (conservées pour rétrocompatibilité mais non utilisées)
      bannerColors: {
        enterprise: '#2ECC71',
        community: '#3498DB',
        personal: '#9B59B6'
      }
    };
    
    await storageSet({ settings: newSettings });
    updateEnterpriseTabVisibility(newSettings.enterpriseMode);
    showToast(chrome.i18n.getMessage('toastSettingsSaved'));
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorSaving'), true);
  }
}

// Réinitialiser les paramètres
async function resetSettings() {
  try {
    await storageSet({ settings: DEFAULT_SETTINGS });
    await loadSettings();
    showToast(chrome.i18n.getMessage('toastSettingsReset'));
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorResetting'), true);
  }
}

// Charger les listes
async function loadLists() {
  try {
    const { lists } = await storageGet(['lists']);
    
    const enterpriseList = document.getElementById('enterpriseList');
    const communityLists = document.getElementById('communityLists');
    
    if (!enterpriseList || !communityLists) {
      return;
    }
    
    enterpriseList.textContent = '';
    communityLists.textContent = '';
    const p1 = document.createElement('p'); p1.className = 'no-list'; p1.textContent = chrome.i18n.getMessage('noListEnterprise'); enterpriseList.appendChild(p1);
    const p2 = document.createElement('p'); p2.className = 'no-list'; p2.textContent = chrome.i18n.getMessage('noListCommunity'); communityLists.appendChild(p2);
    
    if (!lists || Object.keys(lists).length === 0) {
      return;
    }
    
    const OFFICIAL_URL = 'https://raw.githubusercontent.com/ZA512/ShieldSign/main/shieldsign_public_list_v1.json';
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
          enterpriseList.textContent = '';
          hasEnterprise = true;
        }
        enterpriseList.appendChild(listItem);
      } else {
        if (!hasCommunity) {
          communityLists.textContent = '';
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
  // create icon element instead of innerHTML to avoid HTML injection
  const icon = document.createElement('i');
  icon.className = listData.enabled !== false ? 'fas fa-check-circle' : 'fas fa-times-circle';
  toggleBtn.appendChild(icon);
  toggleBtn.title = listData.enabled !== false ? chrome.i18n.getMessage('toggleDisable') : chrome.i18n.getMessage('toggleEnable');
  toggleBtn.addEventListener('click', () => toggleList(url, listData.enabled === false));
  
  actions.appendChild(toggleBtn);
  
  // Bouton supprimer (seulement si ce n'est pas la liste officielle)
  if (!listData.isOfficial) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    const remIcon = document.createElement('i'); remIcon.className = 'fas fa-times'; removeBtn.appendChild(remIcon);
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
    const cleanUrl = (url || '').trim();
    let response = await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'TOGGLE_LIST', url: cleanUrl, enabled }, (r) => resolve(r)));

    SSLog.debug('options.toggleList: initial response', { url: cleanUrl, response });

    // If the runtime message returned no response (rare in some Firefox contexts), retry once briefly
    if (!response) {
      await new Promise((res) => setTimeout(res, 250));
      SSLog.warn('[ShieldSign] options.toggleList: no response, retrying once', { url: cleanUrl });
      response = await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'TOGGLE_LIST', url: cleanUrl, enabled }, (r) => resolve(r)));
      SSLog.debug('options.toggleList: retry response', { url: cleanUrl, response });
    }

    // If first attempt failed, try normalized variant (strip query/hash/trailing slash)
    if (!response || !response.success) {
      let norm = cleanUrl;
      try {
        const u = new URL(cleanUrl);
        u.search = '';
        u.hash = '';
        norm = u.href.replace(/\/$/, '');
      } catch (e) {
        norm = cleanUrl.replace(/\/$/, '');
      }

      if (norm !== cleanUrl) {
        SSLog.warn('[ShieldSign] toggleList: retrying with normalized URL', { original: cleanUrl, normalized: norm });
        response = await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'TOGGLE_LIST', url: norm, enabled }, (r) => resolve(r)));
      }
    }

    if (response && response.success) {
      showToast(enabled ? chrome.i18n.getMessage('toastListEnabled') : chrome.i18n.getMessage('toastListDisabled'));
      await loadLists();
    } else {
      console.error('[ShieldSign] toggleList failed', { url, cleanUrl, response });
      // If response is completely missing, give a specific hint to the user
      if (!response) {
        showToast(chrome.i18n.getMessage('errorUpdating') || 'Erreur de communication avec l’arrière-plan', true);
      } else {
        showToast(response?.error || chrome.i18n.getMessage('errorTogglingList'), true);
      }
    }
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorTogglingList'), true);
  }
}

// Charger la liste personnelle
async function loadPersonalDomains() {
  try {
    const { user_whitelist } = await storageGet(['user_whitelist']);
    const personalDomainsList = document.getElementById('personalDomainsList');
    
    personalDomainsList.textContent = '';
    
    if (!user_whitelist || user_whitelist.length === 0) {
      const p3 = document.createElement('p'); p3.className = 'no-list'; p3.textContent = chrome.i18n.getMessage('noListPersonal'); personalDomainsList.appendChild(p3);
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
      const remIcon2 = document.createElement('i'); remIcon2.className = 'fas fa-times'; removeBtn.appendChild(remIcon2);
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

// Render personal domains list from provided array (used to update UI immediately)
async function renderPersonalDomains(user_whitelist) {
  try {
    const personalDomainsList = document.getElementById('personalDomainsList');
    personalDomainsList.textContent = '';

    if (!user_whitelist || user_whitelist.length === 0) {
      const p4 = document.createElement('p'); p4.className = 'no-list'; p4.textContent = chrome.i18n.getMessage('noListPersonal'); personalDomainsList.appendChild(p4);
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
      const remIcon3 = document.createElement('i'); remIcon3.className = 'fas fa-times'; removeBtn.appendChild(remIcon3);
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
    const resp = await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'ADD_PERSONAL_DOMAIN', domain }, (r) => resolve(r)));
    showToast(chrome.i18n.getMessage('toastDomainAdded'));
    input.value = '';
    if (resp && resp.user_whitelist) {
      // Update UI directly
      await renderPersonalDomains(resp.user_whitelist);
      return;
    }
    await loadPersonalDomains();
  } catch (error) {
    showToast(chrome.i18n.getMessage('errorAddingDomain'), true);
  }
}

// Supprimer un domaine personnel
async function removePersonalDomain(domain) {
  try {
    const resp = await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'REMOVE_PERSONAL_DOMAIN', domain }, (r) => resolve(r)));
    showToast(chrome.i18n.getMessage('toastDomainRemoved'));
    if (resp && resp.user_whitelist) {
      await renderPersonalDomains(resp.user_whitelist);
      return;
    }
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
function showToast(message, isError = false, durationMs = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, durationMs);
}

// Gérer la liste officielle en dur
async function loadOfficialList() {
  const toggle = document.getElementById('officialListToggle');
  
  if (!toggle) {
    return;
  }
  
  try {
    const { lists } = await storageGet(['lists']);
    
    // lists est un objet {url: listData}, pas un tableau
    const officialUrl = 'https://raw.githubusercontent.com/ZA512/ShieldSign/main/shieldsign_public_list_v1.json';
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
      // create icon safely
      while (toggle.firstChild) toggle.removeChild(toggle.firstChild);
      const iconEl = document.createElement('i'); iconEl.className = 'fas fa-check-circle'; toggle.appendChild(iconEl);
      toggle.title = chrome.i18n.getMessage('toggleDisable');
    } else {
      toggle.classList.add('disabled');
      while (toggle.firstChild) toggle.removeChild(toggle.firstChild);
      const iconEl2 = document.createElement('i'); iconEl2.className = 'fas fa-times-circle'; toggle.appendChild(iconEl2);
      toggle.title = chrome.i18n.getMessage('toggleEnable');
    }
    // Ensure subtitle text is empty (we don't display an approximate count)
    const subtitleEl = document.querySelector('#officialListItem .list-url');
    if (subtitleEl) subtitleEl.textContent = '';
  } catch (error) {
  }
}

// Fallback listener: sometimes Firefox's sendMessage callback can be unreliable.
// Listen for TOGGLE_LIST_RESULT broadcasts from the background as a backup.
chrome.runtime.onMessage.addListener((msg) => {
  try {
    if (msg && msg.action === 'TOGGLE_LIST_RESULT') {
      SSLog.debug('options received TOGGLE_LIST_RESULT', msg);
      // Refresh lists UI to reflect the change
      loadLists().catch(() => {});
      // Update official toggle state if applicable
      const officialUrl = 'https://raw.githubusercontent.com/ZA512/ShieldSign/main/shieldsign_public_list_v1.json';
      if (msg.url === officialUrl) {
        // Update the toggle UI
        const toggle = document.getElementById('officialListToggle');
        if (toggle) {
          const enabled = !!msg.enabled;
          toggle.classList.toggle('enabled', enabled);
          toggle.classList.toggle('disabled', !enabled);
          while (toggle.firstChild) toggle.removeChild(toggle.firstChild);
          const iconToggle = document.createElement('i'); iconToggle.className = enabled ? 'fas fa-check-circle' : 'fas fa-times-circle'; toggle.appendChild(iconToggle);
          toggle.title = enabled ? chrome.i18n.getMessage('toggleDisable') : chrome.i18n.getMessage('toggleEnable');
        }
      }
    }
  } catch (e) { /* ignore */ }
});

// Toggle liste officielle
async function toggleOfficialList() {
  const toggle = document.getElementById('officialListToggle');
  
  try {
    // Envoyer le toggle (le background.js gère l'inversion automatique)
    let response = await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'TOGGLE_LIST', url: 'https://raw.githubusercontent.com/ZA512/ShieldSign/main/shieldsign_public_list_v1.json' }, (r) => resolve(r)));
    SSLog.debug('[ShieldSign] options.toggleOfficialList: initial response', response);
    if (!response) {
      // brief retry
      await new Promise((res) => setTimeout(res, 200));
      SSLog.warn('[ShieldSign] options.toggleOfficialList: no response, retrying once');
      response = await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'TOGGLE_LIST', url: 'https://raw.githubusercontent.com/ZA512/ShieldSign/main/shieldsign_public_list_v1.json' }, (r) => resolve(r)));
      SSLog.debug('[ShieldSign] options.toggleOfficialList: retry response', response);
    }
    
    if (response && response.success) {
      // Mettre à jour l'affichage avec le nouvel état
      const newEnabled = response.enabled;
      toggle.classList.toggle('enabled', newEnabled);
      toggle.classList.toggle('disabled', !newEnabled);
      while (toggle.firstChild) toggle.removeChild(toggle.firstChild);
      const newToggleIcon = document.createElement('i'); newToggleIcon.className = newEnabled ? 'fas fa-check-circle' : 'fas fa-times-circle'; toggle.appendChild(newToggleIcon);
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
    const url = 'https://raw.githubusercontent.com/ZA512/ShieldSign/main/shieldsign_public_list_v1.json';
    
    // Récupérer les listes actuelles
    const { lists } = await storageGet(['lists']);
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
    
    await storageSet({ lists: currentLists });
    
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
  
  // Masquer aussi la section de personnalisation du bandeau Enterprise
  const bannerSection = document.getElementById('enterpriseBannerStyle');
  if (bannerSection) {
    bannerSection.style.display = show ? 'block' : 'none';
  }
}

// Toggle mode entreprise
async function toggleEnterpriseMode(e) {
  updateEnterpriseTabVisibility(e.target.checked);
  showToast(e.target.checked ? chrome.i18n.getMessage('toastEnterpriseModeEnabled') : chrome.i18n.getMessage('toastEnterpriseModeDisabled'));
}

// Exporter la liste personnelle
async function exportPersonalList() {
  try {
    const { user_whitelist } = await storageGet(['user_whitelist']);
    
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

// Form detection and POST handled by background to avoid CORS issues

// Hardcoded Google Form URL (hidden from UI)
const HARDCODED_GOOGLE_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSce_bowurxHSWmiYqRa-QrTu2OEnHCdKFdx1AvqE0CqmHqxEg/viewform?usp=dialog';

// Share personal list to Google Form (anonymized)
async function sharePersonalToForm() {
  const formUrl = HARDCODED_GOOGLE_FORM;
  await sharePersonalToFormInternal(formUrl);
}

async function sharePersonalToFormInternal(formUrl) {
  try {
    showToast(chrome.i18n.getMessage('toastPreparingSubmission'));

    // Récupérer les domaines personnels
    const { user_whitelist } = await storageGet(['user_whitelist']);
    const personal = user_whitelist || [];

    if (personal.length === 0) { showToast(chrome.i18n.getMessage('toastNoDomainsToShare'), true); return; }

    // Récupérer les domaines existants (toutes listes) via background
    let existing = new Set();
    try {
      const resp = await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'GET_ALL_ACTIVE_DOMAINS' }, (r) => resolve(r)));
      const enterprise = resp?.enterprise || [];
      const community = resp?.community || [];
      // Do NOT include personal here: we want to share items from user's personal list
      const normalize = (s) => (s || '').toLowerCase().trim().replace(/^www\./, '');
      const all = [ ...(enterprise || []), ...(community || []) ];
      existing = new Set(all.map(d => normalize(d)).filter(Boolean));
    } catch (e) {
      existing = new Set();
    }

    // Normaliser et filtrer
    const normalized = personal.map(d => d.toLowerCase().trim().replace(/^www\./, '')).filter(Boolean);

    // Charger historique des partages pour éviter double envoi
    const { shared_to_form } = await storageGet(['shared_to_form']);
    const sharedSet = new Set(shared_to_form || []);

    const filteredByExisting = normalized.filter(d => existing.has(d));
    const filteredByShared = normalized.filter(d => sharedSet.has(d));
    const toSend = normalized.filter(d => !existing.has(d) && !sharedSet.has(d));

    if (toSend.length === 0) {
      if (filteredByExisting.length > 0) {
        showToast(`Aucun domaine nouveau à partager — ${filteredByExisting.length} domaine(s) existent déjà dans les listes communautaires.`, true, 6500);
        return;
      }
      if (filteredByShared.length > 0) {
        showToast(`Aucun domaine nouveau à partager — ${filteredByShared.length} domaine(s) ont déjà été partagés localement.`, true, 6500);
        return;
      }
      showToast(chrome.i18n.getMessage('toastNoNewDomainsToShare'), true, 6500);
      return;
    }

    // Debug: inform user how many domains will be sent
    
    showToast(`Envoi de ${toSend.length} domaine(s)...`);

    // Try to detect entry id; if not found, fallback to copy & open form for manual paste
    // Ask background to detect entry id (avoids CORS issues in options page)
    let entryId = null;
    try {
      const resp = await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'DETECT_FORM_ENTRY', formUrl }, (r) => resolve(r)));
      entryId = resp?.entryId || null;
      
    } catch (e) {
      entryId = null;
    }

    // If initial detection failed, attempt a tab-based detection which executes in page context
    if (!entryId) {
      try {
        
        const resp2 = await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'DETECT_FORM_ENTRY_VIA_TAB', formUrl }, (r) => resolve(r)));
        if (resp2?.entryId) entryId = resp2.entryId;
      } catch (e) { }
    }

    let successCount = 0;
    if (!entryId) {
      // Fallback: copy to clipboard and open form for manual paste
      await navigator.clipboard.writeText(toSend.join('\n'));
      try {
        // Open the canonical form view (strip query/hash) to avoid dialog-only view that appears empty
        let openUrl = formUrl;
        try { const u = new URL(formUrl); u.search = ''; u.hash = ''; openUrl = u.href; } catch (e) { openUrl = formUrl; }
        window.open(openUrl, '_blank');
      } catch (e) {
        window.open(formUrl, '_blank');
      }
      showToast('Champ du formulaire non détecté automatiquement. Les domaines ont été copiés. Collez-les dans le formulaire ouvert.');
      return;
    }

    // Try posting; if posting fails for any reason, fallback to copy+open to guarantee success
    try {
      for (const domain of toSend) {
        try {
          const resp = await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'POST_TO_GOOGLE_FORM', formBaseUrl: formUrl, entryId, domain }, (r) => resolve(r)));
          if (resp && resp.ok) {
            successCount++;
            sharedSet.add(domain);
          } else {
            SSLog.warn('POST_TO_GOOGLE_FORM failed', resp);
          }
        } catch (e) {
          SSLog.warn('Failed to post', domain, e);
        }
      }

      if (successCount === 0) {
        // Nothing posted — fallback
        await navigator.clipboard.writeText(toSend.join('\n'));
        try { let openUrl = formUrl; try { const u = new URL(formUrl); u.search = ''; u.hash = ''; openUrl = u.href; } catch (e) { openUrl = formUrl; } window.open(openUrl, '_blank'); } catch (e) { window.open(formUrl, '_blank'); }
        showToast('Impossible d’envoyer automatiquement. Les domaines ont été copiés. Collez-les dans le formulaire ouvert.');
      } else {
        await storageSet({ shared_to_form: Array.from(sharedSet) });
        // Short, polite success message
        showToast(chrome.i18n.getMessage('toastDomainsSharedShort') || 'Merci pour le partage');
      }
    } catch (postErr) {
      console.error('Posting to Google Form failed', postErr);
      // Fallback to copy+open
      try { await navigator.clipboard.writeText(toSend.join('\n')); } catch (e) { /* ignore */ }
        try { let openUrl = formUrl; try { const u = new URL(formUrl); u.search = ''; u.hash = ''; openUrl = u.href; } catch (e) { openUrl = formUrl; } window.open(openUrl, '_blank'); } catch (e) { window.open(formUrl, '_blank'); }
        showToast('Erreur lors de l’envoi automatique. Les domaines ont été copiés ; collez-les dans le formulaire ouvert.');
    }
  } catch (err) {
    console.error('Erreur sharePersonalToFormInternal', err);
    const msg = err && err.message ? `${chrome.i18n.getMessage('toastShareError')} : ${err.message}` : chrome.i18n.getMessage('toastShareError');
    showToast(msg, true);
  }
}

async function clearSharedHistory() {
  // clearSharedHistory kept for backward compatibility but UI removed
  if (!confirm(chrome.i18n.getMessage('confirmClearSharedHistory'))) return;
  await storageRemove('shared_to_form');
  showToast(chrome.i18n.getMessage('toastSharedHistoryCleared'));
}

// Initialiser l'état du compteur de partages
(async function initSharedUI(){
  // No UI counter for shared history. Keep storage initialized if needed.
  try {
    // noop: ensure key exists
    const data = await storageGet(['shared_to_form']);
    if (!data.shared_to_form) await storageSet({ shared_to_form: [] });
  } catch (e) {
    // ignore
  }
})();

// Préparer le payload de contribution (JSON standardisé)
async function prepareContributionPayload(maintainer) {
  const { user_whitelist } = await storageGet(['user_whitelist']);
  const domains = user_whitelist || [];
  const manifest = chrome.runtime.getManifest();

  return {
    schema_version: 1,
    list_name: `Contribution personnelle ShieldSign (${domains.length} domaines)`,
    maintainer: maintainer || 'anonymous',
    export_date: new Date().toISOString(),
    domains: domains,
    source: 'extension-shieldsign',
    notes: `Generated by ShieldSign ${manifest.version}`
  };
}

// Gist/proxy 1-click sharing removed: we only use Google Forms now.

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
    const { user_whitelist = [] } = await storageGet(['user_whitelist']);
    const mergedDomains = [...new Set([...user_whitelist, ...validDomains])];

    await storageSet({ user_whitelist: mergedDomains });
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
  
  // Auto-sauvegarde
  saveSettings();
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

/* ========================================
   GESTION DE L'INTERFACE DE PERSONNALISATION DES COULEURS
   ======================================== */

// Configuration des listeners pour les 3 types de bandeaux
function setupBannerStyleListeners() {
  const types = ['enterprise', 'community', 'personal'];
  
  types.forEach(type => {
    // Radio buttons pour le mode (solid/gradient/random)
    const radios = document.querySelectorAll(`input[name="${type}Mode"]`);
    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        handleBannerModeChange(type, radio.value);
        saveSettings();
      });
    });
    
    // Color pickers
    const solidColor = document.getElementById(`${type}SolidColor`);
    const gradientStart = document.getElementById(`${type}GradientStart`);
    const gradientEnd = document.getElementById(`${type}GradientEnd`);
    const textColor = document.getElementById(`${type}TextColor`);
    
    if (solidColor) solidColor.addEventListener('input', () => { updateBannerPreview(type); saveSettings(); });
    if (gradientStart) gradientStart.addEventListener('input', () => { updateBannerPreview(type); saveSettings(); });
    if (gradientEnd) gradientEnd.addEventListener('input', () => { updateBannerPreview(type); saveSettings(); });
    if (textColor) textColor.addEventListener('input', () => { updateBannerPreview(type); saveSettings(); });
    
    // Font select
    const fontSelect = document.getElementById(`${type}FontFamily`);
    if (fontSelect) fontSelect.addEventListener('change', () => { updateBannerPreview(type); saveSettings(); });
    
    // Boutons aléatoires
    const randomBtn = document.getElementById(`${type}RandomBtn`);
    const randomGradientBtn = document.getElementById(`${type}RandomGradientBtn`);
    
    if (randomBtn) {
      randomBtn.addEventListener('click', () => generateRandomColor(type, 'solid'));
    }
    
    if (randomGradientBtn) {
      randomGradientBtn.addEventListener('click', () => generateRandomColor(type, 'gradient'));
    }
  });
}

// Générer une couleur aléatoire harmonieuse
function generateRandomColor(type, mode) {
  if (mode === 'solid') {
    // Générer une couleur vive et saturée
    const hue = Math.floor(Math.random() * 360);
    const saturation = 60 + Math.floor(Math.random() * 40); // 60-100%
    const lightness = 45 + Math.floor(Math.random() * 15); // 45-60%
    const color = hslToHex(hue, saturation, lightness);
    
    // Appliquer la couleur
    const solidColorInput = document.getElementById(`${type}SolidColor`);
    if (solidColorInput) {
      solidColorInput.value = color;
      
      // Choisir automatiquement une couleur de texte contrastée
      const textColor = getContrastColor(color);
      const textColorInput = document.getElementById(`${type}TextColor`);
      if (textColorInput) {
        textColorInput.value = textColor;
      }
      
      updateBannerPreview(type);
      saveSettings();
    }
  } else if (mode === 'gradient') {
    // Générer un dégradé harmonieux
    const baseHue = Math.floor(Math.random() * 360);
    const hueShift = 20 + Math.floor(Math.random() * 40); // Décalage de 20-60°
    
    const saturation1 = 60 + Math.floor(Math.random() * 30);
    const lightness1 = 40 + Math.floor(Math.random() * 15);
    
    const saturation2 = 60 + Math.floor(Math.random() * 30);
    const lightness2 = 45 + Math.floor(Math.random() * 15);
    
    const color1 = hslToHex(baseHue, saturation1, lightness1);
    const color2 = hslToHex((baseHue + hueShift) % 360, saturation2, lightness2);
    
    // Appliquer les couleurs
    const startInput = document.getElementById(`${type}GradientStart`);
    const endInput = document.getElementById(`${type}GradientEnd`);
    
    if (startInput && endInput) {
      startInput.value = color1;
      endInput.value = color2;
      
      // Choisir automatiquement une couleur de texte contrastée (basée sur la première couleur)
      const textColor = getContrastColor(color1);
      const textColorInput = document.getElementById(`${type}TextColor`);
      if (textColorInput) {
        textColorInput.value = textColor;
      }
      
      updateBannerPreview(type);
      saveSettings();
    }
  }
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

// Obtenir une couleur de texte contrastée (blanc ou noir)
function getContrastColor(hexColor) {
  // Convertir hex en RGB
  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);
  
  // Calculer la luminance relative
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Retourner blanc pour les couleurs sombres, noir pour les claires
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// Gérer le changement de mode (solid/gradient)
function handleBannerModeChange(type, mode) {
  const container = document.getElementById(`${type}ColorInputs`);
  if (!container) return;
  
  const solidInputs = container.querySelectorAll('.solid-mode');
  const gradientInputs = container.querySelectorAll('.gradient-mode');
  
  // Cacher tous les éléments
  solidInputs.forEach(el => el.style.display = 'none');
  gradientInputs.forEach(el => el.style.display = 'none');
  
  // Afficher les éléments appropriés
  switch (mode) {
    case 'solid':
      solidInputs.forEach(el => el.style.display = 'flex');
      break;
    case 'gradient':
      gradientInputs.forEach(el => el.style.display = 'flex');
      break;
  }
  
  updateBannerPreview(type);
}

// Mettre à jour l'aperçu du bandeau en temps réel
function updateBannerPreview(type) {
  const preview = document.getElementById(`${type}Preview`);
  if (!preview) return;
  
  // Animation de mise à jour
  preview.classList.add('updating');
  
  setTimeout(() => {
    const mode = document.querySelector(`input[name="${type}Mode"]:checked`)?.value || 'solid';
    const textColor = document.getElementById(`${type}TextColor`)?.value || '#FFFFFF';
    const fontFamily = document.getElementById(`${type}FontFamily`)?.value || 'Arial, sans-serif';
    
    let background;
    
    switch (mode) {
      case 'solid':
        const solidColor = document.getElementById(`${type}SolidColor`)?.value || '#2ECC71';
        background = solidColor;
        break;
      
      case 'gradient':
        const gradientStart = document.getElementById(`${type}GradientStart`)?.value || '#27AE60';
        const gradientEnd = document.getElementById(`${type}GradientEnd`)?.value || '#2ECC71';
        background = `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`;
        break;
      
      case 'random':
        // Générer un exemple aléatoire pour l'aperçu
        const randomGradient = generateRandomGradient();
        background = randomGradient;
        break;
    }
    
    preview.style.background = background;
    preview.style.color = textColor;
    preview.style.fontFamily = fontFamily;
    
    preview.classList.remove('updating');
  }, 150);
}

// Charger les paramètres de style dans l'interface
function loadBannerStyleSettings(settings) {
  const types = ['enterprise', 'community', 'personal'];
  
  types.forEach(type => {
    const style = settings.bannerStyle?.[type];
    if (!style) return;
    
    // Charger le mode (solid/gradient/random)
    const modeRadio = document.querySelector(`input[name="${type}Mode"][value="${style.mode}"]`);
    if (modeRadio) {
      modeRadio.checked = true;
      handleBannerModeChange(type, style.mode);
    }
    
    // Charger les couleurs
    const solidColorInput = document.getElementById(`${type}SolidColor`);
    const gradientStartInput = document.getElementById(`${type}GradientStart`);
    const gradientEndInput = document.getElementById(`${type}GradientEnd`);
    const textColorInput = document.getElementById(`${type}TextColor`);
    
    if (solidColorInput && style.solidColor) solidColorInput.value = style.solidColor;
    if (gradientStartInput && style.gradientStart) gradientStartInput.value = style.gradientStart;
    if (gradientEndInput && style.gradientEnd) gradientEndInput.value = style.gradientEnd;
    if (textColorInput && style.textColor) textColorInput.value = style.textColor;
    
    // Charger la police
    const fontSelect = document.getElementById(`${type}FontFamily`);
    if (fontSelect && style.fontFamily) {
      fontSelect.value = style.fontFamily;
    }
    
    // Mettre à jour l'aperçu
    updateBannerPreview(type);
  });
}

// Sauvegarder les paramètres de style
function saveBannerStyleSettings() {
  const types = ['enterprise', 'community', 'personal'];
  const bannerStyle = {};
  
  types.forEach(type => {
    const mode = document.querySelector(`input[name="${type}Mode"]:checked`)?.value || 'solid';
    const solidColor = document.getElementById(`${type}SolidColor`)?.value || '#2ECC71';
    const gradientStart = document.getElementById(`${type}GradientStart`)?.value || '#27AE60';
    const gradientEnd = document.getElementById(`${type}GradientEnd`)?.value || '#2ECC71';
    const textColor = document.getElementById(`${type}TextColor`)?.value || '#FFFFFF';
    const fontFamily = document.getElementById(`${type}FontFamily`)?.value || 'Arial, sans-serif';
    
    bannerStyle[type] = {
      mode,
      solidColor,
      gradientStart,
      gradientEnd,
      textColor,
      fontFamily,
      useRandom: mode === 'random'
    };
  });
  
  return bannerStyle;
}

