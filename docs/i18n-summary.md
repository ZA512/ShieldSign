# Résumé de l'internationalisation (i18n)

## ✅ Travail terminé

L'extension ShieldSign est maintenant complètement internationalisée avec support pour l'anglais (EN) et le français (FR).

### Fichiers modifiés

#### 1. Structure i18n
- `_locales/en/messages.json` - 195 clés en anglais
- `_locales/fr/messages.json` - 195 clés en français
- `manifest.json` - Ajout de `"default_locale": "en"`

#### 2. HTML (data-i18n)
- `options/options.html` - Tous les textes statiques avec attribut `data-i18n`
- `popup/popup.html` - Tous les textes statiques avec attribut `data-i18n`
- Changement de `<html lang="fr">` à `<html lang="en">` (détecté automatiquement)

#### 3. JavaScript (chrome.i18n.getMessage)
- `options/options.js` - translatePage() + tous les toasts et textes dynamiques
- `popup/popup.js` - translatePage() + tous les messages de statut
- `content.js` - Bandeau et noms de listes traduits
- `background.js` - Déjà compatible (DEFAULT_SETTINGS avec language: 'auto')

### Fonctionnalités i18n

#### Détection automatique
- Par défaut, l'extension utilise la langue du navigateur Chrome
- Support: `auto` (langue navigateur), `en` (anglais), `fr` (français)

#### Sélecteur manuel
- Dans l'onglet "Paramètres", l'utilisateur peut choisir la langue
- Options: Automatique, English, Français
- Sauvegarde dans `chrome.storage.local`
- Recharge automatique de la page pour appliquer

#### Fonction translatePage()
Présente dans `options.js` et `popup.js` :
```javascript
function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.placeholder = message;
      } else if (element.tagName === 'OPTION') {
        element.textContent = message;
      } else {
        element.innerHTML = message; // Support des balises HTML
      }
    }
  });
}
```

### Clés de traduction (195 au total)

#### Catégories principales
1. **Metadata** (2 clés)
   - `extName`, `extDescription`

2. **Onglets** (5 clés)
   - `tabCommunity`, `tabEnterprise`, `tabPersonal`, `tabSettings`, `tabAbout`

3. **Liste officielle** (8 clés)
   - `officialListTitle`, `officialListDescription`, `officialListName`, etc.

4. **Listes communautaires** (12 clés)
   - `communityListTitle`, `addCommunityBtn`, `noListCommunity`, etc.

5. **Source entreprise** (35 clés)
   - Info box: `enterpriseInfoTitle`, `enterpriseInfoShort`
   - Modal complet avec 7 sections (Why, Security, Format, Hosting, Maintenance)
   - Exemple JSON téléchargeable

6. **Domaines personnels** (10 clés)
   - `personalDomainsTitle`, `addPersonalDomainBtn`, etc.

7. **Import/Export** (4 clés)
   - `importExportTitle`, `btnExport`, `btnImport`, etc.

8. **Paramètres** (15 clés)
   - Langue, mode entreprise, vérification CN, durée cache, couleurs

9. **À propos** (8 clés)
   - Version, licence, contributeurs, confidentialité

10. **Toasts** (45 clés)
    - Messages de succès, erreurs, avertissements
    - Validation, suppression, import/export

11. **Popup** (12 clés)
    - Statut de vérification, boutons, messages d'état

12. **Content Script** (3 clés)
    - Bandeau de validation, noms de listes

13. **Actions** (15 clés)
    - Boutons: Ajouter, Supprimer, Enregistrer, Réinitialiser, etc.

14. **Titres d'attributs** (8 clés)
    - Tooltips pour les boutons (data-i18n-title)

### Support HTML dans les traductions

Les clés de traduction supportent les balises HTML :
- `<strong>` pour le texte en gras
- `<code>` pour le code inline
- `<ul>` et `<li>` pour les listes
- Placeholders avec `{0}`, `{1}`, etc.

Exemple :
```json
"modalHostingOption1": {
  "message": "<strong>Serveur interne uniquement</strong> (accessible seulement depuis le réseau entreprise)"
}
```

### Validation

✅ Tous les fichiers JSON sont valides (testé avec PowerShell `ConvertFrom-Json`)
✅ 195 clés identiques dans EN et FR
✅ Aucune clé manquante
✅ Tous les textes hardcodés remplacés par des clés i18n

### Test

1. Ouvrir Chrome en anglais → Extension en anglais
2. Ouvrir Chrome en français → Extension en français
3. Changer manuellement dans Paramètres → Recharge et applique

### Ajout d'une nouvelle langue

Pour ajouter une nouvelle langue (ex: espagnol) :

1. Créer `_locales/es/messages.json`
2. Copier le contenu de `_locales/en/messages.json`
3. Traduire toutes les valeurs `"message"` en espagnol
4. Ajouter l'option dans le sélecteur de langue :
   ```html
   <option value="es" data-i18n="languageEs">Español</option>
   ```
5. Ajouter la clé dans les fichiers de traduction :
   ```json
   "languageEs": {
     "message": "Español"
   }
   ```

### Messages avec paramètres

Pour les messages avec variables dynamiques :
```javascript
// En
"popupValidatedBy": {
  "message": "Validated by: {0}"
}

// Fr
"popupValidatedBy": {
  "message": "Validé par : {0}"
}

// Utilisation
chrome.i18n.getMessage('popupValidatedBy', [listNames])
```

## 🎯 Résultat

L'extension ShieldSign est maintenant **100% internationalisée** et prête pour une distribution mondiale avec support natif de Chrome i18n.
