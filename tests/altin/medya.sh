# medya.sh — kart içi oynatıcı (sahte MPRIS çalar), kapsül ekolayzeri, güç paneli
python3 -c "
from PIL import Image
im = Image.new('RGB', (64, 64))
for y in range(64):
    for x in range(64):
        im.putpixel((x, y), (200 + x // 2, 60 + y, 40))
im.save('$T/kapak.png')"
python3 "$D/sahte-mpris.py" "$T/kapak.png" > "$T/mpris.txt" 2>&1 & PM=$!
sleep 3
a "__A.E()._yonetici.setPinned(true); __A.E()._kart.sekmeSec('hizli', false); 1" >/dev/null; sleep 1.5
a "const o = [...__A.E()._kart._canliGorunumler.values()].find(g => g._m?.bus === 'org.mpris.MediaPlayer2.flugeltest'); __A.oy = o; __A.yaz('oynatıcı kartta', !!o && o._baslik.text.startsWith('Hear Me Lord'), o ? o._baslik.text : 'yok'); __A.yaz('oynatıcı: kalan süre ve ekolayzer', !!o && o._kalan.text.startsWith('−') && o._esit._caliyor, o ? o._gecen.text + ' / ' + o._kalan.text : ''); 1" >/dev/null
foto medya-kart
a "__A.oy._sonraki.emit('clicked', 3); 1" >/dev/null; sleep 0.4
a "__A.oy._onceki.emit('clicked', 3); 1" >/dev/null; sleep 0.4
a "const o = __A.oy; __A.yaz('oynatıcı: kapaktan vurgu rengi (sanatçı, ilerleme, ekolayzer tonlanır)', !!o._vurgu && (o._sanatci.style ?? '').includes('rgb(') && o._cubuk.style?.includes('rgb('), JSON.stringify(o._vurgu)); __A.yaz('oynatıcı: uygulama rozeti kapakta', o._rozet.visible && !!o._rozet.gicon, String(o._rozet.gicon)); o._karistir.emit('clicked', 1); o._tekrar.emit('clicked', 1); 1" >/dev/null; sleep 0.8
a "const o = __A.oy; __A.yaz('oynatıcı: karıştır ve tekrar çalara ulaşır, düğmeler durumu gösterir', o._karistir.has_style_pseudo_class('checked') && o._tekrar.has_style_pseudo_class('checked') && o._m.dongu === 'Playlist', o._m.karistir + ' ' + o._m.dongu); 1" >/dev/null
a "__A.oy._konumaGit(200e6); 1" >/dev/null; sleep 0.4
a "__A.oy._sonraki.emit('clicked', 1); 1" >/dev/null; sleep 1
a "__A.yaz('oynatıcı: sonraki parçada başlık değişti', __A.oy._baslik.text === 'Ikinci Parca', __A.oy._baslik.text); __A.oy._oynat.emit('clicked', 1); 1" >/dev/null; sleep 1
a "__A.yaz('oynatıcı: duraklatınca ekolayzer durur', !__A.oy._esit._caliyor); 1" >/dev/null
KOMUTLAR=$(grep -o "KOMUT [A-Za-z]* *-\?[0-9]*" "$T/mpris.txt" | tr '\n' ',')
case "$KOMUTLAR" in *"Seek 10000000"*"Seek -10000000"*"SetPosition"*"Next"*"PlayPause"*) MOK=true ;; *) MOK=false ;; esac
a "__A.yaz('oynatıcı: komutlar çalara ulaştı (±10 sn, konum, sonraki, duraklat)', $MOK, '$KOMUTLAR'); 1" >/dev/null
# güç paneli
a "const k = __A.E()._kart; k._gucAcKapa(true); 1" >/dev/null; sleep 0.6
a "const k = __A.E()._kart; __A.yaz('güç paneli açılır (6 düğme)', k._gucPanel.visible && k._gucPanel.get_n_children() === 6, String(k._gucPanel.get_n_children())); 1" >/dev/null; foto guc-panel
a "const k = __A.E()._kart; k._gucAcKapa(false); 1" >/dev/null; sleep 0.6
a "__A.yaz('güç paneli kapanır', !__A.E()._kart._gucPanel.visible); __A.E()._yonetici.setPinned(false); 1" >/dev/null; sleep 1.5
a "const e = __A.bul(__A.E()._ada._kok, k => (k.style_class ?? '').includes('flugel-esitleyici')); __A.yaz('kapsülde ekolayzer var', e.length > 0); 1" >/dev/null
kill $PM 2>/dev/null; sleep 1
