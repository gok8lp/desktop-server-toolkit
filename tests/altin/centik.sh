# centik.sh — çentik kipi: pencere tüm ekranı kullanır, ada üst kenara gömülü (kavisli) ve hep görünür
WD=$(grep -o "Using Wayland display name '[^']*'" "$T/shell.log" | head -1 | cut -d"'" -f2)
a "__A.E()._ayar.set_string('ust-serit', 'centik'); __A.E()._ayar.set_string('tam-ekran-kipi', 'centik'); 1" >/dev/null; sleep 1
WAYLAND_DISPLAY=$WD GDK_BACKEND=wayland python3 "$D/sahte-pencere.py" & PC=$!
sleep 3.5
a "const w = global.get_window_actors().map(x => x.meta_window).find(m => m.get_title() === 'Tarayici'); __A.cpen = w; const m = Main.layoutManager.primaryMonitor; const ada = __A.E()._ada; __A.yaz('çentik: pencere ekranın en üstünden başlar', w && w.get_frame_rect().y === m.y, w ? String(w.get_frame_rect().y) : 'yok'); __A.yaz('çentik: ada üst kenara gömülü ve görünür', ada._kok.visible && ada._kok.y === m.y && ada._centik, ada._kok.y + ' ' + ada._centik); __A.yaz('çentik: iki kavis yerinde', ada._kavisSol.visible && ada._kavisSag.visible && Math.abs(ada._kavisSol.x + ada._kavisSol.width - ada._kok.x) < 1, ada._kavisSol.x + '/' + ada._kok.x); 1" >/dev/null
foto centik-pencere
a "__A.cpen.make_fullscreen(); 1" >/dev/null; sleep 2
a "const ada = __A.E()._ada; const a = __A.cpen.get_compositor_private(); __A.yaz('çentik tam ekranda: ada görünür, uygulama küçülmez', ada._kok.visible && ada._centik && a.scale_y === 1 && !ada._te.aktif, a.scale_y + ' ' + JSON.stringify(ada._te)); __A.yaz('çentik tam ekranda: ada çizilebilsin diye doğrudan tarama kapalı', ada._te.unred); 1" >/dev/null
foto centik-tam
a "__A.cpen.unmake_fullscreen(); 1" >/dev/null; sleep 1.5
a "__A.yaz('tam ekrandan çıkınca doğrudan tarama geri açılır', !__A.E()._ada._te.unred); 1" >/dev/null
kill $PC 2>/dev/null; sleep 1
