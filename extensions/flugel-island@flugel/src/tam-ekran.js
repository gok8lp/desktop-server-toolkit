// FLUGEL Island — tam ekranda "birlikte" kipi: uygulama ile ada tek parça.
// Tam ekran pencere (ve aynı ekrandaki menü/ipucu pencereleri) ekranın alt-ortasından biraz küçültülür; üst kenarı
// tam olarak ada şeridinin altına iner. Etrafı siyah bir zeminle doldurulur, ada şeridin ortasında görünür kalır ve
// uygulamanın hiçbir yerini örtmez. Küçültme yalnızca görüntüdedir: Wayland girdisi dönüşümü izler, tıklamalar
// doğru yere gider. Bu sırada kompozitörün doğrudan taraması kapatılır (dönüşüm görünsün diye).
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

const SURE = 260;

export class TamEkranBirlikte {
    constructor() {
        this._aktorler = new Map();   // pencere aktörü → sinyal kimlikleri
        this._m = null;
    }

    get aktif() {
        return !!this._m;
    }

    // m: ekran, serit: şerit yüksekliği (fiziksel piksel)
    basla(m, serit) {
        if (this._m && this._m.index === m.index && this._serit === serit)
            return;
        if (this._m)
            this.bitir(true);
        this._m = m;
        this._serit = serit;
        this._olcek = (m.height - serit) / m.height;
        global.compositor.disable_unredirect();
        this._zemin = new St.Widget({style: 'background-color: #000000;', reactive: false,
            x: m.x, y: m.y, width: m.width, height: m.height});
        global.window_group.add_child(this._zemin);
        this._idler = [
            [global.display, global.display.connect('window-created', (_d, p) => this._yeniPencere(p))],
            [global.display, global.display.connect('restacked', () => this._zeminSirala())],
        ];
        for (const a of global.get_window_actors())
            this._donustur(a, true);
        this._zeminSirala();
    }

    _uygun(a) {
        const p = a.meta_window;
        if (!p || p.get_monitor() !== this._m.index)
            return false;
        const ws = global.workspace_manager.get_active_workspace();
        return p.is_on_all_workspaces() || p.get_workspace() === ws || p.get_window_type() !== Meta.WindowType.NORMAL;
    }

    _yeniPencere(p) {
        const a = p.get_compositor_private();
        if (!a)
            return;
        // ilk kare çizilince boyutu bellidir
        const id = a.connect('first-frame', () => {
            a.disconnect(id);
            if (this._m)
                this._donustur(a, false);
        });
    }

    // ekranın alt-ortası sabit nokta: her pencere aynı noktaya göre ölçeklenir, böylece menüler ana pencereyle hizalı kalır
    _pivot(a) {
        const w = Math.max(1, a.width), h = Math.max(1, a.height);
        a.set_pivot_point((this._m.x + this._m.width / 2 - a.x) / w, (this._m.y + this._m.height - a.y) / h);
    }

    _donustur(a, animasyon) {
        if (this._aktorler.has(a) || !this._uygun(a))
            return;
        this._pivot(a);
        // GNOME'un tam ekran/boyut animasyonu pencere ölçeğini 1'e çeker: bitince ölçek yeniden uygulanır
        const koru = () => {
            if (this._koruId || !this._m)
                return;
            this._koruId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60, () => {
                this._koruId = 0;
                if (!this._m || !this._aktorler.has(a))
                    return GLib.SOURCE_REMOVE;
                if (a.get_transition('scale-x') || a.get_transition('scale-y')) {
                    koru();
                    return GLib.SOURCE_REMOVE;
                }
                if (Math.abs(a.scale_y - this._olcek) > 0.001) {
                    this._pivot(a);
                    a.ease({scale_x: this._olcek, scale_y: this._olcek, duration: 180, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
                }
                return GLib.SOURCE_REMOVE;
            });
        };
        const idler = [a.connect('notify::allocation', () => this._pivot(a)),
            a.connect('notify::scale-y', koru),
            a.connect('destroy', () => this._aktorler.delete(a))];
        this._aktorler.set(a, idler);
        a.remove_transition('scale-x');
        a.remove_transition('scale-y');
        if (animasyon && St.Settings.get().enable_animations) {
            a.ease({scale_x: this._olcek, scale_y: this._olcek, duration: SURE, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        } else {
            a.scale_x = this._olcek;
            a.scale_y = this._olcek;
        }
    }

    // siyah zemin tam ekran pencerenin hemen altında (diğer pencereleri de örter)
    _zeminSirala() {
        if (!this._zemin)
            return;
        const tam = global.get_window_actors().filter(a => a.meta_window?.is_fullscreen() && a.meta_window.get_monitor() === this._m.index);
        const en = tam[tam.length - 1];
        if (en && en.get_parent() === global.window_group)
            global.window_group.set_child_below_sibling(this._zemin, en);
    }

    bitir(anlik = false) {
        if (!this._m)
            return;
        this._m = null;
        if (this._koruId)
            GLib.source_remove(this._koruId);
        this._koruId = 0;
        this._idler?.forEach(([n, id]) => n.disconnect(id));
        this._idler = null;
        for (const [a, idler] of this._aktorler) {
            idler.forEach(id => GObject.signal_handler_disconnect(a, id));
            a.remove_transition('scale-x');
            a.remove_transition('scale-y');
            if (!anlik && St.Settings.get().enable_animations)
                a.ease({scale_x: 1, scale_y: 1, duration: SURE, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
            else
                a.scale_x = a.scale_y = 1;
        }
        this._aktorler.clear();
        this._zemin?.destroy();
        this._zemin = null;
        global.compositor.enable_unredirect();
    }

    destroy() {
        this.bitir(true);
    }
}
