/* CAPACITOR: se usa el objeto global que inyecta Capacitor en la APK.
   En web/HTTP no existe: se usa un objeto compatible con isNativePlatform()=false.
   Así el mismo archivo funciona en Vite/navegador y dentro de la APK, sin bundler. */
const Capacitor = globalThis.Capacitor || { isNativePlatform: () => false, getPlatform: () => 'web', isPluginAvailable: () => false };

const DB='catalogo_pro_v4';
const PLATFORM_COMMISSION_RATE=8; // Porcentaje de referencia; en producción lo calcula el servidor.
const categories=['Todos','Ropa','Sublimación','Accesorios','Hogar','Otros'];
let db=JSON.parse(localStorage.getItem(DB)||'{"users":[],"products":[]}');
let session=null, selectedCategory='Todos', editId=null;
const $=id=>document.getElementById(id);
const save=()=>localStorage.setItem(DB,JSON.stringify(db));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+Number(n||0).toFixed(2);
const toast=m=>{const t=$('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800)};
const demo=()=>{if(db.products.length)return;db.products=[
{id:'demo-1',owner:'demo',name:'Camiseta personalizada',category:'Ropa',price:12,stock:12,sizes:'S, M, L, XL, XXL',colors:'Negro, blanco, azul',description:'Camiseta con diseño personalizado. Pregunta por tallas y colores.',image:'',store:'Tienda Demo',whatsapp:''},
{id:'demo-2',owner:'demo',name:'Taza sublimada',category:'Sublimación',price:6,stock:20,sizes:'11 oz',colors:'Blanco',description:'Taza personalizada con fotografía, nombre o diseño.',image:'',store:'Sublima Studio',whatsapp:''},
{id:'demo-3',owner:'demo',name:'Termo personalizado',category:'Sublimación',price:15,stock:7,sizes:'20 oz',colors:'Varios',description:'Termo reutilizable para regalos y diseños personalizados.',image:'',store:'Sublima Studio',whatsapp:''}];save()};
demo();

function renderFilters(){ $('filters').innerHTML=categories.map(c=>`<button class="filter ${c===selectedCategory?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{selectedCategory=b.dataset.cat;renderFilters();renderProducts()})}
const stockPill=p=>Number(p.stock)>0?`<span class="stock-pill ok">✓ Disponible</span>`:`<span class="stock-pill out">✕ Agotado</span>`;
function productCard(p,owner=false){const imgs=productImages(p);let pic=imgs[0]?`<img src="${imgs[0]}" alt="${esc(p.name)}">`:({Ropa:'👕',Sublimación:'☕',Accesorios:'🎒',Hogar:'🏠',Otros:'✨'}[p.category]||'🛍️');const badge=`<span class="tag">${esc(p.category)}</span>`;const countBadge=imgs.length>1?`<span class="photo-count" title="${imgs.length} fotos">📷 ${imgs.length}</span>`:'';return `<article class="panel product tilt3d" data-view="${p.id}" style="--r:${(p.id.length%5)-2}"><div class="product-image">${pic}<div class="img-shine"></div>${countBadge}</div><div class="product-body"><div class="row-tags">${badge}${stockPill(p)}</div><h3>${esc(p.name)}</h3><div class="price">${money(p.price)}</div><p class="muted">${esc((p.description||'Consulta los detalles.').slice(0,80))}</p><small class="muted">Tienda: ${esc(p.store||'Tienda')}</small><div class="product-buttons">${owner?`<button class="ghost" data-delete="${p.id}">Eliminar</button>`:`<button class="primary" data-contact="${p.id}">WhatsApp</button>`}<button class="v3-action" data-share="${p.id}">🔗 Compartir</button></div></div></article>`}
function lightbox(src,alt){const ov=document.createElement('div');ov.id='lightbox';ov.className='lightbox';ov.innerHTML=`<img src="${src}" alt="${esc(alt||'')}"><button class="lb-close" aria-label="Cerrar">×</button><div class="lb-hint tiny">Clic para cerrar · rueda/pinza para zoom</div>`;document.body.appendChild(ov);const img=ov.querySelector('img');let s=1,ox=50,oy=50;const apply=()=>{img.style.transformOrigin=ox+'% '+oy+'%';img.style.transform='scale('+s+')'};ov.onmousemove=e=>{if(s<=1)return;const r=ov.getBoundingClientRect();ox=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));oy=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));apply()};ov.onwheel=e=>{e.preventDefault();s=Math.max(1,Math.min(5,s+(e.deltaY<0?.4:-.4)));apply()};let pinch=0;ov.ontouchstart=e=>{if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);else{const t=e.touches[0],r=ov.getBoundingClientRect();ox=(t.clientX-r.left)/r.width*100;oy=(t.clientY-r.top)/r.height*100;apply()}};ov.ontouchmove=e=>{if(e.touches.length===2&&pinch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);s=Math.max(1,Math.min(5,s*(d/pinch)));pinch=d;apply()}};ov.onclick=e=>{if(e.target.closest('img')&&e.detail===2){s=s>1?1:2.5;apply();return}ov.remove()};}
function productImages(p){return Array.isArray(p.images)&&p.images.length?p.images:(p.image?[p.image]:[])}
function viewProduct(id){const p=productById(id);if(!p)return;const imgs=productImages(p);const pic=imgs[0]?`<img id="zoomImg" class="zoomable" src="${imgs[0]}" alt="${esc(p.name)}">`:`<div class="ph-big">${({Ropa:'👕',Sublimación:'☕',Accesorios:'🎒',Hogar:'🏠',Otros:'✨'}[p.category])||'🛍️'}</div>`;
openModal(`<div class="detail3d"><h2>${esc(p.name)}</h2>${stockPill(p)}<div class="zoom-wrap"><div class="zoom-lens" id="zoomLens"></div>${pic}</div>${imgs.length>1?`<div class="thumbs" id="detailThumbs">${imgs.map((src,i)=>`<img class="thumb ${i===0?'active':''}" src="${src}" data-i="${i}" alt="${esc(p.name)} ${i+1}">`).join('')}</div>`:''}<p class="zoom-hint muted tiny">Toca una miniatura para ver las fotos · toca la foto grande para hacer zoom · pinza para acercar en móvil</p><div class="price big">${money(p.price)}</div><p class="muted">${esc(p.description||'')}</p><div>${p.sizes?`<span class="tag">Tallas: ${esc(p.sizes)}</span>`:''}${p.colors?`<span class="tag">Colores: ${esc(p.colors)}</span>`:''}<span class="tag">Existencias: ${esc(p.stock)}</span></div><small class="muted">Tienda: ${esc(p.store||'Tienda')}</small><div class="product-buttons"><button class="primary" data-contact="${p.id}">WhatsApp</button><button class="v3-action" data-cart="${p.id}">＋ Carrito</button><button class="v3-action" data-notify="${p.id}">🔔 Avisar disponibilidad</button><button class="v3-action" data-share="${p.id}">🔗 Compartir</button></div></div>`);
document.querySelectorAll('#modalBody [data-cart]').forEach(b=>b.onclick=()=>addToCart(b.dataset.cart));
document.querySelectorAll('#modalBody [data-contact]').forEach(b=>b.onclick=()=>{closeModal();contact(b.dataset.contact)});
document.querySelectorAll('#modalBody [data-notify]').forEach(b=>b.onclick=()=>notifySeller(b.dataset.notify));
document.querySelectorAll('#modalBody [data-share]').forEach(b=>b.onclick=()=>shareProduct(b.dataset.share));
const thumbsWrap=$('detailThumbs');if(thumbsWrap)thumbsWrap.querySelectorAll('.thumb').forEach(t=>t.onclick=()=>{const main=$('zoomImg');if(main){main.src=t.src;thumbsWrap.querySelectorAll('.thumb').forEach(x=>x.classList.toggle('active',x===t))}});
initZoom();}
function notifySeller(id){const p=productById(id);if(!p)return;if(Number(p.stock)>0){toast('✓ El producto está disponible. Escríbele al vendedor por WhatsApp.');return}if(!session)return toast('Inicia sesión para pedir aviso de disponibilidad.');let alerts=db.notifications||[];alerts.push({id:'n'+Date.now(),product:id,name:p.name,buyer:session.name,buyerPhone:session.phone,owner:p.owner,store:p.store,createdAt:new Date().toISOString(),read:false});db.notifications=alerts;save();toast('🔔 Aviso enviado al vendedor: te contactará cuando haya existencias.');}
async function shareProduct(id){const p=productById(id);if(!p)return;const url=location.origin+location.pathname+'#producto-'+id;const text=`${p.name} · ${money(p.price)} · ${p.store||'Catálogo'}\n${url}`;try{if(navigator.share){await navigator.share({title:p.name,text,url})}else{await navigator.clipboard.writeText(text);toast('Enlace copiado al portapapeles.')}}catch(e){if(e&&e.name!=='AbortError')toast('No se pudo compartir.')}}
function initZoom(){const img=$('zoomImg');if(!img)return;const wrap=img.parentElement,lens=$('zoomLens');let scale=1,ox=0,oy=0;const apply=()=>{img.style.transformOrigin=`${ox}% ${oy}%`;img.style.transform=`scale(${scale})`;lens.style.opacity=scale>1?1:0};
const move=(x,y)=>{const r=wrap.getBoundingClientRect();ox=Math.max(0,Math.min(100,(x-r.left)/r.width*100));oy=Math.max(0,Math.min(100,(y-r.top)/r.height*100));apply()};
wrap.onmousemove=e=>move(e.clientX,e.clientY);wrap.onmouseleave=()=>{scale=1;ox=50;oy=50;apply()};
wrap.onwheel=e=>{e.preventDefault();scale=Math.max(1,Math.min(4,scale+(e.deltaY<0?.35:-.35)));apply()};
let pinch=0,px=0,py=0;wrap.ontouchstart=e=>{if(e.touches.length===2){pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY)}else{const t=e.touches[0];px=t.clientX;py=t.clientY;move(px,py)}};
wrap.ontouchmove=e=>{if(e.touches.length===2&&pinch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);scale=Math.max(1,Math.min(4,scale*(d/pinch)));pinch=d;apply()}else if(e.touches.length===1&&scale>1){const t=e.touches[0];move(t.clientX,t.clientY)}};
wrap.ontouchend=()=>{pinch=0};

wrap.onclick=e=>{
  if(e.detail===2){
    scale=scale>1?1:2.5;
    apply();
  }};}
function renderProducts(){let q=$('search').value.toLowerCase();let list=db.products.filter(p=>(selectedCategory==='Todos'||p.category===selectedCategory)&&(!q||(p.name+' '+p.description+' '+p.store).toLowerCase().includes(q)));$('products').innerHTML=list.map(p=>productCard(p)).join('');$('noProducts').classList.toggle('hidden',list.length>0);$('countProducts').textContent=db.products.length;$('countStores').textContent=new Set(db.products.map(p=>p.owner)).size;document.querySelectorAll('[data-contact]').forEach(b=>b.onclick=()=>contact(b.dataset.contact))}
function openModal(html){$('modalBody').innerHTML=html;$('modal').classList.remove('hidden')}
function closeModal(){$('modal').classList.add('hidden')}
$('closeModal').onclick=closeModal;
function register(){openModal(`<h2>Crear cuenta</h2><p>Cualquier persona puede crear una cuenta de cliente o abrir su propia tienda. La comisión de referencia para vendedores es del 8% por venta.</p><form class="modal-form" id="regForm"><label>Nombre completo<input id="rName" required></label><label>Teléfono con código de país<input id="rPhone" placeholder="+50370000000" required></label><label>Tipo de cuenta<select id="rRole"><option value="customer">Cliente</option><option value="seller">Vendedor</option></select></label><label>Nombre de tienda (obligatorio si eres vendedor)<input id="rStore" placeholder="Mi tienda"></label><label>Crear contraseña<input id="rPass" type="password" minlength="6" required></label><button class="btn primary">Continuar</button></form><p class="tiny">El código de prueba es 123456. Para producción se necesita conectar un proveedor SMS.</p>`);$('regForm').onsubmit=e=>{e.preventDefault();let phone=$('rPhone').value.trim();if($('rRole').value==='seller'&&!$('rStore').value.trim()){toast('Escribe el nombre de tu tienda.');return}if(db.users.some(u=>u.phone===phone)){toast('Ese teléfono ya está registrado.');return}let data={id:'u'+Date.now(),name:$('rName').value.trim(),phone,role:$('rRole').value,store:$('rStore').value.trim(),password:$('rPass').value,whatsapp:''};openModal(`<h2>Verificar teléfono</h2><p>Introduce el código SMS. En esta demostración utiliza <b>123456</b>.</p><form class="modal-form" id="otpForm"><label>Código de 6 dígitos<input id="otp" inputmode="numeric" maxlength="6" required></label><button class="btn primary">Verificar y crear cuenta</button></form>`);$('otpForm').onsubmit=ev=>{ev.preventDefault();if($('otp').value!=='123456'){toast('Código incorrecto.');return}db.users.push(data);save();session=data;closeModal();refresh();toast('Cuenta creada.')}}}
function login(){openModal(`<h2>Iniciar sesión</h2><form class="modal-form" id="loginForm"><label>Teléfono<input id="lPhone" placeholder="+503..." required></label><label>Contraseña<input id="lPass" type="password" required></label><button class="btn primary">Ingresar</button></form><button class="btn ghost" id="bioLogin" style="width:100%;margin-top:10px">♧ Entrar con biometría</button>`);$('loginForm').onsubmit=e=>{e.preventDefault();let u=db.users.find(x=>x.phone===$('lPhone').value.trim()&&x.password===$('lPass').value);if(!u){toast('Teléfono o contraseña incorrectos.');return}session=u;closeModal();refresh()};$('bioLogin').onclick=async()=>{const ok=await biometricAuth();if(ok){toast('La biometría del dispositivo fue aceptada. Para vincularla a una cuenta real se requiere autenticación segura del servidor.');}}}
function contact(id){if(!session){openModal(`<h2>Regístrate para consultar</h2><p>Para preguntar por WhatsApp necesitas una cuenta verificada.</p><button class="btn primary" id="needRegister" style="width:100%">Crear cuenta</button><button class="btn ghost" id="needLogin" style="width:100%;margin-top:8px">Ya tengo cuenta</button>`);$('needRegister').onclick=register;$('needLogin').onclick=login;return}let p=db.products.find(x=>x.id===id);if(!p)return;let phone=(p.whatsapp||'').replace(/\D/g,'');if(!phone){toast('El vendedor aún no configuró su WhatsApp.');return}let msg=`Hola, vi este producto en CATÁLOGO PRO 3D:\nProducto: ${p.name}\nPrecio: ${money(p.price)}\n¿Me puedes dar más información?`;window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank')}
function refresh(){renderFilters();renderProducts();$('userBadge').textContent=session?session.name:'Visitante';$('loginBtn').classList.toggle('hidden',!!session);$('registerBtn').classList.toggle('hidden',!!session);$('logoutBtn').classList.toggle('hidden',!session);$('dashboard').classList.toggle('hidden',!session);if(!session)return;$('dashTitle').textContent='Hola, '+session.name;$('myRole').textContent=session.role==='seller'?'Vendedor':'Cliente';$('myStore').textContent=session.store||'—';let mine=db.products.filter(p=>p.owner===session.id);$('myCount').textContent=mine.length;$('sellerProducts').innerHTML=mine.length?mine.map(p=>productCard(p,true)).join(''):'<div class="empty" style="grid-column:1/-1">Todavía no tienes productos publicados.</div>';document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{db.products=db.products.filter(p=>p.id!==b.dataset.delete);save();refresh()});$('addTab').classList.toggle('hidden',session.role!=='seller');$('storeName').value=session.store||'';$('storeWhatsapp').value=session.whatsapp||'';checkBiometricAvailability()}
function tab(name){document.querySelectorAll('.pane').forEach(p=>p.classList.add('hidden'));$(name).classList.remove('hidden');document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name))}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
/* Comprime y redimensiona una imagen antes de guardarla, para poder subir varias fotos sin agotar el almacenamiento local */
function compressImage(file, maxSide=900, quality=.72){return new Promise(resolve=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{let {width:w,height:h}=img;if(w>maxSide||h>maxSide){const k=maxSide/Math.max(w,h);w=Math.round(w*k);h=Math.round(h*k)}const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',quality))};img.onerror=()=>{URL.revokeObjectURL(url);resolve('')};img.src=url})}
let pendingFiles=[];
function renderFormImagesPreview(){const box=$('pImagesPreview');if(!box)return;box.innerHTML=pendingFiles.map((f,i)=>`<div class="form-thumb-wrap"><img class="form-thumb" src="${f.url}" alt="foto ${i+1}"><button type="button" class="form-thumb-remove" data-rm="${i}" aria-label="Quitar foto">×</button>${i===0?'<span class="form-thumb-main">Portada</span>':''}</div>`).join('');box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{pendingFiles.splice(+b.dataset.rm,1);renderFormImagesPreview()});}
$('pickPhotosBtn').onclick=()=>{
  const input=$('pImage');
  input.onchange=()=>{
    for(const f of input.files){
      if(pendingFiles.length>=8){toast('Máximo 8 fotos por producto.');break}
      if(!f.type.startsWith('image/'))continue;
      pendingFiles.push({file:f,url:URL.createObjectURL(f)});
    }
    renderFormImagesPreview();
    input.value='';
  };
  input.click();
};
$('productForm').onsubmit=async e=>{e.preventDefault();if(!session||session.role!=='seller')return toast('Solo vendedores pueden publicar.');const files=pendingFiles.map(x=>x.file);const images=(await Promise.all(files.map(f=>compressImage(f)))).filter(Boolean);if(files.length&&!images.length){toast('No se pudieron procesar las imágenes.');return}db.products.unshift({id:'p'+Date.now(),owner:session.id,name:$('pName').value,category:$('pCategory').value,price:Number($('pPrice').value),stock:Number($('pStock').value),sizes:$('pSizes').value,colors:$('pColors').value,description:$('pDescription').value,image:images[0]||'',images,store:session.store||session.name,whatsapp:session.whatsapp||''});try{save()}catch(err){toast('El almacenamiento local está lleno. Elimina productos antiguos o usa menos fotos.');return}pendingFiles=[];renderFormImagesPreview();e.target.reset();refresh();tab('myProducts');toast(images.length>1?'Producto publicado con '+images.length+' fotos':'Producto publicado')};
$('storeForm').onsubmit=e=>{e.preventDefault();session.store=$('storeName').value.trim();session.whatsapp=$('storeWhatsapp').value.trim();let i=db.users.findIndex(u=>u.id===session.id);if(i>=0)db.users[i]=session;db.products.filter(p=>p.owner===session.id).forEach(p=>{p.store=session.store;p.whatsapp=session.whatsapp});save();refresh();toast('Datos de tienda guardados')};
$('search').oninput=renderProducts;$('exploreBtn').onclick=()=>$('catalog').scrollIntoView({behavior:'smooth'});$('loginBtn').onclick=login;$('registerBtn').onclick=register;$('sellerBtn').onclick=()=>{if(session){$('dashboard').scrollIntoView({behavior:'smooth'});if(session.role!=='seller')toast('Tu cuenta actual es de cliente. Regístrate como vendedor para publicar.')}else register()};$('logoutBtn').onclick=()=>{session=null;refresh();toast('Sesión cerrada')};

/* Biometría: plugin nativo en APK; WebAuthn en navegadores compatibles.
   La autenticación biométrica no sustituye la validación de sesión del backend. */
let nativeBio=null, webCredentialId=localStorage.getItem('catalogo_bio_credential');
async function getNativeBio(){if(!Capacitor.isNativePlatform())return null;const p=globalThis.Capacitor?.Plugins?.BiometricAuth||globalThis.BiometricAuth;if(!p){console.warn('Plugin biométrico no disponible');return null}return p}
async function checkBiometricAvailability(){nativeBio=await getNativeBio();let msg='';if(nativeBio){try{let r=await nativeBio.checkBiometry();msg=r.isAvailable?'Biometría disponible en este dispositivo. El sistema elegirá huella, rostro u otro método admitido.':('Biometría no disponible: '+(r.reason||'configura un bloqueo biométrico en Android.'));}catch(e){msg='No se pudo consultar la biometría.'}}else if(window.PublicKeyCredential&&window.isSecureContext){msg='WebAuthn disponible. El navegador podrá solicitar huella, rostro o PIN del dispositivo según el equipo.'}else{msg='Este navegador/origen no ofrece biometría web. Usa HTTPS o instala la APK para la autenticación nativa.'}$('bioStatus').textContent=msg;$('enableBio').disabled=!(nativeBio|| (window.PublicKeyCredential&&window.isSecureContext));}
async function biometricAuth(){try{if(!nativeBio)nativeBio=await getNativeBio();if(nativeBio){const r=await nativeBio.checkBiometry();if(!r.isAvailable){toast(r.reason||'Configura huella o rostro en el teléfono.');return false}await nativeBio.authenticate({reason:'Confirma tu identidad para continuar en CATÁLOGO PRO 3D',cancelTitle:'Cancelar',allowDeviceCredential:true,androidTitle:'CATÁLOGO PRO 3D',androidSubtitle:'Confirma tu identidad',androidConfirmationRequired:false});return true}
 if(!window.PublicKeyCredential||!window.isSecureContext){toast('Biometría web requiere HTTPS y un autenticador compatible.');return false}
 if(!webCredentialId){toast('Primero activa el acceso biométrico en Seguridad.');return false}
 const challenge=crypto.getRandomValues(new Uint8Array(32));const raw=Uint8Array.from(atob(webCredentialId.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));await navigator.credentials.get({publicKey:{challenge,rpId:location.hostname,allowCredentials:[{type:'public-key',id:raw}],userVerification:'required',timeout:60000}});return true;
 }catch(e){console.warn(e);toast('No se completó la autenticación biométrica.');return false}}
$('enableBio').onclick=async()=>{try{if(!nativeBio)nativeBio=await getNativeBio();if(nativeBio){let r=await nativeBio.checkBiometry();if(!r.isAvailable){toast(r.reason||'No hay biometría configurada.');return}await nativeBio.authenticate({reason:'Confirma para activar el acceso biométrico',allowDeviceCredential:true,androidTitle:'Activar acceso',androidSubtitle:'Confirma tu identidad'});localStorage.setItem('catalogo_bio_enabled','native');toast('Biometría nativa lista en este dispositivo.');return}
 if(!window.PublicKeyCredential||!window.isSecureContext){toast('Para la web necesitas HTTPS y un dispositivo compatible.');return}
 const challenge=crypto.getRandomValues(new Uint8Array(32));const userId=crypto.getRandomValues(new Uint8Array(16));const credential=await navigator.credentials.create({publicKey:{challenge,rp:{name:'CATÁLOGO PRO 3D',id:location.hostname},user:{id:userId,name:session.phone,displayName:session.name},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},timeout:60000}});const id= btoa(String.fromCharCode(...new Uint8Array(credential.rawId))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');localStorage.setItem('catalogo_bio_credential',id);webCredentialId=id;toast('Autenticador del dispositivo registrado en este navegador.');}catch(e){console.warn(e);toast('No se pudo registrar la biometría. Comprueba bloqueo de pantalla y permisos.')}};
$('testBio').onclick=async()=>{if(await biometricAuth())toast('Autenticación local completada. En producción el servidor debe validar la sesión.');};
async function init(){if('serviceWorker'in navigator&&!Capacitor.isNativePlatform()){try{await navigator.serviceWorker.register('./sw.js')}catch(e){console.warn(e)}}}

/* Tema claro / oscuro con persistencia */
const THEME_KEY='catalogo_theme';
function applyTheme(t){document.documentElement.classList.toggle('dark',t==='dark');const b=$('themeBtn');if(b)b.textContent=t==='dark'?'☀️':'🌙';
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=t==='dark'?'#0b1522':'#0878e8';}
applyTheme(localStorage.getItem(THEME_KEY)||'light');
$('themeBtn').onclick=()=>{const t=document.documentElement.classList.contains('dark')?'light':'dark';localStorage.setItem(THEME_KEY,t);applyTheme(t);toast(t==='dark'?'🌙 Modo oscuro activado':'☀️ Modo claro activado')};
init();refresh();


/* ================= CATÁLOGO PRO 3D V3 =================
   Funciones locales de demostración: carrito, favoritos, pedidos,
   seguimiento básico y consola de administración de prototipo.
   Para operación real multiusuario se requiere backend y reglas seguras. */
const V3_CART='catalogo_v3_cart', V3_WISH='catalogo_v3_wishlist', V3_ORDERS='catalogo_v3_orders';
let cart=JSON.parse(localStorage.getItem(V3_CART)||'[]');
let wishlist=JSON.parse(localStorage.getItem(V3_WISH)||'[]');
let orders=JSON.parse(localStorage.getItem(V3_ORDERS)||'[]');
const persistV3=()=>{localStorage.setItem(V3_CART,JSON.stringify(cart));localStorage.setItem(V3_WISH,JSON.stringify(wishlist));localStorage.setItem(V3_ORDERS,JSON.stringify(orders));};
const productById=id=>db.products.find(p=>p.id===id);
function updateCartBadge(){const n=cart.reduce((sum,x)=>sum+x.qty,0);const el=$('cartCount');if(el)el.textContent=n;}
function addToCart(id){const p=productById(id);if(!p)return;if(Number(p.stock)<=0)return toast('Producto agotado.');const line=cart.find(x=>x.id===id);if(line){if(line.qty>=Number(p.stock))return toast('No hay más existencias disponibles.');line.qty++}else cart.push({id,qty:1});persistV3();updateCartBadge();toast('Producto agregado al carrito.');}
function toggleWish(id){wishlist=wishlist.includes(id)?wishlist.filter(x=>x!==id):[...wishlist,id];persistV3();toast(wishlist.includes(id)?'Agregado a favoritos.':'Quitado de favoritos.');renderProducts();}
function renderStores(){const el=$('storeCards');if(!el)return;const stores=[...new Map(db.products.map(p=>[p.owner,{owner:p.owner,name:p.store||'Tienda',count:db.products.filter(x=>x.owner===p.owner).length}])).values()];el.innerHTML=stores.length?stores.map(x=>`<article class="store-tile"><strong>✦ ${esc(x.name)}</strong><small>${x.count} producto(s) publicados</small><p><button class="v3-action" data-store="${esc(x.owner)}">Ver productos</button></p></article>`).join(''):'<p class="muted">Las tiendas aparecerán aquí cuando publiquen productos.</p>';el.querySelectorAll('[data-store]').forEach(b=>b.onclick=()=>{const owner=b.dataset.store;const p=db.products.find(x=>x.owner===owner);if(p){$('search').value=p.store||'';selectedCategory='Todos';renderFilters();renderProducts();$('catalog').scrollIntoView({behavior:'smooth'});}});}
const baseProductCard=productCard;
productCard=function(p,owner=false){let html=baseProductCard(p,owner);if(!owner){const extra=`<button class="v3-action" data-cart="${esc(p.id)}">＋ Carrito</button><button class="v3-action" data-wish="${esc(p.id)}">${wishlist.includes(p.id)?'♥':'♡'} Favorito</button>`;html=html.replace(/<div class="product-buttons">/,`<div class="product-buttons">${extra}`);}return html;};
const baseRenderProducts=renderProducts;
renderProducts=function(){baseRenderProducts();document.querySelectorAll('[data-cart]').forEach(b=>b.onclick=()=>addToCart(b.dataset.cart));document.querySelectorAll('[data-wish]').forEach(b=>b.onclick=()=>toggleWish(b.dataset.wish));document.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>shareProduct(b.dataset.share));document.querySelectorAll('.tilt3d').forEach(c=>c.onclick=e=>{if(e.target.closest('button'))return;const id=c.dataset.view;if(e.target.closest('.product-image')){const p=productById(id);if(p){const imgs=productImages(p);if(imgs.length)openImageViewer(imgs[0],p.name,imgs);else viewProduct(id);return}viewProduct(id);return}viewProduct(id)});renderStores();};
function showCart(){const lines=cart.map(x=>({...x,p:productById(x.id)})).filter(x=>x.p);const total=lines.reduce((s,x)=>s+x.p.price*x.qty,0);openModal(`<h2>🛒 Mi carrito</h2>${lines.length?lines.map(x=>`<div class="cart-line"><div><b>${esc(x.p.name)}</b><div class="muted tiny">${money(x.p.price)} · ${esc(x.p.store||'Tienda')}</div></div><div><input type="number" min="1" max="${Math.max(1,Number(x.p.stock))}" value="${x.qty}" data-qty="${esc(x.id)}"><button class="ghost small" data-remove="${esc(x.id)}">Quitar</button></div></div>`).join(''):`<p class="muted">Tu carrito está vacío. Explora el catálogo para agregar productos.</p>`}<h3>Total: ${money(total)}</h3>${lines.length?'<button class="btn primary" id="checkoutBtn" style="width:100%">Continuar al pedido</button>':''}`);document.querySelectorAll('[data-qty]').forEach(i=>i.onchange=()=>{const p=productById(i.dataset.qty);const q=Math.max(1,Math.min(Number(i.value)||1,Number(p?.stock)||1));cart.find(x=>x.id===i.dataset.qty).qty=q;persistV3();showCart();updateCartBadge()});document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x.id!==b.dataset.remove);persistV3();showCart();updateCartBadge()});const checkout=$('checkoutBtn');if(checkout)checkout.onclick=checkoutForm;}
function checkoutForm(){if(!session){toast('Inicia sesión para realizar un pedido.');closeModal();login();return;}const lines=cart.map(x=>({...x,p:productById(x.id)})).filter(x=>x.p);if(!lines.length)return;openModal(`<h2>Confirmar pedido</h2><p>Completa tus datos para registrar tu pedido. El pago se coordina directamente con la tienda. La comisión de plataforma se descuenta al vendedor y no se suma a tu total.</p><form class="modal-form" id="checkoutForm"><label>Nombre para entrega<input id="buyerName" value="${esc(session.name)}" required></label><label>Teléfono<input id="buyerPhone" value="${esc(session.phone)}" required></label><label>Dirección / punto de entrega<textarea id="buyerAddress" rows="2" required></textarea></label><label>Notas (opcional)<textarea id="buyerNotes" rows="2"></textarea></label><button class="btn primary">Crear pedido · ${money(lines.reduce((s,x)=>s+x.p.price*x.qty,0))}</button></form>`);$('checkoutForm').onsubmit=e=>{e.preventDefault();for(const x of lines){if(Number(x.p.stock)<x.qty){toast('Stock insuficiente para '+x.p.name);return;}}const order={id:'ORD-'+Date.now().toString().slice(-8),buyer:session.id,buyerName:$('buyerName').value.trim(),phone:$('buyerPhone').value.trim(),address:$('buyerAddress').value.trim(),notes:$('buyerNotes').value.trim(),items:lines.map(x=>({id:x.p.id,name:x.p.name,owner:x.p.owner,store:x.p.store,price:x.p.price,qty:x.qty})),total:lines.reduce((s,x)=>s+x.p.price*x.qty,0),commissionRate:PLATFORM_COMMISSION_RATE,platformCommission:lines.reduce((s,x)=>s+x.p.price*x.qty,0)*PLATFORM_COMMISSION_RATE/100,sellerNet:lines.reduce((s,x)=>s+x.p.price*x.qty,0)*(1-PLATFORM_COMMISSION_RATE/100),status:'Pendiente',createdAt:new Date().toISOString()};orders.unshift(order);lines.forEach(x=>x.p.stock=Number(x.p.stock)-x.qty);cart=[];persistV3();save();closeModal();refresh();updateCartBadge();toast('Pedido registrado: '+order.id);};}
function showWishlist(){const items=wishlist.map(productById).filter(Boolean);openModal(`<h2>♡ Mis favoritos</h2>${items.length?items.map(p=>`<div class="cart-line"><div><b>${esc(p.name)}</b><div class="muted tiny">${money(p.price)} · ${esc(p.store||'Tienda')}</div></div><button class="v3-action" data-wcart="${esc(p.id)}">Agregar</button></div>`).join(''):'<p class="muted">Todavía no guardas favoritos.</p>'}`);document.querySelectorAll('[data-wcart]').forEach(b=>b.onclick=()=>{addToCart(b.dataset.wcart);});}
function renderOrders(){const mine=orders.filter(o=>o.buyer===session?.id);const seller=orders.filter(o=>o.items.some(i=>i.owner===session?.id));const list=session?.role==='seller'?[...new Map([...mine,...seller].map(o=>[o.id,o])).values()]:mine;const el=$('myOrders');if(!el)return;el.innerHTML=list.length?list.map(o=>`<article class="order-card"><h4>${esc(o.id)} · ${money(o.total)}</h4><div class="muted tiny">${new Date(o.createdAt).toLocaleString('es-SV')} · ${esc(o.buyerName)}</div><div class="order-status">${esc(o.status)}</div><p class="tiny">${o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join('<br>')}</p>${session.role==='seller'?`<div class="notice tiny">Venta bruta: ${money(o.items.filter(i=>i.owner===session.id).reduce((s,i)=>s+i.price*i.qty,0))} · Comisión estimada (${Number(o.commissionRate??PLATFORM_COMMISSION_RATE)}%): ${money(o.items.filter(i=>i.owner===session.id).reduce((s,i)=>s+i.price*i.qty,0)*Number(o.commissionRate??PLATFORM_COMMISSION_RATE)/100)} · Neto estimado: ${money(o.items.filter(i=>i.owner===session.id).reduce((s,i)=>s+i.price*i.qty,0)*(1-Number(o.commissionRate??PLATFORM_COMMISSION_RATE)/100))}<br><b>Simulación local:</b> el cobro real requiere backend y pasarela.</div>`:''}${session.role==='seller'?`<label class="tiny">Actualizar estado <select data-order="${esc(o.id)}"><option ${o.status==='Pendiente'?'selected':''}>Pendiente</option><option ${o.status==='Confirmado'?'selected':''}>Confirmado</option><option ${o.status==='Preparando'?'selected':''}>Preparando</option><option ${o.status==='Enviado'?'selected':''}>Enviado</option><option ${o.status==='Entregado'?'selected':''}>Entregado</option><option ${o.status==='Cancelado'?'selected':''}>Cancelado</option></select></label>`:''}</article>`).join(''):'<p class="muted">Aún no tienes pedidos registrados.</p>';el.querySelectorAll('[data-order]').forEach(sel=>sel.onchange=()=>{const o=orders.find(x=>x.id===sel.dataset.order);if(o){o.status=sel.value;persistV3();renderOrders();toast('Estado del pedido actualizado.');}});}
$('cartBtn').onclick=showCart;$('wishBtn').onclick=showWishlist;
const oldRefreshV3=refresh;
refresh=function(){oldRefreshV3();updateCartBadge();renderOrders();renderSellerAlerts();};
function renderSellerAlerts(){const el=$('sellerAlerts');if(!el)return;const list=(db.notifications||[]).filter(n=>n.owner===session?.id);el.innerHTML=list.length?`<div class="panel notice" style="margin-bottom:12px"><h3 style="margin:0 0 8px">🔔 Solicitudes de disponibilidad</h3>${list.map(n=>`<div class="cart-line"><div><b>${esc(n.name)}</b><div class="muted tiny">${esc(n.buyer)} · ${esc(n.buyerPhone)} · ${new Date(n.createdAt).toLocaleString('es-SV')}</div></div><button class="v3-action" data-wa="${esc(n.buyerPhone)}" data-pname="${esc(n.name)}">WhatsApp</button></div>`).join('')}</div>`:'';el.querySelectorAll('[data-wa]').forEach(b=>b.onclick=()=>window.open('https://wa.me/'+b.dataset.wa.replace(/\D/g,'')+'?text='+encodeURIComponent('Hola, tu producto solicitado "'+b.dataset.pname+'" ya está disponible.'),'_blank'));}
const oldTabV3=tab;
tab=function(name){oldTabV3(name);if(name==='ordersPane')renderOrders();};
updateCartBadge();renderProducts();renderOrders();
$('bannerCta').onclick=()=>{$('catalog').scrollIntoView({behavior:'smooth'})};
let viewerImages = [];
let viewerIndex = 0;

function openImageViewer(image, title = "Producto", images = []) {
  viewerImages = images.length ? images : (image ? [image] : []);
  if(!viewerImages.length) return;
  viewerIndex = Math.max(0, viewerImages.indexOf(image));
  updateViewer();
  document.getElementById("imageViewer").classList.remove("hidden");
}

function updateViewer() {
  const img = document.getElementById("viewerImage");
  img.src = viewerImages[viewerIndex];
  const counter = document.getElementById("viewerCounter");
  if (counter) counter.textContent = viewerImages.length > 1 ? `${viewerIndex + 1} / ${viewerImages.length}` : "";
}

function closeImageViewer() {
  document.getElementById("imageViewer").classList.add("hidden");
}

function changeViewerImage(direction) {
  if (!viewerImages.length) return;
  viewerIndex = (viewerIndex + direction + viewerImages.length) % viewerImages.length;
  updateViewer();
}

const viewerEl = document.getElementById("imageViewer");
viewerEl.addEventListener("click", function(event) {
  if (event.target === this || event.target.closest(".viewer-content")) closeImageViewer();
});
document.getElementById("viewerClose").onclick = closeImageViewer;
document.getElementById("viewerPrev").onclick = () => changeViewerImage(-1);
document.getElementById("viewerNext").onclick = () => changeViewerImage(1);

/* Deslizar con el dedo en el móvil para cambiar de foto */
let viewerTouchX = null;
viewerEl.addEventListener("touchstart", e => { viewerTouchX = e.touches[0].clientX; }, {passive:true});
viewerEl.addEventListener("touchend", e => {
  if (viewerTouchX === null) return;
  const dx = e.changedTouches[0].clientX - viewerTouchX;
  viewerTouchX = null;
  if (Math.abs(dx) > 50 && viewerImages.length > 1) changeViewerImage(dx < 0 ? 1 : -1);
}, {passive:true});

document.addEventListener("keydown", function(event) {
  if (document.getElementById("imageViewer").classList.contains("hidden")) return;
  if (event.key === "Escape") closeImageViewer();
  if (event.key === "ArrowLeft") changeViewerImage(-1);
  if (event.key === "ArrowRight") changeViewerImage(1);
});