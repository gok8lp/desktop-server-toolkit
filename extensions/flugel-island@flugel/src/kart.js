// FLUGEL Island — genişletilmiş kart: başlık (karakter, saat, tarih, düğmeler), canlı etkinlikler listesi,
// sekmeler ve kaydırılabilir sayfa alanı. Sayfalar sayfalar/ altında; hepsi PopupMenuSection tabanlı.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {EtkinlikGorunumu} from './etkinlik-gorunumu.js';
import {ikon} from './ortak.js';
import {dugme, ipucuBagla, onizlemeAcik} from './bilesenler.js';
import {CalismaAlanlari} from './calisma-alanlari.js';

const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export class Kart {
    // sayfalar: [{id, ad, ikon, sayfa}]  (sayfa: sayfalar/sayfa.js Sayfa örneği)
    constructor({ayarlar, sayfalar, ayarlariAc, tepsi, ustCubuk}) {
        this._tepsi = tepsi;
        this._ayar = ayarlar;
        this._sayfalar = sayfalar;
        this._canliGorunumler = new Map();
        this.kapatIstendi = null;
        this.sabitleIstendi = null;
        this.boyutDegisti = null;
        this.disMenuKapandi = null;

        this.actor = new St.BoxLayout({style_class: 'flugel-kart', orientation: Clutter.Orientation.VERTICAL});

        // başlık
        const ust = new St.BoxLayout({style_class: 'flugel-kart-ust'});
        const zaman = new St.Button({style_class: 'flugel-zaman-dugme', can_focus: true, y_align: Clutter.ActorAlign.CENTER});
        const zamanKutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL});
        this._saat = new St.Label({style_class: 'flugel-kart-saat'});
        this._tarih = new St.Label({style_class: 'flugel-kart-tarih'});
        zamanKutu.add_child(this._saat);
        zamanKutu.add_child(this._tarih);
        zaman.set_child(zamanKutu);
        zaman.connect('clicked', () => {
            this.kapatIstendi?.();
            Main.panel.toggleCalendar();
        });
        ipucuBagla(zaman, 'Takvim ve bildirimler (sağ tık da açar)');
        ust.add_child(zaman);
        ust.add_child(new St.Widget({x_expand: true}));
        // çalışma alanları (üst çubuğun solundaki ekran değiştirici)
        this.calismaAlanlari = new CalismaAlanlari();
        ust.add_child(this.calismaAlanlari.actor);
        ust.add_child(new St.Widget({x_expand: true}));
        // üst çubuktan taşınanlar: Hızlı Ayarlar (pil, ses, ağ), takvim/bildirimler, Etkinlikler
        const sonra = fn => () => {
            this.kapatIstendi?.();
            fn();
        };
        ust.add_child(dugme('view-grid-symbolic', 'Hızlı ayarlar: ses, ağ, pil, güç', sonra(() => ustCubuk.hizliAyarlar())));
        ust.add_child(dugme('x-office-calendar-symbolic', 'Takvim ve bildirimler', sonra(() => ustCubuk.takvim())));
        ust.add_child(dugme('focus-windows-symbolic', 'Etkinlikler: pencereler ve uygulamalar', sonra(() => ustCubuk.etkinlikler())));
        this._sabitDugme = dugme('view-pin-symbolic', 'Açık tut', () => this.sabitleIstendi?.());
        ust.add_child(this._sabitDugme);
        ust.add_child(dugme('emblem-system-symbolic', 'Island ayarları', () => {
            this.kapatIstendi?.();
            ayarlariAc();
        }));
        ust.add_child(dugme('window-close-symbolic', 'Kapat', () => this.kapatIstendi?.()));
        this.actor.add_child(ust);

        // arka plan uygulamaları (tepsi) — simge yoksa görünmez
        this.actor.add_child(tepsi.actor);
        tepsi.disMenuKapandi = () => this.disMenuKapandi?.();

        // canlı etkinlikler
        this._canli = new St.BoxLayout({style_class: 'flugel-kart-canli', orientation: Clutter.Orientation.VERTICAL, visible: false});
        this.actor.add_child(this._canli);

        // sekmeler
        // sekme çubuğu: ortada, sadece simge; adı ve ne olduğu balonda
        this._sekmeKutu = new St.BoxLayout({style_class: 'flugel-sekmeler', x_align: Clutter.ActorAlign.CENTER});
        this._sekmeler = new Map();
        for (const s of sayfalar) {
            const d = new St.Button({style_class: 'flugel-sekme', can_focus: true, accessible_name: s.ad});
            const kutu = new St.Widget({layout_manager: new Clutter.BinLayout()});
            kutu.add_child(new St.Icon({gicon: ikon(s.ikon), icon_size: 18, x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER}));
            const rozet = new St.Label({style_class: 'flugel-rozet flugel-sekme-rozet', visible: false,
                x_align: Clutter.ActorAlign.END, y_align: Clutter.ActorAlign.START});
            // rozet simgenin sağ üstüne taşar (negatif CSS kenar boşluğu St'de boyutu bozar; kaydırma kullanılır)
            rozet.translation_x = 10;
            rozet.translation_y = -7;
            kutu.add_child(rozet);
            d.set_child(kutu);
            ipucuBagla(d, () => ({baslik: s.ad, ayrinti: [s.aciklama, rozet.visible ? rozet.text : ''].filter(Boolean).join(' · ')}));
            d.connect('clicked', () => this.sekmeSec(s.id));
            this._sekmeKutu.add_child(d);
            this._sekmeler.set(s.id, {dugme: d, ad: s.ad});
            s.sayfa.disMenuKapandi = () => this.disMenuKapandi?.();
            s.sayfa.rozetDegisti = metin => {
                rozet.text = metin ?? '';
                rozet.visible = !!metin;
            };
            // bir öğe çalıştırılınca (alt menüdekiler dahil) kart kapanır, menülerdeki gibi
            s.sayfa.connect('open-state-changed', (_m, acik) => {
                if (!acik)
                    this.kapatIstendi?.();
            });
        }
        this.actor.add_child(this._sekmeKutu);

        // sayfa alanı
        this._kaydirma = new St.ScrollView({style_class: 'flugel-sayfa-kap', hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC, overlay_scrollbars: true, x_expand: true});
        this._sayfaKutu = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        this._kaydirma.child = this._sayfaKutu;
        for (const s of sayfalar) {
            s.sayfa.actor.hide();
            this._sayfaKutu.add_child(s.sayfa.actor);
        }
        this.actor.add_child(this._kaydirma);
        this.actor.connect('notify::height', () => this._boyutBildir());

        this._secili = null;
        const son = this._ayar.get_string('son-sekme');
        this.sekmeSec(sayfalar.some(s => s.id === son) ? son : sayfalar[0].id, false);
        this.saatYaz();
    }

    _boyutBildir() {
        if (this._boyutId)
            return;
        // aynı karede birden çok değişikliği tek animasyonda topla
        this._boyutId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._boyutId = 0;
            if (this.actor.mapped)
                this.boyutDegisti?.();
            return GLib.SOURCE_REMOVE;
        });
    }

    saatYaz() {
        const t = GLib.DateTime.new_now_local();
        this._saat.text = t.format('%H:%M');
        this._tarih.text = `${t.get_day_of_month()} ${AYLAR[t.get_month() - 1]} ${GUNLER[t.get_day_of_week() % 7]}`;
    }

    sekmeSec(id, animasyon = true) {
        const yeni = this._sayfalar.find(s => s.id === id);
        if (!yeni || this._secili === yeni)
            return;
        const eski = this._secili;
        this._secili = yeni;
        for (const [sid, s] of this._sekmeler) {
            if (sid === id)
                s.dugme.add_style_pseudo_class('checked');
            else
                s.dugme.remove_style_pseudo_class('checked');
        }
        if (eski) {
            eski.sayfa.gizle();
            eski.sayfa.actor.hide();
        }
        // kart açıksa sayfa verisini tazele (kapalıyken sorgu yapılmaz)
        yeni.sayfa.actor.show();
        if (this.actor.mapped)
            yeni.sayfa.goster();
        this._kaydirma.vadjustment.value = 0;
        if (animasyon && this.actor.mapped) {
            yeni.sayfa.actor.opacity = 0;
            yeni.sayfa.actor.translation_y = 8;
            yeni.sayfa.actor.ease({opacity: 255, translation_y: 0, duration: 220, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        }
        this._ayar.set_string('son-sekme', id);
        this._boyutBildir();
    }

    acildi() {
        this.saatYaz();
        this._sayfaYuksekligi();
        this._secili?.sayfa.goster();
    }

    // açılıştan sonra boşta: her sekme bir kez çizilir (ilk açılışta/geçişte takılma olmasın)
    isit(bitince) {
        const sira = [...this._sayfalar];
        const ilk = this._secili;
        const adim = () => {
            const s = sira.shift();
            if (!s || !this.actor.mapped) {
                if (ilk)
                    this.sekmeSec(ilk.id, false);
                this._isitId = 0;
                bitince?.();
                return GLib.SOURCE_REMOVE;
            }
            this.sekmeSec(s.id, false);
            return GLib.SOURCE_CONTINUE;
        };
        this._isitId = GLib.timeout_add(GLib.PRIORITY_LOW, 150, adim);
    }

    kapandi() {
        for (const s of this._sayfalar)
            s.sayfa.kapandi();
    }

    _sayfaYuksekligi() {
        // kart, ekranın %86'sını geçmesin; fazlası kayar
        const m = Main.layoutManager.primaryMonitor;
        const s = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const azami = Math.round((m.height * 0.86) / s) - 190;
        this._kaydirma.style = `max-height: ${Math.max(220, azami)}px;`;
    }

    sabitDurumu(sabit) {
        if (sabit)
            this._sabitDugme.add_style_pseudo_class('checked');
        else
            this._sabitDugme.remove_style_pseudo_class('checked');
    }

    canliGuncelle(canli, ortam) {
        // genişletilmiş kartta: kalıcı etkinliklerin hepsi + mini olmayan ortam etkinlikleri
        const liste = [...canli, ...ortam.filter(a => a.data?.kartta)];
        const kalan = new Set(this._canliGorunumler.keys());
        liste.forEach((a, i) => {
            let g = this._canliGorunumler.get(a.id);
            if (!g) {
                g = new EtkinlikGorunumu('satir');
                this._canliGorunumler.set(a.id, g);
                this._canli.add_child(g.actor);
            }
            this._canli.set_child_at_index(g.actor, i);
            g.guncelle(a);
            kalan.delete(a.id);
        });
        for (const id of kalan) {
            this._canliGorunumler.get(id).destroy();
            this._canliGorunumler.delete(id);
        }
        this._canli.visible = liste.length > 0;
        this._boyutBildir();
    }

    disMenuAcik() {
        return onizlemeAcik() || this._tepsi.disMenuAcik() || this._sayfalar.some(s => s.sayfa.disMenuAcik());
    }

    destroy() {
        if (this._isitId)
            GLib.source_remove(this._isitId);
        this._isitId = 0;
        if (this._boyutId)
            GLib.source_remove(this._boyutId);
        this._boyutId = 0;
        for (const s of this._sayfalar)
            s.sayfa.destroy();
        this._tepsi.destroy();
        this.calismaAlanlari.destroy();
        this._canliGorunumler.clear();
        this.actor.destroy();
    }
}
