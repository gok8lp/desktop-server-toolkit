// FLUGEL Island — Hızlı sekmesindeki ek araçlar (altta yayla açılan paneller):
//   Hesap      : yazarken sonuç veren hesap makinesi (+ - × ÷ ^ %, parantez, kök, sin/cos/tan derece, log, ln, pi, e);
//                Enter sonucu panoya kopyalar, son 6 işlem hatırlanır (bellekte).
//   Kronometre : ileri sayar, tur alır; çalışırken kapsülde görünür (araclar.js → kronometre).
//   QR         : panodaki (ya da yazılan) metni QR koduna çevirir — bağlantıyı telefona kamerayla aktarmak için.
//                Çizim ~/.local/bin/flugel-qr (qrcode kütüphanesi) ile, SVG olarak.
//   Not        : hızlı not defteri; yazdıkça kaydedilir (ayar: hizli-not).
//   panoDonustur : panodaki metni BÜYÜK/küçük/Başlık harfe, tek satıra çevirir, bağlantıdaki izleme eklerini siler.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {komutCiktisi} from './ortak.js';
import {ipucuBagla} from './bilesenler.js';
import {kronometre, kronoMetni} from './araclar.js';
import {_, f} from './dil.js';

const QR_KOMUT = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'flugel-qr']);

function kopyala(metin, bildirim = _('Kopyalandı')) {
    St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, metin);
    Main.osdWindowManager.showAll(Gio.ThemedIcon.new('edit-copy-symbolic'), bildirim, null, null);
}

function panoMetni() {
    return new Promise(coz => St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (_c, m) => coz(m ?? '')));
}

// Yazı kutusu kartın içinde klavye alabilsin diye adanın kökü kipli tutulur; panel kapanınca bırakılır.
class YaziKipi {
    constructor(actor) {
        this._actor = actor;
    }

    ac(giris) {
        if (!this._grab) {
            let kok = this._actor;
            while (kok && kok.name !== 'flugelIsland')
                kok = kok.get_parent();
            if (kok)
                this._grab = Main.pushModal(kok, {actionMode: Shell.ActionMode.POPUP});
        }
        giris?.grab_key_focus();
    }

    kapat() {
        if (!this._grab)
            return;
        // odaktaki yazı kutusundan önce odak alınır (giriş yöntemi uyarı vermesin)
        global.stage.set_key_focus(null);
        Main.popModal(this._grab);
        this._grab = null;
    }
}

function giris(ipucu, kip, {cokSatir = false} = {}) {
    const g = new St.Entry({style_class: `flugel-arama${cokSatir ? ' flugel-not-giris' : ''}`, hint_text: ipucu, can_focus: true, x_expand: true});
    if (cokSatir) {
        g.clutter_text.single_line_mode = false;
        g.clutter_text.line_wrap = true;
        g.clutter_text.activatable = false;
    }
    g.clutter_text.connect('button-press-event', () => {
        kip.ac(g);
        return Clutter.EVENT_PROPAGATE;
    });
    return g;
}

function panelKutu() {
    return new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel flugel-detay-panel', x_expand: true});
}

function baslik(metin, ...sag) {
    const ust = new St.BoxLayout({style_class: 'flugel-detay-baslik'});
    ust.add_child(new St.Label({text: metin, style_class: 'flugel-bolum-baslik', x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
    sag.forEach(a => ust.add_child(a));
    return ust;
}

function cip(etiket, fn, {vurgu = false, ipucu = null} = {}) {
    const b = new St.Button({label: etiket, style_class: `flugel-cip flugel-cip-kucuk${vurgu ? ' flugel-anahtar-acik' : ''}`, can_focus: true});
    b.connect('clicked', fn);
    if (ipucu)
        ipucuBagla(b, ipucu);
    return b;
}

// ---------- hesap makinesi ----------
const DERECE = Math.PI / 180;
const FONKSIYON = {
    sqrt: Math.sqrt, kok: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10,
    sin: x => Math.sin(x * DERECE), cos: x => Math.cos(x * DERECE), tan: x => Math.tan(x * DERECE),
    round: Math.round, floor: Math.floor, ceil: Math.ceil,
};
const SABIT = {pi: Math.PI, e: Math.E};

// Güvenli hesap: eval yok; küçük bir özyinelemeli ayrıştırıcı. Ondalık ayırıcı nokta ya da virgül olabilir.
export function hesapla(ifade) {
    const metin = ifade.toLowerCase().replace(/×|x(?![a-z])/g, '*').replace(/÷/g, '/').replace(/√/g, 'sqrt').replace(/π/g, 'pi')
        .replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, '');
    let i = 0;
    const bak = () => metin[i];
    const sayi = () => {
        const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(metin.slice(i));
        if (!m)
            throw new Error('sayı');
        i += m[0].length;
        return parseFloat(m[0]);
    };
    const ad = () => {
        const m = /^[a-z]+/.exec(metin.slice(i));
        if (!m)
            throw new Error('ad');
        i += m[0].length;
        return m[0];
    };
    let ifadeAl;
    const birincil = () => {
        const c = bak();
        if (c === '(') {
            i++;
            const v = ifadeAl();
            if (bak() !== ')')
                throw new Error(')');
            i++;
            return v;
        }
        if (c === '-') {
            i++;
            return -us();
        }
        if (c === '+') {
            i++;
            return us();
        }
        if (/[a-z]/.test(c ?? '')) {
            const n = ad();
            if (n in SABIT)
                return SABIT[n];
            if (n in FONKSIYON)
                return FONKSIYON[n](birincil());
            throw new Error(n);
        }
        return sayi();
    };
    // yüzde: "200*15%" → 200*0,15 ; "200+15%" → 200'ün %15 fazlası (hesap makinelerindeki gibi)
    const sonek = () => {
        let v = birincil();
        while (bak() === '%' || bak() === '!') {
            if (bak() === '%') {
                v /= 100;
            } else {
                if (v < 0 || v > 170 || !Number.isInteger(v))
                    throw new Error('!');
                let r = 1;
                for (let k = 2; k <= v; k++)
                    r *= k;
                v = r;
            }
            i++;
        }
        return v;
    };
    const us = () => {
        const taban = sonek();
        if (bak() === '^') {
            i++;
            return taban ** us();
        }
        return taban;
    };
    const carpim = () => {
        let v = us();
        for (;;) {
            const c = bak();
            if (c === '*' || c === '/') {
                i++;
                const y = us();
                v = c === '*' ? v * y : v / y;
            } else if (c === '(' || /[a-z]/.test(c ?? '')) {
                v *= us();   // 2pi, 3(4+1)
            } else {
                return v;
            }
        }
    };
    ifadeAl = () => {
        let v = carpim();
        for (;;) {
            const c = bak();
            if (c !== '+' && c !== '-')
                return v;
            i++;
            const bas = i;
            const y = carpim();
            // a + b% → a'nın b yüzdesi
            const yuzde = metin[i - 1] === '%' && !metin.slice(bas, i).includes('*') && !metin.slice(bas, i).includes('/');
            const fark = yuzde ? v * y : y;
            v = c === '+' ? v + fark : v - fark;
        }
    };
    const v = ifadeAl();
    if (i < metin.length)
        throw new Error('fazla');
    if (!Number.isFinite(v))
        throw new Error('sonsuz');
    return v;
}

export function sayiMetni(v) {
    if (Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-9 && v !== 0))
        return v.toExponential(6).replace(/\.?0+e/, 'e');
    return String(Number(v.toPrecision(12)));
}

const hesapGecmisi = [];

export class HesapPaneli {
    constructor() {
        this.actor = panelKutu();
        this._kip = new YaziKipi(this.actor);
        this.actor.add_child(baslik(_('Hesap makinesi'), cip(_('Hesap makinesini aç'), () => {
            this._kip.kapat();
            Shell.AppSystem.get_default().lookup_app('org.gnome.Calculator.desktop')?.activate();
        })));
        this._giris = giris(_('Örn. 1250*18% · (3+4)^2 · sqrt(2) · sin 30'), this._kip);
        this._giris.clutter_text.connect('text-changed', () => this._sonucYaz());
        this._giris.clutter_text.connect('activate', () => this._kaydet());
        this.actor.add_child(this._giris);
        this._sonuc = new St.Label({text: ' ', style_class: 'flugel-hesap-sonuc', x_align: Clutter.ActorAlign.END});
        const sonucDugme = new St.Button({child: this._sonuc, style_class: 'flugel-hesap-sonuc-dugme', x_expand: true, can_focus: true});
        sonucDugme.connect('clicked', () => this._kaydet());
        ipucuBagla(sonucDugme, _('Tıkla ya da Enter: sonucu kopyala'));
        this.actor.add_child(sonucDugme);
        this._gecmis = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        this.actor.add_child(this._gecmis);
        this._gecmisYaz();
        // panel açılınca yazmaya hazır
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (this.actor.get_stage())
                this._kip.ac(this._giris);
            return GLib.SOURCE_REMOVE;
        });
    }

    _hesap() {
        const m = this._giris.text.trim();
        if (!m)
            return null;
        try {
            return sayiMetni(hesapla(m));
        } catch (e) {
            return undefined;
        }
    }

    _sonucYaz() {
        const s = this._hesap();
        this._sonuc.text = s === null ? ' ' : s === undefined ? '…' : `= ${s}`;
    }

    _kaydet() {
        const s = this._hesap();
        if (s === null || s === undefined)
            return;
        kopyala(s, f(_('%s kopyalandı'), s));
        const m = this._giris.text.trim();
        if (hesapGecmisi[0]?.[0] !== m)
            hesapGecmisi.unshift([m, s]);
        hesapGecmisi.splice(6);
        this._gecmisYaz();
    }

    _gecmisYaz() {
        this._gecmis.destroy_all_children();
        for (const [m, s] of hesapGecmisi) {
            const b = new St.Button({style_class: 'flugel-detay-satir', can_focus: true, x_expand: true});
            const k = new St.BoxLayout({x_expand: true});
            k.add_child(new St.Label({text: m, style_class: 'flugel-detay-alt', x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
            k.add_child(new St.Label({text: `= ${s}`, style_class: 'flugel-detay-ad', y_align: Clutter.ActorAlign.CENTER}));
            b.set_child(k);
            b.connect('clicked', () => {
                this._giris.text = m;
                this._kip.ac(this._giris);
            });
            ipucuBagla(b, _('Tıkla: yeniden düzenle'));
            this._gecmis.add_child(b);
        }
    }

    destroy() {
        this._kip.kapat();
        this.actor.destroy();
    }
}

// ---------- kronometre ----------
export class KronometrePaneli {
    constructor() {
        this.actor = panelKutu();
        this._abonelik = kronometre.abone(() => this._yaz());
        this._buyuk = new St.Label({style_class: 'flugel-sayac-buyuk', x_align: Clutter.ActorAlign.CENTER});
        this.actor.add_child(this._buyuk);
        this._denetim = new St.BoxLayout({style_class: 'flugel-cipler', x_align: Clutter.ActorAlign.CENTER});
        this.actor.add_child(this._denetim);
        this._turlar = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        this.actor.add_child(this._turlar);
        this._yaz();
    }

    _sayacYaz() {
        this._buyuk.text = kronoMetni(kronometre.gecen);
        return GLib.SOURCE_CONTINUE;
    }

    _yaz() {
        if (this._tikId)
            GLib.source_remove(this._tikId);
        this._tikId = 0;
        this._sayacYaz();
        if (kronometre.calisiyor)
            this._tikId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => this._sayacYaz());
        this._denetim.destroy_all_children();
        const c = kronometre.calisiyor;
        this._denetim.add_child(cip(c ? _('Durdur') : kronometre.bos ? _('Başlat') : _('Devam'), () => kronometre.baslatDurdur(), {vurgu: !c}));
        if (c)
            this._denetim.add_child(cip(_('Tur'), () => kronometre.tur()));
        if (!kronometre.bos)
            this._denetim.add_child(cip(_('Sıfırla'), () => kronometre.sifirla()));
        if (kronometre.turlar.length)
            this._denetim.add_child(cip(_('Kopyala'), () => kopyala(this._turMetni())));
        this._turlar.destroy_all_children();
        const t = kronometre.turlar;
        const sureler = t.map((x, i) => x - (t[i - 1] ?? 0));
        const enIyi = Math.min(...sureler), enKotu = Math.max(...sureler);
        for (let i = t.length - 1; i >= Math.max(0, t.length - 8); i--) {
            const satir = new St.BoxLayout({style_class: 'flugel-detay-satir', x_expand: true});
            satir.add_child(new St.Label({text: f(_('Tur %s'), i + 1), style_class: 'flugel-detay-alt', x_expand: true}));
            const stil = t.length > 2 && sureler[i] === enIyi ? 'flugel-tur-iyi' : t.length > 2 && sureler[i] === enKotu ? 'flugel-tur-kotu' : '';
            satir.add_child(new St.Label({text: kronoMetni(sureler[i]), style_class: `flugel-detay-ad ${stil}`}));
            satir.add_child(new St.Label({text: kronoMetni(t[i]), style_class: 'flugel-detay-alt flugel-tur-toplam'}));
            this._turlar.add_child(satir);
        }
    }

    _turMetni() {
        const t = kronometre.turlar;
        return t.map((x, i) => `${i + 1}\t${kronoMetni(x - (t[i - 1] ?? 0))}\t${kronoMetni(x)}`).join('\n');
    }

    destroy() {
        this._abonelik();
        if (this._tikId)
            GLib.source_remove(this._tikId);
        this.actor.destroy();
    }
}

// ---------- QR ----------
export class QrPaneli {
    constructor() {
        this.actor = panelKutu();
        this._kip = new YaziKipi(this.actor);
        this._iptal = new Gio.Cancellable();
        this.actor.add_child(baslik(_('QR kod (telefonun kamerasıyla okut)'),
            cip(_('Panodakini kullan'), () => this._panodan())));
        this._giris = giris(_('Bağlantı ya da metin'), this._kip);
        this._giris.clutter_text.connect('text-changed', () => this._planla());
        this.actor.add_child(this._giris);
        this._resim = new St.Icon({icon_size: 200, x_align: Clutter.ActorAlign.CENTER, style_class: 'flugel-qr-resim', visible: false});
        this.actor.add_child(this._resim);
        this._durum = new St.Label({text: '', style_class: 'flugel-soluk', x_align: Clutter.ActorAlign.CENTER});
        this.actor.add_child(this._durum);
        // yazı kutusu önce odağa alınır, sonra panodaki metin konur (odaksız kutuya metin yazmak giriş yöntemini şaşırtıyor)
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (this.actor.get_stage()) {
                this._kip.ac(this._giris);
                this._panodan();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    async _panodan() {
        const m = (await panoMetni()).trim();
        if (this._iptal.is_cancelled())
            return;
        if (m && m.length <= 1200)
            this._giris.text = m;
        else if (!this._giris.text)
            this._durum.text = _('Panoda metin yok: yukarıya yaz');
    }

    _planla() {
        if (this._planId)
            GLib.source_remove(this._planId);
        this._planId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 350, () => {
            this._planId = 0;
            this._ciz().catch(e => console.warn(`FLUGEL Island: QR: ${e.message}`));
            return GLib.SOURCE_REMOVE;
        });
    }

    async _ciz() {
        const m = this._giris.text.trim();
        if (!m) {
            this._resim.hide();
            return;
        }
        if (m.length > 1200) {
            this._durum.text = _('Metin QR için çok uzun');
            return;
        }
        const klasor = GLib.build_filenamev([GLib.get_user_cache_dir(), 'flugel-island', 'qr']);
        GLib.mkdir_with_parents(klasor, 0o700);
        const yol = GLib.build_filenamev([klasor, `${GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, m, -1)}.svg`]);
        if (!GLib.file_test(yol, GLib.FileTest.EXISTS)) {
            const cikti = await komutCiktisi([QR_KOMUT, m, yol], this._iptal);
            if (this._iptal.is_cancelled())
                return;
            if (cikti === null || !GLib.file_test(yol, GLib.FileTest.EXISTS)) {
                this._durum.text = _('QR üretilemedi (flugel-qr kurulu mu?)');
                this._resim.hide();
                return;
            }
        }
        this._resim.gicon = Gio.FileIcon.new(Gio.File.new_for_path(yol));
        this._resim.show();
        this._durum.text = m.length > 60 ? `${m.slice(0, 57)}…` : m;
    }

    destroy() {
        this._iptal.cancel();
        if (this._planId)
            GLib.source_remove(this._planId);
        this._planId = 0;
        this._kip.kapat();
        this.actor.destroy();
    }
}

// ---------- hızlı not ----------
export class NotPaneli {
    constructor({ayarlar}) {
        this._ayar = ayarlar;
        this.actor = panelKutu();
        this._kip = new YaziKipi(this.actor);
        this.actor.add_child(baslik(_('Hızlı not (yazdıkça kaydedilir)'),
            cip(_('Kopyala'), () => kopyala(this._giris.text)),
            cip(_('Temizle'), () => {
                this._giris.text = '';
            })));
        this._giris = giris(_('Aklındakini yaz…'), this._kip, {cokSatir: true});
        this._giris.text = ayarlar.get_string('hizli-not');
        this._giris.clutter_text.connect('text-changed', () => this._kaydetPlanla());
        this.actor.add_child(this._giris);
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (this.actor.get_stage())
                this._kip.ac(this._giris);
            return GLib.SOURCE_REMOVE;
        });
    }

    _kaydetPlanla() {
        if (this._kayitId)
            GLib.source_remove(this._kayitId);
        this._kayitId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this._kayitId = 0;
            this._kaydet();
            return GLib.SOURCE_REMOVE;
        });
    }

    _kaydet() {
        const m = this._giris.text.slice(0, 8000);
        if (m !== this._ayar.get_string('hizli-not'))
            this._ayar.set_string('hizli-not', m);
    }

    destroy() {
        if (this._kayitId) {
            GLib.source_remove(this._kayitId);
            this._kayitId = 0;
            this._kaydet();
        }
        this._kip.kapat();
        this.actor.destroy();
    }
}

// ---------- pano dönüştürme ----------
const IZLEME = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_[a-z]+|igshid|si|ref_src|ref_url|yclid|_hsenc|_hsmi|spm|feature)$/i;

export function izlemeTemizle(metin) {
    return metin.replace(/https?:\/\/[^\s<>"']+/g, url => {
        try {
            const u = GLib.Uri.parse(url, GLib.UriFlags.NONE);
            const sorgu = u.get_query();
            if (!sorgu)
                return url;
            const kalan = sorgu.split('&').filter(p => !IZLEME.test(p.split('=')[0]));
            const yeni = GLib.Uri.build(GLib.UriFlags.NONE, u.get_scheme(), u.get_userinfo(), u.get_host(), u.get_port(), u.get_path(),
                kalan.length ? kalan.join('&') : null, u.get_fragment());
            return yeni.to_string();
        } catch (e) {
            return url;
        }
    });
}

// harf dönüşümleri bağlantılara dokunmaz (adres büyük harfe çevrilince bozulur)
const yaziya = fn => m => m.split(/(https?:\/\/[^\s<>"']+)/).map((p, i) => (i % 2 ? p : fn(p))).join('');

export const DONUSUMLER = () => [
    ['buyuk', _('BÜYÜK'), yaziya(m => m.toLocaleUpperCase('tr'))],
    ['kucuk', _('küçük'), yaziya(m => m.toLocaleLowerCase('tr'))],
    ['baslik', _('Başlık'), yaziya(m => m.toLocaleLowerCase('tr').replace(/(^|[\s(“"'-])(\p{L})/gu, (_t, a, b) => a + b.toLocaleUpperCase('tr')))],
    ['tek', _('Tek satır'), m => m.replace(/\s+/g, ' ').trim()],
    ['izleme', _('Bağlantıyı temizle'), izlemeTemizle],
];

export async function panoDonustur(id) {
    const d = DONUSUMLER().find(x => x[0] === id);
    const m = await panoMetni();
    if (!d || !m)
        return false;
    const yeni = d[2](m);
    kopyala(yeni, f(_('Pano: %s'), d[1]));
    return yeni;
}
