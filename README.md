# 🚀 SaaS Toolkit Marketing

Suite d’outils statiques en HTML, CSS et JavaScript pour explorer trois sujets clés d’une activité SaaS :

- 📊 benchmark concurrentiel
- 💸 simulation de pricing freemium
- 📈 calcul du ROI publicitaire

## ✨ Ce qui a été mis en place

- `index.html` est maintenant l’unique page HTML du projet
- les 3 outils sont intégrés dans cette page via des onglets internes
- le CSS et le JavaScript restent externalisés dans `assets/css` et `assets/js`
- un favicon SVG commun est appliqué au projet
- chaque outil conserve son historique via `localStorage`

## 🧭 Accès

- `index.html` : page unique contenant les 3 outils

## 🗂️ Structure

```text
.
├── index.html
├── README.md
└── assets
    ├── favicon.svg
    ├── css
    │   ├── common.css
    │   ├── index.css
    │   ├── benchmark-concurrentiel.css
    │   ├── pricing-freemium.css
    │   └── roi-publicitaire.css
    └── js
        ├── shared-layout.js
        ├── index.js
        ├── benchmark-concurrentiel.js
        ├── pricing-freemium.js
        └── roi-publicitaire.js
```

## ▶️ Utilisation

1. Ouvrir `index.html` dans un navigateur.
2. Passer d’un outil à l’autre avec les onglets.
3. Utiliser les exports CSV et les snapshots directement dans la page.

## 🛠️ Notes techniques

- aucune dépendance de build n’est nécessaire
- les exports CSV sont générés côté navigateur
- les données sauvegardées restent locales au navigateur utilisé
