// HIMURAw/gnome-dynamic-island (GPL-3.0) kaynağından. FLUGEL değişikliği (2026-10-13): springProgress() eklendi —
// tek bir 0→1 ilerlemesini yayla sürer; Island genişlik/yükseklik/köşe yarıçapını aynı karede birlikte hesaplar.
import Clutter from 'gi://Clutter';
import St from 'gi://St';

const active = new Set();

// Animates numeric actor properties with a damped spring, the way iOS moves the
// Dynamic Island: fast start, a small overshoot, then settle.
// response: seconds for one oscillation. damping: 1 = no overshoot, lower = bouncier.
export function spring(actor, props, {response = 0.5, damping = 0.78, onComplete} = {}) {
    // Only one animation may drive a property: a spring or an ease left running
    // would fight this one frame by frame and the actor would jitter.
    stopSpring(actor);
    for (const key in props)
        actor.remove_transition(key.replaceAll('_', '-'));

    if (!St.Settings.get().enable_animations) {
        Object.assign(actor, props);
        onComplete?.();
        return;
    }

    const from = {};
    for (const key in props)
        from[key] = actor[key];

    const omega = 2 * Math.PI / response;
    const zeta = Math.min(damping, 0.999);
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    const duration = Math.ceil(1000 * 6 / (zeta * omega));

    const timeline = new Clutter.Timeline({actor, duration});
    const handle = {
        stop() {
            timeline.stop();
            finish(false);
        },
    };

    let done = false;
    const finish = completed => {
        if (done)
            return;
        done = true;
        active.delete(handle);
        if (actor._dynadaSpring === handle)
            delete actor._dynadaSpring;
        if (completed) {
            Object.assign(actor, props);
            onComplete?.();
        }
    };

    timeline.connect('new-frame', () => {
        const t = timeline.get_elapsed_time() / 1000;
        const decay = Math.exp(-zeta * omega * t);
        const p = 1 - decay * (Math.cos(omegaD * t) + (zeta * omega / omegaD) * Math.sin(omegaD * t));
        for (const key in props)
            actor[key] = from[key] + (props[key] - from[key]) * p;
    });
    timeline.connect('completed', () => finish(true));

    actor._dynadaSpring = handle;
    active.add(handle);
    timeline.start();
}

export function stopSpring(actor) {
    actor._dynadaSpring?.stop();
}

export function stopAllSprings() {
    for (const handle of [...active])
        handle.stop();
}

// Drives one 0→1 progress with the same damped spring and calls onFrame(p) every frame
// (p may overshoot 1 a little). Returns a handle with stop(). Respects "reduce animations".
export function springProgress(actor, onFrame, {response = 0.5, damping = 0.78, onComplete} = {}) {
    if (!St.Settings.get().enable_animations) {
        onFrame(1);
        onComplete?.();
        return {stop() {}};
    }
    const omega = 2 * Math.PI / response;
    const zeta = Math.min(damping, 0.999);
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    const duration = Math.ceil(1000 * 6 / (zeta * omega));
    const timeline = new Clutter.Timeline({actor, duration});
    let done = false;
    // aktör yok edilirse (eklenti kapanışı, kabuk kapanışı) yay sessizce durur
    const yokId = actor.connect('destroy', () => handle.stop());
    const handle = {
        stop() {
            if (done)
                return;
            done = true;
            active.delete(handle);
            timeline.stop();
        },
    };
    timeline.connect('new-frame', () => {
        const t = timeline.get_elapsed_time() / 1000;
        const decay = Math.exp(-zeta * omega * t);
        onFrame(1 - decay * (Math.cos(omegaD * t) + (zeta * omega / omegaD) * Math.sin(omegaD * t)));
    });
    timeline.connect('completed', () => {
        if (done)
            return;
        done = true;
        active.delete(handle);
        actor.disconnect(yokId);
        onFrame(1);
        onComplete?.();
    });
    active.add(handle);
    timeline.start();
    return handle;
}

// FLUGEL (2026-10-16): hızını koruyan yay. Her boyut (genişlik, yükseklik, yarıçap) kendi konum ve hızıyla
// sönümlü yay denklemini kapalı biçimde adım adım çözer. Animasyon sürerken hedef değişirse hız korunur:
// hareket durup baştan başlamaz, yeni hedefe kıvrılarak akar (iOS'taki kesintisiz geçiş).
export class YayFizik {
    // onFrame(durum): her karede {anahtar: değer}
    constructor(actor, onFrame) {
        this._actor = actor;
        this._onFrame = onFrame;
        this._x = null;
        this._v = {};
        this._timeline = null;
    }

    get suruyor() {
        return !!this._timeline;
    }

    // bas: hareketsizken başlangıç değerleri (sürüyorsa yok sayılır, mevcut konum ve hız kullanılır)
    hedefle(hedef, bas, {response = 0.5, damping = 0.78, onComplete} = {}) {
        this._hedef = {...hedef};
        this._onComplete = onComplete;
        const omega = 2 * Math.PI / response;
        this._zeta = Math.min(damping, 0.999);
        this._omega = omega;
        this._omegaD = omega * Math.sqrt(1 - this._zeta * this._zeta);
        if (!St.Settings.get().enable_animations) {
            this.stop();
            this._onFrame({...hedef});
            onComplete?.();
            return;
        }
        if (!this._timeline) {
            this._x = {...bas};
            this._v = {};
            for (const k in hedef)
                this._v[k] = 0;
            // süre üst sınırdır; yay oturunca erken biter
            this._timeline = new Clutter.Timeline({actor: this._actor, duration: 4000});
            this._son = 0;
            this._timeline.connect('new-frame', () => this._adim());
            this._timeline.connect('completed', () => this._bitir(true));
            this._yokId = this._actor.connect('destroy', () => this.stop());
            this._timeline.start();
        }
    }

    _adim() {
        const simdi = this._timeline.get_elapsed_time() / 1000;
        // kare atlansa da en fazla 1/30 sn ilerlenir: uzun bir takılmadan sonra sıçrama olmaz
        const dt = Math.min(1 / 30, Math.max(0, simdi - this._son));
        this._son = simdi;
        const {_zeta: z, _omega: w, _omegaD: wd} = this;
        const e = Math.exp(-z * w * dt), c = Math.cos(wd * dt), s = Math.sin(wd * dt);
        let oturdu = true;
        for (const k in this._hedef) {
            const d0 = this._x[k] - this._hedef[k], v0 = this._v[k] ?? 0;
            const d = e * (d0 * c + ((v0 + z * w * d0) / wd) * s);
            const v = e * (v0 * c - ((w * w * d0 + z * w * v0) / wd) * s);
            this._x[k] = this._hedef[k] + d;
            this._v[k] = v;
            if (Math.abs(d) > 0.4 || Math.abs(v) > 6)
                oturdu = false;
        }
        if (oturdu) {
            this._bitir(true);
            return;
        }
        this._onFrame({...this._x});
    }

    _bitir(tamam) {
        if (!this._timeline)
            return;
        const tl = this._timeline;
        this._timeline = null;
        tl.stop();
        this._actor.disconnect(this._yokId);
        this._v = {};
        if (tamam) {
            this._x = {...this._hedef};
            this._onFrame({...this._hedef});
            const f = this._onComplete;
            this._onComplete = null;
            f?.();
        }
    }

    stop() {
        this._bitir(false);
    }
}
