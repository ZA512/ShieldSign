# 🛡️ ShieldSign

Extension navigateur open-source de validation visuelle des pages de connexion sûres via listes blanches de domaines.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Licence](https://img.shields.io/badge/licence-MIT-green)
![Manifest](https://img.shields.io/badge/manifest-v3-orange)

## 📋 Table des matières

- [À propos](#à-propos)
- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Configuration](#configuration)
- [Format des listes](#format-des-listes)
- [Déploiement entreprise](#déploiement-entreprise)
- [Développement](#développement)
- [Contribution](#contribution)
- [Licence](#licence)

## 🎯 À propos

**ShieldSign** est une extension navigateur qui valide visuellement les pages de connexion légitimes en affichant un bandeau de confirmation lorsque le domaine figure dans une liste blanche de confiance.

### Principes de base

- ✅ **Validation positive uniquement** : affichage uniquement si le domaine est reconnu
- 🔒 **Aucune collecte de données** : tout est local, rien n'est transmis
- 🌐 **Sans backend** : fonctionnement 100% côté client
- 🏢 **Adapté aux entreprises** : support de listes entreprise déployables via politiques
- 🔄 **Listes communautaires** : support de listes publiques maintenues par la communauté

## ✨ Fonctionnalités

### Détection automatique
- Détecte les pages contenant un champ de mot de passe
- Fonctionne avec les applications web classiques et les SPA (Single Page Applications)

### Validation de domaines
- Vérification par correspondance exacte de domaine (pas de wildcard)
- Support de trois types de listes :
  - **Entreprise** (priorité 1) : liste unique configurée par l'organisation
  - **Personnelle** (priorité 2) : domaines ajoutés manuellement par l'utilisateur
  - **Communautaire** (priorité 3) : listes publiques partagées

### Affichage visuel
- Bandeau coloré en haut de la page validée
- Couleurs personnalisables selon le type de liste
- Design non intrusif et professionnel

### Gestion des listes
- Mise à jour automatique des listes distantes (TTL configurable)
- Support des en-têtes ETag pour optimiser les téléchargements
- Validation du schéma JSON des listes
- Interface de gestion intuitive

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
2. **Configurer vos sources de confiance** :
   - Cliquer sur l'icône ShieldSign
   - Aller dans "Paramètres"
   - Ajouter des listes communautaires ou une liste entreprise

3. **Ajouter des domaines personnels** (optionnel) :
   - Naviguer vers une page de connexion
   - Cliquer sur l'icône ShieldSign
   - Cliquer sur "Approuver ce domaine"

### Utilisation quotidienne

- **Validation automatique** : lorsque vous visitez une page de connexion validée, un bandeau s'affiche automatiquement
- **Vérification manuelle** : cliquez sur l'icône ShieldSign pour voir le statut de la page courante
- **Actualisation** : les listes sont mises à jour automatiquement selon le TTL configuré (par défaut : 24h)

## ⚙️ Configuration

### Interface des paramètres

Accessible via l'icône ShieldSign > ⚙️ Paramètres

#### Onglet Sources
- **Liste entreprise** : URL unique de la liste officielle de votre organisation
- **Listes communautaires** : URLs de listes publiques de confiance

#### Onglet Liste personnelle
- Gérer vos domaines de confiance personnels
- Ajouter/supprimer des domaines manuellement

#### Onglet Paramètres
- **Vérification du certificat CN** : active la vérification de correspondance du CN (Firefox uniquement)
- **Durée de cache** : fréquence de mise à jour des listes (1-168 heures)
- **Couleurs des bandeaux** : personnaliser les couleurs par type de liste

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

- ✅ Réduction du risque de phishing
- ✅ Sensibilisation des utilisateurs aux domaines légitimes
- ✅ Déploiement centralisé et transparent
- ✅ Aucune infrastructure backend requise
- ✅ Compatible avec les politiques de sécurité existantes

## 🛠️ Développement

### Structure du projet

```
ShieldSign/
├── manifest.json          # Déclaration de l'extension
├── background.js          # Service worker (gestion des listes)
├── content.js             # Script d'injection du bandeau
├── popup/                 # Interface popup
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/               # Page de paramètres
│   ├── options.html
│   ├── options.js
│   └── options.css
├── schemas/               # Schémas JSON
│   └── list.schema.json
├── icons/                 # Icônes de l'extension
└── docs/                  # Documentation
    ├── PRD.md
    └── DevBook.md
```

### Prérequis

- Node.js (optionnel, pour les tests)
- Navigateur moderne (Chrome 88+, Edge 88+, Firefox 89+)

### Tests

```bash
# Tests unitaires (à venir)
npm test

# Tests manuels
# Charger l'extension en mode développeur et tester sur :
# - Pages de connexion réelles
# - SPA (Single Page Applications)
# - Différents domaines
```

### Packaging

```bash
# Créer un ZIP pour distribution
zip -r ShieldSign.zip manifest.json *.js popup/ options/ schemas/ icons/
```

## 🤝 Contribution

Les contributions sont les bienvenues ! Consultez le [guide de contribution](CONTRIBUTING.md) pour plus de détails.

### Comment contribuer

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commiter les changements (`git commit -m 'Add AmazingFeature'`)
4. Pousser vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

### Listes communautaires

Pour proposer une liste communautaire :
1. Héberger votre liste au format JSON
2. Ouvrir une issue avec l'URL de votre liste
3. Fournir une description et le périmètre couvert

## 📝 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- Tous les contributeurs du projet
- La communauté de sécurité web
- Les organisations qui partagent leurs listes de domaines

## 📧 Contact

- **Projet** : [https://github.com/ZA512/ShieldSign](https://github.com/ZA512/ShieldSign)
- **Issues** : [https://github.com/ZA512/ShieldSign/issues](https://github.com/ZA512/ShieldSign/issues)

---

**Note** : ShieldSign est un outil de validation visuelle et ne remplace pas les bonnes pratiques de sécurité. Restez vigilant et vérifiez toujours l'URL complète dans la barre d'adresse.

ShieldSign est un projet en cours d'initialisation. Ce dépôt contiendra le code source, la documentation et les configurations nécessaires pour le développement d'une solution de signature/identification (nom provisoire).

Contenu du dépôt
- `docs/` : documentation produit (PRD, DevBook, ...)
- `README.md` : cette présentation

Prérequis
- Git
- Environnement de développement selon la stack choisie (Node.js / Python / .NET / autre)

Installation (exemple générique)

1. Cloner le dépôt :

```bash
git clone https://github.com/ZA512/ShieldSign.git
cd ShieldSign
```

2. Installer les dépendances (exemples selon stack) :

- Node.js (npm)

```bash
npm install
```

- Python (venv + pip)

```bash
python -m venv .venv
.
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Usage
- Ajouter ici les commandes pour lancer l'application, exécuter les tests, etc.

Exemple (Node.js) :

```bash
npm start
npm test
```

Contribution
- Fork le dépôt et crée une branche feature/bugfix
- Ouvre une Pull Request décrivant les changements
- Respecte le fichier `CONTRIBUTING.md` si présent

Licence
- Ajoute une licence (ex : MIT) si tu veux rendre le projet open-source. Je peux en ajouter une pour toi.

Structure recommandée
- `src/` : code source
- `tests/` : suites de tests
- `docs/` : documentation produit

Support
- Ouvre une issue sur GitHub pour signaler un bug ou proposer une fonctionnalité.

Contact
- Propriétaire: `ZA512` (GitHub)

Prochaines étapes suggérées
- Choisir la stack et ajouter les fichiers de configuration (`package.json`, `pyproject.toml`, `csproj`, ...)
- Ajouter une licence et un `CONTRIBUTING.md`
- Mettre en place CI (GitHub Actions) pour tests et lint

