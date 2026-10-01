# SANA — Site vitrine

Site vitrine de la société **SANA** : vente de **poulets**, d'**œufs** et d'**aliments pour volailles fabriqués selon la composition demandée par le client**.

## Contenu
- **Accueil / À propos** : présentation de la société.
- **Produits** : poulets (poussins, chair, prêts à cuire, fermiers), œufs, aliments.
- **Composition sur mesure** : le client choisit une formule de base (démarrage, croissance, finition, pondeuse, fermier), ajuste chaque ingrédient (maïs, soja, son, orge, huile, calcaire, phosphate, CMV, sel) et voit en temps réel le total (100 %) et les valeurs estimées (protéines, énergie, calcium, phosphore, cellulose).
- **Commande** : formulaire envoyé directement sur **WhatsApp** ou par **e-mail**, pré-rempli avec la formule composée.

## Lancer le site
Site statique, sans dépendances : ouvrir `index.html` dans un navigateur, ou :
```bash
npx serve .
```

## Personnalisation
- Numéro WhatsApp et e-mail : `CONTACT` en haut de `assets/js/main.js`.
- Adresse, téléphone, horaires : section `#contact` de `index.html`.
- Ingrédients, valeurs nutritionnelles et formules de base : `INGREDIENTS` et `PRESETS` dans `assets/js/main.js`.
