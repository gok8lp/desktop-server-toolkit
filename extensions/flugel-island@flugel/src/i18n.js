// Minimal format() — substitutes %s / %d in order, treats %% as a literal '%'.
// Translated strings must use positional placeholders so xgettext extracts
// them and translators can reorder arguments naturally in other languages.

export function format(str, ...args) {
    let i = 0;
    return str.replace(/%[sd%]/g, m => {
        if (m === '%%') return '%';
        return String(args[i++]);
    });
}
