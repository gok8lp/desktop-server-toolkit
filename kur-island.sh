#!/bin/bash
# kur-island.sh — FLUGEL Island'ı kurar ve FLUGEL v1 panelinin yerine açar (sistem-bakim v2).
#   kur-island.sh            kur + şemayı derle + v1 paneli kapat, Island'ı aç
#   kur-island.sh --deneme   sadece ne yapacağını yazar
# Geri dönmek için: geri-al-panel.sh (ya da Island ayarlarındaki "Eski panele dön").
# Not: Wayland'da yeni kurulan eklenti ancak oturumu kapatıp açınca yüklenir.
set -euo pipefail
KAYNAK="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)/extensions/flugel-island@flugel"
HEDEF="$HOME/.local/share/gnome-shell/extensions/flugel-island@flugel"
KAYIT="$HOME/sistem-bakim/islem-kaydi.log"
DENEME=0
[ "${1:-}" = "--deneme" ] && DENEME=1

yap() {
  if [ "$DENEME" = 1 ]; then echo "[deneme] $*"; else "$@"; fi
}

[ -f "$KAYNAK/metadata.json" ] || { echo "Kaynak bulunamadı: $KAYNAK" >&2; exit 1; }
command -v glib-compile-schemas >/dev/null || { echo "glib-compile-schemas yok (libglib2.0-bin)" >&2; exit 1; }

# önce yedek: v1 panelin yedeği geri-al-panel.sh için SON-PANEL-YEDEGI'nde durur
if [ ! -e "$HOME/sistem-bakim/yedek/SON-PANEL-YEDEGI" ]; then
  echo "Uyarı: ~/sistem-bakim/yedek/SON-PANEL-YEDEGI yok; geri dönüş için önce yedek alın." >&2
fi

# çeviriler (TR kaynak → EN): gettext varsa derlenir
if command -v msgfmt >/dev/null; then
  yap "$KAYNAK/po/derle.sh" >/dev/null
fi
yap mkdir -p "$HEDEF"
yap rsync -a --delete --exclude 'schemas/gschemas.compiled' "$KAYNAK/" "$HEDEF/"
yap glib-compile-schemas --strict "$HEDEF/schemas"
# enabled-extensions doğrudan yazılır: kabuk yeni klasörü oturum yenilenene kadar tanımaz, ama listeyi okur
YENI=$(gsettings get org.gnome.shell enabled-extensions | python3 -c '
import ast, sys
liste = [u for u in ast.literal_eval(sys.stdin.read().replace("@as ", "")) if u != "flugel-panel@flugel"]
if "flugel-island@flugel" not in liste:
    liste.append("flugel-island@flugel")
print(str(liste))')
yap gsettings set org.gnome.shell enabled-extensions "$YENI"
[ "$DENEME" = 1 ] || echo "$(date '+%F %T') kur-island: FLUGEL Island kuruldu, flugel-panel kapatildi" >> "$KAYIT"

echo "FLUGEL Island kuruldu."
echo "Wayland'da ilk kurulumdan sonra oturumu kapatıp açman gerekiyor (sonraki güncellemelerde de)."
