CATÁLOGO PRO 3D V4 · MULTITIENDA
=================================

Esta entrega parte de tu V3 y conserva su catálogo, búsqueda, categorías, publicación de productos, tienda/WhatsApp, zoom de imágenes, carrito, favoritos, pedidos, estados, tema claro/oscuro, PWA y preparación Capacitor/Android.

NOVEDADES INICIALES V4
----------------------
- Identidad y almacenamiento local V4 separados de V3 para no sobrescribir la base local anterior.
- Flujo de registro permite elegir Cliente o Vendedor; cualquier persona puede elegir Vendedor y debe indicar el nombre de su tienda.
- Comisión de referencia del 8% por venta.
- Los pedidos de demostración guardan el porcentaje, comisión estimada y neto estimado para cada vendedor.
- Se incluye supabase/schema_v4.sql con esquema central, creación automática de tienda al registrarse como vendedor, RLS y funciones SQL transaccionales para crear pedidos con stock/precio/comisión calculados en servidor.
- Se incluye .env.example como guía para la futura conexión del frontend.

IMPORTANTE: QUÉ ESTÁ Y QUÉ NO ESTÁ CONECTADO
--------------------------------------------
La interfaz existente todavía trabaja en modo local con localStorage. El registro OTP 123456 sigue siendo DEMO; la sesión y pedidos locales no son autenticación ni transacciones reales. El 8% mostrado en la interfaz es una simulación local, no se cobra ni se transfiere dinero. No se debe publicar como marketplace de producción todavía.

El SQL es la base de backend para Supabase, pero todavía debe instalarse en un proyecto Supabase y conectarse desde el frontend. Sin las credenciales del proyecto no es posible completar ni probar la sincronización real entre dispositivos. La service_role key jamás debe ponerse en el frontend, EXE o APK.

INSTALACIÓN WEB / WINDOWS
-------------------------
1. Extrae el ZIP.
2. Entra a CATALOGO_PRO_3D_V2.
3. Abre PowerShell en esa carpeta.
4. Ejecuta:
   npm install
   npm run start
5. Abre la URL local que muestra Vite.

Para compilar:
   npm run build

SUPABASE (SIGUIENTE PASO OBLIGATORIO PARA MULTITIENDA REAL)
----------------------------------------------------------
1. Crea un proyecto en https://supabase.com/.
2. Abre SQL Editor en el proyecto.
3. Copia y ejecuta el contenido de ../supabase/schema_v4.sql (la carpeta supabase está junto a CATALOGO_PRO_3D_V2).
4. En Authentication configura el método de acceso que usarás (correo/contraseña recomendado; teléfono requiere proveedor SMS).
5. Configura Storage y políticas para imágenes de productos antes de habilitar subidas reales.
6. Guarda Project URL y anon/public key en variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Nunca uses service_role en cliente.
7. El frontend aún necesita la siguiente fase de integración para reemplazar login/localStorage por Supabase Auth/DB/Storage y consumir place_order / set_order_status.

COMISIÓN
--------
El SQL inicia con una comisión del 8% en platform_settings. El RPC place_order calcula la comisión en el servidor usando precio vigente y bloquea filas de inventario para evitar ventas por encima del stock. Ajusta el porcentaje desde SQL seguro, no desde la aplicación pública.

ADMINISTRADOR
-------------
No existe un usuario administrador predeterminado ni una contraseña maestra. Después de registrar tu usuario en Supabase, un propietario del proyecto debe asignar manualmente role='admin' al UUID correcto desde SQL seguro. Nunca permitas que el formulario público elija el rol admin.

ANDROID APK
-----------
Requisitos: Node.js, Android Studio y Android SDK.
   npm install
   npx cap add android       (solo la primera vez)
   npm run build
   npx cap sync android
   npx cap open android
En Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s).

WINDOWS EXE
-----------
La versión actual se puede ejecutar como web local. El empaquetado EXE con Electron es una etapa posterior; no se incluye instalador compilado en esta entrega.

NOTA DE MIGRACIÓN
-----------------
La V4 utiliza la clave local catalogo_pro_v4 para que los datos locales de V3 no se sobrescriban. Los datos locales antiguos no se migran automáticamente a Supabase. La importación de productos y usuarios deberá realizarse con un proceso de migración controlado.
