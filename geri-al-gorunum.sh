#!/bin/bash
# geri-al-gorunum.sh — kur-gorunum.sh'den önceki görünüme döner (sistem-bakim).
#   geri-al-gorunum.sh [--deneme]
set -euo pipefail
DENEME=0
[ "${1:-}" = "--deneme" ] && DENEME=1
KAYIT="$HOME/sistem-bakim/islem-kaydi.log"
YEDEK="$(cat "$HOME/sistem-bakim/yedek/SON-GORUNUM-YEDEGI" 2>/dev/null || true)"
[ -n "$YEDEK" ] && [ -d "$YEDEK" ] || { echo "Görünüm yedeği bulunamadı" >&2; exit 1; }
yap() { if [ "$DENEME" = 1 ]; then echo "[deneme] $*"; else "$@"; fi; }

yap gnome-extensions disable blur-my-shell@aunetx || true
yap gnome-extensions disable compiz-alike-magic-lamp-effect@hermes83.github.com || true
yap dconf reset -f /org/gnome/shell/extensions/dash-to-dock/
if [ "$DENEME" = 0 ]; then
  dconf load /org/gnome/shell/extensions/dash-to-dock/ < "$YEDEK/dash-to-dock.ini"
  gsettings set org.gnome.shell enabled-extensions "$(cat "$YEDEK/etkin-eklentiler.txt")"
  gsettings set org.gnome.desktop.interface accent-color "$(cat "$YEDEK/vurgu-rengi.txt")"
  echo "$(date '+%F %T') geri-al-gorunum: $YEDEK yedegine donuldu" >> "$KAYIT"
else
  echo "[deneme] dconf load dash-to-dock < $YEDEK/dash-to-dock.ini; enabled-extensions ve vurgu rengi geri"
fi
echo "Tamam. Kurulan eklenti dosyaları silinmedi (kapalı); tam etki için oturumu kapatıp aç."
