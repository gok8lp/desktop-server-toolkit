// ortak yardımcılar (Eval kapsamında globalThis.__A)
(() => {
    const {GLib, Clutter, St} = imports.gi;
    const A = globalThis.__A = {sonuc: []};
    A.E = () => Main.extensionManager.lookup('flugel-island@flugel').stateObj;
    A.sayfa = id => A.E()._kart._sayfalar.find(s => s.id === id).sayfa;
    A.yaz = (ad, kosul, ayrinti = '') => {
        A.sonuc.push(`${kosul ? 'OK  ' : 'HATA'} ${ad}${ayrinti ? ` — ${ayrinti}` : ''}`);
        return kosul;
    };
    A.dene = (ad, fn) => {
        try {
            const r = fn();
            A.yaz(ad, r !== false, typeof r === 'string' ? r : '');
        } catch (e) {
            A.yaz(ad, false, `${e}`.slice(0, 160));
        }
    };
    A.zaman = () => GLib.get_monotonic_time();
    const seat = Clutter.get_default_backend().get_default_seat();
    A.fare = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
    A.git = (x, y) => A.fare.notify_absolute_motion(A.zaman(), x, y);
    A.bas = (b = 1) => A.fare.notify_button(A.zaman(), b, Clutter.ButtonState.PRESSED);
    A.birak = (b = 1) => A.fare.notify_button(A.zaman(), b, Clutter.ButtonState.RELEASED);
    A.merkez = a => {
        const e = a.get_transformed_extents();
        return [e.origin.x + e.size.width / 2, e.origin.y + e.size.height / 2];
    };
    // dokunmatik yüzey: iki parmak kaydırma (sürekli) ve tekerlek (kesikli)
    A.kaydir = (dy, parmak = true) => {
        if (parmak) {
            A.fare.notify_scroll_continuous(A.zaman(), 0, dy, Clutter.ScrollSource.FINGER, Clutter.ScrollFinishFlags.NONE);
            A.fare.notify_scroll_continuous(A.zaman(), 0, 0, Clutter.ScrollSource.FINGER, Clutter.ScrollFinishFlags.VERTICAL);
        } else {
            A.fare.notify_discrete_scroll(A.zaman(), dy > 0 ? Clutter.ScrollDirection.DOWN : Clutter.ScrollDirection.UP, Clutter.ScrollSource.WHEEL);
        }
    };
    // ada içindeki aktörler arasında ara
    A.bul = (kok, kosul) => {
        const out = [];
        const gez = a => {
            for (const k of a.get_children()) {
                if (kosul(k))
                    out.push(k);
                gez(k);
            }
        };
        gez(kok);
        return out;
    };
    A.veriVer = (tur, d) => {
        const v = A.E()._veri;
        v._veri.set(tur, d);
        for (const fn of v._aboneler.get(tur) ?? [])
            fn(d);
    };
    A.St = St;
    return 'yardim hazir';
})()
