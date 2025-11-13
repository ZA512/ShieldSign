// ShieldSign - Background Service Worker
// Gestion du cache des listes, mise à jour, et vérification des domaines

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

// Liste officielle ShieldSign (non supprimable)
const OFFICIAL_LIST_URL = 'https://raw.githubusercontent.com/ZA512/ShieldSign/refs/heads/main/shieldsign_public_list_v1.json';

// Fonction pour générer un code aléatoire de 2 caractères (lettres majuscules + chiffres)
function generateRandomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 2; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Initialisation au démarrage
chrome.runtime.onInstalled.addListener(async () => {
  // Initialiser le storage si vide
  const data = await chrome.storage.local.get(['lists', 'user_whitelist', 'settings']);
  
  if (!data.lists) {
    await chrome.storage.local.set({ lists: {} });
  }
  
  // Ajouter la liste officielle si pas déjà présente
  const lists = data.lists || {};
  if (!lists[OFFICIAL_LIST_URL]) {
    lists[OFFICIAL_LIST_URL] = {
      etag: null,
      lastFetch: 0,
      data: null,
      localType: 'community',
      isOfficial: true,
      enabled: true
    };
    await chrome.storage.local.set({ lists });
  }
  
  // Migrer les anciens settings et générer le premier code
  await migrateSettings();
  
  // Configurer l'alarme quotidienne pour régénérer le code
  chrome.alarms.create('regenerateCode', { periodInMinutes: 1440 }); // 24h
  
  if (!data.user_whitelist) {
    await chrome.storage.local.set({ user_whitelist: [] });
  }
  
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  
  // Lancer la première mise à jour des listes (avec await pour garantir le téléchargement)
  await updateLists();
});

// Fonction de migration des settings pour compatibilité avec anciennes versions
async function migrateSettings() {
  const { settings } = await chrome.storage.local.get(['settings']);
  let currentSettings = settings || {};
  
  // Fusionner avec DEFAULT_SETTINGS pour ajouter les nouveaux champs
  const migratedSettings = { ...DEFAULT_SETTINGS, ...currentSettings };
  
  // Générer un code initial si pas déjà présent
  if (!migratedSettings.currentCode) {
    migratedSettings.currentCode = generateRandomCode();
  }
  
  // Migrer anciennes couleurs vers nouveau format si nécessaire
  if (currentSettings.bannerColors && !currentSettings.bannerStyle) {
    migratedSettings.bannerStyle = {
      enterprise: {
        mode: 'solid',
        solidColor: currentSettings.bannerColors.enterprise || DEFAULT_SETTINGS.bannerColors.enterprise,
        textColor: '#FFFFFF',
        gradientStart: currentSettings.bannerColors.enterprise || DEFAULT_SETTINGS.bannerColors.enterprise,
        gradientEnd: '#27AE60',
        fontFamily: 'inherit',
        useRandom: false
      },
      community: {
        mode: 'solid',
        solidColor: currentSettings.bannerColors.community || DEFAULT_SETTINGS.bannerColors.community,
        textColor: '#FFFFFF',
        gradientStart: currentSettings.bannerColors.community || DEFAULT_SETTINGS.bannerColors.community,
        gradientEnd: '#2980B9',
        fontFamily: 'inherit',
        useRandom: false
      },
      personal: {
        mode: 'solid',
        solidColor: currentSettings.bannerColors.personal || DEFAULT_SETTINGS.bannerColors.personal,
        textColor: '#FFFFFF',
        gradientStart: currentSettings.bannerColors.personal || DEFAULT_SETTINGS.bannerColors.personal,
        gradientEnd: '#8E44AD',
        fontFamily: 'inherit',
        useRandom: false
      }
    };
  }
  
  await chrome.storage.local.set({ settings: migratedSettings });
  return migratedSettings;
}

// Note: Le code aléatoire est maintenant généré à chaque affichage (bandeau + badge)
// Plus besoin d'alarme quotidienne ou de stockage du code

// Vérification si un domaine correspond exactement
function isDomainMatch(hostname, domain) {
  return hostname === domain;
}

// Récupération de toutes les listes actives avec priorité
async function getAllActiveDomains() {
  const { lists, user_whitelist } = await chrome.storage.local.get(['lists', 'user_whitelist']);
  
  const domainsMap = {
    enterprise: new Map(),
    personal: new Map(),
    community: new Map()
  };
  
  // Ajouter la liste personnelle
  if (user_whitelist && user_whitelist.length > 0) {
    for (const domain of user_whitelist) {
      domainsMap.personal.set(domain, 'Liste personnelle');
    }
  }
  
  // Parcourir toutes les listes
  if (lists) {
    for (const [url, listData] of Object.entries(lists)) {
      // Vérifier si la liste est activée (par défaut true si non spécifié)
      const enabled = listData.enabled !== false;
      
      if (enabled && listData.data && listData.data.domains) {
        const type = listData.localType || 'community';
        const listName = listData.data.list_name || url;
        
        for (const domain of listData.data.domains) {
          domainsMap[type].set(domain, listName);
        }
      }
    }
  }
  
  return domainsMap;
}

// Vérification d'un domaine avec gestion des priorités
async function checkDomain(hostname) {
  const domainsMap = await getAllActiveDomains();
  
  // Ordre de priorité: enterprise > personal > community
  const priorities = ['enterprise', 'personal', 'community'];
  
  for (const type of priorities) {
    if (domainsMap[type].has(hostname)) {
      return {
        status: 'VALIDATED',
        listName: domainsMap[type].get(hostname),
        type: type
      };
    }
  }
  
  return { status: 'UNKNOWN' };
}

// ========================================
// SYSTÈME DE BADGE DYNAMIQUE
// ========================================

// Mettre à jour le badge de l'extension
async function updateBadge(tabId, status, listType = null, uniqueCode = null) {
  const { settings } = await chrome.storage.local.get(['settings']);
  const currentSettings = settings || DEFAULT_SETTINGS;
  const validationMode = currentSettings.validationMode || 'banner-code';
  const showUnknownPages = currentSettings.showUnknownPages || false;
  
  console.log('[ShieldSign] updateBadge:', { tabId, status, listType, validationMode, showUnknownPages, uniqueCode });
  
  try {
    if (status === 'VALIDATED') {
      // Page validée
      console.log('[ShieldSign] ===== BADGE UPDATE - VALIDATED =====');
      console.log('[ShieldSign] validationMode:', validationMode);
      console.log('[ShieldSign] listType:', listType);
      console.log('[ShieldSign] uniqueCode:', uniqueCode);
      
      if (validationMode === 'badge-only') {
        console.log('[ShieldSign] MODE: badge-only - Couleur verte fixe');
        // Mode badge uniquement : badge vert sans texte (juste la couleur verte visible)
        await chrome.action.setBadgeBackgroundColor({ color: '#28A745', tabId: tabId }); // Vert vif
        await chrome.action.setBadgeText({ text: ' ', tabId: tabId }); // Espace pour afficher le badge sans texte
      } else if (validationMode === 'banner-code') {
        console.log('[ShieldSign] MODE: banner-code - Couleur VERTE avec code');
        // Mode code : afficher le code unique avec badge vert (toujours vert)
        const code = uniqueCode || generateRandomCode();
        console.log('[ShieldSign] Code affiché:', code);
        console.log('[ShieldSign] Couleur appliquée: #28A745 (VERT)');
        await chrome.action.setBadgeBackgroundColor({ color: '#28A745', tabId: tabId }); // Vert vif
        await chrome.action.setBadgeText({ text: code, tabId: tabId });
      } else {
        console.log('[ShieldSign] MODE: keyword - Badge VERT sans texte');
        // Mode keyword : badge vert uni sans texte
        await chrome.action.setBadgeBackgroundColor({ color: '#28A745', tabId: tabId }); // Vert vif
        await chrome.action.setBadgeText({ text: ' ', tabId: tabId }); // Espace pour badge sans texte
      }
      console.log('[ShieldSign] ===== FIN BADGE UPDATE =====');
    } else if (status === 'UNKNOWN' && showUnknownPages) {
      // Page non listée avec option activée
      await chrome.action.setBadgeBackgroundColor({ color: '#DC3545', tabId: tabId }); // Rouge
      await chrome.action.setBadgeText({ text: '?', tabId: tabId });
    } else if (status === 'NO_PASSWORD' && showUnknownPages) {
      // Page sans password avec option activée
      await chrome.action.setBadgeBackgroundColor({ color: '#6C757D', tabId: tabId }); // Gris
      await chrome.action.setBadgeText({ text: '○', tabId: tabId });
    } else {
      // Pas de badge
      await chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la mise à jour du badge:', error);
  }
}

// Obtenir la couleur du badge selon le type de liste
function getBadgeColorForType(listType, settings) {
  const bannerStyle = settings.bannerStyle || DEFAULT_SETTINGS.bannerStyle;
  
  switch (listType) {
    case 'enterprise':
      return bannerStyle.enterprise?.solidColor || '#2ECC71';
    case 'personal':
      return bannerStyle.personal?.solidColor || '#9B59B6';
    case 'community':
    default:
      return bannerStyle.community?.solidColor || '#3498DB';
  }
}

// Écouter les changements d'onglets pour mettre à jour le badge
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await updateBadgeForTab(tab);
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la mise à jour du badge:', error);
  }
});

// Écouter les mises à jour d'URL dans les onglets
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await updateBadgeForTab(tab);
  }
});

// Mettre à jour le badge pour un onglet spécifique
const tabCodes = new Map(); // Stocker les codes par onglet

async function updateBadgeForTab(tab) {
  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;
    
    console.log('[ShieldSign] updateBadgeForTab:', hostname);
    
    // Vérifier si la page a un champ password
    const hasPassword = await checkForPasswordField(tab.id);
    
    console.log('[ShieldSign] hasPassword:', hasPassword);
    
    if (!hasPassword) {
      await updateBadge(tab.id, 'NO_PASSWORD');
      tabCodes.delete(tab.id); // Supprimer le code stocké
      return;
    }
    
    // Vérifier le domaine
    const result = await checkDomain(hostname);
    
    console.log('[ShieldSign] checkDomain result:', result);
    
    if (result.status === 'VALIDATED') {
      // Récupérer le code déjà généré pour cet onglet, sinon en générer un nouveau
      let uniqueCode = tabCodes.get(tab.id);
      if (!uniqueCode) {
        uniqueCode = generateRandomCode();
        tabCodes.set(tab.id, uniqueCode);
        console.log('[ShieldSign] Nouveau code généré pour onglet', tab.id, ':', uniqueCode);
      } else {
        console.log('[ShieldSign] Réutilisation code existant pour onglet', tab.id, ':', uniqueCode);
      }
      await updateBadge(tab.id, 'VALIDATED', result.type, uniqueCode);
    } else {
      await updateBadge(tab.id, 'UNKNOWN');
      tabCodes.delete(tab.id);
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur dans updateBadgeForTab:', error);
    // URL invalide ou autre erreur, pas de badge
    await updateBadge(tab.id, 'NO_PASSWORD');
    tabCodes.delete(tab.id);
  }
}

// Vérifier si un onglet a un champ password
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
    return false;
  }
}

// ========================================
// FIN SYSTÈME DE BADGE
// ========================================

// Mise à jour des listes distantes
async function updateLists() {
  const { lists, settings } = await chrome.storage.local.get(['lists', 'settings']);
  const ttl = settings?.ttl || DEFAULT_SETTINGS.ttl;
  const now = Date.now();
  
  if (!lists) return;
  
  for (const [url, listData] of Object.entries(lists)) {
    // Vérifier si la mise à jour est nécessaire
    if (now - (listData.lastFetch || 0) < ttl) {
      continue;
    }
    
    try {
      const headers = {};
      if (listData.etag) {
        headers['If-None-Match'] = listData.etag;
      }
      
      const response = await fetch(url, { headers });
      
      if (response.status === 304) {
        // Non modifié, mettre à jour lastFetch seulement (préserver enabled et isOfficial)
        lists[url].lastFetch = now;
      } else if (response.ok) {
        const data = await response.json();
        
        // Valider le schéma
        if (validateListSchema(data)) {
          lists[url] = {
            etag: response.headers.get('ETag') || listData.etag,
            lastFetch: now,
            data: data,
            localType: listData.localType || 'community',
            // enabled et isOfficial seront préservés lors de la fusion finale
            isOfficial: listData.isOfficial,
            enabled: listData.enabled
          };
        }
      }
    } catch (error) {
      
      // Retry après 5 secondes
      setTimeout(async () => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (validateListSchema(data)) {
              lists[url] = {
                etag: response.headers.get('ETag'),
                lastFetch: now,
                data: data,
                localType: listData.localType || 'community',
                isOfficial: listData.isOfficial || false,
                enabled: 'enabled' in listData ? listData.enabled : true
              };
              await chrome.storage.local.set({ lists });
            }
          }
        } catch (retryError) {
        }
      }, 5000);
    }
  }
  
  // Re-lire le storage avant de sauvegarder pour éviter d'écraser les modifications concurrentes
  const { lists: freshLists } = await chrome.storage.local.get(['lists']);
  
  // Fusionner les mises à jour (lastFetch, data) avec les propriétés actuelles (enabled, isOfficial)
  for (const [url, updatedData] of Object.entries(lists)) {
    if (freshLists[url]) {
      // Préserver enabled et isOfficial de la version fraîche
      freshLists[url] = {
        ...updatedData,
        enabled: freshLists[url].enabled !== undefined ? freshLists[url].enabled : updatedData.enabled,
        isOfficial: freshLists[url].isOfficial !== undefined ? freshLists[url].isOfficial : updatedData.isOfficial
      };
    }
  }
  
  await chrome.storage.local.set({ lists: freshLists });
}

// Gérer la soumission d'un formulaire sur un site inconnu
async function handleFormSubmission(hostname) {
  try {
    // Vérifier si le site est déjà validé
    const domainStatus = await checkDomain(hostname);
    
    if (domainStatus.status !== 'UNKNOWN') {
      // Site déjà dans une liste, ne rien faire
      return { shouldPrompt: false };
    }
    
    // Récupérer les paramètres
    const { settings } = await chrome.storage.local.get(['settings']);
    const autoAddUnknown = settings?.autoAddUnknown || 'prompt';
    
    console.log('[ShieldSign] Soumission formulaire sur site inconnu:', hostname, '- Mode:', autoAddUnknown);
    
    switch (autoAddUnknown) {
      case 'never':
        // Ne rien faire
        return { shouldPrompt: false };
        
      case 'always':
        // Ajouter automatiquement à la liste personnelle
        await addPersonalDomain(hostname);
        console.log('[ShieldSign] Site ajouté automatiquement:', hostname);
        return { shouldPrompt: false, added: true };
        
      case 'prompt':
      default:
        // Demander à l'utilisateur
        return { shouldPrompt: true };
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur dans handleFormSubmission:', error);
    return { shouldPrompt: false };
  }
}

// Validation du schéma d'une liste
function validateListSchema(data) {
  if (!data || typeof data !== 'object') return false;
  
  // Vérifier les champs requis
  if (typeof data.schema_version !== 'number' || data.schema_version < 1) return false;
  if (typeof data.list_name !== 'string' || data.list_name.length === 0 || data.list_name.length > 128) return false;
  if (!Array.isArray(data.domains) || data.domains.length === 0 || data.domains.length > 1000) return false;
  if (typeof data.maintainer !== 'string' || data.maintainer.length === 0) return false;
  
  // Vérifier le format des domaines
  const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/;
  for (const domain of data.domains) {
    if (typeof domain !== 'string' || !domainRegex.test(domain)) {
      return false;
    }
  }
  
  return true;
}

// Écoute des messages depuis content.js et popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'CHECK_PAGE') {
    checkDomain(message.hostname).then(async (result) => {
      // Ajouter les informations de settings pour le content script
      const { settings } = await chrome.storage.local.get(['settings']);
      result.settings = settings || DEFAULT_SETTINGS;
      
      // Générer un code unique pour cette page et le stocker
      const uniqueCode = generateRandomCode();
      result.uniqueCode = uniqueCode;
      
      // Stocker le code pour cet onglet (pour le badge)
      if (sender.tab && sender.tab.id) {
        tabCodes.set(sender.tab.id, uniqueCode);
        console.log('[ShieldSign] Code généré et stocké pour onglet', sender.tab.id, ':', uniqueCode);
        
        // Mettre à jour le badge avec ce code
        if (result.status === 'VALIDATED') {
          await updateBadge(sender.tab.id, 'VALIDATED', result.type, uniqueCode);
        }
      }
      
      sendResponse(result);
    });
    return true; // Permet la réponse asynchrone
  }
  
  if (message.action === 'ADD_PERSONAL_DOMAIN') {
    addPersonalDomain(message.domain).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'FORM_SUBMITTED') {
    handleFormSubmission(message.hostname).then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.action === 'REMOVE_PERSONAL_DOMAIN') {
    removePersonalDomain(message.domain).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'ADD_LIST') {
    addList(message.url, message.type).then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.action === 'REMOVE_LIST') {
    removeList(message.url).then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.action === 'TOGGLE_LIST') {
    toggleList(message.url, message.enabled).then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.action === 'UPDATE_LISTS') {
    updateLists().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'GET_SETTINGS') {
    chrome.storage.local.get(['settings']).then(data => {
      sendResponse(data.settings || DEFAULT_SETTINGS);
    });
    return true;
  }
  
  if (message.action === 'UPDATE_SETTINGS') {
    chrome.storage.local.set({ settings: message.settings }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Note: GET_CURRENT_CODE et REGENERATE_CODE supprimés car le code est maintenant généré à chaque affichage
});

// Ajouter un domaine à la liste personnelle
async function addPersonalDomain(domain) {
  const { user_whitelist } = await chrome.storage.local.get(['user_whitelist']);
  const list = user_whitelist || [];
  
  if (!list.includes(domain)) {
    list.push(domain);
    await chrome.storage.local.set({ user_whitelist: list });
  }
}

// Retirer un domaine de la liste personnelle
async function removePersonalDomain(domain) {
  const { user_whitelist } = await chrome.storage.local.get(['user_whitelist']);
  const list = user_whitelist || [];
  
  const index = list.indexOf(domain);
  if (index > -1) {
    list.splice(index, 1);
    await chrome.storage.local.set({ user_whitelist: list });
  }
}

// Ajouter une liste distante
async function addList(url, type = 'community') {
  const { lists } = await chrome.storage.local.get(['lists']);
  const allLists = lists || {};
  
  // Vérifier si une liste enterprise existe déjà
  if (type === 'enterprise') {
    const hasEnterprise = Object.values(allLists).some(list => list.localType === 'enterprise');
    if (hasEnterprise) {
      return { success: false, error: 'Une seule liste entreprise peut être configurée.' };
    }
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: 'Impossible de récupérer la liste.' };
    }
    
    const data = await response.json();
    
    if (!validateListSchema(data)) {
      return { success: false, error: 'Schéma de liste invalide.' };
    }
    
    allLists[url] = {
      etag: response.headers.get('ETag'),
      lastFetch: Date.now(),
      data: data,
      localType: type
    };
    
    await chrome.storage.local.set({ lists: allLists });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Supprimer une liste
async function removeList(url) {
  const { lists } = await chrome.storage.local.get(['lists']);
  
  if (lists && lists[url]) {
    // Empêcher la suppression de la liste officielle
    if (lists[url].isOfficial) {
      return { success: false, error: 'La liste officielle ne peut pas être supprimée.' };
    }
    
    delete lists[url];
    await chrome.storage.local.set({ lists });
    return { success: true };
  }
  
  return { success: false, error: 'Liste non trouvée.' };
}

// Activer/désactiver une liste
async function toggleList(url, enabled) {
  const { lists } = await chrome.storage.local.get(['lists']);
  
  if (lists && lists[url]) {
    // Si enabled n'est pas fourni, inverser l'état actuel
    if (enabled === undefined) {
      enabled = !(lists[url].enabled !== false);
    }
    
    lists[url].enabled = enabled;
    await chrome.storage.local.set({ lists });
    
    return { success: true, enabled };
  }
  
  return { success: false, error: 'Liste non trouvée.' };
}

// Mise à jour périodique des listes (toutes les heures)
setInterval(updateLists, 3600000); // 1 heure
