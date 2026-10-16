// FLUGEL Island — "Hızlı" sekmesi: sabitlenmiş uygulamalar ve araçlar (simge ızgarası).
//   Zorla kapat (daire içinde çarpı): pencere listesi açılır, birine tıkla → kapatılır
//   Panik (kalkan): gizle + sustur + kilitle; yanlışlıkla basılmasın diye ikinci tık ya da basılı tutma onayı
//   Uyku engelleme (fincan): süresiz / 1 sa / 2 sa / video oynarken
//   Ekran görüntüsü ve ekran kaydı aynı satırda
import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Sayfa} from './sayfa.js';
import {bash, calistir, ekranGoruntusu, ikon} from '../ortak.js';
import {Karo, Izgara, bolum, gorunurKaydir} from '../bilesenler.js';
import {sabitKarolar} from '../uygulamalar.js';
import {UYKU_KIPLERI} from '../uyku.js';
import {HizliAyarlar} from '../hizli-ayarlar.js';
import {SesParlaklik} from '../kontroller.js';
import {BluetoothPaneli, WifiPaneli, yumusakAc} from '../hizli-detay.js';
import {PanoPaneli, RenkPaneli, ZamanlayiciPaneli, renkSec} from '../araclar.js';
import {DONUSUMLER, HesapPaneli, KronometrePaneli, NotPaneli, QrPaneli, panoDonustur} from '../araclar-ek.js';
import {_, f} from '../dil.js';

function surecOldur(pid, ad) {
    if (!pid || pid <= 1)
        return;
    // önce kibarca (TERM), 2 sn sonra hâlâ açıksa alt süreçleriyle birlikte KILL
    bash(`kill -TERM ${pid} 2>/dev/null; pkill -TERM -P ${pid} 2>/dev/null; sleep 2; ` +
         `if kill -0 ${pid} 2>/dev/null; then pkill -KILL -P ${pid}; kill -KILL ${pid}; fi`);
    Main.notify(_('Zorla kapatılıyor'), ad);
}

const saatDakika = ms => {
    const dk = Math.max(1, Math.round(ms / 60000));
    return dk >= 60 ? f(_('%s sa %s dk'), Math.floor(dk / 60), dk % 60) : f(_('%s dk'), dk);
};

export class HizliSayfa extends Sayfa {
    constructor(o) {
        super();
        this._o = o;
        this._panik = o.panik;
        this._uyku = o.uyku;
        this._genislik = o.ayarlar.get_int('kart-genislik') - 48;

        // ses ve parlaklık en üstte (uygulama sesleri sağdaki düğmeyle açılır)
        this._cubuklar = new SesParlaklik();
        this.actor.add_child(bolum(_('Ses ve parlaklık'), this._cubuklar.actor));

        this._sabit = new Izgara({genislik: this._genislik, karoGenisligi: 84});
        this.actor.add_child(bolum(_('Uygulamalar'), this._sabit));
        // uygulama ekleme paneli (sistemdeki her uygulama, arama kutulu)
        this._uygPanel = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel', visible: false});
        this._uygArama = new St.Entry({style_class: 'flugel-arama', hint_text: _('Uygulama ara…'), can_focus: true, x_expand: true});
        this._uygArama.clutter_text.connect('text-changed', () => this._uygYaz());
        this._uygPanel.add_child(this._uygArama);
        this._uygIzgara = new Izgara({genislik: this._genislik - 16, karoGenisligi: 92});
        this._uygPanel.add_child(this._uygIzgara.actor);
        this.actor.add_child(this._uygPanel);
        this._sabitYaz();
        this._ayarId = o.ayarlar.connect('changed::sabit-uygulamalar', () => this._sabitYaz());

        const araclar = new Izgara({genislik: this._genislik, karoGenisligi: 84});
        this._zorla = araclar.ekle(new Karo({ikon: 'kapat-daire', etiket: _('Zorla kapat'),
            ipucu: {baslik: _('Zorla kapat'), ayrinti: _('Donan uygulamayı seç: önce kibarca, 2 sn sonra zorla kapatılır')},
            eylem: () => this._ac('zorla')}));
        this._panikKaro = araclar.ekle(new Karo({ikon: 'kalkan', etiket: _('Panik'),
            ipucu: () => this._panikIpucu(), eylem: () => this._panikBas()}));
        this._basiliBagla();
        this._uykuKaro = araclar.ekle(new Karo({ikon: 'fincan', etiket: _('Uyku engelle'),
            ipucu: () => this._uykuIpucu(), eylem: () => this._ac('uyku')}));
        araclar.ekle(new Karo({ikon: 'camera-photo-symbolic', etiket: _('Görüntü'),
            ipucu: {baslik: _('Ekran görüntüsü'), ayrinti: _('Alan, pencere ya da tüm ekran (Print, Shift+Super+S)')},
            eylem: () => {
                this.close();
                ekranGoruntusu();
            }}));
        // Atoll'dan uyarlanan araçlar: zamanlayıcı, pano geçmişi, renk seçici (altta yayla açılan paneller)
        this._zamanKaro = araclar.ekle(new Karo({ikon: 'alarm-symbolic', etiket: _('Zamanlayıcı'),
            ipucu: {baslik: _('Zamanlayıcı'), ayrinti: _('Geri sayım kapsülde görünür; bitince ses ve duyuru')},
            eylem: () => this._detayAcKapa('zaman')}));
        araclar.ekle(new Karo({ikon: 'edit-paste-symbolic', etiket: _('Pano'),
            ipucu: {baslik: _('Pano geçmişi'), ayrinti: _('Son kopyalanan metinler (sadece bu oturumda, bellekte)')},
            eylem: () => this._detayAcKapa('pano')}));
        araclar.ekle(new Karo({ikon: 'color-select-symbolic', etiket: _('Renk seç'),
            ipucu: {baslik: _('Renk seçici'), ayrinti: _('Tıkla: geçmiş ve seçici · sağ tık: hemen ekrandan seç (HEX panoya)')},
            eylem: () => this._detayAcKapa('renk'),
            sagTik: () => {
                this.close();
                renkSec(this._o.ayarlar).catch(() => {});
            }}));
        araclar.ekle(new Karo({ikon: 'hesap', etiket: _('Hesap'),
            ipucu: {baslik: _('Hesap makinesi'), ayrinti: _('Yazarken sonuç verir; Enter sonucu kopyalar')},
            eylem: () => this._detayAcKapa('hesap')}));
        araclar.ekle(new Karo({ikon: 'kronometre', etiket: _('Kronometre'),
            ipucu: {baslik: _('Kronometre'), ayrinti: _('Tur alır; çalışırken kapsülde görünür')},
            eylem: () => this._detayAcKapa('krono')}));
        araclar.ekle(new Karo({ikon: 'qr', etiket: 'QR',
            ipucu: {baslik: _('QR kod'), ayrinti: _('Panodaki bağlantıyı telefona aktar: kamerayla okut')},
            eylem: () => this._detayAcKapa('qr')}));
        araclar.ekle(new Karo({ikon: 'not', etiket: _('Not'),
            ipucu: {baslik: _('Hızlı not'), ayrinti: _('Yazdıkça kaydedilir')},
            eylem: () => this._detayAcKapa('not')}));
        araclar.ekle(new Karo({ikon: 'camera-video-symbolic', etiket: _('Kayıt'),
            ipucu: {baslik: _('Ekran kaydı'), ayrinti: _('Kooha: MP4 ya da GIF')},
            eylem: () => {
                this.close();
                calistir('kooha');
            }}));
        this._geriKaro = araclar.ekle(new Karo({ikon: 'edit-undo-symbolic', etiket: _('Geri al'),
            ipucu: {baslik: _('Paniği geri al'), ayrinti: _('Gizlenen pencereler ve ses geri gelir')},
            eylem: () => this._panik.geriAl()}));
        this.actor.add_child(bolum(_('Araçlar'), araclar));
        this._hizliAyar = new HizliAyarlar();
        this._ayarIzgara = new Izgara({genislik: this._genislik, karoGenisligi: 84});
        // hızlı ayarlar ses/parlaklığın hemen altında (stok Hızlı Ayarlar gibi sistem denetimleri bir arada)
        const ayarBolum = bolum(_('Hızlı ayarlar'), this._ayarIzgara);
        this.actor.insert_child_at_index(ayarBolum, 1);
        // Wi-Fi / Bluetooth ayrıntısı (karoya tıklayınca altta açılır; sağ tık hızlıca açar/kapatır)
        this._detayKap = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true, visible: false,
            clip_to_allocation: true});
        this.actor.insert_child_at_index(this._detayKap, 2);

        // açılır alt panel (zorla kapat listesi / uyku süreleri)
        this._alt = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'flugel-alt-panel', visible: false});
        this.actor.add_child(this._alt);

        this._abonelikler = [
            this._panik.abone(() => this._durumYaz()),
            this._uyku.abone(() => this._durumYaz()),
        ];
        this._durumYaz();
    }

    _sabitYaz() {
        this._sabit.temizle();
        for (const k of sabitKarolar(this._o.ayarlar, {sonra: () => this.close()}))
            this._sabit.ekle(k);
        this._ekleKaro = this._sabit.ekle(new Karo({ikon: 'list-add-symbolic', etiket: _('Ekle'), boyut: 28,
            stil: 'flugel-ekle-karo', ipucu: {baslik: _('Uygulama ekle'), ayrinti: _('Sistemdeki herhangi bir uygulama; sağ tıkla kaldırılır')},
            eylem: () => this._uygAcKapa()}));
    }

    // ---------- uygulama ekleme ----------
    _uygAcKapa() {
        if (this._uygPanel.visible) {
            this._uygKapat();
            return;
        }
        this._uygPanel.show();
        this._ekleKaro?.secili(true);
        this._uygArama.text = '';
        this._uygYaz();
        if (!this._grab) {
            let kok = this.actor;
            while (kok && kok.name !== 'flugelIsland')
                kok = kok.get_parent();
            if (kok) {
                this._grab = Main.pushModal(kok, {actionMode: Shell.ActionMode.POPUP});
                this._uygArama.grab_key_focus();
            }
        }
    }

    _uygKapat() {
        if (this._grab) {
            // odaktaki yazı kutusundan önce odak alınır (giriş yöntemi uyarı vermesin)
            global.stage.set_key_focus(null);
            Main.popModal(this._grab);
            this._grab = null;
        }
        this._uygPanel.hide();
        this._uygIzgara.temizle();
        this._ekleKaro?.secili(false);
    }

    _uygYaz() {
        this._uygIzgara.temizle();
        const ara = this._uygArama.text.trim().toLocaleLowerCase('tr');
        const sabit = new Set(this._o.ayarlar.get_strv('sabit-uygulamalar'));
        const sistem = Shell.AppSystem.get_default();
        const liste = sistem.get_installed().filter(i => i.should_show() && !sabit.has(i.get_id()))
            .filter(i => !ara || i.get_name().toLocaleLowerCase('tr').includes(ara) || (i.get_id() ?? '').includes(ara))
            .sort((x, y) => x.get_name().localeCompare(y.get_name(), 'tr')).slice(0, 48);
        for (const i of liste) {
            this._uygIzgara.ekle(new Karo({ikon: i.get_icon() ?? 'application-x-executable-symbolic', etiket: i.get_name(), boyut: 28,
                ipucu: {baslik: i.get_name(), ayrinti: _('Tıkla: sabitle')},
                eylem: () => {
                    this._o.ayarlar.set_strv('sabit-uygulamalar', [...this._o.ayarlar.get_strv('sabit-uygulamalar'), i.get_id()]);
                    this._uygYaz();
                }}));
        }
    }

    goster() {
        this._durumYaz();
        this._ayarlarYaz();
    }

    gizle() {
        this._uygKapat();
        this._detayKapat();
    }

    // Hızlı Ayarlar'daki anahtarlar (Wi-Fi, Bluetooth, uçak, gece ışığı, rahatsız etme, güç, mikrofon)
    async _ayarlarYaz() {
        const durumlar = await this._hizliAyar.durumlar();
        if (!this.actor.get_stage())
            return;
        this._ayarIzgara.temizle();
        const degistir = async id => {
            await this._hizliAyar.degistir(id);
            // servis durumu güncellesin diye kısa bekleme
            if (this._ayarBekleId)
                GLib.source_remove(this._ayarBekleId);
            this._ayarBekleId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
                this._ayarBekleId = 0;
                this._ayarlarYaz();
                return GLib.SOURCE_REMOVE;
            });
        };
        for (const d of durumlar) {
            const detayli = d.id === 'wifi' || d.id === 'bt';
            const k = this._ayarIzgara.ekle(new Karo({ikon: d.ikon, etiket: d.ad,
                ipucu: {baslik: d.ad, ayrinti: detayli ? `${d.acik ? _('Açık') : _('Kapalı')} · ${_('tıkla: ağlar/cihazlar · sağ tık: aç/kapat')}` : d.ayrinti},
                eylem: () => (detayli ? this._detayAcKapa(d.id) : degistir(d.id)),
                sagTik: detayli ? () => degistir(d.id) : null}));
            k.secili(d.acik);
            if (detayli && this._detayId === d.id)
                k.actor.add_style_class_name('flugel-karo-detay-acik');
        }
    }

    _detayAcKapa(id) {
        const eski = this._detay;
        const ayni = this._detayId === id;
        this._detay = null;
        this._detayId = null;
        const kur = () => {
            if (ayni)
                return;
            this._detayId = id;
            const kapat = () => this.close();
            this._detay = {wifi: () => new WifiPaneli({kapat}), bt: () => new BluetoothPaneli({kapat}), zaman: () => new ZamanlayiciPaneli(),
                pano: () => new PanoPaneli({kapat, ekSatir: () => this._donusturSatiri()}),
                hesap: () => new HesapPaneli(), krono: () => new KronometrePaneli(), qr: () => new QrPaneli(),
                not: () => new NotPaneli({ayarlar: this._o.ayarlar}), renk: () => new RenkPaneli({ayarlar: this._o.ayarlar, kapat})}[id]();
            this._detayKap.add_child(this._detay.actor);
            yumusakAc(this._detayKap, true, () => gorunurKaydir(this._detayKap));
            this._ayarlarYaz();
        };
        if (eski) {
            yumusakAc(this._detayKap, false, () => {
                eski.destroy();
                kur();
            });
            if (ayni)
                this._ayarlarYaz();
        } else {
            kur();
        }
    }

    // pano geçmişinin üstünde: panodaki metni dönüştüren düğmeler
    _donusturSatiri() {
        const satir = new St.BoxLayout({style_class: 'flugel-cipler', x_expand: true});
        satir.add_child(new St.Label({text: _('Panodakini çevir:'), style_class: 'flugel-detay-alt', y_align: Clutter.ActorAlign.CENTER}));
        for (const [id, ad] of DONUSUMLER()) {
            const b = new St.Button({label: ad, style_class: 'flugel-cip flugel-cip-kucuk', can_focus: true});
            b.connect('clicked', () => panoDonustur(id).catch(() => {}));
            satir.add_child(b);
        }
        return satir;
    }

    _detayKapat() {
        this._detay?.destroy();
        this._detay = null;
        this._detayId = null;
        this._detayKap.hide();
        this._cubuklar.uygulamalar(false);
    }

    kapandi() {
        super.kapandi();
        this._detayKapat();
        this._uygKapat();
        this._altKapat();
        this._panikOnayIptal();
    }

    _durumYaz() {
        this._geriKaro.actor.visible = this._panik.aktif;
        this._uykuKaro.secili(this._uyku.acik);
        this._uykuKaro.nokta(this._uyku.acik ? 'acik' : null);
        this._uykuKaro.guncelle({etiket: this._uyku.acik ? (this._uyku.kip === 'video' ? _('Video') : _('Uyanık')) : _('Uyku engelle')});
        if (this._acikAlt === 'uyku')
            this._uykuPaneli();
    }

    // ---------- alt panel ----------
    _ac(tur) {
        if (this._acikAlt === tur) {
            this._altKapat();
            return;
        }
        this._acikAlt = tur;
        if (tur === 'zorla')
            this._zorlaPaneli();
        else
            this._uykuPaneli();
        this._alt.show();
        this._zorla.secili(tur === 'zorla');
    }

    _altKapat() {
        this._acikAlt = null;
        this._alt.destroy_all_children();
        this._alt.hide();
        this._zorla.secili(false);
    }

    _zorlaPaneli() {
        this._alt.destroy_all_children();
        const iz = new Izgara({genislik: this._genislik, karoGenisligi: 104});
        const tracker = Shell.WindowTracker.get_default();
        const gorulen = new Set();
        for (const actor of global.get_window_actors()) {
            const w = actor.meta_window;
            if (!w || w.is_skip_taskbar())
                continue;
            const app = tracker.get_window_app(w);
            let pid = w.get_pid();
            if ((!pid || pid <= 0) && app)
                pid = app.get_pids()[0] ?? 0;
            if (!pid || pid <= 0 || gorulen.has(pid))
                continue;
            gorulen.add(pid);
            const ad = app ? app.get_name() : (w.get_wm_class() || '?');
            iz.ekle(new Karo({ikon: app?.get_icon() ?? ikon('application-x-executable-symbolic'), etiket: ad, boyut: 28,
                ipucu: {baslik: f(_('%s: zorla kapat'), ad), ayrinti: (w.get_title() || '').slice(0, 80)},
                eylem: () => {
                    this.close();
                    surecOldur(pid, ad);
                }}));
        }
        iz.ekle(new Karo({ikon: 'eclipse', etiket: 'Eclipse', ipucu: _('Eclipse\'i zorla kapat'), eylem: () => {
            this.close();
            bash("pkill -TERM -f 'org.eclipse.equinox.launcher|snap/eclipse/.*/eclipse'; sleep 2; pkill -KILL -f 'org.eclipse.equinox.launcher|snap/eclipse/.*/eclipse'");
            Main.notify(_('Zorla kapatılıyor'), 'Eclipse');
        }}));
        iz.ekle(new Karo({ikon: 'web-browser-symbolic', etiket: 'Chrome', ipucu: _('Chrome\'u zorla kapat'), eylem: () => {
            this.close();
            bash('pkill -TERM -x chrome; sleep 2; pkill -KILL -x chrome');
            Main.notify(_('Zorla kapatılıyor'), 'Chrome');
        }}));
        iz.ekle(new Karo({ikon: 'utilities-system-monitor-symbolic', etiket: _('Tüm süreçler'), ipucu: _('Sistem İzleyici'),
            eylem: () => {
                this.close();
                calistir('gnome-system-monitor -p');
            }}));
        this._alt.add_child(bolum(gorulen.size ? _('Hangi uygulama dondu?') : _('Açık pencere yok'), iz));
    }

    _uykuPaneli() {
        this._alt.destroy_all_children();
        const iz = new Izgara({genislik: this._genislik, karoGenisligi: 104});
        for (const [kip, ad] of UYKU_KIPLERI()) {
            const k = iz.ekle(new Karo({ikon: kip === 'video' ? 'media-playback-start-symbolic' : 'fincan', etiket: ad,
                ipucu: {baslik: f(_('Uyku engelle: %s'), ad), ayrinti: _('Ekran kapanmaz, bilgisayar uykuya geçmez')},
                eylem: () => this._uyku.ac(kip)}));
            k.secili(this._uyku.kip === kip);
        }
        if (this._uyku.acik) {
            iz.ekle(new Karo({ikon: 'window-close-symbolic', etiket: _('Kapat'), ipucu: _('Uyku engellemeyi kapat'),
                eylem: () => {
                    this._uyku.kapat();
                    this._altKapat();
                }}));
        }
        const kalan = this._uyku.bitis ? f(_(' · %s kaldı'), saatDakika(this._uyku.bitis - Date.now())) : '';
        this._alt.add_child(bolum(this._uyku.acik ? f(_('Uyku engelli%s'), kalan) : _('Uyku engelleme: ne kadar süre?'), iz));
    }

    _uykuIpucu() {
        if (!this._uyku.acik)
            return {baslik: _('Uyku engelle'), ayrinti: _('Ekran kapanmasın, bilgisayar uyumasın: süresiz, 1–2 saat ya da video oynarken')};
        const kalan = this._uyku.bitis ? f(_(' · %s kaldı'), saatDakika(this._uyku.bitis - Date.now())) : '';
        return {baslik: _('Uyku engelli'), ayrinti: `${UYKU_KIPLERI().find(k => k[0] === this._uyku.kip)?.[1]}${kalan}`};
    }

    // ---------- panik: onaylı ----------
    _panikIpucu() {
        const onay = this._o.ayarlar.get_string('panik-onay') === 'basili' ? _('0,6 sn basılı tut') : _('iki kez tıkla');
        return {baslik: _('Panik'), ayrinti: f(_('Pencereleri küçültür, sesi kapatır, ekranı kilitler. Onay: %s. '), onay) +
            _('Geri almak için "Geri al".')};
    }

    _panikBas() {
        // 'basili' kipinde işlem basılı tutmayla yapılır (_basiliBagla); tık sadece 'cift' kipindedir
        if (this._o.ayarlar.get_string('panik-onay') !== 'cift')
            return;
        if (this._panikOnayId) {
            this._panikOnayIptal();
            this.close();
            this._panik.gizle(true);
            return;
        }
        this._panikKaro.guncelle({etiket: _('Emin misin?')});
        this._panikKaro.secili(true);
        this._panikOnayId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
            this._panikOnayId = 0;
            this._panikOnayIptal();
            return GLib.SOURCE_REMOVE;
        });
    }

    _panikOnayIptal() {
        if (this._panikOnayId)
            GLib.source_remove(this._panikOnayId);
        this._panikOnayId = 0;
        this._panikKaro.guncelle({etiket: _('Panik')});
        this._panikKaro.secili(false);
    }

    _basiliBagla() {
        const a = this._panikKaro.actor;
        a.connect('button-press-event', () => {
            if (this._o.ayarlar.get_string('panik-onay') !== 'basili')
                return Clutter.EVENT_PROPAGATE;
            this._panikKaro.guncelle({etiket: _('Tut…')});
            this._basiliId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 600, () => {
                this._basiliId = 0;
                this._panikOnayIptal();
                this.close();
                this._panik.gizle(true);
                return GLib.SOURCE_REMOVE;
            });
            return Clutter.EVENT_PROPAGATE;
        });
        a.connect('button-release-event', () => {
            if (this._basiliId) {
                GLib.source_remove(this._basiliId);
                this._basiliId = 0;
                this._panikOnayIptal();
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    destroy() {
        this._detay?.destroy();
        this._cubuklar.destroy();
        this._uygKapat();
        for (const id of [this._panikOnayId, this._basiliId, this._ayarBekleId]) {
            if (id)
                GLib.source_remove(id);
        }
        this._panikOnayId = this._basiliId = 0;
        this._abonelikler.forEach(f => f());
        this._o.ayarlar.disconnect(this._ayarId);
        super.destroy();
    }
}
