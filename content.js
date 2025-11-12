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
    
    if (response.status === 'VALIDATED' && response.settings) {
      const validationMode = response.settings.validationMode || 'banner-code';
      
      // N'injecter le bandeau que si le mode n'est pas badge-only
      if (validationMode !== 'badge-only') {
        injectBanner(response.listName, response.type, response.settings);
      }
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la vérification:', error);
  }
}

// Injection du bandeau de validation
async function injectBanner(listName, type, settings) {
  if (bannerInjected) return;
  
  const validationMode = settings?.validationMode || 'banner-code';
  const customKeyword = settings?.customKeyword || '';
  const currentCode = settings?.currentCode || '';
  
  // Récupérer les paramètres de style configurés
  const bannerStyle = settings?.bannerStyle || {
    enterprise: { mode: 'solid', solidColor: '#2ECC71', textColor: '#FFFFFF', fontFamily: 'Arial, sans-serif' },
    community: { mode: 'solid', solidColor: '#3498DB', textColor: '#FFFFFF', fontFamily: 'Arial, sans-serif' },
    personal: { mode: 'solid', solidColor: '#9B59B6', textColor: '#FFFFFF', fontFamily: 'Arial, sans-serif' }
  };
  
  const style = bannerStyle[type] || bannerStyle.community;
  
  // Générer le background selon le mode
  let background;
  if (style.mode === 'solid') {
    background = style.solidColor;
  } else if (style.mode === 'gradient') {
    background = `linear-gradient(135deg, ${style.gradientStart}, ${style.gradientEnd})`;
  } else if (style.mode === 'random' || style.useRandom) {
    // En mode aléatoire, générer une couleur/dégradé aléatoire
    background = generateRandomBannerBackground();
  } else {
    background = style.solidColor; // Fallback
  }
  
  const textColor = style.textColor || '#FFFFFF';
  const fontFamily = style.fontFamily || 'Arial, sans-serif';
  
  // Créer le bandeau
  const banner = document.createElement('div');
  banner.id = 'ShieldSign-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    background: ${background};
    color: ${textColor};
    padding: 12px 20px;
    font-family: ${fontFamily};
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
  text.textContent = chrome.i18n.getMessage('contentBannerValidated', [getListDisplayName(listName, type)]);
  
  banner.appendChild(icon);
  banner.appendChild(text);
  
  // Ajouter le code ou le mot-clé selon le mode
  if (validationMode === 'banner-code' && currentCode) {
    const codeBadge = document.createElement('span');
    codeBadge.textContent = currentCode;
    codeBadge.style.cssText = `
      background: rgba(255, 255, 255, 0.3);
      padding: 4px 12px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      font-size: 16px;
      letter-spacing: 2px;
      margin-left: 12px;
      border: 1px solid rgba(255, 255, 255, 0.5);
    `;
    banner.appendChild(codeBadge);
  } else if (validationMode === 'banner-keyword' && customKeyword) {
    const keywordBadge = document.createElement('span');
    keywordBadge.textContent = `🔑 ${customKeyword}`;
    keywordBadge.style.cssText = `
      background: rgba(255, 255, 255, 0.3);
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: bold;
      margin-left: 12px;
      border: 1px solid rgba(255, 255, 255, 0.5);
    `;
    banner.appendChild(keywordBadge);
  }
  
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
    return chrome.i18n.getMessage('contentPersonalList');
  } else if (type === 'enterprise') {
    return chrome.i18n.getMessage('contentEnterpriseList');
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

// Fonction pour générer un background aléatoire (couleur ou dégradé)
function generateRandomBannerBackground() {
  const useGradient = Math.random() > 0.5;
  
  if (useGradient) {
    // Générer un dégradé aléatoire harmonieux
    const hue1 = Math.floor(Math.random() * 360);
    const hue2 = (hue1 + 30 + Math.random() * 60) % 360; // Hue décalé de 30-90°
    const saturation = 60 + Math.random() * 30; // 60-90%
    const lightness = 40 + Math.random() * 20; // 40-60%
    
    const color1 = `hsl(${hue1}, ${saturation}%, ${lightness}%)`;
    const color2 = `hsl(${hue2}, ${saturation}%, ${lightness}%)`;
    
    return `linear-gradient(135deg, ${color1}, ${color2})`;
  } else {
    // Générer une couleur unie aléatoire
    const hue = Math.floor(Math.random() * 360);
    const saturation = 60 + Math.random() * 30;
    const lightness = 45 + Math.random() * 15;
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
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
