(() => {
    const A = globalThis.__A;
    const E = A.E();
    const modal = () => Main.modalCount;
    // kripto
    const kr = A.sayfa('kripto');
    E._kart.sekmeSec('kripto', false);
    A.dene('kripto: ayrıntı açılır', () => { kr._detayAc('BTC'); return !!kr._grafik && kr._detay.visible; });
    A.dene('kripto: grafik tıklayınca işaret', () => {
        const once = kr._cizgiler().length;
        kr._tikKip = 'isaret';
        kr._grafikTik(12345.678);
        return kr._cizgiler().length === once + 1 || `${once} → ${kr._cizgiler().length}`;
    });
    A.dene('kripto: sağ tık işareti siler', () => {
        const c = kr._cizgiler().find(x => x.fiyat === 12346);
        kr._grafik.cizgiSil(c);
        return !kr._cizgiler().some(x => x.fiyat === 12346);
    });
    A.dene('kripto: fiyat girişi ayrıştırma', () => {
        const dene = (m, beklenen) => {
            kr._alarmGiris.text = m;
            const once = JSON.parse(E._ayar.get_string('kripto-alarmlar')).length;
            kr._alarmKur();
            const l = JSON.parse(E._ayar.get_string('kripto-alarmlar'));
            const son = l[l.length - 1];
            const ok = l.length === once + 1 && Math.abs(son.fiyat - beklenen) < 1e-9;
            if (l.length > once)
                E._ayar.set_string('kripto-alarmlar', JSON.stringify(l.slice(0, -1)));
            return ok ? '' : `${m} → ${son?.fiyat}`;
        };
        const hatalar = [['81,500', 81500], ['81.500', 81500], ['1.0181', 1.0181], ['0,25', 0.25], ['85000', 85000], ['81.500,5', 81500.5]]
            .map(([m, b]) => dene(m, b)).filter(Boolean);
        return hatalar.length ? hatalar.join(' ; ') : true;
    });
    A.dene('kripto: ayrıntı kapanınca modal bırakılır', () => { kr._detayKapat(false); return modal() === 0 && kr._liste.visible || `modal ${modal()}`; });
    A.dene('kripto: koin ekleme paneli modal alır/bırakır', () => {
        kr._secimAc();
        const acik = modal();
        kr._secimKapat();
        return acik === 1 && modal() === 0 || `açık ${acik} kapalı ${modal()}`;
    });
    // hızlı
    const hz = A.sayfa('hizli');
    E._kart.sekmeSec('hizli', false);
    A.dene('hızlı: uygulama ekleme paneli', () => {
        hz._uygAcKapa();
        const n = hz._uygIzgara.sayi, m = modal();
        hz.gizle();
        return n > 5 && m === 1 && modal() === 0 || `uygulama ${n} modal ${m}/${modal()}`;
    });
    A.dene('hızlı: hızlı ayar karoları', () => hz._ayarIzgara.sayi >= 6 || `${hz._ayarIzgara.sayi}`);
    // kısayollar
    const ks = A.sayfa('kisayol');
    E._kart.sekmeSec('kisayol', false);
    A.dene('kısayollar: kategori ayrıntısı ve dönüş', () => { ks._detayAc(0); ks._anaDon(); return true; });
    // sistem
    const si = A.sayfa('sistem');
    E._kart.sekmeSec('sistem', false);
    A.dene('sistem: PC ayrıntısı', () => { si._detayAc('pc'); const ok = si._detay.visible; si._anaDon(false); return ok; });
    A.dene('sistem: sunucu ayrıntısı', () => { si._detayAc('sunucu'); const ok = si._detay.visible; si._anaDon(false); return ok; });
    // anime
    const an = A.sayfa('anime');
    E._kart.sekmeSec('anime', false);
    A.dene('anime: kapağa tıklayınca ayrıntı', () => {
        const d = E._veri.son('anime');
        const a = an._kayitlar(d)[0];
        if (!a) return 'veri yok';
        an._detayAc(a);
        const ok = an._detay.visible;
        an._detayKapat();
        return ok;
    });
    A.dene('anime: seçim paneli modal', () => { an._secimAc(); const m = modal(); an._secimKapat(); return m === 1 && modal() === 0 || `${m}/${modal()}`; });
    // maçlar
    const mc = A.sayfa('basket');
    E._kart.sekmeSec('basket', false);
    for (const k of ['onemli', 'futbol', 'basketbol', 'milli', 'derbi', 'takimlar', 'ozel', 'cs2']) {
        A.dene(`maçlar: ${k}`, () => { mc._kat = k; mc._yaz({animasyon: true}); return mc._liste.get_n_children() > 0; });
    }
    A.dene('maçlar: işlem çubuğu aç/kapat', () => {
        mc._kat = 'onemli'; mc._yaz({animasyon: true});
        const k = mc._satirlar[0];
        if (!k) return 'satır yok';
        k.get_child_at_index(0).emit('clicked', 1);
        const acik = k.get_n_children() === 2;
        k.get_child_at_index(0).emit('clicked', 1);
        return acik;
    });
    // bildirimler
    const bl = A.sayfa('bildirim');
    E._kart.sekmeSec('bildirim', false);
    for (const k of ['hepsi', 'uyari', 'bilgi', 'sessiz'])
        A.dene(`bildirimler: ${k}`, () => { bl._suzgec = k; bl._yaz(true); return bl._liste.get_n_children() > 0; });
    A.dene('bildirimler: kategori susturma', () => {
        const s = E._ayar.get_string('sunucu-sessiz');
        bl._liste; E._ayar.set_string('sunucu-sessiz', JSON.stringify({yedek: 0}));
        bl._yaz(true);
        E._ayar.set_string('sunucu-sessiz', s);
        return true;
    });
    // vm
    E._kart.sekmeSec('vm', false);
    A.dene('vm: sayfa çizildi', () => A.sayfa('vm').actor.get_n_children() > 0);
    A.dene('tüm alt görünümlerden sonra modal yok', () => modal() === 0 || `${modal()}`);
    return 'ok';
})()
