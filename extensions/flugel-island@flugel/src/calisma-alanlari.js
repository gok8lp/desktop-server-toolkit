// FLUGEL Island — çalışma alanları (üst çubuğun solundaki ekran değiştirici artık adanın içinde).
// Kartın başlığında her çalışma alanı için bir nokta (etkin olan uzun); tıklayınca geçilir. Kapsülün
// üzerinde fare tekerleğiyle de önceki/sonraki çalışma alanına geçilir.
import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import {ipucuBagla} from './bilesenler.js';

export class CalismaAlanlari {
    // mini: boştaki kapsülün solundaki küçük noktalar (kapsülün kalıcı yeri)
    constructor({mini = false} = {}) {
        this._mini = mini;
        this.actor = new St.BoxLayout({style_class: mini ? 'flugel-ca flugel-ca-mini' : 'flugel-ca',
            y_align: Clutter.ActorAlign.CENTER, reactive: true});
        this._yonetici = global.workspace_manager;
        this._idler = [
            this._yonetici.connect('notify::n-workspaces', () => this._ciz()),
            this._yonetici.connect('active-workspace-changed', () => this._ciz()),
        ];
        this.actor.connect('scroll-event', (_a, olay) => this.kaydir(olay));
        if (mini)
        {ipucuBagla(this.actor, () => ({baslik: `Çalışma alanı ${this._yonetici.get_active_workspace_index() + 1} / ${this._yonetici.n_workspaces}`,
            ayrinti: 'Noktaya tıkla ya da kapsülde tekerleği çevir'}));}
        this._ciz();
    }

    _ciz() {
        this.actor.destroy_all_children();
        const n = this._yonetici.n_workspaces, etkin = this._yonetici.get_active_workspace_index();
        for (let i = 0; i < n; i++) {
            const d = new St.Button({style_class: `flugel-ca-nokta${i === etkin ? ' flugel-ca-etkin' : ''}`, can_focus: true,
                y_align: Clutter.ActorAlign.CENTER, accessible_name: `Çalışma alanı ${i + 1}`});
            d.connect('clicked', () => this._yonetici.get_workspace_by_index(i)?.activate(global.get_current_time()));
            if (!this._mini)
                ipucuBagla(d, {baslik: `Çalışma alanı ${i + 1}`, ayrinti: i === etkin ? 'Şu an buradasın' : 'Tıkla: geç · kapsülde tekerlek de geçer'});
            this.actor.add_child(d);
        }
    }

    // Fare tekerleği ya da dokunmatik yüzeyde iki parmak kaydırma: yukarı/sol = önceki, aşağı/sağ = sonraki.
    // Dokunmatik yüzey "pürüzsüz" küçük adımlar gönderir: hareket biriktirilir, eşik aşılınca TEK adım atılır
    // ve ardından kısa bir süre (atalet) yeni adım alınmaz.
    kaydir(olay) {
        const yon = olay.get_scroll_direction();
        let adim = 0;
        if (yon === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = olay.get_scroll_delta();
            const simdi = GLib.get_monotonic_time();
            if (simdi - (this._sonAdim ?? 0) < 350000) {
                this._birikim = 0;
                return Clutter.EVENT_STOP;
            }
            if (simdi - (this._sonOlay ?? 0) > 300000)
                this._birikim = 0;
            this._sonOlay = simdi;
            this._birikim = (this._birikim ?? 0) + (Math.abs(dx) > Math.abs(dy) ? dx : dy);
            if (Math.abs(this._birikim) < 1.2)
                return Clutter.EVENT_STOP;
            adim = Math.sign(this._birikim);
            this._birikim = 0;
            this._sonAdim = simdi;
        } else if (yon === Clutter.ScrollDirection.UP || yon === Clutter.ScrollDirection.LEFT) {
            adim = -1;
        } else if (yon === Clutter.ScrollDirection.DOWN || yon === Clutter.ScrollDirection.RIGHT) {
            adim = 1;
        } else {
            return Clutter.EVENT_PROPAGATE;
        }
        const n = this._yonetici.n_workspaces;
        const hedef = Math.max(0, Math.min(n - 1, this._yonetici.get_active_workspace_index() + adim));
        if (hedef !== this._yonetici.get_active_workspace_index())
            this._yonetici.get_workspace_by_index(hedef)?.activate(global.get_current_time());
        return Clutter.EVENT_STOP;
    }

    destroy() {
        this._idler.forEach(id => this._yonetici.disconnect(id));
        this.actor.destroy();
    }
}
