// Pure module — no gi imports. Defines the public Provider contract.
//
// A Provider is an object with:
//   id      : string — stable, lowercase identifier (e.g. "media")
//   enable  : (manager: ActivityManager, settings: Gio.Settings | null) => void
//   disable : () => void
//
// enable() is called once when the extension is enabled. It subscribes to
// its own source (D-Bus / Shell signals / Gio.Settings) and calls
// manager.push / manager.update / manager.remove as events arrive.
//
// disable() MUST release every signal handler, timer, and D-Bus proxy
// it acquired, and remove every activity it pushed.

export function assertProvider(p) {
    if (!p || typeof p !== 'object') throw new Error('Provider must be an object');
    if (typeof p.id !== 'string' || !p.id.length) throw new Error('Provider.id must be a non-empty string');
    if (typeof p.enable !== 'function') throw new Error('Provider.enable must be a function');
    if (typeof p.disable !== 'function') throw new Error('Provider.disable must be a function');
}

// FLUGEL eklemesi: öncelik, kullanıcının ayarlardaki sırasından gelir (ilk = en önemli).
// ek: aynı kaynak içinde ince ayar (örn. maç saati yaklaştıkça yükselir), 0–99 arası.
export function oncelik(settings, id, ek = 0) {
    const sira = settings?.get_strv('oncelik-sirasi') ?? [];
    const i = sira.indexOf(id);
    return (i < 0 ? 0 : (sira.length - i) * 100) + Math.max(0, Math.min(99, ek));
}

// Kısa süreli (transient) etkinliğin bitiş zamanı, µs
export function geciciSure(settings) {
    return (settings?.get_int('transient-duration-ms') ?? 1800) * 1000;
}
