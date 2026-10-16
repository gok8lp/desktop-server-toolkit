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

const KOSE_TANIM = 'uniform vec2 boyut; uniform vec4 alan; uniform float yaricap; uniform float ustDuz;';
// boyut: dokunun (cam kutusunun) boyutu; alan: içindeki adanın yeri ve boyutu (x, y, g, y). Yuvarlak dikdörtgenin
// dışı saydam; kenar 1 piksel yumuşak (kenar tırtıklı görünmesin)
const KOSE_KOD = `
    vec2 p = cogl_tex_coord_in[0].xy * boyut - alan.xy;
    vec2 yari = alan.zw * 0.5;
    vec2 q = abs(p - yari) - (yari - vec2(yaricap));
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - yaricap;
    float a = clamp(0.5 - d, 0.0, 1.0);
    if (ustDuz > 0.5 && p.y < yari.y && p.y >= 0.0 && p.x >= 0.0 && p.x <= alan.z)
        a = 1.0;
    cogl_color_out *= a;
`;

const KoseMaskesi = GObject.registerClass(
class FlugelKoseMaskesi extends Shell.GLSLEffect {
    vfunc_build_pipeline() {
        this.add_glsl_snippet(KANCA, KOSE_TANIM, KOSE_KOD, false);
    }

    ayarla(W, H, x, y, w, h, r, ustDuz) {
        const k = `${W}|${H}|${x}|${y}|${w}|${h}|${r}|${ustDuz}`;
        if (k === this._son)
            return;
        this._son = k;
        this.set_uniform_float(this.get_uniform_location('boyut'), 2, [W, H]);
        this.set_uniform_float(this.get_uniform_location('alan'), 4, [x, y, w, h]);
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
        // ada animasyonla büyüyüp küçülürken cam kutusu sabit boyutta kalır (ekran dışı tamponlar her karede yeniden
        // ayrılmasın); adanın o anki şekli sadece maskeyle çizilir. Kutu adanın hemen altında, kabuk katmanında durur.
        this.actor = new St.Widget({clip_to_allocation: true, opacity: 0, visible: false, reactive: false});
        this._kutu = null;
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

    // x, y, w, h: adanın ekrandaki yeri ve boyutu; hw, hh: gittiği hedef boyut; t: 0 (kapsül) … 1 (kart) — cam t ile
    // belirir; opak: adanın kendi opaklığı (0–255)
    yerlestir({x, y, w, h, r, t, ustDuz, hw = w, hh = h, opak = 255}) {
        if (this._bitti)
            return;
        if (!this._acik || t <= 0 || opak <= 0) {
            if (this.actor.visible)
                this.actor.hide();
            this._kutu = null;
            return;
        }
        const s = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        if (this._kirli)
            this._kur();
        // kutu sadece büyür (yay taşmasına %6 pay); cam gizlenince sıfırlanır
        if (!this._kutu || w > this._kutu.w || h > this._kutu.h) {
            this._kutu = {w: Math.ceil(Math.max(w, hw) * 1.06), h: Math.ceil(Math.max(h, hh) * 1.06)};
            this.actor.set_size(this._kutu.w, this._kutu.h);
        }
        const kx = Math.round(x + (w - this._kutu.w) / 2);
        this.actor.set_position(kx, y);
        this._sahne.set_position(-kx, -y);
        this._maske.ayarla(this._kutu.w, this._kutu.h, x - kx, 0, w, h, r, ustDuz);
        this.actor.opacity = Math.round(Math.min(1, t * 1.6) * opak);
        this._bulanik.radius = Math.round(this._ayar.get_int('cam-bulaniklik') * s);
        if (!this.actor.visible)
            this.actor.show();
    }

    destroy() {
        this._bitti = true;
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
