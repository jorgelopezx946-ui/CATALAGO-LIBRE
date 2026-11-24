/* CAPACITOR: se usa el objeto global que inyecta Capacitor en la APK.
   En web/HTTP no existe: se usa un objeto compatible con isNativePlatform()=false.
   Así el mismo archivo funciona en Vite/navegador y dentro de la APK, sin bundler. */
const Capacitor = globalThis.Capacitor || { isNativePlatform: () => false, getPlatform: () => 'web', isPluginAvailable: () => false };

const DB='catalogo_pro_v4';
const PLATFORM_COMMISSION_RATE=8; // Porcentaje de referencia; en producción lo calcula el servidor.
const categories=['Todos','Ropa','Sublimación','Accesorios','Hogar','Otros'];
let db=JSON.parse(localStorage.getItem(DB)||'{"users":[],"products":[]}');
let session=null, selectedCategory='Todos', editId=null;
function toggleFeatured(id){const p=productById(id);if(!p)return;const mine=db.products.filter(x=>x.owner===p.owner&&x.featured);if(!p.featured&&mine.length>=4)return toast('Máximo 4 productos destacados. Quita la marca de otro primero.');p.featured=!p.featured;save();refresh();toast(p.featured?'⭐ Producto marcado como destacado.':'Producto quitado de destacados.')}

/* ===== CATÁLOGO PRO: ofertas, destacados y filtros avanzados ===== */
const priceOf=p=>Number(p.salePrice!=null&&p.salePrice!==''?p.salePrice:p.price)||0;
const originalOf=p=>{const s=Number(p.salePrice),b=Number(p.price);return (s&&b&&s<b)?b:0};
const isOffer=p=>originalOf(p)>0;
const isFeatured=p=>!!p.featured;
let filterStore='',filterMin=null,filterMax=null,filterSort='new',onlyOffers=false,onlyFavs=false;

/* ===== COMUNIDAD: calificaciones, opiniones, preguntas y notificaciones ===== */
const COMM_KEY='catalogo_community_v1';
let community=JSON.parse(localStorage.getItem(COMM_KEY)||'{}');
community.ratings=community.ratings||[];   // {id, product, owner, store, buyer, buyerName, stars, text, createdAt}
community.qa=community.qa||[];             // {id, product, store, buyer, buyerName, question, answer, answeredAt, createdAt}
community.notifs=community.notifs||[];     // {id, to, type, title, body, read, createdAt}
const persistComm=()=>localStorage.setItem(COMM_KEY,JSON.stringify(community));
const starsHtml=n=>'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n));
const fmtWhen=iso=>new Date(iso).toLocaleDateString('es-SV',{day:'numeric',month:'short',year:'numeric'});
function notifyUser(to,type,title,body){community.notifs.unshift({id:'n'+Date.now()+Math.floor(Math.random()*99),to,type,title,body,read:false,createdAt:new Date().toISOString()});persistComm();updateNotifBadge()}
function myNotifs(){return community.notifs.filter(n=>n.to===(session?.id||'__guest__'))}
function unreadCount(){return myNotifs().filter(n=>!n.read).length}
function updateNotifBadge(){const el=$('notifCount');if(!el)return;const n=unreadCount();el.textContent=n;el.classList.toggle('hidden',n===0)}
function ownerRating(owner){const rs=community.ratings.filter(r=>r.owner===owner);if(!rs.length)return null;return {avg:rs.reduce((s,r)=>s+r.stars,0)/rs.length,count:rs.length}}
function productRating(pid){const rs=community.ratings.filter(r=>r.product===pid);if(!rs.length)return null;return {avg:rs.reduce((s,r)=>s+r.stars,0)/rs.length,count:rs.length}}
const $=id=>document.getElementById(id);
const save=()=>localStorage.setItem(DB,JSON.stringify(db));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+Number(n||0).toFixed(2);
const toast=m=>{const t=$('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800)};
const demo=()=>{if(db.products.length)return;db.products=[
{id:'demo-1',owner:'demo',name:'Camiseta personalizada',category:'Ropa',price:12,salePrice:9.5,featured:true,stock:12,sizes:'S, M, L, XL, XXL',colors:'Negro, blanco, azul',description:'Camiseta con diseño personalizado. Pregunta por tallas y colores.',image:'',store:'Tienda Demo',whatsapp:''},
{id:'demo-2',owner:'demo',name:'Taza sublimada',category:'Sublimación',price:6,salePrice:'',featured:false,stock:20,sizes:'11 oz',colors:'Blanco',description:'Taza personalizada con fotografía, nombre o diseño.',image:'',store:'Sublima Studio',whatsapp:''},
{id:'demo-3',owner:'demo',name:'Termo personalizado',category:'Sublimación',price:15,salePrice:12,featured:true,stock:7,sizes:'20 oz',colors:'Varios',description:'Termo reutilizable para regalos y diseños personalizados.',image:'',store:'Sublima Studio',whatsapp:''}];save()};
demo();

function renderFilters(){ $('filters').innerHTML=categories.map(c=>`<button class="filter ${c===selectedCategory?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{selectedCategory=b.dataset.cat;renderFilters();renderProducts()})}
const stockPill=p=>Number(p.stock)>0?`<span class="stock-pill ok">✓ Disponible</span>`:`<span class="stock-pill out">✕ Agotado</span>`;
function productCard(p,owner=false){const imgs=productImages(p);let pic=imgs[0]?`<img src="${imgs[0]}" alt="${esc(p.name)}">`:({Ropa:'👕',Sublimación:'☕',Accesorios:'🎒',Hogar:'🏠',Otros:'✨'}[p.category]||'🛍️');const badge=`<span class="tag">${esc(p.category)}</span>`;const countBadge=imgs.length>1?`<span class="photo-count" title="${imgs.length} fotos">📷 ${imgs.length}</span>`:'';const promo=isOffer(p)?`<span class="tag-offer">🔥 -${Math.round((1-priceOf(p)/originalOf(p))*100)}%</span>`:(isFeatured(p)?`<span class="tag-featured">⭐ Destacado</span>`:'');const priceHtml=isOffer(p)?`<span class="old-price">${money(originalOf(p))}</span><span class="price new-price" style="margin:0">${money(priceOf(p))}</span>`:`<div class="price">${money(priceOf(p))}</div>`;return `<article class="panel product tilt3d" data-view="${p.id}" style="--r:${(p.id.length%5)-2}"><div class="product-image">${pic}<div class="img-shine"></div>${countBadge}${promo}</div><div class="product-body"><div class="row-tags">${badge}${stockPill(p)}</div><h3>${esc(p.name)}</h3>${priceHtml}<p class="muted">${esc((p.description||'Consulta los detalles.').slice(0,80))}</p><small class="muted">Tienda: <a href="#" data-storelink="${esc(p.owner)}"><b>${esc(p.store||'Tienda')}</b></a></small><div class="product-buttons">${owner?`<button class="ghost" data-delete="${p.id}">Eliminar</button>`:`<button class="primary" data-contact="${p.id}">WhatsApp</button>`}<button class="v3-action" data-share="${p.id}">🔗 Compartir</button></div></div></article>`}
function lightbox(src,alt){const ov=document.createElement('div');ov.id='lightbox';ov.className='lightbox';ov.innerHTML=`<img src="${src}" alt="${esc(alt||'')}"><button class="lb-close" aria-label="Cerrar">×</button><div class="lb-hint tiny">Clic para cerrar · rueda/pinza para zoom</div>`;document.body.appendChild(ov);const img=ov.querySelector('img');let s=1,ox=50,oy=50;const apply=()=>{img.style.transformOrigin=ox+'% '+oy+'%';img.style.transform='scale('+s+')'};ov.onmousemove=e=>{if(s<=1)return;const r=ov.getBoundingClientRect();ox=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));oy=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));apply()};ov.onwheel=e=>{e.preventDefault();s=Math.max(1,Math.min(5,s+(e.deltaY<0?.4:-.4)));apply()};let pinch=0;ov.ontouchstart=e=>{if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);else{const t=e.touches[0],r=ov.getBoundingClientRect();ox=(t.clientX-r.left)/r.width*100;oy=(t.clientY-r.top)/r.height*100;apply()}};ov.ontouchmove=e=>{if(e.touches.length===2&&pinch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);s=Math.max(1,Math.min(5,s*(d/pinch)));pinch=d;apply()}};ov.onclick=e=>{if(e.target.closest('img')&&e.detail===2){s=s>1?1:2.5;apply();return}ov.remove()};}
function productImages(p){return Array.isArray(p.images)&&p.images.length?p.images:(p.image?[p.image]:[])}
function relatedHtml(p){const others=db.products.filter(x=>x.id!==p.id&&(x.category===p.category||x.owner===p.owner)).slice(0,6);if(!others.length)return '';return `<div class="related-wrap"><h3>🔎 Productos relacionados</h3><div class="related-track">${others.map(o=>{const im=productImages(o)[0];return `<button class="related-card" data-related="${o.id}">${im?`<img src="${im}" alt="${esc(o.name)}">`:`<div style="height:90px;display:grid;place-items:center;font-size:34px">🛍️</div>`}<span class="r-name">${esc(o.name)}</span><span class="r-price">${money(priceOf(o))}</span></button>`}).join('')}</div></div>`}
function starsInputHtml(id){return `<div class="stars-input" data-stars-id="${id}">${[1,2,3,4,5].map(v=>`<span data-v="${v}">★</span>`).join('')}</div>`}
function productReviewsHtml(p){const rs=community.ratings.filter(r=>r.product===p.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));return `<div class="related-wrap"><h3>💬 Opiniones de compradores (${rs.length})</h3>${rs.length?rs.map(r=>`<div class="review-card"><div class="review-head"><b>${esc(r.buyerName||'Comprador')}</b><span class="stars">${starsHtml(r.stars)}</span><span class="review-when">${fmtWhen(r.createdAt)}</span></div>${r.text?`<p class="tiny">${esc(r.text)}</p>`:''}</div>`).join(''):'<p class="tiny muted">Aún no hay opiniones. ¡Sé el primero en calificar!</p>'}${session?`<div class="review-card"><b class="tiny">Deja tu opinión</b>${starsInputHtml('rev')}
<textarea id="revText" rows="2" placeholder="¿Qué te pareció el producto y la atención de la tienda?"></textarea>
<button class="btn primary small" id="revSend" style="margin-top:8px">Publicar opinión</button></div>`:'<p class="tiny muted">Inicia sesión para dejar tu opinión.</p>'}</div>`}
function productQaHtml(p){const qs=community.qa.filter(q=>q.product===p.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));const isSeller=session&&session.id===p.owner;return `<div class="related-wrap"><h3>❓ Preguntas sobre este producto (${qs.length})</h3>${qs.length?qs.map(q=>`<div class="qa-card"><div class="qa-q"><b>${esc(q.buyerName||'Comprador')}:</b> ${esc(q.question)} <span class="review-when">· ${fmtWhen(q.createdAt)}</span></div>${q.answer?`<div class="qa-a"><b>${esc(q.store||'Tienda')}:</b> ${esc(q.answer)}</div>`:(isSeller?`<div class="qa-a"><input id="qaAns-${q.id}" placeholder="Escribe tu respuesta..."><button class="btn primary small" data-ans="${q.id}" style="margin-top:6px">Responder</button></div>`:'<div class="qa-a tiny">La tienda aún no responde.</div>')}</div>`).join(''):'<p class="tiny muted">Nadie ha preguntado todavía.</p>'}${session&&!isSeller?`<div class="qa-card"><input id="qaNew" placeholder="Haz una pregunta sobre este producto..."><button class="btn primary small" id="qaAsk" style="margin-top:8px">Preguntar</button></div>`:''}</div>`}
function bindCommunityUi(p){
  const send=$('revSend');
  if(send)send.onclick=()=>{
    const box=document.querySelector('.stars-input[data-stars-id="rev"]');
    const val=+(box?.dataset.value||0);
    if(!val)return toast('Selecciona las estrellas primero.');
    const txt=$('revText').value.trim();
    community.ratings.unshift({id:'r'+Date.now(),product:p.id,owner:p.owner,store:p.store,buyer:session.id,buyerName:session.name,stars:val,text:txt,createdAt:new Date().toISOString()});
    persistComm();notifyUser(p.owner,'review','Nueva calificación',session.name+' calificó "'+p.name+'" con '+val+' estrellas.');
    toast('¡Gracias por tu opinión!');viewProduct(p.id);
  };
  document.querySelectorAll('.stars-input').forEach(box=>{
    const spans=[...box.querySelectorAll('span')];
    const paint=v=>spans.forEach(s=>s.classList.toggle('on',+s.dataset.v<=v));
    spans.forEach(s=>{s.onmouseenter=()=>paint(+s.dataset.v)});
    box.onmouseleave=()=>paint(+(box.dataset.value||0));
    spans.forEach(s=>{s.onclick=()=>{paint(+s.dataset.v);box.dataset.value=s.dataset.v}});
  });
  const ask=$('qaAsk');
  if(ask)ask.onclick=()=>{
    const q=$('qaNew').value.trim();
    if(!q)return toast('Escribe tu pregunta.');
    community.qa.unshift({id:'q'+Date.now(),product:p.id,owner:p.owner,store:p.store,buyer:session.id,buyerName:session.name,question:q,answer:'',answeredAt:'',createdAt:new Date().toISOString()});
    persistComm();notifyUser(p.owner,'question','Nueva pregunta',session.name+' preguntó: "'+q.slice(0,60)+'"');
    toast('Pregunta enviada a la tienda.');viewProduct(p.id);
  };
  document.querySelectorAll('[data-ans]').forEach(b=>b.onclick=()=>{
    const qa=community.qa.find(x=>x.id===b.dataset.ans);
    const ans=$('qaAns-'+b.dataset.ans).value.trim();
    if(!ans)return toast('Escribe la respuesta.');
    qa.answer=ans;qa.answeredAt=new Date().toISOString();persistComm();
    notifyUser(qa.buyer,'answer','Respondieron tu pregunta',p.store+': "'+ans.slice(0,60)+'"');
    toast('Respuesta publicada.');viewProduct(p.id);
  });
}
function viewProduct(id){const p=productById(id);if(!p)return;const imgs=productImages(p);const pic=imgs[0]?`<img id="zoomImg" class="zoomable" src="${imgs[0]}" alt="${esc(p.name)}">`:`<div class="ph-big">${({Ropa:'👕',Sublimación:'☕',Accesorios:'🎒',Hogar:'🏠',Otros:'✨'}[p.category])||'🛍️'}</div>`;
openModal(`<div class="detail3d"><h2>${esc(p.name)}</h2>${stockPill(p)}<div class="zoom-wrap"><div class="zoom-lens" id="zoomLens"></div>${pic}</div>${imgs.length>1?`<div class="thumbs" id="detailThumbs">${imgs.map((src,i)=>`<img class="thumb ${i===0?'active':''}" src="${src}" data-i="${i}" alt="${esc(p.name)} ${i+1}">`).join('')}</div>`:''}<p class="zoom-hint muted tiny">Toca una miniatura para ver las fotos · toca la foto grande para hacer zoom · pinza para acercar en móvil</p><div class="price big">${money(priceOf(p))}</div>${isOffer(p)?`<p class="tiny muted"><span style="text-decoration:line-through">${money(originalOf(p))}</span> · ¡precio de oferta!</p>`:''}<p class="muted">${esc(p.description||'')}</p><div>${p.sizes?`<span class="tag">Tallas: ${esc(p.sizes)}</span>`:''}${p.colors?`<span class="tag">Colores: ${esc(p.colors)}</span>`:''}<span class="tag">Existencias: ${esc(p.stock)}</span></div><small class="muted">Tienda: <a href="#" data-storelink="${esc(p.owner)}"><b>${esc(p.store||'Tienda')}</b></a></small><div class="product-buttons"><button class="primary" data-contact="${p.id}">WhatsApp</button><button class="v3-action" data-cart="${p.id}">＋ Carrito</button><button class="v3-action" data-wish="${p.id}">${wishlist.includes(p.id)?'♥':'♡'} Favorito</button><button class="v3-action" data-share="${p.id}">🔗 Compartir</button></div>${relatedHtml(p)}${productReviewsHtml(p)}${productQaHtml(p)}</div>`);
document.querySelectorAll('#modalBody [data-cart]').forEach(b=>b.onclick=()=>addToCart(b.dataset.cart));
document.querySelectorAll('#modalBody [data-contact]').forEach(b=>b.onclick=()=>{closeModal();contact(b.dataset.contact)});
document.querySelectorAll('#modalBody [data-wish]').forEach(b=>b.onclick=()=>toggleWish(b.dataset.wish));
document.querySelectorAll('#modalBody [data-share]').forEach(b=>b.onclick=()=>shareProduct(b.dataset.share));
document.querySelectorAll('#modalBody [data-related]').forEach(b=>b.onclick=()=>{closeModal();viewProduct(b.dataset.related)});
document.querySelectorAll('#modalBody [data-storelink]').forEach(b=>b.onclick=()=>{closeModal();openStoreProfile(b.dataset.storelink)});
bindCommunityUi(p);
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
function filteredProducts(){let q=$('search').value.toLowerCase();return db.products.filter(p=>(selectedCategory==='Todos'||p.category===selectedCategory)&&(!q||(p.name+' '+p.description+' '+p.store).toLowerCase().includes(q))&&(!filterStore||p.owner===filterStore)&&(filterMin==null||priceOf(p)>=filterMin)&&(filterMax==null||priceOf(p)<=filterMax)&&(!onlyOffers||isOffer(p))&&(!onlyFavs||wishlist.includes(p.id)))}
function sortList(list){const s=[...list];if(filterSort==='priceAsc')s.sort((a,b)=>priceOf(a)-priceOf(b));else if(filterSort==='priceDesc')s.sort((a,b)=>priceOf(b)-priceOf(a));else if(filterSort==='name')s.sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));else s.sort((a,b)=>String(b.id).localeCompare(String(a.id)));return s}
function renderProducts(){const list=sortList(filteredProducts());$('products').innerHTML=list.map(p=>productCard(p)).join('');$('noProducts').classList.toggle('hidden',list.length>0);$('countProducts').textContent=db.products.length;$('countStores').textContent=new Set(db.products.map(p=>p.owner)).size;document.querySelectorAll('[data-contact]').forEach(b=>b.onclick=()=>contact(b.dataset.contact))}
function bindStoreLinks(){document.querySelectorAll('[data-storelink]').forEach(b=>{if(b.onclick)return;b.onclick=e=>{e.preventDefault();openStoreProfile(b.dataset.storelink)}})}
function renderStoreOptions(){const sel=$('filterStore');if(!sel)return;const stores=[...new Map(db.products.map(p=>[p.owner,p.store||'Tienda'])).entries()];const cur=sel.value;sel.innerHTML='<option value="">🏬 Todas las tiendas</option>'+stores.map(([id,name])=>`<option value="${esc(id)}"${id===cur?' selected':''}>${esc(name)}</option>`).join('')}
function readAdvancedFilters(){const min=$('filterMin').value,max=$('filterMax').value;filterStore=$('filterStore').value;filterMin=min===''?null:Number(min);filterMax=max===''?null:Number(max);if(filterMin!=null&&filterMax!=null&&filterMin>filterMax){const t=filterMin;filterMin=filterMax;filterMax=t}filterSort=$('filterSort').value;onlyOffers=$('filterOffers').checked;onlyFavs=$('filterFavs').checked;renderProducts();renderOffersAndFeatured()}
function renderOffersAndFeatured(){const og=$('offersGrid'),fg=$('featuredGrid');if(!og||!fg)return;const offers=sortList(db.products.filter(isOffer)).slice(0,8);const featured=sortList(db.products.filter(p=>isFeatured(p)&&!isOffer(p))).slice(0,8);og.innerHTML=offers.length?offers.map(p=>productCard(p)).join(''):'<p class="empty-hint">Las ofertas aparecerán aquí: agrega un <b>precio de oferta</b> menor al precio normal al publicar un producto.</p>';fg.innerHTML=featured.length?featured.map(p=>productCard(p)).join(''):'<p class="empty-hint">Los vendedores pueden marcar hasta 4 productos como <b>⭐ destacados</b> desde "Mis productos".</p>';[og,fg].forEach(g=>{g.querySelectorAll('[data-contact]').forEach(b=>b.onclick=()=>contact(b.dataset.contact))})}

/* Sincronización con Supabase: mezcla los productos de la nube con los locales.
   Si las tablas de Supabase aún no existen, simplemente se muestra el catálogo local. */
import { cloudProducts } from './supabase-sync.js';
let cloudLoaded=false;
async function syncCloud(){try{const cloud=await cloudProducts();if(cloud.length){const localIds=new Set(db.products.map(p=>p.id));db.products=cloud.filter(p=>!localIds.has(p.id)).concat(db.products);save();renderProducts();toast('☁ '+cloud.length+' productos sincronizados desde la nube.')}}catch(e){console.warn(e)}}
setTimeout(()=>{if(!cloudLoaded){cloudLoaded=true;syncCloud()}},800);
function openModal(html){$('modalBody').innerHTML=html;$('modal').classList.remove('hidden')}
function closeModal(){$('modal').classList.add('hidden')}
$('closeModal').onclick=closeModal;
function register(){openModal(`<h2>Crear cuenta</h2><p>Cualquier persona puede crear una cuenta de cliente o abrir su propia tienda. La comisión de referencia para vendedores es del 8% por venta.</p><form class="modal-form" id="regForm"><label>Nombre completo<input id="rName" required></label><label>Teléfono con código de país<input id="rPhone" placeholder="+50370000000" required></label><label>Tipo de cuenta<select id="rRole"><option value="customer">Cliente</option><option value="seller">Vendedor</option></select></label><label>Nombre de tienda (obligatorio si eres vendedor)<input id="rStore" placeholder="Mi tienda"></label><label>Crear contraseña<input id="rPass" type="password" minlength="6" required></label><button class="btn primary">Continuar</button></form><p class="tiny">El código de prueba es 123456. Para producción se necesita conectar un proveedor SMS.</p>`);$('regForm').onsubmit=e=>{e.preventDefault();let phone=$('rPhone').value.trim();if($('rRole').value==='seller'&&!$('rStore').value.trim()){toast('Escribe el nombre de tu tienda.');return}if(db.users.some(u=>u.phone===phone)){toast('Ese teléfono ya está registrado.');return}let data={id:'u'+Date.now(),name:$('rName').value.trim(),phone,role:$('rRole').value,store:$('rStore').value.trim(),password:$('rPass').value,whatsapp:''};openModal(`<h2>Verificar teléfono</h2><p>Introduce el código SMS. En esta demostración utiliza <b>123456</b>.</p><form class="modal-form" id="otpForm"><label>Código de 6 dígitos<input id="otp" inputmode="numeric" maxlength="6" required></label><button class="btn primary">Verificar y crear cuenta</button></form>`);$('otpForm').onsubmit=ev=>{ev.preventDefault();if($('otp').value!=='123456'){toast('Código incorrecto.');return}db.users.push(data);save();session=data;closeModal();refresh();toast('Cuenta creada.')}}}
function login(){openModal(`<h2>Iniciar sesión</h2><form class="modal-form" id="loginForm"><label>Teléfono<input id="lPhone" placeholder="+503..." required></label><label>Contraseña<input id="lPass" type="password" required></label><button class="btn primary">Ingresar</button></form><button class="btn ghost" id="bioLogin" style="width:100%;margin-top:10px">♧ Entrar con biometría</button>`);$('loginForm').onsubmit=e=>{e.preventDefault();let u=db.users.find(x=>x.phone===$('lPhone').value.trim()&&x.password===$('lPass').value);if(!u){toast('Teléfono o contraseña incorrectos.');return}session=u;closeModal();refresh()};$('bioLogin').onclick=async()=>{const ok=await biometricAuth();if(ok){toast('La biometría del dispositivo fue aceptada. Para vincularla a una cuenta real se requiere autenticación segura del servidor.');}}}
function contact(id){if(!session){openModal(`<h2>Regístrate para consultar</h2><p>Para preguntar por WhatsApp necesitas una cuenta verificada.</p><button class="btn primary" id="needRegister" style="width:100%">Crear cuenta</button><button class="btn ghost" id="needLogin" style="width:100%;margin-top:8px">Ya tengo cuenta</button>`);$('needRegister').onclick=register;$('needLogin').onclick=login;return}let p=db.products.find(x=>x.id===id);if(!p)return;let phone=(p.whatsapp||'').replace(/\D/g,'');if(!phone){toast('El vendedor aún no configuró su WhatsApp.');return}let msg=`Hola, vi este producto en CATÁLOGO PRO 3D:\nProducto: ${p.name}\nPrecio: ${money(p.price)}\n¿Me puedes dar más información?`;window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank')}
function refresh(){renderFilters();renderStoreOptions();readAdvancedFiltersSilent();bindStoreLinks();updateNotifBadge();$('userBadge').textContent=session?session.name:'Visitante';$('loginBtn').classList.toggle('hidden',!!session);$('registerBtn').classList.toggle('hidden',!!session);$('logoutBtn').classList.toggle('hidden',!session);$('dashboard').classList.toggle('hidden',!session);if(!session)return;$('dashTitle').textContent='Hola, '+session.name;$('myRole').textContent=session.role==='seller'?'Vendedor':'Cliente';$('myStore').textContent=session.store||'—';let mine=db.products.filter(p=>p.owner===session.id);$('myCount').textContent=mine.length;$('sellerProducts').innerHTML=mine.length?mine.map(p=>productCard(p,true)).join(''):'<div class="empty" style="grid-column:1/-1">Todavía no tienes productos publicados.</div>';document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{db.products=db.products.filter(p=>p.id!==b.dataset.delete);save();refresh()});document.querySelectorAll('#sellerProducts [data-feature]').forEach(b=>b.onclick=()=>toggleFeatured(b.dataset.feature));$('addTab').classList.toggle('hidden',session.role!=='seller');$('storeName').value=session.store||'';$('storeWhatsapp').value=session.whatsapp||'';checkBiometricAvailability()}
function readAdvancedFiltersSilent(){const min=$('filterMin').value,max=$('filterMax').value;filterStore=$('filterStore').value;filterMin=min===''?null:Number(min);filterMax=max===''?null:Number(max);filterSort=$('filterSort').value;onlyOffers=$('filterOffers').checked;onlyFavs=$('filterFavs').checked;renderProducts();renderOffersAndFeatured();updateCartBadge()}
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
$('productForm').onsubmit=async e=>{e.preventDefault();if(!session||session.role!=='seller')return toast('Solo vendedores pueden publicar.');const files=pendingFiles.map(x=>x.file);const images=(await Promise.all(files.map(f=>compressImage(f)))).filter(Boolean);if(files.length&&!images.length){toast('No se pudieron procesar las imágenes.');return}const basePrice=Number($('pPrice').value);let sale=$('pSale')?$('pSale').value:'';sale=(sale===''||sale==null)?'':Number(sale);if(sale!==''&&sale>=basePrice){toast('El precio de oferta debe ser menor al precio normal.');return}if($('pFeatured')?.checked){const count=db.products.filter(p=>p.owner===session.id&&p.featured&&!p._deleted).length;const editingFeatured=editId?(db.products.find(p=>p.id===editId)||{}).featured:false;if(count>=(editingFeatured?4:4)){toast('Ya tienes 4 productos destacados. Quita la marca de otro primero.');return}}if(editId){const p=db.products.find(x=>x.id===editId);if(p){Object.assign(p,{name:$('pName').value,category:$('pCategory').value,price:basePrice,salePrice:sale,featured:!!($('pFeatured')?.checked),stock:Number($('pStock').value),sizes:$('pSizes').value,colors:$('pColors').value,description:$('pDescription').value});if(images.length){p.image=images[0];p.images=images}editId=null;$('productForm').querySelector('h3').textContent='Publicar producto';save();pendingFiles=[];renderFormImagesPreview();e.target.reset();refresh();tab('myProducts');toast('Producto actualizado');return}}db.products.unshift({id:'p'+Date.now(),owner:session.id,name:$('pName').value,category:$('pCategory').value,price:basePrice,salePrice:sale,featured:!!($('pFeatured')?.checked),stock:Number($('pStock').value),sizes:$('pSizes').value,colors:$('pColors').value,description:$('pDescription').value,image:images[0]||'',images,store:session.store||session.name,whatsapp:session.whatsapp||''});try{save()}catch(err){toast('El almacenamiento local está lleno. Elimina productos antiguos o usa menos fotos.');return}pendingFiles=[];renderFormImagesPreview();e.target.reset();refresh();tab('myProducts');toast(images.length>1?'Producto publicado con '+images.length+' fotos':'Producto publicado')};
$('storeForm').onsubmit=e=>{e.preventDefault();session.store=$('storeName').value.trim();session.whatsapp=$('storeWhatsapp').value.trim();let i=db.users.findIndex(u=>u.id===session.id);if(i>=0)db.users[i]=session;db.products.filter(p=>p.owner===session.id).forEach(p=>{p.store=session.store;p.whatsapp=session.whatsapp});save();refresh();toast('Datos de tienda guardados')};
$('search').oninput=()=>{renderProducts()};['filterStore','filterMin','filterMax','filterSort'].forEach(id=>{const el=$(id);if(el)el.onchange=readAdvancedFilters});['filterOffers','filterFavs'].forEach(id=>{const el=$(id);if(el)el.onchange=readAdvancedFilters});$('exploreBtn').onclick=()=>$('catalog').scrollIntoView({behavior:'smooth'});$('loginBtn').onclick=login;$('registerBtn').onclick=register;$('sellerBtn').onclick=()=>{if(session){$('dashboard').scrollIntoView({behavior:'smooth'});if(session.role!=='seller')toast('Tu cuenta actual es de cliente. Regístrate como vendedor para publicar.')}else register()};$('logoutBtn').onclick=()=>{session=null;refresh();toast('Sesión cerrada')};

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
setTimeout(()=>{init();refresh()},0);


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
function updateCartBadge(){const n=cart.reduce((sum,x)=>sum+x.qty,0);const el=$('cartCount');if(el)el.textContent=n;const w=$('wishCount');if(w)w.textContent=wishlist.length;}
function addToCart(id){const p=productById(id);if(!p)return;if(Number(p.stock)<=0)return toast('Producto agotado.');const line=cart.find(x=>x.id===id);if(line){if(line.qty>=Number(p.stock))return toast('No hay más existencias disponibles.');line.qty++}else cart.push({id,qty:1});persistV3();updateCartBadge();toast('Producto agregado al carrito.');}
function toggleWish(id){wishlist=wishlist.includes(id)?wishlist.filter(x=>x!==id):[...wishlist,id];persistV3();toast(wishlist.includes(id)?'Agregado a favoritos.':'Quitado de favoritos.');renderProducts();updateCartBadge();if(onlyFavs)readAdvancedFilters();}
function renderStores(){const el=$('storeCards');if(!el)return;const stores=[...new Map(db.products.map(p=>[p.owner,{owner:p.owner,name:p.store||'Tienda',count:db.products.filter(x=>x.owner===p.owner).length}])).values()];el.innerHTML=stores.length?stores.map(x=>{const r=ownerRating(x.owner);const rate=r?`<span class="rating-line"><span class="stars">${starsHtml(r.avg)}</span> <span class="rating-num">${r.avg.toFixed(1)}</span> <span class="muted tiny">(${r.count})</span></span>`:'<span class="tiny muted">Sin calificaciones aún</span>';return `<article class="store-tile"><strong>✦ ${esc(x.name)}</strong>${rate}<small>${x.count} producto(s) publicados</small><p><button class="v3-action store-link" data-store="${esc(x.owner)}">Ver tienda</button></p></article>`}).join(''):'<p class="muted">Las tiendas aparecerán aquí cuando publiquen productos.</p>';el.querySelectorAll('[data-store]').forEach(b=>b.onclick=()=>{openStoreProfile(b.dataset.store)});}
function openStoreProfile(ownerId){const items=db.products.filter(p=>p.owner===ownerId);if(!items.length)return toast('Esta tienda no tiene productos publicados.');const info=items[0];const r=ownerRating(ownerId);const qa=community.qa.filter(q=>q.owner===ownerId);const secs=Math.floor((Date.now()-new Date(items[items.length-1].id.startsWith('demo')?'2026-01-01':items[items.length-1].id.slice(1)))/86400000)||0;$('storeProfileBody').innerHTML=`<div class="store-hero"><div class="store-avatar">${esc((info.store||'T').charAt(0).toUpperCase())}</div><div class="store-hero-meta"><h2>${esc(info.store||'Tienda')}</h2>${r?`<span class="rating-line"><span class="stars">${starsHtml(r.avg)}</span> <span class="rating-num">${r.avg.toFixed(1)} / 5</span> <span class="muted tiny">· ${r.count} calificación(es)</span></span>`:'<span class="tiny muted">Esta tienda aún no tiene calificaciones.</span>'}<div class="store-stats"><span><b>${items.length}</b> productos</span><span><b>${community.ratings.filter(x=>x.owner===ownerId).length}</b> opiniones</span><span><b>${qa.length}</b> preguntas</span><span>${info.whatsapp?'<b>✓</b> WhatsApp confirmado':'Sin WhatsApp'}</span></div><p class="tiny muted" style="margin-top:6px">Perfil público de la tienda · los compradores califican la atención después de cada compra.</p></div><div>${info.whatsapp?`<button class="btn primary small" id="storeWa">💬 Contactar por WhatsApp</button>`:''}<button class="v3-action small" id="storeFollow" style="margin-top:8px">☆ Seguir tienda</button></div></div>`;
$('storeProfileProducts').innerHTML=items.map(p=>productCard(p)).join('');
const reviews=community.ratings.filter(x=>x.owner===ownerId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
$('storeProfileReviews').innerHTML=`<h3 class="subhead">💬 Opiniones sobre la tienda (${reviews.length})</h3>${reviews.length?reviews.map(x=>`<div class="review-card"><div class="review-head"><b>${esc(x.buyerName)}</b><span class="stars">${starsHtml(x.stars)}</span><span class="review-when">${fmtWhen(x.createdAt)}</span></div>${x.text?`<p class="tiny">${esc(x.text)}</p>`:''}</div>`).join(''):'<p class="tiny muted">Sin opiniones todavía.</p>'}`;
$('storeProfileQa').innerHTML=`<h3 class="subhead">❓ Preguntas recientes (${qa.length})</h3>${qa.length?qa.slice(0,5).map(q=>`<div class="qa-card"><div class="qa-q"><b>${esc(q.buyerName)}:</b> ${esc(q.question)}</div>${q.answer?`<div class="qa-a"><b>${esc(q.store)}:</b> ${esc(q.answer)}</div>`:'<div class="qa-a tiny">Sin respuesta aún.</div>'}</div>`).join(''):'<p class="tiny muted">Sin preguntas todavía.</p>'}`;
bindStoreLinks();
document.querySelectorAll('#storeProfileProducts [data-cart]').forEach(b=>b.onclick=()=>addToCart(b.dataset.cart));
document.querySelectorAll('#storeProfileProducts [data-wish]').forEach(b=>b.onclick=()=>toggleWish(b.dataset.wish));
document.querySelectorAll('#storeProfileProducts [data-share]').forEach(b=>b.onclick=()=>shareProduct(b.dataset.share));
document.querySelectorAll('#storeProfileProducts [data-contact]').forEach(b=>b.onclick=()=>contact(b.dataset.contact));
document.querySelectorAll('#storeProfileProducts .tilt3d').forEach(c=>c.onclick=e=>{if(e.target.closest('button'))return;viewProduct(c.dataset.view)});
const wa=$('storeWa');if(wa)wa.onclick=()=>{const ph=(info.whatsapp||'').replace(/\D/g,'');window.open('https://wa.me/'+ph+'?text='+encodeURIComponent('Hola, vi su tienda '+info.store+' en CATÁLOGO PRO.'),'_blank')};
$('storeFollow').onclick=()=>{toast('✓ Ahora sigues a '+info.store+'. Recibirás avisos de ofertas y nuevos productos.');notifyUser(ownerId,'follow','Nuevo seguidor','Un comprador siguió tu tienda '+info.store+'.')};
$('storesShowcase').classList.add('hidden');$('storeProfile').classList.remove('hidden');$('storeProfile').scrollIntoView({behavior:'smooth'});}
$('backToCatalog').onclick=()=>{$('storeProfile').classList.add('hidden');$('storesShowcase').classList.remove('hidden');$('storesShowcase').scrollIntoView({behavior:'smooth'})};
function showNotifs(){const list=myNotifs();openModal(`<h2>🔔 Notificaciones</h2>${list.length?list.map(n=>`<div class="notif-card ${n.read?'':'unread'}"><div><b>${esc(n.title)}</b><p class="tiny muted" style="margin:2px 0">${esc(n.body)}</p><span class="review-when">${new Date(n.createdAt).toLocaleString('es-SV')}</span></div>${n.read?'':`<button class="btn ghost small" data-read="${n.id}">✓ Leer</button>`}</div>`).join(''):'<p class="muted">No tienes notificaciones. Aquí verás calificaciones nuevas, preguntas de compradores y respuestas de tiendas.</p>'}${list.length?'<button class="btn ghost" id="readAll" style="width:100%;margin-top:6px">Marcar todo como leído</button>':''}`);
document.querySelectorAll('[data-read]').forEach(b=>b.onclick=()=>{const n=community.notifs.find(x=>x.id===b.dataset.read);if(n){n.read=true;persistComm();updateNotifBadge();showNotifs()}});
const ra=$('readAll');if(ra)ra.onclick=()=>{myNotifs().forEach(n=>n.read=true);persistComm();updateNotifBadge();showNotifs()}}
$('notifBtn').onclick=showNotifs;
const baseProductCard=productCard;
productCard=function(p,owner=false){let html=baseProductCard(p,owner);if(owner){const feat=`<button class="v3-action" data-feature="${esc(p.id)}" title="Marcar como destacado (máx. 4)">${p.featured?'⭐ Destacado':'☆ Destacar'}</button>`;html=html.replace(/<div class="product-buttons">/,`<div class="product-buttons">${feat}`);}else{const extra=`<button class="v3-action" data-cart="${esc(p.id)}">＋ Carrito</button><button class="v3-action" data-wish="${esc(p.id)}">${wishlist.includes(p.id)?'♥':'♡'} Favorito</button>`;html=html.replace(/<div class="product-buttons">/,`<div class="product-buttons">${extra}`);}return html;};
const baseRenderProducts=renderProducts;
renderProducts=function(){baseRenderProducts();document.querySelectorAll('[data-cart]').forEach(b=>b.onclick=()=>addToCart(b.dataset.cart));document.querySelectorAll('[data-wish]').forEach(b=>b.onclick=()=>toggleWish(b.dataset.wish));document.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>shareProduct(b.dataset.share));document.querySelectorAll('[data-feature]').forEach(b=>b.onclick=()=>toggleFeatured(b.dataset.feature));document.querySelectorAll('.tilt3d').forEach(c=>c.onclick=e=>{if(e.target.closest('button'))return;const id=c.dataset.view;if(e.target.closest('.product-image')){const p=productById(id);if(p){const imgs=productImages(p);if(imgs.length)openImageViewer(imgs[0],p.name,imgs);else viewProduct(id);return}viewProduct(id);return}viewProduct(id)});renderStores();renderOffersAndFeatured();updateCartBadge();};
function showCart(){const lines=cart.map(x=>({...x,p:productById(x.id)})).filter(x=>x.p);const total=lines.reduce((s,x)=>s+x.p.price*x.qty,0);openModal(`<h2>🛒 Mi carrito</h2>${lines.length?lines.map(x=>`<div class="cart-line"><div><b>${esc(x.p.name)}</b><div class="muted tiny">${money(x.p.price)} · ${esc(x.p.store||'Tienda')}</div></div><div><input type="number" min="1" max="${Math.max(1,Number(x.p.stock))}" value="${x.qty}" data-qty="${esc(x.id)}"><button class="ghost small" data-remove="${esc(x.id)}">Quitar</button></div></div>`).join(''):`<p class="muted">Tu carrito está vacío. Explora el catálogo para agregar productos.</p>`}<h3>Total: ${money(total)}</h3>${lines.length?'<button class="btn primary" id="checkoutBtn" style="width:100%">Continuar al pedido</button>':''}`);document.querySelectorAll('[data-qty]').forEach(i=>i.onchange=()=>{const p=productById(i.dataset.qty);const q=Math.max(1,Math.min(Number(i.value)||1,Number(p?.stock)||1));cart.find(x=>x.id===i.dataset.qty).qty=q;persistV3();showCart();updateCartBadge()});document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x.id!==b.dataset.remove);persistV3();showCart();updateCartBadge()});const checkout=$('checkoutBtn');if(checkout)checkout.onclick=checkoutForm;}
function checkoutForm(){if(!session){toast('Inicia sesión para realizar un pedido.');closeModal();login();return;}const lines=cart.map(x=>({...x,p:productById(x.id)})).filter(x=>x.p);if(!lines.length)return;openModal(`<h2>Confirmar pedido</h2><p>Completa tus datos para registrar tu pedido. El pago se coordina directamente con la tienda. La comisión de plataforma se descuenta al vendedor y no se suma a tu total.</p><form class="modal-form" id="checkoutForm"><label>Nombre para entrega<input id="buyerName" value="${esc(session.name)}" required></label><label>Teléfono<input id="buyerPhone" value="${esc(session.phone)}" required></label><label>Dirección / punto de entrega<textarea id="buyerAddress" rows="2" required></textarea></label><label>Notas (opcional)<textarea id="buyerNotes" rows="2"></textarea></label><button class="btn primary">Crear pedido · ${money(lines.reduce((s,x)=>s+x.p.price*x.qty,0))}</button></form>`);$('checkoutForm').onsubmit=e=>{e.preventDefault();for(const x of lines){if(Number(x.p.stock)<x.qty){toast('Stock insuficiente para '+x.p.name);return;}}const order={id:'ORD-'+Date.now().toString().slice(-8),buyer:session.id,buyerName:$('buyerName').value.trim(),phone:$('buyerPhone').value.trim(),address:$('buyerAddress').value.trim(),notes:$('buyerNotes').value.trim(),items:lines.map(x=>({id:x.p.id,name:x.p.name,owner:x.p.owner,store:x.p.store,price:x.p.price,qty:x.qty})),total:lines.reduce((s,x)=>s+x.p.price*x.qty,0),commissionRate:PLATFORM_COMMISSION_RATE,platformCommission:lines.reduce((s,x)=>s+x.p.price*x.qty,0)*PLATFORM_COMMISSION_RATE/100,sellerNet:lines.reduce((s,x)=>s+x.p.price*x.qty,0)*(1-PLATFORM_COMMISSION_RATE/100),status:'Pendiente',createdAt:new Date().toISOString()};orders.unshift(order);lines.forEach(x=>x.p.stock=Number(x.p.stock)-x.qty);cart=[];persistV3();save();closeModal();refresh();updateCartBadge();toast('Pedido registrado: '+order.id);};}
function showWishlist(){const items=wishlist.map(productById).filter(Boolean);openModal(`<h2>♡ Mis favoritos</h2>${items.length?items.map(p=>`<div class="cart-line"><div><b>${esc(p.name)}</b><div class="muted tiny">${money(p.price)} · ${esc(p.store||'Tienda')}</div></div><button class="v3-action" data-wcart="${esc(p.id)}">Agregar</button></div>`).join(''):'<p class="muted">Todavía no guardas favoritos.</p>'}`);document.querySelectorAll('[data-wcart]').forEach(b=>b.onclick=()=>{addToCart(b.dataset.wcart);});}
function renderOrders(){const mine=orders.filter(o=>o.buyer===session?.id);const seller=orders.filter(o=>o.items.some(i=>i.owner===session?.id));const list=session?.role==='seller'?[...new Map([...mine,...seller].map(o=>[o.id,o])).values()]:mine;const el=$('myOrders');if(!el)return;el.innerHTML=list.length?list.map(o=>`<article class="order-card"><h4>${esc(o.id)} · ${money(o.total)}</h4><div class="muted tiny">${new Date(o.createdAt).toLocaleString('es-SV')} · ${esc(o.buyerName)}</div><div class="order-status">${esc(o.status)}</div><p class="tiny">${o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join('<br>')}</p>${session.role==='seller'?`<div class="notice tiny">Venta bruta: ${money(o.items.filter(i=>i.owner===session.id).reduce((s,i)=>s+i.price*i.qty,0))} · Comisión estimada (${Number(o.commissionRate??PLATFORM_COMMISSION_RATE)}%): ${money(o.items.filter(i=>i.owner===session.id).reduce((s,i)=>s+i.price*i.qty,0)*Number(o.commissionRate??PLATFORM_COMMISSION_RATE)/100)} · Neto estimado: ${money(o.items.filter(i=>i.owner===session.id).reduce((s,i)=>s+i.price*i.qty,0)*(1-Number(o.commissionRate??PLATFORM_COMMISSION_RATE)/100))}<br><b>Simulación local:</b> el cobro real requiere backend y pasarela.</div>`:''}${session.role==='seller'?`<label class="tiny">Actualizar estado <select data-order="${esc(o.id)}"><option ${o.status==='Pendiente'?'selected':''}>Pendiente</option><option ${o.status==='Confirmado'?'selected':''}>Confirmado</option><option ${o.status==='Preparando'?'selected':''}>Preparando</option><option ${o.status==='Enviado'?'selected':''}>Enviado</option><option ${o.status==='Entregado'?'selected':''}>Entregado</option><option ${o.status==='Cancelado'?'selected':''}>Cancelado</option></select></label>`:''}</article>`).join(''):'<p class="muted">Aún no tienes pedidos registrados.</p>';el.querySelectorAll('[data-order]').forEach(sel=>sel.onchange=()=>{const o=orders.find(x=>x.id===sel.dataset.order);if(o){o.status=sel.value;persistV3();renderOrders();notifyUser(o.buyer,'order','Actualización de tu pedido',`Pedido ${o.id}: estado "${o.status}".`);toast('Estado del pedido actualizado.');}});}
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