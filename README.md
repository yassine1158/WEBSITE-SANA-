# SANA — Site vitrine

Site vitrine de **SANA — Société Afriqaine de Nutrition Animale** : aliments composés pour tous les animaux (volailles, bovins, ovins & caprins, porcins, lapins, poissons), **poulets** (poussins, élevage, abattage) et **œufs frais**.

## Contenu du site
- **La société** : présentation.
- **Poulets** : offres selon l'usage — poussins d'un jour, poulets pour l'élevage, poulets pour l'abattage.
- **Œufs & aliments**.
- **Aliment sur mesure** : le client choisit l'espèce, le type d'aliment (stade), la présentation, la quantité et la fréquence, puis envoie sa demande. **Aucune formule n'est affichée ni enregistrée sur le site** : SANA établit la formule et l'envoie avec le devis.
- **Commande** : formulaire envoyé sur **WhatsApp** ou par **e-mail**, pré-rempli avec la demande d'aliment.

## Administration (`admin.html`)
Tout le contenu est dans `data/content.js`. La page `admin.html` (lien « Administration » en bas du site) permet de tout modifier sans toucher au code :
coordonnées, textes d'accueil, offres de poulets (ajout, masquage, ordre, prix), œufs, aliments, espèces et types d'aliment (stades).

1. Les modifications sont enregistrées automatiquement **sur votre appareil** (brouillon).
2. **Aperçu du site** : affiche le site avec le brouillon (visible uniquement sur votre appareil).
3. **Publier** : envoie le contenu sur GitHub ; le site est à jour en une à deux minutes.

### Mot de passe
L'administration est protégée par un **mot de passe**. À la première ouverture sur un appareil :
1. choisissez un mot de passe (8 caractères minimum) ;
2. collez votre jeton GitHub (voir ci-dessous).

Le jeton est enregistré **chiffré** par le mot de passe (AES-GCM, clé dérivée PBKDF2) dans le navigateur de cet appareil ; il n'est jamais stocké en clair ni envoyé ailleurs qu'à GitHub. Ensuite, le mot de passe suffit. Bouton **Verrouiller** en haut, verrouillage automatique après 30 minutes d'inactivité. Le mot de passe se change dans l'onglet **Publication**.

**Mot de passe oublié ?** Cliquez sur « Mot de passe oublié ? » sur l'écran de connexion : l'accès de cet appareil est effacé (le brouillon est conservé), puis recréez-le avec un nouveau mot de passe et votre jeton.

Sur un autre appareil (téléphone, autre ordinateur), créez l'accès de la même façon. Sans le jeton, personne ne peut publier, même en ouvrant `admin.html`.

### Jeton GitHub
*GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*, accès limité au dépôt `WEBSITE-SANA-`, permission **Contents : Read and write**. Si le jeton est perdu ou volé, supprimez-le sur GitHub et créez-en un nouveau.

## Marketing
Onglet **Marketing** de l'administration :
- **Bandeau promotionnel** en haut du site (message + lien), activable à tout moment.
- **Bandeau d'appel WhatsApp** (titre, texte, bouton).
- **Réseaux sociaux** : Facebook, Instagram, TikTok, YouTube (icônes affichées seulement si renseignées).
- **Mesure d'audience** : Google Analytics 4 et Pixel Meta. Événements envoyés : `whatsapp_click`, `generate_lead` (*Lead* côté Meta), `feed_request`.
- **Référencement** : titre et description Google, adresse du site.
- **Liens de campagne** : générateur de liens `?utm_source=…&utm_campaign=…`. La campagne d'origine est ajoutée automatiquement aux messages WhatsApp et e-mail reçus.

Onglet **Avis & FAQ** : avis clients (section masquée tant qu'il n'y en a pas) et questions fréquentes.

Fichiers fixes pour Google et les réseaux : `robots.txt`, `sitemap.xml`, `assets/img/og-image.png` (image de partage).
Si vous passez sur votre propre nom de domaine, remplacez `https://yassine1158.github.io/WEBSITE-SANA-/` dans `index.html` (balises `og:` et `canonical`), `robots.txt` et `sitemap.xml`.

## Mise en ligne (GitHub Pages)
*Settings → Pages* → branche `main`, dossier `/ (root)`. L'administration publie sur la branche `main` (modifiable dans l'onglet Publication).

## Lancer en local
Site statique, sans dépendances : ouvrir `index.html`, ou `npx serve .`

## Logo
Fichiers dans `assets/img/` (extraits du logo officiel en PDF) :
- `logo-sana.svg` / `logo-sana.png` : logo couleur.
- `logo-sana-white.svg` : version blanche pour fond vert.
- `emblem-sana.svg` : emblème seul (favicon, filigrane).
