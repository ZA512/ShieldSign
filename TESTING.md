# 🧪 Guide de test ShieldSign

## Étape 1 : Charger l'extension dans Chrome/Edge

### Chrome
1. Ouvrir Chrome
2. Aller à `chrome://extensions/`
3. Activer le **"Mode développeur"** (toggle en haut à droite)
4. Cliquer sur **"Charger l'extension non empaquetée"**
5. Sélectionner le dossier `C:\Users\m.girard\Documents\github\SSO`
6. L'extension devrait apparaître avec l'icône ShieldSign

### Edge
1. Ouvrir Edge
2. Aller à `edge://extensions/`
3. Activer le **"Mode développeur"** (toggle à gauche)
4. Cliquer sur **"Charger l'extension décompressée"**
5. Sélectionner le dossier `C:\Users\m.girard\Documents\github\SSO`
6. L'extension devrait apparaître avec l'icône ShieldSign

## Étape 2 : Configurer la liste de test

1. Cliquer sur l'icône ShieldSign dans la barre d'outils
2. Cliquer sur **"⚙️ Paramètres"**
3. Aller dans l'onglet **"Sources"**
4. Dans **"Listes communautaires"**, ajouter l'URL :
   - Si vous hébergez le fichier localement, utiliser un serveur web simple (voir ci-dessous)
   - Ou utiliser une URL GitHub raw si vous avez push le fichier

## Étape 3 : Tester sur des sites réels

### Sites à tester (présents dans votre liste)
- ✅ https://accounts.google.com
- ✅ https://login.microsoftonline.com
- ✅ https://www.facebook.com
- ✅ https://login.linkedin.com
- ✅ https://www.netflix.com
- ✅ https://accounts.spotify.com

### Comportement attendu
1. **Sur un site validé** (ex: accounts.google.com) :
   - Un bandeau bleu doit apparaître en haut : "✅ Page validée par : ShieldSign - Public Cloud & Services (v1.0)"
   - L'icône de l'extension doit être verte

2. **Sur un site non listé** :
   - Aucun bandeau
   - L'icône reste grise ou bleue claire

## Étape 4 : Tester la liste personnelle

1. Aller sur un site de connexion NON listé (ex: https://github.com/login)
2. Cliquer sur l'icône ShieldSign
3. Cliquer sur **"✅ Approuver ce domaine"**
4. Recharger la page
5. Le bandeau violet doit apparaître : "✅ Page validée par : Liste personnelle"

## Serveur web simple pour tester localement

### Option 1 : PowerShell (Python)
```powershell
cd C:\Users\m.girard\Documents\github\SSO
python -m http.server 8000
```
Puis utiliser : `http://localhost:8000/shieldsign_public_list_v1.json`

### Option 2 : PowerShell natif
```powershell
cd C:\Users\m.girard\Documents\github\SSO
npx http-server -p 8000 --cors
```

### Option 3 : Utiliser GitHub
1. Push le fichier `shieldsign_public_list_v1.json` sur GitHub
2. Aller sur le fichier dans GitHub
3. Cliquer sur "Raw"
4. Copier l'URL (ex: `https://raw.githubusercontent.com/ZA512/ShieldSign/main/shieldsign_public_list_v1.json`)
5. Utiliser cette URL dans les paramètres de l'extension

## Vérifications dans la console

### Console du background script
1. Aller sur `chrome://extensions/`
2. Cliquer sur "Inspecter les vues : service worker" sous ShieldSign
3. Vérifier les logs :
   - `[ShieldSign] Extension installée`
   - `[ShieldSign] Mise à jour des listes...`
   - `[ShieldSign] Liste mise à jour: <url>`

### Console d'une page validée
1. Ouvrir la console (F12)
2. Aller sur accounts.google.com
3. Vérifier les logs :
   - `[ShieldSign] Bandeau injecté pour: ... (community)`

## Problèmes courants

### Le bandeau n'apparaît pas
- Vérifier que la page a un champ `input[type="password"]`
- Ouvrir la console et chercher les erreurs
- Vérifier que la liste est bien chargée dans les paramètres

### L'icône ne change pas
- C'est normal pour la v1.0, la gestion des icônes dynamiques sera ajoutée plus tard

### La liste ne se charge pas
- Vérifier que l'URL est accessible (CORS)
- Vérifier le format JSON (utiliser un validateur JSON en ligne)
- Regarder la console du background script pour les erreurs

## Commandes de debug utiles

```javascript
// Dans la console du background script
chrome.storage.local.get(null, (data) => console.log(data));

// Dans la console d'une page
chrome.runtime.sendMessage({action: 'CHECK_PAGE', hostname: window.location.hostname}, (response) => console.log(response));
```
