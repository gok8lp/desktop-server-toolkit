// FLUGEL Island — "Kripto ve döviz" sekmesi.
// Liste: izleme listesindeki koinler (simge, fiyat, 24 saat değişim, küçük grafik, alarm sayısı); "Ekle" ile
// Binance'teki bütün USDT çiftlerinden seçilir, sağ tık listeden çıkarır. Altında kurulu alarmlar.
// Ayrıntı (karta tıklayınca): dönem seçmeli büyük grafik — üzerine gelince incele, sürükleyince ölç,
// tıklayınca işaret ya da alarm koy, sağ tıkla çizgiyi sil — istatistikler, alarm kurma ve işaretler.
// Veri: ust-panel-veri kripto-izle (VeriMerkezi 'kizle'), kripto-liste ve koin SEMBOL DÖNEM (istenince).
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Sayfa} from './sayfa.js';
import {VERI, calistir, jsonAl, para} from '../ortak.js';
import {Karo, Izgara, bolum, dugme, ipucuBagla} from '../bilesenler.js';
import {Grafik, InteraktifGrafik} from '../grafik.js';
import {KriptoOlay, alarmlar, alarmEkle, alarmSil, birimli, isaretDegistir, isaretler, koinFiyat, koinIkonu,
    rozetMetni, yuzde} from '../kripto-ortak.js';
import {_, f} from '../dil.js';

const DONEMLER = () => [['1s', _('1 sa')], ['24s', _('24 sa')], ['7g', _('7 gün')], ['30g', _('30 gün')], ['1y', _('1 yıl')]];
const YESIL = '#8fd6a0', KIRMIZI = '#f07b7b';

function simgeAktor(k, boyut) {
    const g = koinIkonu(k);
    if (g)
        return new St.Icon({gicon: g, icon_size: boyut, y_align: Clutter.ActorAlign.CENTER, style_class: 'flugel-koin-simge'});
    return new St.Label({text: rozetMetni(k?.s ?? '?'), style_class: 'flugel-koin-rozet', y_align: Clutter.ActorAlign.CENTER,
        style: `min-width: ${boyut}px; min-height: ${boyut}px; font-size: ${boyut > 24 ? 11 : 8}pt;`});
}

export class KriptoSayfa extends Sayfa {
    constructor({veri, ayarlar}) {
        super();
        this._veri = veri;
        this._ayar = ayarlar;
        this._gw = ayarlar.get_int('kart-genislik') - 48;
        this._iptal = new Gio.Cancellable();
        this._tikKip = 'isaret';

        // ---------- liste görünümü ----------
        this._liste = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        this._kartlar = new Izgara({sutun: 4, bosluk: 8});
        this._liste.add_child(bolum(_('İzleme listesi'), this._kartlar, {sag: dugme('view-refresh-symbolic', _('Şimdi yenile'),
            () => veri.yenile('kizle', true), {stil: 'flugel-dugme flugel-dugme-kucuk'})}));

        // koin ekleme paneli (Binance'teki bütün USDT çiftleri, işlem hacmine göre)
        this._secim = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel', visible: false});
        this._arama = new St.Entry({style_class: 'flugel-arama', hint_text: _('Koin ara (ad ya da sembol)…'), can_focus: true, x_expand: true});
        this._arama.clutter_text.connect('text-changed', () => this._secimYaz());
        this._secim.add_child(this._arama);
        this._secimIzgara = new Izgara({sutun: 4, bosluk: 6});
        this._secim.add_child(this._secimIzgara.actor);
        this._liste.add_child(this._secim);

        this._alarmKutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style: 'spacing: 4px;'});
        this._alarmBolum = bolum(_('Fiyat alarmları'), this._alarmKutu);
        this._liste.add_child(this._alarmBolum);

        const baglantilar = new Izgara({sutun: 2});
        baglantilar.ekle(new Karo({ikon: 'send-to-symbolic', etiket: 'CoinMarketCap', ipucu: 'coinmarketcap.com',
            eylem: () => this._ac('https://coinmarketcap.com')}));
        baglantilar.ekle(new Karo({ikon: 'send-to-symbolic', etiket: 'TradingView', ipucu: 'tradingview.com',
            eylem: () => this._ac('https://www.tradingview.com/markets/cryptocurrencies/')}));
        this._liste.add_child(bolum('', baglantilar));
        this.actor.add_child(this._liste);

        // ---------- ayrıntı görünümü ----------
        this._detay = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, visible: false,
            style_class: 'flugel-kripto-detay'});
        this.actor.add_child(this._detay);

        this._aboneler = [veri.abone('kizle', () => this.gorunurse(() => {
            this._listeYaz();
            this._detayFiyatYaz();
        }))];
        this._ayarId = ayarlar.connect('changed', (_s, k) => {
            if (['kripto-varliklar', 'kripto-renk', 'kripto-alarmlar', 'kripto-mini-grafik'].includes(k))
                this.gorunurse(() => this._listeYaz(true));
            if (['kripto-alarmlar', 'kripto-isaretler', 'kripto-renk'].includes(k))
                this.gorunurse(() => this._detayCizgiler());
        });
        KriptoOlay.detayIste = s => this._detayAc(s);
    }

    _ac(url) {
        this.close();
        calistir(`xdg-open ${url}`);
    }

    goster() {
        this._listeYaz();
        this._veri.tazele('kizle', 30);
    }

    gizle() {
        this._secimKapat();
        this._detayKapat(false);
    }

    kapandi() {
        super.kapandi();
        this._secimKapat();
        this._detayKapat(false);
    }

    _koin(s) {
        return (this._veri.son('kizle')?.koinler ?? []).find(k => k.s === s) ?? null;
    }

    // ---------- liste ----------
    _listeYaz(zorla = false) {
        const d = this._veri.son('kizle');
        const izleme = this._ayar.get_strv('kripto-varliklar');
        const al = alarmlar(this._ayar);
        if (!zorla && !this.degisti('liste', [d?.zaman, izleme, al.length]))
            return;
        this._kartlar.temizle();
        const renkli = this._ayar.get_boolean('kripto-renk');
        const mini = this._ayar.get_boolean('kripto-mini-grafik');
        for (const s of izleme) {
            const k = (d?.koinler ?? []).find(x => x.s === s) ?? {s, yok: d ? true : 'bekle'};
            this._kartlar.ekle(this._kart(k, al.filter(a => a.s === s).length, renkli, mini));
        }
        const ekle = new Karo({ikon: 'list-add-symbolic', etiket: _('Koin ekle'), boyut: 24, stil: 'flugel-ekle-karo',
            ipucu: {baslik: _('Koin ekle'), ayrinti: _('Binance\'teki bütün koinler; karta sağ tıklayınca listeden çıkar')},
            eylem: () => (this._secim.visible ? this._secimKapat() : this._secimAc())});
        this._ekleKaro = this._kartlar.ekle(ekle);
        ekle.secili(this._secim.visible);
        if (d?.hata)
            this._kartlar.ekle(new St.Label({text: _('Fiyatlar alınamadı'), style_class: 'flugel-soluk', y_align: Clutter.ActorAlign.CENTER}));
        this._alarmlarYaz(al);
    }

    _kart(k, alarmSayisi, renkli, mini) {
        const kart = new St.Button({style_class: 'flugel-kripto-kart', can_focus: true, x_expand: true, track_hover: true,
            button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE});
        kart.set_pivot_point(0.5, 0.5);
        const kutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        const ust = new St.BoxLayout({style: 'spacing: 7px;'});
        ust.add_child(simgeAktor(k, 22));
        const ad = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        ad.add_child(new St.Label({text: k.s, style_class: 'flugel-kripto-sembol'}));
        const adEtiket = new St.Label({text: k.ad && k.ad !== k.s ? k.ad : '', style_class: 'flugel-kripto-ad'});
        adEtiket.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        ad.add_child(adEtiket);
        ust.add_child(ad);
        if (alarmSayisi) {
            ust.add_child(new St.Label({text: String(alarmSayisi), style_class: 'flugel-kripto-alarm-rozet',
                y_align: Clutter.ActorAlign.START}));
        }
        kutu.add_child(ust);
        if (k.yok) {
            kutu.add_child(new St.Label({text: k.yok === true ? _('Binance\'te yok') : _('Yükleniyor…'), style_class: 'flugel-soluk'}));
        } else {
            kutu.add_child(new St.Label({text: birimli(k.fiyat, k), style_class: 'flugel-kripto-fiyat'}));
            const deg = new St.Label({text: yuzde(k.degisim), style_class: 'flugel-kripto-degisim'});
            if (renkli && Number.isFinite(k.degisim))
                deg.style = `color: ${k.degisim >= 0 ? YESIL : KIRMIZI};`;
            kutu.add_child(deg);
            if (mini && k.seri?.length > 1) {
                const g = new Grafik({genislik: Math.floor((this._gw - 24) / 4) - 24, yukseklik: 30});
                g.ayarla(k.seri, {renkli});
                kutu.add_child(g.actor);
            }
        }
        kart.set_child(kutu);
        kart.connect('clicked', (_b, n) => {
            if (n === 3) {
                this._ayar.set_strv('kripto-varliklar', this._ayar.get_strv('kripto-varliklar').filter(x => x !== k.s));
                return;
            }
            this._detayAc(k.s);
        });
        // dokunmatik yüzeyde hafif büyüme
        kart.connect('notify::hover', () => kart.ease({scale_x: kart.hover ? 1.03 : 1, scale_y: kart.hover ? 1.03 : 1,
            duration: 140, mode: Clutter.AnimationMode.EASE_OUT_QUAD}));
        ipucuBagla(kart, () => (k.yok ? k.s : {baslik: `${k.ad ?? k.s} (${k.s})`,
            ayrinti: f(_('24 sa: en yüksek %s · en düşük %s\nTıkla: grafik ve alarm · sağ tık: listeden çıkar'),
                birimli(k.yuksek, k), birimli(k.dusuk, k))}));
        return kart;
    }

    _alarmlarYaz(al) {
        this._alarmKutu.destroy_all_children();
        this._alarmBolum.visible = al.length > 0;
        for (const a of al) {
            const k = this._koin(a.s);
            const satir = new St.Button({style_class: 'flugel-kripto-alarm-satir', x_expand: true, can_focus: true});
            const kutu = new St.BoxLayout({x_expand: true, style: 'spacing: 8px;'});
            kutu.add_child(simgeAktor(k ?? {s: a.s}, 16));
            kutu.add_child(new St.Label({text: a.s, style_class: 'flugel-kripto-sembol', y_align: Clutter.ActorAlign.CENTER}));
            kutu.add_child(new St.Label({text: a.yon === 'ust' ? f(_('%s üstüne çıkınca'), birimli(a.fiyat, k)) : f(_('%s altına inince'), birimli(a.fiyat, k)),
                x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
            if (k?.fiyat) {
                const uzak = 100 * (a.fiyat - k.fiyat) / k.fiyat;
                kutu.add_child(new St.Label({text: f(_('%s uzakta'), yuzde(uzak)), style_class: 'flugel-soluk', y_align: Clutter.ActorAlign.CENTER}));
            }
            kutu.add_child(dugme('window-close-symbolic', _('Alarmı sil'), () => alarmSil(this._ayar, a.id),
                {stil: 'flugel-dugme flugel-dugme-kucuk flugel-dugme-soluk', boyut: 14}));
            satir.set_child(kutu);
            satir.connect('clicked', () => this._detayAc(a.s));
            this._alarmKutu.add_child(satir);
        }
    }

    // ---------- koin ekleme ----------
    // arama/fiyat kutusuna yazılabilsin diye klavye bu süre için Island'a alınır (kapanınca bırakılır)
    _modal(ac) {
        if (ac && !this._grab) {
            let kok = this.actor;
            while (kok && kok.name !== 'flugelIsland')
                kok = kok.get_parent();
            if (kok)
                this._grab = Main.pushModal(kok, {actionMode: Shell.ActionMode.POPUP});
        } else if (!ac && this._grab) {
            Main.popModal(this._grab);
            this._grab = null;
        }
    }

    async _secimAc() {
        this._secim.show();
        this._ekleKaro?.secili(true);
        this._arama.text = '';
        this._modal(true);
        this._arama.grab_key_focus();
        if (!this._tumu || Date.now() - this._tumuZaman > 600000) {
            this._secimIzgara.temizle();
            this._secimIzgara.ekle(new St.Label({text: _('Liste yükleniyor…'), style_class: 'flugel-soluk'}));
            const d = await jsonAl([VERI, 'kripto-liste'], this._iptal);
            if (this._iptal.is_cancelled())
                return;
            this._tumu = d?.koinler ?? [];
            this._tumuZaman = Date.now();
        }
        this._secimYaz();
    }

    _secimKapat() {
        this._modal(false);
        if (!this._secim.visible)
            return;
        this._secim.hide();
        this._secimIzgara.temizle();
        this._ekleKaro?.secili(false);
    }

    _secimYaz() {
        if (!this._secim.visible || !this._tumu)
            return;
        this._secimIzgara.temizle();
        const ara = this._arama.text.trim().toLowerCase();
        const mevcut = new Set(this._ayar.get_strv('kripto-varliklar'));
        const havuz = [{s: 'USD', ad: _('Dolar / TL'), birim: 'TL'}, {s: 'EUR', ad: _('Euro / TL'), birim: 'TL'}, ...this._tumu];
        const liste = havuz.filter(k => !mevcut.has(k.s))
            .filter(k => !ara || k.s.toLowerCase().includes(ara) || (k.ad ?? '').toLowerCase().includes(ara))
            .slice(0, ara ? 40 : 24);
        if (!liste.length)
            this._secimIzgara.ekle(new St.Label({text: this._tumu.length ? _('Bulunamadı') : _('Liste alınamadı'), style_class: 'flugel-soluk'}));
        for (const k of liste) {
            const b = new St.Button({style_class: 'flugel-kripto-secim', can_focus: true, x_expand: true});
            const kutu = new St.BoxLayout({style: 'spacing: 8px;'});
            kutu.add_child(simgeAktor(k, 20));
            const m = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
            m.add_child(new St.Label({text: k.s, style_class: 'flugel-kripto-sembol'}));
            const alt = new St.Label({text: Number.isFinite(k.fiyat) ? `${birimli(k.fiyat, k)}  ${yuzde(k.degisim)}` : (k.ad ?? ''),
                style_class: 'flugel-kripto-ad'});
            alt.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            m.add_child(alt);
            kutu.add_child(m);
            b.set_child(kutu);
            ipucuBagla(b, {baslik: k.ad ?? k.s, ayrinti: Number.isFinite(k.hacim)
                ? f(_('24 sa işlem hacmi: %s $ · tıkla: listeye ekle'), para(k.hacim, 0)) : _('Tıkla: listeye ekle')});
            b.connect('clicked', () => {
                this._ayar.set_strv('kripto-varliklar', [...this._ayar.get_strv('kripto-varliklar'), k.s]);
                this._veri.yenile('kizle');
                this._secimYaz();
            });
            this._secimIzgara.ekle(b);
        }
    }

    // ---------- ayrıntı ----------
    _detayAc(s) {
        this._secimKapat();
        if (this._zamanlayici)
            GLib.source_remove(this._zamanlayici);
        this._acik = s;
        this._donem = this._ayar.get_string('kripto-donem') || '24s';
        this._seri = null;
        this._detay.destroy_all_children();
        const k = this._koin(s) ?? {s};

        const ust = new St.BoxLayout({style_class: 'flugel-kripto-detay-ust'});
        ust.add_child(dugme('go-previous-symbolic', _('Listeye dön'), () => this._detayKapat(), {stil: 'flugel-dugme flugel-dugme-kucuk'}));
        ust.add_child(simgeAktor(k, 32));
        const ad = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, y_align: Clutter.ActorAlign.CENTER});
        ad.add_child(new St.Label({text: k.ad && k.ad !== s ? `${k.ad}  ·  ${s}` : s, style_class: 'flugel-kripto-detay-ad'}));
        this._dFiyat = new St.Label({style_class: 'flugel-kripto-detay-fiyat'});
        ad.add_child(this._dFiyat);
        ust.add_child(ad);
        this._dDegisim = new St.Label({style_class: 'flugel-kripto-detay-degisim', y_align: Clutter.ActorAlign.CENTER, x_expand: true});
        ust.add_child(this._dDegisim);
        this._detay.add_child(ust);

        const secimler = new St.BoxLayout({style_class: 'flugel-kripto-kip'});
        this._donemDugme = {};
        for (const [d, etiket] of DONEMLER()) {
            const b = new St.Button({label: etiket, style_class: 'flugel-cip', can_focus: true, y_align: Clutter.ActorAlign.CENTER});
            b.connect('clicked', () => {
                this._donem = d;
                this._seriAl();
            });
            this._donemDugme[d] = b;
            secimler.add_child(b);
        }
        secimler.add_child(new St.Widget({x_expand: true}));
        this._kipDugme = {};
        for (const [id, etiket, ipucu] of [['isaret', _('İşaret'), _('Grafiğe tıklayınca o fiyata işaret çizgisi konur')],
            ['alarm', _('Alarm'), _('Grafiğe tıklayınca o fiyata alarm kurulur')]]) {
            const b = new St.Button({label: etiket, style_class: 'flugel-cip', can_focus: true});
            ipucuBagla(b, ipucu);
            b.connect('clicked', () => {
                this._tikKip = id;
                this._kipYaz();
            });
            this._kipDugme[id] = b;
            secimler.add_child(b);
        }
        this._detay.add_child(secimler);
        this._kipYaz();

        this._grafik = new InteraktifGrafik({genislik: this._gw - 16, yukseklik: 250});
        this._grafik.tiklandi = fiyat => this._grafikTik(fiyat);
        this._grafik.cizgiSil = c => (c.tur === 'alarm' ? alarmSil(this._ayar, c.id)
            : isaretDegistir(this._ayar, s, l => l.filter(v => v !== c.fiyat)));
        this._detay.add_child(this._grafik.actor);

        this._detay.add_child(new St.Label({text: _('Üzerine gel: incele · basılı tutup sürükle: ölç · sağ tık: çizgiyi sil'),
            style_class: 'flugel-soluk flugel-kripto-ipucu', x_align: Clutter.ActorAlign.CENTER}));

        this._istat = new St.BoxLayout({style_class: 'flugel-kripto-istat', x_expand: true});
        this._detay.add_child(this._istat);

        // alarm kurma
        const alarm = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style: 'spacing: 6px;'});
        const giris = new St.BoxLayout({style: 'spacing: 6px;'});
        this._alarmGiris = new St.Entry({style_class: 'flugel-arama', hint_text: _('Fiyat yaz, Enter'), can_focus: true, x_expand: true});
        this._alarmGiris.clutter_text.connect('button-press-event', () => {
            this._modal(true);
            this._alarmGiris.grab_key_focus();
            return Clutter.EVENT_PROPAGATE;
        });
        this._alarmGiris.clutter_text.connect('activate', () => this._alarmKur());
        giris.add_child(this._alarmGiris);
        giris.add_child(dugme('alarm-symbolic', _('Alarm kur'), () => this._alarmKur(), {stil: 'flugel-dugme', etiket: _('Alarm kur')}));
        alarm.add_child(giris);
        const hizli = new St.BoxLayout({style: 'spacing: 4px;'});
        for (const y of [-10, -5, -2, 2, 5, 10]) {
            const b = new St.Button({label: `${y > 0 ? '+' : '−'}${Math.abs(y)}%`, style_class: 'flugel-cip', can_focus: true});
            b.connect('clicked', () => {
                const fiyat = this._koin(s)?.fiyat;
                if (fiyat)
                    alarmEkle(this._ayar, s, Number((fiyat * (1 + y / 100)).toPrecision(6)), fiyat);
            });
            ipucuBagla(b, _('Şimdiki fiyata göre alarm'));
            hizli.add_child(b);
        }
        alarm.add_child(hizli);
        this._dAlarmlar = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style: 'spacing: 3px;'});
        alarm.add_child(this._dAlarmlar);
        this._detay.add_child(bolum(_('Fiyat alarmı'), alarm));

        this._dIsaretler = new St.BoxLayout({style_class: 'flugel-cipler', x_expand: true});
        this._detay.add_child(bolum(_('İşaretler'), this._dIsaretler, {sag: dugme('edit-clear-all-symbolic', _('Bu koinin bütün işaretlerini sil'),
            () => isaretDegistir(this._ayar, s, () => []), {stil: 'flugel-dugme flugel-dugme-kucuk flugel-dugme-soluk', boyut: 14})}));

        this._liste.hide();
        this._detay.show();
        if (St.Settings.get().enable_animations) {
            this._detay.opacity = 0;
            this._detay.translation_x = 28;
            this._detay.ease({opacity: 255, translation_x: 0, duration: 200, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        }
        this._detayFiyatYaz();
        this._detayCizgiler();
        this._seriAl();
        // kısa dönemlerde grafik açıkken tazelenir
        this._zamanlayici = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT_IDLE, 30, () => {
            if (this._acik && ['1s', '24s'].includes(this._donem) && this.actor.mapped)
                this._seriAl(true);
            return GLib.SOURCE_CONTINUE;
        });
    }

    _detayKapat(animasyon = true) {
        if (this._zamanlayici)
            GLib.source_remove(this._zamanlayici);
        this._zamanlayici = 0;
        this._modal(false);
        if (!this._detay.visible)
            return;
        this._acik = null;
        this._grafik = null;
        this._dFiyat = this._dAlarmlar = this._dIsaretler = this._alarmGiris = null;
        this._detay.hide();
        this._detay.destroy_all_children();
        this._liste.show();
        if (animasyon && St.Settings.get().enable_animations) {
            this._liste.opacity = 0;
            this._liste.translation_x = -28;
            this._liste.ease({opacity: 255, translation_x: 0, duration: 200, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        }
        this._listeYaz(true);
    }

    _kipYaz() {
        for (const [id, b] of Object.entries(this._kipDugme)) {
            if (id === this._tikKip)
                b.add_style_pseudo_class('checked');
            else
                b.remove_style_pseudo_class('checked');
        }
    }

    async _seriAl(sessiz = false) {
        const s = this._acik, donem = this._donem;
        for (const [d, b] of Object.entries(this._donemDugme ?? {})) {
            if (d === donem)
                b.add_style_pseudo_class('checked');
            else
                b.remove_style_pseudo_class('checked');
        }
        if (!sessiz)
            this._grafik?.ayarla({t: [], c: []});
        const d = await jsonAl([VERI, 'koin', s, donem], this._iptal);
        if (this._iptal.is_cancelled() || this._acik !== s || this._donem !== donem || !this._grafik)
            return;
        this._seri = d?.c?.length ? d : null;
        this._grafikYaz();
        this._istatYaz();
    }

    _grafikYaz() {
        if (!this._grafik || !this._seri)
            return;
        const k = this._koin(this._acik) ?? {s: this._acik};
        const c = [...this._seri.c];
        // son nokta canlı fiyatla güncel tutulur
        if (Number.isFinite(k.fiyat) && ['1s', '24s'].includes(this._donem))
            c[c.length - 1] = k.fiyat;
        const uzun = ['30g', '1y'].includes(this._donem);
        const kisa = ['1s', '24s'].includes(this._donem);
        this._grafik.ayarla({t: this._seri.t, c, renkli: this._ayar.get_boolean('kripto-renk'), cizgiler: this._cizgiler(),
            fiyatBicim: koinFiyat,
            zamanBicim: (t, tam) => GLib.DateTime.new_from_unix_local(t).format(tam ? (uzun ? '%d.%m.%Y' : '%d.%m %H:%M')
                : (kisa ? '%H:%M' : '%d.%m'))});
    }

    _cizgiler() {
        const s = this._acik;
        return [...isaretler(this._ayar, s).map(fiyat => ({fiyat, tur: 'isaret'})),
            ...alarmlar(this._ayar).filter(a => a.s === s).map(a => ({fiyat: a.fiyat, tur: 'alarm', id: a.id}))];
    }

    _grafikTik(fiyat) {
        const s = this._acik;
        const yuvarla = Number(fiyat.toPrecision(5));
        if (this._tikKip === 'alarm')
            alarmEkle(this._ayar, s, yuvarla, this._koin(s)?.fiyat ?? fiyat);
        else
            isaretDegistir(this._ayar, s, l => [...l, yuvarla]);
    }

    _alarmKur() {
        const metin = this._alarmGiris?.text.trim().replace(/\s/g, '') ?? '';
        // "81,500", "81.500" (binlik) ve "1.0181", "0,25" (ondalık): son ayırıcıdan sonra tam 3 hane varsa binliktir
        const son = Math.max(metin.lastIndexOf('.'), metin.lastIndexOf(','));
        const sayi = son >= 0 && metin.length - son - 1 !== 3
            ? Number(`${metin.slice(0, son).replace(/[.,]/g, '')}.${metin.slice(son + 1)}`)
            : Number(metin.replace(/[.,]/g, ''));
        const fiyat = this._koin(this._acik)?.fiyat;
        if (!Number.isFinite(sayi) || sayi <= 0 || !fiyat) {
            this._alarmGiris?.add_style_pseudo_class('error');
            return;
        }
        this._alarmGiris.remove_style_pseudo_class('error');
        alarmEkle(this._ayar, this._acik, sayi, fiyat);
        this._alarmGiris.text = '';
        this._modal(false);
    }

    _detayFiyatYaz() {
        if (!this._acik || !this._dFiyat)
            return;
        const k = this._koin(this._acik);
        this._dFiyat.text = k?.fiyat ? birimli(k.fiyat, k) : '…';
        this._dDegisim.text = k ? f(_('%s  (24 sa)'), yuzde(k.degisim)) : '';
        this._dDegisim.style = this._ayar.get_boolean('kripto-renk') && Number.isFinite(k?.degisim)
            ? `color: ${k.degisim >= 0 ? YESIL : KIRMIZI};` : null;
        this._grafikYaz();
    }

    _istatYaz() {
        this._istat.destroy_all_children();
        const v = this._seri;
        if (!v)
            return;
        const k = this._koin(this._acik) ?? {s: this._acik};
        const renkli = this._ayar.get_boolean('kripto-renk');
        const deg = 100 * (v.c[v.c.length - 1] - v.a[0]) / v.a[0];
        const enY = Math.max(...v.y), enD = Math.min(...v.d);
        for (const [ad, deger, renk] of [
            [_('Açılış'), birimli(v.a[0], k)],
            [_('En yüksek'), birimli(enY, k)],
            [_('En düşük'), birimli(enD, k)],
            [_('Değişim'), yuzde(deg), deg >= 0 ? YESIL : KIRMIZI],
            [_('Dalgalanma'), `${(100 * (enY - enD) / enD).toFixed(2)}%`],
        ]) {
            const b = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, style_class: 'flugel-kripto-istat-kutu'});
            b.add_child(new St.Label({text: ad, style_class: 'flugel-kripto-ad'}));
            b.add_child(new St.Label({text: deger, style_class: 'flugel-kripto-istat-deger',
                style: renk && renkli ? `color: ${renk};` : null}));
            this._istat.add_child(b);
        }
    }

    _detayCizgiler() {
        if (!this._acik || !this._dAlarmlar)
            return;
        const s = this._acik;
        const k = this._koin(s) ?? {s};
        this._dAlarmlar.destroy_all_children();
        for (const a of alarmlar(this._ayar).filter(x => x.s === s)) {
            const satir = new St.BoxLayout({style_class: 'flugel-kripto-alarm-satir', style: 'spacing: 8px;'});
            satir.add_child(new St.Icon({icon_name: a.yon === 'ust' ? 'go-up-symbolic' : 'go-down-symbolic', icon_size: 14,
                y_align: Clutter.ActorAlign.CENTER}));
            satir.add_child(new St.Label({text: a.yon === 'ust' ? f(_('%s üstüne çıkınca'), birimli(a.fiyat, k)) : f(_('%s altına inince'), birimli(a.fiyat, k)),
                x_expand: true, y_align: Clutter.ActorAlign.CENTER}));
            satir.add_child(dugme('window-close-symbolic', _('Alarmı sil'), () => alarmSil(this._ayar, a.id),
                {stil: 'flugel-dugme flugel-dugme-kucuk flugel-dugme-soluk', boyut: 14}));
            this._dAlarmlar.add_child(satir);
        }
        this._dIsaretler.destroy_all_children();
        const isr = isaretler(this._ayar, s);
        if (!isr.length)
            this._dIsaretler.add_child(new St.Label({text: _('Grafiğe tıklayarak destek/direnç çizgisi koy'), style_class: 'flugel-soluk'}));
        for (const v of isr) {
            const b = new St.Button({label: `${koinFiyat(v)}  ×`, style_class: 'flugel-cip flugel-kripto-isaret', can_focus: true});
            b.connect('clicked', () => isaretDegistir(this._ayar, s, l => l.filter(x => x !== v)));
            ipucuBagla(b, _('Tıkla: işareti sil'));
            this._dIsaretler.add_child(b);
        }
        this._grafikYaz();
    }

    destroy() {
        this._iptal.cancel();
        this._detayKapat(false);
        this._modal(false);
        KriptoOlay.detayIste = null;
        this._aboneler.forEach(fn => fn());
        this._ayar.disconnect(this._ayarId);
        super.destroy();
    }
}
