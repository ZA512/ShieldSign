# 🛡️ ShieldSign

Extension navigateur open-source de validation visuelle des pages de connexion sûres via listes blanches de domaines avec protection anti-phishing avancée.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Licence](https://img.shields.io/badge/licence-MIT-green)
![Manifest](https://img.shields.io/badge/manifest-v3-orange)

## 📋 Table des matières

- [À propos](#à-propos)
- [Fonctionnalités](#fonctionnalités)
- [Modes de validation](#modes-de-validation)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Configuration](#configuration)
- [Format des listes](#format-des-listes)
- [Déploiement entreprise](#déploiement-entreprise)
- [Développement](#développement)
- [Contribution](#contribution)
- [Licence](#licence)

## 🎯 À propos

**ShieldSign** est une extension navigateur qui valide visuellement les pages de connexion légitimes en affichant un bandeau de confirmation lorsque le domaine figure dans une liste blanche de confiance. L'extension propose plusieurs modes de validation anti-phishing pour garantir l'authenticité de la validation.

### Principes de base

- ✅ **Validation positive uniquement** : affichage uniquement si le domaine est reconnu
- 🔒 **Protection anti-phishing** : codes aléatoires et mots-clés personnels impossibles à imiter
- 🎨 **Personnalisation complète** : couleurs, polices et styles configurables
- 🌐 **Sans backend** : fonctionnement 100% côté client, aucune donnée transmise
- 🏢 **Adapté aux entreprises** : support de listes entreprise déployables via politiques
- 🔄 **Listes communautaires** : support de listes publiques maintenues par la communauté
- 💾 **Auto-sauvegarde** : tous les paramètres sont sauvegardés automatiquement

## ✨ Fonctionnalités

### Détection automatique
- Détecte les pages contenant un champ de mot de passe
- Fonctionne avec les applications web classiques et les SPA (Single Page Applications)
- Détection des formulaires de connexion pour ajout automatique aux listes

### Validation de domaines
- Vérification par correspondance exacte de domaine (pas de wildcard)
- Support de trois types de listes avec système de priorités :
  - **Entreprise** (priorité 1) : liste unique configurée par l'organisation
  - **Personnelle** (priorité 2) : domaines ajoutés manuellement par l'utilisateur
  - **Communautaire** (priorité 3) : listes publiques partagées (officielle + additionnelles)

### Affichage visuel avancé
- Badge de couleur sur l'icône de l'extension (toujours vert pour cohérence)
- Bandeau personnalisable en haut de la page (couleurs solides ou dégradés)
- Icône du phare ShieldSign pour identification visuelle
- 3 modes de validation anti-phishing au choix
- Design non intrusif, compact et professionnel

### Gestion des listes
- Mise à jour automatique des listes distantes (TTL configurable)
- Support des en-têtes ETag pour optimiser les téléchargements
- Validation du schéma JSON des listes
- Interface de gestion intuitive avec onglets séparés
- Import/Export de la liste personnelle
- Ajout automatique ou prompt lors de la soumission de formulaire sur site inconnu

### Personnalisation avancée
- **Styles de bandeau** : mode couleur solide ou dégradé pour chaque type de liste
- **Couleurs personnalisables** : choisissez vos propres couleurs ou utilisez le générateur aléatoire intelligent (🎲)
- **Polices configurables** : Arial, Verdana, Georgia, Courier New, Times New Roman
- **Contraste automatique** : le texte s'adapte automatiquement (blanc/noir) selon la couleur de fond
- **Prévisualisation en temps réel** : voyez vos changements immédiatement

## 🔐 Modes de validation

ShieldSign propose 3 modes de validation anti-phishing pour s'assurer que le bandeau est authentique :

### 1. 🔵 Badge uniquement (discret)
- Aucun bandeau visible sur la page
- Point de couleur vert sur l'icône de l'extension
- Discret et non-intrusif
- ⚠️ Nécessite de vérifier l'icône dans la barre d'outils

### 2. 🔑 Bandeau avec mot-clé personnel
- Bandeau affichant votre mot-clé ou phrase personnalisée
- Seul vous connaissez ce mot-clé
- Impossible à imiter par un attaquant
- ✅ Validation immédiate et personnalisée
- ⚠️ Nécessite de mémoriser votre mot-clé (5 caractères minimum)

### 3. 🎲 Bandeau avec code aléatoire (recommandé)
- Code alphanumérique unique de 2 caractères (ex: A7, H4, 8R)
- Généré automatiquement à chaque visite
- Affiché dans le bandeau ET sur le badge de l'extension
- ✅ Aucune mémorisation nécessaire
- ✅ Vérification rapide : comparez badge et bandeau
- ✅ Code unique impossible à prédire ou imiter
- ✅ Équilibre parfait sécurité/simplicité

**Pourquoi ces options ?** Si ShieldSign devient populaire, un attaquant pourrait créer un faux bandeau vert sur sa page de phishing. Ces modes rendent l'imitation **impossible** car seule VOTRE extension connaît votre mot-clé personnel ou votre code du jour.

## 📦 Installation

### Installation pour développement

1. **Cloner le dépôt**
```bash
git clone https://github.com/ZA512/ShieldSign.git
cd ShieldSign
```

2. **Charger l'extension dans Chrome/Edge**
   - Ouvrir `chrome://extensions/` (ou `edge://extensions/`)
   - Activer le "Mode développeur"
   - Cliquer sur "Charger l'extension non empaquetée"
   - Sélectionner le dossier du projet

3. **Charger l'extension dans Firefox**
   - Ouvrir `about:debugging#/runtime/this-firefox`
   - Cliquer sur "Charger un module complémentaire temporaire"
   - Sélectionner le fichier `manifest.json`

### Installation pour production

Les extensions packagées seront disponibles prochainement sur :
- Chrome Web Store
- Microsoft Edge Add-ons
- Firefox Add-ons

## 🚀 Utilisation

### Première utilisation

1. **Installer l'extension** (voir section Installation)
2. **Choisir votre mode de validation** :
   - Aller dans Paramètres > Validation de sécurité anti-phishing
   - Choisir entre Badge uniquement, Bandeau avec mot-clé, ou Bandeau avec code aléatoire (recommandé)
   - Si vous choisissez le mode mot-clé, définissez votre phrase personnelle

3. **Configurer vos sources de confiance** :
   - Onglet "Sources communautaires" : la liste officielle est activée par défaut
   - Ajouter des listes communautaires additionnelles (optionnel)
   - Onglet "Source entreprise" : pour les administrateurs seulement

4. **Personnaliser l'apparence** (optionnel) :
   - Onglet Paramètres > Style du bandeau
   - Choisissez couleurs solides ou dégradés
   - Utilisez le bouton 🎲 pour générer des couleurs harmonieuses
   - Sélectionnez la police de votre choix

### Utilisation quotidienne

- **Validation automatique** : 
  - Mode Badge : vérifiez le badge vert sur l'icône ShieldSign
  - Mode Bandeau : le bandeau s'affiche en haut de page avec votre mot-clé ou code
  - Mode Code : comparez le code du badge avec celui du bandeau (doivent être identiques)

- **Ajout de nouveaux sites** :
  - Lorsque vous vous connectez sur un site inconnu, ShieldSign peut vous proposer de l'ajouter
  - Configurez ce comportement dans Paramètres > "Lors de la soumission d'un formulaire sur un site inconnu"
  - 3 options : Ne rien faire / Ajouter automatiquement / Me demander (recommandé)

- **Vérification manuelle** : cliquez sur l'icône ShieldSign pour voir le statut de la page courante
- **Actualisation** : les listes sont mises à jour automatiquement selon le TTL configuré (par défaut : 24h)

## ⚙️ Configuration

### Interface des paramètres

Accessible via l'icône ShieldSign > ⚙️ Options (clic droit sur l'icône)

#### Onglet Sources communautaires
- **Liste officielle ShieldSign** : liste maintenue par l'équipe, activée par défaut (65+ domaines)
- **Listes communautaires additionnelles** : ajoutez des URLs de listes publiques de confiance
- Actions : Activer/Désactiver, Réinstaller la liste officielle

#### Onglet Source entreprise
- **Mode entreprise** : à activer dans Paramètres généraux pour afficher cet onglet
- **Liste entreprise** : URL unique de la liste officielle de votre organisation
- Priorité maximale sur toutes les autres sources

#### Onglet Sources personnelles
- **Gestion des domaines personnels** : ajoutez/supprimez des domaines manuellement
- **Import/Export** : sauvegardez votre liste ou importez-la sur un autre navigateur
- Format JSON pour faciliter la sauvegarde et le partage

#### Onglet Paramètres

**Paramètres généraux** :
- **Langue** : Automatique (langue du navigateur), English, Français
- **Mode entreprise** : active l'onglet Source entreprise pour les administrateurs
- **Vérification certificat CN** : vérifie la correspondance du certificat (Firefox uniquement)
- **Durée de cache** : fréquence de mise à jour des listes (1-168 heures, défaut: 24h)

**Validation de sécurité anti-phishing** :
- **Mode Badge uniquement** : point vert discret sur l'icône
- **Mode Bandeau avec mot-clé** : affiche votre phrase personnelle (5+ caractères)
- **Mode Bandeau avec code aléatoire** : code de 2 caractères à comparer (recommandé)
- **Afficher l'état pour toutes les pages** : badge même sur pages non listées (🔴 suspect, ⚪ neutre)
- **Soumission formulaire site inconnu** : Ne rien faire / Ajouter automatiquement / Me demander

**Style du bandeau** (3 sections : Entreprise, Communautaire, Personnel) :
- **Mode couleur** : Solid color (couleur unique) ou Gradient (dégradé)
- **Couleurs** : sélecteur de couleur + bouton 🎲 pour générer des couleurs harmonieuses
- **Text color** : couleur du texte du bandeau
- **Font** : choix de la police (Arial, Verdana, Georgia, Courier New, Times New Roman)
- **Preview** : aperçu en temps réel de votre bandeau

## 📄 Format des listes

### Schéma JSON

Les listes doivent respecter le format suivant :

```json
{
  "schema_version": 1,
  "list_name": "Nom de la liste",
  "domains": [
    "login.example.com",
    "auth.example.com",
    "sso.example.com"
  ],
  "maintainer": "contact@example.com"
}
```

### Contraintes

- `schema_version` : entier >= 1
- `list_name` : chaîne de 1 à 128 caractères
- `domains` : tableau de 1 à 1000 domaines
  - Format : `[a-z0-9.-]+\.[a-z]{2,}`
  - Correspondance exacte uniquement (pas de wildcard)
- `maintainer` : identifiant du responsable de la liste

### Exemple de liste entreprise

```json
{
  "schema_version": 1,
  "list_name": "Entreprise X - Services SSO",
  "domains": [
    "login.entreprise-x.com",
    "sso.entreprise-x.com",
    "auth.entreprise-x.net"
  ],
  "maintainer": "secops@entreprise-x.com"
}
```

## 🏢 Déploiement entreprise

### Configuration via politiques de groupe

ShieldSign supporte la pré-configuration via les politiques du navigateur (`chrome.storage.managed`).

#### Politique Chrome/Edge

Créer un fichier de politique `shieldsign_policy.json` :

```json
{
  "enterprise_list_url": {
    "Value": "https://intranet.entreprise-x.com/shieldsign-list.json"
  }
}
```

Déployer via GPO ou MDM selon votre environnement.

#### Hébergement de la liste

1. **Héberger la liste JSON** sur un serveur interne accessible
2. **Configurer les en-têtes HTTP** :
   ```
   Content-Type: application/json
   Cache-Control: public, max-age=3600
   ETag: "version-unique"
   ```

3. **Maintenir la liste** à jour avec les domaines légitimes de l'organisation

### Avantages pour l'entreprise

- ✅ Réduction du risque de phishing grâce aux codes aléatoires impossibles à imiter
- ✅ Sensibilisation des utilisateurs aux domaines légitimes
- ✅ Déploiement centralisé et transparent
- ✅ Aucune infrastructure backend requise
- ✅ Compatible avec les politiques de sécurité existantes
- ✅ Personnalisation des couleurs de bandeau aux couleurs de l'entreprise
- ✅ Mode entreprise séparé pour éviter toute confusion avec les listes personnelles

### Bonnes pratiques de sécurité

- **Hébergement de la liste** : serveur interne uniquement ou URL obscurcie avec GUID
  - ❌ Ne PAS héberger sur GitHub, GitLab ou services publics
  - ✅ Exemple sécurisé : `https://cdn.example.com/a3f2e8b1-4c5d-6e7f/d4e5f6a7.json`
  
- **Maintenance** : mettre à jour régulièrement avec les nouveaux domaines (SSO, portails, SaaS)
  
- **Formation** : expliquer aux utilisateurs comment vérifier le badge/code avant de saisir leurs identifiants

- **Mode de validation** : recommander le mode "Bandeau avec code aléatoire" pour équilibre sécurité/simplicité

## 🛠️ Développement

### Structure du projet

```
ShieldSign/
├── manifest.json          # Déclaration de l'extension (Manifest V3)
├── background.js          # Service worker (gestion des listes, badges, codes)
├── content.js             # Script d'injection du bandeau et détection formulaires
├── popup/                 # Interface popup
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/               # Page de paramètres complète
│   ├── options.html
│   ├── options.js
│   └── options.css
├── _locales/              # Internationalisation
│   ├── en/
│   │   └── messages.json  # 809 clés de traduction anglaises
│   └── fr/
│       └── messages.json  # 809 clés de traduction françaises
├── schemas/               # Schémas JSON
│   └── list.schema.json
├── icons/                 # Icônes de l'extension
│   ├── icon16ssf.png
│   ├── icon32ssf.png
│   ├── icon48ssf.png
│   ├── icon56ssf.png      # Icône phare pour bandeaux
│   ├── icon128ssf.png
│   ├── icon512ssf.png
│   ├── capture-badge-r.png   # Captures d'écran pour documentation
│   ├── capture-code-r.png
│   └── capture-cle-r.png
└── docs/                  # Documentation
    ├── PRD.md
    └── DevBook.md
```

### Technologies utilisées

- **Manifest V3** : dernière version du système d'extensions Chrome/Edge/Firefox
- **Service Worker** : background.js pour gestion centralisée
- **Content Scripts** : injection dynamique des bandeaux
- **Chrome Storage API** : stockage local sécurisé (chrome.storage.local)
- **Internationalisation** : chrome.i18n avec support FR/EN
- **CSS moderne** : Flexbox, Grid, variables CSS, animations
- **JavaScript ES6+** : async/await, Promises, modules

### Fonctionnalités techniques avancées

- **Génération de code aléatoire** : combinaison alphanumérique (0-9, A-Z) à chaque visite
- **Synchronisation badge/bandeau** : code stocké par onglet dans Map() en mémoire
- **Détection de formulaires** : addEventListener sur submit des forms avec input[type="password"]
- **Notification post-navigation** : chrome.storage.local pour persister l'état entre pages
- **Cross-subdomain tracking** : extraction du domaine principal pour redirection (order.site.com → clients.site.com)
- **Génération de couleurs intelligente** : espace HSL (teinte 0-360°, saturation 60-100%, luminosité 45-60%)
- **Contraste automatique** : calcul de luminance RGB pour texte blanc/noir optimal
- **Auto-sauvegarde** : debounce(500ms) pour champs texte, sauvegarde immédiate pour autres inputs
- **Preview en temps réel** : mise à jour instantanée des aperçus de bandeau

### Prérequis

- Node.js (optionnel, pour les tests)
- Navigateur moderne (Chrome 88+, Edge 88+, Firefox 89+)

### Tests

```bash
# Tests manuels recommandés
# Charger l'extension en mode développeur et tester sur :

# 1. Modes de validation
# - Badge uniquement : vérifier badge vert sans bandeau
# - Bandeau avec mot-clé : vérifier affichage du mot-clé personnalisé
# - Bandeau avec code : vérifier correspondance badge/bandeau

# 2. Pages de connexion réelles
# - Microsoft (login.microsoftonline.com)
# - Google (accounts.google.com)
# - GitHub (github.com/login)
# - AWS (signin.aws.amazon.com)

# 3. Types d'applications
# - Sites web classiques
# - SPA (Single Page Applications)
# - Différents domaines et sous-domaines

# 4. Formulaires
# - Soumission sur site inconnu
# - Vérifier notification d'ajout à la liste personnelle
# - Tester les 3 options (never/always/prompt)

# 5. Personnalisation
# - Changer couleurs (solide et dégradé)
# - Tester bouton 🎲 (génération aléatoire)
# - Vérifier contraste automatique du texte
# - Changer polices
# - Vérifier preview en temps réel

# 6. Navigation
# - Cross-subdomain (ex: order.site.com → clients.site.com)
# - Persistence du code dans le badge
# - Notifications après redirection

# 7. Paramètres
# - Auto-sauvegarde de tous les champs
# - Import/Export liste personnelle
# - Changement de langue (FR/EN)
# - Mode entreprise (affichage/masquage section)
```

### Scripts utiles

**PowerShell (Windows)** :
```powershell
# Recharger l'extension rapidement
# Créer un fichier reload.ps1 :
Write-Host "Rechargement de l'extension ShieldSign..." -ForegroundColor Cyan
Write-Host "Allez dans chrome://extensions et cliquez sur le bouton Recharger" -ForegroundColor Yellow
Start-Process "chrome://extensions"
```

**Build scripts** :

- Windows : `./build.ps1`
- Linux/macOS : `bash ./build.sh`

Ces scripts produisent les archives dans `./releases` en utilisant Manifest V3 pour Chrome/Edge et Manifest V2 pour Firefox.

**Bash (Linux/Mac)** (méthode manuelle) :
```bash
# Package pour distribution
zip -r ShieldSign-v1.0.0.zip manifest.json *.js popup/ options/ _locales/ schemas/ icons/ -x "*.git*" -x "*node_modules*"
```

### Packaging

```bash
# Créer un ZIP pour distribution Chrome Web Store / Edge Add-ons
zip -r ShieldSign-v1.0.0.zip \
  manifest.json \
  background.js \
  content.js \
  popup/ \
  options/ \
  _locales/ \
  schemas/ \
  icons/ \
  -x "*.git*" -x "*node_modules*" -x "*.md" -x "docs/*"

# Pour Firefox (même contenu, format .xpi)
zip -r ShieldSign-v1.0.0.xpi \
  manifest.json \
  background.js \
  content.js \
  popup/ \
  options/ \
  _locales/ \
  schemas/ \
  icons/ \
  -x "*.git*" -x "*node_modules*" -x "*.md" -x "docs/*"
```

### Points d'attention pour le développement

- **Manifest V3** : service workers au lieu de background pages
- **Permissions minimales** : seulement `storage`, `alarms`, `tabs`, `scripting`
- **web_accessible_resources** : icône phare accessible depuis content scripts
- **chrome.storage.local** : limite 10MB, utiliser avec parcimonie
- **tabCodes Map** : en mémoire volatile, réinitialisée au redémarrage du service worker
- **i18n** : toujours ajouter clés en FR et EN simultanément
- **CSS compact** : privilégier layouts compacts pour ne pas encombrer l'interface

## 🤝 Contribution

Les contributions sont les bienvenues ! Consultez le [guide de contribution](CONTRIBUTING.md) pour plus de détails.

### Comment contribuer

1. **Fork le projet**
2. **Créer une branche feature** (`git checkout -b feature/AmazingFeature`)
3. **Commiter les changements** (`git commit -m 'Add AmazingFeature'`)
4. **Pousser vers la branche** (`git push origin feature/AmazingFeature`)
5. **Ouvrir une Pull Request** avec description détaillée

### Types de contributions recherchées

- 🐛 **Corrections de bugs** : signalez ou corrigez les problèmes
- ✨ **Nouvelles fonctionnalités** : proposez des améliorations
- 📝 **Documentation** : améliorez README, PRD, DevBook
- 🌐 **Traductions** : ajoutez de nouvelles langues dans `_locales/`
- 🎨 **UI/UX** : proposez des améliorations d'interface
- 🔒 **Sécurité** : identifiez et corrigez les vulnérabilités

### Standards de code

- **JavaScript** : ES6+, async/await, pas de var
- **CSS** : classes BEM ou utilitaires, variables CSS pour couleurs
- **HTML** : sémantique, attributs `data-i18n` pour tous les textes
- **i18n** : toujours traduire en FR et EN
- **Commentaires** : expliquer le "pourquoi", pas le "quoi"
- **Auto-sauvegarde** : tous les nouveaux paramètres doivent s'auto-sauvegarder

### Partager vos domaines personnels

Vous pouvez contribuer à la liste communautaire officielle en partageant les domaines que vous avez validés dans votre liste personnelle !

**Comment ça marche ?**

1. **Collecte automatique** : Allez dans l'onglet **Sources personnelles** ou **À propos**
2. **Collez l'URL du formulaire** : `https://docs.google.com/forms/d/e/1FAIpQLSce_bowurxHSWmiYqRa-QrTu2OEnHCdKFdx1AvqE0CqmHqxEg/viewform`
3. **Cliquez sur "Partager"** : l'extension envoie automatiquement vos domaines
4. **C'est terminé !** : merci pour votre contribution 🙏

**Ce qui est partagé :**
- ✅ Uniquement les domaines (ex: `login.example.com`)
- ✅ Filtrage automatique des domaines déjà dans la liste communautaire
- ✅ Filtrage automatique des domaines internes (.local, .lan, IPs privées)
- ✅ Aucune donnée personnelle, aucune métadonnée
- ✅ Contribution 100% anonyme

**Avantages :**
- 🌐 Aide la communauté à avoir une liste plus complète
- 🔒 Renforce la sécurité pour tous les utilisateurs
- ⚡ Partage en 1 clic, sans compte GitHub requis
- 📊 Historique local pour éviter les doublons

**Note :** L'extension garde un historique local des domaines déjà partagés pour éviter les ré-soumissions. Vous pouvez vider cet historique si besoin via le bouton "Vider historique partagé".

### Listes communautaires

Pour proposer une liste communautaire complète :
1. **Héberger votre liste** au format JSON (voir Format des listes)
2. **Ouvrir une issue** avec :
   - URL de votre liste
   - Description du périmètre (ex: "Services bancaires français")
   - Nombre de domaines
   - Fréquence de mise à jour
3. **Maintenir la liste** : commits réguliers, réponse aux issues

### Tests avant PR

- ✅ Tester sur Chrome, Edge et Firefox
- ✅ Vérifier les 3 modes de validation
- ✅ Tester import/export
- ✅ Vérifier auto-sauvegarde
- ✅ Tester avec listes entreprise/communautaire/personnelle
- ✅ Vérifier i18n FR et EN
- ✅ Pas d'erreurs dans la console

## 📝 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- Tous les contributeurs du projet
- La communauté de sécurité web
- Les organisations qui partagent leurs listes de domaines
- Les utilisateurs qui testent et remontent des bugs
- L'équipe de développement pour les nombreuses heures de travail

## 📈 Statistiques du projet

- **Lignes de code** : ~3000+ lignes (JS + HTML + CSS)
- **Fichiers i18n** : 809 clés de traduction par langue
- **Langues supportées** : Français, English
- **Modes de validation** : 3 (Badge, Mot-clé, Code aléatoire)
- **Types de listes** : 3 (Entreprise, Communautaire, Personnelle)
- **Navigateurs supportés** : Chrome 88+, Edge 88+, Firefox 89+
- **Manifest Version** : V3 (dernière version)

## 🔮 Roadmap

### Version 1.1 (à venir)
- [ ] Tests automatisés (Jest/Mocha)
- [ ] CI/CD avec GitHub Actions
- [ ] Support de plus de langues (DE, ES, IT)
- [ ] Mode sombre pour l'interface
- [ ] Statistiques d'utilisation (local)

### Version 1.2
- [ ] Synchronisation Chrome Sync (optionnelle)
- [ ] Export/Import des paramètres complets
- [ ] Thèmes de couleurs prédéfinis
- [ ] Widget de configuration rapide

### Version 2.0
- [ ] API pour intégration entreprise
- [ ] Dashboard d'administration
- [ ] Rapports de sécurité
- [ ] Support de certificats clients

## 📧 Contact

- **Projet** : [https://github.com/ZA512/ShieldSign](https://github.com/ZA512/ShieldSign)
- **Issues** : [https://github.com/ZA512/ShieldSign/issues](https://github.com/ZA512/ShieldSign/issues)
- **Discussions** : [https://github.com/ZA512/ShieldSign/discussions](https://github.com/ZA512/ShieldSign/discussions)

---

**Note de sécurité** : ShieldSign est un outil de validation visuelle et ne remplace pas les bonnes pratiques de sécurité. Restez vigilant, vérifiez toujours :
- ✅ L'URL complète dans la barre d'adresse
- ✅ Le certificat HTTPS (cadenas vert)
- ✅ Le badge/code ShieldSign (selon votre mode)
- ✅ L'absence de fautes d'orthographe dans l'URL

**ShieldSign vous protège, mais votre vigilance reste votre meilleure défense !** 🛡️

