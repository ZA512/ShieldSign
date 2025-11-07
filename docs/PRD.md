Parfait 😎  
Tu veux un **PRD (Product Requirements Document)** complet, mais rédigé **pour une IA développeuse** (donc sans implicite humain, ni interprétation floue).  
Je vais te livrer un **PRD IA-ready**, structuré, explicite, cohérent avec ton projet d’extension **“ShieldSign”**, et orienté _vibe coding_ (autonomie + créativité contrôlée).

---

# 🧠 **PRD — ShieldSign**

_(Version 1.0 – pour implémentation par IA autonome)_

---

## 1. 🎯 Objectif produit

Créer une **extension navigateur open-source, gratuite et sans backend** qui **valide visuellement les pages de connexion sûres** en se basant sur des **listes blanches de domaines** (whitelists), locales ou distantes.

Le produit doit **afficher une indication positive claire** (“✅ Page validée par …”) **uniquement** si la page visitée est reconnue comme légitime.  
Aucune alerte négative, aucun traitement heuristique visuel, et aucune collecte de données utilisateur.

---

## 2. 💡 Concept fonctionnel

### Description synthétique :

> “ShieldSign” détecte les pages de connexion contenant un champ `password`, vérifie si leur domaine figure dans une ou plusieurs listes de confiance, puis affiche une validation visuelle si c’est le cas.

### Positionnement :

- Extension **de confiance et éducative**, pas d’analyse comportementale.
    
- **Indépendante** (pas de serveur central).
    
- **Extensible** (listes publiques, privées, communautaires, entreprise).
    
- **Compatible multi-navigateur** (Chrome, Edge, Firefox).
    

---

## 3. ⚙️ Fonctionnalités principales

### 3.1 Détection des pages de connexion

- Sur chaque chargement de page :
    
    - scanner le DOM à la recherche d’un élément `input[type=password]`.
        
    - si trouvé → déclencher le module de vérification.
        
    - si aucun champ `password` → ne rien faire.
        

### 3.2 Vérification de domaine

- Extraire `window.location.hostname`.
    
- Comparer ce `hostname` à toutes les **listes actives** :
    
    - Liste(s) communautaire(s) (type: `community`)
        
    - Liste d’entreprise (type: `enterprise`, unique)
        
    - Liste personnelle (type: `personal`)
        
- Si correspondance exacte sous-domaine + domaine, pas de wildcard possible :
    
    - statut `VALIDATED`.
        
- Sinon :
    
    - statut `UNKNOWN` (aucune action).
        

### 3.3 Affichage visuel

- Si `VALIDATED` :
    
    - injecter un bandeau DOM non intrusif, position fixe (haut de la page, 100 % largeur, z-index élevé).
        
    - texte :  
        `✅ Page validée par : <nom de la liste prioritaire>`
        
    - couleur selon la source (paramétrable dans l'extension) :
        
        - 🟢 **Entreprise** : vert foncé (#2ECC71)
            
        - 🔵 **Communautaire** : bleu (#3498DB)
            
        - 🟣 **Personnelle** : violet (#9B59B6)
            
- Si `UNKNOWN` :
    
    - ne rien injecter, ne rien afficher.
        

### 3.4 Priorité des listes

- Ordre d’évaluation :
    
    1. **Enterprise** (type=enterprise)
        
    2. **Personal**
        
    3. **Community**
        
- Si plusieurs listes matchent le domaine :
    
    - afficher celle de priorité la plus haute.
        

### 3.5 Gestion des listes

#### a. Format des listes

Format JSON obligatoire, versionné :

```json
{
  "schema_version": 1,
  "list_name": "Entreprise X - Intranet",
  "domains": [
    "entreprise-x.com",
    "auth.entreprise-x.net"
  ],
  "maintainer": "secops@entreprise-x.com"
}
```

#### b. Sources de listes

- L’utilisateur peut ajouter plusieurs URLs (via l’UI de l’extension).
    
- L’extension télécharge les listes via `fetch()` toutes les 24h (TTL configurable).
    
- Les listes sont stockées et mises en cache local (`browser.storage.local`).
    
- L’entreprise peut **pré-configurer** une URL via les politiques du navigateur (`chrome.storage.managed`).
    
#### c. Liste entreprise
- il n'est possible de déclarer qu'une liste entreprise.
- donc il a un champ de saisie pour l'import spécifique
- elle est géré comme les autres listes, c'est juste qu'elle a un tag différent utile pour l'ordre de validation qui sera propre à chaque entreprise
#### d. Liste personnelle

- En local uniquement.
    
- L’utilisateur peut :
    
    - ajouter un domaine manuellement via l’UI (domaine et sous domaine);
    - il est aussi possible de voir tous les sous domaines et domaines saisie pour modification et suppression
        
    - ou approuver un sous-domaine + domaine lorsqu’un `password` est détecté mais non listé.
        
- Format identique, type=`personal`.
    

---

## 4. 🔒 Fonctions optionnelles

### 4.1 Vérification du certificat (CN)

- Option activable dans les paramètres.
    
- Lorsqu’activée :
    
    - obtenir les infos TLS du site (si API disponible).
        
    - comparer CN (Common Name) du certificat au `hostname`.
        
    - si `CN != hostname` → marquer statut `SUSPICIOUS` (sans bandeau, juste en console + badge orange).
        
- Non bloquant, purement informatif.
    
    

---

## 5. 🧰 Interface utilisateur

### 5.1 Popup principale (UI de l’extension)

- Affiche :
    
    - Statut actuel de la page (Validée / Non validée / Pas de champ mot de passe)
        
    - Source de validation (“Entreprise X”, “Liste publique”, “Liste personnelle”)
        
    - Bouton : “Approuver ce sous-domaine + domaine”
        
    - Liste des sources actives
        
- Onglets :
    
    - **Sources** (ajouter / supprimer URLs)
        
    - **Paramètres** (vérification CN, couleur bandeau, TTL)
        
    - **À propos** (lien GitHub, version, contributeurs)
        

### 5.2 Icône de la barre

|État|Couleur|Tooltip|
|---|---|---|
|Aucune détection|Gris|“Aucune page de connexion détectée”|
|Page validée|Vert|“Page validée par X”|
|CN suspect|Orange|“CN ≠ domaine”|
|Page inconnue|Bleu clair|“Page non validée”|

---

## 6. 🧩 Comportement technique

### 6.1 Côté extension

- Manifest v3 (pour Chromium)
    
- `background.js` :
    
    - gère le cache, la mise à jour et le téléchargement des listes
        
- `content.js` :
    
    - détecte les champs de mot de passe
        
    - effectue les comparaisons de domaines
        
    - injecte le bandeau DOM
        
- `popup.js` :
    
    - UI utilisateur, gestion manuelle des domaines et listes
        
- `options.js` :
    
    - paramètres persistés (`browser.storage.local`)
        

### 6.2 Permissions minimales

```json
"permissions": [
  "storage",
  "activeTab",
  "declarativeNetRequest",
  "webRequest",
  "webRequestBlocking"
],
"host_permissions": ["<all_urls>"]
```

---

## 7. 🧩 Règles de comparaison de domaine

### Fonction : `isDomainMatch(hostname, domain)`

- Retourne `true` si :
    
    - `hostname === sous-domaine + domaine`
        

### Exemple :

| Hostname                    | Domaine liste               | Résultat |
| --------------------------- | --------------------------- | -------- |
| `auth.microsoftonline.com`  | `microsoftonline.com`       | ❌        |
| `login.microsoftonline.com` | `microsoft.com`             | ❌        |
| `intranet.societe.fr`       | `intranet.societe.fr`       | ✅        |
| `login.microsoftonline.com` | `login.microsoftonline.com` | ✅        |

---

## 8. 🔄 Mise à jour & stockage

- TTL de rafraîchissement : 24h (configurable).
    
- Stockage :
    
    ```js
    {
      "lists": {
        "https://github.com/x/list.json": { "etag": "...", "lastFetch": "...", "data": {...} },
        "https://entreprise-x.net/ShieldSign-list.json": {...}
      },
      "user_whitelist": ["societe.fr", "intranet.societe.fr"],
      "settings": { "checkCN": true, "trainingMode": false }
    }
    ```
    

---

## 9. ⚖️ Contraintes

- Pas de collecte ni d’envoi de données utilisateurs.
    
- Pas d’appel API externe autre que les URLs de listes configurées.
    
- Pas d’analyse heuristique du contenu visuel ou textuel.
    
- Pas de tracking ni de télémétrie.
    
- L’IA doit garantir un **poids minimal** (<2 Mo) et **aucune dépendance externe inutile**.
    

---

## 10. 🧪 Tests unitaires et validation

### Tests à implémenter :

| Test                                    | Attendu               |
| --------------------------------------- | --------------------- |
| Détection champ `password`              | OK                    |
| Sous-domaine + Domaine exact dans liste | ✅ bandeau vert        |
| Domaine non listé                       | pas de bandeau        |
| CN ≠ hostname (option on)               | log + badge orange    |
| Ajout domaine perso                     | ajout persistant      |
| Supprimer domaine perso                 | suppression effective |
| Expiration TTL                          | rechargement liste    |
| Double correspondance (2 listes)        | priorité respectée    |

---

## 11. 🧭 Livrables attendus

|Fichier|Description|
|---|---|
|`manifest.json`|Déclaration extension|
|`background.js`|Gestion du cache + listes|
|`content.js`|Détection / injection DOM|
|`popup.html/js/css`|UI utilisateur|
|`options.html/js/css`|Page d’options|
|`schemas/list.schema.json`|Schéma JSON de liste|
|`README.md`|Documentation|
|`tests/`|Scripts de tests unitaires|

---

## 12. 🧬 Style de développement “vibe coding”

- Code propre, clair, commenté.
    
- Modularité forte (pas de spaghetti code).
    
- Petites fonctions pures, faciles à relire.
    
- Logique explicite, jamais implicite.
    
- Pas de dépendance réseau ou cloud non déclarée.
    
- Toujours un **mode “safe by default”** :
    
    - rien ne s’affiche = rien n’est validé.
        
- Chaque commit doit être exécutable isolément.
    
