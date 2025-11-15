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
    const response = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'CHECK_PAGE', hostname: hostname }, (res) => { resolve(res); });
      } catch (e) {
        resolve(null);
      }
    });

    if (response && response.status === 'VALIDATED' && response.settings) {
      const validationMode = response.settings.validationMode || 'banner-code';
      
      // N'injecter le bandeau que si le mode n'est pas badge-only
      if (validationMode !== 'badge-only') {
        injectBanner(response.listName, response.type, response.settings, response.uniqueCode);
      }
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la vérification:', error);
  }
}

// Générer un code aléatoire de 2 caractères (fallback si non reçu)
function generateRandomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return chars.charAt(Math.floor(Math.random() * chars.length)) + 
         chars.charAt(Math.floor(Math.random() * chars.length));
}

// Injection du bandeau de validation
async function injectBanner(listName, type, settings, uniqueCode) {
  if (bannerInjected) return;
  
  const validationMode = settings?.validationMode || 'banner-code';
  const customKeyword = settings?.customKeyword || '';
  // Utiliser le code reçu depuis le background, ou générer en fallback
  const currentCode = uniqueCode || generateRandomCode();
  
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
  
  // Icône du phare (image PNG au lieu d'emoji)
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('icons/icon56ssf.png');
  icon.alt = '🗼';
  icon.style.cssText = `
    width: 24px;
    height: 24px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  `;
  
  const text = document.createElement('span');
  const listDisplayName = getListDisplayName(listName, type);
  const message = chrome.i18n.getMessage('contentBannerValidated') || 'Ce site est validé - {0}';
  text.textContent = message.replace('{0}', listDisplayName);
  
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

// Détecter la soumission de formulaire avec mot de passe
document.addEventListener('submit', async (event) => {
  const form = event.target;
  const hasPassword = form.querySelector('input[type="password"]');
  
  if (hasPassword) {

    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'FORM_SUBMITTED',
        hostname: window.location.hostname
      });
      
      if (response && response.shouldPrompt) {
        // Stocker l'information pour affichage après rechargement
        await chrome.storage.local.set({
          pendingPrompt: {
            hostname: window.location.hostname,
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.error('[ShieldSign] Erreur lors de la gestion de soumission:', error);
    }
  }
});

// Vérifier s'il y a une notification en attente au chargement de la page
async function checkPendingPrompt() {
  try {
    const { pendingPrompt } = await chrome.storage.local.get(['pendingPrompt']);
    
    if (pendingPrompt) {
      const hostname = window.location.hostname;
      const timeDiff = Date.now() - pendingPrompt.timestamp;
      
      // Extraire le domaine principal (ex: cdiscount.com depuis order.cdiscount.com ou clients.cdiscount.com)
      const getMainDomain = (host) => {
        const parts = host.split('.');
        if (parts.length > 2) {
          // Garder les 2 dernières parties (ex: cdiscount.com)
          return parts.slice(-2).join('.');
        }
        return host;
      };
      
      const currentMainDomain = getMainDomain(hostname);
      const pendingMainDomain = getMainDomain(pendingPrompt.hostname);
      
      // Si le prompt est pour le même domaine principal et a moins de 30 secondes
      if (currentMainDomain === pendingMainDomain && timeDiff < 30000) {
        // Attendre que la page soit complètement chargée
        if (document.readyState === 'complete') {
          setTimeout(() => {
            showAddToPersonalNotification(pendingPrompt.hostname);
            chrome.storage.local.remove(['pendingPrompt']);
          }, 500);
        } else {
          window.addEventListener('load', () => {
            setTimeout(() => {
              showAddToPersonalNotification(pendingPrompt.hostname);
              chrome.storage.local.remove(['pendingPrompt']);
            }, 500);
          });
        }
      } else if (timeDiff >= 30000) {
        // Nettoyer les anciens prompts
        chrome.storage.local.remove(['pendingPrompt']);
      }
    }
  } catch (error) {
    console.error('[ShieldSign] Erreur lors de la vérification du prompt:', error);
  }
}

// Vérifier au chargement
checkPendingPrompt();

// Afficher une notification pour ajouter le site à la liste personnelle
function showAddToPersonalNotification(hostname) {
  // Éviter les notifications multiples
  if (document.getElementById('shieldsign-notification')) return;
  
  const notification = document.createElement('div');
  notification.id = 'shieldsign-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  const message = document.createElement('div');
  message.style.cssText = 'font-weight: 500; margin-bottom: 4px;';
  message.textContent = chrome.i18n.getMessage('notificationAddToPersonal') || 'Ajouter ce site à votre liste personnelle ?';
  
  const hostname_display = document.createElement('div');
  hostname_display.style.cssText = 'font-size: 12px; opacity: 0.9; margin-bottom: 8px;';
  hostname_display.textContent = `🌐 ${hostname}`;
  
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = 'display: flex; gap: 8px;';
  
  const yesButton = document.createElement('button');
  yesButton.textContent = chrome.i18n.getMessage('notificationAddToPersonalYes') || 'Oui, ajouter';
  yesButton.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    background: white;
    color: #1e3c72;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.1s;
  `;
  yesButton.onmouseover = () => yesButton.style.transform = 'scale(1.05)';
  yesButton.onmouseout = () => yesButton.style.transform = 'scale(1)';
  yesButton.onclick = async () => {
    try {
      await chrome.runtime.sendMessage({
        action: 'ADD_PERSONAL_DOMAIN',
        domain: hostname
      });
      notification.remove();
      showSuccessNotification();
    } catch (error) {
      console.error('[ShieldSign] Erreur lors de l\'ajout:', error);
    }
  };
  
  const noButton = document.createElement('button');
  noButton.textContent = chrome.i18n.getMessage('notificationAddToPersonalNo') || 'Non';
  noButton.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  `;
  noButton.onmouseover = () => noButton.style.background = 'rgba(255, 255, 255, 0.3)';
  noButton.onmouseout = () => noButton.style.background = 'rgba(255, 255, 255, 0.2)';
  noButton.onclick = () => notification.remove();
  
  buttonsContainer.appendChild(yesButton);
  buttonsContainer.appendChild(noButton);
  
  notification.appendChild(message);
  notification.appendChild(hostname_display);
  notification.appendChild(buttonsContainer);
  
  document.body.appendChild(notification);
  
  // Auto-fermeture après 10 secondes
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }
  }, 10000);
}

// Afficher une notification de succès
function showSuccessNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = '✅ ' + (chrome.i18n.getMessage('notificationSiteAdded') || 'Site ajouté à votre liste personnelle');
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

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
