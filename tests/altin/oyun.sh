# oyun.sh — Oyunlar sekmesi: PS Plus, Epic, fırsatlar, Steam listeleri, fiyat arama
a "__A.E()._yonetici.setPinned(true); __A.E()._kart.sekmeSec('oyun', false); 1" >/dev/null
for i in $(seq 1 60); do a "!!__A.sayfa('oyun')._psplus" | grep -q true && break; sleep 0.5; done; sleep 1
a "const p = __A.sayfa('oyun'); const n = __A.bul(p._icerik, c => (c.style_class ?? '').includes('flugel-oyun-karo')).length; __A.yaz('Oyunlar: PS Plus aylık + katalog', n >= 3, String(n)); p._sec('epic'); 1" >/dev/null
for i in $(seq 1 60); do a "!!__A.sayfa('oyun')._oyunlar" | grep -q true && break; sleep 0.5; done; sleep 1; foto oyun
a "const p = __A.sayfa('oyun'); __A.yaz('Oyunlar: Epic ücretsiz', __A.bul(p._icerik, c => (c.style_class ?? '').includes('flugel-oyun-karo')).length > 0); p._sec('firsatlar'); 1" >/dev/null; sleep 1
a "const p = __A.sayfa('oyun'); __A.yaz('Oyunlar: fırsatlar listesi', __A.bul(p._icerik, c => (c.style_class ?? '').includes('flugel-oyun-satir')).length > 5); const [x, y] = __A.merkez(p._giris); __A.git(x, y); 1" >/dev/null; sleep 0.3
a "__A.bas(); __A.birak(); 1" >/dev/null; sleep 0.4
a "const K = imports.gi.Clutter.get_default_backend().get_default_seat().create_virtual_device(imports.gi.Clutter.InputDeviceType.KEYBOARD_DEVICE); const t = () => imports.gi.GLib.get_monotonic_time(); for (const k of [...'elden ring'].map(c => c === ' ' ? 0x20 : c.charCodeAt(0)).concat([0xff0d])) { K.notify_keyval(t(), k, imports.gi.Clutter.KeyState.PRESSED); K.notify_keyval(t(), k, imports.gi.Clutter.KeyState.RELEASED); } 1" >/dev/null
for i in $(seq 1 120); do a "__A.sayfa('oyun')._kat === null && __A.sayfa('oyun')._icerik.get_n_children() === 2" | grep -q true && break; sleep 0.5; done; sleep 1; foto oyun-ara
a "const p = __A.sayfa('oyun'); const n = __A.bul(p._icerik, c => (c.style_class ?? '').includes('flugel-oyun-satir')).length; __A.yaz('Oyunlar: fiyat araması sonuç verir', n > 0, n + ' metin=' + p._giris.text + ' kat=' + p._kat + ' cocuk=' + p._icerik.get_n_children()); __A.yaz('Oyunlar: arama sonrası modal yok', Main.modalCount === 0); __A.E()._yonetici.setPinned(false); 1" >/dev/null; sleep 1
