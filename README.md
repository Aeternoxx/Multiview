# MultiView

Version mise à jour :
- Les flux WHEP ne démarrent plus automatiquement au lancement de l'application.
- Un voyant vert/rouge indique si le point de terminaison WHEP répond à une requête OPTIONS.
- Chaque flux peut être démarré ou arrêté indépendamment.
- Contrôle de volume et bouton muet disponibles au survol du lecteur.
- Les tuiles suivent le ratio vidéo détecté et conservent ce ratio pendant le redimensionnement manuel.
- Les fenêtres Windows détachées sont sans bordure, affichent la vidéo, proposent les contrôles audio au survol et un bouton de retour dans MultiView.
- Le flux détaché est remplacé dans la grille par une carte indiquant qu'il est dans une fenêtre flottante. Le retour ferme la fenêtre détachée et remet le flux à l'état arrêté dans l'application.
- Les fenêtres détachées adaptent leur ratio à celui de la vidéo détectée.

## Lancement en développement

```powershell
npm install
npm run dev
```

## Compilation

```powershell
npm run build
```

Note : la disponibilité est estimée par une requête HTTP OPTIONS sur l'URL WHEP. Certains serveurs peuvent bloquer OPTIONS ou les requêtes cross-origin ; dans ce cas, le voyant peut afficher rouge même si le lecteur fonctionne dans un navigateur. Le bouton de lancement reste disponible pour essayer le flux manuellement.
