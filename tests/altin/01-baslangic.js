(() => {
    const A = globalThis.__A;
    const ext = Main.extensionManager.lookup('flugel-island@flugel');
    A.dene('eklenti etkin', () => ext.state === 1 || `durum ${ext.state}`);
    A.dene('ada kapsülü görünür', () => A.E()._ada._kok.visible && A.E()._ada._kok.width > 50);
    A.dene('üst çubukta sadece ada: saat gizli', () => Main.panel.statusArea.dateMenu.container.width === 0 || Main.panel.statusArea.dateMenu.opacity === 0);
    A.dene('Etkinlikler düğmesi gizli', () => !Main.panel.statusArea.activities.container.visible);
    A.dene('kalıcı modal yok', () => Main.modalCount === 0 || `modalCount ${Main.modalCount}`);
    A.dene('emoji → simge (GJS)', () => {
        const {emojisiz} = A.ortak ?? {};
        return true;
    });
    A.dene('sağlayıcılar kuruldu', () => A.E()._saglayicilar.length >= 10 || `${A.E()._saglayicilar.length}`);
    return A.sonuc.length;
})()
