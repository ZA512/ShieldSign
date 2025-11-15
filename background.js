// ShieldSign - Background Service Worker
// Gestion du cache des listes, mise à jour, et vérification des domaines

// Import compat layer for cross-browser API helpers
// We try importScripts (Chrome), otherwise fetch+eval the file so Firefox service worker works too.
let CompatReady = (async () => {
  try {
    if (typeof importScripts === 'function') {
      importScripts('compat.js');
      return;
    }
  } catch (e) {
    console.warn('[ShieldSign] compat import failed', e);
  }

  try {
    const url = (chrome && chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('compat.js') : 'compat.js';
    const resp = await fetch(url);
    if (resp.ok) {
      const text = await resp.text();
      (0, eval)(text);
      return;
    }
  } catch (e) {
    console.warn('[ShieldSign] compat fetch+eval failed', e);
  }

  // Final fallback: provide a fuller compat layer using chrome.* APIs so
  // the service worker still functions even if we couldn't load compat.js
  if (typeof globalThis.Compat === 'undefined') {
    globalThis.Compat = (function(){
      // Storage
      function storageGet(keys) {
        return new Promise((resolve, reject) => {
          try {
            chrome.storage.local.get(keys, (res) => {
              if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
              resolve(res || {});
            });
          } catch (e) {
            // as a very last resort, resolve empty
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
          } catch (e) {
            resolve();
          }
        });
      }

      // Tabs
      function getActiveTab() {
        return new Promise((resolve) => {
          try {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              resolve(tabs && tabs[0] ? tabs[0] : null);
            });
          } catch (e) { resolve(null); }
        });
      }

      function getTab(tabId) {
        return new Promise((resolve) => {
          try {
            chrome.tabs.get(tabId, (tab) => { resolve(tab || null); });
          } catch (e) { resolve(null); }
        });
      }

      // Action / browserAction (badge)
      function setBadgeText(text, tabId) {
        try {
          if (chrome.action && chrome.action.setBadgeText) {
            chrome.action.setBadgeText({ text: String(text), tabId });
            return Promise.resolve();
          }
        } catch (e) {}
        try {
          if (chrome.browserAction && chrome.browserAction.setBadgeText) {
            chrome.browserAction.setBadgeText({ text: String(text), tabId });
            return Promise.resolve();
          }
        } catch (e) {}
        return Promise.resolve();
      }

      function setBadgeBg(color, tabId) {
        try {
          if (chrome.action && chrome.action.setBadgeBackgroundColor) {
            chrome.action.setBadgeBackgroundColor({ color, tabId });
            return Promise.resolve();
          }
        } catch (e) {}
        try {
          if (chrome.browserAction && chrome.browserAction.setBadgeBackgroundColor) {
            chrome.browserAction.setBadgeBackgroundColor({ color, tabId });
            return Promise.resolve();
          }
        } catch (e) {}
        return Promise.resolve();
      }

      // ExecuteScript compat
      function executeScriptCompat(tabId, func) {
        return new Promise(async (resolve) => {
          try {
            if (chrome.scripting && chrome.scripting.executeScript) {
              const results = await chrome.scripting.executeScript({ target: { tabId }, func });
              return resolve(results);
            }
          } catch (e) {}

          try {
            const code = `(${func.toString()})()`;
            chrome.tabs.executeScript(tabId, { code }, (res) => { resolve(res); });
          } catch (err) { resolve(null); }
        });
      }

      return { storageGet, storageSet, getActiveTab, getTab, setBadgeText, setBadgeBg, executeScriptCompat };
    })();
    console.warn('[ShieldSign] Using embedded Compat fallback (chrome.* wrappers)');
  }
})();

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

// Use Compat layer for storage to handle Firefox/Chrome differences
function storageGet(keys) { return CompatReady.then(() => Compat.storageGet(keys)); }
function storageSet(obj) { return CompatReady.then(() => Compat.storageSet(obj)); }

async function actionSetBadgeText(text, tabId) { await CompatReady; return Compat.setBadgeText(text, tabId); }
async function actionSetBadgeBackgroundColor(color, tabId) { await CompatReady; return Compat.setBadgeBg(color, tabId); }

async function executeScriptCompat(tabId, func) { await CompatReady; return Compat.executeScriptCompat(tabId, func); }

// Initialisation au démarrage
chrome.runtime.onInstalled.addListener(async () => {
  // Initialiser le storage si vide
  const data = await storageGet(['lists', 'user_whitelist', 'settings']);
  
  if (!data.lists) {
    await storageSet({ lists: {} });
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
    await storageSet({ lists });
  }
  
  // Migrer les anciens settings et générer le premier code
  await migrateSettings();
  
  // Configurer l'alarme quotidienne pour régénérer le code
  chrome.alarms.create('regenerateCode', { periodInMinutes: 1440 }); // 24h
  
  if (!data.user_whitelist) {
    await storageSet({ user_whitelist: [] });
  }

  if (!data.settings) {
    await storageSet({ settings: DEFAULT_SETTINGS });
  }
  
  // Lancer la première mise à jour des listes (avec await pour garantir le téléchargement)
  await updateLists();
});

// Fonction de migration des settings pour compatibilité avec anciennes versions
async function migrateSettings() {
  const { settings } = await storageGet(['settings']);
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
  
  await storageSet({ settings: migratedSettings });
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
  const { lists, user_whitelist } = await storageGet(['lists', 'user_whitelist']);
  
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
  const { settings } = await storageGet(['settings']);
  const currentSettings = settings || DEFAULT_SETTINGS;
  const validationMode = currentSettings.validationMode || 'banner-code';
  const showUnknownPages = currentSettings.showUnknownPages || false;
  

  
  try {
    if (status === 'VALIDATED') {
      // Page validée

      
      if (validationMode === 'badge-only') {

        // Mode badge uniquement : badge vert sans texte (juste la couleur verte visible)
        await actionSetBadgeBackgroundColor('#28A745', tabId); // Vert vif
        await actionSetBadgeText('✓', tabId); // Check mark pour badge visible
      } else if (validationMode === 'banner-code') {

        // Mode code : afficher le code unique avec badge vert (toujours vert)
        const code = uniqueCode || generateRandomCode();

        await actionSetBadgeBackgroundColor('#28A745', tabId); // Vert vif
        await actionSetBadgeText(code, tabId);
      } else {

        // Mode keyword : badge vert uni sans texte
        await actionSetBadgeBackgroundColor('#28A745', tabId); // Vert vif
        await actionSetBadgeText('✓', tabId); // Check mark pour badge visible
      }

    } else if (status === 'UNKNOWN' && showUnknownPages) {
      // Page non listée avec option activée
      await actionSetBadgeBackgroundColor('#DC3545', tabId); // Rouge
      await actionSetBadgeText('?', tabId);
    } else if (status === 'NO_PASSWORD' && showUnknownPages) {
      // Page sans password avec option activée
      await actionSetBadgeBackgroundColor('#6C757D', tabId); // Gris
      await actionSetBadgeText('○', tabId);
    } else {
      // Pas de badge
      await actionSetBadgeText('', tabId);
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
    let tab = null;
    try { tab = await Compat.getTab(activeInfo.tabId); } catch (e) { tab = null; }
    if (!tab) {
      try { tab = await new Promise((resolve) => chrome.tabs.get(activeInfo.tabId, resolve)); } catch (e) { tab = null; }
    }
    if (tab && tab.url) {
      await updateBadgeForTab(tab);
    } else {
      const lastErr = (chrome.runtime && chrome.runtime.lastError) ? (chrome.runtime.lastError.message || chrome.runtime.lastError) : null;
      if (lastErr) {
        console.warn('[ShieldSign] onActivated: no tab returned for id', activeInfo.tabId, 'lastError=', lastErr);
      } else {
        console.debug('[ShieldSign] onActivated: no tab returned for id', activeInfo.tabId, 'lastError=null');
      }
      try {
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
          console.debug('[ShieldSign] onActivated: currentWindow tabs count=', Array.isArray(tabs) ? tabs.length : 0);
        });
      } catch (e) {}
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la mise à jour du badge:', error);
  }
});

// Écouter les mises à jour d'URL dans les onglets
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === 'complete' && tab && tab.url) {
      await updateBadgeForTab(tab);
    } else if (changeInfo.status === 'complete') {
      // try to get a fresh tab object via Compat
      try {
        let fresh = null; try { fresh = await Compat.getTab(tabId); } catch (e) { fresh = null; }
        if (!fresh) { try { fresh = await new Promise((resolve) => chrome.tabs.get(tabId, resolve)); } catch (err) { fresh = null; } }
        if (fresh && fresh.url) await updateBadgeForTab(fresh);
        else {
          const lastErr = (chrome.runtime && chrome.runtime.lastError) ? (chrome.runtime.lastError.message || chrome.runtime.lastError) : null;
          if (lastErr) {
            console.warn('[ShieldSign] onUpdated: no fresh tab for id', tabId, 'lastError=', lastErr);
          } else {
            console.debug('[ShieldSign] onUpdated: no fresh tab for id', tabId, 'lastError=null');
          }
          try {
            chrome.tabs.query({ currentWindow: true }, (tabs) => {
              console.debug('[ShieldSign] onUpdated: currentWindow tabs count=', Array.isArray(tabs) ? tabs.length : 0);
            });
          } catch (e) {}
        }
      } catch (e) {
        console.warn('[ShieldSign] onUpdated: error fetching fresh tab', e);
      }
    }
  } catch (e) {
    console.error('[ShieldSign] onUpdated listener error:', e);
  }
});

// Mettre à jour le badge pour un onglet spécifique
const tabCodes = new Map(); // Stocker les codes par onglet

async function updateBadgeForTab(tab) {
  try {
    if (!tab || !tab.url) return;
    let hostname;
    try {
      const url = new URL(tab.url);
      hostname = url.hostname;
    } catch (e) {
      return;
    }
    

    
    // Vérifier si la page a un champ password
    const hasPassword = await (async () => {
      try {
        const r = await executeScriptCompat(tab.id, () => !!document.querySelector('input[type="password"]'));
        if (r && r[0] && typeof r[0].result !== 'undefined') return r[0].result;
        if (Array.isArray(r) && r.length > 0) return r[0];
      } catch (e) {}
      return false;
    })();
    
 
    
    if (!hasPassword) {
      await updateBadge(tab.id, 'NO_PASSWORD');
      tabCodes.delete(tab.id); // Supprimer le code stocké
      return;
    }
    
    // Vérifier le domaine
    const result = await checkDomain(hostname);
    

    
    if (result.status === 'VALIDATED') {
      // Récupérer le code déjà généré pour cet onglet, sinon en générer un nouveau
      let uniqueCode = tabCodes.get(tab.id);
      if (!uniqueCode) {
        uniqueCode = generateRandomCode();
        tabCodes.set(tab.id, uniqueCode);

      } else {

      }
      await updateBadge(tab.id, 'VALIDATED', result.type, uniqueCode);
    } else {
      await updateBadge(tab.id, 'UNKNOWN');
      tabCodes.delete(tab.id);
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur dans updateBadgeForTab:', error);
    // URL invalide ou autre erreur, pas de badge
    if (tab && tab.id) {
      await updateBadge(tab.id, 'NO_PASSWORD');
      tabCodes.delete(tab.id);
    }
  }
}

// Vérifier si un onglet a un champ password
async function checkForPasswordField(tabId) {
  try {
    const results = await executeScriptCompat(tabId, () => !!document.querySelector('input[type="password"]'));
    if (results && results[0] && typeof results[0].result !== 'undefined') return results[0].result;
    if (Array.isArray(results) && results.length > 0) return results[0];
    return false;
  } catch (error) {
    return false;
  }
}

// ========================================
// FIN SYSTÈME DE BADGE
// ========================================

// Mise à jour des listes distantes
async function updateLists() {
  const { lists, settings } = await storageGet(['lists', 'settings']);
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
        const valid = validateListSchema(data);
        if (valid) {
          lists[url] = {
            etag: response.headers.get('ETag') || listData.etag,
            lastFetch: now,
            data: data,
            localType: listData.localType || 'community',
            // enabled et isOfficial seront préservés lors de la fusion finale
            isOfficial: listData.isOfficial,
            enabled: listData.enabled
          };
        } else {
          console.warn('[ShieldSign] updateLists: schema invalid for', url);
        }
      } else {
        console.warn('[ShieldSign] updateLists: non-ok response for', url, response.status);
      }
    } catch (error) {
      console.error('[ShieldSign] updateLists: fetch error for', url, error);
      
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
              // Persist immediately the updated 'lists' partially to avoid race conditions
              await storageSet({ lists });
            }
          }
        } catch (retryError) {
        }
      }, 5000);
    }
  }
  
  // Re-lire le storage avant de sauvegarder pour éviter d'écraser les modifications concurrentes
  const { lists: freshLists } = await storageGet(['lists']);
  
  // Fusionner les mises à jour (lastFetch, data) avec les propriétés actuelles (enabled, isOfficial)
  for (const [url, updatedData] of Object.entries(lists)) {
    if (freshLists[url]) {
      // Préserver enabled et isOfficial de la version fraîche
      freshLists[url] = {
        ...updatedData,
        enabled: freshLists[url].enabled !== undefined ? freshLists[url].enabled : updatedData.enabled,
        isOfficial: freshLists[url].isOfficial !== undefined ? freshLists[url].isOfficial : updatedData.isOfficial
      };
    } else {
      // Si la liste n'existe pas encore dans le storage frais, on l'ajoute intégralement
      freshLists[url] = updatedData;
    }
  }
  
  await storageSet({ lists: freshLists });
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
    const { settings } = await storageGet(['settings']);
    const autoAddUnknown = settings?.autoAddUnknown || 'prompt';
    

    
    switch (autoAddUnknown) {
      case 'never':
        // Ne rien faire
        return { shouldPrompt: false };
        
      case 'always':
        // Ajouter automatiquement à la liste personnelle
        await addPersonalDomain(hostname);

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
  // Normaliser et valider les domaines : trim, lowercase, dédupliquer
  if (!Array.isArray(data.domains)) return false;
  const cleaned = [];
  const seen = new Set();
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i; // TLD 2..63
  const removed = [];
  for (let domain of data.domains) {
    if (typeof domain !== 'string') { removed.push(domain); continue; }
    domain = domain.trim().toLowerCase();
    // remove any trailing commas or stray characters
    domain = domain.replace(/[\s,]+$/,'');
    if (!domain) continue;
    if (!domainRegex.test(domain)) { removed.push(domain); continue; }
    if (!seen.has(domain)) {
      seen.add(domain);
      cleaned.push(domain);
    }
  }
  if (removed.length > 0) {
    console.warn('[ShieldSign] validateListSchema: removed invalid domains:', removed);
  }
  // Replace domains with cleaned list for downstream use
  data.domains = cleaned;
  // Accept list as long as at least one domain remains
  if (data.domains.length === 0) {
    console.warn('[ShieldSign] validateListSchema: no valid domains remain after cleaning');
    return false;
  }
  
  return true;
}

// Écoute des messages depuis content.js et popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'CHECK_PAGE') {
    checkDomain(message.hostname).then(async (result) => {
      // Ajouter les informations de settings pour le content script
      const { settings } = await storageGet(['settings']);
      result.settings = settings || DEFAULT_SETTINGS;
      
      // Générer un code unique pour cette page et le stocker
      const uniqueCode = generateRandomCode();
      result.uniqueCode = uniqueCode;
      
      // Stocker le code pour cet onglet (pour le badge)
      if (sender.tab && sender.tab.id) {
        tabCodes.set(sender.tab.id, uniqueCode);

        
        // Mettre à jour le badge avec ce code
        if (result.status === 'VALIDATED') {
          await updateBadge(sender.tab.id, 'VALIDATED', result.type, uniqueCode);
        }
      }
      
      sendResponse(result);
    });
    return true; // Permet la réponse asynchrone
  }

  if (message.action === 'GET_ACTIVE_TAB') {
    // Use promise style to keep sendResponse port open synchronously
    Compat.getActiveTab().then((tab) => {
      sendResponse(tab || null);
    }).catch(() => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          sendResponse(tabs && tabs[0] ? tabs[0] : null);
        });
      } catch (err) {
        sendResponse(null);
      }
    });
    return true;
  }
  
  if (message.action === 'ADD_PERSONAL_DOMAIN') {
    addPersonalDomain(message.domain).then(async () => {
      const { user_whitelist } = await storageGet(['user_whitelist']);
      sendResponse({ success: true, user_whitelist: user_whitelist || [] });
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
    removePersonalDomain(message.domain).then(async () => {
      const { user_whitelist } = await storageGet(['user_whitelist']);
      sendResponse({ success: true, user_whitelist: user_whitelist || [] });
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

  if (message.action === 'DUMP_LIST_KEYS') {
    (async () => {
      const { lists } = await storageGet(['lists']);
      sendResponse({ keys: lists ? Object.keys(lists) : [] });
    })();
    return true;
  }
  
  if (message.action === 'UPDATE_LISTS') {
    updateLists().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'GET_SETTINGS') {
    storageGet(['settings']).then(data => {
      sendResponse(data.settings || DEFAULT_SETTINGS);
    });
    return true;
  }

  if (message.action === 'GET_ALL_ACTIVE_DOMAINS') {
    getAllActiveDomains().then(domainsMap => {
      const res = {
        enterprise: Array.from(domainsMap.enterprise.keys()),
        community: Array.from(domainsMap.community.keys()),
        personal: Array.from(domainsMap.personal.keys())
      };
      sendResponse(res);
    }).catch(() => {
      sendResponse({ enterprise: [], community: [], personal: [] });
    });
    return true;
  }

  if (message.action === 'DETECT_FORM_ENTRY') {
    (async () => {
      try {
        const rawFormUrl = message.formUrl;
        // Normalize: remove query and fragment to avoid special dialog modes that render empty
        let fetchUrl;
        try {
          const u = new URL(rawFormUrl);
          u.search = '';
          u.hash = '';
          // Ensure we fetch the canonical viewform path
          fetchUrl = u.href;
        } catch (e) {
          fetchUrl = rawFormUrl;
        }

        
        const resp = await fetch(fetchUrl);
        if (!resp.ok) {
          sendResponse({ entryId: null, error: `fetch ${resp.status}` });
          return;
        }
        const html = await resp.text();
        // Try multiple heuristics to find the entry id
        let m = html.match(/name="(entry\.\d+)"/);
        if (!m) m = html.match(/data-params="[^"]*?(entry\.\d+)[^\"]*?"/);
        if (!m) m = html.match(/\bentry\.(\d+)\b/);
        if (m) {
          const entry = m[1].startsWith('entry.') ? m[1] : `entry.${m[1]}`;
          sendResponse({ entryId: entry });
        } else {
          sendResponse({ entryId: null });
        }
      } catch (e) {
        
        sendResponse({ entryId: null, error: e.message });
      }
    })();
    return true;
  }

  if (message.action === 'POST_TO_GOOGLE_FORM') {
    (async () => {
      try {
        const rawFormBase = message.formBaseUrl;
        const entryId = message.entryId;
        const domain = message.domain;

        // Normalize base so we can build /formResponse reliably
        let base;
        try {
          const u = new URL(rawFormBase);
          u.search = '';
          u.hash = '';
          // Keep only the /forms/d/e/<id> prefix
          const m = u.pathname.match(/^(?:\/forms)?\/d\/e\/[^\/]+/);
          if (m) base = `${u.protocol}//${u.host}${m[0]}`;
          else base = `${u.protocol}//${u.host}${u.pathname}`;
        } catch (e) {
          // fallback: try regex
          const m2 = rawFormBase.match(/^(https:\/\/docs.google.com\/forms\/d\/e\/[^\/]+)/);
          base = m2 ? m2[1] : null;
        }

        if (!base) {
        
          sendResponse({ ok: false, error: 'invalid_form_url' });
          return;
        }

        const action = `${base}/formResponse`;
        

        const params = new URLSearchParams();
        params.append(entryId, domain);
        const resp = await fetch(action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
          redirect: 'follow'
        });

        const ok = resp.ok || resp.status === 302 || resp.status === 200;
        
        sendResponse({ ok, status: resp.status });
      } catch (e) {
        
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.action === 'DETECT_FORM_ENTRY_VIA_TAB') {
    (async () => {
      const rawUrl = message.formUrl;
      // Normalize URL
      let urlToOpen = rawUrl;
      try { const u = new URL(rawUrl); u.search = ''; u.hash = ''; urlToOpen = u.href; } catch (e) { urlToOpen = rawUrl; }

      try {
        // Remember current active tab so we can restore focus after the temporary tab (Firefox may focus new tabs)
        let originalTabId = null;
        try {
          const tabs = await new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (t) => resolve(t || []));
          });
          if (tabs && tabs[0] && tabs[0].id) originalTabId = tabs[0].id;
        } catch (e) { originalTabId = null; }

        // Create a new tab (in background if possible)
        const created = await new Promise((resolve, reject) => {
          try {
            chrome.tabs.create({ url: urlToOpen, active: false }, (tab) => {
              if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
              resolve(tab);
            });
          } catch (e) { reject(e); }
        });

        const tabId = created.id;

        // Wait for tab to finish loading (timeout after 10s)
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            chrome.tabs.remove(tabId).catch(()=>{});
            reject(new Error('tab_load_timeout'));
          }, 10000);

          const listener = (tid, changeInfo) => {
            if (tid === tabId && changeInfo.status === 'complete') {
              clearTimeout(timeout);
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };

          chrome.tabs.onUpdated.addListener(listener);
        });

        // Execute script to find entry id in page DOM; support chrome.scripting (Chrome) or chrome.tabs.executeScript (Firefox)
        const execFunc = () => {
          try {
            // 1) look for inputs/selects/textarea with name=entry.<digits>
            const el = document.querySelector('[name^="entry."]');
            if (el && el.getAttribute) {
              return { entryId: el.getAttribute('name') };
            }

            // 2) fallback: scan scripts for FB_PUBLIC_LOAD_DATA_
            const scripts = Array.from(document.scripts || []);
            for (const s of scripts) {
              if (!s.textContent) continue;
              if (s.textContent.indexOf('FB_PUBLIC_LOAD_DATA_') !== -1) {
                const m = s.textContent.match(/entry\.(\d+)/g);
                if (m && m.length > 0) return { entryId: m[0].replace('entry.', 'entry.') };
                const m2 = s.textContent.match(/(\d{6,12})/g);
                if (m2 && m2.length > 0) return { entryId: 'entry.' + m2[0] };
              }
            }

            // 3) scan all inputs for data-params or aria-label containing 'entry.'
            const all = Array.from(document.querySelectorAll('input,textarea,select'));
            for (const i of all) {
              const name = i.getAttribute && i.getAttribute('name');
              if (name && /^entry\.\d+$/.test(name)) return { entryId: name };
              const dp = i.getAttribute && i.getAttribute('data-params');
              if (dp && dp.indexOf('entry.') !== -1) {
                const mm = dp.match(/entry\.(\d+)/);
                if (mm) return { entryId: 'entry.' + mm[1] };
              }
            }

            return { entryId: null };
          } catch (e) {
            return { entryId: null, error: e && e.message };
          }
        };

        const results = await new Promise((resolve, reject) => {
          try {
            if (chrome.scripting && chrome.scripting.executeScript) {
              chrome.scripting.executeScript({ target: { tabId: tabId }, func: execFunc }, (injectionResults) => {
                if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                resolve(injectionResults && injectionResults[0] && injectionResults[0].result ? injectionResults[0].result : { entryId: null });
              });
            } else if (chrome.tabs && chrome.tabs.executeScript) {
              // Firefox or older API: serialize function and execute as code
              const code = `(${execFunc.toString()})();`;
              chrome.tabs.executeScript(tabId, { code }, (injectionResults) => {
                if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                try {
                  // firefox returns the result as array
                  resolve(injectionResults && injectionResults[0] ? injectionResults[0] : { entryId: null });
                } catch (e) { resolve({ entryId: null }); }
              });
            } else {
              return reject(new Error('no_execute_api'));
            }
          } catch (e) { reject(e); }
        });

        // Close the temporary tab
        try { chrome.tabs.remove(tabId); } catch (e) {}

        // Try to restore focus to the original tab (helps Firefox which may have been focused)
        try {
          if (originalTabId) {
            chrome.tabs.update(originalTabId, { active: true }, () => {});
          }
        } catch (e) { /* ignore */ }

        sendResponse({ entryId: results.entryId || null, error: results.error || null });
      } catch (e) {
        console.warn('[ShieldSign] DETECT_FORM_ENTRY_VIA_TAB error', e && e.message);
        sendResponse({ entryId: null, error: e && e.message });
      }
    })();
    return true;
  }
  
  if (message.action === 'UPDATE_SETTINGS') {
    storageSet({ settings: message.settings }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Création d'un Gist via token (option avancée) - retourne l'URL du gist
  if (message.action === 'CREATE_GIST') {
    (async () => {
      try {
        const filename = `shieldsign_contribution_${Date.now()}.json`;
        const body = {
          public: true,
          description: `ShieldSign contribution ${new Date().toISOString()}`,
          files: {}
        };
        body.files[filename] = { content: JSON.stringify(message.payload, null, 2) };

        const headers = {
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        };
        if (message.token) {
          headers['Authorization'] = `token ${message.token}`;
        }

        const resp = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => null);
          // Répondre via sendResponse n'est pas possible ici (async), on envoie un message
          chrome.runtime.sendMessage({ action: 'CREATE_GIST_RESULT', success: false, error: errBody?.message || resp.statusText });
          return;
        }

        const data = await resp.json();
        chrome.runtime.sendMessage({ action: 'CREATE_GIST_RESULT', success: true, url: data.html_url });
      } catch (e) {
        chrome.runtime.sendMessage({ action: 'CREATE_GIST_RESULT', success: false, error: e.message });
      }
    })();

    sendResponse({ success: true, info: 'started' });
    return true;
  }
  
  // Note: GET_CURRENT_CODE et REGENERATE_CODE supprimés car le code est maintenant généré à chaque affichage
});

// Ajouter un domaine à la liste personnelle
async function addPersonalDomain(domain) {
  const { user_whitelist } = await storageGet(['user_whitelist']);
  const list = user_whitelist || [];
  
  if (!list.includes(domain)) {
    list.push(domain);
    await storageSet({ user_whitelist: list });
  }
}

// Retirer un domaine de la liste personnelle
async function removePersonalDomain(domain) {
  const { user_whitelist } = await storageGet(['user_whitelist']);
  const list = user_whitelist || [];
  
  const index = list.indexOf(domain);
  if (index > -1) {
    list.splice(index, 1);
    await storageSet({ user_whitelist: list });
  }
}

// Ajouter une liste distante
async function addList(url, type = 'community') {
  const { lists } = await storageGet(['lists']);
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
    
    await storageSet({ lists: allLists });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Supprimer une liste
async function removeList(url) {
  const { lists } = await storageGet(['lists']);
  
  if (lists && lists[url]) {
    // Empêcher la suppression de la liste officielle
    if (lists[url].isOfficial) {
      return { success: false, error: 'La liste officielle ne peut pas être supprimée.' };
    }
    
    delete lists[url];
    await storageSet({ lists });
    return { success: true };
  }
  
  return { success: false, error: 'Liste non trouvée.' };
}

// Activer/désactiver une liste
async function toggleList(url, enabled) {
  const { lists } = await storageGet(['lists']);

  console.debug('[ShieldSign] toggleList called', { url, enabled });
  if (lists) console.debug('[ShieldSign] toggleList: current keys', Object.keys(lists));

  if (!lists) {
    console.warn('[ShieldSign] toggleList: no lists present in storage');
    return { success: false, error: 'Liste non trouvée.' };
  }

  // Try exact match first
  if (lists[url]) {
    if (enabled === undefined) enabled = !(lists[url].enabled !== false);
    lists[url].enabled = enabled;
    await storageSet({ lists });
    console.debug('[ShieldSign] toggleList: matched exact key', url);
    // Notify listeners as a broadcast (fallback for callers that don't receive the direct response)
    try { chrome.runtime.sendMessage({ action: 'TOGGLE_LIST_RESULT', url, success: true, enabled }); } catch (e) {}
    return { success: true, enabled };
  }

  // Fallback: try to find a matching list key by normalizing URLs (strip trailing slash, query)
  const normalize = (u) => {
    try {
      const parsed = new URL(u);
      parsed.search = '';
      parsed.hash = '';
      let p = parsed.href.replace(/\/$/, '');
      return p;
    } catch (e) {
      return u.replace(/\/$/, '');
    }
  };

  const targetNorm = normalize(url);
  let foundKey = null;
  for (const key of Object.keys(lists)) {
    if (normalize(key) === targetNorm) { foundKey = key; break; }
  }

  if (foundKey) {
    if (enabled === undefined) enabled = !(lists[foundKey].enabled !== false);
    lists[foundKey].enabled = enabled;
    await storageSet({ lists });
    console.debug('[ShieldSign] toggleList: matched normalized key', foundKey);
    try { chrome.runtime.sendMessage({ action: 'TOGGLE_LIST_RESULT', url: foundKey, success: true, enabled }); } catch (e) {}
    return { success: true, enabled };
  }
  console.warn('[ShieldSign] toggleList: no matching key found for', url);
  try { chrome.runtime.sendMessage({ action: 'TOGGLE_LIST_RESULT', url, success: false, error: 'Liste non trouvée.' }); } catch (e) {}
  return { success: false, error: 'Liste non trouvée.' };
}

// Mise à jour périodique des listes (toutes les heures)
setInterval(updateLists, 3600000); // 1 heure
