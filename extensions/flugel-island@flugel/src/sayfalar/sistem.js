// FLUGEL Island — "Sistem" sekmesi: bu PC, pil + Pil Tasarrufu, sunucu (flugelserver) ve son uyarılar.
// Sunucu verisi /api/island'dan gelir (PC her seferinde SSH açmaz).
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Sayfa} from './sayfa.js';
import {H, KIRMIZI, SARI, bilgiSatiri, altMenu, calistir, ikon, kac, renkli, renkSicak, renkYuzde, soluk} from '../ortak.js';
import {Karo, Izgara, bolum, ipucuBagla} from '../bilesenler.js';
import {Grafik} from '../grafik.js';
import {_, f} from '../dil.js';

const SIRA = 60;   // grafikte tutulan son ölçüm sayısı (PC 15 sn → 15 dk, sunucu 20 sn → 20 dk)

function kart(baslik, ikonAdi) {
    const k = new St.Button({style_class: 'flugel-sistem-kart', can_focus: true, x_expand: true});
    const kutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
    const ust = new St.BoxLayout({style: 'spacing: 8px;'});
    ust.add_child(new St.Icon({gicon: ikon(ikonAdi), icon_size: 18, y_align: Clutter.ActorAlign.CENTER}));
    ust.add_child(new St.Label({text: baslik, style_class: 'flugel-sistem-kart-baslik', x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
    const nokta = new St.Widget({style_class: 'flugel-nokta flugel-nokta-acik', y_align: Clutter.ActorAlign.CENTER});
    ust.add_child(nokta);
    kutu.add_child(ust);
    const degerler = new St.BoxLayout({style_class: 'flugel-sistem-degerler'});
    kutu.add_child(degerler);
    const sicaklik = new St.BoxLayout({style: 'spacing: 8px;'});
    const derece = new St.Label({style_class: 'flugel-sistem-derece', y_align: Clutter.ActorAlign.CENTER});
    const grafik = new Grafik({genislik: 200, yukseklik: 34});
    sicaklik.add_child(derece);
    sicaklik.add_child(grafik.actor);
    kutu.add_child(sicaklik);
    k.set_child(kutu);
    return {k, nokta, degerler, derece, grafik};
}

function deger(kutu, ad, metin, renk) {
    const d = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-sistem-deger'});
    const l = new St.Label({text: metin, style_class: 'flugel-sistem-deger-sayi'});
    if (renk)
        l.style = `color: ${renk};`;
    d.add_child(l);
    d.add_child(new St.Label({text: ad, style_class: 'flugel-sistem-deger-ad'}));
    kutu.add_child(d);
}

export class SistemSayfa extends Sayfa {
    constructor({veri, guc, ayarlar}) {
        super();
        this._veri = veri;
        this._guc = guc;
        this._gecmis = {pc: [], gpu: [], sunucu: [], sgpu: []};
        const genislik = (ayarlar?.get_int('kart-genislik') ?? 720) - 48;

        // ---------- sade görünüm: iki kart (tıklayınca detay) ----------
        this._ana = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        const kartlar = new St.BoxLayout({style_class: 'flugel-sistem-kartlar', x_expand: true});
        this._pcKart = kart(_('Bu bilgisayar'), 'computer-symbolic');
        this._svKart = kart(_('Sunucu'), 'network-server-symbolic');
        kartlar.add_child(this._pcKart.k);
        kartlar.add_child(this._svKart.k);
        this._pcKart.k.connect('clicked', () => this._detayAc('pc'));
        this._svKart.k.connect('clicked', () => this._detayAc('sunucu'));
        ipucuBagla(this._pcKart.k, _('Tıkla: ayrıntılar ve sıcaklık grafiği'));
        ipucuBagla(this._svKart.k, _('Tıkla: ayrıntılar, diskler, konteynerler'));
        this._ana.add_child(kartlar);

        // ---------- aç: düğmeler ----------
        const ac = new Izgara({genislik, karoGenisligi: 104});
        const git = komut => () => {
            this.close();
            calistir(komut);
        };
        ac.ekle(new Karo({ikon: 'view-app-grid-symbolic', etiket: _('Sunucu paneli'), ipucu: _('Sunucu paneli'), eylem: git('xdg-open http://192.168.0.15:3010')}));
        ac.ekle(new Karo({ikon: 'network-server-symbolic', etiket: _('Durum + AI'), ipucu: _('Sunucu durumu + yapay zekâ analizi'), eylem: git(`${H}/.local/bin/sunucu-durum-ac`)}));
        ac.ekle(new Karo({ikon: 'utilities-system-monitor-symbolic', etiket: 'Netdata', ipucu: _('Netdata (canlı grafikler)'), eylem: git(`${H}/.local/bin/sunucu-ac http 19999 /`)}));
        ac.ekle(new Karo({ikon: 'computer-symbolic', etiket: _('İzleyici'), ipucu: _('Bu PC: Sistem İzleyici'), eylem: git('gnome-system-monitor')}));
        ac.ekle(new Karo({ikon: 'utilities-terminal-symbolic', etiket: 'SSH', ipucu: _('Sunucuya terminalle bağlan'), eylem: git('kitty ssh flugelserver')}));
        this._tasarrufKaro = ac.ekle(new Karo({ikon: 'power-profile-power-saver-symbolic', etiket: _('Pil Tasarrufu'),
            ipucu: _('Pil Tasarrufu (parlaklık %40, animasyonsuz)'), eylem: () => guc.tasarrufAyarla(!guc.tasarruf)}));
        ac.ekle(new Karo({ikon: 'view-refresh-symbolic', etiket: _('Yenile'), ipucu: _('Durumu şimdi sor'), eylem: () => {
            this._veri.yenile('pc', true);
            this._veri.yenile('island', true);
        }}));
        this._ana.add_child(bolum(_('Aç'), ac));
        this._gucAbone = guc.abone(g => this._tasarrufKaro.secili(g.tasarruf));

        // ---------- detay (eski ayrıntılı satırlar + büyük sıcaklık grafiği) ----------
        this._detay = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, visible: false});
        const ust = new St.BoxLayout({style_class: 'flugel-detay-ust'});
        const geri = new St.Button({style_class: 'flugel-dugme flugel-geri', can_focus: true,
            child: new St.Icon({icon_name: 'go-previous-symbolic', icon_size: 16})});
        geri.connect('clicked', () => this._anaDon());
        ust.add_child(geri);
        this._detayBaslik = new St.Label({style_class: 'flugel-detay-baslik', y_align: Clutter.ActorAlign.CENTER});
        ust.add_child(this._detayBaslik);
        this._detay.add_child(ust);
        this._buyukGrafik = new Grafik({genislik: genislik - 24, yukseklik: 110, izgara: true});
        this._grafikEtiket = new St.Label({style_class: 'flugel-buyuk-alt'});
        const g = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-buyuk-grafik'});
        g.add_child(this._grafikEtiket);
        g.add_child(this._buyukGrafik.actor);
        this._detay.add_child(g);
        this._pc = new PopupMenu.PopupMenuSection();
        this._sunucu = new PopupMenu.PopupMenuSection();
        this._detay.add_child(this._pc.actor);
        this._detay.add_child(this._sunucu.actor);

        this.actor.add_child(this._ana);
        this.actor.add_child(this._detay);

        // ---------- en alt: ses ve parlaklık ----------

        // veriler kapalı kartta da toplanır (grafik geçmişi), çizim sadece görünürken
        this._aboneler = [
            veri.abone('pc', p => {
                this._gecmisEkle('pc', parseFloat(p?.temp));
                this._gecmisEkle('gpu', parseFloat(p?.gpu));
                this.gorunurse(() => this._yaz());
            }),
            veri.abone('island', s => {
                this.rozetDegisti?.(s && !s.hata && s.durum !== 'IYI' ? '!' : '');
                this._gecmisEkle('sunucu', parseFloat(s?.temp));
                this._gecmisEkle('sgpu', parseFloat(s?.gpu_temp));
                this.gorunurse(() => this._yaz());
            }),
        ];
    }

    _gecmisEkle(ad, v) {
        if (!Number.isFinite(v))
            return;
        const g = this._gecmis[ad];
        g.push(v);
        if (g.length > SIRA)
            g.shift();
    }

    goster() {
        this._yaz();
        this._veri.tazele('pc', 15);
        this._veri.tazele('island', 20);
    }

    kapandi() {
        super.kapandi();
        this._anaDon(false);
    }

    _yaz() {
        const p = this._veri.son('pc'), s = this._veri.son('island');
        // PC kartı
        const pk = this._pcKart;
        pk.degerler.destroy_all_children();
        if (p && !p.hata) {
            deger(pk.degerler, 'CPU', `${p.cpu}%`, renkYuzde(p.cpu));
            deger(pk.degerler, 'RAM', `${p.ram_kul}/${p.ram_top} GB`);
            deger(pk.degerler, _('Pil'), `%${p.pil}`, parseInt(p.pil) <= 20 && p.pil_durum === 'pilde' ? KIRMIZI : null);
            pk.derece.text = `${p.temp || '?'}°C`;
            pk.derece.style = renkSicak(p.temp) ? `color: ${renkSicak(p.temp)};` : null;
            pk.nokta.style_class = 'flugel-nokta flugel-nokta-acik';
        } else {
            deger(pk.degerler, _('Durum'), _('okunamadı'));
            pk.nokta.style_class = 'flugel-nokta flugel-nokta-kapali';
        }
        pk.grafik.ayarla(this._gecmis.pc);
        // sunucu kartı
        const sk = this._svKart;
        sk.degerler.destroy_all_children();
        if (s && !s.hata) {
            deger(sk.degerler, _('Durum'), s.durum === 'IYI' ? _('İYİ') : s.durum, s.durum === 'IYI' ? null : SARI);
            deger(sk.degerler, 'CPU', `${s.cpu}%`, renkYuzde(s.cpu));
            deger(sk.degerler, 'RAM', `${s.ram_kul}/${s.ram_top} GB`);
            sk.derece.text = `${s.temp || '?'}°C`;
            sk.derece.style = renkSicak(s.temp) ? `color: ${renkSicak(s.temp)};` : null;
            sk.nokta.style_class = `flugel-nokta flugel-nokta-${s.durum === 'IYI' ? 'acik' : 'uyari'}`;
        } else {
            deger(sk.degerler, _('Durum'), _('ulaşılamıyor'), SARI);
            sk.nokta.style_class = 'flugel-nokta flugel-nokta-kapali';
        }
        sk.grafik.ayarla(this._gecmis.sunucu);
        if (this._detay.visible)
            this._detayYaz();
    }

    _detayAc(ne) {
        this._acikDetay = ne;
        this._cizilen?.clear();
        this._detayYaz();
        this._ana.hide();
        this._detay.show();
        if (St.Settings.get().enable_animations) {
            this._detay.opacity = 0;
            this._detay.translation_x = 28;
            this._detay.ease({opacity: 255, translation_x: 0, duration: 220, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        }
    }

    _anaDon(anim = true) {
        if (!this._detay.visible)
            return;
        this._detay.hide();
        this._ana.show();
        if (anim && St.Settings.get().enable_animations) {
            this._ana.opacity = 0;
            this._ana.translation_x = -28;
            this._ana.ease({opacity: 255, translation_x: 0, duration: 220, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        }
    }

    _detayYaz() {
        const pc = this._acikDetay === 'pc';
        this._detayBaslik.text = pc ? _('Bu bilgisayar') : _('Sunucu (flugelserver)');
        this._pc.actor.visible = pc;
        this._sunucu.actor.visible = !pc;
        const seri = pc ? this._gecmis.pc : this._gecmis.sunucu;
        const gpu = pc ? this._gecmis.gpu : this._gecmis.sgpu;
        this._buyukGrafik.ayarla(seri);
        const ozet = v => (v.length ? `${Math.min(...v)}–${Math.max(...v)}°C` : '—');
        this._grafikEtiket.text = f(_('CPU sıcaklığı son %s dk: %s   ·   GPU: %s'), pc ? 15 : 20, ozet(seri), ozet(gpu));
        if (pc)
            this._pcYaz(this._veri.son('pc'));
        else
            this._sunucuYaz(this._veri.son('island'));
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
        this._aboneler.forEach(fn => fn());
        this._gucAbone?.();
        super.destroy();
    }
}
