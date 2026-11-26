# Page de présentation — MultiView

Page vitrine statique pour [MultiView](https://github.com/Aeternoxx/Multiview) :
aucune dépendance, aucun build, aucun framework. Trois fichiers et deux images.

```
multiview-site/
├── index.html              contenu, structure sémantique, maquette overlay
├── README.md
└── assets/
    ├── css/style.css       design system (@layer, couleurs oklab, fluide)
    ├── js/app.js           interactions en vanilla JS
    └── img/
        ├── icon.png        icône officielle (récupérée du dépôt)
        └── screenshot.png  capture officielle v1.3.3 (récupérée du dépôt)
```

## Aperçu local

N'importe quel serveur statique suffit (le compteur d'étoiles GitHub appelle l'API,
il a besoin d'une origine http) :

```powershell
python -m http.server 8123 --directory multiview-site
# http://localhost:8123
```

En ouvrant `index.html` en `file:` la page fonctionne aussi : seul le compteur
d'étoiles peut rester à sa valeur par défaut.

## Publier sur GitHub Pages

1. Pousser le dossier `multiview-site/` sur une branche (par exemple `gh-pages`,
   ou le dossier `docs/` de la branche `main`).
2. Dépôt → *Settings* → *Pages* → source **Deploy from a branch**, dossier `/docs`
   (ou `/(root)` sur `gh-pages`).
3. Le fichier est statique : aucun `npm install`, aucune action nécessaire.

## Ce qui est interactif

| Élément | Comportement |
| --- | --- |
| Maquette du hero | trois fenêtres de flux : épingler, couper le son, solo, plein écran, retour à la grille ; bouton « simuler le focus du jeu » qui rend les fenêtres épinglées transparentes aux clics (via `:has()`), statistiques animées |
| Compteurs d'étoiles et de version | lus en direct sur `https://api.github.com/repos/Aeternoxx/Multiview` |
| Onglets « faible latence » | `role="tablist"` navigable au clavier (flèches) |
| FAQ | un seul volet ouvert à la fois |
| Capture | visionneuse plein écran (`Esc` pour fermer) |
| Boutons copier | `navigator.clipboard` avec repli `execCommand` |
| Thème sombre / clair | mémorisé dans `localStorage`, résolu avant le premier rendu |

## Accessibilité & contraintes

- Lighthouse : accessibilité, bonnes pratiques et SEO à 100.
- `prefers-reduced-motion` : animations et transitions neutralisées.
- Toute l'interface est pilotable au clavier, avec lien d'évitement et libellés explicites.
- Le bandeau d'avertissement sur le plein écran exclusif et les anti-cheats reprend
  les limites décrites dans le README du dépôt : elles ne sont pas contournables.

## Version et installeur : ce qui suit le dépôt tout seul

La page interroge l'API GitHub à chaque visite (`/releases/latest` + le dépôt).
Sont réécrits automatiquement, sans toucher au code à la publication d'une release :

| Information | Élément |
| --- | --- |
| Numéro de version | badge d'en-tête `#chip-version`, bouton du hero `#hero-ver` |
| Date de la release | `#kv-release` |
| Nom et taille de l'installeur | `#kv-size`, `#cta-file`, `#cta-size`, `#fact-size` |
| Lien de téléchargement direct | `#btn-dl` (URL de l'asset de la dernière release) |
| Compteur d'étoiles | `#star-count` |

Si l'API est indisponible (hors ligne, bloqueur, quota 60 requêtes/heure/IP), le texte
écrit dans `index.html` reste affiché : c'est le repli, à garder juste au moment de la
publication. Le chercher avec `1.3.3` dans `index.html`.

Le bouton du hero pointe en dur vers `…/releases/latest` : il ne peut pas casser.
Celui du bas de page ne pointe vers l'asset précis que grâce au JavaScript.

## Publication : où vit la page

La page est publiée sur la branche orpheline `gh-pages`, à sa racine :

```
gh-pages (aucun lien avec main)
├── index.html
├── assets/css/style.css
├── assets/js/app.js
└── assets/img/{screenshot.png, icon.png}
```

Source Pages : branche `gh-pages`, dossier `/` — https://aeternoxx.github.io/Multiview/.

Pages ne sait servir que la racine d'une branche ou `/docs` : `/docs/site` n'est pas
proposable, d'où la branche séparée. `main` garde seulement les exclusions prettier et
eslint, et `docs/` reste réservé aux notes de version.

Pour mettre à jour la page après une modification locale :

```
Copy-Item -Recurse -Force multiview-site\index.html, multiview-site\assets <clone>\
git add -A && git commit -m "…" && git push origin HEAD:gh-pages
```

Pages sert des fichiers statiques : il n'exécute rien et ne compile rien, la page visible
est exactement ce qui a été poussé. Le déploiement prend 20 à 60 s, et le CDN garde les
anciens fichiers quelques minutes (`Ctrl`+`Shift`+`R` pour forcer).
Aucune action ni dépendance : l'appel à l'API GitHub part du navigateur du visiteur,
donc de son IP — le quota n'est pas partagé entre les visiteurs.
