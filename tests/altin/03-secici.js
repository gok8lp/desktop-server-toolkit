(() => {
    const A = globalThis.__A;
    const k = A.E()._kart;
    A.dene('sekme göstergesi seçili sekmenin altında', () => {
        const d = k._sekmeler.get(k._secili.id).dugme.get_transformed_extents();
        const s = k._secici.get_transformed_extents();
        return Math.abs(d.origin.x - s.origin.x) < 2 && Math.abs(d.size.width - s.size.width) < 2 || `sekme ${Math.round(d.origin.x)} gösterge ${Math.round(s.origin.x)}`;
    });
    return 'ok';
})()
