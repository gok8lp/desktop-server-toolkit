# Desktop & Server Toolkit

Linux desktop and home-server integrations maintained by Gökalp Göksu.
[English](README.md) · [Türkçe](README.tr.md)

This repository combines a personal news reader, GNOME desktop extensions and home-server helper scripts.
It is a personal development toolkit, not a turnkey Linux distribution or a one-command server installer.

## Projects inside

| Directory | Purpose |
| --- | --- |
| `sunucu/panel/akis/` | Akış: Python HTTP API, RSS/YouTube collection, optional Ollama summaries and a browser/PWA interface |
| `extensions/flugel-island@flugel/` | Canonical source of the GNOME Island extension |
| `pc/bin/` | Desktop data collectors and VM/battery helper commands |
| `pc/gnome-uzantilari/` | Earlier panel and lock-screen extensions |
| `sunucu/` | Docker examples, systemd units, monitoring, backup and VM integration |
| `android/` | Small WebView client for the personal feed |
| `tests/` | Pure JavaScript unit tests for extension components |

![Akış news reader](docs/ekran/akis-ana.jpg)

## Start with one component

- For the GNOME extension, use [gnome-island](https://github.com/gok8lp/gnome-island).
- For the server configuration catalogue, see [home-server](https://github.com/gok8lp/home-server).
- For the Android server dashboard, see [home-server-android](https://github.com/gok8lp/home-server-android).
- For the feed, read `sunucu/panel/compose.yaml` and `sunucu/panel/akis/akis.py` first. Configure your own paths,
  sources and addresses before starting the `flugel-akis` Compose service. That service name is retained for compatibility.

The extension targets GNOME Shell 50; this does not establish compatibility with other Shell versions.
Personal data collectors are optional integrations and require their own server configuration.

## Development

```bash
git clone https://github.com/gok8lp/desktop-server-toolkit.git
cd desktop-server-toolkit
npm ci
npm run lint
npm test
```

These commands check JavaScript; they do not install the extension or deploy the server.
Do not run `kur-*.sh` or `guncelle.sh` as a generic installer: they contain machine-specific collection and installation steps.
Review and adapt them to your environment first.

## Compatibility and attribution

Existing extension UUIDs, settings schemas, service names and filesystem paths are retained so installed components
can still find their configuration. They are technical identifiers, not the public project name.
The standalone extension and this repository share the same extension source; compare both before publishing changes.
Third-party extension attribution is retained in the component credits and licences. Some components were developed with AI assistance.
No live desktop or server is changed by documentation updates in this repository.
