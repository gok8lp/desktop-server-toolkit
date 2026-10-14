// FLUGEL Island — sunucu bildirimlerinin kategorisi ve susturma (Bildirimler sekmesi + kapsüldeki sunucu uyarısı).
// Kategori metinden çıkarılır; susturma ayarı 'sunucu-sessiz' = JSON {kategori: bitiş zamanı (sn) | 0 = süresiz}.
import {_} from './dil.js';

// [kimlik, desen, simge]
const KURALLAR = [
    ['ozet', /özet|ozet|günaydın|gunaydin|🌅/i, 'x-office-document-symbolic'],
    ['yedek', /yedek|backup/i, 'document-save-symbolic'],
    ['servis', /servis|service|konteyner|container|unhealthy|sağlıksız/i, 'system-run-symbolic'],
    ['guvenlik', /virüs|virus|ssh|giriş|login|fail2ban|güvenlik/i, 'security-high-symbolic'],
    ['disk', /disk|smart|doluluk|alan/i, 'drive-harddisk-symbolic'],
    ['ag', /vpn|gluetun|tailscale|ağ|network|internet/i, 'network-wired-symbolic'],
    ['anime', /anime|manga|bölüm|bolum|📺/i, 'anime'],
    ['mac', /maç|mac |basket|hakem|bülten|bulten/i, 'basket'],
    ['durum', /sorun|normal|yük|yuk|ram|swap|sıcaklık|cpu/i, 'utilities-system-monitor-symbolic'],
];

export const KATEGORI_AD = () => ({yedek: _('Yedek'), servis: _('Servisler'), guvenlik: _('Güvenlik'), disk: _('Disk'),
    ag: _('Ağ / VPN'), anime: _('Anime'), mac: _('Maçlar'), ozet: _('Günlük özet'), durum: _('Sunucu durumu'), diger: _('Diğer')});

export function kategori(metin) {
    for (const [k, desen, ikon] of KURALLAR) {
        if (desen.test(metin))
            return {k, ikon};
    }
    return {k: 'diger', ikon: 'dialog-information-symbolic'};
}

export function sessizler(ayar) {
    try {
        return JSON.parse(ayar.get_string('sunucu-sessiz') || '{}');
    } catch (e) {
        return {};
    }
}

export function sessizMi(ayar, k) {
    const bitis = sessizler(ayar)[k];
    if (bitis === undefined)
        return false;
    return bitis === 0 || bitis > Date.now() / 1000;
}

export function sessizeAl(ayar, k, saniye) {
    const s = sessizler(ayar);
    if (saniye === null)
        delete s[k];
    else
        s[k] = saniye === 0 ? 0 : Math.floor(Date.now() / 1000) + saniye;
    ayar.set_string('sunucu-sessiz', JSON.stringify(s));
}
