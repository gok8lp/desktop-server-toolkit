// FLUGEL Island — ses / parlaklık / klavye ışığı göstergesi.
// hacksynth/gnome-dynamic-island (GPL-2.0-or-later) volume-brightness.js fikrinden yeniden yazıldı:
// GNOME'un OSD çağrıları (showAll/showOne) InjectionManager ile izlenir; böylece ses, ekran parlaklığı ve
// klavye ışığı tek yerden yakalanır. "osd-yerine" açıksa ve Island görünüyorsa GNOME'un ortadaki göstergesi
// gösterilmez; tam ekran oyundayken (Island gizli) GNOME'unki çalışmaya devam eder.
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import {createActivity, _now} from '../activity.js';
import {oncelik, geciciSure} from './provider-base.js';
import {_} from '../dil.js';

function tur(simge) {
    const ad = simge?.to_string?.() ?? String(simge ?? '');
    if (ad.includes('audio-volume') || ad.includes('audio-speakers'))
        return _('Ses');
    if (ad.includes('display-brightness'))
        return _('Parlaklık');
    if (ad.includes('keyboard-brightness'))
        return _('Klavye ışığı');
    if (ad.includes('microphone'))
        return _('Mikrofon');
    return null;
}

export class OsdProvider {
    constructor(ortam) {
        this.id = 'osd';
        this._ortam = ortam;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._enj = new InjectionManager();
        const osd = Main.osdWindowManager;
        const self = this;
        this._enj.overrideMethod(osd, 'showAll', orijinal => function (simge, etiket, seviye, azami) {
            if (!self._goster(simge, etiket, seviye, azami, Main.layoutManager.primaryIndex))
                orijinal.call(this, simge, etiket, seviye, azami);
        });
        this._enj.overrideMethod(osd, 'showOne', orijinal => function (monitor, simge, etiket, seviye, azami) {
            if (!self._goster(simge, etiket, seviye, azami, monitor))
                orijinal.call(this, monitor, simge, etiket, seviye, azami);
        });
    }

    disable() {
        this._enj?.clear();
        this._enj = null;
        this._manager?.remove(`${this.id}:flash`);
        this._manager = null;
    }

    // true dönerse GNOME'un kendi göstergesi gösterilmez
    _goster(simge, etiket, seviye, _azami, monitor) {
        const ad = tur(simge) ?? etiket;
        if (!this._manager || !ad)
            return false;
        const now = _now();
        const varSeviye = Number.isFinite(seviye);
        // azami > 1 ise ses %100'ün üstüne çıkabiliyordur; çubuk %100'de dolu görünür
        const oran = varSeviye ? Math.max(0, Math.min(1, seviye)) : null;
        this._manager.push(createActivity({
            id: `${this.id}:flash`, providerId: this.id, tier: 'transient', slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph: simge ?? 'audio-volume-high-symbolic',
            label: varSeviye ? `${ad} ${Math.round(seviye * 100)}%` : (etiket || ad),
            startedAt: now,
            expiresAt: now + geciciSure(this._settings),
            data: varSeviye ? {ilerleme: oran} : {},
        }));
        return this._settings.get_boolean('osd-yerine') && this._ortam.adaGorunur(monitor);
    }
}
