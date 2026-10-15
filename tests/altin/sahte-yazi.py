# Test: büyütülmüş pencere; üst ortada bir metin kutusu (çentiğin altına denk gelir), altta bir düğme
import gi
gi.require_version('Gtk', '4.0')
from gi.repository import Gtk
app = Gtk.Application(application_id='org.flugel.YaziDeneme')
def ac(a):
    w = Gtk.ApplicationWindow(application=a, title='YaziDeneme', decorated=False)
    kutu = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
    giris = Gtk.Entry(halign=Gtk.Align.CENTER, width_chars=12, margin_top=2)
    kutu.append(giris)
    alt = Gtk.Entry(halign=Gtk.Align.CENTER, width_chars=12, margin_top=400)
    kutu.append(alt)
    w.set_child(kutu)
    w.present(); w.maximize()
    giris.grab_focus()
app.connect('activate', ac)
app.run([])
