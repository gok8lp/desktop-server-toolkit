# araclar.sh — Atoll'dan uyarlananlar: zamanlayıcı, pano geçmişi, renk seçici, indirmeler, odak, hava durumu
a "import('file://' + imports.gi.GLib.get_home_dir() + '/.local/share/gnome-shell/extensions/flugel-island@flugel/src/araclar.js').then(m => { globalThis.__ar = m; }); 1" >/dev/null; sleep 1
a "const sp = global.display.get_sound_player(); __A.sesler = []; if (!sp.__orijinal) { sp.__orijinal = sp.play_from_theme; sp.play_from_theme = (...x) => __A.sesler.push(x[0]); } __ar.zamanlayici.baslat(3000); 1" >/dev/null; sleep 1.2
a "const ak = __A.E()._yonetici._activities.get('zamanlayici:sayac'); __A.yaz('zamanlayıcı kapsülde geri sayar', !!ak && /^0:0[12]$/.test(ak.data.kisa), ak ? ak.data.kisa : 'yok'); 1" >/dev/null; foto zamanlayici
sleep 3
a "const ak = __A.E()._yonetici._activities.get('zamanlayici:sayac'); __A.yaz('zamanlayıcı bitince: Süre doldu + ses', !!ak && ak.label === 'Süre doldu' && __A.sesler.includes('alarm-clock-elapsed'), ak ? ak.label : 'yok'); __ar.zamanlayici.sifirla(); 1" >/dev/null; sleep 0.5
a "__A.yaz('zamanlayıcı iptal edilince kalkar', !__A.E()._yonetici._activities.has('zamanlayici:sayac')); imports.gi.St.Clipboard.get_default().set_text(imports.gi.St.ClipboardType.CLIPBOARD, 'flugel pano deneme'); 1" >/dev/null; sleep 1
a "__A.yaz('pano geçmişi kopyalananı kaydeder', __ar.pano.liste[0] === 'flugel pano deneme', String(__ar.pano.liste[0])); __ar.renkSec(__A.E()._ayar).then(h => { __A.renk = h; }); 1" >/dev/null; sleep 0.8
a "__A.git(200, 900); 1" >/dev/null; sleep 0.3
a "__A.bas(); __A.birak(); 1" >/dev/null; sleep 1
a "const r = __A.E()._ayar.get_strv('renk-gecmisi')[0]; __A.yaz('renk seçici: tıklanan renk HEX olarak kaydedildi', /^#[0-9A-F]{6}$/.test(r ?? '') && __A.renk === r, String(r)); 1" >/dev/null
# indirme: İndirilenler klasöründe geçici dosya → indiriliyor, son ada taşınınca → indirildi
# klasör, sağlayıcının izlediği yoldan alınır (test kabuğu kendi XDG ayarlarını kullanır)
IND=$(a "__A.E()._saglayicilar.find(s => s.id === 'indirme')?._klasor?.get_path() ?? ''" | sed "s/^(true, '\"//; s/\"')$//")
[ -d "$IND" ] || IND="$HOME/Downloads"
head -c 300000 /dev/zero > "$IND/flugel-test-indirme.bin.crdownload"; sleep 2
a "const ak = __A.E()._yonetici._activities.get('indirme:suruyor'); __A.yaz('indirme sürerken kapsülde', !!ak && ak.label.includes('flugel-test-indirme.bin'), ak ? ak.label : 'yok'); 1" >/dev/null
mv "$IND/flugel-test-indirme.bin.crdownload" "$IND/flugel-test-indirme.bin"; sleep 1.5
a "const y = __A.E()._yonetici; __A.yaz('indirme bitince duyuru, süren kalkar', !y._activities.has('indirme:suruyor') && y._activities.has('indirme:bitti'), [...y._activities.keys()].filter(k => k.startsWith('indirme')).join(',')); 1" >/dev/null
rm -f "$IND/flugel-test-indirme.bin"
a "new imports.gi.Gio.Settings({schema_id: 'org.gnome.desktop.notifications'}).set_boolean('show-banners', false); 1" >/dev/null; sleep 0.8
a "__A.yaz('rahatsız etme göstergesi', __A.E()._yonetici._activities.has('odak:dnd')); new imports.gi.Gio.Settings({schema_id: 'org.gnome.desktop.notifications'}).set_boolean('show-banners', true); __A.E()._ayar.set_string('hava-konum', 'Ankara'); 1" >/dev/null; sleep 4
a "const h = __A.E()._kart._hava; __A.yaz('kart başlığında hava durumu', h.actor.visible && /°$/.test(h._derece.text), h._derece.text); __A.E()._yonetici.setPinned(true); __A.E()._kart.sekmeSec('hizli', false); 1" >/dev/null; sleep 1.5
a "const p = __A.sayfa('hizli'); p._detayAcKapa('zaman'); 1" >/dev/null; sleep 1; foto zaman-panel
a "const p = __A.sayfa('hizli'); __A.yaz('zamanlayıcı paneli', p._detayId === 'zaman'); p._detayAcKapa('pano'); 1" >/dev/null; sleep 1
a "const p = __A.sayfa('hizli'); __A.yaz('pano paneli', p._detayId === 'pano' && p._detay.actor.get_n_children() > 1); p._detayAcKapa('renk'); 1" >/dev/null; sleep 1; foto renk-panel
a "const p = __A.sayfa('hizli'); __A.yaz('renk paneli', p._detayId === 'renk'); p._detayAcKapa('renk'); __A.E()._yonetici.setPinned(false); 1" >/dev/null; sleep 1.5
