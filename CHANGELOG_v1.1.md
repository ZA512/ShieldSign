# 🎉 Changements v1.1 - Liste officielle et noms de listes

## ✨ Nouvelles fonctionnalités

### 1. Liste officielle ShieldSign
- **Ajoutée automatiquement** à l'installation
- **Non supprimable** (bouton de suppression absent)
- **Activable/désactivable** via un bouton toggle (✓/✗)
- URL : `https://raw.githubusercontent.com/ZA512/ShieldSign/main/shieldsign_public_list_v1.json`
- Nom : **"ShieldSign Official List"**

### 2. Affichage des noms de listes
- Le **bandeau** affiche maintenant le **nom de la liste** au lieu de l'URL
- Exemples :
  - ✅ "Page validée par : **ShieldSign Official List**"
  - ✅ "Page validée par : **Liste personnelle**"
  - ✅ "Page validée par : **Liste entreprise**"

### 3. Activation/désactivation des listes
- Bouton **✓** (vert) = liste activée
- Bouton **✗** (gris) = liste désactivée
- Permet de désactiver temporairement une liste sans la supprimer
- Les listes désactivées sont visuellement grisées

## 🔧 Modifications techniques

### `background.js`
- Ajout de la constante `OFFICIAL_LIST_URL`
- Ajout automatique de la liste officielle lors de l'installation
- Nouvelle structure de données avec `isOfficial` et `enabled`
- Fonction `getAllActiveDomains()` retourne maintenant une **Map** avec le nom de la liste
- Fonction `checkDomain()` retourne directement le nom de la liste
- Fonction `toggleList()` pour activer/désactiver une liste
- Fonction `removeList()` empêche la suppression de la liste officielle

### `options.html`
- Nouvelle section **"Liste officielle ShieldSign"** en haut
- Séparation claire entre liste officielle, entreprise et communautaires

### `options.css`
- Style pour les boutons toggle (✓/✗)
- Style pour les listes désactivées (opacité réduite)

### `options.js`
- Chargement de la liste officielle dans une section dédiée
- Fonction `createListItem()` avec gestion du bouton toggle
- Fonction `toggleList()` pour activer/désactiver
- Le bouton supprimer n'apparaît pas pour la liste officielle

### `content.js`
- Fonction `getListDisplayName()` utilise directement le nom fourni par le background

### `shieldsign_public_list_v1.json`
- Nom changé en **"ShieldSign Official List"** (plus court et clair)

## 📋 Comportement

### À l'installation
1. La liste officielle est **automatiquement ajoutée**
2. Elle est **activée par défaut**
3. Une mise à jour est lancée pour télécharger les domaines

### Dans les options (Onglet Sources)
```
┌─────────────────────────────────────────┐
│ Liste officielle ShieldSign             │
│ ✓ ShieldSign Official List         ✓   │
│   https://raw.githubusercontent.com/... │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Liste entreprise                        │
│ (vide ou une liste entreprise)          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Listes communautaires                   │
│ + Ajouter une liste communautaire       │
│ ✓ Ma liste custom              ✓  🗑️   │
└─────────────────────────────────────────┘
```

### Sur une page validée
**Avant** : "✅ Page validée par : login.microsoftonline.com"
**Après** : "✅ Page validée par : ShieldSign Official List"

## 🧪 Pour tester

1. **Rechargez l'extension** :
   ```powershell
   .\reload.ps1
   ```

2. **Allez dans les paramètres** :
   - Vérifiez que la liste officielle apparaît
   - Testez le bouton toggle (✓/✗)
   - Vérifiez qu'il n'y a pas de bouton 🗑️ pour la liste officielle

3. **Testez sur une page** :
   - Allez sur `https://login.microsoftonline.com`
   - Le bandeau devrait afficher : "✅ Page validée par : ShieldSign Official List"

4. **Testez la désactivation** :
   - Dans les options, désactivez la liste officielle (cliquez sur ✓)
   - Rechargez une page validée
   - Le bandeau ne devrait plus apparaître
   - Réactivez la liste (cliquez sur ✗)

## 🐛 Points d'attention

- Si l'extension était déjà installée, elle doit être **rechargée** pour ajouter la liste officielle
- Si besoin, vous pouvez **réinstaller** l'extension pour repartir à zéro
- La liste officielle se met à jour automatiquement toutes les 24h (ou selon le TTL configuré)
