// FLUGEL Island — "Maçlar" sekmesi.
// Üstte kategori seçimi: Öne çıkanlar · Futbol · Basketbol · Milli · Derbiler · Takımlarım · Özel · CS2
// (Ayarlar'dan açılıp kapatılır). Her maçta HLTV'deki gibi 0-5 yıldız: CS2'de HLTV'nin kendisi, futbol ve
// basketbolda lig + büyük takım + derbi ölçüsü. Favori takımların maçları her zaman en üstte, sonra özel
// maçlar, canlılar, yıldızlar. Maça tıklayınca altında işlem çubuğu açılır: takımı favorilere ekle,
// özel maçlara sabitle, CS2'de kapsülde takip et, maç sayfasını aç. "Benim maçlarım" (hakemlik) en üstte.
// Veri: ust-panel-veri maclar (sunucu ya da bu PC'de ESPN) ve cs2-veri (HLTV, bu PC'de).
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import {Sayfa} from './sayfa.js';
import {calistir, kisaTarih, ikon} from '../ortak.js';
import {bolum, dugme, ipucuBagla} from '../bilesenler.js';
import {canliMi, favoriMi, favoriVar, macAnahtar, onemSirala, takimlar, yildizMetni} from '../mac-ortak.js';
import {_, f} from '../dil.js';

const saat = ts => GLib.DateTime.new_from_unix_local(ts).format('%H:%M');
const gunSaat = ts => {
    const t = GLib.DateTime.new_from_unix_local(ts);
    const bugun = GLib.DateTime.new_now_local().format('%F');
    return t.format('%F') === bugun ? t.format('%H:%M') : t.format('%d.%m %H:%M');
};
const kalan = (tarih, s) => {
    const [y, a, g] = (tarih ?? '').split('-').map(Number);
    const [sa, dk] = String(s ?? '').split(':').map(Number);
    if (!y || !Number.isFinite(sa))
        return '';
    const fark = (new Date(y, a - 1, g, sa, dk || 0).getTime() - Date.now()) / 60000;
    if (fark < -120)
        return _('bitti');
    if (fark < 0)
        return _('şimdi');
    return fark >= 60 ? f(_('%s sa %s dk kaldı'), Math.floor(fark / 60), Math.round(fark % 60)) : f(_('%s dk kaldı'), Math.round(fark));
};
const ligSimge = lig => (/NBA|basket/i.test(lig ?? '') ? 'basket' : 'top');

const KATEGORI = () => ({onemli: _('Öne çıkanlar'), futbol: _('Futbol'), basketbol: _('Basketbol'), milli: _('Milli'),
    derbi: _('Derbiler'), takimlar: _('Takımlarım'), ozel: _('Özel'), cs2: 'CS2'});

function etiket(metin, stil, genislik) {
    const l = new St.Label({text: metin ?? '', style_class: stil, y_align: Clutter.ActorAlign.CENTER});
    l.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    if (genislik)
        l.style = `width: ${genislik}px;`;
    return l;
}

function yildizEtiket(n) {
    const l = new St.Label({style_class: 'flugel-mac-yildiz', y_align: Clutter.ActorAlign.CENTER});
    l.clutter_text.set_markup(yildizMetni(n));
    return l;
}

export class BasketSayfa extends Sayfa {
    constructor({veri, ayarlar}) {
        super();
        this._veri = veri;
        this._ayar = ayarlar;
        this._gun = 'bugun';
        this._kat = ayarlar.get_string('mac-kategori') || 'onemli';
        this._acikSatir = null;

        this._benim = new St.BoxLayout({style_class: 'flugel-benim-kart', orientation: Clutter.Orientation.VERTICAL});
        this._benim.reactive = true;
        ipucuBagla(this._benim, () => {
            const b = this._sonBenim ?? {};
            return {baslik: f(_('Takip: %s'), (b.isimler ?? []).join(', ')),
                ayrinti: [f(_('Son kontrol %s'), b.guncelleme ?? '?'), ...(b.gecmis ?? []).map(m =>
                    `${kisaTarih(m.tarih)} ${m.ev} — ${m.dep} (${m.gorev ?? ''})`)].join('\n')};
        });
        this._benimBolum = bolum(_('Benim maçlarım'), this._benim, {sag: dugme('view-refresh-symbolic', _('Bültenleri şimdi kontrol et'),
            () => this._kontrol(), {stil: 'flugel-dugme flugel-dugme-kucuk'})});
        this.actor.add_child(this._benimBolum);

        this._katKutu = new St.BoxLayout({style_class: 'flugel-cipler flugel-mac-kategoriler', x_align: Clutter.ActorAlign.CENTER});
        this.actor.add_child(this._katKutu);
        this._gunKutu = new St.BoxLayout({style_class: 'flugel-cipler', x_align: Clutter.ActorAlign.CENTER});
        this._gunCip = {};
        for (const [k, ad] of [['bugun', _('Bugün')], ['yarin', _('Yarın')], ['gecmis', _('Geçmiş')]]) {
            const b = new St.Button({label: ad, style_class: 'flugel-cip flugel-cip-kucuk', can_focus: true});
            b.connect('clicked', () => {
                this._gun = k;
                this._yaz({animasyon: true});
            });
            this._gunCip[k] = b;
            this._gunKutu.add_child(b);
        }
        this.actor.add_child(this._gunKutu);
        this._liste = new St.BoxLayout({style_class: 'flugel-mac-listesi', orientation: Clutter.Orientation.VERTICAL});
        this.actor.add_child(this._liste);
        const alt = new St.BoxLayout({style_class: 'flugel-cipler', x_align: Clutter.ActorAlign.CENTER});
        const fikstur = new St.Button({label: _('Ankara basketbol fikstürü'), style_class: 'flugel-cip', can_focus: true});
        fikstur.connect('clicked', () => this._ac('https://www.ankarabasket.org.tr/fiksturler'));
        alt.add_child(fikstur);
        const hltv = new St.Button({label: 'HLTV', style_class: 'flugel-cip', can_focus: true});
        hltv.connect('clicked', () => this._ac('https://www.hltv.org/matches'));
        alt.add_child(hltv);
        this.actor.add_child(alt);
        this._kategorileriKur();

        this._aboneler = [
            veri.abone('maclar', () => this._rozet()),
            veri.abone('cs2', () => this._rozet()),
        ];
        this._ayarId = ayarlar.connect('changed', (_s, k) => {
            if (k === 'mac-kategoriler') {
                this._kategorileriKur();
                this.gorunurse(() => this._yaz({animasyon: true}));
            } else if (['mac-favoriler', 'mac-ozel', 'mac-min-yildiz', 'cs2-takip', 'cs2-etkin'].includes(k)) {
                this.gorunurse(() => this._yaz());
            }
        });
    }

    _ac(url) {
        this.close();
        calistir(`xdg-open ${GLib.shell_quote(url)}`);
    }

    _rozet() {
        const d = this._veri.son('maclar');
        const cs = this._veri.son('cs2');
        const bugunVar = (d?.benim?.bugun ?? []).length;
        const fav = this._ayar.get_strv('mac-favoriler');
        const csCanli = (cs?.canli ?? []).some(m => favoriVar(fav, m) || m.yildiz >= this._ayar.get_int('cs2-min-yildiz'));
        this.rozetDegisti?.(d?.canli || csCanli ? _('canlı') : (bugunVar ? _('bugün') : ''));
        this.gorunurse(() => this._yaz());
    }

    _kategorileriKur() {
        this._katKutu.destroy_all_children();
        this._katCip = {};
        const ad = KATEGORI();
        const gorunen = this._ayar.get_strv('mac-kategoriler').filter(k => ad[k]);
        if (!gorunen.includes(this._kat))
            this._kat = gorunen[0] ?? 'onemli';
        for (const k of gorunen) {
            const b = new St.Button({label: ad[k], style_class: 'flugel-cip', can_focus: true});
            b.connect('clicked', () => {
                this._kat = k;
                this._ayar.set_string('mac-kategori', k);
                this._yaz({animasyon: true});
            });
            this._katCip[k] = b;
            this._katKutu.add_child(b);
        }
    }

    _kontrol() {
        calistir('ssh -o BatchMode=yes flugelserver python3 /opt/basket-bot/basket_bot.py');
        if (this._bekleId)
            GLib.source_remove(this._bekleId);
        this._bekleId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 40, () => {
            this._bekleId = 0;
            this._veri.yenile('maclar', true);
            return GLib.SOURCE_REMOVE;
        });
    }

    goster() {
        this._yaz();
        this._veri.tazele('maclar', 120);
        this._veri.tazele('cs2', 60);
    }

    // ---------- veri ----------
    // seçili günün futbol/basketbol maçları, lig adıyla düz liste
    _gunMaclari(gun = this._gun) {
        const d = this._veri.son('maclar');
        if (!d || d.hata)
            return [];
        const ligler = gun === 'gecmis' ? (d.gecmis ?? []).flatMap(g => g.ligler ?? []) : (d[gun] ?? []);
        return ligler.flatMap(l => l.maclar.map(m => ({...m, lig: l.lig})));
    }

    _cs2(hepsi = true) {
        const cs = this._veri.son('cs2');
        if (!this._ayar.get_boolean('cs2-etkin') || !cs || cs.hata)
            return [];
        return [...(cs.canli ?? []), ...(hepsi ? cs.yaklasan ?? [] : [])];
    }

    // ---------- çizim ----------
    // animasyon: kategori/gün değişince satırlar sırayla belirir; veri yenilenince sessizce yeniden çizilir
    _yaz({animasyon = false} = {}) {
        const d = this._veri.son('maclar');
        const cs = this._veri.son('cs2');
        const fav = this._ayar.get_strv('mac-favoriler');
        const ozel = new Set(this._ayar.get_strv('mac-ozel'));
        const imza = [d?.zaman, d?.benim?.guncelleme, cs?.zaman, this._kat, this._gun, fav, [...ozel],
            this._ayar.get_int('cs2-takip'), this._ayar.get_boolean('cs2-etkin'), this._ayar.get_int('mac-min-yildiz')];
        if (!this.degisti('maclar', imza) && !animasyon)
            return;
        for (const [k, b] of Object.entries(this._katCip ?? {})) {
            if (k === this._kat)
                b.add_style_pseudo_class('checked');
            else
                b.remove_style_pseudo_class('checked');
        }
        for (const [k, b] of Object.entries(this._gunCip)) {
            if (k === this._gun)
                b.add_style_pseudo_class('checked');
            else
                b.remove_style_pseudo_class('checked');
        }
        this._benimBolum.visible = ['onemli', 'basketbol'].includes(this._kat);
        this._gunKutu.visible = !['cs2', 'ozel'].includes(this._kat);
        if (this._benimBolum.visible)
            this._benimYaz(d);
        this._liste.destroy_all_children();
        this._acikSatir = null;
        this._satirlar = [];

        const kat = this._kat;
        const minY = this._ayar.get_int('mac-min-yildiz');
        const gun = this._gunMaclari();
        const tur = t => gun.filter(m => m.tur === t || (!m.tur && t === (/NBA/.test(m.lig) ? 'basketbol' : 'futbol')));
        if (kat === 'futbol' || kat === 'basketbol' || kat === 'milli') {
            this._grupluYaz(tur(kat), fav, ozel);
        } else if (kat === 'cs2') {
            const cs2 = this._cs2();
            this._duzYaz(_('Canlı'), onemSirala(cs2.filter(canliMi), fav, ozel), fav, ozel);
            this._duzYaz(_('Yaklaşan (36 saat)'), onemSirala(cs2.filter(m => !canliMi(m)), fav, ozel), fav, ozel);
            if (cs?.not)
                this._liste.add_child(etiket(_('HLTV\'ye ulaşılamadı; bo3.gg verisi'), 'flugel-soluk'));
        } else {
            let liste;
            if (kat === 'onemli') {
                liste = [...gun, ...this._cs2().filter(m => canliMi(m) || m.ts - Date.now() / 1000 < 12 * 3600)]
                    .filter(m => favoriVar(fav, m) || ozel.has(macAnahtar(m)) || m.derbi || (m.yildiz ?? 0) >= minY);
            } else if (kat === 'derbi') {
                liste = gun.filter(m => m.derbi);
            } else if (kat === 'takimlar') {
                liste = [...gun, ...this._cs2()].filter(m => favoriVar(fav, m));
            } else {
                const hepsi = [...this._gunMaclari('bugun'), ...this._gunMaclari('yarin'), ...this._gunMaclari('gecmis'), ...this._cs2()];
                liste = hepsi.filter(m => ozel.has(macAnahtar(m)));
            }
            this._duzYaz(null, onemSirala(liste, fav, ozel), fav, ozel, true);
        }
        if (!this._liste.get_n_children()) {
            const bos = {onemli: _('Bu gün için öne çıkan maç yok'), derbi: _('Derbi yok'),
                takimlar: fav.length ? _('Favori takımlarının maçı yok') : _('Favori takım yok: bir maça tıklayıp takımı ekle'),
                ozel: _('Özel maç yok: bir maça tıklayıp sabitle'), cs2: this._ayar.get_boolean('cs2-etkin') ? _('CS2 maçı yok') : _('CS2 kapalı (Ayarlar)')};
            this._liste.add_child(etiket(!d && !cs ? _('Yükleniyor…') : (bos[kat] ?? _('Maç yok')), 'flugel-soluk'));
        }
        if (animasyon && St.Settings.get().enable_animations) {
            this._satirlar.forEach((s, i) => {
                s.opacity = 0;
                s.translation_y = 8;
                s.ease({opacity: 255, translation_y: 0, delay: Math.min(i, 14) * 16, duration: 180,
                    mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
            });
        }
    }

    _baslik(metin, ikonAdi) {
        const ust = new St.BoxLayout({style_class: 'flugel-lig-baslik'});
        if (ikonAdi)
            ust.add_child(new St.Icon({gicon: ikon(ikonAdi), icon_size: 14, y_align: Clutter.ActorAlign.CENTER}));
        ust.add_child(etiket(metin, 'flugel-lig-ad'));
        this._liste.add_child(ust);
    }

    // favoriler/özel üstte ayrı, sonra ligler (en yıldızlı lig önce)
    _grupluYaz(liste, fav, ozel) {
        const one = onemSirala(liste.filter(m => favoriVar(fav, m) || ozel.has(macAnahtar(m))), fav, ozel);
        if (one.length)
            this._duzYaz(_('Takımlarım ve özel maçlar'), one, fav, ozel, true);
        const kalan = liste.filter(m => !one.includes(m));
        const ligler = new Map();
        for (const m of kalan) {
            if (!ligler.has(m.lig))
                ligler.set(m.lig, []);
            ligler.get(m.lig).push(m);
        }
        const enY = l => Math.max(...l.map(m => m.yildiz ?? 0));
        for (const [lig, ms] of [...ligler].sort((a, b) => enY(b[1]) - enY(a[1]))) {
            this._baslik(lig, ligSimge(lig));
            for (const m of ms.sort((a, b) => (canliMi(b) - canliMi(a)) || a.ts - b.ts))
                this._satirEkle(m, fav, ozel, false);
        }
    }

    _duzYaz(baslik, liste, fav, ozel, ligGoster = false) {
        if (!liste.length)
            return;
        if (baslik)
            this._baslik(baslik);
        for (const m of liste)
            this._satirEkle(m, fav, ozel, ligGoster);
    }

    _satirEkle(m, fav, ozel, ligGoster) {
        const kutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        const s = m.takim1 ? this._cs2Satiri(m, fav, ozel, ligGoster) : this._macSatiri(m, fav, ozel, ligGoster);
        kutu.add_child(s);
        s.connect('clicked', () => this._islemAcKapa(kutu, m));
        this._liste.add_child(kutu);
        this._satirlar.push(kutu);
    }

    _logo(t) {
        return new St.Icon({gicon: t.logo_yol ? Gio.FileIcon.new(Gio.File.new_for_path(t.logo_yol)) : ikon(t.cs2 ? 'input-gaming-symbolic' : 'top'),
            icon_size: 20, y_align: Clutter.ActorAlign.CENTER, style_class: 'flugel-mac-logo'});
    }

    _takimEtiket(t, fav, ev) {
        const l = etiket(t.ad, `flugel-mac-takim${ev ? ' flugel-mac-ev' : ''}${favoriMi(fav, t.ad) ? ' flugel-mac-favori-ad' : ''}`, 170);
        return l;
    }

    _macSatiri(m, fav, ozel, ligGoster) {
        const canli = m.durum === 'in', bitti = m.durum === 'post';
        const favori = favoriVar(fav, m), sabit = ozel.has(macAnahtar(m));
        const s = new St.Button({style_class: `flugel-mac-satir${canli ? ' flugel-mac-canli' : ''}${favori ? ' flugel-mac-favori' : ''}`,
            can_focus: true, x_expand: true});
        const k = new St.BoxLayout({x_expand: true});
        k.add_child(yildizEtiket(m.yildiz));
        k.add_child(this._takimEtiket(m.ev ?? {}, fav, true));
        k.add_child(this._logo(m.ev ?? {}));
        k.add_child(etiket(canli || bitti ? `${m.ev?.skor ?? '-'} – ${m.dep?.skor ?? '-'}` : saat(m.ts), 'flugel-mac-skor', 64));
        k.add_child(this._logo(m.dep ?? {}));
        k.add_child(this._takimEtiket(m.dep ?? {}, fav, false));
        const sag = new St.BoxLayout({x_expand: true, x_align: Clutter.ActorAlign.END, style: 'spacing: 4px;'});
        if (m.derbi)
            sag.add_child(etiket(_('DERBİ'), 'flugel-mac-derbi'));
        if (sabit)
            sag.add_child(new St.Icon({icon_name: 'view-pin-symbolic', icon_size: 12, y_align: Clutter.ActorAlign.CENTER, style_class: 'flugel-soluk'}));
        if (ligGoster)
            sag.add_child(etiket(m.lig, 'flugel-mac-lig'));
        sag.add_child(etiket(canli ? (m.detay ?? '').replace(/ - .*$/, '') || _('CANLI') : (bitti ? _('Bitti') : ''),
            `flugel-mac-durum${canli ? ' flugel-rozet flugel-mac-canli-rozet' : ''}`));
        k.add_child(sag);
        s.set_child(k);
        ipucuBagla(s, {baslik: `${m.ev?.ad} — ${m.dep?.ad}`,
            ayrinti: `${m.lig} · ${gunSaat(m.ts)}${m.detay ? ` · ${m.detay}` : ''}\n${_('Tıkla: favori, özel maç, maç sayfası')}`});
        return s;
    }

    _cs2Satiri(m, fav, ozel, ligGoster) {
        const canli = canliMi(m);
        const favori = favoriVar(fav, m);
        const takip = this._ayar.get_int('cs2-takip') === m.id;
        const s = new St.Button({style_class: `flugel-mac-satir${canli ? ' flugel-mac-canli' : ''}${favori ? ' flugel-mac-favori' : ''}`,
            can_focus: true, x_expand: true});
        const k = new St.BoxLayout({x_expand: true});
        k.add_child(yildizEtiket(m.yildiz));
        const t1 = {...m.takim1, cs2: true}, t2 = {...m.takim2, cs2: true};
        k.add_child(this._takimEtiket(t1, fav, true));
        k.add_child(this._logo(t1));
        let orta = gunSaat(m.ts);
        if (canli)
            orta = Number.isFinite(t1.raund) ? `${t1.raund} – ${t2.raund}` : `${t1.harita ?? 0} – ${t2.harita ?? 0}`;
        k.add_child(etiket(orta, 'flugel-mac-skor', canli ? 64 : 88));
        k.add_child(this._logo(t2));
        k.add_child(this._takimEtiket(t2, fav, false));
        const sag = new St.BoxLayout({x_expand: true, x_align: Clutter.ActorAlign.END, style: 'spacing: 4px;'});
        if (takip)
            sag.add_child(new St.Icon({icon_name: 'view-pin-symbolic', icon_size: 12, y_align: Clutter.ActorAlign.CENTER}));
        if (ligGoster || !canli)
            sag.add_child(etiket(m.etkinlik, 'flugel-mac-lig'));
        if (canli) {
            const harita = [m.simdiki_harita, Number.isFinite(t1.harita) ? `${t1.harita}-${t2.harita}` : null].filter(Boolean).join(' · ');
            sag.add_child(etiket(harita || _('CANLI'), 'flugel-mac-durum flugel-rozet flugel-mac-canli-rozet'));
        } else {
            sag.add_child(etiket(m.bo ?? '', 'flugel-mac-durum'));
        }
        k.add_child(sag);
        s.set_child(k);
        const bilgi = [m.etkinlik, m.asama, m.bo, m.haritalar?.length ? m.haritalar.join(', ') : null,
            f(_('HLTV: %s yıldız'), m.yildiz ?? 0)].filter(Boolean).join(' · ');
        ipucuBagla(s, {baslik: `${t1.ad} — ${t2.ad}`, ayrinti: `${bilgi}\n${_('Tıkla: favori, kapsülde takip, maç sayfası')}`});
        return s;
    }

    // maçın altında açılan işlem çubuğu (aynı anda bir tane)
    _islemAcKapa(kutu, m) {
        const onceki = this._acikSatir;
        if (onceki) {
            this._acikSatir = null;
            const cubuk = onceki.get_child_at_index(1);
            if (cubuk) {
                cubuk.ease({opacity: 0, duration: 120, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => cubuk.destroy()});
            }
            if (onceki === kutu)
                return;
        }
        const fav = this._ayar.get_strv('mac-favoriler');
        const ozel = new Set(this._ayar.get_strv('mac-ozel'));
        const cubuk = new St.BoxLayout({style_class: 'flugel-mac-islem', opacity: 0});
        const dugmeEkle = (ikonAdi, metin, fn, secili = false) => {
            const b = new St.Button({style_class: `flugel-cip flugel-cip-kucuk${secili ? ' flugel-mac-islem-secili' : ''}`, can_focus: true});
            const ic = new St.BoxLayout({style: 'spacing: 5px;'});
            ic.add_child(new St.Icon({icon_name: ikonAdi, icon_size: 12, y_align: Clutter.ActorAlign.CENTER}));
            ic.add_child(new St.Label({text: metin, y_align: Clutter.ActorAlign.CENTER}));
            b.set_child(ic);
            b.connect('clicked', fn);
            cubuk.add_child(b);
        };
        for (const t of takimlar(m)) {
            if (!t.ad)
                continue;
            const var_ = favoriMi(fav, t.ad);
            dugmeEkle(var_ ? 'starred-symbolic' : 'non-starred-symbolic', var_ ? f(_('%s favoride'), t.ad) : f(_('%s favorilere'), t.ad), () => {
                const l = this._ayar.get_strv('mac-favoriler');
                this._ayar.set_strv('mac-favoriler', var_ ? l.filter(x => !favoriMi([x], t.ad)) : [...l, t.ad]);
            }, var_);
        }
        const anahtar = macAnahtar(m);
        const sabit = ozel.has(anahtar);
        dugmeEkle('view-pin-symbolic', sabit ? _('Özelden çıkar') : _('Özel maç'), () => {
            const l = this._ayar.get_strv('mac-ozel').filter(x => x !== anahtar);
            // eski özel maçlar birikmesin: en fazla 40
            this._ayar.set_strv('mac-ozel', sabit ? l : [...l, anahtar].slice(-40));
        }, sabit);
        if (m.takim1 && canliMi(m)) {
            const takip = this._ayar.get_int('cs2-takip') === m.id;
            dugmeEkle('find-location-symbolic', takip ? _('Takibi bırak') : _('Kapsülde takip et'),
                () => this._ayar.set_int('cs2-takip', takip ? 0 : m.id), takip);
        }
        if (/^https?:\/\//.test(m.link ?? ''))
            dugmeEkle('send-to-symbolic', m.takim1 ? 'HLTV' : 'ESPN', () => this._ac(m.link));
        kutu.add_child(cubuk);
        cubuk.ease({opacity: 255, duration: 160, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        this._acikSatir = kutu;
    }

    _benimYaz(d) {
        this._benim.destroy_all_children();
        const b = d?.benim;
        if (!b) {
            this._benim.add_child(etiket(_('Hakemlik verisi yok'), 'flugel-soluk'));
            return;
        }
        const satir = (m, gun) => {
            const s = new St.BoxLayout({style_class: 'flugel-benim-satir'});
            s.add_child(new St.Icon({gicon: ikon('basket'), icon_size: 20, y_align: Clutter.ActorAlign.CENTER}));
            const metin = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
            metin.add_child(etiket(`${gun} ${m.saat ?? ''} · ${m.ev ?? '?'} — ${m.dep ?? '?'}`, 'flugel-benim-baslik'));
            metin.add_child(etiket([m.salon, m.gorev, m.lig].filter(Boolean).join(' · '), 'flugel-benim-alt'));
            s.add_child(metin);
            const k = kalan(m.tarih, m.saat);
            if (k)
                s.add_child(etiket(k, 'flugel-rozet flugel-benim-kalan'));
            this._benim.add_child(s);
        };
        (b.bugun ?? []).forEach(m => satir(m, _('Bugün')));
        (b.yarin ?? []).forEach(m => satir(m, _('Yarın')));
        if (!(b.bugun ?? []).length && !(b.yarin ?? []).length) {
            this._benim.add_child(etiket(_('Bugün ve yarın görevin yok'), 'flugel-benim-bos'));
            const y = (b.yaklasan ?? [])[0];
            if (y)
                this._benim.add_child(etiket(f(_('Sıradaki: %s %s · %s — %s'), kisaTarih(y.tarih), y.saat, y.ev, y.dep), 'flugel-benim-alt'));
        }
        this._sonBenim = b;
    }

    destroy() {
        if (this._bekleId)
            GLib.source_remove(this._bekleId);
        this._bekleId = 0;
        this._ayar.disconnect(this._ayarId);
        this._aboneler.forEach(fn => fn());
        super.destroy();
    }
}
