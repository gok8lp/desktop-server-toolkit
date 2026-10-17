# cam.sh — iOS tarzı buzlu cam: kart açıkken altındaki pencere bulanık görünür; bulanık geçişler iz bırakmaz
WD=$(grep -o "Using Wayland display name '[^']*'" "$T/shell.log" | head -1 | cut -d"'" -f2)
WAYLAND_DISPLAY=$WD GDK_BACKEND=wayland python3 "$D/sahte-renkli.py" & PR=$!
sleep 3.5
a "const ada = __A.E()._ada; __A.yaz('cam: kapsülde cam çizilmez', !ada._cam.actor.visible); 1" >/dev/null
a "__A.E()._yonetici.setPinned(true); __A.E()._kart.sekmeSec('hizli', false); const ada = __A.E()._ada; __A.yaz('geçiş: aynı anda yalnız gelen içerik bulanık', !!ada._kartKutu.get_effect('flugel-gecis-bulanik') && !ada._kompakt.get_effect('flugel-gecis-bulanik')); 1" >/dev/null; sleep 2
a "const ada = __A.E()._ada; const c = ada._cam; __A.yaz('cam: kart açıkken cam görünür', c.actor.visible && c.actor.opacity > 200, c.actor.visible + ' ' + c.actor.opacity); __A.yaz('cam: kopya adanın yerine hizalı', c._sahne.x === -c.actor.x && c._sahne.y === -ada._kok.y && c.actor.x <= ada._kok.x && c.actor.x + c.actor.width >= ada._kok.x + ada._kok.width && c._sahne.get_n_children() > 1, c._sahne.x + ',' + c._sahne.y + ' kutu=' + c.actor.x + '+' + c.actor.width + ' n=' + c._sahne.get_n_children()); __A.yaz('cam: bulanıklık ve köşe maskesi bağlı', !!c.actor.get_effect('flugel-cam-bulanik') && !!c.actor.get_effect('flugel-cam-kose') && c._bulanik.radius > 0, String(c._bulanik.radius)); __A.yaz('cam: kart zemini saydam', (ada._zemin.style ?? '').includes(',0.72)'), ada._zemin.style); __A.yaz('geçiş: açılış bulanıklığı bitince kalkar', !ada._kartKutu.get_effect('flugel-gecis-bulanik') && ada._kartKutu.scale_x === 1, String(ada._kartKutu.scale_x)); 1" >/dev/null
foto cam-acik
a "__A.E()._kart.sekmeSec('sistem', true); 1" >/dev/null; sleep 0.08
a "__A.ebc = !!__A.E()._kart._secili.sayfa.actor.get_effect('flugel-gecis-bulanik'); 1" >/dev/null; sleep 0.8
a "const s = __A.E()._kart._secili.sayfa.actor; __A.yaz('geçiş: sekme değişince bulanık geçiş olur ve kalkar', __A.ebc && !s.get_effect('flugel-gecis-bulanik') && !s._flugelGecis, __A.ebc + ' ' + !!s.get_effect('flugel-gecis-bulanik')); 1" >/dev/null
a "__A.E()._ayar.set_boolean('cam-efekti', false); 1" >/dev/null; sleep 0.6
a "const ada = __A.E()._ada; __A.yaz('cam: ayar kapanınca cam gizlenir, kart koyu', !ada._cam.actor.visible && (ada._zemin.style ?? '').includes(',0.95)'), ada._zemin.style); __A.E()._ayar.reset('cam-efekti'); 1" >/dev/null; sleep 0.4
a "__A.E()._yonetici.setPinned(false); __A.E()._ada.daralt(); 1" >/dev/null; sleep 1.5
a "const ada = __A.E()._ada; __A.yaz('cam: kart kapanınca cam gizlenir', !ada._cam.actor.visible); __A.yaz('geçiş: kapsül içeriğinde bulanıklık kalmaz', !ada._kompakt.get_effect('flugel-gecis-bulanik') && ada._kompakt.get_children().every(c => !c.get_effect('flugel-gecis-bulanik') || c._flugelGidiyor), ada._kompakt.get_children().length + ''); 1" >/dev/null
# sanal imleç sıçradığı için kalan "üzerinde" durumu temizlenir: kapsülün üstüne gelip hemen çıkılır
a "const k = __A.E()._ada._kok; __A.git(k.x + k.width / 2, k.y + k.height / 2); 1" >/dev/null; sleep 0.05
a "__A.git(10, 800); 1" >/dev/null; sleep 0.8
a "__A.yaz('cam testi sonrası ada kapalı ve üzerinde değil', __A.E()._ada._durum !== 'genis' && !__A.E()._ada._ustunde, __A.E()._ada._durum + ' ' + __A.E()._ada._ustunde); 1" >/dev/null
# basınca içe göçme (sanal fareyle kapsüle tıklamak sonraki testlerde eski imleç izi bıraktığı için doğrudan çağrılır)
a "__A.E()._ada._basKucul(true); 1" >/dev/null; sleep 0.25
a "__A.bsc = __A.E()._ada._kok.scale_x; __A.E()._ada._basKucul(false); 1" >/dev/null; sleep 0.6
a "__A.yaz('basınca kapsül içe göçer ve geri yaylanır', __A.bsc < 0.99 && __A.E()._ada._kok.scale_x === 1, __A.bsc + ' → ' + __A.E()._ada._kok.scale_x); 1" >/dev/null
kill $PR 2>/dev/null; sleep 1
# yay: açılırken hedef değişince (hemen kapatma) hareket durmaz, hızını koruyarak döner
a "const ada = __A.E()._ada; __A.hs = []; __A.asilGeo2 = ada._geoUygula.bind(ada); ada._geoUygula = g => { __A.hs.push(Math.round(g.h)); __A.asilGeo2(g); }; __A.E()._yonetici.setPinned(true); 1" >/dev/null; sleep 0.09
a "__A.donus = __A.hs.length; __A.E()._yonetici.setPinned(false); __A.E()._ada.daralt(); 1" >/dev/null; sleep 1.2
a "const ada = __A.E()._ada; ada._geoUygula = __A.asilGeo2; const h = __A.hs, i = __A.donus; const devam = h[i + 1] > h[i - 1]; __A.yaz('yay: yön değişince hız korunur (önce biraz devam eder, sonra döner)', devam && h[h.length - 1] < h[i], h.slice(Math.max(0, i - 2), i + 4).join(',') + ' son=' + h[h.length - 1]); 1" >/dev/null
