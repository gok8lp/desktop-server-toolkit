// FLUGEL Island — "VM" sekmesi: sunucudaki sanal makineler (W11-GPU Moonlight ile, diğerleri konsol).
// Liste /api/island'dan gelir; bir işlemden sonra 2 dakika boyunca `vm liste` ile canlı izlenir.
// Kapatma her zaman düzgün (ACPI) yapılır, asla zorla değil.
import GLib from 'gi://GLib';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Sayfa} from './sayfa.js';
import {H, SARI, bash, bilgiSatiri, menuOgesi, altMenu, renkli, soluk} from '../ortak.js';

export const VM_ETIKET = {'W11-GPU': 'Windows (GPU)', 'W11': 'Windows (GPU\'suz)', 'mullvad-ts': 'Ubuntu (Mullvad + Tailscale)'};
const VM_DURUM = {'running': ['●', 'Açık'], 'shut off': ['○', 'Kapalı'], 'paused': ['◐', 'Duraklatıldı'],
    'in shutdown': ['◐', 'Kapanıyor…']};

export function vmKomut(...arg) {
    bash(`${H}/.local/bin/vm ${arg.join(' ')}`);
}

export class VmSayfa extends Sayfa {
    constructor({veri}) {
        super();
        this._veri = veri;
        bilgiSatiri(this, '<b>Sunucudaki sanal makineler</b>', 'computer-symbolic');
        this._bolum = new PopupMenu.PopupMenuSection();
        this.addMenuItem(this._bolum);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menuOgesi(this, 'Moonlight', 'flatpak run com.moonlight_stream.Moonlight', 'video-display-symbolic');
        menuOgesi(this, 'Sanal makine yöneticisi', 'virt-manager --connect qemu+ssh://flugelserver/system', 'preferences-system-symbolic');
        bilgiSatiri(this, `<small>${soluk('Windows (GPU) açıkken Jellyfin/Plex/Immich ML ve yerel yapay zekâ durur · W11 ikisi aynı disk')}</small>`);
        this._liste = null;
        this._aboneler = [
            veri.abone('island', s => {
                if (s && !s.hata && Array.isArray(s.vm))
                    this._listeAyarla(s.vm.map(v => ({ad: v.ad, etiket: VM_ETIKET[v.ad] ?? v.ad, durum: v.durum})));
                else if (!this._liste)
                    this._listeAyarla(null);
            }),
            veri.abone('vm', l => this._listeAyarla(Array.isArray(l) ? l : this._liste)),
        ];
    }

    _listeAyarla(liste) {
        this._liste = liste;
        const acik = (liste ?? []).filter(v => v.durum === 'running').length;
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
        this._bolum.removeAll();
        const liste = this._liste;
        if (!liste) {
            bilgiSatiri(this._bolum, renkli('Sunucuya ulaşılamadı', SARI));
            return;
        }
        for (const v of liste) {
            const [n, y] = VM_DURUM[v.durum] || ['?', v.durum];
            const alt = altMenu(this._bolum, `${n}  ${v.etiket}  ·  ${y}`);
            if (v.durum === 'running') {
                menuOgesi(alt.menu, 'Bağlan', () => this._komut('baglan', v.ad), 'video-display-symbolic');
                menuOgesi(alt.menu, 'Kapat (düzgün)', () => this._komut('kapat', v.ad), 'system-shutdown-symbolic');
            } else {
                menuOgesi(alt.menu, 'Aç ve bağlan', () => this._komut('baslat', v.ad), 'media-playback-start-symbolic');
            }
        }
    }

    destroy() {
        if (this._sikId)
            GLib.source_remove(this._sikId);
        this._sikId = 0;
        this._aboneler.forEach(f => f());
        super.destroy();
    }
}
