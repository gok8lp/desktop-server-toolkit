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
import {Karo, Izgara, bolum} from '../bilesenler.js';
import {sabitKarolar} from '../uygulamalar.js';
import {UYKU_KIPLERI} from '../uyku.js';

function surecOldur(pid, ad) {
    if (!pid || pid <= 1)
        return;
    // önce kibarca (TERM), 2 sn sonra hâlâ açıksa alt süreçleriyle birlikte KILL
    bash(`kill -TERM ${pid} 2>/dev/null; pkill -TERM -P ${pid} 2>/dev/null; sleep 2; ` +
         `if kill -0 ${pid} 2>/dev/null; then pkill -KILL -P ${pid}; kill -KILL ${pid}; fi`);
    Main.notify('Zorla kapatılıyor', ad);
}

const saatDakika = ms => {
    const dk = Math.max(1, Math.round(ms / 60000));
    return dk >= 60 ? `${Math.floor(dk / 60)} sa ${dk % 60} dk` : `${dk} dk`;
};

export class HizliSayfa extends Sayfa {
    constructor(o) {
        super();
        this._o = o;
        this._panik = o.panik;
        this._uyku = o.uyku;
        this._genislik = o.ayarlar.get_int('kart-genislik') - 48;

        this._sabit = new Izgara({genislik: this._genislik, karoGenisligi: 84});
        this.actor.add_child(bolum('Uygulamalar', this._sabit));
        this._sabitYaz();
        this._ayarId = o.ayarlar.connect('changed::sabit-uygulamalar', () => this._sabitYaz());

        const araclar = new Izgara({genislik: this._genislik, karoGenisligi: 84});
        this._zorla = araclar.ekle(new Karo({ikon: 'kapat-daire', etiket: 'Zorla kapat',
            ipucu: {baslik: 'Zorla kapat', ayrinti: 'Donan uygulamayı seç: önce kibarca, 2 sn sonra zorla kapatılır'},
            eylem: () => this._ac('zorla')}));
        this._panikKaro = araclar.ekle(new Karo({ikon: 'kalkan', etiket: 'Panik',
            ipucu: () => this._panikIpucu(), eylem: () => this._panikBas()}));
        this._basiliBagla();
        this._uykuKaro = araclar.ekle(new Karo({ikon: 'fincan', etiket: 'Uyku engelle',
            ipucu: () => this._uykuIpucu(), eylem: () => this._ac('uyku')}));
        araclar.ekle(new Karo({ikon: 'camera-photo-symbolic', etiket: 'Görüntü',
            ipucu: {baslik: 'Ekran görüntüsü', ayrinti: 'Alan, pencere ya da tüm ekran (Print, Shift+Super+S)'},
            eylem: () => {
                this.close();
                ekranGoruntusu();
            }}));
        araclar.ekle(new Karo({ikon: 'camera-video-symbolic', etiket: 'Kayıt',
            ipucu: {baslik: 'Ekran kaydı', ayrinti: 'Kooha: MP4 ya da GIF'},
            eylem: () => {
                this.close();
                calistir('kooha');
            }}));
        this._geriKaro = araclar.ekle(new Karo({ikon: 'edit-undo-symbolic', etiket: 'Geri al',
            ipucu: {baslik: 'Paniği geri al', ayrinti: 'Gizlenen pencereler ve ses geri gelir'},
            eylem: () => this._panik.geriAl()}));
        this.actor.add_child(bolum('Araçlar', araclar));

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
    }

    goster() {
        this._durumYaz();
    }

    kapandi() {
        super.kapandi();
        this._altKapat();
        this._panikOnayIptal();
    }

    _durumYaz() {
        this._geriKaro.actor.visible = this._panik.aktif;
        this._uykuKaro.secili(this._uyku.acik);
        this._uykuKaro.nokta(this._uyku.acik ? 'acik' : null);
        this._uykuKaro.guncelle({etiket: this._uyku.acik ? (this._uyku.kip === 'video' ? 'Video' : 'Uyanık') : 'Uyku engelle'});
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
                ipucu: {baslik: `${ad}: zorla kapat`, ayrinti: (w.get_title() || '').slice(0, 80)},
                eylem: () => {
                    this.close();
                    surecOldur(pid, ad);
                }}));
        }
        iz.ekle(new Karo({ikon: 'eclipse', etiket: 'Eclipse', ipucu: 'Eclipse\'i zorla kapat', eylem: () => {
            this.close();
            bash("pkill -TERM -f 'org.eclipse.equinox.launcher|snap/eclipse/.*/eclipse'; sleep 2; pkill -KILL -f 'org.eclipse.equinox.launcher|snap/eclipse/.*/eclipse'");
            Main.notify('Zorla kapatılıyor', 'Eclipse');
        }}));
        iz.ekle(new Karo({ikon: 'web-browser-symbolic', etiket: 'Chrome', ipucu: 'Chrome\'u zorla kapat', eylem: () => {
            this.close();
            bash('pkill -TERM -x chrome; sleep 2; pkill -KILL -x chrome');
            Main.notify('Zorla kapatılıyor', 'Chrome');
        }}));
        iz.ekle(new Karo({ikon: 'utilities-system-monitor-symbolic', etiket: 'Tüm süreçler', ipucu: 'Sistem İzleyici',
            eylem: () => {
                this.close();
                calistir('gnome-system-monitor -p');
            }}));
        this._alt.add_child(bolum(gorulen.size ? 'Hangi uygulama dondu?' : 'Açık pencere yok', iz));
    }

    _uykuPaneli() {
        this._alt.destroy_all_children();
        const iz = new Izgara({genislik: this._genislik, karoGenisligi: 104});
        for (const [kip, ad] of UYKU_KIPLERI) {
            const k = iz.ekle(new Karo({ikon: kip === 'video' ? 'media-playback-start-symbolic' : 'fincan', etiket: ad,
                ipucu: {baslik: `Uyku engelle: ${ad}`, ayrinti: 'Ekran kapanmaz, bilgisayar uykuya geçmez'},
                eylem: () => this._uyku.ac(kip)}));
            k.secili(this._uyku.kip === kip);
        }
        if (this._uyku.acik) {
            iz.ekle(new Karo({ikon: 'window-close-symbolic', etiket: 'Kapat', ipucu: 'Uyku engellemeyi kapat',
                eylem: () => {
                    this._uyku.kapat();
                    this._altKapat();
                }}));
        }
        const kalan = this._uyku.bitis ? ` · ${saatDakika(this._uyku.bitis - Date.now())} kaldı` : '';
        this._alt.add_child(bolum(this._uyku.acik ? `Uyku engelli${kalan}` : 'Uyku engelleme: ne kadar süre?', iz));
    }

    _uykuIpucu() {
        if (!this._uyku.acik)
            return {baslik: 'Uyku engelle', ayrinti: 'Ekran kapanmasın, bilgisayar uyumasın: süresiz, 1–2 saat ya da video oynarken'};
        const kalan = this._uyku.bitis ? ` · ${saatDakika(this._uyku.bitis - Date.now())} kaldı` : '';
        return {baslik: 'Uyku engelli', ayrinti: `${UYKU_KIPLERI.find(k => k[0] === this._uyku.kip)?.[1]}${kalan}`};
    }

    // ---------- panik: onaylı ----------
    _panikIpucu() {
        const onay = this._o.ayarlar.get_string('panik-onay') === 'basili' ? '0,6 sn basılı tut' : 'iki kez tıkla';
        return {baslik: 'Panik', ayrinti: `Pencereleri küçültür, sesi kapatır, ekranı kilitler. Onay: ${onay}. ` +
            'Geri almak için "Geri al".'};
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
        this._panikKaro.guncelle({etiket: 'Emin misin?'});
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
        this._panikKaro.guncelle({etiket: 'Panik'});
        this._panikKaro.secili(false);
    }

    _basiliBagla() {
        const a = this._panikKaro.actor;
        a.connect('button-press-event', () => {
            if (this._o.ayarlar.get_string('panik-onay') !== 'basili')
                return Clutter.EVENT_PROPAGATE;
            this._panikKaro.guncelle({etiket: 'Tut…'});
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
        for (const id of [this._panikOnayId, this._basiliId]) {
            if (id)
                GLib.source_remove(id);
        }
        this._panikOnayId = this._basiliId = 0;
        this._abonelikler.forEach(f => f());
        this._o.ayarlar.disconnect(this._ayarId);
        super.destroy();
    }
}
