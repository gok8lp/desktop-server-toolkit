# atoll.sh — Atoll tasarımları: canlı izleme kartları, tasarım kipi (Atoll / önceki) anında geçiş ve geri dönüş
python3 "$D/sahte-mpris.py" > "$T/mpris2.txt" 2>&1 & PM2=$!
sleep 2.5
a "__A.E()._ayar.set_string('tasarim', 'atoll'); __A.E()._yonetici.setPinned(true); __A.E()._kart.sekmeSec('sistem', false); 1" >/dev/null; sleep 3.5
a "const p = __A.sayfa('sistem'); const i = p._istat; __A.yaz('canlı izleme: işlemci, bellek ölçülür, grafikler dolar', p._istatBolum.visible && i._cpu.deger.text.endsWith('%') && i._bellek.deger.text.endsWith('%') && i._cpu.grafik.seriler[0].length >= 2, i._cpu.deger.text + ' ' + i._bellek.deger.text + ' ' + i._gpu.deger.text + ' n=' + i._cpu.grafik.seriler[0].length); __A.yaz('canlı izleme: ağ ve disk iki yönlü', i._ag.grafik.seriler.length === 2 && i._ag.grafik.seriler[1].length >= 1 && i._ag.deger.text.includes('/s'), i._ag.deger.text + ' | ' + i._disk.deger.text); 1" >/dev/null
foto atoll-istat
a "const i = __A.sayfa('sistem')._istat; i._durdurDevam(); __A.dn = i._cpu.grafik.seriler[0].length; 1" >/dev/null; sleep 1.6
a "const i = __A.sayfa('sistem')._istat; __A.yaz('canlı izleme: durdurunca ölçüm durur, başlatınca sürer', !i._id && i._cpu.grafik.seriler[0].length === __A.dn && i._canliYazi.text !== 'Canlı', String(i._cpu.grafik.seriler[0].length)); i._durdurDevam(); 1" >/dev/null; sleep 1.2
a "const i = __A.sayfa('sistem')._istat; __A.yaz('canlı izleme: yeniden başlar', !!i._id && i._canliYazi.text === 'Canlı'); __A.E()._kart.sekmeSec('hizli', false); 1" >/dev/null; sleep 1
a "const o = [...__A.E()._kart._canliGorunumler.values()].find(g => g._m?.bus === 'org.mpris.MediaPlayer2.flugeltest'); __A.yaz('tasarım: Atoll oynatıcı', o?.constructor.name === 'MedyaOynatici', o?.constructor.name); __A.E()._ayar.set_string('tasarim', 'klasik'); 1" >/dev/null; sleep 1
a "const o = [...__A.E()._kart._canliGorunumler.values()].find(g => g._m?.bus === 'org.mpris.MediaPlayer2.flugeltest'); __A.yaz('tasarım: önceki görünüme anında döner (oynatıcı)', o?.constructor.name === 'MedyaOynaticiKlasik' && o._baslik.text.length > 0, o?.constructor.name); __A.sayfa('hizli')._detayAcKapa('pano'); 1" >/dev/null; sleep 0.9
a "const p = __A.sayfa('hizli'); __A.yaz('tasarım: önceki pano paneli', p._detay?.constructor.name === 'PanoPaneliKlasik', p._detay?.constructor.name); p._detayAcKapa('renk'); 1" >/dev/null; sleep 0.9
a "const p = __A.sayfa('hizli'); __A.yaz('tasarım: önceki renk paneli, canlı izleme gizli', p._detay?.constructor.name === 'RenkPaneliKlasik' && !__A.sayfa('sistem')._istatBolum.visible, p._detay?.constructor.name); p._detayAcKapa('renk'); 1" >/dev/null; sleep 0.8
foto atoll-klasik
a "__A.E()._ayar.set_string('tasarim', 'atoll'); 1" >/dev/null; sleep 1
a "const o = [...__A.E()._kart._canliGorunumler.values()].find(g => g._m?.bus === 'org.mpris.MediaPlayer2.flugeltest'); __A.yaz('tasarım: Atoll düzenine geri geçer', o?.constructor.name === 'MedyaOynatici' && __A.sayfa('sistem')._istatBolum.visible, o?.constructor.name); __A.E()._ayar.reset('tasarim'); __A.E()._yonetici.setPinned(false); __A.E()._ada.daralt(); 1" >/dev/null; sleep 1
kill $PM2 2>/dev/null; sleep 1
