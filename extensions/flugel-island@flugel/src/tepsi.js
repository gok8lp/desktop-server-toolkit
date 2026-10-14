// FLUGEL Island — tepsi satırı: arka planda çalışan uygulamaların simgeleri (AppIndicator: Telegram, Steam…).
// Kartın başlığının altında tek satır; simge yoksa satır gizlenir. Simgeler üst çubuktan alınıp buraya
// taşınır, eklenti kapanınca geri konur. Simgenin kendi menüsü açıkken kart kapanmaz.
import St from 'gi://St';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Clutter from 'gi://Clutter';
import {ipucuBagla} from './bilesenler.js';

const tepsiAnahtari = c => Object.keys(Main.panel.statusArea).find(k =>
    k.startsWith('appindicator-') && Main.panel.statusArea[k]?.container === c);
const tepsiAdi = c => {
    const i = c.get_first_child();
    return i?._indicator?.title || i?._indicator?.id || i?.accessible_name || 'Uygulama';
};

export class Tepsi {
    constructor() {
        this.disMenuKapandi = null;
        this.actor = new St.BoxLayout({style_class: 'flugel-tepsi-satir', x_align: Clutter.ActorAlign.CENTER, visible: false});
        this._kutu = new St.BoxLayout({style_class: 'flugel-tepsi'});
        this.actor.add_child(this._kutu);

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
            ipucuBagla(c.get_first_child() ?? c, () => tepsiAdi(c));
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
        this.actor.visible = this._kutu.get_n_children() > 0;
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
        this.actor.destroy();
    }
}
