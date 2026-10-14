// FLUGEL Island — sabitlenmiş uygulamalar (ayar: sabit-uygulamalar, .desktop kimlikleri; ayarlardan eklenir/sıralanır).
import Shell from 'gi://Shell';
import {Karo} from './bilesenler.js';
import {H, calistir} from './ortak.js';
import {_} from './dil.js';

export const ECLIPSE = `/snap/bin/eclipse -data ${H}/Documents/eclipse-workspace`;
const KISA = {'eclipse_eclipse.desktop': 'Eclipse', 'kitty.desktop': 'Terminal', 'google-chrome.desktop': 'Chrome',
    'org.gnome.Nautilus.desktop': _('Dosyalar')};

export function uygulamaAc(id) {
    // Eclipse her zaman C/C++ çalışma alanıyla açılır
    if (id.startsWith('eclipse'))
        return calistir(ECLIPSE);
    Shell.AppSystem.get_default().lookup_app(id)?.activate();
    return undefined;
}

export function sabitKarolar(ayar, {sonra} = {}) {
    const sistem = Shell.AppSystem.get_default();
    return ayar.get_strv('sabit-uygulamalar').map(id => sistem.lookup_app(id)).filter(Boolean).map(app => new Karo({
        ikon: app.get_icon(), etiket: KISA[app.get_id()] ?? app.get_name(), boyut: 28,
        ipucu: {baslik: app.get_name(), ayrinti: `${app.get_description() ?? ''}\n${_('Sağ tık: kaldır')}`.trim()},
        eylem: () => {
            sonra?.();
            uygulamaAc(app.get_id());
        },
        sagTik: () => ayar.set_strv('sabit-uygulamalar', ayar.get_strv('sabit-uygulamalar').filter(x => x !== app.get_id())),
    }));
}
