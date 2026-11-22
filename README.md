# MultiView

**MultiView lets you watch your friends' OBS streams while gaming, using floating video windows displayed over your game.**

Connect to your friends' **OBS streams shared through MediaMTX**, detach each stream into a floating window, and watch everyone's point of view simultaneously without leaving your game.

MultiView is a Windows desktop application built with Electron, React, and TypeScript. It supports WebRTC streams through WHEP.

## ✨ Features

- **Multiple streams** — Watch several friends' views simultaneously.
- **Library and Live views** — Manage your streams in a compact library list, watch only the playing ones in the Live view, launch a selection in the Live view or directly as floating windows, with select-all, clear and availability refresh at hand.
- **Floating windows** — Keep individual streams visible over your game.
- **Always on top** — Keep detached streams above other windows, with a pin toggle when you need it off.
- **Audio controls** — Adjust or mute each stream individually, with a solo mode.
- **Automatic recovery** — Streams retry for up to 5 minutes after a network drop or an OBS restart, then return to the stopped state and keep checking availability.
- **Live statistics** - Bitrate, FPS, resolution, jitter and dropped frames per stream.
- **Import / export** - Back up your stream list or share it with a friend.
- **Flexible viewing** — Resize windows, preserve aspect ratios, or switch to fullscreen.
- **Stream management** — Add, rename, remove, and reattach streams; reorder them by dragging.
- **Manual playback** — Start streams whenever you're ready, individually or all at once.
- **Local storage** — Your saved stream sources stay on your computer.
- **Game-safe overlay** — Pinned floating windows become click-through as soon as another application (a game) has the focus, so the mouse and keyboard stay with the game. Bring MultiView back to the front to interact with them again.
- **Built-in updates** — An installed copy downloads new releases in the background and only applies them when you say so.

> **Note:** Some games running in exclusive fullscreen mode may appear above floating windows. This is a Windows limitation: no overlay can be drawn over exclusive fullscreen, whatever the privileges of the application. Borderless fullscreen is recommended. Some anti-cheat protected games (Valorant/Vanguard for instance) also block third-party overlays by design.

### Low latency tips

MultiView already requests the smallest possible playout buffer and only raises it when the measured jitter stays high. The current video buffer delay is shown in the **Statistics** panel. Most of the remaining latency comes from the encoder:

- **OBS, x264:** `tune=zerolatency`, B-frames `0`, keyframe interval `1 s`, `scenecut=0`, CBR.
- **OBS, NVENC:** low-latency preset, look-ahead off, B-frames `0`.
- **Audio:** Opus 48 kHz, 20 ms frames (10 ms if your server supports it), FEC enabled, DTX off.
- **Network:** avoid a TURN relay when the server is on the same network, it adds a round trip.

## Screenshots

![MultiView — multiple floating video streams](screenshots/multiview.png)

## 📥 Download

**[Download the latest release](https://github.com/Aeternoxx/MultiView/releases/latest)**

Download `MultiView-<version>-setup.exe`: it installs for your user only and needs no administrator rights. MultiView then keeps itself current — new releases download in the background and are installed only when you click the update pill in the footer.

## 🚀 Getting started

1. Make sure your friends are sharing their OBS streams through a compatible server, such as MediaMTX.
2. Open MultiView and add a stream using its WHEP URL.
3. Start playback.
4. Detach the stream into a floating window.
5. Repeat for each friend and enjoy watching everyone's view while you play!

Example WHEP endpoint:

`https://example.com/stream/whep`

The actual URL depends on the server configuration. The server must support WHEP and be reachable from your computer.

## 🛠️ Development

Requirements: Windows, [Node.js (LTS)](https://nodejs.org/) and npm.

```bash
git clone https://github.com/Aeternoxx/MultiView.git
cd MultiView
npm install
npm run dev
```

Useful commands:

| Command                | Description                           |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | Start the app with hot reload         |
| `npm run build`        | Type-check and build the app          |
| `npm test`             | Run the unit tests (Vitest)           |
| `npm run typecheck`    | Type-check main, preload and renderer |
| `npm run lint`         | Run ESLint                            |
| `npm run format:check` | Check formatting with Prettier        |
| `npm run build:win`    | Build the Windows installers          |

### Releasing

1. Bump `version` in `package.json`.
2. Write the notes as `docs/release-notes/v<version>.md` — copy `TEMPLATE.md`. That file is what the release page shows; GitHub generates nothing useful for a repository whose commits arrive without pull requests.
3. Commit as `Release v<version>: <summary>`, then push and tag:

   ```bash
   git push origin main
   git tag v<version>
   git push origin v<version>
   ```

The tag runs the Release workflow: it builds the installer, publishes it with its blockmap and `latest.yml`, and posts the notes. Older releases are trimmed automatically — only the three newest keep their assets, because installers are huge and GitHub expects a repository to stay near 1 GiB of release storage; the updater only reads the newest release anyway. The tags of trimmed releases stay, and installed copies of MultiView then see the new version within six hours, download it, and wait for one click to install it.

## 🔒 Privacy

Saved stream sources are stored locally. Stream URLs may contain private information or access tokens, so remove sensitive data before sharing logs, screenshots, or bug reports.

The stream list (and the STUN/TURN settings, if you fill them in) is stored in the app's local storage on your machine. TURN credentials are only written to the local configuration file and are never sent anywhere else than to your own TURN server.

## 🤝 Contributing

Bug reports, suggestions, and contributions are welcome. Please include your MultiView version, Windows version, reproduction steps, and relevant logs. Remove private URLs and credentials before posting.

## ☕ Support the project

If you find MultiView useful, you can help support its development with an optional donation.

**[☕ Support MultiView on Ko-fi](https://ko-fi.com/aeternoxx)**

## 📄 License

No license has been specified yet. Until one is added, the code should not be assumed to be available for unrestricted use, modification, or redistribution.

---

# MultiView (Français)

**MultiView permet d'afficher les flux OBS de tes amis dans des fenêtres flottantes par-dessus ton jeu.**

Connecte-toi aux **flux OBS de tes amis diffusés via MediaMTX**, détache chaque flux dans une fenêtre indépendante et regarde leurs différents points de vue simultanément, sans quitter ton jeu.

MultiView est une application Windows développée avec Electron, React et TypeScript. Elle prend en charge les flux WebRTC via WHEP.

## ✨ Fonctionnalités

- **Flux multiples** — Regarde simultanément les vues de plusieurs amis.
- **Vues Bibliothèque et Live** — Gère tes flux dans une liste compacte, regarde uniquement ceux en lecture dans la vue Live, lance une sélection en Live ou directement en vignettes flottantes, avec tout cocher, tout décocher et actualisation de la disponibilité sous la main.
- **Fenêtres flottantes** — Garde les flux visibles par-dessus ton jeu.
- **Toujours au premier plan** — Maintiens les fenêtres détachées au-dessus des autres applications, avec une épingle pour désactiver le mode si besoin.
- **Contrôle audio** — Règle ou coupe le son de chaque flux indépendamment, avec un mode solo.
- **Reconnexion automatique** — Les flux tentent de se reconnecter pendant 5 minutes après une coupure réseau ou un redémarrage d'OBS, puis reviennent à l'état arrêté en continuant à surveiller leur disponibilité.
- **Statistiques en direct** — Débit, images/s, résolution, gigue et images perdues pour chaque flux.
- **Import / export** — Sauvegarde ta liste de flux ou partage-la avec un ami.
- **Affichage flexible** — Redimensionne les fenêtres, conserve les proportions ou passe en plein écran.
- **Gestion des flux** — Ajoute, renomme, supprime et réintègre les flux ; réordonne-les par glisser-déposer.
- **Lecture manuelle** — Lance les flux quand tu le souhaites, individuellement ou tous à la fois.
- **Stockage local** — Les sources enregistrées restent sur ton ordinateur.
- **Overlay compatible jeu** — Les fenêtres flottantes épinglées deviennent transparentes aux clics dès qu'une autre application (un jeu) a le focus : la souris et le clavier restent au jeu. Ramène MultiView au premier plan pour les manipuler à nouveau.
- **Mises à jour intégrées** — Une copie installée télécharge les nouvelles versions en arrière-plan et ne les applique que sur ton feu vert.

> **À noter :** Certains jeux en plein écran exclusif peuvent passer devant les fenêtres flottantes. C'est une limite de Windows : aucun overlay ne peut être affiché par-dessus le plein écran exclusif, quels que soient les privilèges de l'application. Le mode plein écran sans bordure est recommandé. Certains jeux protégés par un anti-cheat (Valorant/Vanguard par exemple) bloquent aussi les overlays tiers par conception.

### Conseils faible latence

MultiView demande déjà le plus petit tampon de lecture possible et ne l'augmente que si la gigue mesurée reste élevée. La latence du tampon vidéo est affichée dans le panneau **Statistiques**. L'essentiel de la latence restante vient de l'encodeur :

- **OBS, x264 :** `tune=zerolatency`, B-frames `0`, intervalle d'images clés `1 s`, `scenecut=0`, CBR.
- **OBS, NVENC :** preset faible latence, look-ahead désactivé, B-frames `0`.
- **Audio :** Opus 48 kHz, trames de 20 ms (10 ms si ton serveur le permet), FEC activé, DTX désactivé.
- **Réseau :** évite le relais TURN quand le serveur est sur le même réseau, il ajoute un aller-retour.

## Screenshots

![MultiView — multiple floating video streams](screenshots/multiview.png)

## 📥 Téléchargement

**[Télécharger la dernière version](https://github.com/Aeternoxx/MultiView/releases/latest)**

Télécharge `MultiView-<version>-setup.exe` : il s'installe pour ton utilisateur uniquement et ne demande pas de droits administrateur. MultiView reste ensuite à jour tout seul : les nouvelles versions se téléchargent en arrière-plan et ne sont installées que quand tu cliques sur la pastille de mise à jour dans le pied de page.

## 🚀 Prise en main

1. Assure-toi que tes amis diffusent leurs flux OBS via un serveur compatible, comme MediaMTX.
2. Ouvre MultiView et ajoute un flux avec son URL WHEP.
3. Lance la lecture.
4. Détache le flux dans une fenêtre flottante.
5. Répète l'opération pour chaque ami et profite de leurs différents points de vue pendant que tu joues !

Exemple d'endpoint WHEP :

`https://example.com/stream/whep`

L'URL exacte dépend de la configuration du serveur. Celui-ci doit prendre en charge WHEP et être accessible depuis ton ordinateur.

## 🛠️ Développement

Prérequis : Windows, [Node.js (LTS)](https://nodejs.org/) et npm.

```bash
git clone https://github.com/Aeternoxx/MultiView.git
cd MultiView
npm install
npm run dev
```

Commandes utiles :

| Commande               | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Lance l'application avec rechargement à chaud        |
| `npm run build`        | Vérifie les types et compile l'application           |
| `npm test`             | Lance les tests unitaires (Vitest)                   |
| `npm run typecheck`    | Vérifie les types du main, du preload et du renderer |
| `npm run lint`         | Lance ESLint                                         |
| `npm run format:check` | Vérifie le formatage avec Prettier                   |
| `npm run build:win`    | Génère les installateurs Windows                     |

### Publier une version

1. Augmente `version` dans `package.json`.
2. Écris les notes dans `docs/release-notes/v<version>.md` — copie `TEMPLATE.md`. C'est ce fichier qui s'affiche sur la page de la release ; GitHub ne génère rien d'utile sur un dépôt dont les commits arrivent sans pull requests.
3. Committe en `Release v<version> : <résumé>`, puis pousse et tague :

   ```bash
   git push origin main
   git tag v<version>
   git push origin v<version>
   ```

Le tag déclenche le workflow Release : il compile l'installeur, le publie avec son blockmap et `latest.yml`, et dépose les notes. Les copies installées de MultiView voient alors la nouvelle version sous six heures, la téléchargent, puis attendent un clic pour l'installer.

## 🔒 Confidentialité

Les sources enregistrées sont stockées localement. Les URL des flux peuvent contenir des informations privées ou des jetons d'accès : pense à les retirer des journaux, captures d'écran et rapports de bugs que tu partages.

La liste des flux (ainsi que les paramètres STUN/TURN, si tu les renseignes) est stockée dans le stockage local de l'application, sur ta machine. Les identifiants TURN ne sont écrits que dans le fichier de configuration local et ne sont transmis qu'à ton propre serveur TURN.

## 🤝 Contributions

Les signalements de bugs, suggestions et contributions sont les bienvenus. Indique la version de MultiView, ta version de Windows, les étapes pour reproduire le problème et les journaux utiles. Retire les URL privées et les identifiants avant de publier.

## ☕ Soutenir le projet

Si MultiView te plaît, tu peux soutenir son développement avec un don facultatif.

**[☕ Soutenir MultiView sur Ko-fi](https://ko-fi.com/aeternoxx)**

## 📄 Licence

Aucune licence n'a encore été spécifiée. Tant qu'une licence n'est pas ajoutée, le code ne doit pas être considéré comme librement réutilisable, modifiable ou redistribuable.
