# kacis.sh — çentik yol verir: yazı imleci altına gelince, basılı tuşla sürüklerken, Super+Alt+I
WD=$(grep -o "Using Wayland display name '[^']*'" "$T/shell.log" | head -1 | cut -d"'" -f2)
a "__A.E()._ayar.set_string('ust-serit', 'centik'); __A.E()._ayar.set_boolean('ada-yol-ver', true); __A.klavye = imports.gi.Clutter.get_default_backend().get_default_seat().create_virtual_device(imports.gi.Clutter.InputDeviceType.KEYBOARD_DEVICE); 1" >/dev/null; sleep 1
WAYLAND_DISPLAY=$WD GDK_BACKEND=wayland python3 "$D/sahte-yazi.py" & PY=$!
sleep 4
a "const K = __A.klavye; const t = () => imports.gi.GLib.get_monotonic_time(); for (const k of [0x61, 0x62, 0x63]) { K.notify_keyval(t(), k, imports.gi.Clutter.KeyState.PRESSED); K.notify_keyval(t(), k, imports.gi.Clutter.KeyState.RELEASED); } 1" >/dev/null; sleep 1.2
a "const k = __A.E()._ada._kacis; __A.yaz('yazı imleci çentiğin altına gelince ada çekilir', __A.E()._ada._cekik === true, 'dinliyor=' + k._dinliyor + ' olay=' + k.olaySayisi + ' imlec=' + JSON.stringify(k.sonImlec) + ' hata=' + encodeURIComponent(String(k.sonHata))); 1" >/dev/null; foto kacis-imlec
a "const K = __A.klavye; const t = () => imports.gi.GLib.get_monotonic_time(); K.notify_keyval(t(), 0xff09, imports.gi.Clutter.KeyState.PRESSED); K.notify_keyval(t(), 0xff09, imports.gi.Clutter.KeyState.RELEASED); K.notify_keyval(t(), 0x78, imports.gi.Clutter.KeyState.PRESSED); K.notify_keyval(t(), 0x78, imports.gi.Clutter.KeyState.RELEASED); 1" >/dev/null; sleep 1.2
a "__A.yaz('imleç aşağıdaki kutuya geçince ada geri iner', !__A.E()._ada._cekik, [...__A.E()._ada._kacis._nedenler].join(',')); 1" >/dev/null
# basılı tuşla sürükleme
a "const k = __A.E()._ada._kok; __A.git(k.x - 120, k.y + 200); 1" >/dev/null; sleep 0.3
a "__A.bas(); 1" >/dev/null; sleep 0.2
a "const k = __A.E()._ada._kok; __A.git(k.x + k.width / 2, k.y + k.height / 2); 1" >/dev/null; sleep 0.5
a "__A.yaz('basılı tuşla sürüklerken çentiğe gelince ada çekilir', __A.E()._ada._cekik === true); __A.birak(); __A.git(300, 800); 1" >/dev/null; sleep 0.6
a "__A.yaz('tuş bırakılıp uzaklaşınca ada geri iner', !__A.E()._ada._cekik); __A.E()._ada._kacis._degistir('kisayol'); 1" >/dev/null; sleep 0.5
a "__A.yaz('kısayol: ada gizlenir', __A.E()._ada._cekik === true); __A.E()._ada._kacis._degistir('kisayol'); 1" >/dev/null; sleep 0.6
a "__A.yaz('kısayol: ada geri gelir', !__A.E()._ada._cekik); 1" >/dev/null
kill $PY 2>/dev/null; sleep 1
