# 📘 DevBook – ShieldSign

Version 1.1 – Aligné PRD et prêt implémentation IA autonome

---

## 1. 🎯 Introduction & Objectif
Extension navigateur (Chrome, Edge, Firefox) validant visuellement les pages de connexion sûres via listes blanches locales ou distantes (enterprise, personal, community). Aucune collecte ou transmission de données utilisateur. Affichage uniquement positif (bandeau ✅) si domaine explicitement approuvé. Mode "safe by default" : absence de validation => aucun élément injecté.

---

## 2. 📁 Structure du Projet
```
ShieldSign/
├── manifest.json
├── background.js        # Mise à jour listes, cache, priorités
├── content.js           # Détection champ password + injection bandeau
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── schemas/
│   └── list.schema.json # Schéma de validation des listes distantes/locales
├── tests/
│   └── ...              # Tests Jest/Mocha
└── README.md
```
Objectif : charge sans erreur sur chaque navigateur cible (MV3 pour Chromium). Firefox: adaptation minimale (service_worker non standard -> script de fond classique si nécessaire lors portage).

---

## 3. ⚙️ Manifest & Permissions
`manifest_version: 3` (Chromium). Permissions strictement minimales :
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
Déclarations clés :
- `background.service_worker` -> `background.js`
- `action.default_popup` -> `popup/popup.html`
- `content_scripts` -> `content.js` sur `<all_urls>`
Critères : pas de permissions supplémentaires non justifiées.

---

## 4. 🔍 Détection Pages de Connexion (`content.js`)
Logique déclenchée après `DOMContentLoaded` + surveillance de navigation dynamique (SPA) via `MutationObserver` rapide (détection ajout d'`input[type=password]`).
```js
const detectLogin = () => {
  const hasPassword = !!document.querySelector('input[type="password"]');
  if (!hasPassword) return;
  browser.runtime.sendMessage({ action: "CHECK_PAGE", hostname: window.location.hostname });
};
```
Garantie : une seule requête par hostname / changement effectif (utiliser drapeau `window.__ShieldSignChecked`). Observer: déconnexion propre (disconnect) si bandeau injecté et aucune mutation pertinente après N secondes.

---

## 5. ✅ Vérification Domaines & Priorités (`background.js`)
Réception message `CHECK_PAGE`. Chargement listes actives depuis `browser.storage.local`.
Règle stricte : match exact (pas de wildcard). Fonction :
```js
const isDomainMatch = (hostname, domain) => hostname === domain;
```
Priorités d'affichage si matches multiples : 1. enterprise 2. personal 3. community.
Message retour vers `content.js` :
```js
{ status: "VALIDATED", listName, type } // ou { status: "UNKNOWN" }
```
Si option CN active et CN ≠ hostname => statut interne additionnel `SUSPICIOUS` (ne modifie pas bandeau, icône orange).

---

## 6. 🧾 Schéma des Listes (`schemas/list.schema.json`)
Format JSON versionné (obligatoire) :
```json
{
  "schema_version": 1,
  "list_name": "Entreprise X - Intranet",
  "domains": ["entreprise-x.com", "auth.entreprise-x.net"],
  "maintainer": "secops@entreprise-x.com"
}
```
Contraintes :
- `schema_version`: entier > 0
- `list_name`: string non vide (< 128 chars)
- `domains`: tableau >=1, chaque entrée regex `^[a-z0-9.-]+\.[a-z]{2,}$`
- `maintainer`: string email ou identifiant responsable
Rejet si : taille totale > limite définie (ex: 1000 domaines) ou champ manquant.
Extensibilité future : nouveaux champs ignorés si non critiques (forward compatibility).

---

## 7. 🔄 Mise à Jour & Cache
Stockage local structure :
```js
{
  lists: {
    "https://github.com/x/list.json": { etag: "...", lastFetch: 0, data: {...}, localType: "community" },
    "https://entreprise-x.net/ShieldSign-list.json": { etag: "...", lastFetch: 0, data: {...}, localType: "enterprise" }
  },
  user_whitelist: ["intranet.societe.fr"],
  settings: {
    checkCN: true,
    ttl: 86400,
    trainingMode: false,
    bannerColors: { enterprise: "#2ECC71", community: "#3498DB", personal: "#9B59B6" }
  }
}
```
Processus `updateLists()` :
1. Pour chaque URL si `Date.now() - lastFetch > ttl` → `fetch(url, { headers: { "If-None-Match": etag } })`.
2. Codes : 200 => remplace `data`, met à jour `etag` & `lastFetch`; 304 => conserve.
3. Gestion erreurs réseau : 1 retry après délai (ex: 5s) puis abandon silencieux (aucune validation supprimée).
4. Optionnel (à confirmer) : purge listes inactives (>30 jours sans usage) – NE PAS activer tant que non validé.

---

## 8. 🔒 Vérification Certificat CN (Optionnelle)
Activée si `settings.checkCN === true`.
- Firefox : `browser.webRequest.getSecurityInfo` disponible → comparer `securityInfo.cert.subject.commonName` au `hostname`.
- Chromium : API détaillée CN limitée; fallback possible (section à revoir si indisponible) → si impossible, ne pas marquer SUSPICIOUS.
Résultat : si CN ≠ hostname => icône orange + log console (`[ShieldSign] CN mismatch: expected ${hostname}, got ${cn}`). Aucun blocage ni bandeau altéré.

---

## 9. 🎛 Interface Utilisateur
### Popup
Affiche : statut page, source de validation (listName + type), bouton "Approuver ce sous-domaine + domaine" si `status === UNKNOWN` & champ password présent, listes sources actives.
Couleurs statut (icône + zone):
| Statut | Couleur | Tooltip |
|--------|---------|---------|
| Validée | Vert | "Page validée par X" |
| CN suspect | Orange | "CN ≠ domaine" |
| Non validée | Bleu clair | "Page non validée" |
| Pas de login | Gris | "Aucune page de connexion détectée" |

### Icône Barre
Mise à jour via message background -> popup ou API runtime.
Mapping interne: `iconState` parmi `none|validated|suspicious|unknown`.
Fichiers icône (prévoir variantes) ou badge coloré CSS dans popup.

### Options
Onglet Sources : ajout/suppression URLs + champ unique liste enterprise (validation unicité). 
Onglet Paramètres : toggle `checkCN`, champ numérique TTL (par défaut 86400), personnalisation couleurs bandeau (`bannerColors`), mode `trainingMode` (si futur usage sélection assistée; non implémenté fonctionnellement pour l’instant). 
Onglet À propos : version, lien GitHub, licence MIT, maintainer(s).

---

## 10. 👥 Gestion des Listes (Enterprise & Personnelle)
### Liste Enterprise
- Une seule source avec `localType: "enterprise"`.
- Tentative ajout seconde => message : "Une seule liste entreprise peut être configurée.".
### Liste Personnelle
- `user_whitelist`: domaines exacts + sous-domaines.
- Ajout manuel (champ texte + validation regex) ou rapide depuis popup (page login non validée → bouton d’approbation).
- Suppression immédiate reflétée en mémoire + storage.
Validation commune : lors de vérification domaine, fusionner `user_whitelist` dans espace type `personal`.

---

## 11. 🛡 Sécurité & Sanitation
- Jamais d’exécution de code externe : données de liste traitées comme texte.
- Affichage `listName` via `textContent` (pas `innerHTML`).
- Taille liste maximale configurable (ex: 1000 domaines) pour éviter surcharge storage.
- Aucune wildcard/regex côté utilisateur (réduit vecteurs abus).
- Pas de collecte d’URL historique : uniquement hostname courant.
- Mode "safe" : si erreur parsing liste => ignorer cette source sans affecter les autres.

---

## 12. 🔬 Tests Unitaires
| Scénario | Attendu |
|----------|---------|
| Page sans champ password | Aucun message / aucune injection |
| Domaine exact dans liste | Bandeau affiché + couleur type |
| Domaine non listé | Pas de bandeau |
| CN ≠ hostname (option active) | Icône orange + log console |
| Ajout domaine perso | Domaine immédiatement validable |
| Suppression domaine perso | Validation cesse |
| TTL expiré | Fetch relancé respectant ETag |
| Multi-match listes | Priorité enterprise > personal > community |
| Liste corrompue | Ignorée sans crash |

Couverture supplémentaire future (optionnel) : MutationObserver (non requis maintenant).

---

## 13. 📦 Packaging & Performance
- Poids total < 2 Mo.
- Zipper :
```bash
zip -r ShieldSign.zip manifest.json *.js popup/ options/ schemas/
```
- Vérification installation : Chromium (`chrome://extensions`), Firefox (`about:debugging#/runtime/this-firefox`).
- Aucune dépendance CDN / librairie lourde.

---

## 14. 🧬 Style de Développement – "Vibe Coding"
- Modules courts, fonctions pures.
- Nommage explicite (`isDomainMatch`, `updateLists`, `injectBanner`).
- Commentaires ciblés (raison, non trivialité).
- Pas d’import externe inutile.
- Commits atomiques : chaque fonctionnalité testable seule.
- Si rien n’est validé → rien n’est affiché (principe de moindre surprise).

---

## 15. ✅ Checklist Implémentation Minimale
1. Manifest MV3 créé.
2. Détection password + verrou d’exécution.
3. Stockage listes + schéma JSON validé.
4. Priorités multi-match OK.
5. Injection bandeau avec couleurs configurables.
6. Icône statut + tooltips.
7. Ajout / suppression domaines perso.
8. Mise à jour listes ETag + TTL.
9. (Option) Vérification CN Firefox.
10. Tests unitaires scénarios critiques verts.

---

## 16. ❓ Points en Attente de Validation
- Activation ou non de purge listes >30 jours (actuellement désactivée).
- Utilisation future de `trainingMode` (placeholder).
- Limite exacte taille liste (proposition: 1000 domaines, ajustable).

---

Fin version 1.1 – prête pour implémentation.


