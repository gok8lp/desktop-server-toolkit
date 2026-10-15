#!/bin/bash
# island-test.sh — FLUGEL Island'ı ayrı, başsız bir GNOME Shell'de dener (gerçek oturuma ve ayarlara dokunmaz:
# dconf veritabanının kopyası kullanılır). Kullanım: island-test.sh ADIMLAR.sh [genislik x yukseklik]
# ADIMLAR.sh içinde ev 'js' (Eval) ve foto ad (ekran görüntüsü) fonksiyonları kullanılabilir.
set -u
ADIM=$(readlink -f "$1"); BOYUT=${2:-2560x1600}
T=$(mktemp -d /tmp/island-test.XXXX); mkdir -p "$T/config" "$T/foto"
cp -r ~/.config/dconf "$T/config/"
export XDG_CONFIG_HOME=$T/config T ADIM BOYUT KIP TEK
# shellcheck disable=SC2016  # tek tırnak bilinçli: değişkenler iç kabukta açılır
dbus-run-session -- bash -c '
  gnome-shell --headless --virtual-monitor "$BOYUT" --wayland --no-x11 --unsafe-mode ${KIP:+--mode=$KIP} > "$T/shell.log" 2>&1 &
  SP=$!
  ev(){ gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "$1"; }
  foto(){ gdbus call --session --dest org.gnome.Shell.Screenshot --object-path /org/gnome/Shell/Screenshot \
          --method org.gnome.Shell.Screenshot.Screenshot false false "$T/foto/$1.png" >/dev/null; }
  for i in $(seq 1 40); do ev 1 2>/dev/null | grep -q true && break; sleep 1; done
  . "$ADIM"
  kill $SP; wait $SP 2>/dev/null
'
echo "KLASOR $T"
grep -iE "flugel|JS ERROR|TypeError|ReferenceError|SyntaxError|Gjs-CRITICAL|Error:" "$T/shell.log" | grep -v "^$" | head -40
systemctl --user restart xdg-document-portal 2>/dev/null
