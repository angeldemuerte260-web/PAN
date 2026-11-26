/* ===== Utilidades ===== */
const pagina = document.body.dataset.page;
const rolReq = document.body.dataset.rol;
const $ = id => document.getElementById(id);

/* ===== Base de datos en la nube (Firebase Realtime Database, con fetch) ===== */
// Pega aquí la URL de tu base de datos SIN "/" al final.
// Ejemplo: "https://mi-panaderia-default-rtdb.firebaseio.com"
const DB_URL = "https://panaderia-3fcac-default-rtdb.firebaseio.com/";
const nube = DB_URL.trim().replace(/\/+$/, "");
const COLS = ["pan_usuarios", "pan_productos", "pan_pedidos", "pan_config"];
const cache = {};
let nubeOK = false;
const aviso = (t, info = false) => {
  let b = document.getElementById("aviso");
  if (!b) { b = document.createElement("div"); b.id = "aviso"; document.body.prepend(b); }
  b.className = "aviso" + (info ? " info" : ""); b.textContent = t;
};
const leer = k => {
  if (cache[k] !== undefined) return cache[k];
  try { const v = JSON.parse(localStorage.getItem(k)); if (v != null) return v; } catch {}
  return k === "pan_config" ? {} : [];
};
const guardar = async (k, v) => {
  cache[k] = v;
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  if (nube && COLS.includes(k)) {
    try {
      const r = await fetch(`${nube}/${k}.json`, { method: "PUT", body: JSON.stringify(v) });
      if (!r.ok) throw new Error("db");
    } catch (err) { aviso("No se pudo guardar en la nube. Revisa tu conexión a Internet."); throw err; }
  }
};
// Descarga los datos más recientes de la nube (los comparten todos los usuarios)
const sync = async () => {
  if (!nube) return;
  try {
    await Promise.all(COLS.map(async k => {
      const r = await fetch(`${nube}/${k}.json`);
      if (!r.ok) throw new Error("db");
      const v = await r.json();
      cache[k] = v == null ? (k === "pan_config" ? {} : [])
        : k === "pan_config" ? v : (Array.isArray(v) ? v : Object.values(v)).filter(Boolean);
    }));
    nubeOK = true;
    const b = document.getElementById("aviso"); if (b) b.remove();
  } catch { nubeOK = false; aviso("No se pudo conectar con la base de datos. Revisa la URL en js/script.js y tu conexión."); }
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const bs = n => "Bs " + Number(n).toFixed(2);
const hoy = () => new Date().toISOString().slice(0, 10);
const msg = (t, ok = false) => { const e = $("error"); if (e) { e.textContent = t; e.className = ok ? "ok" : "error"; } return false; };

(async () => {
await sync();
if (!nube) aviso("Modo local: los datos solo se guardan en este navegador. Configura DB_URL en js/script.js.", true);

/* ===== Datos iniciales (solo la primera vez) ===== */
try {
  if ((nubeOK || !nube) && !leer("pan_usuarios").length) {
    await guardar("pan_usuarios", [{ nombre: "Administrador", usuario: "admin", correo: "admin@dulcetrigo.com", clave: "Pan2026", rol: "admin" }]);
    if (!leer("pan_productos").length)
      await guardar("pan_productos", [
        { nombre: "Pan de batalla", categoria: "Pan", precio: 0.5, stock: 100 },
        { nombre: "Pan integral", categoria: "Pan", precio: 1, stock: 40 },
        { nombre: "Torta de chocolate", categoria: "Pastel", precio: 85, stock: 6 },
        { nombre: "Empanada de queso", categoria: "Empanada", precio: 5, stock: 30 },
        { nombre: "Café", categoria: "Bebida", precio: 6, stock: 50 }
      ]);
  }
} catch {}

/* ===== Configuración de la panadería (nombre, contacto, fondo) ===== */
const CFG_DEF = { nombre: "Dulce Trigo", horario: "Lun–Dom\n06:00 – 21:00", direccion: "Av. Principal #123", telefono: "70000000", horno: "Pan de batalla cada 2 horas", fondo: "" };
const cfg = () => ({ ...CFG_DEF, ...leer("pan_config") });
const tituloBase = document.title;
const aplicarConfig = () => {
  const c = cfg();
  document.querySelectorAll("[data-cfg]").forEach(el => { el.textContent = c[el.dataset.cfg] ?? ""; });
  document.title = tituloBase.replace("Dulce Trigo", c.nombre);
  const publica = pagina === "login" || pagina === "registro", v = publica ? ".5" : ".82";
  const velo = `linear-gradient(rgba(255,248,238,${v}),rgba(255,248,238,${v}))`, b = document.body.style;
  if (c.fondo) {
    b.backgroundImage = `${velo}, url("${c.fondo}")`;
    b.backgroundSize = "cover, cover"; b.backgroundRepeat = "no-repeat, no-repeat";
    b.backgroundPosition = "center, center"; b.backgroundAttachment = "fixed, fixed";
  } else {
    b.backgroundImage = `${velo}, url("${pagina === "login" ? "" : "../"}img/fondo.svg")`;
    b.backgroundSize = "auto, 220px"; b.backgroundRepeat = "repeat, repeat";
    b.backgroundPosition = "0 0, 0 0"; b.backgroundAttachment = "scroll, scroll";
  }
};
aplicarConfig();

/* ===== Validación y alta de usuarios ===== */
async function crearUsuario(d) {
  await sync();
  if (!d.nombre || !d.usuario || !d.correo || !d.clave) return "Complete todos los campos.";
  if (d.nombre.length < 3) return "El nombre debe tener al menos 3 caracteres.";
  if (!/^[a-zA-Z0-9_]{4,15}$/.test(d.usuario)) return "Usuario: 4 a 15 letras, números o guion bajo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo)) return "Correo no válido.";
  if (d.clave.length < 6) return "La contraseña debe tener mínimo 6 caracteres.";
  const l = leer("pan_usuarios");
  if (l.some(u => u.usuario.toLowerCase() === d.usuario.toLowerCase())) return "Ese usuario ya existe.";
  if (l.some(u => u.correo.toLowerCase() === d.correo.toLowerCase())) return "Ese correo ya está registrado.";
  l.push({ nombre: d.nombre, usuario: d.usuario, correo: d.correo.toLowerCase(), clave: d.clave, rol: d.rol || "cliente" });
  try { await guardar("pan_usuarios", l); } catch { return "No se pudo guardar en la nube. Revisa tu conexión."; }
  return null;
}

/* ===== Páginas públicas ===== */
if (pagina === "login") {
  const s = JSON.parse(sessionStorage.getItem("pan_sesion") || "null");
  if (s) location.href = "pages/" + (s.rol === "admin" ? "inicio" : "tienda") + ".html";
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const u = $("usuario").value.trim().toLowerCase(), c = $("clave").value;
    if (!u || !c) return msg("Complete usuario y contraseña.");
    await sync();
    const user = leer("pan_usuarios").find(x => (x.usuario.toLowerCase() === u || x.correo === u) && x.clave === c);
    if (!user) return msg("Usuario o contraseña incorrectos.");
    sessionStorage.setItem("pan_sesion", JSON.stringify({ usuario: user.usuario, nombre: user.nombre, rol: user.rol }));
    location.href = "pages/" + (user.rol === "admin" ? "inicio" : "tienda") + ".html";
  });
} else if (pagina === "registro") {
  $("formRegistro").addEventListener("submit", async e => {
    e.preventDefault();
    if ($("clave").value !== $("clave2").value) return msg("Las contraseñas no coinciden.");
    const boton = e.submitter; if (boton) boton.disabled = true;
    msg("Guardando...", true);
    const err = await crearUsuario({ nombre: $("nombre").value.trim(), usuario: $("usuario").value.trim(), correo: $("correo").value.trim(), clave: $("clave").value, rol: "cliente" });
    if (err) { if (boton) boton.disabled = false; return msg(err); }
    msg("Cuenta creada. Redirigiendo al login...", true);
    setTimeout(() => location.href = "../index.html", 1500);
  });
} else {
  /* ===== Páginas internas: sesión y menú ===== */
  const sesion = JSON.parse(sessionStorage.getItem("pan_sesion") || "null");
  if (!sesion) { location.href = "../index.html"; return; }
  if (rolReq && sesion.rol !== rolReq) { location.href = sesion.rol === "admin" ? "inicio.html" : "tienda.html"; return; }

  const claveCarrito = "pan_carrito_" + sesion.usuario;
  const carrito = () => leer(claveCarrito);
  const menus = {
    admin: [["inicio", "Inicio"], ["productos", "Productos"], ["pedidos", "Pedidos"], ["ventas", "Ventas"], ["usuarios", "Usuarios"], ["configuracion", "Configuración"]],
    cliente: [["tienda", "Tienda"], ["mispedidos", "Mis pedidos"]]
  };
  const pintarMenu = () => {
    $("menu").innerHTML = menus[sesion.rol].map(([id, t]) =>
      `<a href="${id}.html"${id === pagina ? ' class="act"' : ""}>${t}</a>`).join("");
  };
  $("saludo").textContent = "Hola, " + sesion.nombre + " (" + sesion.rol + ")";
  $("salir").onclick = () => { sessionStorage.removeItem("pan_sesion"); location.href = "../index.html"; };
  pintarMenu();

  const detalle = items => items.map(i => `${esc(i.producto)} x${i.cantidad}`).join(", ");
  const cancelarPedido = p => {
    const prods = leer("pan_productos");
    p.items.forEach(i => { const pr = prods.find(x => x.nombre === i.producto); if (pr) pr.stock += i.cantidad; });
    guardar("pan_productos", prods);
    p.estado = "Cancelado";
  };

  /* --- Admin: inicio --- */
  if (pagina === "inicio") {
    const prods = leer("pan_productos"), peds = leer("pan_pedidos");
    $("totProductos").textContent = prods.length;
    $("totClientes").textContent = leer("pan_usuarios").filter(u => u.rol === "cliente").length;
    $("totPendientes").textContent = peds.filter(p => p.estado === "Pendiente").length;
    $("totVentas").textContent = bs(peds.filter(p => p.estado !== "Cancelado").reduce((s, p) => s + p.total, 0));
    $("bajo").innerHTML = prods.filter(p => p.stock < 10).map(p => `<tr><td>${esc(p.nombre)}</td><td>${p.stock}</td></tr>`).join("")
      || '<tr><td colspan="2">Todo el stock está bien</td></tr>';
  }

  /* --- Admin: productos --- */
  if (pagina === "productos") {
    const pintar = () => {
      $("lista").innerHTML = leer("pan_productos").map((p, i) =>
        `<tr><td>${esc(p.nombre)}</td><td>${esc(p.categoria)}</td>
        <td><input type="number" step="0.01" min="0" value="${p.precio}" id="pr${i}" aria-label="Precio"></td>
        <td><input type="number" min="0" value="${p.stock}" id="st${i}" aria-label="Stock"></td>
        <td><button class="guardar" data-g="${i}">Guardar</button> <button class="del" data-i="${i}">Eliminar</button></td></tr>`).join("")
        || '<tr><td colspan="5">Sin productos</td></tr>';
    };
    $("formProducto").addEventListener("submit", async e => {
      e.preventDefault();
      await sync();
      const nombre = $("nombre").value.trim(), categoria = $("categoria").value;
      const precio = parseFloat($("precio").value), stock = parseInt($("stock").value);
      if (!nombre || isNaN(precio) || isNaN(stock)) return msg("Complete todos los campos.");
      if (precio <= 0) return msg("El precio debe ser mayor a 0.");
      if (stock < 0) return msg("El stock no puede ser negativo.");
      const l = leer("pan_productos");
      if (l.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) return msg("Ese producto ya existe.");
      l.push({ nombre, categoria, precio, stock }); guardar("pan_productos", l);
      e.target.reset(); msg(""); pintar();
    });
    $("lista").addEventListener("click", async e => {
      if (e.target.dataset.g === undefined && !e.target.dataset.i) return;
      await sync();
      const l = leer("pan_productos");
      if (e.target.dataset.g !== undefined) {
        const i = e.target.dataset.g, precio = parseFloat($("pr" + i).value), stock = parseInt($("st" + i).value);
        if (isNaN(precio) || precio <= 0) return msg("El precio debe ser mayor a 0.");
        if (isNaN(stock) || stock < 0) return msg("El stock debe ser 0 o más.");
        l[i].precio = precio; l[i].stock = stock; guardar("pan_productos", l);
        msg("Producto \"" + l[i].nombre + "\" actualizado.", true); return pintar();
      }
      if (!e.target.dataset.i) return;
      l.splice(e.target.dataset.i, 1); guardar("pan_productos", l); pintar();
    });
    pintar();
  }

  /* --- Admin: todos los pedidos --- */
  if (pagina === "pedidos") {
    const estados = ["Pendiente", "Listo", "Entregado", "Cancelado"];
    const pintar = () => {
      $("lista").innerHTML = leer("pan_pedidos").slice().reverse().map(p =>
        `<tr><td>${p.id}</td><td>${esc(p.nombre)}</td><td>${detalle(p.items)}</td><td>${bs(p.total)}</td><td>${esc(p.fecha)}</td>
        <td><select data-id="${p.id}" ${p.estado === "Cancelado" ? "disabled" : ""}>${estados.map(s => `<option${s === p.estado ? " selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("")
        || '<tr><td colspan="6">Sin pedidos</td></tr>';
    };
    $("lista").addEventListener("change", async e => {
      if (!e.target.dataset.id) return;
      const id = e.target.dataset.id, nuevo = e.target.value;
      await sync();
      const l = leer("pan_pedidos"), p = l.find(x => x.id == id);
      if (!p) return pintar();
      if (nuevo === "Cancelado") cancelarPedido(p); else p.estado = nuevo;
      guardar("pan_pedidos", l); pintar();
    });
    pintar();
  }

  /* --- Admin: ventas --- */
  if (pagina === "ventas") {
    const ventas = leer("pan_pedidos");
    const validas = ventas.filter(v => v.estado !== "Cancelado");
    $("detalleVentas").innerHTML = ventas.map((v, n) => {
      const anul = v.estado === "Cancelado";
      return `<article class="venta${anul ? " anulada" : ""}">
        <div class="venta-head"><strong>Venta N° ${n + 1}</strong><span>Cliente: ${esc(v.nombre)} (${esc(v.usuario)})</span>
          <span>${new Date(v.id).toLocaleDateString()}</span><span>Estado: ${v.estado}</span>${anul ? '<span class="tag anul">No cuenta en el total</span>' : ""}</div>
        <div class="tabla-wrap"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>
        ${v.items.map(i => `<tr><td>${esc(i.producto)}</td><td>${i.cantidad}</td><td>${bs(i.precio)}</td><td>${bs(i.precio * i.cantidad)}</td></tr>`).join("")}
        </tbody><tfoot><tr><td colspan="3">Total de la venta</td><td>${bs(v.total)}</td></tr></tfoot></table></div></article>`;
    }).join("") || '<article class="panel">Aún no hay ventas registradas.</article>';
    $("totalGeneral").textContent = bs(validas.reduce((s, v) => s + v.total, 0));
    const res = {};
    validas.forEach(v => v.items.forEach(i => {
      res[i.producto] = res[i.producto] || { cant: 0, monto: 0 };
      res[i.producto].cant += i.cantidad; res[i.producto].monto += i.cantidad * i.precio;
    }));
    $("porProducto").innerHTML = Object.entries(res).map(([p, r]) => `<tr><td>${esc(p)}</td><td>${r.cant}</td><td>${bs(r.monto)}</td></tr>`).join("")
      || '<tr><td colspan="3">Sin ventas</td></tr>';
  }

  /* --- Admin: configuración --- */
  if (pagina === "configuracion") {
    const c = cfg();
    ["nombre", "horario", "direccion", "telefono", "horno"].forEach(k => { $(k).value = c[k]; });
    let fondo = c.fondo;
    const vista = () => { $("vistaFondo").src = fondo || "../img/fondo.svg"; };
    vista();
    $("archivoFondo").addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      if (!f.type.startsWith("image/")) return msg("Elige un archivo de imagen.");
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, 1000 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
          cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          fondo = cv.toDataURL("image/jpeg", 0.6); vista();
          msg("Imagen cargada. Pulsa «Guardar cambios» para aplicarla.", true);
        };
        img.onerror = () => msg("No se pudo leer esa imagen.");
        img.src = r.result;
      };
      r.readAsDataURL(f);
    });
    $("quitarFondo").onclick = () => { fondo = ""; $("archivoFondo").value = ""; vista(); msg("Se usará el fondo predeterminado. Pulsa «Guardar cambios».", true); };
    $("formConfig").addEventListener("submit", async e => {
      e.preventDefault();
      const d = { nombre: $("nombre").value.trim(), horario: $("horario").value.trim(), direccion: $("direccion").value.trim(), telefono: $("telefono").value.trim(), horno: $("horno").value.trim(), fondo };
      if (d.nombre.length < 2) return msg("El nombre debe tener al menos 2 caracteres.");
      if (!d.direccion || !d.horario) return msg("Complete la dirección y el horario.");
      if (!/^[0-9+\s-]{7,20}$/.test(d.telefono)) return msg("Teléfono no válido (solo números, +, espacios o guiones).");
      try { await guardar("pan_config", d); } catch { return msg("No se pudo guardar. Revisa tu conexión o prueba con una imagen más liviana."); }
      aplicarConfig(); msg("Cambios guardados.", true);
    });
  }

  /* --- Admin: usuarios --- */
  if (pagina === "usuarios") {
    const quien = u => u ? u.usuario : "";
    const pintar = () => {
      $("lista").innerHTML = leer("pan_usuarios").map((u, i) =>
        `<tr><td>${esc(u.nombre)}</td><td>${esc(u.usuario)}</td><td>${esc(u.correo)}</td><td>${u.rol}</td>
        <td>${u.usuario === "admin" ? "" : `<button class="del" data-i="${i}">Eliminar</button>`}</td></tr>`).join("");
    };
    $("formUsuario").addEventListener("submit", async e => {
      e.preventDefault();
      const err = await crearUsuario({ nombre: $("nombre").value.trim(), usuario: $("usuario").value.trim(), correo: $("correo").value.trim(), clave: $("clave").value, rol: $("rol").value });
      if (err) return msg(err);
      e.target.reset(); msg("Usuario agregado.", true); pintar();
    });
    $("lista").addEventListener("click", async e => {
      if (!e.target.dataset.i) return;
      const quitar = leer("pan_usuarios")[e.target.dataset.i];
      await sync();
      const l = leer("pan_usuarios"), k = l.findIndex(u => quien(u) === quien(quitar));
      if (k >= 0) l.splice(k, 1);
      guardar("pan_usuarios", l); pintar();
    });
    pintar();
  }

  /* --- Cliente: tienda --- */
  if (pagina === "tienda") {
    const pintar = (f = "") => {
      const l = leer("pan_productos").filter(p => p.nombre.toLowerCase().includes(f.toLowerCase()));
      $("catalogo").innerHTML = l.map(p => `<article class="prod"><h3>${esc(p.nombre)}</h3><span class="tag">${esc(p.categoria)}</span>
        <p class="precio">${bs(p.precio)}</p><p class="mut">${p.stock > 0 ? "Disponibles: " + p.stock : "Agotado"}</p>
        <input type="number" min="1" max="${p.stock}" value="1" ${p.stock < 1 ? "disabled" : ""} aria-label="Cantidad">
        <button data-n="${esc(p.nombre)}" ${p.stock < 1 ? "disabled" : ""}>Agregar al carrito</button></article>`).join("")
        || "<p>No se encontraron productos.</p>";
    };
    $("buscar").addEventListener("input", e => pintar(e.target.value));
    $("catalogo").addEventListener("click", e => {
      if (!e.target.dataset.n) return;
      const cant = parseInt(e.target.parentElement.querySelector("input").value);
      const prod = leer("pan_productos").find(p => p.nombre === e.target.dataset.n);
      if (isNaN(cant) || cant < 1) return msg("Cantidad no válida.");
      const c = carrito(), item = c.find(i => i.producto === prod.nombre);
      if ((item ? item.cantidad : 0) + cant > prod.stock) return msg("Stock insuficiente de " + prod.nombre + ".");
      if (item) item.cantidad += cant; else c.push({ producto: prod.nombre, precio: prod.precio, cantidad: cant });
      guardar(claveCarrito, c); pintarCarrito(); msg(prod.nombre + " agregado al carrito.", true);
    });
    document.addEventListener("datos", () => pintar($("buscar").value));
    pintar();
  }

  /* --- Cliente: carrito flotante (esquina) --- */
  let pintarCarrito = () => {};
  if (sesion.rol === "cliente") {
    document.body.insertAdjacentHTML("beforeend", `
      <button id="btnCarrito" class="fab" aria-label="Abrir carrito">
        <svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6"/></svg>
        <span id="fabN" class="fab-n">0</span>
      </button>
      <div id="velo" class="velo"></div>
      <div id="panelCarrito" class="drawer" role="dialog" aria-label="Carrito de compras">
        <div class="drawer-head"><h2>Mi carrito</h2><button id="cerrarCarrito" class="btn-x" aria-label="Cerrar">✕</button></div>
        <ul id="itemsCarrito" class="items"></ul>
        <div class="drawer-foot">
          <p id="totalCarrito" class="total">Total: Bs 0.00</p>
          <label for="fechaC">Fecha de entrega</label>
          <input type="date" id="fechaC">
          <div id="errorC" class="error" role="alert"></div>
          <button id="confirmar">Confirmar pedido</button>
          <button id="vaciar" class="btn-sec2">Vaciar carrito</button>
        </div>
      </div>`);
    const msgC = (t, ok = false) => { $("errorC").textContent = t; $("errorC").className = ok ? "ok" : "error"; };
    const abrir = v => { $("panelCarrito").classList.toggle("abierto", v); $("velo").classList.toggle("abierto", v); };
    $("fechaC").min = hoy();
    $("btnCarrito").onclick = () => abrir(true);
    $("cerrarCarrito").onclick = $("velo").onclick = () => abrir(false);
    document.addEventListener("keydown", e => { if (e.key === "Escape") abrir(false); });

    pintarCarrito = () => {
      const c = carrito();
      $("itemsCarrito").innerHTML = c.map(i => `<li>
          <span class="nom">${esc(i.producto)}</span>
          <button class="menos" data-n="${esc(i.producto)}" data-d="-1" aria-label="Quitar uno">−</button>
          <span class="cant">${i.cantidad}</span>
          <button class="mas" data-n="${esc(i.producto)}" data-d="1" aria-label="Agregar uno">+</button>
          <span class="sub">${bs(i.precio * i.cantidad)}</span>
          <button class="quitar" data-q="${esc(i.producto)}" aria-label="Eliminar">✕</button></li>`).join("")
        || '<li class="vacio">Tu carrito está vacío</li>';
      $("totalCarrito").textContent = "Total: " + bs(c.reduce((s, i) => s + i.precio * i.cantidad, 0));
      $("fabN").textContent = c.reduce((s, i) => s + i.cantidad, 0);
    };
    $("itemsCarrito").addEventListener("click", e => {
      const t = e.target, c = carrito();
      if (t.dataset.q) { guardar(claveCarrito, c.filter(i => i.producto !== t.dataset.q)); return pintarCarrito(); }
      if (!t.dataset.d) return;
      const item = c.find(i => i.producto === t.dataset.n), prod = leer("pan_productos").find(p => p.nombre === t.dataset.n);
      const n = item.cantidad + parseInt(t.dataset.d);
      if (prod && n > prod.stock) return msgC("Solo hay " + prod.stock + " de " + item.producto + ".");
      msgC("");
      guardar(claveCarrito, n < 1 ? c.filter(i => i !== item) : c.map(i => i === item ? { ...i, cantidad: n } : i));
      pintarCarrito();
    });
    $("vaciar").onclick = () => { guardar(claveCarrito, []); msgC(""); pintarCarrito(); };
    $("confirmar").onclick = async () => {
      const c = carrito(), fecha = $("fechaC").value;
      if (!c.length) return msgC("El carrito está vacío.");
      if (!fecha) return msgC("Elija la fecha de entrega.");
      if (fecha < hoy()) return msgC("La fecha no puede ser anterior a hoy.");
      const boton = $("confirmar"); boton.disabled = true; msgC("Enviando pedido...", true);
      await sync();
      const prods = leer("pan_productos");
      for (const i of c) {
        const p = prods.find(x => x.nombre === i.producto);
        if (!p || i.cantidad > p.stock) { boton.disabled = false; return msgC("Stock insuficiente de " + i.producto + "."); }
      }
      c.forEach(i => { prods.find(x => x.nombre === i.producto).stock -= i.cantidad; });
      const peds = leer("pan_pedidos");
      peds.push({ id: Date.now(), usuario: sesion.usuario, nombre: sesion.nombre, items: c, total: c.reduce((s, i) => s + i.precio * i.cantidad, 0), fecha, estado: "Pendiente" });
      try { await guardar("pan_pedidos", peds); await guardar("pan_productos", prods); }
      catch { boton.disabled = false; return msgC("No se pudo enviar el pedido. Revisa tu conexión e inténtalo otra vez."); }
      boton.disabled = false;
      guardar(claveCarrito, []);
      pintarCarrito(); msgC("¡Pedido enviado al administrador!", true);
      document.dispatchEvent(new Event("datos"));
    };
    pintarCarrito();
  }

  /* --- Cliente: mis pedidos --- */
  if (pagina === "mispedidos") {
    const pintar = () => {
      $("lista").innerHTML = leer("pan_pedidos").filter(p => p.usuario === sesion.usuario).reverse().map(p =>
        `<tr><td>${p.id}</td><td>${detalle(p.items)}</td><td>${bs(p.total)}</td><td>${esc(p.fecha)}</td><td>${p.estado}</td>
        <td>${p.estado === "Pendiente" ? `<button class="del" data-id="${p.id}">Cancelar</button>` : ""}</td></tr>`).join("")
        || '<tr><td colspan="6">Aún no tienes pedidos</td></tr>';
    };
    $("lista").addEventListener("click", async e => {
      if (!e.target.dataset.id) return;
      const id = e.target.dataset.id;
      await sync();
      const l = leer("pan_pedidos"), p = l.find(x => x.id == id);
      if (!p || p.estado !== "Pendiente") return pintar();
      cancelarPedido(p);
      guardar("pan_pedidos", l); pintar();
    });
    document.addEventListener("datos", pintar);
    pintar();
  }
}

if (["inicio", "pedidos", "ventas"].includes(pagina)) setInterval(() => location.reload(), 20000);
})();
