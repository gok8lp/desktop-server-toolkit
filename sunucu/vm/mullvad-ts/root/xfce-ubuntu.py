#!/usr/bin/env python3
# FLUGEL: hello için Ubuntu görünümlü, hafif XFCE (compositor yok). Mevcut ayarlar yedeklenir.
import os, shutil, time, pwd
H = "/home/hello"; X = f"{H}/.config/xfce4/xfconf/xfce-perchannel-xml"; P = f"{H}/.config/xfce4/panel"
if os.path.isdir(f"{H}/.config/xfce4"):
    shutil.copytree(f"{H}/.config/xfce4", f"{H}/.config/xfce4.flugel-yedek-{int(time.time())}")
    shutil.rmtree(P, ignore_errors=True)
os.makedirs(X, exist_ok=True); os.makedirs(P, exist_ok=True)
def kanal(ad, govde):
    open(f"{X}/{ad}.xml", "w").write(f'<?xml version="1.0" encoding="UTF-8"?>\n<channel name="{ad}" version="1.0">\n{govde}\n</channel>\n')
kanal("xfwm4", '''  <property name="general" type="empty">
    <property name="theme" type="string" value="Yaru-dark"/>
    <property name="use_compositing" type="bool" value="false"/>
    <property name="title_font" type="string" value="Ubuntu Bold 10"/>
    <property name="button_layout" type="string" value="O|HMC"/>
    <property name="box_move" type="bool" value="true"/>
    <property name="box_resize" type="bool" value="true"/>
    <property name="workspace_count" type="int" value="1"/>
    <property name="show_dock_shadow" type="bool" value="false"/>
    <property name="show_popup_shadow" type="bool" value="false"/>
    <property name="show_frame_shadow" type="bool" value="false"/>
    <property name="wrap_workspaces" type="bool" value="false"/>
  </property>''')
kanal("xsettings", '''  <property name="Net" type="empty">
    <property name="ThemeName" type="string" value="Yaru-dark"/>
    <property name="IconThemeName" type="string" value="Yaru"/>
    <property name="EnableEventSounds" type="bool" value="false"/>
    <property name="EnableInputFeedbackSounds" type="bool" value="false"/>
  </property>
  <property name="Gtk" type="empty">
    <property name="FontName" type="string" value="Ubuntu 10"/>
    <property name="MonospaceFontName" type="string" value="Ubuntu Mono 11"/>
    <property name="CursorThemeName" type="string" value="Yaru"/>
    <property name="DialogsUseHeader" type="bool" value="false"/>
  </property>
  <property name="Xft" type="empty">
    <property name="Antialias" type="int" value="1"/>
    <property name="HintStyle" type="string" value="hintslight"/>
    <property name="RGBA" type="string" value="none"/>
  </property>''')
mon = "".join(f'''      <property name="{m}" type="empty"><property name="workspace0" type="empty">
        <property name="image-style" type="int" value="0"/><property name="color-style" type="int" value="0"/>
        <property name="rgba1" type="array"><value type="double" value="0.118"/><value type="double" value="0.118"/><value type="double" value="0.133"/><value type="double" value="1"/></property>
      </property></property>
''' for m in ["monitorrdp0", "monitorVirtual-1", "monitor0", "monitorVirtual1", "monitorscreen"])
kanal("xfce4-desktop", f'''  <property name="backdrop" type="empty"><property name="screen0" type="empty">
{mon}  </property></property>
  <property name="desktop-icons" type="empty"><property name="style" type="int" value="0"/></property>''')
kanal("xfce4-screensaver", '''  <property name="saver" type="empty"><property name="enabled" type="bool" value="false"/><property name="mode" type="int" value="0"/></property>
  <property name="lock" type="empty"><property name="enabled" type="bool" value="false"/></property>''')
kanal("xfce4-power-manager", '''  <property name="xfce4-power-manager" type="empty">
    <property name="dpms-enabled" type="bool" value="false"/><property name="blank-on-ac" type="int" value="0"/>
    <property name="lock-screen-suspend-hibernate" type="bool" value="false"/>
  </property>''')
kanal("xfce4-notifyd", '''  <property name="do-fadeout" type="bool" value="false"/><property name="do-slideout" type="bool" value="false"/>''')
# panel: üst (menü, ortada saat, sağda tepsi/ses/çıkış) + sol dock (başlatıcılar + açık pencereler)
basl = {11: "eclipse_eclipse.desktop", 12: "thunar.desktop", 13: "xfce4-terminal.desktop", 14: "firefox_firefox.desktop"}
ara = ["/var/lib/snapd/desktop/applications", "/usr/share/applications"]
for i, d in basl.items():
    os.makedirs(f"{P}/launcher-{i}", exist_ok=True)
    for a in ara:
        if os.path.exists(f"{a}/{d}"):
            shutil.copy(f"{a}/{d}", f"{P}/launcher-{i}/{d}"); break
def eklenti(i, tur, ic=""):
    return f'    <property name="plugin-{i}" type="string" value="{tur}">{ic}</property>\n'
eks = eklenti(1, "whiskermenu", '<property name="button-title" type="string" value="Uygulamalar"/><property name="show-button-title" type="bool" value="true"/><property name="show-button-icon" type="bool" value="false"/>')
eks += eklenti(2, "separator", '<property name="expand" type="bool" value="true"/><property name="style" type="uint" value="0"/>')
eks += eklenti(3, "clock", '<property name="mode" type="uint" value="2"/><property name="digital-layout" type="uint" value="3"/><property name="digital-time-format" type="string" value="%d %b  %H:%M"/><property name="digital-time-font" type="string" value="Ubuntu Bold 10"/>')
eks += eklenti(4, "separator", '<property name="expand" type="bool" value="true"/><property name="style" type="uint" value="0"/>')
eks += eklenti(5, "systray", '<property name="square-icons" type="bool" value="true"/>')
eks += eklenti(6, "pulseaudio")
eks += eklenti(7, "actions", '<property name="appearance" type="uint" value="0"/><property name="items" type="array"><value type="string" value="+logout"/><value type="string" value="-switch-user"/><value type="string" value="-separator"/><value type="string" value="+lock-screen"/></property>')
for i, d in basl.items():
    eks += eklenti(i, "launcher", f'<property name="items" type="array"><value type="string" value="{d}"/></property>')
eks += eklenti(15, "separator", '<property name="style" type="uint" value="1"/>')
eks += eklenti(16, "tasklist", '<property name="show-labels" type="bool" value="false"/><property name="flat-buttons" type="bool" value="true"/><property name="show-handle" type="bool" value="false"/><property name="grouping" type="uint" value="1"/>')
koyu = '<property name="background-style" type="uint" value="1"/><property name="background-rgba" type="array"><value type="double" value="0.07"/><value type="double" value="0.07"/><value type="double" value="0.08"/><value type="double" value="1"/></property>'
ids = lambda l: "".join(f'<value type="int" value="{x}"/>' for x in l)
kanal("xfce4-panel", f'''  <property name="configver" type="int" value="2"/>
  <property name="panels" type="array">
    <value type="int" value="1"/><value type="int" value="2"/>
    <property name="dark-mode" type="bool" value="true"/>
    <property name="panel-1" type="empty">
      <property name="position" type="string" value="p=6;x=0;y=0"/><property name="length" type="uint" value="100"/>
      <property name="position-locked" type="bool" value="true"/><property name="size" type="uint" value="28"/>
      <property name="icon-size" type="uint" value="16"/>
      <property name="plugin-ids" type="array">{ids([1,2,3,4,5,6,7])}</property>{koyu}
    </property>
    <property name="panel-2" type="empty">
      <property name="position" type="string" value="p=5;x=0;y=0"/><property name="mode" type="uint" value="1"/>
      <property name="length" type="uint" value="100"/><property name="position-locked" type="bool" value="true"/>
      <property name="size" type="uint" value="52"/><property name="icon-size" type="uint" value="32"/>
      <property name="plugin-ids" type="array">{ids([11,12,13,14,15,16])}</property>{koyu}
    </property>
  </property>
  <property name="plugins" type="empty">
{eks}  </property>''')
u = pwd.getpwnam("hello")
for k, ds, fs in os.walk(f"{H}/.config"):
    for n in ds + fs:
        os.chown(os.path.join(k, n), u.pw_uid, u.pw_gid)
print("xfce ayarlari yazildi")
