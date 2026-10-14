(() => {
    const A = globalThis.__A;
    const E = A.E();
    E._ayar.set_boolean('mac-canli-etkinlik', true);
    E._ayar.set_boolean('cs2-etkin', true);
    E._ayar.set_int('cs2-takip', 999001);
    A.cs2 = (r1, r2, h1 = 0, h2 = 0, no = 1) => ({canli: [{id: 999001, yildiz: 3, canli: true, etkinlik: 'Test Cup', bo: 'bo3',
        harita_no: no, simdiki_harita: ['Mirage', 'Inferno', 'Nuke'][no - 1], haritalar: ['Mirage', 'Inferno', 'Nuke'],
        takim1: {ad: 'Eternal Fire', raund: r1, harita: h1}, takim2: {ad: 'Vitality', raund: r2, harita: h2}}], yaklasan: [], zaman: Date.now()});
    A.cs2Etiket = () => {
        const l = A.bul(E._ada._kok, k => (k.style_class ?? '').includes('flugel-mac-kapsul-takim'));
        return l.map(k => `${k.text}${k.has_style_class_name('flugel-mac-kapsul-raund') ? '*' : ''}`).join('|');
    };
    A.veriVer('cs2', A.cs2(5, 3));
    return A.cs2Etiket();
})()
