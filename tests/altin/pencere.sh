# pencere.sh — büyütülmüş ve tam ekran pencerede ada (island-test.sh ile; altin.sh içinden çağrılır)
WD=$(grep -o "Using Wayland display name '[^']*'" "$T/shell.log" | head -1 | cut -d"'" -f2)
# --- 1) büyütülmüş pencere, şerit renkli (varsayılan): pencere şeridin altından başlar, ada görünür, şerit uygulamanın renginde
a "__A.E()._ayar.set_string('ust-serit', 'renkli'); 1" >/dev/null; sleep 0.5
WAYLAND_DISPLAY=$WD GDK_BACKEND=wayland python3 "$D/sahte-pencere.py" & PP=$!
sleep 3.5
a "const w = global.get_window_actors().map(x => x.meta_window).find(m => m.get_title() === 'Tarayici'); __A.pen = w; const bant = Main.panel.height; __A.yaz('renkli şerit: pencere şeridin altından başlar', w && w.get_frame_rect().y >= bant - 1, w ? w.get_frame_rect().y + ' / ' + bant : 'yok'); const t = __A.E()._ada._te; __A.yaz('renkli şerit: ada görünür, çentik değil', !t.aktif && __A.E()._ada._kok.visible, JSON.stringify(t)); __A.yaz('renkli şerit: şerit uygulamanın rengini aldı', /background-color: rgb/.test(Main.panel.style ?? ''), Main.panel.style ?? 'stil yok'); 1" >/dev/null
foto pencere-renkli
a "__A.pen.minimize(); 1" >/dev/null; sleep 1.5
a "__A.yaz('pencere küçülünce şerit şeffaf', !/background-color/.test(Main.panel.style ?? ''), Main.panel.style ?? ''); __A.pen.unminimize(); __A.pen.maximize(imports.gi.Meta.MaximizeFlags.BOTH); 1" >/dev/null; sleep 1.5
# --- 2) şerit gizli: pencere en üste uzanır, ada çentik olur (eski kip)
a "__A.E()._ayar.set_string('ust-serit', 'gizli'); 1" >/dev/null; sleep 2
a "const m = Main.layoutManager.primaryMonitor; __A.yaz('gizli şerit: pencere en üstte başlar', __A.pen.get_frame_rect().y === m.y, String(__A.pen.get_frame_rect().y)); const t = __A.E()._ada._te; __A.yaz('gizli şerit: ada çentik', t.aktif && !__A.E()._ada._kok.visible, JSON.stringify(t)); __A.git(m.x + m.width / 2, m.y + 1); 1" >/dev/null; sleep 0.9
a "__A.yaz('gizli şerit: üst ortaya gelince çentik iner', __A.E()._ada._te.acik && __A.E()._ada._kok.visible); __A.git(300, 700); 1" >/dev/null; sleep 2.2
a "__A.yaz('gizli şerit: uzaklaşınca çentik çekilir', !__A.E()._ada._te.acik); __A.yaz('gizli şerit: Hızlı ayarlar menüsü yine açılır', (Main.panel.toggleQuickSettings(), Main.panel.statusArea.quickSettings.menu.isOpen)); Main.panel.statusArea.quickSettings.menu.close(); __A.E()._ayar.set_string('ust-serit', 'renkli'); 1" >/dev/null; sleep 2
a "__A.yaz('renkliye dönünce şerit yer ayırır', __A.pen.get_frame_rect().y >= Main.panel.height - 1, String(__A.pen.get_frame_rect().y)); 1" >/dev/null
kill $PP 2>/dev/null; sleep 1
# --- 3) tam ekran, birlikte kipi: uygulama adanın altına küçülür, ada görünür, tıklamalar doğru yere gider
a "__A.E()._ayar.set_string('tam-ekran-kipi', 'birlikte'); 1" >/dev/null
WAYLAND_DISPLAY=$WD GDK_BACKEND=wayland python3 "$D/sahte-tik.py" > "$T/tik.txt" 2>&1 & PT=$!
sleep 3.5
a "const w = global.get_window_actors().find(a => a.meta_window.get_title() === 'TikDeneme'); __A.tam = w; const m = Main.layoutManager.primaryMonitor; const s = (m.height - Main.panel.height) / m.height; const b = __A.E()._ada._birlikte; __A.yaz('tam ekran birlikte: uygulama adanın altına küçüldü', w && Math.abs(w.scale_y - s) < 0.002, w ? w.scale_y.toFixed(4) + ' / ' + s.toFixed(4) : 'yok'); __A.yaz('tam ekran birlikte: ada görünür (çentik değil)', b.aktif && __A.E()._ada._kok.visible && !__A.E()._ada._te.aktif); const e = w.get_transformed_extents(); __A.yaz('tam ekran birlikte: uygulamanın üstü adanın altında', Math.abs(e.origin.y - (m.y + Main.panel.height)) <= 1, String(e.origin.y)); __A.yaz('tam ekran birlikte: siyah zemin', !!b._zemin); 1" >/dev/null
foto tam-birlikte
a "const m = Main.layoutManager.primaryMonitor; const s = __A.tam.scale_y; const px = m.x + m.width / 2, py = m.y + m.height; __A.git(px + (m.x + m.width / 8 - px) * s, py + (m.y + m.height / 8 - py) * s); 1" >/dev/null; sleep 0.3
a "__A.bas(); __A.birak(); 1" >/dev/null; sleep 0.4
a "const m = Main.layoutManager.primaryMonitor; const s = __A.tam.scale_y; const px = m.x + m.width / 2, py = m.y + m.height; __A.git(px + (m.x + m.width * 7 / 8 - px) * s, py + (m.y + m.height * 7 / 8 - py) * s); 1" >/dev/null; sleep 0.3
a "__A.bas(); __A.birak(); 1" >/dev/null; sleep 0.4
TIKLAR=$(tr '\n' ' ' < "$T/tik.txt"); grep -q "TIK 00" "$T/tik.txt" && grep -q "TIK 33" "$T/tik.txt" && TOK=true || TOK=false
a "__A.yaz('tam ekran birlikte: tıklamalar doğru düğmeye gider', $TOK, '$TIKLAR'); 1" >/dev/null
notify-send -a "Telegram" -i mail-send-symbolic "Ahmet" "Tam ekranda bildirim"; sleep 1
a "__A.yaz('tam ekran birlikte: bildirim adada görünür', __A.E()._ada.durum === 'bildirim', __A.E()._ada.durum); __A.tam.meta_window.unmake_fullscreen(); 1" >/dev/null; sleep 1.2
a "__A.yaz('tam ekrandan çıkınca ölçek ve zemin geri', __A.tam.scale_y === 1 && !__A.E()._ada._birlikte.aktif, String(__A.tam.scale_y)); 1" >/dev/null
kill $PT 2>/dev/null; sleep 1
sleep 6   # bildirim afişi kapansın (sonraki testler kapsülü okur)
