# akicilik3.sh — açılış/kapanış boyunca kare başına güncelleme ve boyama ortalaması (ms); OLC ile etiket
a "const G = imports.gi.GLib; const t = () => G.get_monotonic_time() / 1000; __A.ol = []; let bu = 0, bp = 0; __A.ids = [global.stage.connect('before-update', () => { bu = t(); }), global.stage.connect('before-paint', () => { bp = t(); }), global.stage.connect('after-paint', () => { if (bu) __A.ol.push([bp - bu, t() - bp]); })]; 1" >/dev/null
for i in 1 2 3; do
  a "__A.E()._yonetici.setPinned(true); 1" >/dev/null; sleep 1.1
  a "__A.E()._yonetici.setPinned(false); __A.E()._ada.daralt(); 1" >/dev/null; sleep 1.1
done
a "__A.ids.forEach(i => global.stage.disconnect(i)); const o = __A.ol; const ort = i => (o.reduce((x, y) => x + y[i], 0) / Math.max(1, o.length)).toFixed(2); const p = o.map(x => x[1]).sort((x, y) => x - y); __A.yaz('OLCUM ${OLC:-}', true, 'kare=' + o.length + ' guncelleme=' + ort(0) + ' boyama=' + ort(1) + ' boyama-p90=' + (p[Math.floor(p.length * 0.9)] ?? 0).toFixed(1)); 1" >/dev/null
