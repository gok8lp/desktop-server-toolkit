# Island v3 — English headless GNOME review

Date: 2026-10-18

Environment: GNOME Shell 50 headless Wayland, virtual monitor `1366x768`, `LANGUAGE=en_US.UTF-8`, `LC_ALL=en_US.UTF-8`, extension setting `dil=en`. The test used an isolated dconf copy and did not modify the installed extension files or the live desktop session.

## Evidence

- `en-720-quick-short.png`: 720px card, Quick short view.
- `en-720-quick-all.png`: 720px card, Quick All view.
- `en-560-quick-short.png`: 560px card, Quick short view.
- `en-560-more.png`: 560px card with More strip open.

## Passed

- The five group labels `Home`, `System`, `Content`, `Following`, `Notification` fit at both 720px and 560px.
- Header actions fit at 560px. The More strip labels `Quick settings`, `Calendar`, `Activities`, `Settings` fit without overlap.
- `Quick`, `Shortcuts`, `Volume & brightness`, `Quick settings`, `Apps`, and `Tools` remain readable.
- Four app tiles fit in the 560px card without label clipping.
- The card remains below the 86% screen-height budget and only its content area scrolls.

## Release-blocking layout findings

1. **560px Quick settings clips the fourth tile.** `en-560-quick-short.png` and `en-560-more.png` show three complete tiles and only a narrow slice of `Night light`. There is no visible affordance that the row scrolls horizontally. The v3 target should wrap this grid or provide a clear, keyboard-accessible horizontal continuation; no tile may appear accidentally cut.
2. **720px All clips the last Quick setting.** In `en-720-quick-all.png`, `Microphone` is cut at the right card edge. The same row contains seven English labels; it needs responsive wrapping rather than relying on an invisible horizontal overflow.
3. The long Turkish feed headline remains in the live row while the shell UI is English. This is content data rather than an untranslated UI string and is not a localization failure; its ellipsis behaves correctly.

## Runtime finding

At headless-shell teardown, after all screenshots were captured, the log emitted repeated `Gjs-CRITICAL` messages for already disposed actors in:

- `src/etkinlik-gorunumu.js` around lines 189–199,
- `src/kart.js` around lines 377, 587, 596 and 622,
- `src/island-gorunumu.js` around lines 398, 401 and 613.

The final warning was `Attempting to call back into JSAPI during the sweeping phase of GC`, triggered by a `destroy` signal on an `StBoxLayout`. Because these share the shutdown timestamp, this is likely lifecycle cleanup rather than the visual test path, but it is still a release blocker: timers/signals must be disconnected before actor destruction and callbacks must guard disposed actors. Re-run the same test after the fix and require a clean extension log.

## Reproduction

```bash
KIP= LANGUAGE=en_US.UTF-8 LC_ALL=en_US.UTF-8 \
  /home/flugel/sistem-bakim/v2-is/island-test.sh \
  .ai_workspace/tasarim/island-v3/test/en/adim-en.sh 1366x768
```
