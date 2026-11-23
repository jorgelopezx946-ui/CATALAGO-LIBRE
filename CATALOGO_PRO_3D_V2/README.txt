CATÁLOGO PRO 3D — VERSIÓN 3.0
Marketplace prototipo · interfaz tecnológica azul · PWA + proyecto fuente Android

NOVEDADES V3
- Diseño tecnológico azul y paneles con profundidad visual.
- Carrito con cantidades, validación de existencias y eliminación de artículos.
- Lista de favoritos.
- Flujo de checkout local con nombre, teléfono y dirección.
- Registro de pedidos con código, fecha, total y estado.
- Panel de pedidos para clientes y vendedores.
- El vendedor puede actualizar estados: pendiente, confirmado, preparando, enviado, entregado o cancelado.
- Escaparate de tiendas y filtro rápido por tienda.
- Se conserva catálogo, búsqueda, categorías, publicación de productos, perfil de tienda/WhatsApp y módulo biométrico de V2.

IMPORTANTE: ALCANCE Y SEGURIDAD
Esta V3 es una demostración funcional local. Los datos se guardan en localStorage del navegador/dispositivo y NO se sincronizan entre usuarios o dispositivos. Los pedidos no se envían a un servidor ni al vendedor. El pago no está integrado. El checkout solo registra el pedido en el dispositivo que lo crea.
No publiques esta versión como marketplace comercial ni almacenes datos sensibles hasta conectar backend, autenticación segura, base de datos, almacenamiento de imágenes, validación de permisos y reglas de acceso.
El registro OTP continúa siendo de demostración (123456); no envía SMS reales. Las credenciales locales de la V2 no son adecuadas para producción.
El rol administrador debe asignarse desde un backend seguro; nunca se debe permitir que el usuario se autoproclame administrador desde el navegador. Esta entrega no habilita un administrador global real porque no existe backend central.

PROBAR EN WINDOWS
1. Instala Node.js LTS.
2. Extrae el ZIP.
3. Abre PowerShell en la carpeta CATALOGO_PRO_3D_V2.
4. Ejecuta:
   npm install
   npm run start
5. Abre la dirección local que muestra Vite.

ALTERNATIVA
   npm run serve
Abre http://127.0.0.1:5199

ANDROID APK
Requisitos: Node.js, Android Studio y Android SDK.
   npm install
   npx cap add android
   npm run build
   npx cap sync android
   npx cap open android
En Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s).
La APK no viene compilada en este ZIP; se incluye el proyecto fuente.

BIOMETRÍA
La integración de biometría existente se conserva. En Android usa el plugin nativo; en web requiere HTTPS/localhost y soporte WebAuthn. El servidor debe verificar retos y sesiones para uso real.

SIGUIENTE FASE PARA PRODUCCIÓN
Conectar Supabase o backend equivalente para:
- cuentas y sesiones seguras;
- roles cliente/vendedor/administrador con políticas RLS;
- productos, inventario, tiendas y pedidos compartidos;
- imágenes en almacenamiento de nube;
- notificaciones al vendedor;
- pagos con proveedor compatible con El Salvador.
