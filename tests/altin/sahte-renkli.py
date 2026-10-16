# Test: renkli şeritli büyütülmüş pencere (buzlu camın altını bulanık gösterdiği görülsün)
import gi
gi.require_version('Gtk', '4.0')
from gi.repository import Gtk, Gdk
CSS = b''.join(b'.r%d { background-color: %s; color: white; font-size: 40px; font-weight: bold; }' % (i, c)
               for i, c in enumerate([b'#e53935', b'#fdd835', b'#43a047', b'#1e88e5', b'#8e24aa', b'#ffffff']))
app = Gtk.Application(application_id='org.flugel.RenkDeneme')
def ac(a):
    p = Gtk.CssProvider(); p.load_from_data(CSS, -1)
    Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), p, 800)
    w = Gtk.ApplicationWindow(application=a, title='Renkli')
    k = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, homogeneous=True)
    for i in range(6):
        l = Gtk.Label(label='FLUGEL'); l.add_css_class('r%d' % i); l.set_vexpand(True); k.append(l)
    w.set_child(k); w.present(); w.maximize()
app.connect('activate', ac)
app.run([])
