"""Başsız GNOME testinde kısa ömürlü PiP penceresi."""
import gi

gi.require_version('Gtk', '4.0')
from gi.repository import Gtk

app = Gtk.Application(application_id='com.google.Chrome')


def ac(application):
    window = Gtk.ApplicationWindow(application=application, title='Picture in picture')
    window.set_default_size(480, 270)
    window.present()


app.connect('activate', ac)
app.run([])
