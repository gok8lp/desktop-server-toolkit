// FLUGEL Island — gizlilik: ekran kaydı, ekran paylaşımı, mikrofon ve kamera kullanımı.
// Mikrofon/kamera algılama HIMURAw/gnome-dynamic-island (GPL-3.0) privacy.js'ten uyarlandı. FLUGEL değişikliği:
// ses düzeyi ölçen (mikrofonu kaydeden) bölüm ALINMADI; sadece "kullanımda mı" bakılır. Ekran kaydı/paylaşımı eklendi.
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {getMixerControl} from 'resource:///org/gnome/shell/ui/status/volume.js';
import {createActivity} from '../activity.js';
import {oncelik} from './provider-base.js';
import {KIRMIZI, SARI} from '../ortak.js';

// Ses ayarları ve pavucontrol kendi ölçerleri için kayıt açar; onlar "mikrofon kullanımda" sayılmaz
const ATLANAN = ['org.gnome.VolumeControl', 'org.PulseAudio.pavucontrol'];

export class PrivacyProvider {
    constructor() {
        this.id = 'privacy';
        this._manager = null;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._mikser = getMixerControl();
        this._mikserIdleri = ['stream-added', 'stream-removed', 'stream-changed', 'state-changed']
            .map(s => this._mikser.connect(s, () => this._yenile()));
        this._kamera = new Shell.CameraMonitor();
        this._kameraId = this._kamera.connect('notify::cameras-in-use', () => this._yenile());
        this._kayitId = Main.screenshotUI.connect('notify::screencast-in-progress', () => this._yenile());
        this._paylasim = Main.panel.statusArea.screenSharing ?? null;
        this._paylasimId = this._paylasim?.connect('notify::visible', () => this._yenile()) ?? 0;
        this._yenile();
    }

    disable() {
        this._mikserIdleri?.forEach(id => this._mikser.disconnect(id));
        this._mikserIdleri = null;
        if (this._kamera) {
            this._kamera.disconnect(this._kameraId);
            this._kamera = null;
        }
        if (this._kayitId)
            Main.screenshotUI.disconnect(this._kayitId);
        if (this._paylasimId)
            this._paylasim.disconnect(this._paylasimId);
        this._kayitId = this._paylasimId = 0;
        this._paylasim = null;
        this._manager?.remove(`${this.id}:durum`);
        this._manager = null;
    }

    _mikrofon() {
        return this._mikser.get_source_outputs().some(o => !ATLANAN.includes(o.get_application_id()));
    }

    _yenile() {
        if (!this._manager)
            return;
        const kayit = !!Main.screenshotUI.screencast_in_progress;
        const paylasim = !!this._paylasim?.visible;
        const mik = this._mikrofon();
        const kam = !!this._kamera?.cameras_in_use;
        if (!kayit && !paylasim && !mik && !kam) {
            this._manager.remove(`${this.id}:durum`);
            return;
        }
        const parcalar = [kayit && 'ekran kaydı', paylasim && 'ekran paylaşımı', kam && 'kamera', mik && 'mikrofon'].filter(Boolean);
        const eylemler = [];
        if (kayit)
            eylemler.push({ikon: 'media-playback-stop-symbolic', ipucu: 'Kaydı durdur', fn: () => Main.screenshotUI.stopScreencast()});
        if (paylasim)
            eylemler.push({ikon: 'media-playback-stop-symbolic', ipucu: 'Paylaşımı durdur', fn: () => this._paylasim?._stopSharing?.()});
        const ilk = parcalar[0];
        this._manager.update(createActivity({
            id: `${this.id}:durum`,
            providerId: this.id,
            tier: 'persistent',
            slot: 'either',
            priority: oncelik(this._settings, this.id, kayit ? 50 : 0),
            glyph: kayit ? 'media-record-symbolic' : (paylasim ? 'screen-shared-symbolic' : (kam ? 'camera-web-symbolic' : 'audio-input-microphone-symbolic')),
            label: ilk.charAt(0).toUpperCase() + ilk.slice(1),
            sublabel: parcalar.length > 1 ? `+ ${parcalar.slice(1).join(', ')}` : 'kullanımda',
            data: {renk: kayit || kam ? KIRMIZI : SARI, yanip: kayit, kisa: kayit ? 'REC' : '', eylemler},
        }));
    }
}
