-- FLUGEL: varsayılan guacadmin -> flugel (şifresi kullanıcı tarafından sifre-koy.sh ile konur; o zamana kadar rastgele, girilemez)
UPDATE guacamole_entity SET name = 'flugel' WHERE name = 'guacadmin' AND type = 'USER';
UPDATE guacamole_user SET password_hash = decode(md5(random()::text) || md5(random()::text), 'hex'),
       password_salt = decode(md5(random()::text) || md5(random()::text), 'hex')
 WHERE entity_id = (SELECT entity_id FROM guacamole_entity WHERE name = 'flugel');
-- mullvad-ts masaüstü (RDP); şifre saklanmaz, bağlanırken sorulur
INSERT INTO guacamole_connection (connection_name, protocol) VALUES ('Geliştirme masaüstü', 'rdp');
INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
SELECT connection_id, p.n, p.v FROM guacamole_connection, (VALUES
  ('hostname', '<IP>'), ('port', '3389'), ('username', 'hello'),
  ('security', 'any'), ('ignore-cert', 'true'), ('resize-method', 'display-update'),
  ('enable-font-smoothing', 'true'), ('server-layout', 'tr-tr-qwerty'), ('enable-wallpaper', 'true')
) AS p(n, v) WHERE connection_name = 'Geliştirme masaüstü';
INSERT INTO guacamole_connection_permission (entity_id, connection_id, permission)
SELECT e.entity_id, c.connection_id, 'READ' FROM guacamole_entity e, guacamole_connection c
 WHERE e.name = 'flugel' AND c.connection_name = 'Geliştirme masaüstü';
