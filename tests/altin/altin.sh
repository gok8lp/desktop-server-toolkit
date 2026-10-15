# altin.sh — FLUGEL Island kapsamlı test (island-test.sh ile çalışır). Sonuçlar $T/sonuc.txt
# Kullanım: tests/altin/island-test.sh tests/altin/altin.sh   (başsız GNOME Shell; sonuç: KLASOR/sonuc.txt)
D=$(dirname "$ADIM")
js(){ ev "eval(new TextDecoder().decode(imports.gi.GLib.file_get_contents('$D/$1')[1]))"; }
a(){ ev "$1"; }
isaret(){ ev "console.log('### $1'); 1" >/dev/null; }
sleep 12
js 00-yardim.js
isaret BASLANGIC
js 01-baslangic.js
js 02-sekmeler.js; sleep 1
js 03-secici.js
js 04-altgorunum.js; sleep 1
a "__A.E()._kart.sekmeSec('hizli', false); __A.E()._yonetici.setPinned(false); 1" >/dev/null; sleep 2
isaret GIRDI
# --- sanal fare / dokunmatik yüzey ---
a "__A.E()._ayar.set_string('tetik', 'hover'); const [x, y] = __A.merkez(__A.E()._ada._kok); __A.git(x, y); __A.E()._ada.durum" ; sleep 1.5
a "__A.yaz('fare: kapsül üzerine gelince kart açılır', __A.E()._ada.durum === 'genis', __A.E()._ada.durum); 1" >/dev/null
a "const k = __A.E()._kart; const [x, y] = __A.merkez(k._sekmeler.get('kripto').dugme); __A.git(x, y); __A.bas(); __A.birak(); 1" >/dev/null; sleep 0.6
a "__A.yaz('fare: sekmeye tıklama', __A.E()._kart._secili.id === 'kripto', __A.E()._kart._secili.id); 1" >/dev/null
a "__A.sayfa('kripto')._detayAc('BTC'); 1" >/dev/null; sleep 3
a "const g = __A.sayfa('kripto')._grafik; const e = g.actor.get_transformed_extents(); __A.gx = e.origin.x; __A.gy = e.origin.y + e.size.height / 2; __A.git(__A.gx + 120, __A.gy); 1" >/dev/null; sleep 0.3
a "__A.yaz('grafik: üzerine gelince imleç', __A.sayfa('kripto')._grafik._imlec !== null, String(__A.sayfa('kripto')._grafik._imlec)); __A.bas(); 1" >/dev/null; sleep 0.2
a "__A.git(__A.gx + 360, __A.gy); 1" >/dev/null; sleep 0.3
a "const o = __A.sayfa('kripto')._grafik._olcum; __A.yaz('grafik: sürükleyince ölçüm', !!o && o.bas !== o.bit, JSON.stringify(o)); __A.isaretOnce = __A.sayfa('kripto')._cizgiler().length; __A.birak(); 1" >/dev/null; sleep 0.3
a "__A.yaz('grafik: sürükleme işaret koymaz', __A.sayfa('kripto')._cizgiler().length === __A.isaretOnce); __A.sayfa('kripto')._tikKip = 'isaret'; __A.git(__A.gx + 200, __A.gy); 1" >/dev/null; sleep 0.2
a "__A.bas(); __A.birak(); 1" >/dev/null; sleep 0.4
a "__A.yaz('grafik: tıklayınca işaret', __A.sayfa('kripto')._cizgiler().length === __A.isaretOnce + 1); 1" >/dev/null; sleep 0.3
a "const g = __A.sayfa('kripto')._grafik; const c = g._cizgiler.find(x => x.tur === 'isaret'); const e = g.actor.get_transformed_extents(); const al = g._alan(); const [enAz, enCok] = g._aralik(); const yy = al.ust + (1 - (c.fiyat - enAz) / (enCok - enAz)) * (al.alt - al.ust); __A.git(__A.gx + 200, e.origin.y + yy); __A.bas(3); __A.birak(3); 1" >/dev/null; sleep 0.4
a "__A.yaz('grafik: sağ tık işareti siler', __A.sayfa('kripto')._cizgiler().length === __A.isaretOnce); __A.sayfa('kripto')._detayKapat(false); 1" >/dev/null
a "__A.git(10, 800); 1" >/dev/null; sleep 2
a "__A.yaz('fare: uzaklaşınca kart kapanır', __A.E()._ada.durum !== 'genis', __A.E()._ada.durum); 1" >/dev/null
# çalışma alanı: iki parmak kaydırma
a "global.workspace_manager.append_new_workspace(false, global.get_current_time()); global.workspace_manager.append_new_workspace(false, global.get_current_time()); __A.ws0 = global.workspace_manager.get_active_workspace_index(); const [x, y] = __A.merkez(__A.E()._ada._kok); __A.git(x, y); __A.kaydir(30); 1" >/dev/null; sleep 0.5
a "__A.yaz('dokunmatik: kapsülde iki parmakla çalışma alanı değişir', global.workspace_manager.get_active_workspace_index() !== __A.ws0, global.workspace_manager.n_workspaces + ' / ' + global.workspace_manager.get_active_workspace_index()); __A.yaz('dokunmatik: kaydırırken kart açılmaz', __A.E()._ada.durum !== 'genis', __A.E()._ada.durum); __A.ws1 = global.workspace_manager.get_active_workspace_index(); 1" >/dev/null; sleep 1.2
a "__A.yaz('imleç kalınca kart sonra açılır', __A.E()._ada.durum === 'genis', __A.E()._ada.durum); const [x, y] = __A.merkez(__A.E()._kart.ustSerit); __A.git(x + 60, y); 1" >/dev/null; sleep 0.4
a "__A.kaydir(-1, false); 1" >/dev/null; sleep 0.8
a "__A.yaz('kart açıkken üst şeritte tekerlek çalışma alanı değiştirir', global.workspace_manager.get_active_workspace_index() !== __A.ws1, String(global.workspace_manager.get_active_workspace_index())); __A.git(10, 800); 1" >/dev/null; sleep 1.5
isaret HIZLI
. "$D/hizli-detay.sh"
isaret DUGMELER
. "$D/ust-dugmeler.sh"
isaret PENCERE
. "$D/pencere.sh"
isaret CS2
# --- CS2 raund vurgusu ---
js 06-cs2.js; sleep 1
a "__A.veriVer('cs2', __A.cs2(6, 3)); __A.cs2Etiket()"; sleep 0.5
a "const e = __A.cs2Etiket(); __A.yaz('CS2: raundu alan (ev) vurgulandı', e.includes('Eternal Fire*') && !e.includes('Vitality*'), e); 1" >/dev/null
foto cs2-vurgu
sleep 5
a "const e = __A.cs2Etiket(); __A.yaz('CS2: vurgu 4,5 sn sonra söner', !e.includes('*'), e); __A.veriVer('cs2', __A.cs2(6, 4)); 1" >/dev/null; sleep 0.5
a "const e = __A.cs2Etiket(); __A.yaz('CS2: rakip raundu alınca o vurgulanır', e.includes('Vitality*') && !e.includes('Eternal Fire*'), e); __A.veriVer('cs2', __A.cs2(0, 0, 1, 0, 2)); 1" >/dev/null; sleep 0.5
a "const e = __A.cs2Etiket(); const ak = __A.E()._yonetici._activities.get('basket:cs2'); __A.yaz('CS2: harita değişince sıfırdan, yanlış vurgu yok', ak && ak.data.mac.skor === '0 – 0' && ak.data.mac.dakika === 'Inferno', ak ? JSON.stringify(ak.data.mac) : 'yok'); __A.veriVer('cs2', {canli: [], yaklasan: []}); __A.E()._ayar.set_int('cs2-takip', 0); 1" >/dev/null; sleep 0.5
a "__A.yaz('CS2: maç bitince kapsülden kalkar', __A.E()._yonetici._activities.get('basket:cs2')?.data?.mac?.ev !== 'Eternal Fire'); 1" >/dev/null
isaret ALARM
js 07-alarm.js; sleep 1; foto alarm-flas
isaret DONGU
# --- aç/kapat döngüsü, sızıntı ---
for i in 1 2 3 4 5; do a "Main.extensionManager.disableExtension('flugel-island@flugel'); 1" >/dev/null; sleep 0.7; a "Main.extensionManager.enableExtension('flugel-island@flugel'); 1" >/dev/null; sleep 1.2; done
a "Main.extensionManager.disableExtension('flugel-island@flugel'); 1" >/dev/null; sleep 1
a "const n = __A.bul(global.stage, k => /flugel-/.test(k.style_class ?? '')).length; __A.yaz('kapatınca adadan aktör kalmaz', n === 0, String(n)); __A.yaz('kapatınca üst çubuk geri gelir', Main.panel.statusArea.activities.container.visible && Main.panel.statusArea.dateMenu.opacity === 255); __A.yaz('kapatınca modal yok', Main.modalCount === 0); 1" >/dev/null
a "Main.extensionManager.enableExtension('flugel-island@flugel'); 1" >/dev/null; sleep 3
a "imports.system.gc(); 1" >/dev/null; sleep 1
isaret DIL
# --- İngilizce ---
a "__A.E()._ayar.set_string('dil', 'en'); Main.extensionManager.disableExtension('flugel-island@flugel'); Main.extensionManager.enableExtension('flugel-island@flugel'); 1" >/dev/null; sleep 3
a "const ad = __A.E()._kart._sayfalar.map(s => s.ad).join(','); __A.yaz('İngilizce sekme adları', ad.startsWith('Quick') && ad.includes('Matches') && ad.includes('Notifications'), ad); __A.E()._yonetici.setPinned(true); __A.E()._kart.sekmeSec('basket', false); 1" >/dev/null; sleep 2; foto en-maclar
a "__A.E()._ayar.set_string('dil', 'tr'); Main.extensionManager.disableExtension('flugel-island@flugel'); Main.extensionManager.enableExtension('flugel-island@flugel'); 1" >/dev/null; sleep 3
isaret UZUN
# --- uzun çalışma: veri yenilemeleri, sekme dolaşma ---
a "__A.E()._yonetici.setPinned(true); 1" >/dev/null
for t in 1 2 3; do for s in hizli kisayol sistem vm kripto basket anime bildirim; do a "__A.E()._kart.sekmeSec('$s'); 1" >/dev/null; sleep 0.4; done; done
a "__A.uzun0 = __A.bul(global.stage, () => true).length; 1" >/dev/null
sleep 60
for s in hizli kisayol sistem vm kripto basket anime bildirim; do a "__A.E()._kart.sekmeSec('$s'); 1" >/dev/null; sleep 0.4; done
a "const n = __A.bul(global.stage, () => true).length; __A.yaz('uzun çalışmada aktör sayısı sabit', Math.abs(n - __A.uzun0) < 150, __A.uzun0 + ' → ' + n); __A.yaz('modal yok (son)', Main.modalCount === 0); 1" >/dev/null
a "imports.system.gc(); 1" >/dev/null; sleep 1
isaret SON
ev "__A.sonuc.join(' ## ')" | sed "s/^(true, '//; s/')\$//; s/ ## /\n/g" > "$T/sonuc.txt"
