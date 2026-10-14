// FLUGEL Island — "Sistem" sekmesi: bu PC, pil + Pil Tasarrufu, sunucu (flugelserver) ve son uyarılar.
// Sunucu verisi /api/island'dan gelir (PC her seferinde SSH açmaz).
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Sayfa} from './sayfa.js';
import {H, KIRMIZI, SARI, bilgiSatiri, menuOgesi, altMenu, baslik, kac, renkli, renkSicak, renkYuzde, soluk} from '../ortak.js';
import {_, f} from '../dil.js';

export class SistemSayfa extends Sayfa {
    constructor({veri, guc}) {
        super();
        this._veri = veri;
        this._guc = guc;
        baslik(this, _('Bu bilgisayar'));
        this._pc = new PopupMenu.PopupMenuSection();
        this.addMenuItem(this._pc);
        this._tasarruf = new PopupMenu.PopupSwitchMenuItem(_('Pil Tasarrufu (parlaklık %40, animasyonsuz)'), guc.tasarruf);
        this._tasarruf.connect('toggled', (_i, acik) => guc.tasarrufAyarla(acik));
        this.addMenuItem(this._tasarruf);
        this._gucAbone = guc.abone(g => this._tasarruf.setToggleState(g.tasarruf));

        baslik(this, _('Sunucu (flugelserver)'));
        this._sunucu = new PopupMenu.PopupMenuSection();
        this.addMenuItem(this._sunucu);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const ac = altMenu(this, _('Aç'), 'view-app-grid-symbolic');
        menuOgesi(ac.menu, _('Sunucu paneli'), 'xdg-open http://192.168.0.15:3010', 'view-app-grid-symbolic');
        menuOgesi(ac.menu, _('Sunucu durumu + yapay zekâ analizi'), `${H}/.local/bin/sunucu-durum-ac`, 'network-server-symbolic');
        menuOgesi(ac.menu, _('Netdata (canlı grafikler)'), `${H}/.local/bin/sunucu-ac http 19999 /`, 'utilities-system-monitor-symbolic');
        menuOgesi(ac.menu, _('Bu PC: Sistem İzleyici'), 'gnome-system-monitor', 'computer-symbolic');
        menuOgesi(ac.menu, _('Sunucuya terminalle bağlan'), 'kitty ssh flugelserver', 'utilities-terminal-symbolic');
        menuOgesi(this, _('Yenile'), () => {
            this._veri.yenile('pc', true);
            this._veri.yenile('island', true);
        }, 'view-refresh-symbolic');

        // kart kapalıyken menü satırları yeniden kurulmaz; sadece sekme rozeti güncellenir
        this._aboneler = [
            veri.abone('pc', p => this.gorunurse(() => this._pcYaz(p))),
            veri.abone('island', s => {
                this.rozetDegisti?.(s && !s.hata && s.durum !== 'IYI' ? '!' : '');
                this.gorunurse(() => this._sunucuYaz(s));
            }),
        ];
    }

    goster() {
        this._pcYaz(this._veri.son('pc'));
        this._sunucuYaz(this._veri.son('island'));
        // kart açıkken ayrıca tazele (zamanlayıcıyı beklemeden)
        this._veri.tazele('pc', 15);
        this._veri.tazele('island', 20);
    }

    _pcYaz(p) {
        if (!this.degisti('pc', p))
            return;
        this._pc.removeAll();
        if (!p || p.hata) {
            bilgiSatiri(this._pc, f(_('Okunamadı: %s'), kac(p?.hata)));
            return;
        }
        bilgiSatiri(this._pc, f(_('CPU <b>%s</b>   Sıcaklık <b>%s</b>   GPU <b>%s</b>'), renkli(`${p.cpu}%`, renkYuzde(p.cpu)), renkli(`${p.temp || '?'}°C`, renkSicak(p.temp)), renkli(`${p.gpu || '?'}°C`, renkSicak(p.gpu))), 'computer-symbolic');
        bilgiSatiri(this._pc, f(_('RAM <b>%s / %s GB</b>   Disk <b>%s</b> dolu'), p.ram_kul, p.ram_top, p.disk), 'drive-harddisk-symbolic');
        const kalan = (p.pil_kalan || '').replace('hours', 'saat').replace('hour', 'saat').replace('minutes', 'dk');
        bilgiSatiri(this._pc, f(_('Pil <b>%%%s</b>  %s%s%s'), p.pil, p.pil_durum, kalan ? ` · ${kalan}` : '', this._guc.pilde ? soluk(_(' · yenilemeler seyrek')) : ''), 'battery-full-symbolic');
        bilgiSatiri(this._pc, f(_('%s   Tailscale: %s   Açık: %s'), kac(p.wifi || _('ağ yok')), p.tailscale === 'Running' ? _('açık') : renkli(p.tailscale || _('kapalı'), SARI), kac(p.uptime)), 'network-wireless-symbolic');
    }

    _sunucuYaz(s) {
        if (!this.degisti('sunucu', s))
            return;
        this._sunucu.removeAll();
        if (!s || s.hata) {
            bilgiSatiri(this._sunucu, renkli(_('Sunucuya ulaşılamıyor'), SARI), 'network-server-symbolic');
            bilgiSatiri(this._sunucu, soluk('<small>Evin dışındaysan Tailscale açık olmalı. Elektrik kesintisi olabilir.</small>'));
            return;
        }
        const d = s.disk || {};
        const dk = (ad, y) => `${ad} ${renkli(`${y ?? '?'}%`, renkYuzde(y ?? 0))}`;
        const sorunlar = (s.sorunlar || []).join(' · ');
        bilgiSatiri(this._sunucu, f(_('Durum <b>%s</b>%s%s'), s.durum === 'IYI' ? _('İYİ') : renkli(kac(s.durum), KIRMIZI), sorunlar ? ` — ${kac(sorunlar)}` : '', s.eski ? soluk(_(' (eski veri)')) : ''), 'network-server-symbolic');
        bilgiSatiri(this._sunucu, f(_('CPU <b>%s</b>   Sıcaklık <b>%s</b>   Yük %s'), renkli(`${s.cpu}%`, renkYuzde(s.cpu)), renkli(`${s.temp || '?'}°C`, renkSicak(s.temp)), kac(s.yuk)), 'utilities-system-monitor-symbolic');
        const gpu = s.gpu_vmde ? _('GPU Windows sanal makinesinde') : f(_('GPU %s %s'), renkli(`${s.gpu_temp || '?'}°C`, renkSicak(s.gpu_temp)), s.gpu_w ? `${Math.round(s.gpu_w)} W` : '');
        bilgiSatiri(this._sunucu, `RAM <b>${s.ram_kul} / ${s.ram_top} GB</b>   Swap ${s.swap} GB   ${gpu}`, 'emblem-system-symbolic');
        bilgiSatiri(this._sunucu, f(_('Disk: %s   %s   %s'), dk('SSD', d['/']), dk(_('İndirme'), d['/mnt/side']), dk('Foto/Medya', d['/mnt/sidemain'])), 'drive-harddisk-symbolic');
        const vpn = s.vpn === 'healthy' ? 'aktif' : renkli(kac(s.vpn || '?'), KIRMIZI);
        const sagliksiz = (s.sagliksiz || []).length ? renkli(f(_(' · sağlıksız: %s'), kac(s.sagliksiz.join(', '))), KIRMIZI) : '';
        bilgiSatiri(this._sunucu, f(_('Konteyner <b>%s</b>%s   VPN %s   Ollama %s   Sanal makine: %s'), kac(s.konteyner), sagliksiz, vpn, s.ollama ? _('açık') : _('kapalı'), s.vm_acik ?? '?'), 'view-app-grid-symbolic');
        bilgiSatiri(this._sunucu, soluk(f(_('<small>Son yedek: %s · Açık: %s · kaynak: %s</small>'), kac(s.yedek), kac(s.uptime), kac(s.kaynak || '?'))));
        const uyarilar = s.uyarilar || [];
        if (uyarilar.length) {
            const alt = altMenu(this._sunucu, f(_('Son 30 dakikadaki uyarılar (%s)'), uyarilar.length), 'dialog-warning-symbolic');
            for (const u of uyarilar.slice().reverse()) {
                const saat = new Date(u.ts * 1000).toTimeString().slice(0, 5);
                bilgiSatiri(alt.menu, `${soluk(saat)}  ${renkli(kac(u.seviye), u.seviye === 'UYARI' ? SARI : KIRMIZI)}  ${kac(u.metin)}`);
            }
        }
    }

    destroy() {
        this._aboneler.forEach(f => f());
        this._gucAbone?.();
        super.destroy();
    }
}
