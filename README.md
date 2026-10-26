# MultiView

**MultiView lets you watch your friends' OBS streams while gaming, using floating video windows displayed over your game.**

Connect to your friends' **OBS streams shared through MediaMTX**, detach each stream into a floating window, and watch everyone's point of view simultaneously without leaving your game.

MultiView is a Windows desktop application built with Electron, React, and TypeScript. It supports WebRTC streams through WHEP.

## ✨ Features

- **Multiple streams** — Watch several friends' views simultaneously.
- **Floating windows** — Keep individual streams visible over your game.
- **Always on top** — Keep detached streams above other windows.
- **Audio controls** — Adjust or mute each stream individually.
- **Flexible viewing** — Resize windows, preserve aspect ratios, or switch to fullscreen.
- **Stream management** — Add, rename, remove, and reattach streams.
- **Manual playback** — Start streams whenever you're ready.
- **Local storage** — Your saved stream sources stay on your computer.

> **Note:** Some games running in exclusive fullscreen mode may appear above floating windows. Borderless fullscreen is recommended.

## 📥 Download

**[Download the latest release](https://github.com/Aeternoxx/MultiView/releases/latest)**

Choose the Windows installer or the portable version, if available in the release.

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

Build commands are defined in `package.json`.

## 🔒 Privacy

Saved stream sources are stored locally. Stream URLs may contain private information or access tokens, so remove sensitive data before sharing logs, screenshots, or bug reports.

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
- **Fenêtres flottantes** — Garde les flux visibles par-dessus ton jeu.
- **Toujours au premier plan** — Maintiens les fenêtres au-dessus des autres applications.
- **Contrôle audio** — Règle ou coupe le son de chaque flux indépendamment.
- **Affichage flexible** — Redimensionne les fenêtres, conserve les proportions ou passe en plein écran.
- **Gestion des flux** — Ajoute, renomme, supprime et réintègre les flux dans la fenêtre principale.
- **Lecture manuelle** — Lance les flux quand tu le souhaites.
- **Stockage local** — Les sources enregistrées restent sur ton ordinateur.

> **À noter :** Certains jeux en plein écran exclusif peuvent passer devant les fenêtres flottantes. Le mode plein écran sans bordure est recommandé.

## 📥 Téléchargement

**[Télécharger la dernière version](https://github.com/Aeternoxx/MultiView/releases/latest)**

Choisis l'installateur Windows ou la version portable, si elle est disponible dans la release.

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

Les commandes de compilation sont définies dans `package.json`.

## 🔒 Confidentialité

Les sources enregistrées sont stockées localement. Les URL des flux peuvent contenir des informations privées ou des jetons d'accès : pense à les retirer des journaux, captures d'écran et rapports de bugs que tu partages.

## 🤝 Contributions

Les signalements de bugs, suggestions et contributions sont les bienvenus. Indique la version de MultiView, ta version de Windows, les étapes pour reproduire le problème et les journaux utiles. Retire les URL privées et les identifiants avant de publier.

## ☕ Soutenir le projet

Si MultiView te plaît, tu peux soutenir son développement avec un don facultatif.

**[☕ Soutenir MultiView sur Ko-fi](https://ko-fi.com/aeternoxx)**

## 📄 Licence

Aucune licence n'a encore été spécifiée. Tant qu'une licence n'est pas ajoutée, le code ne doit pas être considéré comme librement réutilisable, modifiable ou redistribuable.
