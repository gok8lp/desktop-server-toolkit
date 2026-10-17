import re
p = "/home/hello/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.xml"; s = open(p).read()
ids = lambda l: "".join(f'<value type="int" value="{x}"/>' for x in l)
s = re.sub(r'(<property name="panel-1".*?<property name="plugin-ids" type="array">).*?(</property>)', lambda m: m.group(1) + ids([2,3,4,5,6,7]) + m.group(2), s, flags=re.S)
s = re.sub(r'(<property name="panel-2".*?<property name="plugin-ids" type="array">).*?(</property>)', lambda m: m.group(1) + ids([11,12,13,14,15,16,17,1]) + m.group(2), s, flags=re.S)
s = s.replace('<property name="button-title" type="string" value="Uygulamalar"/><property name="show-button-title" type="bool" value="true"/><property name="show-button-icon" type="bool" value="false"/>',
              '<property name="button-icon" type="string" value="view-app-grid-symbolic"/><property name="show-button-title" type="bool" value="false"/><property name="show-button-icon" type="bool" value="true"/>')
if 'plugin-17' not in s:
    s = s.replace('  </property>\n</channel>', '    <property name="plugin-17" type="string" value="separator"><property name="expand" type="bool" value="true"/><property name="style" type="uint" value="0"/></property>\n  </property>\n</channel>')
open(p, "w").write(s)
d = "/home/hello/.config/xfce4/panel/launcher-12/thunar.desktop"
t = open(d).read(); t = re.sub(r'^Icon=.*$', 'Icon=system-file-manager', t, flags=re.M); t = re.sub(r'^Name=.*$', 'Name=Dosyalar', t, count=1, flags=re.M); open(d, "w").write(t)
print("panel duzeltildi")
