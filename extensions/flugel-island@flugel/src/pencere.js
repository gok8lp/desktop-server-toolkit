// FLUGEL Island — pencere yardımcıları (FLUGEL v1 panelinden):
//  * Uygulama sağ tık menüsüne "Masaüstüne ekle"
//  * Resim içinde resim (Chrome/YouTube) pencereleri her zaman üstte ve tüm çalışma alanlarında
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import {AppMenu} from 'resource:///org/gnome/shell/ui/appMenu.js';
import {H} from './ortak.js';

const PIP = /picture[- ]in[- ]picture|pencere i[cç]inde pencere|resim i[cç]inde resim/i;

function masaustuneEkle(app) {
    const kaynak = app?.app_info?.get_filename?.();
    if (!kaynak)
        return;
    const masaustu = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) || `${H}/Desktop`;
    GLib.mkdir_with_parents(masaustu, 0o755);
    const hedef = Gio.File.new_for_path(`${masaustu}/${GLib.path_get_basename(kaynak)}`);
    try {
        Gio.File.new_for_path(kaynak).copy(hedef, Gio.FileCopyFlags.OVERWRITE, null, null);
        hedef.set_attribute_uint32('unix::mode', 0o755, Gio.FileQueryInfoFlags.NONE, null);
        // DING (masaüstü simgeleri) için "çalıştırmaya izin ver" işareti
        hedef.set_attribute_string('metadata::trusted', 'true', Gio.FileQueryInfoFlags.NONE, null);
        Main.notify('Masaüstüne eklendi', app.get_name());
    } catch (e) {
        Main.notify('Masaüstüne eklenemedi', String(e).slice(0, 80));
    }
}

export class PencereYardimcisi {
    enable() {
        this._enj = new InjectionManager();
        const menuler = this._menuler = new Set();
        this._enj.overrideMethod(AppMenu.prototype, 'setApp', orijinal => function (app) {
            orijinal.call(this, app);
            if (!this._flugelMasaustu) {
                this._flugelMasaustu = this.addAction('Masaüstüne ekle', () => masaustuneEkle(this._app));
                menuler.add(this);
                this.connect('destroy', () => menuler.delete(this));
            }
            this._flugelMasaustu.visible = !!this._app?.app_info?.get_filename?.();
        });

        this._pipBaslik = new Map();
        this._pipId = global.display.connect('window-created', (_d, w) => {
            this._pip(w);
            const baslikId = w.connect('notify::title', () => this._pip(w));
            const gitId = w.connect('unmanaged', () => {
                w.disconnect(baslikId);
                w.disconnect(gitId);
                this._pipBaslik?.delete(w);
            });
            this._pipBaslik.set(w, [baslikId, gitId]);
        });
    }

    _pip(w) {
        if (w && PIP.test(w.get_title() ?? '') && !w.is_above()) {
            w.make_above();
            w.stick();
        }
    }

    disable() {
        if (this._pipId)
            global.display.disconnect(this._pipId);
        this._pipId = 0;
        for (const [w, idler] of this._pipBaslik ?? [])
            idler.forEach(id => w.disconnect(id));
        this._pipBaslik = null;
        this._enj?.clear();
        this._enj = null;
        // eklenen "Masaüstüne ekle" eylemi açık kalan menülerden de kaldırılır
        for (const m of this._menuler ?? []) {
            m._flugelMasaustu?.destroy();
            delete m._flugelMasaustu;
        }
        this._menuler = null;
    }
}
