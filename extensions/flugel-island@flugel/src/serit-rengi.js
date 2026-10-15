// FLUGEL Island — üst şeridin rengi altındaki uygulamaya uyar.
// Büyütülmüş (ya da üst kenara dayanmış) bir pencere varken şerit, o pencerenin ilk satırının rengini alır:
// tarayıcının sekme çubuğu siyahsa şerit de siyah olur, ada uygulamanın başlığına gömülü bir çentik gibi durur.
// Pencere yoksa şerit şeffaftır (duvar kağıdı). Renk, pencerenin üst satırından birkaç noktadan okunur ve en sık
// görülen alınır (ortadaki ada/kart ve sekmeler karışmasın diye orta bölge atlanır).
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

Gio._promisify(Shell.Screenshot.prototype, 'pick_color');

const NOKTALAR = [0.03, 0.12, 0.24, 0.76, 0.88, 0.97];

export class SeritRengi {
    constructor() {
        this._cekim = new Shell.Screenshot();
        this._renk = null;
        const planla = () => this._planla();
        this._idler = [
            ...['restacked', 'window-created', 'grab-op-end', 'notify::focus-window'].map(s => [global.display, global.display.connect(s, planla)]),
            ...['size-changed', 'minimize', 'unminimize', 'map', 'destroy'].map(s => [global.window_manager, global.window_manager.connect(s, planla)]),
            [global.workspace_manager, global.workspace_manager.connect('active-workspace-changed', planla)],
            [Main.overview, Main.overview.connect('hidden', planla)],
        ];
        // sayfa içeriği (ör. sitenin temasıyla değişen başlık rengi) için seyrek yoklama; pencere yoksa iş yapmaz
        this._yoklamaId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 3, () => {
            if (this._hedef())
                this._planla();
            return GLib.SOURCE_CONTINUE;
        });
        this._planla();
    }

    _planla() {
        if (this._planId)
            return;
        // pencere animasyonları (büyütme) bitsin diye kısa gecikme
        this._planId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 280, () => {
            this._planId = 0;
            this._oku().catch(e => console.warn(`FLUGEL Island: şerit rengi: ${e.message}`));
            return GLib.SOURCE_REMOVE;
        });
    }

    // birincil ekranda, etkin çalışma alanında, üst kenarı şeridin hemen altına dayanan en üstteki pencere
    _hedef() {
        if (Main.overview.visible)
            return null;
        const mi = Main.layoutManager.primaryIndex;
        const m = Main.layoutManager.primaryMonitor;
        const ws = global.workspace_manager.get_active_workspace();
        const alan = ws.get_work_area_for_monitor(mi);
        const ortaX = m.x + m.width / 2;
        const uygun = p => p && !p.minimized && p.showing_on_its_workspace() && !p.is_fullscreen() &&
            p.get_window_type() === Meta.WindowType.NORMAL && p.get_monitor() === mi &&
            (p.is_on_all_workspaces() || p.get_workspace() === ws);
        const ustte = p => {
            const r = p.get_frame_rect();
            return r.y <= alan.y + 2 && r.x <= ortaX && r.x + r.width >= ortaX;
        };
        const adaylar = global.get_window_actors().map(a => a.meta_window).filter(p => uygun(p) && ustte(p));
        if (!adaylar.length)
            return null;
        const sirali = global.display.sort_windows_by_stacking(adaylar);
        return sirali[sirali.length - 1];
    }

    async _oku() {
        const p = this._hedef();
        if (!p) {
            this._yaz(null);
            return;
        }
        const r = p.get_frame_rect();
        const y = Math.max(r.y + 1, Main.layoutManager.primaryMonitor.y);
        const renkler = await Promise.all(NOKTALAR.map(async f => {
            try {
                const [c] = await this._cekim.pick_color(Math.round(r.x + r.width * f), y);
                return c;
            } catch (e) {
                return null;
            }
        }));
        if (this._bitti)
            return;
        const say = new Map();
        for (const c of renkler.filter(Boolean)) {
            const k = `${c.red},${c.green},${c.blue}`;
            say.set(k, (say.get(k) ?? 0) + 1);
        }
        const [enCok] = [...say].sort((a, b) => b[1] - a[1])[0] ?? [null];
        this._yaz(enCok);
    }

    _yaz(rgb) {
        if (rgb === this._renk)
            return;
        this._renk = rgb;
        Main.panel.style = rgb ? `background-color: rgb(${rgb}); transition-duration: 220ms;` : 'transition-duration: 220ms;';
    }

    get renk() {
        return this._renk;
    }

    destroy() {
        this._bitti = true;
        this._idler.forEach(([n, id]) => n.disconnect(id));
        this._idler = [];
        for (const id of [this._planId, this._yoklamaId]) {
            if (id)
                GLib.source_remove(id);
        }
        this._planId = this._yoklamaId = 0;
        Main.panel.style = null;
    }
}
