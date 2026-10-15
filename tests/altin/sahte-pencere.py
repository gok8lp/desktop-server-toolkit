# Test: büyütülmüş sıradan pencere (tarayıcı gibi); argüman 'tam' verilirse tam ekran
import sys
import gi
gi.require_version('Gtk', '4.0')
from gi.repository import Gtk
app = Gtk.Application(application_id='org.flugel.PencereDeneme')
def ac(a):
    w = Gtk.ApplicationWindow(application=a, title='Tarayici')
    w.set_child(Gtk.Label(label='SEKMELER BURADA'))
    w.present()
    w.fullscreen() if 'tam' in sys.argv else w.maximize()
app.connect('activate', ac)
app.run([])
