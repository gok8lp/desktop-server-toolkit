// FLUGEL Island — üst çubukta sadece Island kalsın.
// Etkinlikler düğmesi, saat/takvim, Hızlı Ayarlar (pil, ses, ağ) ve diğer göstergeler görünmez ve sıfır
// genişlikte yapılır ama YERİNDE kalır: böylece Super+S (Hızlı Ayarlar), Super+V (takvim/bildirimler) gibi
// kısayollar ve GNOME'un ses/parlaklık göstergesi çalışmaya devam eder. Hızlı Ayarlar ve takvim menüleri
// Island'ın altında açılır (kaynak aktörleri adanın çapasıdır). Arka plan uygulama simgelerini tepsi.js alır.
// Üst çubuğun kendisi de (şeffaf, tam genişlikte şerit) yer kaplamaz: ekran alanı ayırmaz, tıklama yakalamaz,
// görünmez. Böylece büyütülmüş pencereler ekranın en üstüne kadar uzanır; ada onlarla çakışınca çentik olur.
// Eklenti kapanınca ya da 'ust-cubuk-sade' kapatılınca her şey eski haline döner.
import St from 'gi://St';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const tepsiSimgesiMi = c => Object.keys(Main.panel.statusArea).some(k =>
    k.startsWith('appindicator-') && Main.panel.statusArea[k]?.container === c);

export class UstCubuk {
    constructor(ayarlar, capa) {
        this._ayar = ayarlar;
        this._capa = capa;
        this._gizli = new Map();      // kap → {opacity, genislik}
        this._menuler = new Map();    // menü → {kaynak, hiza}
        this._sinyaller = [];
        this._bekleyen = new Set();
    }

    enable() {
        this._ayarId = this._ayar.connect('changed::ust-cubuk-sade', () => this._uygula());
        this._uygula();
    }

    _uygula() {
        this._geriAl();
        if (!this._ayar.get_boolean('ust-cubuk-sade'))
            return;
        Main.panel.add_style_class_name('flugel-sade-panel');
        this._seridiBosalt();
        const kutular = [Main.panel._leftBox, Main.panel._centerBox, Main.panel._rightBox];
        for (const kutu of kutular) {
            kutu.get_children().forEach(c => this._gizle(c));
            // sonradan eklenen göstergeler (klavye düzeni, ekran kaydı…) de gizlenir; tepsi simgeleri tepsiye gider
            this._sinyaller.push([kutu, kutu.connect('child-added', (_k, c) => {
                const id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    this._bekleyen.delete(id);
                    if (c.get_parent() === kutu)
                        this._gizle(c);
                    return GLib.SOURCE_REMOVE;
                });
                this._bekleyen.add(id);
            })]);
        }
        // menüler adanın altında, ortalı açılır
        for (const ind of [Main.panel.statusArea.quickSettings, Main.panel.statusArea.dateMenu]) {
            const menu = ind?.menu;
            if (!menu || this._menuler.has(menu))
                continue;
            this._menuler.set(menu, {kaynak: menu.sourceActor, hiza: menu._arrowAlignment});
            menu.sourceActor = this._capa;
            menu._arrowAlignment = 0.5;
        }
    }

    _gizle(c) {
        if (tepsiSimgesiMi(c))
            return;
        // içteki bütün St öğelerinin dolgusu sıfırlanır: sıfır genişlikte negatif boyut uyarısı (Clutter) çıkmasın
        const icler = [];
        const gez = a => {
            for (const k of a.get_children()) {
                if (k instanceof St.Widget)
                    icler.push(k);
                gez(k);
            }
        };
        gez(c);
        if (!this._gizli.has(c))
            this._gizli.set(c, {opacity: c.opacity, genislik: c.width_set ? c.width : -1, stiller: icler.map(k => [k, k.style])});
        // görünür (mapped) kalır ki Super+S / Super+V gibi kısayollar çalışsın: saydam, sıfır genişlik, dolgusuz.
        // GNOME bir kabı yeniden eklerse (oturum kipi değişince) child-added ile tekrar uygulanır.
        c.opacity = 0;
        c.set_width(0);
        // Etkinlikler düğmesinin kısayolu yok (Super tuşu ondan bağımsız): tamamen gizlenir; çalışma alanı
        // noktaları sıfır genişliğe sığmayıp Clutter uyarısı üretmesin
        if (c === Main.panel.statusArea.activities?.container)
            c.hide();
        // PanelMenu.ButtonBox içeriğini -natural/-minimum-hpadding kadar içeriden yerleştirir; sıfır genişlikte negatif olmasın
        for (const k of icler)
            k.style = 'padding: 0; margin: 0; spacing: 0; border-width: 0; min-width: 0; -natural-hpadding: 0px; -minimum-hpadding: 0px;';
    }

    _seridiBosalt() {
        const lm = Main.layoutManager;
        const kayit = lm._trackedActors?.find(a => a.actor === lm.panelBox);
        if (!kayit)
            return;
        this._serit = {kayit, struts: kayit.affectsStruts, girdi: kayit.affectsInputRegion, tamEkran: kayit.trackFullscreen,
            gorunur: lm.panelBox.visible};
        kayit.affectsStruts = false;
        kayit.affectsInputRegion = false;
        kayit.trackFullscreen = false;   // tam ekrandan çıkınca GNOME şeridi geri göstermesin
        lm.panelBox.hide();
        lm._queueUpdateRegions();
    }

    _seridiGeriVer() {
        if (!this._serit)
            return;
        const {kayit, struts, girdi, tamEkran, gorunur} = this._serit;
        this._serit = null;
        kayit.affectsStruts = struts;
        kayit.affectsInputRegion = girdi;
        kayit.trackFullscreen = tamEkran;
        Main.layoutManager.panelBox.visible = gorunur;
        Main.layoutManager._queueUpdateRegions();
    }

    _geriAl() {
        this._seridiGeriVer();
        for (const id of this._bekleyen)
            GLib.source_remove(id);
        this._bekleyen.clear();
        for (const [kutu, id] of this._sinyaller)
            kutu.disconnect(id);
        this._sinyaller = [];
        for (const [c, eski] of this._gizli) {
            c.opacity = eski.opacity;
            c.set_width(eski.genislik);
            if (c === Main.panel.statusArea.activities?.container)
                c.show();
            for (const [k, stil] of eski.stiller ?? []) {
                try {
                    k.style = stil;
                } catch (e) {
                    // GNOME o öğeyi bu arada yok etmiş olabilir
                }
            }
        }
        this._gizli.clear();
        for (const [menu, eski] of this._menuler) {
            menu.close();
            menu.sourceActor = eski.kaynak;
            menu._arrowAlignment = eski.hiza;
        }
        this._menuler.clear();
        Main.panel.remove_style_class_name('flugel-sade-panel');
    }

    // kart başlığındaki düğmeler için
    hizliAyarlar() {
        Main.panel.toggleQuickSettings();
    }

    takvim() {
        Main.panel.toggleCalendar();
    }

    etkinlikler() {
        Main.overview.toggle();
    }

    disable() {
        if (this._ayarId)
            this._ayar.disconnect(this._ayarId);
        this._ayarId = 0;
        this._geriAl();
    }
}
