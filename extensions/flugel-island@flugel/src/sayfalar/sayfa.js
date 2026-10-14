// FLUGEL Island — kart sayfalarının temeli.
// PopupMenuSection'dır: FLUGEL v1 panelindeki menü öğeleri (alt menüler, anahtarlar) olduğu gibi çalışır.
// Bir alt menü açılınca öncekini kapatır (akordeon), menülerdeki davranışla aynı.
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

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
        if (this.actor.mapped)
            fn();
    }

    // sekme seçilince / kart bu sekmeyle açılınca
    goster() {}

    // başka sekmeye geçilince
    gizle() {}

    // kart kapanınca: açık alt menüleri kapat
    kapandi() {
        this._acikAlt?.close(false);
        this._acikAlt = null;
    }

    // kartın dışında açılmış bir menü var mı (tepsi simgelerinin menüleri gibi)
    disMenuAcik() {
        return false;
    }
}
