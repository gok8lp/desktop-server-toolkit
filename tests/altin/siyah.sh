# siyah.sh — siyah bar: büyütülmüş pencere barın altından başlar, bar simsiyah, ada barın içinde görünür
WD=$(grep -o "Using Wayland display name '[^']*'" "$T/shell.log" | head -1 | cut -d"'" -f2)
a "__A.E()._ayar.set_string('ust-serit', 'siyah'); 1" >/dev/null; sleep 1
WAYLAND_DISPLAY=$WD GDK_BACKEND=wayland python3 "$D/sahte-pencere.py" & PS=$!
sleep 3.5
a "const w = global.get_window_actors().map(x => x.meta_window).find(m => m.get_title() === 'Tarayici'); __A.yaz('siyah bar: pencere barın altından başlar', w && w.get_frame_rect().y >= Main.panel.height - 1, w ? String(w.get_frame_rect().y) : 'yok'); __A.yaz('siyah bar: bar simsiyah', (Main.panel.style ?? '').includes('rgb(0,0,0)'), Main.panel.style ?? ''); __A.yaz('siyah bar: ada görünür, örtmüyor', __A.E()._ada._kok.visible && !__A.E()._ada._centik && !__A.E()._ada._te.aktif); 1" >/dev/null
foto siyah-bar
kill $PS 2>/dev/null; sleep 1.5
a "__A.yaz('pencere kapanınca bar şeffaf', !/background-color/.test(Main.panel.style ?? ''), Main.panel.style ?? ''); 1" >/dev/null
