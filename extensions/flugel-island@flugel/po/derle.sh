#!/bin/bash
# po/derle.sh — çevirileri günceller ve derler (FLUGEL Island, TR kaynak → EN).
#   po/derle.sh            .pot'u kaynaktan yeniden çıkarır, en.po'yu birleştirir, .mo derler
#   po/derle.sh --kontrol  eksik/eskimiş çeviri varsa hata verir
set -euo pipefail
K="$(cd "$(dirname "$0")/.." && pwd)"
cd "$K"
xgettext --from-code=UTF-8 -L JavaScript -k_ --no-location --package-name="FLUGEL Island" \
  -o po/flugel-island.pot extension.js prefs.js src/*.js src/*/*.js
for po in po/*.po; do
  dil=$(basename "$po" .po)
  msgmerge -q --update --backup=none "$po" po/flugel-island.pot
  mkdir -p "locale/$dil/LC_MESSAGES"
  msgfmt --check -o "locale/$dil/LC_MESSAGES/flugel-island.mo" "$po"
  ozet=$(msgfmt --statistics -o /dev/null "$po" 2>&1)
  echo "$dil: $ozet"
  if [ "${1:-}" = "--kontrol" ] && echo "$ozet" | grep -qE "untranslated|fuzzy"; then
    echo "eksik çeviri var: $dil" >&2
    exit 1
  fi
done
