# akicilik2.sh — uzun karelerin nereye gittiği: güncelleme (olay+JS+yerleşim) / boyama, ve açılış işleri (ms)
a "const ada = __A.E()._ada; const kart = __A.E()._kart; const G = imports.gi.GLib; const t = () => G.get_monotonic_time() / 1000; __A.ol = []; let bu = 0, bp = 0; __A.ids = [global.stage.connect('before-update', () => { bu = t(); }), global.stage.connect('before-paint', () => { bp = t(); }), global.stage.connect('after-paint', () => { const s = t(); if (bu) __A.ol.push([+(bp - bu).toFixed(1), +(s - bp).toFixed(1)]); })]; __A.sar = (o, ad) => { const asil = o[ad]; o['_asil_' + ad] = asil; o[ad] = function (...x) { const b = t(); const r = asil.apply(this, x); __A.ol.push([ad, +(t() - b).toFixed(1)]); return r; }; }; __A.sar(kart, 'acildi'); __A.sar(kart, 'kapandi'); __A.sar(ada, '_genislet'); __A.sar(ada, '_kompaktGoster'); __A.sar(ada, '_hedef'); __A.sar(ada, '_disariyiIzle'); __A.sar(ada, '_bicimle'); __A.sar(ada._kartKutu, 'show'); 1" >/dev/null
for i in 1 2; do
  a "__A.E()._yonetici.setPinned(true); 1" >/dev/null; sleep 1.2
  a "__A.E()._yonetici.setPinned(false); __A.E()._ada.daralt(); 1" >/dev/null; sleep 1.2
done
a "__A.ids.forEach(i => global.stage.disconnect(i)); const uzun = __A.ol.filter(x => typeof x[0] === 'string' || x[0] + x[1] > 18); __A.yaz('KARELER', true, JSON.stringify(uzun)); 1" >/dev/null
