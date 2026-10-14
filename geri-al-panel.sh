#!/bin/bash
# geri-al-panel.sh — FLUGEL v2'den v1 paneline tek komutla don (sistem-bakim)
#   1) flugel-island@flugel eklentisini kapatir
#   2) klasik flugel-panel@flugel eklentisini acar
#   3) GNOME ayarlarini (dconf /org/gnome/) v1 yedeginden geri yukler
# Kullanim: geri-al-panel.sh [--deneme]      (--deneme: sadece ne yapacagini yazar)
set -euo pipefail

DENEME=0
[ "${1:-}" = "--deneme" ] && DENEME=1
YEDEK_KAYDI="$HOME/sistem-bakim/yedek/SON-PANEL-YEDEGI"
KAYIT="$HOME/sistem-bakim/islem-kaydi.log"

calis() {
  echo "+ $*"
  [ "$DENEME" -eq 1 ] || "$@"
}

[ -f "$YEDEK_KAYDI" ] || { echo "Yedek kaydi yok: $YEDEK_KAYDI" >&2; exit 1; }
YEDEK="$(cat "$YEDEK_KAYDI")"
[ -f "$YEDEK/dconf-org-gnome.ini" ] || { echo "dconf yedegi yok: $YEDEK" >&2; exit 1; }

# Island kurulu degilse hata vermesin
if gnome-extensions info flugel-island@flugel >/dev/null 2>&1; then
  calis gnome-extensions disable flugel-island@flugel
fi
# "load" yalnizca yedekteki anahtarlari yazar; sonradan degisen varsayilan anahtarlar kalmasin diye once sifirla
calis dconf reset -f /org/gnome/
if [ "$DENEME" -eq 1 ]; then echo "+ dconf load /org/gnome/ < $YEDEK/dconf-org-gnome.ini"; else dconf load /org/gnome/ < "$YEDEK/dconf-org-gnome.ini"; fi
calis gnome-extensions enable flugel-panel@flugel
calis gnome-extensions enable flugel-kilit@flugel

if [ "$DENEME" -eq 0 ]; then
  echo "$(date '+%F %T') geri-al-panel.sh: v1 paneline donuldu (dconf: $YEDEK)" >> "$KAYIT"
fi
echo
echo "Tamam. Wayland'da degisikligin tam oturmasi icin oturumu kapatip ac."
