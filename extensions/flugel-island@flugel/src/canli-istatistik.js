// FLUGEL Island — canlı sistem istatistikleri (Atoll'un "Stats" görünümünün GNOME karşılığı).
// Üstte üç kart: İşlemci, Bellek, Ekran kartı (büyük yüzde + dolu alan grafiği); altta iki kart: Ağ (indirme / yükleme)
// ve Disk (okuma / yazma) — iki yönlü ayna grafik. Sağ üstte Durdur / Temizle ve "Canlı" noktası.
// Ölçüm saniyede bir, sadece görünürken: /proc/stat, /proc/meminfo, /proc/net/dev, /proc/diskstats (eşzamansız okuma);
// ekran kartı nvidia-smi (2 sn'de bir) ya da /sys/class/drm/*/device/gpu_busy_percent.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {komutCiktisi} from './ortak.js';
import {ipucuBagla} from './bilesenler.js';
import {_, f} from './dil.js';

const NOKTA = 40;   // grafikte tutulan son ölçüm (sn)
const RENK = {
    cpu: [0.25, 0.52, 0.98], bellek: [0.36, 0.84, 0.36], gpu: [0.72, 0.38, 0.96],
    indir: [0.97, 0.66, 0.20], yukle: [0.94, 0.33, 0.29], oku: [0.43, 0.78, 0.96], yaz: [0.97, 0.85, 0.30],
};
const css = ([r, g, b]) => `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
// Pango işaretlemesi rgb() tanımaz: #rrggbb
const hex = renk => `#${renk.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;

function oku(yol) {
    return new Promise(coz => {
        Gio.File.new_for_path(yol).load_contents_async(null, (d, r) => {
            try {
                coz(new TextDecoder().decode(d.load_contents_finish(r)[1]));
            } catch (e) {
                coz('');
            }
        });
    });
}

const hiz = bps => (bps >= 1e9 ? f('%s GB/s', (bps / 1e9).toFixed(1)) : bps >= 1e6 ? f('%s MB/s', (bps / 1e6).toFixed(1))
    : f('%s KB/s', (bps / 1e3).toFixed(0)));

// tek seri: dolu alan + çizgi; ayna: üstte bir seri, altta diğeri (orta çizgiden)
class AlanGrafik {
    constructor({yukseklik = 64, ayna = false, renkler}) {
        this._ayna = ayna;
        this._renkler = renkler;
        this.seriler = renkler.map(() => []);
        this.actor = new St.DrawingArea({style_class: 'flugel-istat-grafik', x_expand: true, height: yukseklik});
        this.actor.connect('repaint', a => this._ciz(a));
    }

    ekle(...degerler) {
        degerler.forEach((v, i) => {
            const s = this.seriler[i];
            // ilk ölçümde grafik düz bir çizgiyle dolu başlar (sağ kenarda tek nokta görünmesin)
            if (!s.length)
                s.push(...Array(NOKTA - 1).fill(v));
            s.push(v);
            if (s.length > NOKTA)
                s.shift();
        });
        this.actor.queue_repaint();
    }

    temizle() {
        this.seriler = this._renkler.map(() => []);
        this.actor.queue_repaint();
    }

    _yol(cr, s, w, taban, olcek, yon) {
        const adim = w / (NOKTA - 1);
        const x0 = w - (s.length - 1) * adim;
        cr.moveTo(x0, taban - yon * s[0] * olcek);
        s.forEach((v, i) => cr.lineTo(x0 + i * adim, taban - yon * v * olcek));
        return x0;
    }

    _ciz(alan) {
        const cr = alan.get_context();
        const [w, h] = alan.get_surface_size();
        const yari = this._ayna ? h / 2 : h;
        // ayna grafikte ölçek iki serinin ortak tepesine göre (en az 1 KB/s); tek seride 0–100
        const tepe = this._ayna ? Math.max(1e3, ...this.seriler.flat()) * 1.1 : 100;
        this.seriler.forEach((s, i) => {
            if (s.length < 2)
                return;
            const [r, g, b] = this._renkler[i];
            const yon = this._ayna && i === 1 ? -1 : 1;
            const taban = this._ayna ? yari : h;
            const olcek = (yari - 2) / tepe;
            const x0 = this._yol(cr, s, w, taban, olcek, yon);
            cr.lineTo(w, taban);
            cr.lineTo(x0, taban);
            cr.closePath();
            cr.setSourceRGBA(r, g, b, 0.22);
            cr.fill();
            this._yol(cr, s, w, taban, olcek, yon);
            cr.setSourceRGBA(r, g, b, 1);
            cr.setLineWidth(2);
            cr.setLineJoin(1);
            cr.stroke();
        });
        if (this._ayna) {
            cr.setSourceRGBA(1, 1, 1, 0.08);
            cr.setLineWidth(1);
            cr.moveTo(0, yari);
            cr.lineTo(w, yari);
            cr.stroke();
        }
        cr.$dispose();
    }
}

function kart(ikon, ad, renk) {
    const k = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-istat-kart', x_expand: true});
    const ust = new St.BoxLayout({style: 'spacing: 6px;'});
    ust.add_child(new St.Icon({icon_name: ikon, icon_size: 14, style: `color: ${css(renk)};`, y_align: Clutter.ActorAlign.CENTER}));
    ust.add_child(new St.Label({text: ad, style_class: 'flugel-istat-ad', y_align: Clutter.ActorAlign.CENTER}));
    k.add_child(ust);
    const deger = new St.Label({text: '—', style_class: 'flugel-istat-deger', x_align: Clutter.ActorAlign.CENTER});
    k.add_child(deger);
    return {k, deger};
}

export class CanliIstatistik {
    constructor() {
        this._durdu = false;
        this._onceki = null;
        this.actor = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-istat', x_expand: true});
        // üst şerit: Durdur / Temizle · Canlı
        const serit = new St.BoxLayout({x_expand: true, style: 'spacing: 6px;'});
        serit.add_child(new St.Widget({x_expand: true}));
        this._durDugme = new St.Button({label: _('Durdur'), style_class: 'flugel-cip flugel-cip-kucuk', can_focus: true});
        this._durDugme.connect('clicked', () => this._durdurDevam());
        serit.add_child(this._durDugme);
        const temizle = new St.Button({label: _('Temizle'), style_class: 'flugel-cip flugel-cip-kucuk', can_focus: true});
        temizle.connect('clicked', () => this._grafikler().forEach(g => g.temizle()));
        serit.add_child(temizle);
        this._canli = new St.BoxLayout({style: 'spacing: 5px;', y_align: Clutter.ActorAlign.CENTER});
        this._canliNokta = new St.Widget({style_class: 'flugel-nokta flugel-nokta-acik', y_align: Clutter.ActorAlign.CENTER});
        this._canli.add_child(this._canliNokta);
        this._canliYazi = new St.Label({text: _('Canlı'), style_class: 'flugel-istat-canli', y_align: Clutter.ActorAlign.CENTER});
        this._canli.add_child(this._canliYazi);
        serit.add_child(this._canli);
        this.actor.add_child(serit);

        const satir1 = new St.BoxLayout({style_class: 'flugel-istat-satir', x_expand: true});
        this._cpu = kart('computer-symbolic', _('İşlemci'), RENK.cpu);
        this._bellek = kart('drive-multidisk-symbolic', _('Bellek'), RENK.bellek);
        this._gpu = kart('video-display-symbolic', _('Ekran kartı'), RENK.gpu);
        for (const [k, renk] of [[this._cpu, RENK.cpu], [this._bellek, RENK.bellek], [this._gpu, RENK.gpu]]) {
            k.grafik = new AlanGrafik({renkler: [renk]});
            k.k.add_child(k.grafik.actor);
            satir1.add_child(k.k);
        }
        this.actor.add_child(satir1);
        const satir2 = new St.BoxLayout({style_class: 'flugel-istat-satir', x_expand: true});
        this._ag = kart('network-wireless-symbolic', _('Ağ'), RENK.indir);
        this._disk = kart('drive-harddisk-symbolic', _('Disk'), RENK.oku);
        for (const [k, renkler] of [[this._ag, [RENK.indir, RENK.yukle]], [this._disk, [RENK.oku, RENK.yaz]]]) {
            k.deger.clutter_text.use_markup = true;
            k.deger.add_style_class_name('flugel-istat-deger-kucuk');
            k.grafik = new AlanGrafik({renkler, ayna: true});
            k.k.add_child(k.grafik.actor);
            satir2.add_child(k.k);
        }
        ipucuBagla(this._ag.k, _('Turuncu: indirme (üst) · kırmızı: yükleme (alt)'));
        ipucuBagla(this._disk.k, _('Mavi: okuma (üst) · sarı: yazma (alt)'));
        this.actor.add_child(satir2);

        this.actor.connect('notify::mapped', () => this._zamanla());
        this.actor.connect('destroy', () => this._durdur());
    }

    _grafikler() {
        return [this._cpu, this._bellek, this._gpu, this._ag, this._disk].map(k => k.grafik);
    }

    _durdurDevam() {
        this._durdu = !this._durdu;
        this._durDugme.label = this._durdu ? _('Başlat') : _('Durdur');
        this._canliNokta.style_class = `flugel-nokta flugel-nokta-${this._durdu ? 'kapali' : 'acik'}`;
        this._canliYazi.text = this._durdu ? _('Durdu') : _('Canlı');
        this._onceki = null;
        this._zamanla();
    }

    _zamanla() {
        this._durdur();
        if (!this.actor.mapped || this._durdu)
            return;
        this._olc();
        this._id = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 1000, () => {
            this._olc();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _durdur() {
        if (this._id)
            GLib.source_remove(this._id);
        this._id = 0;
    }

    async _olc() {
        if (this._olcuyor)
            return;
        this._olcuyor = true;
        try {
            const [stat, mem, net, disk] = await Promise.all(['/proc/stat', '/proc/meminfo', '/proc/net/dev', '/proc/diskstats'].map(oku));
            if (!this.actor.get_stage())
                return;
            const simdi = GLib.get_monotonic_time() / 1e6;
            // işlemci
            const c = (stat.split('\n')[0] ?? '').trim().split(/\s+/).slice(1).map(Number);
            const bos = (c[3] ?? 0) + (c[4] ?? 0), toplam = c.reduce((a, b) => a + b, 0);
            // bellek
            const mm = k => Number((new RegExp(`^${k}:\\s+(\\d+)`, 'm').exec(mem) ?? [])[1] ?? 0);
            const bellek = mm('MemTotal') ? 100 * (1 - mm('MemAvailable') / mm('MemTotal')) : 0;
            // ağ (lo ve sanal arayüzler hariç)
            let rx = 0, tx = 0;
            for (const s of net.split('\n').slice(2)) {
                const [ad, veri] = s.split(':');
                if (!veri || /^(lo|docker|veth|br-|virbr|vnet)/.test(ad.trim()))
                    continue;
                const p = veri.trim().split(/\s+/).map(Number);
                rx += p[0];
                tx += p[8];
            }
            // disk (bütün diskler; bölümler hariç)
            let okunan = 0, yazilan = 0;
            for (const s of disk.split('\n')) {
                const p = s.trim().split(/\s+/);
                if (!/^(nvme\d+n\d+|sd[a-z]+|vd[a-z]+|mmcblk\d+)$/.test(p[2] ?? ''))
                    continue;
                okunan += Number(p[5]) * 512;
                yazilan += Number(p[9]) * 512;
            }
            const o = this._onceki;
            this._onceki = {simdi, bos, toplam, rx, tx, okunan, yazilan};
            this._bellek.deger.text = `${bellek.toFixed(1)}%`;
            this._bellek.grafik.ekle(bellek);
            if (o) {
                const dt = Math.max(0.2, simdi - o.simdi);
                const cpu = toplam > o.toplam ? 100 * (1 - (bos - o.bos) / (toplam - o.toplam)) : 0;
                this._cpu.deger.text = `${cpu.toFixed(1)}%`;
                this._cpu.grafik.ekle(cpu);
                const [ind, yuk] = [(rx - o.rx) / dt, (tx - o.tx) / dt].map(v => Math.max(0, v));
                this._ag.deger.clutter_text.set_markup(`<span foreground="${hex(RENK.indir)}">↓ ${hiz(ind)}</span>  ` +
                    `<span foreground="${hex(RENK.yukle)}">↑ ${hiz(yuk)}</span>`);
                this._ag.grafik.ekle(ind, yuk);
                const [ok, yz] = [(okunan - o.okunan) / dt, (yazilan - o.yazilan) / dt].map(v => Math.max(0, v));
                this._disk.deger.clutter_text.set_markup(`<span foreground="${hex(RENK.oku)}">R ${hiz(ok)}</span>  ` +
                    `<span foreground="${hex(RENK.yaz)}">W ${hiz(yz)}</span>`);
                this._disk.grafik.ekle(ok, yz);
            }
            // ekran kartı: 2 sn'de bir
            if (!this._gpuSon || simdi - this._gpuSon >= 2) {
                this._gpuSon = simdi;
                const g = await this._gpuOku();
                if (!this.actor.get_stage())
                    return;
                this._gpu.deger.text = g === null ? '—' : g === 'uyku' ? _('Uykuda') : `${g.toFixed(1)}%`;
                if (g !== null)
                    this._gpu.grafik.ekle(g === 'uyku' ? 0 : g);
            }
        } finally {
            this._olcuyor = false;
        }
    }

    // NVIDIA: kart uykudaysa (hibrit dizüstünde güç tasarrufu) nvidia-smi çağrılmaz — çağrı kartı uyandırırdı.
    // Kart bir kez bulunur: NVIDIA varsa o, yoksa gpu_busy_percent veren ilk kart.
    async _gpuOku() {
        if (this._gpuKart === undefined) {
            const kartlar = ['card0', 'card1', 'card2'];
            const saticilar = await Promise.all(kartlar.map(k => oku(`/sys/class/drm/${k}/device/vendor`)));
            const yuzdeler = await Promise.all(kartlar.map(k => oku(`/sys/class/drm/${k}/device/gpu_busy_percent`)));
            const n = saticilar.findIndex(v => v.trim() === '0x10de');
            const y = yuzdeler.findIndex(v => Number.isFinite(parseFloat(v)));
            this._gpuKart = n >= 0 ? {yol: `/sys/class/drm/${kartlar[n]}/device`, nvidia: true}
                : y >= 0 ? {yol: `/sys/class/drm/${kartlar[y]}/device`, nvidia: false} : null;
        }
        const k = this._gpuKart;
        if (!k)
            return null;
        if (!k.nvidia) {
            const v = parseFloat(await oku(`${k.yol}/gpu_busy_percent`));
            return Number.isFinite(v) ? v : null;
        }
        if ((await oku(`${k.yol}/power/runtime_status`)).trim() === 'suspended')
            return 'uyku';
        const v = parseFloat(await komutCiktisi(['nvidia-smi', '--query-gpu=utilization.gpu', '--format=csv,noheader,nounits']) ?? '');
        return Number.isFinite(v) ? v : null;
    }

    destroy() {
        this._durdur();
        this.actor.destroy();
    }
}
