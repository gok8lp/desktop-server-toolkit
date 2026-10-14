(() => {
    const A = globalThis.__A;
    const E = A.E();
    const sp = global.display.get_sound_player();
    A.sesler = [];
    if (!sp.__orijinal) {
        sp.__orijinal = sp.play_from_theme;
        sp.play_from_theme = (...a) => A.sesler.push(a[0]);
    }
    const d = E._veri.son('kizle');
    const eth = d?.koinler?.find(k => k.s === 'ETH');
    if (!eth) return 'ETH verisi yok';
    E._ayar.set_string('kripto-alarmlar', JSON.stringify([
        {id: 'test-ust', s: 'ETH', fiyat: Math.floor(eth.fiyat * 0.99), yon: 'ust'},
        {id: 'test-uzak', s: 'ETH', fiyat: Math.floor(eth.fiyat * 2), yon: 'ust'}]));
    A.veriVer('kizle', d);
    const kalan = JSON.parse(E._ayar.get_string('kripto-alarmlar'));
    A.dene('alarm: çalan alarm silindi, uzaktaki kaldı', () => kalan.length === 1 && kalan[0].id === 'test-uzak' || JSON.stringify(kalan));
    A.dene('alarm: kapsülde uyarı', () => !!E._yonetici.get?.('kripto:alarm:test-ust') || E._yonetici._activities?.has?.('kripto:alarm:test-ust') || JSON.stringify([...(E._yonetici._activities?.keys?.() ?? [])]));
    A.dene('alarm: ses çaldı', () => A.sesler.includes('alarm-clock-elapsed') || JSON.stringify(A.sesler));
    E._ayar.set_string('kripto-alarmlar', '[]');
    return 'ok';
})()
