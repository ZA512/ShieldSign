# Configuration Google Forms pour contributions communautaires

Ce guide explique comment configurer le Google Form pour permettre aux utilisateurs de partager leurs listes personnelles via l'extension ShieldSign.

## URL du formulaire actuel

**Formulaire de contribution :** https://docs.google.com/forms/d/e/1FAIpQLSce_bowurxHSWmiYqRa-QrTu2OEnHCdKFdx1AvqE0CqmHqxEg/viewform

## Comment ça fonctionne côté utilisateur

1. L'utilisateur ouvre l'extension ShieldSign → **Sources personnelles** ou **À propos**
2. Il colle l'URL du formulaire dans le champ prévu
3. Il clique sur **"Partager vers Sheets"** ou **"Partager ma liste"**
4. L'extension :
   - Récupère sa liste personnelle de domaines
   - Retire automatiquement les domaines déjà présents dans les listes communautaires
   - Retire les domaines déjà partagés précédemment (historique local)
   - Filtre les domaines internes (.local, .lan, IPs privées)
   - Envoie chaque domaine au formulaire
   - Affiche un message de remerciement avec le nombre de domaines partagés

## Configuration du Google Form (déjà fait)

### Paramètres du formulaire
- ✅ Une seule question de type "Réponse courte"
- ✅ Titre de la question : "Domaine"
- ✅ Question obligatoire
- ✅ Pas de restriction aux utilisateurs d'une organisation (contributions anonymes)
- ✅ Pas de collecte d'emails

### Feuille de réponses Google Sheets
Le formulaire est lié à un Google Sheet qui collecte automatiquement toutes les soumissions.

## Script Apps Script pour dédoublonnage automatique

### Installation du script

1. Ouvrez le Google Sheet lié au formulaire (Réponses)
2. Allez dans **Extensions** → **Apps Script**
3. Collez le code ci-dessous
4. Sauvegardez le projet (Ctrl+S)
5. Créez un déclencheur (trigger) :
   - Cliquez sur l'icône **horloge** (Déclencheurs) dans le menu de gauche
   - Cliquez sur **+ Ajouter un déclencheur**
   - Configurez :
     - Fonction : `onFormSubmit`
     - Source de l'événement : `From spreadsheet`
     - Type d'événement : `On form submit`
   - Cliquez sur **Enregistrer**
   - Autorisez le script si demandé

### Code du script

```javascript
/**
 * ShieldSign - Script de dédoublonnage automatique
 * 
 * Ce script :
 * - Normalise les domaines (minuscules, supprime www.)
 * - Valide le format des domaines
 * - Maintient une feuille 'master' avec domaines uniques
 * - Marque les doublons et domaines invalides dans les réponses
 */

function onFormSubmit(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Créer ou récupérer la feuille master
  let master = ss.getSheetByName('master');
  if (!master) {
    master = ss.insertSheet('master');
    master.appendRow(['Domaine', 'Date première soumission', 'Nombre de soumissions']);
    master.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  
  const responsesSheet = ss.getSheetByName('Form Responses 1') || ss.getSheets()[0];
  
  // e.values : [Timestamp, Domaine, ...]
  // La première valeur est le timestamp, la seconde est le domaine
  const domainRaw = (e.values && e.values[1]) ? String(e.values[1]).trim().toLowerCase() : '';
  
  if (!domainRaw) {
    markResponseRow(responsesSheet, 'EMPTY');
    return;
  }
  
  // Normalisation : retirer www. et espaces
  const domain = domainRaw.replace(/^www\./, '').trim();
  
  // Validation du format
  const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    markResponseRow(responsesSheet, 'INVALID_FORMAT');
    return;
  }
  
  // Filtrer les domaines internes
  const privateRegex = /(^localhost$|^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|\.local$|\.lan$|\.internal$)/i;
  if (privateRegex.test(domain)) {
    markResponseRow(responsesSheet, 'INTERNAL_DOMAIN');
    return;
  }
  
  // Charger les domaines existants dans master
  const lastRow = master.getLastRow();
  const existingDomains = lastRow > 1 
    ? master.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(v => String(v||'').trim().toLowerCase())
    : [];
  
  const domainIndex = existingDomains.indexOf(domain);
  
  if (domainIndex === -1) {
    // Nouveau domaine
    master.appendRow([domain, new Date(), 1]);
    markResponseRow(responsesSheet, 'ADDED');
  } else {
    // Domaine déjà existant
    const rowIndex = domainIndex + 2; // +2 car index 0-based et ligne 1 = header
    const currentCount = master.getRange(rowIndex, 3).getValue() || 0;
    master.getRange(rowIndex, 3).setValue(currentCount + 1);
    markResponseRow(responsesSheet, 'DUPLICATE');
  }
}

/**
 * Marque la dernière ligne de réponses avec un statut
 */
function markResponseRow(sheet, status) {
  const row = sheet.getLastRow();
  const col = sheet.getLastColumn() + 1;
  
  // Ajouter un header si besoin
  if (sheet.getRange(1, col).getValue() === '') {
    sheet.getRange(1, col).setValue('Statut').setFontWeight('bold');
  }
  
  sheet.getRange(row, col).setValue(status);
  
  // Colorer selon le statut
  const colors = {
    'ADDED': '#d9ead3',      // Vert clair
    'DUPLICATE': '#fff2cc',   // Jaune clair
    'INVALID_FORMAT': '#f4cccc', // Rouge clair
    'INTERNAL_DOMAIN': '#fce5cd', // Orange clair
    'EMPTY': '#efefef'        // Gris clair
  };
  
  if (colors[status]) {
    sheet.getRange(row, col).setBackground(colors[status]);
  }
}
```

### Fonctionnalités du script

- **Normalisation** : convertit en minuscules, retire `www.`
- **Validation** : vérifie le format des domaines
- **Filtrage** : exclut les domaines internes (.local, .lan, IPs privées, localhost)
- **Dédoublonnage** : maintient une feuille `master` avec domaines uniques
- **Compteur** : suit le nombre de soumissions par domaine
- **Marquage** : ajoute un statut coloré dans les réponses :
  - 🟢 ADDED : nouveau domaine ajouté
  - 🟡 DUPLICATE : domaine déjà présent
  - 🔴 INVALID_FORMAT : format invalide
  - 🟠 INTERNAL_DOMAIN : domaine interne exclu
  - ⚪ EMPTY : soumission vide

## Utilisation de la feuille master

Après l'installation du script, une nouvelle feuille `master` sera créée automatiquement.

### Colonnes de la feuille master
- **Domaine** : le domaine validé et normalisé
- **Date première soumission** : quand le domaine a été soumis la première fois
- **Nombre de soumissions** : combien de fois ce domaine a été soumis

### Export pour intégration
Pour intégrer les nouveaux domaines dans la liste officielle ShieldSign :

1. Ouvrez la feuille `master`
2. Copiez la colonne **Domaine** (sans l'en-tête)
3. Vérifiez manuellement les domaines si besoin
4. Ajoutez-les au fichier `shieldsign_public_list_v1.json`

### Publication (optionnel)
Si vous souhaitez permettre aux utilisateurs de voir la liste des contributions :

1. Fichier → Partager → Publier sur le Web
2. Choisir la feuille `master`
3. Format CSV
4. Publier
5. L'URL CSV peut être utilisée pour import automatique

## Maintenance

### Nettoyage périodique
- Vérifiez régulièrement la feuille `master` pour valider manuellement les nouveaux domaines
- Supprimez les doublons/erreurs si le script a manqué quelque chose
- Archivez les anciennes réponses si nécessaire

### Monitoring
- Consultez la colonne "Statut" dans Form Responses 1 pour voir les erreurs
- Les domaines marqués DUPLICATE peuvent indiquer des contributions populaires

## Sécurité et confidentialité

- ✅ Aucune donnée personnelle collectée (pas d'email)
- ✅ Soumissions anonymes acceptées
- ✅ Filtrage automatique des domaines internes
- ✅ L'extension côté utilisateur ne partage QUE les domaines, aucune autre métadonnée
- ✅ Historique local dans l'extension pour éviter les doublons

## Support

Pour toute question sur la configuration :
- GitHub Issues : https://github.com/ZA512/ShieldSign/issues
- Documentation : https://github.com/ZA512/ShieldSign/blob/main/README.md
