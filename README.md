# MultiView

**MultiView** est une application de bureau Windows permettant de visualiser plusieurs flux vidéo WebRTC dans une interface unique, ou dans des fenêtres flottantes indépendantes.

Conçue avec Electron, React et TypeScript, l'application est particulièrement adaptée à la surveillance de flux vidéo et à leur affichage en parallèle d'autres applications, notamment des jeux en plein écran fenêtré.

## ✨ Fonctionnalités

- **Multi-flux vidéo** — regroupez plusieurs flux dans une interface unique.
- **WebRTC / WHEP** — connexion aux flux compatibles avec le protocole WHEP, notamment ceux exposés par MediaMTX.
- **Fenêtres flottantes** — détachez un flux dans une fenêtre indépendante pour l'afficher au-dessus de vos autres applications.
- **Fenêtres toujours au premier plan** — gardez les flux détachés visibles lorsque vous utilisez une autre application.
- **Redimensionnement intelligent** — conservez les proportions de la vidéo lors du redimensionnement des fenêtres.
- **Contrôle audio** — réglez le volume ou coupez le son de chaque flux.
- **Plein écran** — affichez un flux en plein écran.
- **Gestion des flux** — ajoutez, renommez et supprimez vos sources vidéo.
- **Indicateur de disponibilité** — vérifiez si un flux est détecté avant de lancer sa lecture.
- **Retour à l'interface principale** — réintégrez facilement un flux détaché dans MultiView.
- **Démarrage manuel** — les flux ne démarrent pas automatiquement au lancement de l'application.
- **Sauvegarde locale** — les sources enregistrées sont conservées localement dans le navigateur intégré à l'application.

> **Remarque :** le maintien au premier plan dépend également du comportement du système Windows et du mode d'affichage utilisé par les autres applications. Certains jeux en plein écran exclusif peuvent passer devant les fenêtres flottantes.

## 🖥️ Technologies

- [Electron](https://www.electronjs.org/) — application de bureau
- [React](https://react.dev/) — interface utilisateur
- [TypeScript](https://www.typescriptlang.org/) — typage statique
- [Vite](https://vite.dev/) — environnement de développement et compilation
- WebRTC / WHEP — transport des flux vidéo

## 🚀 Installation et développement

### Prérequis

- Windows
- [Node.js](https://nodejs.org/) — version LTS recommandée
- npm, fourni avec Node.js
- Git, si vous souhaitez récupérer le projet depuis son dépôt

### Récupérer le code source

```bash
git clone https://github.com/Aeternoxx/MultiView.git
cd MultiView
```

Remplacez `TON-COMPTE` par le nom du compte ou de l'organisation GitHub qui héberge le dépôt.

### Installer les dépendances

```bash
npm install
```

### Lancer l'application en mode développement

```bash
npm run dev
```

Vite et Electron démarrent alors l'environnement de développement configuré par le projet.

## 📺 Ajouter un flux vidéo

1. Ouvrez MultiView.
2. Ajoutez une source vidéo en renseignant son adresse WHEP.
3. Enregistrez la source.
4. Lancez la lecture manuellement.
5. Détachez le flux dans une fenêtre flottante si vous souhaitez le conserver visible pendant que vous utilisez une autre application.

Une adresse WHEP correspond généralement à un point d'accès dédié à la signalisation WebRTC. Par exemple, un serveur MediaMTX peut exposer un endpoint WHEP sous une forme telle que :

```text
https://example.com/stream/whep
```

Cette adresse est uniquement illustrative : l'endpoint exact dépend de la configuration du serveur.

Le serveur doit prendre en charge WHEP et être accessible depuis la machine exécutant MultiView. Les exigences réseau, TLS et de sécurité du serveur restent applicables.

## 🔒 Confidentialité

Les sources enregistrées par l'application sont stockées localement sur la machine de l'utilisateur.

Ce dépôt public ne doit contenir aucune adresse de flux privée, aucun identifiant, aucun mot de passe ni aucune autre information personnelle.

Avant de publier une modification, vérifiez les URL et les éventuelles données sensibles présentes dans le code source.

## 🛠️ Compilation

Le projet utilise Electron et Vite. Les commandes de développement et de compilation disponibles sont définies dans `package.json`.

La génération d'un installateur Windows ou d'une version portable nécessite une configuration de packaging adaptée au projet.

Les exécutables distribués peuvent être publiés séparément dans la section **Releases** de GitHub, afin de garder le dépôt source léger.

## 🤝 Contributions

Les suggestions, rapports de bugs et contributions sont les bienvenus.

Pour signaler un problème, indiquez si possible :

- La version de Windows utilisée.
- Les étapes permettant de reproduire le problème.
- Le type de serveur vidéo utilisé.
- Les messages d'erreur pertinents, en prenant soin de masquer les informations privées.

## 📄 Licence

La licence du projet reste à définir.

Tant qu'une licence n'a pas été ajoutée au dépôt, ne supposez pas que le code peut être librement redistribué ou modifié selon les conditions d'une licence open source.

