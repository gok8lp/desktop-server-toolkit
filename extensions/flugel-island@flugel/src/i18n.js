// Minimal format() — substitutes %s / %d in order, treats %% as a literal '%'.
// Translated strings keep the placeholder order; %% is a literal percent.

// GLib returns locales in preference order. A Turkish fallback must not
// override a preferred English (or other non-Turkish) system locale.
export function systemLanguage(names) {
    return /^tr(?:[_@.-]|$)/i.test(names?.[0] ?? '') ? 'tr' : 'en';
}

export function format(str, ...args) {
    let i = 0;
    return str.replace(/%[sd%]/g, m => {
        if (m === '%%') return '%';
        return String(args[i++]);
    });
}
