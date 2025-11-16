// Compat layer for cross-browser extension APIs
const Compat = (function(){
  // Storage
  async function storageGet(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(keys, (res) => {
          if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(res || {});
        });
      } catch (e) {
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
          browser.storage.local.get(keys).then(resolve).catch(reject);
        } else {
          reject(e);
        }
      }
    });
  }

  async function storageSet(obj) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(obj, () => {
          if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve();
        });
      } catch (e) {
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
          browser.storage.local.set(obj).then(resolve).catch(reject);
        } else {
          reject(e);
        }
      }
    });
  }

  // Tabs
  async function getActiveTab() {
    try {
      const tabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
      return tabs && tabs[0];
    } catch (e) {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        return tabs && tabs[0];
      } catch (err) {
        return null;
      }
    }
  }

  async function getTab(tabId) {
    try { return await chrome.tabs.get(tabId); } catch (e) {
      try { return await browser.tabs.get(tabId); } catch (err) { return null; }
    }
  }

  // Action / browserAction
  async function setBadgeText(text, tabId) {
    try {
      const actionApi = (typeof chrome !== 'undefined') ? (chrome['action'] || chrome['browserAction']) : null;
      if (actionApi && actionApi.setBadgeText) {
        try { return await actionApi.setBadgeText({ text: String(text), tabId }); } catch(e) {}
      }
    } catch (e) {}
    return;
  }

  async function setBadgeBg(color, tabId) {
    try {
      const actionApi = (typeof chrome !== 'undefined') ? (chrome['action'] || chrome['browserAction']) : null;
      if (actionApi && actionApi.setBadgeBackgroundColor) {
        try { return await actionApi.setBadgeBackgroundColor({ color, tabId }); } catch(e) {}
      }
    } catch (e) {}
    return;
  }

  // ExecuteScript compat
  async function executeScriptCompat(tabId, func) {
    try {
      if (chrome.scripting && chrome.scripting.executeScript) {
        const results = await chrome.scripting.executeScript({ target: { tabId }, func });
        return results;
      }
    } catch (e) {}
    return new Promise((resolve) => {
      try {
        const code = `(${func.toString()})()`;
        chrome.tabs.executeScript(tabId, { code }, (res) => { resolve(res); });
      } catch (err) { resolve(null); }
    });
  }

  return {
    storageGet, storageSet,
    getActiveTab, getTab,
    setBadgeText, setBadgeBg,
    executeScriptCompat
  };
})();

// Expose globally for simple includes (works in window and worker scopes)
try { globalThis.Compat = Compat; } catch (e) { /* ignore */ }
