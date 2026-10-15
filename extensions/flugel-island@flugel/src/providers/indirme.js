// FLUGEL Island — indirmeler (Atoll'daki "downloads" canlı etkinliği): İndirilenler klasöründe tarayıcının geçici
// dosyası (.crdownload, .part, .download) belirince kapsülde "indiriliyor" (boyut ve hız), bitince kısa bir duyuru ve
// "Aç / Klasörde göster" düğmeleri. Klasör Gio.FileMonitor ile izlenir; boyut 1,5 sn'de bir okunur, sadece indirme varken.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {createActivity, _now} from '../activity.js';
import {oncelik} from './provider-base.js';
import {calistir} from '../ortak.js';
import {_, f} from '../dil.js';

const GECICI = /\.(crdownload|part|download|partial)$/i;
const boyut = b => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

export class IndirmeProvider {
    constructor() {
        this.id = 'indirme';
        this._suren = new Map();   // geçici yol → {ad, oncekiBoyut, zaman}
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        const yol = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD) ?? GLib.build_filenamev([GLib.get_home_dir(), 'Downloads']);
        this._klasor = Gio.File.new_for_path(yol);
        try {
            this._izleyici = this._klasor.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
            this._izleyiciId = this._izleyici.connect('changed', (_m, dosya, diger, olay) => this._olay(dosya, diger, olay));
        } catch (e) {
            console.warn(`FLUGEL Island: indirme klasörü izlenemiyor: ${e.message}`);
        }
    }

    disable() {
        if (this._izleyici) {
            this._izleyici.disconnect(this._izleyiciId);
            this._izleyici.cancel();
        }
        this._izleyici = null;
        if (this._tikId)
            GLib.source_remove(this._tikId);
        this._tikId = 0;
        this._manager?.remove(`${this.id}:suruyor`);
        this._manager = null;
        this._suren.clear();
    }

    _olay(dosya, diger, olay) {
        const ad = dosya.get_basename();
        const E = Gio.FileMonitorEvent;
        if ((olay === E.CREATED || olay === E.CHANGED) && GECICI.test(ad) && !this._suren.has(dosya.get_path())) {
            this._suren.set(dosya.get_path(), {ad: ad.replace(GECICI, ''), oncekiBoyut: 0, zaman: GLib.get_monotonic_time(), hiz: 0});
            this._zamanla();
        } else if ((olay === E.RENAMED || olay === E.MOVED_OUT) && this._suren.has(dosya.get_path())) {
            // geçici dosya son adına taşındı: indirme bitti
            this._suren.delete(dosya.get_path());
            if (diger && !GECICI.test(diger.get_basename()))
                this._bitti(diger);
            this._zamanla();
        } else if (olay === E.DELETED && this._suren.has(dosya.get_path())) {
            this._suren.delete(dosya.get_path());   // iptal
            this._zamanla();
        }
    }

    _zamanla() {
        if (!this._suren.size) {
            if (this._tikId)
                GLib.source_remove(this._tikId);
            this._tikId = 0;
            this._manager?.remove(`${this.id}:suruyor`);
            return;
        }
        this._yaz();
        if (!this._tikId) {
            this._tikId = GLib.timeout_add(GLib.PRIORITY_LOW, 1500, () => {
                this._yaz();
                return GLib.SOURCE_CONTINUE;
            });
        }
    }

    _yaz() {
        if (!this._manager)
            return;
        let toplam = 0;
        const simdi = GLib.get_monotonic_time();
        for (const [yol, k] of this._suren) {
            let b = 0;
            try {
                b = Gio.File.new_for_path(yol).query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size();
            } catch (e) {
                continue;
            }
            const dt = (simdi - k.zaman) / 1e6;
            if (dt > 0.5) {
                k.hiz = Math.max(0, (b - k.oncekiBoyut) / dt);
                k.oncekiBoyut = b;
                k.zaman = simdi;
            }
            k.boyut = b;
            toplam += k.hiz;
        }
        const [ilk] = this._suren.values();
        this._manager.update(createActivity({id: `${this.id}:suruyor`, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id), glyph: 'folder-download-symbolic',
            label: this._suren.size > 1 ? f(_('%s dosya indiriliyor'), this._suren.size) : f(_('İndiriliyor: %s'), ilk.ad),
            sublabel: `${boyut(ilk.boyut ?? 0)} · ${boyut(toplam)}/s`,
            data: {kisa: `${boyut(toplam)}/s`, yanip: false, eylemler: [
                {ikon: 'folder-download-symbolic', ipucu: _('İndirilenler klasörü'), fn: () => calistir(`xdg-open ${GLib.shell_quote(this._klasor.get_path())}`)},
            ]}}));
    }

    _bitti(dosya) {
        const now = _now();
        const yol = dosya.get_path();
        this._manager?.push(createActivity({id: `${this.id}:bitti`, providerId: this.id, tier: 'transient', slot: 'either',
            priority: oncelik(this._settings, this.id, 30), glyph: 'emblem-ok-symbolic',
            label: f(_('İndirildi: %s'), dosya.get_basename()), startedAt: now, expiresAt: now + 6000000,
            data: {eylemler: [
                {ikon: 'document-open-symbolic', ipucu: _('Aç'), fn: () => calistir(`xdg-open ${GLib.shell_quote(yol)}`)},
                {ikon: 'folder-open-symbolic', ipucu: _('Klasörde göster'),
                    fn: () => calistir(`nautilus --select ${GLib.shell_quote(yol)}`)},
            ]}}));
    }
}
