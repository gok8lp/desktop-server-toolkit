# Test: MPRIS konuşan sahte müzik çalar. Gelen komutları stdout'a yazar (Seek, SetPosition, Next, Previous, PlayPause).
import sys
from gi.repository import Gio, GLib
XML = """<node>
<interface name="org.mpris.MediaPlayer2"><property name="Identity" type="s" access="read"/><property name="DesktopEntry" type="s" access="read"/></interface>
<interface name="org.mpris.MediaPlayer2.Player">
 <method name="Next"/><method name="Previous"/><method name="PlayPause"/><method name="Play"/><method name="Pause"/>
 <method name="Seek"><arg type="x" direction="in"/></method>
 <method name="SetPosition"><arg type="o" direction="in"/><arg type="x" direction="in"/></method>
 <property name="PlaybackStatus" type="s" access="read"/><property name="Metadata" type="a{sv}" access="read"/>
 <property name="Position" type="x" access="read"/><property name="Rate" type="d" access="read"/>
 <property name="CanSeek" type="b" access="read"/><property name="CanGoNext" type="b" access="read"/>
 <property name="CanGoPrevious" type="b" access="read"/><property name="CanPlay" type="b" access="read"/>
 <property name="Shuffle" type="b" access="readwrite"/><property name="LoopStatus" type="s" access="readwrite"/>
</interface></node>"""
durum = {'status': 'Playing', 'pos': 156_000_000, 'parca': 1, 'shuffle': False, 'loop': 'None'}
KAPAK = sys.argv[1] if len(sys.argv) > 1 else ''
def meta():
    return {'mpris:trackid': GLib.Variant('o', f"/org/flugel/parca/{durum['parca']}"),
            'xesam:title': GLib.Variant('s', 'Hear Me Lord (2020 Mix)' if durum['parca'] == 1 else 'Ikinci Parca'),
            'xesam:artist': GLib.Variant('as', ['George Harrison']), 'xesam:album': GLib.Variant('s', 'All Things Must Pass'),
            'mpris:length': GLib.Variant('x', 350_000_000), **({'mpris:artUrl': GLib.Variant('s', 'file://' + KAPAK)} if KAPAK else {})}
def ozellik(_c, _s, _y, iface, ad):
    d = {'Identity': GLib.Variant('s', 'Sahte Calar'), 'PlaybackStatus': GLib.Variant('s', durum['status']),
         'Metadata': GLib.Variant('a{sv}', meta()), 'Position': GLib.Variant('x', durum['pos']), 'Rate': GLib.Variant('d', 1.0),
         'CanSeek': GLib.Variant('b', True), 'CanGoNext': GLib.Variant('b', True), 'CanGoPrevious': GLib.Variant('b', True),
         'CanPlay': GLib.Variant('b', True), 'DesktopEntry': GLib.Variant('s', 'org.gnome.Settings'),
         'Shuffle': GLib.Variant('b', durum['shuffle']), 'LoopStatus': GLib.Variant('s', durum['loop'])}
    return d.get(ad)
def degisti(c):
    c.emit_signal(None, '/org/mpris/MediaPlayer2', 'org.freedesktop.DBus.Properties', 'PropertiesChanged',
                  GLib.Variant('(sa{sv}as)', ('org.mpris.MediaPlayer2.Player',
                               {'PlaybackStatus': GLib.Variant('s', durum['status']), 'Metadata': GLib.Variant('a{sv}', meta())}, [])))
def cagri(c, _s, _y, iface, yontem, param, inv):
    a = param.unpack() if param else ()
    print('KOMUT', yontem, *a, flush=True)
    if yontem == 'Seek': durum['pos'] = max(0, durum['pos'] + a[0])
    if yontem == 'SetPosition': durum['pos'] = a[1]
    if yontem == 'Next': durum['parca'] += 1; durum['pos'] = 0
    if yontem == 'Previous': durum['parca'] = max(1, durum['parca'] - 1); durum['pos'] = 0
    if yontem == 'PlayPause': durum['status'] = 'Paused' if durum['status'] == 'Playing' else 'Playing'
    inv.return_value(None)
    degisti(c)
def yaz(c, _s, _y, iface, ad, deger):
    print('AYAR', ad, deger.unpack(), flush=True)
    if ad == 'Shuffle': durum['shuffle'] = deger.unpack()
    if ad == 'LoopStatus': durum['loop'] = deger.unpack()
    c.emit_signal(None, '/org/mpris/MediaPlayer2', 'org.freedesktop.DBus.Properties', 'PropertiesChanged',
                  GLib.Variant('(sa{sv}as)', ('org.mpris.MediaPlayer2.Player', {ad: deger}, [])))
    return True
dugum = Gio.DBusNodeInfo.new_for_xml(XML)
def edindi(c, _ad):
    for i in dugum.interfaces:
        c.register_object('/org/mpris/MediaPlayer2', i, cagri, ozellik, yaz)
Gio.bus_own_name(Gio.BusType.SESSION, 'org.mpris.MediaPlayer2.flugeltest', Gio.BusNameOwnerFlags.NONE, edindi, None, None)
GLib.MainLoop().run()
