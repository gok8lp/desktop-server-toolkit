// FLUGEL Island — anime: izlediğin bir dizinin yeni bölümü 1 saatten az kaldıysa geri sayım,
// yayınlandıysa 2 saat boyunca "çıktı" (sadece MAL/AniList bağlantısı; lisanssız site yok).
import GLib from 'gi://GLib';
import {createActivity} from '../activity.js';
import {oncelik} from './provider-base.js';
import {calistir, geriSayim} from '../ortak.js';

const TAKIP = new Set(['Izliyorum', 'Beklemede']);

export class AnimeProvider {
    constructor(ortam) {
        this.id = 'anime';
        this._ortam = ortam;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._abonelik = this._ortam.veri.abone('anime', d => {
            if (d && !d.hata)
                this._liste = d.anime ?? [];
            this._yaz();
        });
        this._dakikaId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 60, () => {
            this._yaz();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        this._abonelik?.();
        if (this._dakikaId)
            GLib.source_remove(this._dakikaId);
        this._dakikaId = 0;
        this._manager?.remove(`${this.id}:bolum`);
        this._manager = null;
    }

    _yaz() {
        if (!this._manager)
            return;
        const simdi = Math.floor(Date.now() / 1000);
        const esik = this._settings.get_int('anime-yakin-dk') * 60;
        // sunucu verisinde "yayin" bir sonraki bölümün zamanıdır; yayınlanınca bir sonrakine geçer.
        // Bu yüzden "çıktı" bilgisi, önceki yenilemede yakın olan bölümün zamanının geçmesinden anlaşılır.
        const adaylar = (this._liste ?? []).filter(a => TAKIP.has(a.liste) && a.yayin);
        const yakin = adaylar.filter(a => a.yayin - simdi <= esik && a.yayin - simdi > -7200)
            .sort((x, y) => x.yayin - y.yayin)[0];
        if (yakin)
            this._son = {...yakin};
        const a = yakin ?? (this._son && simdi - this._son.yayin < 7200 ? this._son : null);
        if (!a) {
            this._manager.remove(`${this.id}:bolum`);
            return;
        }
        const cikti = a.yayin <= simdi;
        const url = /^https?:\/\//.test(a.url ?? '') ? a.url : null;
        this._manager.update(createActivity({
            id: `${this.id}:bolum`, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id, cikti ? 40 : 0),
            glyph: 'anime',
            label: cikti ? `${a.sonraki_bolum}. bölüm çıktı` : `${a.sonraki_bolum}. bölüm ${geriSayim(a.yayin)} sonra`,
            sublabel: a.ad,
            data: {kisa: cikti ? 'yeni' : geriSayim(a.yayin), eylemler: [
                ...(url ? [{ikon: 'send-to-symbolic', ipucu: 'MyAnimeList / AniList sayfası', fn: () => calistir(`xdg-open ${GLib.shell_quote(url)}`)}] : []),
                {ikon: 'anime', ipucu: 'Anime sekmesi', fn: () => this._ortam.sekmeAc('anime')},
            ]},
        }));
    }
}
