// ShieldSign - Background Service Worker
// Gestion du cache des listes, mise à jour, et vérification des domaines

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

// Liste officielle ShieldSign (non supprimable)
const OFFICIAL_LIST_URL = 'https://raw.githubusercontent.com/ZA512/ShieldSign/refs/heads/main/shieldsign_public_list_v1.json';

// Initialisation au démarrage
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[ShieldSign] Extension installée');
  
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
  
  if (!data.user_whitelist) {
    await chrome.storage.local.set({ user_whitelist: [] });
  }
  
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  
  // Lancer la première mise à jour des listes
  updateLists();
});

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

// Mise à jour des listes distantes
async function updateLists() {
  console.log('[ShieldSign] Mise à jour des listes...');
  
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
        // Non modifié, mettre à jour uniquement lastFetch
        lists[url].lastFetch = now;
        console.log(`[ShieldSign] Liste non modifiée: ${url}`);
      } else if (response.ok) {
        const data = await response.json();
        
        // Valider le schéma
        if (validateListSchema(data)) {
          lists[url] = {
            etag: response.headers.get('ETag') || listData.etag,
            lastFetch: now,
            data: data,
            localType: listData.localType || 'community'
          };
          console.log(`[ShieldSign] Liste mise à jour: ${url}`);
        } else {
          console.error(`[ShieldSign] Schéma invalide pour: ${url}`);
        }
      }
    } catch (error) {
      console.error(`[ShieldSign] Erreur lors de la mise à jour de ${url}:`, error);
      
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
                localType: listData.localType || 'community'
              };
              await chrome.storage.local.set({ lists });
            }
          }
        } catch (retryError) {
          console.error(`[ShieldSign] Échec du retry pour ${url}:`, retryError);
        }
      }, 5000);
    }
  }
  
  await chrome.storage.local.set({ lists });
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
    checkDomain(message.hostname).then(result => {
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
});

// Ajouter un domaine à la liste personnelle
async function addPersonalDomain(domain) {
  const { user_whitelist } = await chrome.storage.local.get(['user_whitelist']);
  const list = user_whitelist || [];
  
  if (!list.includes(domain)) {
    list.push(domain);
    await chrome.storage.local.set({ user_whitelist: list });
    console.log(`[ShieldSign] Domaine ajouté à la liste personnelle: ${domain}`);
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
    console.log(`[ShieldSign] Domaine retiré de la liste personnelle: ${domain}`);
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
    console.log(`[ShieldSign] Liste ajoutée: ${url} (${type})`);
    
    return { success: true };
  } catch (error) {
    console.error(`[ShieldSign] Erreur lors de l'ajout de la liste ${url}:`, error);
    return { success: false, error: error.message };
  }
}

// Supprimer une liste
async function removeList(url) {
  const { lists } = await chrome.storage.local.get(['lists']);
  
  if (lists && lists[url]) {
    // Empêcher la suppression de la liste officielle
    if (lists[url].isOfficial) {
      console.warn('[ShieldSign] Impossible de supprimer la liste officielle');
      return { success: false, error: 'La liste officielle ne peut pas être supprimée.' };
    }
    
    delete lists[url];
    await chrome.storage.local.set({ lists });
    console.log(`[ShieldSign] Liste supprimée: ${url}`);
    return { success: true };
  }
  
  return { success: false, error: 'Liste non trouvée.' };
}

// Activer/désactiver une liste
async function toggleList(url, enabled) {
  const { lists } = await chrome.storage.local.get(['lists']);
  
  if (lists && lists[url]) {
    lists[url].enabled = enabled;
    await chrome.storage.local.set({ lists });
    console.log(`[ShieldSign] Liste ${enabled ? 'activée' : 'désactivée'}: ${url}`);
    return { success: true };
  }
  
  return { success: false, error: 'Liste non trouvée.' };
}

// Mise à jour périodique des listes (toutes les heures)
setInterval(updateLists, 3600000); // 1 heure
