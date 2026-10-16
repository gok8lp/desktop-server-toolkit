// FLUGEL Island — iOS tarzı buzlu cam ve bulanık geçişler.
//   Cam      : kartın (ve afişin) arkasında, altındaki pencereler ve duvar kağıdı bulanık görünür. Ekranın
//              (pencere katmanının) bir kopyası ada boyutunda kırpılır, bulanıklaştırılır ve köşeleri adanın
//              yarıçapıyla yuvarlatılır (GNOME'un arka plan bulanıklığı köşe tanımadığı için kendi maskemiz).
//              Sadece kart/afiş açıkken çizilir; kapsül iOS'taki gibi tam siyah kalır.
//   bulanikGecis : içerik değişirken eski içerik bulanıklaşıp küçülerek kaybolur, yenisi bulanıktan netleşerek
//              gelir (iOS'ta Dynamic Island'ın içerik geçişi gibi).
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const KANCA = Shell.SnippetHook?.FRAGMENT ?? Cogl.SnippetHook.FRAGMENT;

const KOSE_TANIM = 'uniform vec2 boyut; uniform float yaricap; uniform float ustDuz;';
// yuvarlak dikdörtgenin dışı saydam; kenar 1 piksel yumuşak (kenar tırtıklı görünmesin)
const KOSE_KOD = `
    vec2 p = cogl_tex_coord_in[0].xy * boyut;
    vec2 q = abs(p - boyut * 0.5) - (boyut * 0.5 - vec2(yaricap));
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - yaricap;
    float a = clamp(0.5 - d, 0.0, 1.0);
    if (ustDuz > 0.5 && p.y < boyut.y * 0.5)
        a = 1.0;
    cogl_color_out *= a;
`;

const KoseMaskesi = GObject.registerClass(
class FlugelKoseMaskesi extends Shell.GLSLEffect {
    vfunc_build_pipeline() {
        this.add_glsl_snippet(KANCA, KOSE_TANIM, KOSE_KOD, false);
    }

    ayarla(w, h, r, ustDuz) {
        const k = `${w}|${h}|${r}|${ustDuz}`;
        if (k === this._son)
            return;
        this._son = k;
        this.set_uniform_float(this.get_uniform_location('boyut'), 2, [w, h]);
        this.set_uniform_float(this.get_uniform_location('yaricap'), 1, [Math.max(0, Math.min(r, w / 2, h / 2))]);
        this.set_uniform_float(this.get_uniform_location('ustDuz'), 1, [ustDuz ? 1 : 0]);
        this.queue_repaint();
    }
});

// Cam içeriği: duvar kağıdı + etkin çalışma alanındaki pencerelerin kopyaları (+ renkli/siyah şerit), ekran
// koordinatında; kutu adanın yerine kaydırılır. (Pencere katmanının tamamı kopyalanamıyor: kabuk onu kopyada çizmiyor.)
export class Cam {
    // ayar: cam-efekti, cam-bulaniklik
    constructor(ayarlar) {
        this._ayar = ayarlar;
        this.actor = new St.Widget({x_expand: true, y_expand: true, clip_to_allocation: true, opacity: 0, visible: false,
            reactive: false});
        this._sahne = new Clutter.Actor({reactive: false});
        this.actor.add_child(this._sahne);
        // sıra önemli: önce eklenen dışta kalır → içerik önce bulanıklaşır, sonra köşeleri kesilir
        this._maske = new KoseMaskesi();
        this.actor.add_effect_with_name('flugel-cam-kose', this._maske);
        this._bulanik = new Shell.BlurEffect({mode: Shell.BlurMode.ACTOR, brightness: 0.9});
        this.actor.add_effect_with_name('flugel-cam-bulanik', this._bulanik);
        this._kirli = true;
        const kirlet = () => {
            this._kirli = true;
            if (this.actor.visible)
                this._kurPlanla();
        };
        this._idler = [
            ...['restacked', 'window-created'].map(s => [global.display, global.display.connect(s, kirlet)]),
            ...['minimize', 'unminimize', 'map', 'destroy'].map(s => [global.window_manager, global.window_manager.connect(s, kirlet)]),
            [global.workspace_manager, global.workspace_manager.connect('active-workspace-changed', kirlet)],
            [Main.panel, Main.panel.connect('notify::style', kirlet)],
            [ayarlar, ayarlar.connect('changed', (_s, k) => {
                if (k.startsWith('cam-'))
                    this._ayarOku();
            })],
        ];
        this._ayarOku();
    }

    get acik() {
        return this._acik;
    }

    _ayarOku() {
        this._acik = this._ayar.get_boolean('cam-efekti');
        if (!this._acik) {
            this.actor.hide();
            this._sahne.destroy_all_children();
            this._kirli = true;
        }
    }

    _kurPlanla() {
        if (this._kurId)
            return;
        this._kurId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._kurId = 0;
            this._kur();
            return GLib.SOURCE_REMOVE;
        });
    }

    // sahnedeki kopyaları baştan kurar (pencere açılıp kapanınca, yığın ya da çalışma alanı değişince)
    _kur() {
        this._kirli = false;
        this._sahne.destroy_all_children();
        if (!this._acik)
            return;
        const arka = Main.layoutManager._backgroundGroup;
        if (arka)
            this._sahne.add_child(new Clutter.Clone({source: arka, reactive: false}));
        const ws = global.workspace_manager.get_active_workspace();
        for (const pa of global.get_window_actors()) {
            const p = pa.meta_window;
            if (!pa.visible || !p || p.minimized || !(p.is_on_all_workspaces() || p.get_workspace() === ws))
                continue;
            const k = new Clutter.Clone({source: pa, reactive: false});
            k.add_constraint(new Clutter.BindConstraint({source: pa, coordinate: Clutter.BindCoordinate.POSITION}));
            this._sahne.add_child(k);
        }
        // üst şerit renkliyse (siyah bar / uygulama rengi) camın üstünde de o renk görünsün
        const pb = Main.layoutManager.panelBox;
        const renk = (Main.panel.style ?? '').match(/background-color:\s*([^;]+);/)?.[1];
        if (renk && pb.visible && pb.opacity > 0 && pb.translation_y === 0) {
            this._sahne.add_child(new St.Widget({x: pb.x, y: pb.y, width: pb.width, height: pb.height,
                style: `background-color: ${renk};`}));
        }
    }

    // x, y: adanın ekrandaki yeri; t: 0 (kapsül) … 1 (kart) — cam t ile belirir
    yerlestir(x, y, w, h, r, t, ustDuz) {
        if (!this._acik || t <= 0) {
            if (this.actor.visible)
                this.actor.hide();
            return;
        }
        const s = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        if (this._kirli)
            this._kur();
        this._sahne.set_position(-x, -y);
        this._maske.ayarla(w, h, r, ustDuz);
        this.actor.opacity = Math.round(255 * Math.min(1, t * 1.6));
        this._bulanik.radius = Math.round(this._ayar.get_int('cam-bulaniklik') * s);
        if (!this.actor.visible)
            this.actor.show();
    }

    destroy() {
        if (this._kurId)
            GLib.source_remove(this._kurId);
        this._kurId = 0;
        this._idler.forEach(([n, id]) => n.disconnect(id));
        this._idler = [];
        this.actor.destroy();
    }
}

// ---------- bulanık geçiş ----------
const ADI = 'flugel-gecis-bulanik';

function _bulanikAl(aktor) {
    let e = aktor.get_effect(ADI);
    if (!e) {
        e = new Shell.BlurEffect({mode: Shell.BlurMode.ACTOR, brightness: 1, radius: 0});
        aktor.add_effect_with_name(ADI, e);
    }
    return e;
}

function _bulanikBirak(aktor) {
    const tl = aktor._flugelGecis;
    if (tl) {
        aktor._flugelGecis = null;
        tl.stop();
        aktor.disconnect(tl._yokId);
    }
    if (aktor.get_effect(ADI))
        aktor.remove_effect_by_name(ADI);
}

// giris: true → bulanıktan nete; false → netten bulanığa. Süre boyunca yarıçap ease-out ile değişir.
// Animasyonlar kapalıysa ya da ayar kapalıysa hiçbir şey yapmaz.
export function bulanikGecis(aktor, {giris = true, yaricap = 10, sure = 260, gecikme = 0, acik = true} = {}) {
    _bulanikBirak(aktor);
    if (!acik || !St.Settings.get().enable_animations || !aktor.get_stage())
        return;
    const s = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    const azami = Math.round(yaricap * s);
    const e = _bulanikAl(aktor);
    e.radius = giris ? azami : 0;
    const tl = new Clutter.Timeline({actor: aktor, duration: sure, delay: gecikme});
    tl.set_progress_mode(Clutter.AnimationMode.EASE_OUT_CUBIC);
    tl.connect('new-frame', () => {
        const p = tl.get_progress();
        e.radius = Math.round(giris ? azami * (1 - p) : azami * p);
    });
    // aktör geçiş sürerken yok edilirse zaman çizelgesi ona dokunmadan durur
    tl._yokId = aktor.connect('destroy', () => {
        aktor._flugelGecis = null;
        tl.stop();
    });
    tl.connect('stopped', (_t, bitti) => {
        if (aktor._flugelGecis !== tl)
            return;
        aktor._flugelGecis = null;
        aktor.disconnect(tl._yokId);
        // girişte net hâlde efekt kalkar (boşuna ekran dışı çizim olmasın); çıkışta aktör zaten kaldırılacak
        if (giris || !bitti)
            aktor.remove_effect_by_name(ADI);
    });
    aktor._flugelGecis = tl;
    tl.start();
}

export function bulanikTemizle(aktor) {
    _bulanikBirak(aktor);
}
