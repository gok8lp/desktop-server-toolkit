#!/bin/bash
# Kullanım: bash tests/altin/pip-stress-run.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
OUTPUT=$(bash "$HERE/island-test.sh" "$HERE/pip-stress.sh" 2>&1)
DIR=$(sed -n 's/^KLASOR //p' <<<"$OUTPUT" | tail -1)
if [ -z "$DIR" ] || [ ! -f "$DIR/shell.log" ]; then
    printf '%s\n' "$OUTPUT"
    echo 'Başsız GNOME test günlüğü bulunamadı' >&2
    exit 1
fi
if ! grep -Fq "PiP izlenen pencere sayısı: (true, '0')" <<<"$OUTPUT"; then
    printf '%s\n' "$OUTPUT"
    echo 'PiP pencere izleyicileri temizlenmedi' >&2
    exit 1
fi
if ! grep -Fq 'GNOME tarafından görülen PiP döngüsü: 24/24' <<<"$OUTPUT"; then
    printf '%s\n' "$OUTPUT"
    echo 'PiP pencerelerinin tümü GNOME tarafından görülmedi' >&2
    exit 1
fi
if rg -q 'pip\.js:|already disposed|has no handler with id|JS ERROR.*pip' "$DIR/shell.log"; then
    rg -n 'pip\.js:|already disposed|has no handler with id|JS ERROR.*pip' "$DIR/shell.log" >&2
    exit 1
fi
echo "PiP yük testi geçti: 24 pencere döngüsü, 0 kalan izleyici, 0 PiP yaşam döngüsü hatası. Günlük: $DIR/shell.log"
if rg -q 'Gjs-CRITICAL' "$DIR/shell.log"; then
    echo "Not: Kabuk kapanışında $(rg -c 'Gjs-CRITICAL' "$DIR/shell.log") GJS uyarısı var; ayrı inceleme gerektirir."
fi
