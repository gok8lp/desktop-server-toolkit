// FLUGEL Island — sunucu kaynaklı canlı etkinlikler (/api/island verisi, VeriMerkezi üzerinden):
//   sunucu  : boştaki kapsülde mini durum noktası + sorun varsa kritik uyarı (kapatılabilir; aynı sorun tekrar gelmez)
//   gpu-vm  : Windows (GPU) sanal makinesi açıkken (yerel yapay zekâ ve medya hızlandırma durmuştur)
//   akis    : FLUGEL Akış'ta takip ettiğin bir kelime geçti (son 30 dk)
import GLib from 'gi://GLib';
import {createActivity} from '../activity.js';
import {oncelik} from './provider-base.js';
import {KIRMIZI, SARI, SOLUK, calistir} from '../ortak.js';
import {vmKomut} from '../sayfalar/vm.js';
import {_, f} from '../dil.js';

export class SunucuProvider {
    constructor(ortam) {
        this.id = 'sunucu';
        this._ortam = ortam;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._abonelik = this._ortam.veri.abone('island', s => this._yaz(s));
    }

    disable() {
        this._abonelik?.();
        this._manager?.remove(`${this.id}:mini`);
        this._manager?.remove(`${this.id}:uyari`);
        this._manager = null;
    }

    _yaz(s) {
        const ulasilamiyor = !s || s.hata;
        const sorunlu = !ulasilamiyor && s.durum !== 'IYI';
        const kritik = sorunlu && /KRIT|HATA/i.test(`${s.durum} ${(s.uyarilar || []).map(u => u.seviye).join(' ')}`);
        this._manager.update(createActivity({
            id: `${this.id}:mini`, providerId: this.id, tier: 'ambient', slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph: 'network-server-symbolic',
            label: ulasilamiyor ? _('Sunucu: ulaşılamıyor') : f(_('Sunucu: %s'), s.durum),
            data: {mini: true, renk: ulasilamiyor ? SOLUK : (kritik ? KIRMIZI : (sorunlu ? SARI : null)),
                kisa: sorunlu ? '!' : ''},
        }));
        if (!sorunlu) {
            this._manager.remove(`${this.id}:uyari`);
            return;
        }
        const sorunlar = s.sorunlar || [];
        // imzada sayılar yok: "Yük yüksek: 5dk ort 16" ile "… ort 37" aynı sorun sayılır
        const imza = `${s.durum}|${sorunlar.map(x => x.replace(/[\d.,]+/g, '#')).sort().join('|')}`;
        if (this._settings.get_string('sunucu-goruldu') === imza) {
            this._manager.remove(`${this.id}:uyari`);
            return;
        }
        this._manager.update(createActivity({
            id: `${this.id}:uyari`, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id, kritik ? 50 : 0),
            glyph: 'dialog-warning-symbolic',
            label: f(_('Sunucu: %s'), sorunlar[0] ?? s.durum),
            sublabel: sorunlar.length > 1 ? f(_('+%s sorun daha'), sorunlar.length - 1) : (s.eski ? _('eski veri') : 'flugelserver'),
            data: {renk: kritik ? KIRMIZI : SARI, kisa: '!', eylemler: [
                {ikon: 'utilities-system-monitor-symbolic', ipucu: _('Sistem sekmesini aç'), fn: () => this._ortam.sekmeAc('sistem')},
            ], kapat: () => {
                this._settings.set_string('sunucu-goruldu', imza);
                this._manager?.remove(`${this.id}:uyari`);
            }},
        }));
    }
}

export class GpuVmProvider {
    constructor(ortam) {
        this.id = 'gpu-vm';
        this._ortam = ortam;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._abonelik = this._ortam.veri.abone('island', s => this._yaz(s));
    }

    disable() {
        this._abonelik?.();
        this._manager?.remove(`${this.id}:acik`);
        this._manager = null;
    }

    _yaz(s) {
        const acik = s && !s.hata && (s.gpu_vmde || (s.vm || []).some(v => v.ad === 'W11-GPU' && v.durum === 'running'));
        if (!acik) {
            this._manager.remove(`${this.id}:acik`);
            return;
        }
        this._manager.update(createActivity({
            id: `${this.id}:acik`, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph: 'video-display-symbolic',
            label: _('Windows (GPU) açık'),
            sublabel: _('yerel yapay zekâ ve medya hızlandırma durdu'),
            data: {kisa: 'W11', eylemler: [
                {ikon: 'video-display-symbolic', ipucu: _('Bağlan (Moonlight)'), fn: () => vmKomut('baglan', 'W11-GPU')},
                {ikon: 'system-shutdown-symbolic', ipucu: _('Düzgünce kapat'), fn: () => vmKomut('kapat', 'W11-GPU')},
            ]},
        }));
    }
}

export class AkisProvider {
    constructor(ortam) {
        this.id = 'akis';
        this._ortam = ortam;
        this._gizlenen = 0;
    }

    enable(manager, settings) {
        this._manager = manager;
        this._settings = settings;
        this._abonelik = this._ortam.veri.abone('island', s => this._yaz(s));
    }

    disable() {
        this._abonelik?.();
        this._manager?.remove(`${this.id}:takip`);
        this._manager = null;
    }

    _yaz(s) {
        const t = (s?.takip || []).filter(x => x.ts > this._gizlenen);
        if (!t.length) {
            this._manager.remove(`${this.id}:takip`);
            return;
        }
        const son = t[0];
        const link = /^https?:\/\//.test(son.link ?? '') ? son.link : null;
        this._manager.update(createActivity({
            id: `${this.id}:takip`, providerId: this.id, tier: 'persistent', slot: 'either',
            priority: oncelik(this._settings, this.id),
            glyph: 'view-list-symbolic',
            label: son.baslik ?? _('FLUGEL Akış'),
            sublabel: `${son.kaynak ?? _('Akış')}${t.length > 1 ? ` · +${t.length - 1}` : ''}`,
            data: {kisa: _('Akış'), eylemler: [
                ...(link ? [{ikon: 'send-to-symbolic', ipucu: _('Haberi aç'), fn: () => calistir(`xdg-open ${GLib.shell_quote(link)}`)}] : []),
                {ikon: 'view-list-symbolic', ipucu: _('FLUGEL Akış'), fn: () => calistir('xdg-open http://192.168.0.15:3012')},
            ], kapat: () => {
                this._gizlenen = Math.max(...t.map(x => x.ts));
                this._manager?.remove(`${this.id}:takip`);
            }},
        }));
    }
}
