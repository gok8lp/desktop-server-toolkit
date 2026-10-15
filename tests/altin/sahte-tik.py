import sys, gi
gi.require_version('Gtk', '4.0')
from gi.repository import Gtk
app = Gtk.Application(application_id='org.flugel.TikDeneme')
def ac(a):
    w = Gtk.ApplicationWindow(application=a, title='TikDeneme')
    g = Gtk.Grid(row_homogeneous=True, column_homogeneous=True)
    for r in range(4):
        for c in range(4):
            b = Gtk.Button(label=f'{r}{c}')
            b.connect('clicked', lambda _b, r=r, c=c: (print(f'TIK {r}{c}', flush=True)))
            g.attach(b, c, r, 1, 1)
    w.set_child(g); w.present(); w.fullscreen()
app.connect('activate', ac)
app.run([])
