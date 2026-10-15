// FLUGEL Island — çentiğin "yol vermesi": altında önemli bir şey varken ada yukarı çekilir.
//   imleç   : yazı imleci (metin kutusu, editör, adres çubuğu) çentiğin altına gelirse; imleç uzaklaşınca geri iner.
//             Konum, GNOME büyütecinin kullandığı AT-SPI "caret-moved" olayından okunur; dinleyici sadece
//             çentiğin altında bir pencere varken kayıtlıdır (başka zaman uygulamalara yük yok).
//   sürükle : fare tuşu basılıyken (sekme taşıma, metin seçme, pencere sürükleme) imleç çentiğe girerse; tuş
//             bırakılıp imleç uzaklaşınca geri iner. Basılı tuş, uygulamanın kendi tutuşunda kabuğa olay gelmediği
//             için kısa aralıklı imleç okumasıyla izlenir (sadece çentiğin altında pencere varken).
//   kısayol : Super+Alt+I çentiği istendiği an gizler / geri getirir.
import Atspi from 'gi://Atspi';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const PAY = 10;   // bölge çevresine eklenen pay (px, mantıksal)

export class Kacis {
    // ada: {kok, monitor(), cekil(bool), kartAcik()}
    constructor(ayarlar, ada) {
        this._ayar = ayarlar;
        this._ada = ada;
        this._nedenler = new Set();
        this._dinliyor = false;
        Main.wm.addKeybinding('ada-gizle-kisayol', ayarlar, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW, () => this._degistir('kisayol'));
        const planla = () => this._durumPlanla();
        this._idler = [
            ...['restacked', 'window-created', 'grab-op-end'].map(s => [global.display, global.display.connect(s, planla)]),
            ...['size-changed', 'minimize', 'unminimize', 'map', 'destroy'].map(s => [global.window_manager, global.window_manager.connect(s, planla)]),
            [global.workspace_manager, global.workspace_manager.connect('active-workspace-changed', planla)],
            // başka pencereye geçilince yazı imleci nedeni düşer
            [global.display, global.display.connect('notify::focus-window', () => this._nedenSil('imlec'))],
        ];
        this._durumPlanla();
    }

    // çentiğin kapladığı bölge (çekilmişken de son yeri)
    _bolge() {
        const k = this._ada.kok;
        const s = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const p = PAY * s;
        if (!this._cekikBolge || !this._nedenler.size)
            this._cekikBolge = {x1: k.x - p, y1: k.y, x2: k.x + k.width + p, y2: k.y + k.height + p};
        return this._cekikBolge;
    }

    // adanın altında görünen bir pencere var mı (o zaman dinleyiciler açılır)
    _pencereAltta() {
        const k = this._ada.kok;
        const m = this._ada.monitor();
        if (!m || Main.overview.visible)
            return false;
        const ws = global.workspace_manager.get_active_workspace();
        return global.get_window_actors().some(a => {
            const p = a.meta_window;
            if (!p || p.minimized || !p.showing_on_its_workspace() || p.get_monitor() !== m.index)
                return false;
            if (!(p.is_on_all_workspaces() || p.get_workspace() === ws))
                return false;
            const r = p.get_frame_rect();
            return r.x < k.x + k.width && r.x + r.width > k.x && r.y < k.y + k.height && r.y + r.height > k.y;
        });
    }

    _durumPlanla() {
        if (this._planId)
            return;
        this._planId = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 250, () => {
            this._planId = 0;
            this._dinle(this._ayar.get_boolean('ada-yol-ver') && this._pencereAltta());
            return GLib.SOURCE_REMOVE;
        });
    }

    _dinle(ac) {
        if (ac === this._dinliyor)
            return;
        this._dinliyor = ac;
        if (ac) {
            // imleç (AT-SPI)
            try {
                if (!this._atspi && Atspi.init() <= 1) {
                    Atspi.set_timeout(250, 250);
                    this._atspi = Atspi.EventListener.new(e => this._imlecOlayi(e));
                }
                this._atspi?.register('object:text-caret-moved');
                this._atspi?.register('object:state-changed:focused');
            } catch (e) {
                console.warn(`FLUGEL Island: imleç takibi açılamadı: ${e.message}`);
            }
            // basılı tuşla sürükleme
            this._yoklaId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 90, () => {
                this._surukleYokla();
                return GLib.SOURCE_CONTINUE;
            });
        } else {
            try {
                this._atspi?.deregister('object:text-caret-moved');
                this._atspi?.deregister('object:state-changed:focused');
            } catch (e) {
                // AT-SPI zaten kapalı
            }
            if (this._yoklaId)
                GLib.source_remove(this._yoklaId);
            this._yoklaId = 0;
            this._nedenSil('imlec');
            this._nedenSil('surukle');
        }
    }

    _icinde(x, y, b = this._bolge()) {
        return x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
    }

    _surukleYokla() {
        const [x, y, mod] = global.get_pointer();
        const basili = (mod & (Clutter.ModifierType.BUTTON1_MASK | Clutter.ModifierType.BUTTON2_MASK |
            Clutter.ModifierType.BUTTON3_MASK)) !== 0;
        if (this._nedenler.has('surukle')) {
            if (!basili && !this._icinde(x, y))
                this._nedenSil('surukle');
        } else if (basili && this._icinde(x, y) && !this._ada.kartAcik()) {
            this._nedenEkle('surukle');
        }
    }

    // imleç olayı çok sık gelebilir: en sonuncusu kısa bir gecikmeyle işlenir
    _imlecOlayi(olay) {
        this.olaySayisi = (this.olaySayisi ?? 0) + 1;   // tanı (testler okur)
        this._sonOlay = olay;
        if (this._imlecId)
            return;
        this._imlecId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
            this._imlecId = 0;
            const e = this._sonOlay;
            this._sonOlay = null;
            try {
                this._imlecDenetle(e);
            } catch (err) {
                // uygulama kapanmış ya da yanıt vermiyor
                this.sonHata = String(err);
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _imlecDenetle(e) {
        const kaynak = e?.source;
        // odak bir metin alanından çıkınca (detail1 = 0) ya da metin olmayan bir öğeye geçince imleç nedeni düşer
        if (e?.type?.startsWith('object:state-changed')) {
            if (!e.detail1)
                return;
            if (!kaynak?.get_text_iface?.()) {
                this._nedenSil('imlec');
                return;
            }
        }
        const metin = kaynak?.get_text_iface?.();
        if (!metin)
            return;
        let ofs = 0;
        try {
            ofs = metin.get_caret_offset();
        } catch (e) {
            ofs = e && 0;
        }
        // Wayland uygulamaları ekran konumunu bilmez (SCREEN istenince hata verir): pencereye göre konum alınır,
        // odaklı pencerenin yeri eklenir. X11 uygulamalarında ekran konumu doğrudan gelir.
        const odak = global.display.focus_window;
        const pencereye = () => {
            const b = odak?.get_buffer_rect() ?? {x: 0, y: 0};
            let w;
            try {
                w = metin.get_character_extents(ofs, Atspi.CoordType.WINDOW);
            } catch (e) {
                // imleç konumu verilmiyorsa: yazı alanının kendi kutusu
                w = kaynak.get_component_iface().get_extents(Atspi.CoordType.WINDOW);
            }
            return {x: b.x + w.x, y: b.y + w.y, width: w.width, height: w.height};
        };
        let r;
        if (odak?.get_client_type?.() === Meta.WindowClientType.WAYLAND) {
            r = pencereye();
        } else {
            try {
                r = metin.get_character_extents(ofs, Atspi.CoordType.SCREEN);
            } catch (e) {
                r = pencereye();
            }
        }
        if (r.width <= 0 && r.height <= 0) {
            this._nedenSil('imlec');
            return;
        }
        const bolge = this._bolge();
        this.sonImlec = {...r, bolge};   // tanı
        const kesisir = r.x < bolge.x2 && r.x + Math.max(2, r.width) > bolge.x1 && r.y < bolge.y2 && r.y + r.height > bolge.y1;
        if (kesisir && !this._ada.kartAcik())
            this._nedenEkle('imlec');
        else
            this._nedenSil('imlec');
    }

    _degistir(neden) {
        if (this._nedenler.has(neden))
            this._nedenSil(neden);
        else
            this._nedenEkle(neden);
    }

    _nedenEkle(neden) {
        const once = this._nedenler.size;
        this._bolge();
        this._nedenler.add(neden);
        if (!once)
            this._ada.cekil(true);
    }

    _nedenSil(neden) {
        if (!this._nedenler.delete(neden))
            return;
        if (!this._nedenler.size) {
            this._cekikBolge = null;
            this._ada.cekil(false);
        }
    }

    get cekik() {
        return this._nedenler.size > 0;
    }

    destroy() {
        Main.wm.removeKeybinding('ada-gizle-kisayol');
        this._dinle(false);
        this._idler.forEach(([n, id]) => n.disconnect(id));
        for (const id of [this._planId, this._imlecId]) {
            if (id)
                GLib.source_remove(id);
        }
        this._planId = this._imlecId = 0;
        this._nedenler.clear();
        this._ada.cekil(false);
    }
}

