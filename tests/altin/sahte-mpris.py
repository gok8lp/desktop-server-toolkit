# Test: MPRIS konuşan sahte müzik çalar. Gelen komutları stdout'a yazar (Seek, SetPosition, Next, Previous, PlayPause).
import sys
from gi.repository import Gio, GLib
XML = """<node>
<interface name="org.mpris.MediaPlayer2"><property name="Identity" type="s" access="read"/></interface>
<interface name="org.mpris.MediaPlayer2.Player">
 <method name="Next"/><method name="Previous"/><method name="PlayPause"/><method name="Play"/><method name="Pause"/>
 <method name="Seek"><arg type="x" direction="in"/></method>
 <method name="SetPosition"><arg type="o" direction="in"/><arg type="x" direction="in"/></method>
 <property name="PlaybackStatus" type="s" access="read"/><property name="Metadata" type="a{sv}" access="read"/>
 <property name="Position" type="x" access="read"/><property name="Rate" type="d" access="read"/>
 <property name="CanSeek" type="b" access="read"/><property name="CanGoNext" type="b" access="read"/>
 <property name="CanGoPrevious" type="b" access="read"/><property name="CanPlay" type="b" access="read"/>
</interface></node>"""
durum = {'status': 'Playing', 'pos': 156_000_000, 'parca': 1}
def meta():
    return {'mpris:trackid': GLib.Variant('o', f"/org/flugel/parca/{durum['parca']}"),
            'xesam:title': GLib.Variant('s', 'Hear Me Lord (2020 Mix)' if durum['parca'] == 1 else 'Ikinci Parca'),
            'xesam:artist': GLib.Variant('as', ['George Harrison']), 'xesam:album': GLib.Variant('s', 'All Things Must Pass'),
            'mpris:length': GLib.Variant('x', 350_000_000)}
def ozellik(_c, _s, _y, iface, ad):
    d = {'Identity': GLib.Variant('s', 'Sahte Calar'), 'PlaybackStatus': GLib.Variant('s', durum['status']),
         'Metadata': GLib.Variant('a{sv}', meta()), 'Position': GLib.Variant('x', durum['pos']), 'Rate': GLib.Variant('d', 1.0),
         'CanSeek': GLib.Variant('b', True), 'CanGoNext': GLib.Variant('b', True), 'CanGoPrevious': GLib.Variant('b', True),
         'CanPlay': GLib.Variant('b', True)}
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
dugum = Gio.DBusNodeInfo.new_for_xml(XML)
def edindi(c, _ad):
    for i in dugum.interfaces:
        c.register_object('/org/mpris/MediaPlayer2', i, cagri, ozellik, None)
Gio.bus_own_name(Gio.BusType.SESSION, 'org.mpris.MediaPlayer2.flugeltest', Gio.BusNameOwnerFlags.NONE, edindi, None, None)
GLib.MainLoop().run()
