# pencere.sh — büyütülmüş pencere: şerit yok, ada çentik olur (island-test.sh ile çalışır; altin.sh içinden de çağrılır)
WD=$(grep -o "Using Wayland display name '[^']*'" "$T/shell.log" | head -1 | cut -d"'" -f2)
WAYLAND_DISPLAY=$WD GDK_BACKEND=wayland python3 "$D/sahte-pencere.py" & PP=$!
sleep 3
a "const w = global.get_window_actors().map(x => x.meta_window).find(m => m.get_title() === 'Tarayici'); const m = Main.layoutManager.primaryMonitor; __A.pen = w; __A.yaz('şerit yok: büyütülmüş pencere en üstte başlar', w && w.get_frame_rect().y === m.y, w ? String(w.get_frame_rect().y) : 'pencere yok'); const t = __A.E()._ada._te; __A.yaz('pencere altındayken ada çentik (gizli)', t.aktif && !t.tam && !__A.E()._ada._kok.visible, JSON.stringify(t)); 1" >/dev/null
foto pencere-buyuk
a "const m = Main.layoutManager.primaryMonitor; __A.git(m.x + m.width / 2, m.y + 1); 1" >/dev/null; sleep 0.9
a "__A.yaz('üst ortaya gelince çentik iner', __A.E()._ada._te.acik && __A.E()._ada._kok.visible, JSON.stringify(__A.E()._ada._te)); 1" >/dev/null; foto pencere-centik
a "__A.git(300, 700); 1" >/dev/null; sleep 2.2
a "__A.yaz('uzaklaşınca çentik geri çekilir', !__A.E()._ada._te.acik, JSON.stringify(__A.E()._ada._te)); __A.yaz('pencere büyütülmüşken ekran doğrudan taraması değişmez', !__A.E()._ada._te.unred); 1" >/dev/null
notify-send -a "Telegram" -i mail-send-symbolic "Ahmet" "Pencere açıkken bildirim" ; sleep 1
a "__A.yaz('pencere açıkken bildirim çentikten iner', __A.E()._ada._te.acik && __A.E()._ada.durum === 'bildirim', __A.E()._ada.durum); 1" >/dev/null; foto pencere-bildirim
sleep 8
a "__A.pen.unmaximize(imports.gi.Meta.MaximizeFlags.BOTH); 1" >/dev/null; sleep 0.8
a "const m = Main.layoutManager.primaryMonitor; __A.pen.move_resize_frame(true, m.x + 100, m.y + 400, 800, 500); 1" >/dev/null; sleep 1.2
a "const t = __A.E()._ada._te; __A.yaz('pencere aşağı inince ada normal görünür', !t.aktif && __A.E()._ada._kok.visible && __A.E()._ada._kok.translation_y === 0, JSON.stringify(t)); 1" >/dev/null; foto pencere-asagi
a "__A.E()._ayar.set_boolean('ust-cubuk-sade', false); 1" >/dev/null; sleep 1
a "__A.yaz('sade kapanınca şerit geri gelir', Main.layoutManager.panelBox.translation_y === 0 && Main.layoutManager.panelBox.opacity === 255 && Main.layoutManager._trackedActors.find(x => x.actor === Main.layoutManager.panelBox).affectsStruts); __A.E()._ayar.set_boolean('ust-cubuk-sade', true); 1" >/dev/null; sleep 1
a "__A.yaz('sade açılınca şerit yine kalkar', Main.layoutManager.panelBox.translation_y < 0 && Main.layoutManager.panelBox.opacity === 0); 1" >/dev/null
kill $PP 2>/dev/null; sleep 1
