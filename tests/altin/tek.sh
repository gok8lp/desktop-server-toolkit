# tek.sh — tests/altin içinden tek bir adım dosyasını çalıştırır: TEK=centik.sh island-test.sh tek.sh
D=~/Projects/flugel/tests/altin
js(){ ev "eval(new TextDecoder().decode(imports.gi.GLib.file_get_contents('$D/$1')[1]))"; }
a(){ ev "$1"; }
sleep 12
js 00-yardim.js >/dev/null
. "$D/$TEK"
ev "__A.sonuc.join(' ## ')" | sed "s/ ## /\n/g"
