(() => {
    const A = globalThis.__A;
    const E = A.E();
    E._yonetici.setPinned(true);
    for (const s of E._kart._sayfalar) {
        A.dene(`sekme ${s.id} çizildi`, () => {
            E._kart.sekmeSec(s.id, false);
            const n = s.sayfa.actor.get_n_children();
            return n > 0 || `çocuk yok`;
        });
    }
    return 'ok';
})()
