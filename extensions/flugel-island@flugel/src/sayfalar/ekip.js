// FLUGEL Island — "Ekip" sekmesi: büyük Re:Zero karakteri, sözü, karakter seçimi, otomatik değişim.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Sayfa} from './sayfa.js';
import {EKIP} from '../ekip.js';
import {altMenu, menuOgesi, kac} from '../ortak.js';

export class EkipSayfa extends Sayfa {
    constructor({ekip, ayarlar}) {
        super();
        this._ekip = ekip;
        const satir = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        satir.add_child(ekip.ikonOlustur(72, 'sayfa'));
        const metin = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, y_align: Clutter.ActorAlign.CENTER,
            style_class: 'flugel-ekip-metin'});
        this._ad = new St.Label({style_class: 'flugel-ekip-ad'});
        this._soz = new St.Label({style_class: 'flugel-ekip-soz'});
        this._soz.clutter_text.line_wrap = true;
        metin.add_child(this._ad);
        metin.add_child(this._soz);
        satir.add_child(metin);
        this.addMenuItem(satir);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const sec = altMenu(this, 'Karakter seç', 'avatar-default-symbolic');
        EKIP.forEach(([, ad], i) => menuOgesi(sec.menu, ad, () => ekip.sec(i)));
        this._otomatik = new PopupMenu.PopupSwitchMenuItem('Otomatik değiştir (9 sn)', ayarlar.get_boolean('ekip-otomatik'));
        this._otomatik.connect('toggled', (_i, acik) => ayarlar.set_boolean('ekip-otomatik', acik));
        this._ayar = ayarlar;
        this._ayarId = ayarlar.connect('changed::ekip-otomatik', () => this._otomatik.setToggleState(ayarlar.get_boolean('ekip-otomatik')));
        this.addMenuItem(this._otomatik);
        menuOgesi(this, 'Re:Zero mangam (MAL)', 'xdg-open https://myanimelist.net/manga/24519', 'manga');
        this._abonelik = ekip.abone(() => this.gorunurse(() => this._konus()));
    }

    goster() {
        this._konus();
    }

    _konus() {
        this._ad.clutter_text.set_markup(`<b>${kac(this._ekip.ad)}</b>`);
        this._soz.text = this._ekip.soz();
    }

    destroy() {
        this._abonelik?.();
        this._ayar.disconnect(this._ayarId);
        super.destroy();
    }
}
