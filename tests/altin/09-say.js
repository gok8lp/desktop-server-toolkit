(() => {
    const A = globalThis.__A;
    const n = A.bul(global.stage, k => /flugel-/.test(k.style_class ?? '')).length;
    return `${n}`;
})()
