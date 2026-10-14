// FLUGEL Island — kart sayfalarının temeli.
// PopupMenuSection'dır: FLUGEL v1 panelindeki menü öğeleri (alt menüler, anahtarlar) olduğu gibi çalışır.
// Bir alt menü açılınca öncekini kapatır (akordeon), menülerdeki davranışla aynı.
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// Ada büyürken/küçülürken sayfa yeniden kurulmaz: gelen veri animasyon bitince işlenir (kasma olmasın).
export const Animasyon = {
    suruyor: false,
    bekleyen: new Map(),
    bitti() {
        this.suruyor = false;
        const isler = [...this.bekleyen.values()];
        this.bekleyen.clear();
        for (const fn of isler) {
            try {
                fn();
            } catch (e) {
                console.error('FLUGEL Island: ertelenen çizim', e);
            }
        }
    },
};

export class Sayfa extends PopupMenu.PopupMenuSection {
    constructor() {
        super();
        this.actor.add_style_class_name('flugel-sayfa');
        this._acikAlt = null;
        this.rozetDegisti = null;
        this.disMenuKapandi = null;
    }

    // PopupSubMenuMenuItem bunu üst menüsünde arar (PopupMenu'deki ile aynı mantık)
    _setOpenedSubMenu(alt) {
        if (this._acikAlt)
            this._acikAlt.close(true);
        this._acikAlt = alt;
    }

    // veri gelince sadece sayfa ekrandaysa çiz (kapalı kartta boşuna menü kurulmaz)
    gorunurse(fn) {
        if (!this.actor.mapped)
            return;
        if (Animasyon.suruyor)
            Animasyon.bekleyen.set(this, fn);
        else
            fn();
    }

    // aynı veri tekrar çizilmez (kart her açıldığında menüler baştan kurulmasın)
    degisti(anahtar, veri) {
        // içerik karşılaştırılır: her yenilemede yeni nesne gelir ama çoğu zaman içerik aynıdır
        this._cizilen ??= new Map();
        const imza = veri === null || veri === undefined ? String(veri) : JSON.stringify(veri);
        if (this._cizilen.get(anahtar) === imza)
            return false;
        this._cizilen.set(anahtar, imza);
        return true;
    }

    // sekme seçilince / kart bu sekmeyle açılınca
    goster() {}

    // başka sekmeye geçilince
    gizle() {}

    // kart kapanınca: açık alt menüleri kapat
    destroy() {
        Animasyon.bekleyen.delete(this);
        super.destroy();
    }

    kapandi() {
        this._acikAlt?.close(false);
        this._acikAlt = null;
    }

    // kartın dışında açılmış bir menü var mı (tepsi simgelerinin menüleri gibi)
    disMenuAcik() {
        return false;
    }
}
