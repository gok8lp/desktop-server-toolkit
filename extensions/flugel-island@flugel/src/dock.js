// FLUGEL Island — alt dock'a (ubuntu-dock / Dash to Dock) "üzerine gelince hafif büyüme".
// Dock'un kendisi korunur (sıfırdan yazılmaz); sadece simgelere ölçek animasyonu eklenir. Ayar: dock-buyume.
// "Animasyonları azalt" açıksa ya da Pil Tasarrufu/pil modunda büyüme yapılmaz.
import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const OLCEK = 1.12;

function bul(kok, ad) {
    if (!kok)
        return null;
    if (kok.name === ad)
        return kok;
    for (const c of kok.get_children()) {
        const b = bul(c, ad);
        if (b)
            return b;
    }
    return null;
}

export class DockBuyume {
    constructor(ayarlar, guc) {
        this._ayar = ayarlar;
        this._guc = guc;
        this._simgeler = new Map();     // simge → hover sinyali
        this._kutular = new Map();      // kutu → child-added sinyali
    }

    enable() {
        this._ayarId = this._ayar.connect('changed::dock-buyume', () => this._uygula());
        // dock yeniden kurulursa (monitör değişimi, eklenti yeniden açılışı) tekrar bağlan
        this._uiId = Main.layoutManager.uiGroup.connect('child-added', (_g, c) => {
            if (c.name === 'dashtodockContainer')
                this._planla();
        });
        this._planla();
    }

    _planla() {
        if (this._bekleId)
            return;
        this._bekleId = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 500, () => {
            this._bekleId = 0;
            this._uygula();
            return GLib.SOURCE_REMOVE;
        });
    }

    _uygula() {
        this._birak();
        if (!this._ayar.get_boolean('dock-buyume'))
            return;
        for (const kap of Main.layoutManager.uiGroup.get_children().filter(a => a.name === 'dashtodockContainer')) {
            const kutu = bul(kap, 'dashtodockBoxContainer')?.get_first_child();
            if (!kutu)
                continue;
            kutu.get_children().forEach(c => this._bagla(c));
            this._kutular.set(kutu, kutu.connect('child-added', (_k, c) => this._bagla(c)));
        }
    }

    _bagla(kap) {
        const dugme = kap.get_first_child?.();
        if (!dugme || this._simgeler.has(dugme) || !('hover' in dugme))
            return;
        // tüm düğme değil, sadece içteki simge büyür (merkezden): vurgu kutusu yerinde kalır, dock'tan taşmaz
        const simge = dugme.icon?.icon ?? dugme.icon?._iconBin ?? null;
        if (!simge)
            return;
        simge.set_pivot_point(0.5, 0.5);
        this._simgeler.set(dugme, [simge, dugme.connect('notify::hover', () => {
            const animasyon = St.Settings.get().enable_animations && !this._guc?.seyrek;
            const hedef = dugme.hover && animasyon ? OLCEK : 1;
            simge.ease({scale_x: hedef, scale_y: hedef, duration: 140, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        })]);
    }

    _birak() {
        for (const [dugme, [simge, id]] of this._simgeler) {
            try {
                dugme.disconnect(id);
                simge.remove_transition('scale-x');
                simge.remove_transition('scale-y');
                simge.set_scale(1, 1);
            } catch (e) {
                // simge dock tarafından yok edilmiş
            }
        }
        this._simgeler.clear();
        for (const [kutu, id] of this._kutular) {
            try {
                kutu.disconnect(id);
            } catch (e) {
                // kutu yok edilmiş
            }
        }
        this._kutular.clear();
    }

    disable() {
        if (this._bekleId)
            GLib.source_remove(this._bekleId);
        this._bekleId = 0;
        this._ayar.disconnect(this._ayarId);
        Main.layoutManager.uiGroup.disconnect(this._uiId);
        this._birak();
    }
}
