# MultiView

**MultiView is a Windows desktop application that lets you watch multiple WebRTC video streams in one interface or in separate, floating windows.**

Built with Electron, React, and TypeScript, MultiView is designed for monitoring video streams and keeping them visible alongside other applications, including games running in borderless fullscreen mode.

## ✨ Features

- **Multiple video streams** — View several video streams in a single interface.
- **WebRTC / WHEP support** — Connect to WHEP-compatible streams, including those provided by MediaMTX.
- **Floating windows** — Detach individual streams into independent windows.
- **Always-on-top windows** — Keep detached streams above other applications.
- **Smart resizing** — Preserve video aspect ratios when resizing floating windows.
- **Audio controls** — Adjust the volume or mute individual streams.
- **Fullscreen mode** — Display a stream in fullscreen.
- **Stream management** — Add, rename, and remove video sources.
- **Stream availability indicator** — Check whether a stream is detected before starting playback.
- **Return to the main window** — Easily reattach a detached stream to the main MultiView interface.
- **Manual playback** — Streams do not start automatically when the application launches.
- **Local storage** — Saved video sources are stored locally within the application's browser environment.

> **Note:** Always-on-top behavior also depends on Windows and the display mode used by other applications. Some games running in exclusive fullscreen mode may appear above floating windows.

## 📥 Download

Prebuilt Windows releases are available on the GitHub Releases page.

**[Download the latest release](https://github.com/Aeternoxx/MultiView/releases/latest)**

Choose the version that suits your needs:

- **Windows Installer** — Install MultiView on your computer.
- **Portable Version** — Run MultiView without a traditional installation, if a portable build is included in the release.

Check the release notes for version-specific changes and fixes.

## 📺 Adding a video stream

1. Open MultiView.
2. Add a video source by entering its WHEP URL.
3. Save the source.
4. Start playback manually.
5. Detach the stream into a floating window if you want to keep it visible while using another application.

A WHEP URL points to a WebRTC HTTP signaling endpoint. For example, a MediaMTX server might expose an endpoint such as:

```text
https://example.com/stream/whep
```

This is only an example. The exact endpoint depends on your server configuration.

The server must support WHEP and be reachable from the computer running MultiView. Network connectivity, TLS certificates, firewall rules, and server-side security requirements still apply.

## 🖥️ Built with

- [Electron](https://www.electronjs.org/) — Desktop application framework
- [React](https://react.dev/) — User interface
- [TypeScript](https://www.typescriptlang.org/) — Type-safe JavaScript
- [Vite](https://vite.dev/) — Development server and build tooling
- WebRTC / WHEP — Video streaming and signaling

## 🛠️ Development

### Requirements

- Windows
- [Node.js](https://nodejs.org/) — LTS version recommended
- npm, included with Node.js
- Git, if you want to clone the repository

### Clone the repository

```bash
git clone https://github.com/Aeternoxx/MultiView.git
cd MultiView
```

### Install dependencies

```bash
npm install
```

### Start in development mode

```bash
npm run dev
```

Vite and Electron will start the development environment configured for the project.

### Build for Windows

Available build commands and packaging options are defined in `package.json`.

Use the project's configured npm scripts to generate Windows distribution packages. Depending on the packaging configuration, these may include an installer and a portable executable.

Packaged builds can be published on the GitHub Releases page without adding compiled binaries to the source repository.

## 🔒 Privacy

MultiView stores saved video sources locally on the user's computer.

When configuring video sources, keep in mind that stream URLs may contain private information, authentication tokens, or other sensitive data.

Please do not publish private stream URLs, credentials, access tokens, or personal information in bug reports, screenshots, or source code.

Before submitting changes, check that no sensitive information has been included accidentally.

## 🤝 Contributing

Bug reports, suggestions, and contributions are welcome.

When reporting a problem, please include as much relevant information as possible:

- Your Windows version.
- The MultiView version you are using.
- The steps required to reproduce the issue.
- The type of video server you are using, such as MediaMTX.
- Relevant error messages or logs, with private information removed.

Please avoid sharing private stream URLs, credentials, or access tokens in public issues.

## ☕ Support MultiView

MultiView is developed as a freely available project. If you find it useful, you can help support its continued development with an optional tip.

Your support is appreciated and helps make time for bug fixes, maintenance, and future improvements.

**[☕ Support MultiView on Ko-fi](https://ko-fi.com/aeternoxx)**

Donations are entirely optional. You can use MultiView without making a contribution.

## 📄 License

The project's license has not yet been specified.

Until a license is added to the repository, the code should not be assumed to be freely redistributable or modifiable under open-source licensing terms.

See the repository for the current licensing status.
