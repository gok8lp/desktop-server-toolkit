// FLUGEL Island — "Sanal makineler" sekmesi: her VM bir kart. Genel mono simge (marka logosu yok), durum
// noktası, altında aç · bağlan · kapat düğmeleri; üzerine gelince IP, vCPU/RAM, GPU aktarımı, açık kalma süresi.
// Kapatma her zaman nazik (ACPI); zorla kapatma düğmesi yok. Komutlar: ~/.local/bin/vm ve w11-gpu.
import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import {Sayfa} from './sayfa.js';
import {H, bash, calistir, ikon} from '../ortak.js';
import {Karo, Izgara, bolum, dugme, ipucuBagla} from '../bilesenler.js';
import {_, f} from '../dil.js';

export const VM_ETIKET = {'W11-GPU': 'Windows (GPU)', 'W11': 'Windows', 'mullvad-ts': 'Ubuntu VPN'};
const VM_ACIKLAMA = () => ({'W11-GPU': _('Ekran kartı aktarılmış Windows; Moonlight ile bağlanılır'),
    'W11': _('GPU\'suz Windows (aynı disk); konsolla bağlanılır'), 'mullvad-ts': _('Mullvad + Tailscale çıkış düğümü')});
const VM_SIMGE = {'W11-GPU': 'vm-windows', 'W11': 'vm-windows', 'mullvad-ts': 'vm-ubuntu'};
const DURUM = () => ({'running': ['acik', _('Çalışıyor')], 'shut off': ['kapali', _('Kapalı')], 'paused': ['bekliyor', _('Duraklatıldı')],
    'in shutdown': ['bekliyor', _('Kapanıyor…')]});

export function vmKomut(...arg) {
    bash(`${H}/.local/bin/vm ${arg.join(' ')}`);
}

const sure = sn => {
    if (!Number.isFinite(sn))
        return '';
    const sa = Math.floor(sn / 3600), dk = Math.floor((sn % 3600) / 60);
    return sa ? f(_('%s sa %s dk'), sa, dk) : f(_('%s dk'), dk);
};

export class VmSayfa extends Sayfa {
    constructor({veri, ayarlar}) {
        super();
        this._veri = veri;
        this._ayar = ayarlar;
        this._gizliId = ayarlar.connect('changed::vm-gizli', () => {
            this._cizilen?.clear();
            this.gorunurse(() => this._yaz());
        });
        this._kutu = new St.BoxLayout({style_class: 'flugel-vm-kartlar', x_align: Clutter.ActorAlign.CENTER});
        this.actor.add_child(bolum(_('Sunucudaki sanal makineler'), this._kutu));
        const araclar = new Izgara({sutun: 3});
        araclar.ekle(new Karo({ikon: 'video-display-symbolic', etiket: 'Moonlight', ipucu: _('Moonlight (Windows GPU akışı)'),
            eylem: () => {
                this.close();
                calistir('flatpak run com.moonlight_stream.Moonlight');
            }}));
        araclar.ekle(new Karo({ikon: 'preferences-system-symbolic', etiket: _('Yönetici'), ipucu: 'Sanal makine yöneticisi (virt-manager)',
            eylem: () => {
                this.close();
                calistir('virt-manager --connect qemu+ssh://flugelserver/system');
            }}));
        araclar.ekle(new Karo({ikon: 'view-refresh-symbolic', etiket: _('Yenile'), ipucu: _('Durumu şimdi sor'),
            eylem: () => this._veri.yenile('vm')}));
        this.actor.add_child(bolum(_('Araçlar'), araclar));
        this._liste = null;
        this._aboneler = [
            veri.abone('island', s => {
                if (s && !s.hata && Array.isArray(s.vm))
                    this._listeAyarla(s.vm);
            }),
            // işlemden sonra canlı sorgu (vm liste): ayrıntıları island verisinden tamamla
            veri.abone('vm', l => {
                if (!Array.isArray(l))
                    return;
                const eski = new Map((this._liste ?? []).map(v => [v.ad, v]));
                this._listeAyarla(l.map(v => ({...eski.get(v.ad), ...v})));
            }),
        ];
    }

    _listeAyarla(liste) {
        this._liste = liste;
        const acik = liste.filter(v => v.durum === 'running').length;
        this.rozetDegisti?.(acik ? String(acik) : '');
        this.gorunurse(() => this._yaz());
    }

    goster() {
        this._yaz();
    }

    _komut(...arg) {
        vmKomut(...arg);
        this._sik();
    }

    // işlem sonrası 8 sn'de bir, 2 dk boyunca canlı liste
    _sik() {
        if (this._sikId)
            GLib.source_remove(this._sikId);
        let n = 0;
        this._sikId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT_IDLE, 8, () => {
            this._veri.yenile('vm');
            if (++n < 15)
                return GLib.SOURCE_CONTINUE;
            this._sikId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _yaz() {
        if (!this.degisti('vm', this._liste))
            return;
        this._kutu.destroy_all_children();
        if (!this._liste) {
            this._kutu.add_child(new St.Label({text: _('Sunucuya ulaşılamadı'), style_class: 'flugel-soluk'}));
            return;
        }
        const gizli = new Set(this._ayar.get_strv('vm-gizli'));
        for (const v of this._liste.filter(x => !gizli.has(x.ad)))
            this._kutu.add_child(this._kart(v));
    }

    _kart(v) {
        const [nokta, durumAd] = DURUM()[v.durum] ?? ['bekliyor', v.durum];
        const acik = v.durum === 'running';
        const kart = new St.BoxLayout({style_class: 'flugel-vm-kart', orientation: Clutter.Orientation.VERTICAL,
            reactive: true, track_hover: true});
        const ust = new St.Widget({layout_manager: new Clutter.BinLayout(), x_align: Clutter.ActorAlign.CENTER});
        ust.add_child(new St.Icon({gicon: ikon(VM_SIMGE[v.ad] ?? 'computer-symbolic'), icon_size: 40, style_class: 'flugel-karo-simge'}));
        ust.add_child(new St.Widget({style_class: `flugel-nokta flugel-nokta-${nokta}`, x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END}));
        kart.add_child(ust);
        kart.add_child(new St.Label({text: VM_ETIKET[v.ad] ?? v.ad, style_class: 'flugel-vm-ad', x_align: Clutter.ActorAlign.CENTER}));
        kart.add_child(new St.Label({text: durumAd + (acik && v.acik_sn ? ` · ${sure(v.acik_sn)}` : ''),
            style_class: 'flugel-vm-durum', x_align: Clutter.ActorAlign.CENTER}));
        if (v.ad === 'W11-GPU' && acik)
            kart.add_child(new St.Label({text: _('yerel AI durdu'), style_class: 'flugel-rozet flugel-vm-rozet', x_align: Clutter.ActorAlign.CENTER}));
        const dugmeler = new St.BoxLayout({style_class: 'flugel-vm-dugmeler', x_align: Clutter.ActorAlign.CENTER});
        const d = (ik, ipucu, fn, etkin) => {
            const b = dugme(ik, ipucu, () => {
                this.close();
                fn();
            }, {stil: 'flugel-dugme flugel-dugme-kucuk'});
            b.reactive = etkin;
            b.opacity = etkin ? 255 : 90;
            dugmeler.add_child(b);
        };
        d('media-playback-start-symbolic', _('Aç ve bağlan'), () => this._komut('baslat', v.ad), !acik);
        d('video-display-symbolic', _('Bağlan'), () => this._komut('baglan', v.ad), acik);
        d('system-shutdown-symbolic', _('Kapat (nazik, ACPI)'), () => this._komut('kapat', v.ad), acik);
        kart.add_child(dugmeler);
        ipucuBagla(kart, () => ({baslik: `${VM_ETIKET[v.ad] ?? v.ad} (${v.ad})`, ayrinti: [
            VM_ACIKLAMA()[v.ad],
            f(_('%s vCPU · %s GB RAM%s'), v.vcpu ?? '?', v.ram_gb ?? '?', v.gpu_aktarim ? _(' · GPU aktarımı var') : ''),
            acik ? f(_('IP %s · %s açık'), v.ip || 'bilinmiyor', sure(v.acik_sn) || '?') : durumAd,
        ].filter(Boolean).join('\n')}));
        return kart;
    }

    destroy() {
        if (this._sikId)
            GLib.source_remove(this._sikId);
        this._sikId = 0;
        this._aboneler.forEach(f => f());
        this._ayar.disconnect(this._gizliId);
        super.destroy();
    }
}
