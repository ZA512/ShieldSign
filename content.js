// ShieldSign - Content Script
// Détection des pages de connexion et injection du bandeau de validation

// Drapeau pour éviter les vérifications multiples
let checkedOnThisPage = false;
let bannerInjected = false;

// Détection des champs password
function detectLoginPage() {
  // Éviter les vérifications multiples
  if (checkedOnThisPage) return;
  
  const passwordField = document.querySelector('input[type="password"]');
  
  if (passwordField) {
    checkedOnThisPage = true;
    checkPageSecurity();
  }
}

// Vérification de la sécurité de la page
async function checkPageSecurity() {
  const hostname = window.location.hostname;
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'CHECK_PAGE',
      hostname: hostname
    });
    
    if (response.status === 'VALIDATED') {
      injectBanner(response.listName, response.type);
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la vérification:', error);
  }
}

// Injection du bandeau de validation
async function injectBanner(listName, type) {
  if (bannerInjected) return;
  
  // Récupérer les couleurs configurées
  const settings = await chrome.runtime.sendMessage({ action: 'GET_SETTINGS' });
  const colors = settings?.bannerColors || {
    enterprise: '#2ECC71',
    community: '#3498DB',
    personal: '#9B59B6'
  };
  
  const color = colors[type] || colors.community;
  
  // Créer le bandeau
  const banner = document.createElement('div');
  banner.id = 'ShieldSign-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    background: linear-gradient(135deg, #1a2a6c 0%, #159957 100%);
    color: white;
    padding: 12px 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    z-index: 2147483647;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  `;
  
  // Icône du phare
  const icon = document.createElement('span');
  icon.innerHTML = '🗼';
  icon.style.cssText = `
    font-size: 18px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  `;
  
  const text = document.createElement('span');
  text.textContent = `Page validée par : ${getListDisplayName(listName, type)}`;
  
  banner.appendChild(icon);
  banner.appendChild(text);
  
  // Injecter dans la page
  document.body.insertBefore(banner, document.body.firstChild);
  bannerInjected = true;
  
  // Ajuster le padding du body pour éviter le chevauchement
  const bannerHeight = banner.offsetHeight;
  const originalPadding = window.getComputedStyle(document.body).paddingTop;
  document.body.style.paddingTop = `${parseInt(originalPadding) + bannerHeight}px`;
  
  console.log(`[ShieldSign] Bandeau injecté pour: ${listName} (${type})`);
}

// Nom d'affichage de la liste
function getListDisplayName(listName, type) {
  if (type === 'personal') {
    return 'Liste personnelle';
  } else if (type === 'enterprise') {
    return 'Liste entreprise';
  } else {
    // Pour les listes communautaires, utiliser directement le nom de la liste
    return listName;
  }
}

// Observer les changements du DOM pour les SPA
const observer = new MutationObserver((mutations) => {
  // Vérifier si un champ password a été ajouté
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      const hasPassword = document.querySelector('input[type="password"]');
      if (hasPassword && !checkedOnThisPage) {
        detectLoginPage();
        break;
      }
    }
  }
});

// Démarrage de l'observation
function startObserving() {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Arrêter l'observation après 30 secondes si le bandeau a été injecté
  setTimeout(() => {
    if (bannerInjected) {
      observer.disconnect();
      console.log('[ShieldSign] Observer déconnecté après injection du bandeau');
    }
  }, 30000);
}

// Initialisation après chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    detectLoginPage();
    startObserving();
  });
} else {
  detectLoginPage();
  startObserving();
}

// Réinitialisation lors de la navigation (pour les SPA)
window.addEventListener('popstate', () => {
  checkedOnThisPage = false;
  bannerInjected = false;
  detectLoginPage();
});

// Gestion des changements d'URL dans les SPA
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    checkedOnThisPage = false;
    
    // Retirer l'ancien bandeau s'il existe
    const oldBanner = document.getElementById('ShieldSign-banner');
    if (oldBanner) {
      oldBanner.remove();
      bannerInjected = false;
      document.body.style.paddingTop = '';
    }
    
    detectLoginPage();
  }
}).observe(document, { subtree: true, childList: true });
