// FLUGEL Island — resim içinde resim (PiP) pencereleri.
//  * Her zaman üstte ve tüm çalışma alanlarında (FLUGEL v1'den)
//  * İlk açılışta sol alt köşe: kenarlardan 24 px, alttaki dock'un üstünde
//  * Taşıyınca/boyutlandırınca konum ve boyut 'pip-konum' ayarına yazılır (bırakınca, 500 ms sonra);
//    sonraki açılışlar oradan başlar. Konum en yakın köşeye göre saklanır; başka ekranda/çözünürlükte
//    ekran dışına düşerse sol alta döner.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Başlık dile göre değişir; tarayıcı sınıfıyla birlikte bakılır ki başka pencerelere dokunulmasın
const PIP_BASLIK = /^(picture[- ]in[- ]picture|pencere i[cç]inde pencere|resim i[cç]inde resim|bild[- ]im[- ]bild)$/i;
const TARAYICI = /chrom|firefox|brave|vivaldi|edge|opera|librewolf|zen/i;
const KENAR = 24;

export function pipMi(w) {
    if (!w || w.get_window_type() !== Meta.WindowType.NORMAL && w.get_window_type() !== Meta.WindowType.UTILITY)
        return false;
    const sinif = `${w.get_wm_class() ?? ''} ${w.get_wm_class_instance() ?? ''}`;
    return PIP_BASLIK.test((w.get_title() ?? '').trim()) && (TARAYICI.test(sinif) || !sinif.trim());
}

export class PipYoneticisi {
    constructor(ayarlar) {
        this._ayar = ayarlar;
        this._pencereler = new Map();   // MetaWindow → sinyaller, zamanlayıcılar ve canlı aktör
    }

    enable() {
        this._olusturId = global.display.connect('window-created', (_d, w) => this._izle(w, true));
        // eklenti açılırken zaten açık olan PiP'ler: taşınmaz, sadece izlenir
        for (const a of global.get_window_actors())
            this._izle(a.meta_window, false);
    }

    disable() {
        if (this._olusturId)
            global.display.disconnect(this._olusturId);
        this._olusturId = 0;
        for (const w of [...this._pencereler.keys()])
            this._birak(w);
    }

    _izle(w, yeni) {
        if (!w || this._pencereler.has(w))
            return;
        const k = {idler: [], yerlesti: !yeni, ilkKare: !yeni, pip: false, kayitId: 0, sessizId: 0};
        this._pencereler.set(w, k);
        k.idler.push(
            w.connect('notify::title', () => this._kontrol(w)),
            w.connect('unmanaged', () => this._birak(w)));
        const aktor = w.get_compositor_private();
        if (yeni && aktor) {
            // konum, pencere ilk karesini çizdikten sonra verilir (önce verilirse istemci ezebilir)
            k.aktor = aktor;
            k.aktorYokId = aktor.connect('destroy', () => {
                // Mutter aktörü MetaWindow'un unmanaged sinyalinden önce yok edebilir.
                // Artık geçersiz aktörde disconnect() çağırmamak için referansı bırak.
                k.aktor = null;
                k.aktorId = 0;
                k.aktorYokId = 0;
            });
            k.aktorId = aktor.connect('first-frame', () => {
                k.ilkKare = true;
                this._kontrol(w);
            });
        } else {
            k.ilkKare = true;
        }
        this._kontrol(w);
    }

    _birak(w) {
        const k = this._pencereler.get(w);
        if (!k)
            return;
        this._pencereler.delete(w);
        k.idler.forEach(id => w.disconnect(id));
        if (k.aktor) {
            if (k.aktorId)
                k.aktor.disconnect(k.aktorId);
            if (k.aktorYokId)
                k.aktor.disconnect(k.aktorYokId);
            k.aktor = null;
        }
        for (const id of [k.kayitId, k.sessizId]) {
            if (id)
                GLib.source_remove(id);
        }
    }

    _kontrol(w) {
        const k = this._pencereler.get(w);
        if (!k || !pipMi(w))
            return;
        if (!k.pip) {
            k.pip = true;
            if (!w.is_above())
                w.make_above();
            if (!w.is_on_all_workspaces())
                w.stick();
            k.idler.push(
                w.connect('position-changed', () => this._kaydetPlanla(w)),
                w.connect('size-changed', () => this._kaydetPlanla(w)));
        }
        if (!k.yerlesti && k.ilkKare) {
            k.yerlesti = true;
            this._yerlestir(w);
        }
    }

    // ---------- konum ----------
    _s() {
        return St.ThemeContext.get_for_stage(global.stage).scale_factor;
    }

    // Otomatik gizlenen alt dock çalışma alanından düşülmez; PiP onun üstünde kalsın diye payı eklenir
    _dockPayi() {
        const kaynak = Gio.SettingsSchemaSource.get_default();
        if (!kaynak.lookup('org.gnome.shell.extensions.dash-to-dock', true))
            return 0;
        const d = new Gio.Settings({schema_id: 'org.gnome.shell.extensions.dash-to-dock'});
        if (d.get_string('dock-position') !== 'BOTTOM' || d.get_boolean('dock-fixed'))
            return 0;
        return d.get_int('dash-max-icon-size') + 24;
    }

    _calismaAlani(monitor) {
        const ms = Main.layoutManager.monitors;
        const i = monitor >= 0 && monitor < ms.length ? monitor : Main.layoutManager.primaryIndex;
        return {i, alan: Main.layoutManager.getWorkAreaForMonitor(i)};
    }

    _varsayilan(w) {
        const {i, alan} = this._calismaAlani(Main.layoutManager.primaryIndex);
        const r = w.get_frame_rect();
        const kenar = Math.round(KENAR * this._s());
        return {i, x: alan.x + kenar, y: alan.y + alan.height - r.height - kenar - this._dockPayi() * this._s(),
            w: r.width, h: r.height};
    }

    _kayitli() {
        let k;
        try {
            k = JSON.parse(this._ayar.get_string('pip-konum') || 'null');
        } catch (e) {
            k = null;
        }
        if (!k || typeof k !== 'object' || !['sol-ust', 'sol-alt', 'sag-ust', 'sag-alt'].includes(k.kose) ||
            !Number.isFinite(k.dx) || k.dx < 0 || !Number.isFinite(k.dy) || k.dy < 0 ||
            !Number.isFinite(k.w) || k.w <= 50 || !Number.isFinite(k.h) || k.h <= 50)
            return null;
        const {i, alan} = this._calismaAlani(k.monitor ?? -1);
        const x = k.kose.startsWith('sol') ? alan.x + k.dx : alan.x + alan.width - k.w - k.dx;
        const y = k.kose.endsWith('ust') ? alan.y + k.dy : alan.y + alan.height - k.h - k.dy;
        // ekrana sığmıyorsa (başka çözünürlük/monitör) kayıt kullanılmaz
        const sigar = x >= alan.x && y >= alan.y && x + k.w <= alan.x + alan.width && y + k.h <= alan.y + alan.height;
        return sigar ? {i, x, y, w: k.w, h: k.h} : null;
    }

    _yerlestir(w) {
        const k = this._pencereler.get(w);
        const hedef = this._kayitli() ?? this._varsayilan(w);
        // kendi taşımamız konum kaydını tetiklemesin
        this._sessiz(k, 600);
        if (w.get_monitor() !== hedef.i)
            w.move_to_monitor(hedef.i);
        w.move_resize_frame(false, Math.round(hedef.x), Math.round(hedef.y), Math.round(hedef.w), Math.round(hedef.h));
    }

    _sessiz(k, ms) {
        if (k.sessizId)
            GLib.source_remove(k.sessizId);
        k.sessizId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            k.sessizId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _kaydetPlanla(w) {
        const k = this._pencereler.get(w);
        if (!k || !k.yerlesti || k.sessizId)
            return;
        // sürüklerken her pikselde yazmamak için: son hareketten 500 ms sonra bir kez yazılır
        if (k.kayitId)
            GLib.source_remove(k.kayitId);
        k.kayitId = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 500, () => {
            k.kayitId = 0;
            this._kaydet(w);
            return GLib.SOURCE_REMOVE;
        });
    }

    _kaydet(w) {
        if (w.is_fullscreen() || w.get_maximized?.())
            return;
        const r = w.get_frame_rect();
        const {i, alan} = this._calismaAlani(w.get_monitor());
        const sol = r.x - alan.x, sag = alan.x + alan.width - (r.x + r.width);
        const ust = r.y - alan.y, alt = alan.y + alan.height - (r.y + r.height);
        const kayit = {
            kose: `${sol <= sag ? 'sol' : 'sag'}-${ust <= alt ? 'ust' : 'alt'}`,
            dx: Math.max(0, Math.min(sol, sag)), dy: Math.max(0, Math.min(ust, alt)),
            w: r.width, h: r.height, monitor: i,
        };
        const metin = JSON.stringify(kayit);
        if (metin !== this._ayar.get_string('pip-konum'))
            this._ayar.set_string('pip-konum', metin);
    }
}
