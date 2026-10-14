// FLUGEL Island — güç durumu ve Hızlı Ayarlar'daki "Pil Tasarrufu" anahtarı (FLUGEL v1 panelinden).
// seyrek = pilde || Pil Tasarrufu açık → yenilemeler seyrekleşir, sürekli animasyonlar durur.
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {QuickToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {H, ONBELLEK, calistir} from './ortak.js';
import {_} from './dil.js';

const TASARRUF_ISARETI = `${ONBELLEK}/pilde`;

export class GucDurumu {
    constructor() {
        this.pilde = false;
        this.tasarruf = GLib.file_test(TASARRUF_ISARETI, GLib.FileTest.EXISTS);
        this._dinleyiciler = new Set();
        this._iptal = new Gio.Cancellable();
        // pil-modu servisi fiş çekilince de tasarrufa geçer; gerçek durum işaret dosyasındadır
        this._izleyici = Gio.File.new_for_path(TASARRUF_ISARETI).monitor_file(Gio.FileMonitorFlags.NONE, null);
        this._izleyiciId = this._izleyici.connect('changed', () => {
            const var_ = GLib.file_test(TASARRUF_ISARETI, GLib.FileTest.EXISTS);
            if (var_ !== this.tasarruf) {
                this.tasarruf = var_;
                this._bildir();
            }
        });
        Gio.DBusProxy.new_for_bus(Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, null,
            'org.freedesktop.UPower', '/org/freedesktop/UPower', 'org.freedesktop.UPower', this._iptal,
            (_o, res) => {
                try {
                    this._upower = Gio.DBusProxy.new_for_bus_finish(res);
                } catch (e) {
                    return;
                }
                this._upowerId = this._upower.connect('g-properties-changed', () => this._oku());
                this._oku();
            });
    }

    _oku() {
        const pilde = !!this._upower?.get_cached_property('OnBattery')?.unpack();
        if (pilde === this.pilde)
            return;
        this.pilde = pilde;
        this._bildir();
    }

    get seyrek() {
        return this.pilde || this.tasarruf;
    }

    abone(fn) {
        this._dinleyiciler.add(fn);
        fn(this);
        return () => this._dinleyiciler.delete(fn);
    }

    _bildir() {
        for (const fn of this._dinleyiciler)
            fn(this);
    }

    tasarrufAyarla(acik) {
        if (acik === this.tasarruf)
            return;
        // durum, betik işaret dosyasını oluşturunca/silince dosya izleyicisinden gelir
        calistir(`${H}/.local/bin/pil-modu ${acik ? 'tasarruf' : 'normal'}`);
    }

    destroy() {
        this._iptal.cancel();
        this._izleyici.disconnect(this._izleyiciId);
        this._izleyici.cancel();
        this._izleyici = null;
        if (this._upower && this._upowerId)
            this._upower.disconnect(this._upowerId);
        this._upower = null;
        this._dinleyiciler.clear();
    }
}

const TasarrufAnahtari = GObject.registerClass(
class TasarrufAnahtari extends QuickToggle {
    _init(guc) {
        super._init({title: _('Pil Tasarrufu'), subtitle: _('Parlaklık %40, animasyonsuz'),
            iconName: 'power-profile-power-saver-symbolic', toggleMode: true});
        // sadece kullanıcı tıklayınca çalışır; programla durum güncellemesi döngü yaratmaz
        this.connect('clicked', () => guc.tasarrufAyarla(this.checked));
    }
});

export const TasarrufGostergesi = GObject.registerClass(
class TasarrufGostergesi extends SystemIndicator {
    _init(guc) {
        super._init();
        this._simge = this._addIndicator();
        this._simge.iconName = 'power-profile-power-saver-symbolic';
        this._anahtar = new TasarrufAnahtari(guc);
        this.quickSettingsItems.push(this._anahtar);
        this._abonelik = guc.abone(g => {
            this._anahtar.checked = g.tasarruf;
            this._simge.visible = g.tasarruf;
        });
        Main.panel.statusArea.quickSettings.addExternalIndicator(this);
    }

    destroy() {
        this._abonelik?.();
        this.quickSettingsItems.forEach(i => i.destroy());
        super.destroy();
    }
});
