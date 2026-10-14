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
        onFrame(1);
        onComplete?.();
    });
    active.add(handle);
    timeline.start();
    return handle;
}
