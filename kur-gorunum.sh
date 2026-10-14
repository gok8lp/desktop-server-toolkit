#!/bin/bash
# kur-gorunum.sh — FLUGEL v2 görünümü (sistem-bakim): Island'a uyan dock, bulanıklık, sihirli lamba.
#   kur-gorunum.sh            önce yedek alır, sonra uygular
#   kur-gorunum.sh --deneme   sadece ne yapacağını yazar
# Geri almak: geri-al-gorunum.sh   (Wayland'da yeni eklentiler oturum yenilenince yüklenir)
# Popüler, GNOME 50 uyumlu projeler: Blur my Shell (GPL-3), Compiz alike Magic Lamp Effect (GPL-3);
# dock: Ubuntu'nun kendi ubuntu-dock'u (Dash to Dock), sadece ayarlanır.
set -euo pipefail
DENEME=0
[ "${1:-}" = "--deneme" ] && DENEME=1
KAYIT="$HOME/sistem-bakim/islem-kaydi.log"
YEDEK="$HOME/sistem-bakim/yedek/gorunum-$(date +%F_%H%M)"
EKL="$HOME/.local/share/gnome-shell/extensions"
DOCK=org.gnome.shell.extensions.dash-to-dock

yap() { if [ "$DENEME" = 1 ]; then echo "[deneme] $*"; else "$@"; fi; }

# 1) yedek
yap mkdir -p "$YEDEK"
if [ "$DENEME" = 0 ]; then
  dconf dump /org/gnome/shell/extensions/dash-to-dock/ > "$YEDEK/dash-to-dock.ini"
  dconf dump /org/gnome/shell/extensions/blur-my-shell/ > "$YEDEK/blur-my-shell.ini"
  dconf dump /org/gnome/shell/extensions/ncom/github/hermes83/compiz-alike-magic-lamp-effect/ > "$YEDEK/magic-lamp.ini" || true
  gsettings get org.gnome.shell enabled-extensions > "$YEDEK/etkin-eklentiler.txt"
  gsettings get org.gnome.desktop.interface accent-color > "$YEDEK/vurgu-rengi.txt"
  echo "$YEDEK" > "$HOME/sistem-bakim/yedek/SON-GORUNUM-YEDEGI"
fi

# 2) eklentiler: extensions.gnome.org'dan GNOME 50 sürümü
kur() {
  local uuid=$1
  [ -d "$EKL/$uuid" ] && { echo "zaten kurulu: $uuid"; return; }
  local url
  url=$(curl -fsS "https://extensions.gnome.org/extension-info/?uuid=$uuid&shell_version=50" |
        python3 -c 'import json,sys; print(json.load(sys.stdin)["download_url"])')
  yap curl -fsSL -o "/tmp/$uuid.zip" "https://extensions.gnome.org$url"
  yap gnome-extensions install --force "/tmp/$uuid.zip"
  yap rm -f "/tmp/$uuid.zip"
}
kur blur-my-shell@aunetx
kur compiz-alike-magic-lamp-effect@hermes83.github.com

# 3) dock: ortalı, içeriğe göre genişlik, Island ile aynı koyu cam, pencere değince gizlenir
yap gsettings set $DOCK dock-position 'BOTTOM'
yap gsettings set $DOCK extend-height false
yap gsettings set $DOCK always-center-icons true
yap gsettings set $DOCK dock-fixed false
yap gsettings set $DOCK autohide true
yap gsettings set $DOCK intellihide true
yap gsettings set $DOCK intellihide-mode 'ALL_WINDOWS'
yap gsettings set $DOCK dash-max-icon-size 44
yap gsettings set $DOCK apply-custom-theme false
yap gsettings set $DOCK custom-theme-shrink true
yap gsettings set $DOCK transparency-mode 'FIXED'
yap gsettings set $DOCK custom-background-color true
yap gsettings set $DOCK background-color '#0e0e10'
yap gsettings set $DOCK background-opacity 0.62
yap gsettings set $DOCK force-straight-corner false
yap gsettings set $DOCK running-indicator-style 'DOTS'
yap gsettings set $DOCK custom-theme-customize-running-dots true
yap gsettings set $DOCK custom-theme-running-dots-color '#ffffff'
yap gsettings set $DOCK custom-theme-running-dots-border-color '#ffffff'
yap gsettings set $DOCK custom-theme-running-dots-border-width 0
yap gsettings set $DOCK show-running true
yap gsettings set $DOCK show-trash true
yap gsettings set $DOCK show-mounts true
yap gsettings set $DOCK show-icons-notifications-counter true
yap gsettings set $DOCK show-icons-emblems true
yap gsettings set $DOCK middle-click-action 'launch'
yap gsettings set $DOCK scroll-action 'cycle-windows'
yap gsettings set $DOCK click-action 'focus-minimize-or-previews'
yap gsettings set $DOCK animation-time 0.18
# sistem vurgu rengi nötr (turuncu yok)
yap gsettings set org.gnome.desktop.interface accent-color 'slate'

# 4) eklentileri aç (yeni kurulanlar oturum yenilenince yüklenir)
YENI=$(gsettings get org.gnome.shell enabled-extensions | python3 -c '
import ast, sys
liste = ast.literal_eval(sys.stdin.read().replace("@as ", ""))
for u in ("blur-my-shell@aunetx", "compiz-alike-magic-lamp-effect@hermes83.github.com"):
    if u not in liste:
        liste.append(u)
print(str(liste))')
yap gsettings set org.gnome.shell enabled-extensions "$YENI"

# 5) Blur my Shell: sadece dock ve genel bakış bulanık; üst çubuk zaten saydam ve boş (sadece Island)
bms() { yap gsettings --schemadir "$EKL/blur-my-shell@aunetx/schemas" set "org.gnome.shell.extensions.blur-my-shell.$1" "$2" "$3"; }
if [ -d "$EKL/blur-my-shell@aunetx/schemas" ]; then
  bms panel blur false
  bms dash-to-dock blur true
  bms dash-to-dock static-blur true
  bms overview blur true
  bms applications blur false
  bms lockscreen blur false
fi

[ "$DENEME" = 1 ] || echo "$(date '+%F %T') kur-gorunum: dock ayarlari, blur-my-shell, magic lamp (yedek $YEDEK)" >> "$KAYIT"
echo "Görünüm uygulandı. Yedek: $YEDEK"
echo "Yeni eklentiler için oturumu kapatıp açman gerekiyor."
