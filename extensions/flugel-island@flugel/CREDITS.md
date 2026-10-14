# FLUGEL Island — credits & third-party notices / emeği geçenler

FLUGEL Island is a fork that extends two open-source GNOME Shell extensions. Original copyright notices are kept;
the original licence texts are in `lisanslar/`. Every adapted file says where it came from and what changed.

| Source | Licence | Used for | Version |
|---|---|---|---|
| [hacksynth/gnome-dynamic-island](https://github.com/hacksynth/gnome-dynamic-island) © hacksynth | GPL-2.0-or-later | Live-activity model (`src/activity.js`, `src/activity-manager.js`), provider architecture and the media, power, notification and keyboard providers, `src/i18n.js`, unit tests | `99cf96b` (2026-04-20) |
| [HIMURAw/gnome-dynamic-island](https://github.com/HIMURAw/gnome-dynamic-island) © HIMURAw | GPL-3.0 | Damped spring animation (`src/spring.js`), microphone/camera in-use detection (`src/providers/privacy.js`, the microphone level meter was **not** taken), the idea of a separate chrome layer above the panel | `f527891` (2026-10-12) |
| FLUGEL v1 panel © Gökalp Göksu | GPL-3.0-or-later | Re:Zero chibi drawings (`ekip/`), monochrome icons (`ikon/`), force-quit / panic / crypto / matches / anime / VM / tray / battery-saver behaviour | — |

Because GPL-2.0-or-later and GPL-3.0 code are combined, **the whole extension is GPL-3.0-or-later** (`LICENSE`).

## Data and marks
- **IMDb:** episode ratings come from IMDb's non-commercial datasets (computed on the user's own server).
  *Information courtesy of IMDb (https://www.imdb.com). Used with permission.* Personal, non-commercial use only.
- **AniList / MyAnimeList:** cover images, scores and descriptions belong to their owners; only links to MAL,
  AniList and legal streaming platforms are shown.
- **Binance** public market data (prices), **ESPN** scoreboard (matches) — fetched by the user's own scripts.
- `ikon/renkli/` holds the favicons of Crunchyroll, HIDIVE, Netflix, MyAnimeList and AniList, used only as link
  buttons to those services. They are trademarks of their respective owners and are not covered by the GPL.
- Re:Zero characters © Tappei Nagatsuki / KADOKAWA; the chibi drawings are fan art made for this project.
