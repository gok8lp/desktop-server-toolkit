// FLUGEL Island — "Tepsi" sekmesi: arka planda çalışan uygulamaların simgeleri (AppIndicator: Telegram, Steam…).
// FLUGEL v1'deki "^" tepsisinin yerini alır: simgeler üst çubuktan alınıp buraya taşınır, eklenti kapanınca
// geri konur. Simgenin kendi menüsü açıkken kart kapanmaz.
import St from 'gi://St';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Sayfa} from './sayfa.js';
import {bilgiSatiri, ipucuEkle, soluk} from '../ortak.js';

const tepsiAnahtari = c => Object.keys(Main.panel.statusArea).find(k =>
    k.startsWith('appindicator-') && Main.panel.statusArea[k]?.container === c);
const tepsiAdi = c => {
    const i = c.get_first_child();
    return i?._indicator?.title || i?._indicator?.id || i?.accessible_name || 'Uygulama';
};

export class TepsiSayfa extends Sayfa {
    constructor() {
        super();
        const satir = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        this._kutu = new St.BoxLayout({style_class: 'flugel-tepsi', x_expand: true});
        satir.add_child(this._kutu);
        this.addMenuItem(satir);
        this._bos = bilgiSatiri(this, soluk('Arka planda simgesi olan uygulama yok'));
        bilgiSatiri(this, `<small>${soluk('Simgeye tıkla: uygulamanın kendi menüsü açılır')}</small>`);

        this._menuIdleri = new Map();
        this._bekleyenler = new Set();
        const kutular = [Main.panel._leftBox, Main.panel._centerBox, Main.panel._rightBox];
        this._sinyaller = kutular.map(kutu => [kutu, kutu.connect('child-added', (_k, c) => {
            // appindicator kabını önce kendisi kurar; bir sonraki boşta alırız
            const id = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this._bekleyenler.delete(id);
                this._al(c);
                return GLib.SOURCE_REMOVE;
            });
            this._bekleyenler.add(id);
        })]);
        for (const kutu of kutular)
            kutu.get_children().forEach(c => this._al(c));
        this._kutuId = this._kutu.connect('child-removed', (_k, c) => {
            this._menuBirak(c);
            this._say();
        });
        this._say();
    }

    _al(c) {
        if (!c || c.get_parent() === this._kutu || !tepsiAnahtari(c))
            return;
        c.get_parent()?.remove_child(c);
        this._kutu.add_child(c);
        if (!c._flugelIpucu) {
            c._flugelIpucu = true;
            ipucuEkle(c.get_first_child() ?? c, () => tepsiAdi(c));
        }
        const menu = c.get_first_child()?.menu;
        if (menu && !this._menuIdleri.has(c))
        {this._menuIdleri.set(c, [menu, menu.connect('open-state-changed', (_m, acik) => {
            // simgenin menüsü kapanınca fare adada değilse kart da kapanabilir
            if (!acik)
                this.disMenuKapandi?.();
        })]);}
        this._say();
    }

    _menuBirak(c) {
        const m = this._menuIdleri.get(c);
        if (m) {
            m[0].disconnect(m[1]);
            this._menuIdleri.delete(c);
        }
    }

    _say() {
        const n = this._kutu.get_n_children();
        this._bos.visible = n === 0;
        this.rozetDegisti?.(n ? String(n) : '');
    }

    disMenuAcik() {
        return this._kutu.get_children().some(c => c.get_first_child()?.menu?.isOpen);
    }

    destroy() {
        for (const id of this._bekleyenler)
            GLib.source_remove(id);
        this._bekleyenler.clear();
        for (const [kutu, id] of this._sinyaller)
            kutu.disconnect(id);
        this._sinyaller = [];
        this._kutu.disconnect(this._kutuId);
        for (const c of this._kutu.get_children()) {
            this._menuBirak(c);
            this._kutu.remove_child(c);
            Main.panel._rightBox.insert_child_at_index(c, 0);
        }
        super.destroy();
    }
}
