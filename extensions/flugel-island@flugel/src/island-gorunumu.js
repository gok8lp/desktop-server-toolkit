// FLUGEL Island — ada görünümü.
// Üst çubuğun ortasında, panelin hemen üstünde ayrı bir "chrome" katmanı olarak yaşar (fikir: HIMURAw).
// Dört durum: boşta (saat + iki mini gösterge), kompakt (bir etkinlik), bölünmüş (ana + ikinci balon),
// genişletilmiş (sekmeli büyük kart). Genişlik/yükseklik/köşe yarıçapı tek bir yay ilerlemesiyle birlikte
// değişir; içerik çapraz solmayla (crossfade) yer değiştirir. Tam ekran pencere varken gizlenir.
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import GnomeDesktop from 'gi://GnomeDesktop';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {springProgress} from './spring.js';
import {TamEkranBirlikte} from './tam-ekran.js';
import {Kacis} from './kacis.js';
import {Animasyon} from './sayfalar/sayfa.js';
import {CalismaAlanlari} from './calisma-alanlari.js';
import {EtkinlikGorunumu} from './etkinlik-gorunumu.js';
import {ikon, KAPSUL_RGB, KART_RGB} from './ortak.js';

const SOLMA_CIKIS = 110, SOLMA_GIRIS = 200;
const lerp = (a, b, p) => a + (b - a) * p;

export class IslandGorunumu {
    constructor({ayarlar, yonetici, kart, ekip}) {
        this._ayar = ayarlar;
        this._yonetici = yonetici;
        this._kart = kart;
        this._ekip = ekip;
        this._g = {w: 0, h: 0, r: 0};
        this._durum = null;
        this._kompaktAnahtar = null;
        this._zamanlar = new Set();

        // ana kapsül
        this._kok = new St.Widget({name: 'flugelIsland', style_class: 'flugel-island', reactive: true, track_hover: true,
            layout_manager: new Clutter.BinLayout(), accessible_name: 'FLUGEL Island'});
        this._zemin = new St.Widget({style_class: 'flugel-island-zemin', x_expand: true, y_expand: true});
        this._icerik = new St.Widget({layout_manager: new Clutter.BinLayout(), x_expand: true, y_expand: true,
            clip_to_allocation: true});
        this._kok.add_child(this._zemin);
        this._kok.add_child(this._icerik);

        this._kompakt = new St.Widget({layout_manager: new Clutter.BinLayout(), x_expand: true,
            y_align: Clutter.ActorAlign.START});
        this._icerik.add_child(this._kompakt);
        this._kartKutu = new St.Bin({child: kart.actor, x_expand: true, x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START, visible: false});
        this._icerik.add_child(this._kartKutu);

        // boştaki içerik: [karakter] [sunucu] saat [pil]
        this._bos = new St.BoxLayout({style_class: 'flugel-bos', x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER});
        this._bosSol = new St.BoxLayout({style_class: 'flugel-mini-kutu', y_align: Clutter.ActorAlign.CENTER});
        this._saat = new St.Label({style_class: 'flugel-saat', y_align: Clutter.ActorAlign.CENTER});
        this._bosSag = new St.BoxLayout({style_class: 'flugel-mini-kutu', y_align: Clutter.ActorAlign.CENTER});
        // çalışma alanları kapsülün solunda kalıcı yerinde (tek alan varsa gizli)
        this._caMini = new CalismaAlanlari({mini: true});
        this._caIdler = ['notify::n-workspaces'].map(sinyal => global.workspace_manager.connect(sinyal, () => this._caGorunur()));
        this._caGorunur();
        for (const c of [this._caMini.actor, this._bosSol, this._saat, this._bosSag])
            this._bos.add_child(c);

        // ikinci balon (bölünmüş durum)
        this._balon = new St.Widget({style_class: 'flugel-island flugel-balon', reactive: true, track_hover: true,
            layout_manager: new Clutter.BinLayout(), visible: false, opacity: 0});
        this._balonZemin = new St.Widget({style_class: 'flugel-island-zemin', x_expand: true, y_expand: true});
        this._balonGorunum = new EtkinlikGorunumu('balon');
        this._balonGorunum.actor.x_align = Clutter.ActorAlign.CENTER;
        this._balon.add_child(this._balonZemin);
        this._balon.add_child(this._balonGorunum.actor);

        // menü çapası: Hızlı Ayarlar ve takvim bunun altında (kapsülün altında, ortada) açılır
        this.capa = new St.Widget({opacity: 0, reactive: false, width: 2});
        Main.layoutManager.uiGroup.add_child(this.capa);

        for (const a of [this._kok, this._balon]) {
            // tam ekranı ada kendisi yönetir (çentik kipi); GNOME'un otomatik gizlemesi kullanılmaz
            Main.layoutManager.addChrome(a, {affectsStruts: false, trackFullscreen: false});
            // panelin hemen üstü; açılır menüler ve sistem pencereleri (parola, kapatma) yine üstte kalır
            Main.layoutManager.uiGroup.set_child_above_sibling(a, Main.layoutManager.panelBox);
        }

        this._saatKaynagi = new GnomeDesktop.WallClock({time_only: true});
        this._saatId = this._saatKaynagi.connect('notify::clock', () => this._saatYaz());
        this._saatYaz();
        // çentik altında önemli bir şey varken (yazı imleci, sürükleme, kısayol) ada yukarı çekilir
        const ada = this;
        this._kacis = new Kacis(this._ayar, {
            get kok() {
                return ada._kok;
            },
            monitor: () => this._monitor(),
            cekil: c => this._cekil(c),
            kartAcik: () => this._durum === 'genis',
        });
        // kabuk kapanırken aktörler eklenti kapatılmadan yok edilir: saat sinyali ölü etikete dokunmasın
        this._kok.connect('destroy', () => this._saatBirak());

        this._kok.connect('notify::hover', () => this._hoverDegisti());
        this._kok.connect('notify::visible', () => this._kavisYerlestir());
        this._balon.connect('notify::hover', () => this._hoverDegisti());
        this._kok.connect('button-release-event', (_a, e) => this._tiklandi(e));
        // kapsül üzerinde tekerlek: çalışma alanı değiştir (kart açıkken sayfa kayar, karışmaz)
        // Dokunmatik yüzey: kapsülün üzerine gelip hemen kaydırınca kart açılmaz (açılma iptal edilir, kaydırma
        // bitene kadar beklenir); kart açıkken de üst şeritte (saat, çalışma alanı noktaları) kaydırmak geçiş yapar.
        this._kok.connect('scroll-event', (_a, olay) => {
            if (this._durum === 'genis') {
                const [x, y] = olay.get_coords();
                const e = this._kart.ustSerit?.get_transformed_extents();
                const ustte = e && x >= e.origin.x && x <= e.origin.x + e.size.width && y >= e.origin.y && y <= e.origin.y + e.size.height;
                return ustte ? this._kart.calismaAlanlari.kaydir(olay) : Clutter.EVENT_PROPAGATE;
            }
            this._kaydirmaSon = GLib.get_monotonic_time();
            // açılma zamanlayıcısı yeniden kurulur: kaydırma bitip imleç kalırsa kart yine açılır
            this._hoverDegisti();
            return this._kart.calismaAlanlari.kaydir(olay);
        });
        // 5 hızlı tık → Re:Zero sürprizi
        this._kok.connect('button-press-event', () => {
            this._ekip.tik();
            return Clutter.EVENT_PROPAGATE;
        });
        ekip.baglan(this._kok);
        this._balon.connect('button-release-event', (_a, e) => this._tiklandi(e));
        this._monitorId = Main.layoutManager.connect('monitors-changed', () => this._yerlestir(true));
        this._panelId = Main.panel.connect('notify::height', () => this._yerlestir(true));
        this._ayarId = this._ayar.connect('changed', (_s, k) => {
            if (k === 'tam-ekran-kipi')
                this._uygula(this._vm ?? this._yonetici._lastVM);
            if (['saydamlik', 'kart-saydamlik', 'genislik-carpani', 'kart-genislik', 'monitor'].includes(k))
                this._yerlestir(true);
        });
        this._kart.kapatIstendi = () => this.daralt();
        this._kart.sabitleIstendi = () => this._yonetici.setPinned(!this._yonetici.isPinned());
        this._kart.boyutDegisti = () => this._kartBoyutu();
        this._kart.disMenuKapandi = () => this._hoverDegisti();

        // ---------- tam ekran: çentik kipi ----------
        // Tam ekranda ada kaybolmaz; ekranın üst kenarına yapışık bir çentik olur. Normalde gizlidir; fare üst
        // ortadaki ince sıcak bölgeye gelince, bir bildirim/ses/parlaklık gelince ya da (ayarla) canlı etkinlik
        // varken kenardan aşağı kayar. Görünürken kompozitörün doğrudan taraması (unredirect) kapatılır ki
        // oyun/video üstünde çizilebilsin; gizlenince geri açılır.
        this._te = {aktif: false, acik: false, unred: false};
        // "birlikte" kipi: tam ekran uygulama adanın şeridinin altına küçülür, ada görünür kalır (tam-ekran.js)
        this._birlikte = new TamEkranBirlikte();
        this._sicak = new St.Widget({reactive: true, track_hover: true, opacity: 0, visible: false, name: 'flugelSicakBolge'});
        Main.layoutManager.addChrome(this._sicak, {affectsStruts: false, trackFullscreen: false});
        this._sicak.connect('notify::hover', () => this._sicakHover());
        this._teIdler = [
            [global.display, global.display.connect('in-fullscreen-changed', () => this._tamEkranDenetle())],
            [Main.overview, Main.overview.connect('showing', () => this._tamEkranDenetle())],
            [Main.overview, Main.overview.connect('hidden', () => this._tamEkranDenetle())],
            // bir pencere adanın durduğu üst orta bölgeye gelince (büyütülmüş tarayıcı vb.) de çentik olur
            ...['restacked', 'window-created', 'grab-op-end'].map(s => [global.display, global.display.connect(s, () => this._kaplamaPlanla())]),
            ...['size-changed', 'minimize', 'unminimize', 'map', 'destroy'].map(s =>
                [global.window_manager, global.window_manager.connect(s, () => this._kaplamaPlanla())]),
            [global.workspace_manager, global.workspace_manager.connect('active-workspace-changed', () => this._kaplamaPlanla())],
            [this._ayar, this._ayar.connect('changed::pencere-centik', () => this._tamEkranDenetle())],
            [this._ayar, this._ayar.connect('changed::tam-ekran-kipi', () => this._tamEkranDenetle())],
            [this._ayar, this._ayar.connect('changed::ust-serit', () => this._tamEkranDenetle())],
        ];

        this._abonelik = this._yonetici.subscribe(vm => this._uygula(vm));
        this._tamEkranDenetle();
        this._zaman(4000, () => this._isit());
    }

    // ---------- yerleşim ----------
    get _s() {
        return St.ThemeContext.get_for_stage(global.stage).scale_factor;
    }

    _monitor() {
        const i = this._ayar.get_int('monitor');
        const ms = Main.layoutManager.monitors;
        return (i >= 0 && i < ms.length ? ms[i] : Main.layoutManager.primaryMonitor) ?? ms[0];
    }

    _kapsulYuksekligi() {
        const s = this._s;
        const panel = Main.panel.height || Math.round(32 * s);
        return Math.max(Math.round(20 * s), panel - 2 * Math.round(3 * s));
    }

    _ustY() {
        const m = this._monitor();
        if (this._te?.aktif || this._centik)
            return m.y;    // çentik: üst kenara yapışık
        return m.y + Math.round((Main.panel.height - this._kapsulYuksekligi()) / 2);
    }

    _kartGenisligi() {
        const m = this._monitor();
        return Math.min(Math.round(this._ayar.get_int('kart-genislik') * this._s), m.width - Math.round(24 * this._s));
    }

    _hedef(gorunum) {
        const s = this._s;
        const h = this._kapsulYuksekligi();
        if (gorunum === 'genis') {
            const w = this._kartGenisligi();
            this._kart.actor.set_width(w);
            const [, kh] = this._kart.actor.get_preferred_height(w);
            const azami = Math.round(this._monitor().height * 0.86);
            return {w, h: Math.min(Math.max(kh, h * 3), azami), r: Math.round(26 * s)};
        }
        // sadece gelen içerik ölçülür (solarak giden eski içerik genişliği şişirmesin)
        const icerik = this._aktifIcerik ?? this._kompakt;
        if (gorunum === 'bildirim') {
            // afiş: kapsülden aşağı doğru büyür, içerik kadar yüksek
            const w = Math.round(Math.min(520 * s, this._monitor().width - 24 * s));
            const [, ih] = icerik.get_preferred_height(w);
            return {w, h: Math.max(h * 2, Math.ceil(ih)), r: Math.round(22 * s)};
        }
        const [, dogal] = icerik.get_preferred_width(h);
        const carpan = this._ayar.get_double('genislik-carpani');
        const enAz = Math.round((gorunum === 'bos' ? 132 : 180) * s * carpan);
        // canlı maçta takımlar kesilmeden görünsün diye kapsül daha geniş olabilir
        const macVar = !!(this._vm?.leading ?? this._vm?.trailing)?.data?.mac && gorunum === 'kompakt';
        const enCok = Math.round((gorunum === 'flas' ? 520 : macVar ? 660 : 440) * s * carpan);
        return {w: Math.max(enAz, Math.min(enCok, Math.ceil(dogal))), h, r: h / 2};
    }

    _geoUygula(g) {
        this._g = g;
        const m = this._monitor();
        const w = Math.max(1, Math.round(g.w)), h = Math.max(1, Math.round(g.h));
        this._kok.set_size(w, h);
        this._kok.set_position(Math.round(m.x + (m.width - w) / 2), this._ustY());
        this._kompakt.set_height(this._durum === 'bildirim' ? -1 : this._kapsulYuksekligi());
        this.capa.set_size(2, this._kapsulYuksekligi());
        this.capa.set_position(Math.round(m.x + m.width / 2 - 1), this._ustY());
        // kapsül siyahından kartın nötr camına, yükseklikle orantılı geçiş
        const kh = this._kapsulYuksekligi();
        const t = Math.round(10 * Math.max(0, Math.min(1, (h - kh) / Math.max(1, kh * 3)))) / 10;
        this._radiusYaz(this._zemin, Math.max(0, Math.min(g.r, h / 2)), t);
        this._kavisYerlestir();
        this._balonYerlestir();
    }

    _radiusYaz(zemin, r, t = 0) {
        const css = Math.round(r / this._s);
        const a0 = this._ayar.get_int('saydamlik') / 100, a1 = this._ayar.get_int('kart-saydamlik') / 100;
        const [cr, cg, cb] = KAPSUL_RGB.map((v, i) => Math.round(v + (KART_RGB[i] - v) * t));
        const alfa = (a0 + (a1 - a0) * t).toFixed(2);
        // tam ekranda çentik: üst köşeler düz, alt köşeler yuvarlak, tam siyah
        const centik = this._te?.aktif || this._centik;
        const kose = centik ? `0px 0px ${css}px ${css}px` : `${css}px`;
        // çentikte kapsül tam siyah (ekranın bir parçası gibi); kart açılınca yine nötr cama geçer
        // çentikte kenarlık yok: üst kenarda gri bir piksel çizgisi kalmasın, ekranın siyahına kesintisiz bağlansın
        const stil = centik && t === 0 ? `border-radius: ${kose}; border-width: 0; background-color: rgba(0,0,0,1);`
            : centik ? `border-radius: ${kose}; border-width: 0; background-color: rgba(${cr},${cg},${cb},${Math.max(0.97, alfa)});`
            : `border-radius: ${kose}; background-color: rgba(${cr},${cg},${cb},${alfa});`;
        if (zemin.style !== stil)
            zemin.style = stil;
    }

    _balonYerlestir() {
        if (!this._balon.visible)
            return;
        const h = this._kapsulYuksekligi();
        // balonun kendisi sabit boyutlu olduğundan içeriği ölçülür
        const [, dogal] = this._balonGorunum.actor.get_preferred_width(h);
        const w = Math.max(h, Math.ceil(dogal));
        this._balon.set_size(w, h);
        this._balon.set_position(this._kok.x + this._kok.width + Math.round(6 * this._s), this._ustY());
        this._radiusYaz(this._balonZemin, h / 2);
    }

    _yerlestir(anlik = false) {
        if (!this._durum)
            return;
        const hedef = this._hedef(this._durum);
        if (anlik) {
            this._yay?.stop();
            this._yay = null;
            Animasyon.bitti();
            this._geoUygula(hedef);
        } else {
            this._bicimle(hedef);
        }
    }

    _bicimle(hedef, bitince) {
        const bas = {...this._g};
        const esit = (x, y) => !!x && Math.abs(x.w - y.w) < 0.5 && Math.abs(x.h - y.h) < 0.5 && Math.abs(x.r - y.r) < 0.5;
        // zaten oradaysa ya da zaten oraya gidiyorsa yayı yeniden başlatma
        if ((esit(bas, hedef) && !this._yay) || (this._yay && esit(this._hedefG, hedef))) {
            if (!this._yay)
                bitince?.();
            return;
        }
        this._hedefG = hedef;
        this._yay?.stop();
        if (!bas.w) {
            this._geoUygula(hedef);
            bitince?.();
            return;
        }
        // açılırken hafif yaylanır, kapanırken daha sönümlü (iOS'taki gibi)
        const buyuyor = hedef.h > bas.h + 1 || hedef.w > bas.w + 1;
        const hiz = this._ayar.get_double('animasyon-hizi');
        Animasyon.suruyor = true;
        this._yay = springProgress(this._kok, p => this._geoUygula({
            w: lerp(bas.w, hedef.w, p), h: lerp(bas.h, hedef.h, p), r: lerp(bas.r, hedef.r, Math.min(p, 1)),
        }), {
            response: (buyuyor ? 0.5 : 0.42) / hiz,
            damping: buyuyor ? 0.78 : 0.88,
            onComplete: () => {
                this._yay = null;
                Animasyon.bitti();
                bitince?.();
            },
        });
    }

    // ---------- durum ----------
    _uygula(vm) {
        this._vm = vm;
        let gorunum;
        if (vm.baseState === 'expanded')
            gorunum = 'genis';
        else if (vm.flashing)
            gorunum = vm.flashing.data?.bildirim ? 'bildirim' : 'flas';
        else if (vm.baseState === 'idle')
            gorunum = 'bos';
        else
            gorunum = 'kompakt';

        this._bosGuncelle(vm);
        const onceki = this._durum;
        this._durum = gorunum;
        if (this._te?.aktif) {
            const kip = this._teKip();
            const goster = gorunum === 'genis' || (kip !== 'gizli' && (gorunum === 'flas' || gorunum === 'bildirim')) ||
                (kip === 'canli' && gorunum === 'kompakt');
            if (goster)
                this._teGoster();
            else
                this._teKapatPlanla();
        }

        if (gorunum === 'genis') {
            this._kart.sabitDurumu(vm.pinned);
            this._kart.canliGuncelle(vm.live, vm.ambientOverflow);
            if (onceki !== 'genis')
                this._genislet();
            this._balonGoster(null);
            return;
        }
        if (onceki === 'genis') {
            this._kart.kapandi();
            this._disariyiIzle(false);
        }

        const ana = gorunum === 'flas' || gorunum === 'bildirim' ? vm.flashing : (gorunum === 'bos' ? null : (vm.leading ?? vm.trailing));
        const ikinci = gorunum === 'kompakt' && vm.leading && vm.trailing ? vm.trailing : null;
        this._kompaktGoster(gorunum, ana, onceki === 'genis' || onceki === null);
        this._balonGoster(ikinci);
        this._bicimle(this._hedef(gorunum));
    }

    _kompaktGoster(gorunum, a, kartKapandi) {
        const anahtar = `${gorunum}:${a?.id ?? ''}`;
        if (anahtar === this._kompaktAnahtar && !kartKapandi) {
            this._kompaktGorunum?.guncelle(a);
            return;
        }
        this._kompaktAnahtar = anahtar;
        let yeni;
        if (gorunum === 'bos') {
            yeni = this._bos;
            this._kompaktGorunum = null;
        } else if (gorunum === 'bildirim') {
            this._kompaktGorunum = new EtkinlikGorunumu('bildirim');
            this._kompaktGorunum.guncelle(a);
            yeni = this._kompaktGorunum.actor;
        } else {
            this._kompaktGorunum = new EtkinlikGorunumu(gorunum === 'flas' ? 'flas' : 'kompakt');
            this._kompaktGorunum.guncelle(a);
            // saat her zaman adada: etkinlik gösterilirken de sağda durur
            yeni = new St.BoxLayout({x_expand: true, y_align: Clutter.ActorAlign.CENTER});
            yeni.add_child(this._kompaktGorunum.actor);
            const saat = new St.Label({style_class: 'flugel-kompakt-saat', y_align: Clutter.ActorAlign.CENTER,
                text: GLib.DateTime.new_now_local().format('%H:%M')});
            // içerik değişince eski etiket yok edilir: saat güncellemesi ona dokunmasın
            saat.connect('destroy', () => {
                if (this._kompaktSaat === saat)
                    this._kompaktSaat = null;
            });
            this._kompaktSaat = saat;
            yeni.add_child(this._kompaktSaat);
        }
        // yeni bir etkinlik kapsüle gelince kapsül hafifçe "pıt" eder (kart kapanırken değil)
        if (!kartKapandi && gorunum === 'kompakt' && a && St.Settings.get().enable_animations && this._kok.mapped) {
            this._kok.set_pivot_point(0.5, 0);
            this._kok.ease({scale_x: 1.045, scale_y: 1.045, duration: 110, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => this._kok.ease({scale_x: 1, scale_y: 1, duration: 380, mode: Clutter.AnimationMode.EASE_OUT_BACK})});
        }
        // zaten solarak giden (bir önceki geçişten kalan) aktörlere dokunulmaz; kendi kendilerine kalkarlar
        const eski = this._kompakt.get_children().filter(c => c !== yeni && !c._flugelGidiyor);
        yeni._flugelGidiyor = false;
        this._aktifIcerik = yeni;
        yeni.remove_all_transitions();
        if (!yeni.get_parent())
            this._kompakt.add_child(yeni);
        yeni.opacity = 0;
        yeni.ease({opacity: 255, delay: eski.length ? 60 : 0, duration: SOLMA_GIRIS, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        for (const c of eski) {
            c.remove_all_transitions();
            c._flugelGidiyor = true;
            c.ease({opacity: 0, duration: SOLMA_CIKIS, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onStopped: () => {
                    if (!c._flugelGidiyor)
                        return;
                    c._flugelGidiyor = false;
                    if (c === this._bos)
                        this._kompakt.remove_child(c);
                    else if (c.get_parent())
                        c.destroy();
                }});
        }
        this._kompakt.show();
        this._kompakt.ease({opacity: 255, duration: SOLMA_GIRIS, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        if (kartKapandi) {
            this._kartKutu.ease({opacity: 0, duration: SOLMA_CIKIS, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onStopped: () => {
                    if (this._durum !== 'genis')
                        this._kartKutu.hide();
                }});
        }
    }

    _balonGoster(a) {
        if (a) {
            this._balonGorunum.guncelle(a);
            if (!this._balon.visible) {
                this._balon.show();
                this._balon.set_pivot_point(0, 0.5);
                this._balon.scale_x = this._balon.scale_y = 0.6;
                this._balonYerlestir();
            }
            this._balon.ease({opacity: 255, scale_x: 1, scale_y: 1, duration: 260, mode: Clutter.AnimationMode.EASE_OUT_BACK});
            this._balonYerlestir();
        } else if (this._balon.visible) {
            this._balon.ease({opacity: 0, scale_x: 0.6, scale_y: 0.6, duration: 160, mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onStopped: () => this._balon.hide()});
        }
    }

    _genislet() {
        this._kompaktAnahtar = null;
        this._kart.acildi();
        this._kartKutu.show();
        this._kartKutu.opacity = 0;
        this._kartKutu.ease({opacity: 255, delay: 90, duration: 260, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        this._kompakt.ease({opacity: 0, duration: SOLMA_CIKIS, mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => {
                if (this._durum === 'genis')
                    this._kompakt.hide();
            }});
        this._disariyiIzle(true);
        this._bicimle(this._hedef('genis'));
    }

    // Kartı görünmez (opaklık 0) olarak bir kez açıp her sekmeyi çizer: simgeler, stiller ve menüler önceden
    // hazırlanır, ilk gerçek açılışta takılma olmaz. Kapsül dışına taşan kısım kırpılır, hiçbir şey görünmez.
    _isit() {
        if (this._durum === 'genis' || !this._kok.mapped)
            return;
        this._kartKutu.opacity = 0;
        this._kartKutu.show();
        this._kart.isit(() => {
            if (this._durum !== 'genis')
                this._kartKutu.hide();
        });
    }

    // kart içeriği büyüyüp küçülünce (sekme değişimi, alt menü) ada yayla yeni boyuta gider
    _kartBoyutu() {
        if (this._durum !== 'genis')
            return;
        const hedef = this._hedef('genis');
        if (Math.abs(hedef.h - this._g.h) > 1 || Math.abs(hedef.w - this._g.w) > 1)
            this._bicimle(hedef);
    }

    _bosGuncelle(vm) {
        // mini göstergeler: data.mini işaretli ortam (ambient) etkinlikleri, öncelik sırasıyla en fazla iki tane
        const miniler = vm.ambientOverflow.filter(a => a.data?.mini).sort((x, y) => y.priority - x.priority).slice(0, 3);
        const anahtar = miniler.map(a => `${a.id}:${a.glyph}:${a.data.kisa ?? ''}:${a.data.renk ?? ''}`).join('|');
        if (anahtar === this._miniAnahtar)
            return;
        this._miniAnahtar = anahtar;
        this._bosSol.destroy_all_children();
        this._bosSag.destroy_all_children();
        miniler.forEach((a, i) => {
            // ilk gösterge saatin solunda, diğerleri sağında
            const kutu = i === 0 ? this._bosSol : this._bosSag;
            const simge = new St.Icon({gicon: ikon(a.glyph), icon_size: 14, style_class: 'flugel-mini',
                y_align: Clutter.ActorAlign.CENTER});
            if (a.data.renk)
                simge.style = `color: ${a.data.renk};`;
            kutu.add_child(simge);
            if (a.data.kisa)
                kutu.add_child(new St.Label({text: a.data.kisa, style_class: 'flugel-mini-metin', y_align: Clutter.ActorAlign.CENTER}));
        });
        if (this._durum === 'bos')
            this._bicimle(this._hedef('bos'));
    }

    _saatBirak() {
        if (this._saatKaynagi && this._saatId)
            this._saatKaynagi.disconnect(this._saatId);
        this._saatKaynagi = null;
        this._saatId = 0;
    }

    _caGorunur() {
        this._caMini.actor.visible = global.workspace_manager.n_workspaces > 1;
    }

    _saatYaz() {
        this._saat.text = GLib.DateTime.new_now_local().format('%H:%M');
        if (this._kompaktSaat?.get_stage())
            this._kompaktSaat.text = this._saat.text;
        this._kart.saatYaz?.();
    }

    // ---------- etkileşim ----------
    _zaman(ms, fn) {
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            this._zamanlar.delete(id);
            fn();
            return GLib.SOURCE_REMOVE;
        });
        this._zamanlar.add(id);
        return id;
    }

    _iptal(id) {
        if (id && this._zamanlar.delete(id))
            GLib.source_remove(id);
        return 0;
    }

    get _ustunde() {
        return this._kok.hover || this._balon.hover;
    }

    // ---------- tam ekran (çentik) ----------
    _kaplamaPlanla() {
        if (this._kaplamaId)
            return;
        this._kaplamaId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._kaplamaId = 0;
            this._tamEkranDenetle();
            return GLib.SOURCE_REMOVE;
        });
    }

    // etkin çalışma alanında, adanın monitöründe görünen bir pencere kapsülün durduğu üst orta bölgeye giriyor mu
    _pencereKapliyor(m) {
        // şerit pencerelere bırakıldıysa (ust-serit = gizli) pencereler adanın altına girebilir
        if (!m || !this._ayar.get_boolean('pencere-centik') || this._ayar.get_string('ust-serit') !== 'gizli')
            return false;
        const s = this._s;
        const w = Math.round(480 * s), h = this._kapsulYuksekligi() + Math.round(6 * s);
        const x1 = m.x + (m.width - w) / 2, x2 = x1 + w, y2 = m.y + h;
        const ws = global.workspace_manager.get_active_workspace();
        const turler = [Meta.WindowType.NORMAL, Meta.WindowType.DIALOG, Meta.WindowType.MODAL_DIALOG];
        return global.get_window_actors().some(a => {
            const p = a.meta_window;
            if (!p || p.minimized || !p.showing_on_its_workspace() || !turler.includes(p.get_window_type()))
                return false;
            if (p.get_monitor() !== m.index || !(p.is_on_all_workspaces() || p.get_workspace() === ws))
                return false;
            const r = p.get_frame_rect();
            return r.y < y2 && r.y + r.height > m.y && r.x < x2 && r.x + r.width > x1;
        });
    }

    _tamEkranDenetle() {
        const m = this._monitor();
        const tam = !!m?.inFullscreen;
        const birlikte = tam && this._teKip() === 'birlikte' && !Main.overview.visible;
        if (birlikte)
            this._birlikte.basla(m, Main.panel.height || Math.round(32 * this._s));
        else
            this._birlikte.bitir();
        // çentik kipi: ada ekranın üst kenarına gömülü, hep görünür; pencereler ekranın tamamını kullanır
        const centik = !Main.overview.visible && (tam ? this._teKip() === 'centik' : this._ayar.get_string('ust-serit') === 'centik');
        if (centik !== this._centik) {
            this._centik = centik;
            this._kavisGoster();
            this._yerlestir(true);
        }
        // tam ekran uygulama kompozitörü atlamasın (ada üstünde çizilebilsin)
        if (centik && tam)
            this._unred(true);
        else if (!this._te.aktif)
            this._unred(false);
        const aktif = !Main.overview.visible && !centik && ((tam && !birlikte) || this._pencereKapliyor(m));
        this._te.tam = tam && !birlikte && !centik;
        if (aktif === this._te.aktif)
            return;
        this._te.aktif = aktif;
        const s = this._s;
        this._sicak.set_size(Math.round(360 * s), Math.max(2, Math.round(3 * s)));
        this._sicak.set_position(Math.round(m.x + (m.width - this._sicak.width) / 2), m.y);
        this._sicak.visible = aktif;
        if (aktif) {
            this._yonetici.setPinned(false);
            this._yonetici.setHover(false);
            this._teGizle(true);
        } else {
            this._teGoster(true);
            this._unred(false);
        }
        this._yerlestir(true);
    }

    _teKip() {
        return this._ayar.get_string('tam-ekran-kipi');
    }

    // Çentiğin ekran kenarına bağlandığı yerdeki iç kavisler (MacBook çentiği gibi): kapsülün iki üst yanında,
    // kare içinden çeyrek daire çıkarılmış siyah parçalar. Böylece ada ekranın bir parçasıymış gibi görünür.
    // yol ver: kapsül, balon ve kavisler yukarı kayıp kaybolur; tıklamalar alttaki uygulamaya geçer
    _cekil(cekil) {
        if (cekil === !!this._cekik || !this._kok)
            return;
        this._cekik = cekil;
        const h = this._kok.height + 6;
        const anim = St.Settings.get().enable_animations;
        for (const a of [this._kok, this._balon, this._kavisSol, this._kavisSag]) {
            if (!a)
                continue;
            a.remove_transition('translation-y');
            a.remove_transition('opacity');
            a.reactive = !cekil && a !== this._kavisSol && a !== this._kavisSag;
            if (anim) {
                a.ease({translation_y: cekil ? -h : 0, opacity: cekil ? 0 : 255, duration: cekil ? 170 : 300,
                    mode: cekil ? Clutter.AnimationMode.EASE_IN_QUAD : Clutter.AnimationMode.EASE_OUT_BACK});
            } else {
                a.translation_y = cekil ? -h : 0;
                a.opacity = cekil ? 0 : 255;
            }
        }
    }

    _kavisKur() {
        const s = this._s;
        const r = Math.round(13 * s);
        const yap = sol => {
            const a = new St.DrawingArea({width: r, height: r, reactive: false, visible: false});
            a.connect('repaint', alan => {
                const cr = alan.get_context();
                try {
                    const [w, h] = alan.get_surface_size();
                    cr.setSourceRGBA(0, 0, 0, 1);
                    // siyah bölge: üst kenar + çentiğe bakan kenar + içe kıvrılan çeyrek daire
                    if (sol) {
                        cr.moveTo(0, 0);
                        cr.lineTo(w, 0);
                        cr.lineTo(w, h);
                        cr.arcNegative(0, h, w, 0, -Math.PI / 2);
                    } else {
                        cr.moveTo(w, 0);
                        cr.lineTo(0, 0);
                        cr.lineTo(0, h);
                        cr.arc(w, h, w, Math.PI, 1.5 * Math.PI);
                    }
                    cr.closePath();
                    cr.fill();
                } finally {
                    cr.$dispose();
                }
            });
            Main.layoutManager.addChrome(a, {affectsStruts: false, trackFullscreen: false});
            return a;
        };
        this._kavisR = r;
        this._kavisSol = yap(true);
        this._kavisSag = yap(false);
    }

    _kavisGoster() {
        if (!this._kavisSol)
            this._kavisKur();
        const goster = !!this._centik && this._kok.visible;
        for (const a of [this._kavisSol, this._kavisSag]) {
            a.visible = goster;
            a.queue_repaint();
        }
        this._kavisYerlestir();
    }

    _kavisYerlestir() {
        if (!this._kavisSol)
            return;
        // kapsülle birlikte görünür/gizlenir (çentik kipindeyken)
        const goster = !!this._centik && this._kok.visible && this._kok.opacity > 0;
        if (this._kavisSol.visible !== goster) {
            for (const a of [this._kavisSol, this._kavisSag]) {
                a.visible = goster;
                a.queue_repaint();
            }
        }
        if (!goster)
            return;
        const m = this._monitor();
        const r = this._kavisR;
        this._kavisSol.set_position(this._kok.x - r, m.y);
        this._kavisSag.set_position(this._kok.x + this._kok.width, m.y);
        for (const a of [this._kavisSol, this._kavisSag])
            Main.layoutManager.uiGroup.set_child_above_sibling(a, this._kok);
    }

    _unred(kapat) {
        if (kapat && !this._te.unred) {
            global.compositor.disable_unredirect();
            this._te.unred = true;
        } else if (!kapat && this._te.unred) {
            global.compositor.enable_unredirect();
            this._te.unred = false;
        }
    }

    _teGoster(anlik = false) {
        this._teKapatId = this._iptal(this._teKapatId);
        if (this._te.acik && !anlik)
            return;
        this._te.acik = true;
        for (const a of [this._kok, this._balon]) {
            a.remove_transition('translation-y');
            a.remove_transition('opacity');
        }
        this._kok.show();
        if (!this._te.aktif || anlik || !St.Settings.get().enable_animations) {
            this._kok.translation_y = 0;
            this._kok.opacity = 255;
            return;
        }
        // doğrudan tarama sadece gerçek tam ekranda kapatılır (oyun/video üstüne çizilebilsin)
        if (this._te.tam)
            this._unred(true);
        this._kok.translation_y = -this._kok.height - 4;
        this._kok.opacity = 255;
        this._kok.ease({translation_y: 0, duration: 260, mode: Clutter.AnimationMode.EASE_OUT_BACK});
    }

    _teGizle(anlik = false) {
        this._teKapatId = this._iptal(this._teKapatId);
        if (!this._te.acik && !anlik)
            return;
        this._te.acik = false;
        const bitir = () => {
            if (this._te.acik || !this._te.aktif)
                return;
            this._kok.hide();
            this._balon.hide();
            this._unred(false);
        };
        if (anlik || !St.Settings.get().enable_animations) {
            bitir();
            return;
        }
        this._kok.ease({translation_y: -this._kok.height - 4, duration: 200, mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onStopped: bitir});
        this._balon.ease({opacity: 0, duration: 150, mode: Clutter.AnimationMode.EASE_IN_QUAD});
    }

    _sicakHover() {
        if (!this._te.aktif)
            return;
        if (this._sicak.hover) {
            this._teAcId = this._iptal(this._teAcId);
            // pencere üstündeyken (sekmelere giderken) yanlışlıkla açılmasın diye biraz daha beklenir
            this._teAcId = this._zaman(this._te.tam ? 160 : 380, () => {
                this._teAcId = 0;
                if (this._sicak.hover)
                    this._teGoster();
            });
        } else {
            this._teKapatPlanla();
        }
    }

    // çentik açıkken: fare uzaklaşınca, kart kapalıysa ve gösterilecek bir şey kalmadıysa geri gizlenir
    _teKapatPlanla() {
        if (!this._te.aktif || !this._te.acik)
            return;
        this._teKapatId = this._iptal(this._teKapatId);
        this._teKapatId = this._zaman(900, () => {
            this._teKapatId = 0;
            const kalici = this._teKip() === 'canli' && (this._durum === 'kompakt');
            const mesgul = this._ustunde || this._sicak.hover || this._durum === 'genis' || this._durum === 'flas' ||
                this._durum === 'bildirim' || this._kart.disMenuAcik();
            if (!mesgul && !kalici)
                this._teGizle();
        });
    }

    _hoverDegisti() {
        this._acmaId = this._iptal(this._acmaId);
        this._kapamaId = this._iptal(this._kapamaId);
        if (this._te?.aktif && !this._ustunde)
            this._teKapatPlanla();
        if (this._ustunde) {
            if (this._ayar.get_string('tetik') === 'hover' && this._durum !== 'genis')
            {this._acmaId = this._zaman(this._ayar.get_int('hover-gecikme'), () => {
                this._acmaId = 0;
                // az önce kaydırıldıysa (çalışma alanı değiştiriliyor) kart açılmaz; imleç kalırsa sonra açılır
                if (GLib.get_monotonic_time() - (this._kaydirmaSon ?? 0) < 700000) {
                    this._hoverDegisti();
                    return;
                }
                if (this._ustunde)
                    this._yonetici.setHover(true);
            });}
        } else if (this._yonetici.isHovered()) {
            // dokunmatik yüzeyde imleç kısa süre taşabilir: kart hemen kapanmasın
            this._kapamaId = this._zaman(650, () => {
                this._kapamaId = 0;
                if (!this._ustunde && !this._kart.disMenuAcik())
                    this._yonetici.setHover(false);
            });
        }
    }

    _tiklandi(olay) {
        if (this._durum === 'genis')
            return false;
        const dugme = olay.get_button();
        // bildirim afişi: sol tık açar, sağ tık kapatır
        if (this._durum === 'bildirim') {
            const d = this._vm?.flashing?.data;
            if (dugme === Clutter.BUTTON_SECONDARY)
                d?.kapat?.();
            else
                d?.tikla?.();
            return true;
        }
        if (dugme === Clutter.BUTTON_SECONDARY) {
            const takvim = Main.panel.statusArea.dateMenu;
            if (takvim?.mapped)
                takvim.menu.toggle();
            else
                Main.panel.toggleCalendar?.();
            return true;
        }
        if (dugme === Clutter.BUTTON_PRIMARY) {
            this._acmaId = this._iptal(this._acmaId);
            this._yonetici.setPinned(true);
            return true;
        }
        return false;
    }

    // Kart açıkken: dışarı tıklanınca ya da başka pencere odaklanınca kapanır.
    _disariyiIzle(acik) {
        if (this._disariId) {
            global.stage.disconnect(this._disariId);
            global.display.disconnect(this._odakId);
            this._disariId = this._odakId = 0;
        }
        if (!acik)
            return;
        this._disariId = global.stage.connect('captured-event', (_s, olay) => {
            const tur = olay.type();
            if (tur !== Clutter.EventType.BUTTON_PRESS && tur !== Clutter.EventType.TOUCH_BEGIN)
                return Clutter.EVENT_PROPAGATE;
            if (this._kart.disMenuAcik())
                return Clutter.EVENT_PROPAGATE;
            const kaynak = global.stage.get_event_actor(olay);
            if (!kaynak || (!this._kok.contains(kaynak) && !this._balon.contains(kaynak)))
                this.daralt();
            return Clutter.EVENT_PROPAGATE;
        });
        this._odakId = global.display.connect('notify::focus-window', () => {
            if (global.display.focus_window && !this._kart.disMenuAcik())
                this.daralt();
        });
    }

    daralt() {
        this._acmaId = this._iptal(this._acmaId);
        this._disariyiIzle(false);
        this._yonetici.setPinned(false);
        this._yonetici.setHover(false);
    }

    // takvim/bildirim menüsü açılırken ya da kısayolla
    acKapa() {
        if (this._durum === 'genis')
            this.daralt();
        else
            this._yonetici.setPinned(true);
    }

    get durum() {
        return this._durum;
    }

    // Ses/parlaklık göstergesi adada gösterilebilir mi? (tam ekranda ada gizlidir → GNOME'unki çıkar)
    gorunurMu(monitor) {
        if (!this._kok)
            return false;
        // tam ekranda çentik bildirim/ses için aşağı kayar ('gizli' kipinde hiç göstermez)
        if (this._te?.aktif)
            return this._teKip() !== 'gizli';
        if (!this._kok.visible || !this._kok.mapped)
            return false;
        const i = Main.layoutManager.monitors.indexOf(this._monitor());
        return monitor === undefined || monitor < 0 || monitor === i;
    }

    // ---------- kapanış ----------
    destroy() {
        this._kacis?.destroy();
        this._kacis = null;
        this._kavisSol?.destroy();
        this._kavisSag?.destroy();
        this._kavisSol = this._kavisSag = null;
        this._birlikte?.destroy();
        this._abonelik?.();
        this._yay?.stop();
        Animasyon.bitti();
        this._disariyiIzle(false);
        for (const id of this._zamanlar)
            GLib.source_remove(id);
        this._zamanlar.clear();
        if (this._kaplamaId)
            GLib.source_remove(this._kaplamaId);
        this._kaplamaId = 0;
        this._teIdler.forEach(([n, id]) => n.disconnect(id));
        this._unred(false);
        this._sicak.destroy();
        this._caIdler.forEach(id => global.workspace_manager.disconnect(id));
        this._caMini.destroy();
        this._saatBirak();
        Main.layoutManager.disconnect(this._monitorId);
        Main.panel.disconnect(this._panelId);
        this._ayar.disconnect(this._ayarId);
        // kart, sayfaları ve dış menüleri kendisi temizler; burada sadece ağaçtan ayırıyoruz
        this._kartKutu.set_child(null);
        if (!this._bos.get_parent())
            this._bos.destroy();
        this._kok.destroy();
        this._balon.destroy();
        this.capa.destroy();
        this._kok = this._balon = null;
    }
}
