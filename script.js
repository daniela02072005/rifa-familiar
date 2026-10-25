const PRICE_PER_NUMBER = 30;
const TOTAL_NUMBERS = 1000; // Numeración del 000 al 999

// Número de WhatsApp de la ADMINISTRACIÓN (formato internacional sin '+' ni símbolos)
const ADMIN_WHATSAPP_PHONE = "17326261691";

// Fotos del carrusel del vehículo. Colócalas en la carpeta "fotos/".
const CAROUSEL_IMAGES = [
  { src: "fotos/carro-1.jpg", alt: "Vista frontal del vehículo" },
  { src: "fotos/carro-2.jpg", alt: "Vista lateral del vehículo" },
  { src: "fotos/carro-3.jpg", alt: "Vista trasera del vehículo" },
  { src: "fotos/carro-4.jpg", alt: "Interior del vehículo" },
  { src: "fotos/carro-5.jpg", alt: "Tablero y volante del vehículo" },
  { src: "fotos/carro-6.jpg", alt: "Detalle adicional del vehículo" }
];

const CAROUSEL_INTERVAL = 4000;

// ---------- ESTADO EN MEMORIA ----------
let soldNumbers = new Set();
let pendingNumbers = new Set();

// ---------- UTILIDADES DE TELÉFONO ----------

function buildInternational(countryCode, localNumber) {
  const code = String(countryCode || "").replace(/\D/g, "");
  const local = String(localNumber || "").replace(/\D/g, "");
  return `${code}${local}`;
}

function formatPhoneDisplay(countryCode, localNumber) {
  const code = String(countryCode || "").replace(/\D/g, "");
  const local = String(localNumber || "").replace(/\D/g, "");
  if (!local) return `+${code}`;
  if ((code === "1" || code === "1809") && local.length === 10) {
    return `+${code} (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  const groups = local.match(/.{1,3}/g) || [local];
  return `+${code} ${groups.join(" ")}`;
}

// ---------- REFERENCIAS DEL DOM ----------
const grid = document.querySelector("#numbers-grid");
const searchInput = document.querySelector("#search-number");
const clearButton = document.querySelector("#clear-selection");
const countOutput = document.querySelector("#selection-count");
const previewOutput = document.querySelector("#selection-preview");
const totalOutput = document.querySelector("#selection-total");
const whatsappButton = document.querySelector("#whatsapp-button");
const emptySearch = document.querySelector("#empty-search");

const statAvailable = document.querySelector("#stat-available");
const statPending = document.querySelector("#stat-pending");
const statSold = document.querySelector("#stat-sold");

const checkoutDialog = document.querySelector("#checkout-dialog");
const closeCheckoutBtn = document.querySelector("#close-checkout");
const checkoutForm = document.querySelector("#checkout-form");
const buyerNameInput = document.querySelector("#buyer-name");
const buyerCountrySelect = document.querySelector("#buyer-country");
const buyerPhoneInput = document.querySelector("#buyer-phone");
const phonePrefixEl = document.querySelector("#phone-prefix");
const phoneHelp = document.querySelector("#phone-help");
const modalTicketsPreview = document.querySelector("#modal-tickets-preview");
const modalTotalPreview = document.querySelector("#modal-total-preview");

const selectedNumbers = new Set();
const buttonsByNumber = new Map();

function formatNumber(number) {
  return String(number).padStart(3, "0");
}

// ---------- CARGA DEL TABLERO DESDE SUPABASE ----------

async function loadBoardFromSupabase() {
  if (!supabaseClient) {
    console.error("Supabase no está disponible. Revisa supabase-config.js");
    return false;
  }

  const { data, error } = await supabaseClient
    .from("numeros")
    .select("numero,estado");

  if (error) {
    console.error("Error al leer el tablero:", error.message);
    return false;
  }

  soldNumbers = new Set();
  pendingNumbers = new Set();

  (data || []).forEach(row => {
    if (row.estado === "vendido") soldNumbers.add(row.numero);
    else if (row.estado === "apartado") pendingNumbers.add(row.numero);
  });

  return true;
}

// ---------- CONTADOR DE DISPONIBLES ----------
function updateAvailabilityStats() {
  const totalOcupados = new Set([...soldNumbers, ...pendingNumbers]).size;
  const disponibles = TOTAL_NUMBERS - totalOcupados;

  if (statAvailable) statAvailable.textContent = disponibles.toLocaleString("es-ES");
  if (statPending) statPending.textContent = pendingNumbers.size.toLocaleString("es-ES");
  if (statSold) statSold.textContent = soldNumbers.size.toLocaleString("es-ES");
}

// ---------- CARRUSEL ----------
let carouselIndex = 0;
let carouselTimer = null;

function initCarousel() {
  const track = document.querySelector("#carousel-track");
  const dotsWrap = document.querySelector("#carousel-dots");
  const prevBtn = document.querySelector("#carousel-prev");
  const nextBtn = document.querySelector("#carousel-next");
  const carousel = document.querySelector("#carousel");
  if (!track || !dotsWrap) return;

  track.innerHTML = "";
  dotsWrap.innerHTML = "";

  CAROUSEL_IMAGES.forEach((img, i) => {
    const figure = document.createElement("div");
    figure.className = "carousel-slide" + (i === 0 ? " active" : "");

    const image = document.createElement("img");
    image.src = img.src;
    image.alt = img.alt;
    image.loading = i === 0 ? "eager" : "lazy";

    image.addEventListener("error", () => {
      figure.classList.add("slide-missing");
      image.style.display = "none";
      if (!figure.querySelector(".slide-placeholder")) {
        const ph = document.createElement("div");
        ph.className = "slide-placeholder";
        ph.innerHTML = `<span>📷</span><small>Coloca <code>${img.src}</code></small>`;
        figure.append(ph);
      }
    });

    figure.append(image);
    track.append(figure);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "carousel-dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Ir a la foto ${i + 1}`);
    dot.addEventListener("click", () => goToSlide(i));
    dotsWrap.append(dot);
  });

  function goToSlide(index) {
    carouselIndex = (index + CAROUSEL_IMAGES.length) % CAROUSEL_IMAGES.length;
    track.querySelectorAll(".carousel-slide").forEach((slide, i) => {
      slide.classList.toggle("active", i === carouselIndex);
    });
    dotsWrap.querySelectorAll(".carousel-dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === carouselIndex);
    });
  }

  function nextSlide() { goToSlide(carouselIndex + 1); }
  function startAuto() { stopAuto(); carouselTimer = setInterval(nextSlide, CAROUSEL_INTERVAL); }
  function stopAuto() { if (carouselTimer) clearInterval(carouselTimer); carouselTimer = null; }

  nextBtn?.addEventListener("click", () => { nextSlide(); startAuto(); });
  prevBtn?.addEventListener("click", () => { goToSlide(carouselIndex - 1); startAuto(); });
  carousel?.addEventListener("mouseenter", stopAuto);
  carousel?.addEventListener("mouseleave", startAuto);
  carousel?.addEventListener("touchstart", stopAuto, { passive: true });
  carousel?.addEventListener("touchend", startAuto, { passive: true });

  startAuto();
}

// ---------- SELECTOR DE PAÍS ----------
function getCountryCode() {
  return buyerCountrySelect.value.replace(/\D/g, "");
}

function getExpectedDigits() {
  const opt = buyerCountrySelect.options[buyerCountrySelect.selectedIndex];
  return parseInt(opt.dataset.digits || "10", 10);
}

function syncPrefix() {
  if (phonePrefixEl) phonePrefixEl.textContent = `+${getCountryCode()}`;
  if (phoneHelp) {
    phoneHelp.textContent = `Escribe tu número local sin el código de país (${getExpectedDigits()} dígitos).`;
    phoneHelp.style.color = "";
  }
}

buyerCountrySelect.addEventListener("change", () => {
  buyerPhoneInput.value = "";
  syncPrefix();
  buyerPhoneInput.focus();
});

buyerPhoneInput.addEventListener("input", () => {
  const max = getExpectedDigits();
  const digits = buyerPhoneInput.value.replace(/\D/g, "").slice(0, max);
  buyerPhoneInput.value = digits;

  if (!phoneHelp) return;
  const faltan = max - digits.length;

  if (digits.length === 0) {
    phoneHelp.textContent = `Escribe tu número local sin el código de país (${max} dígitos).`;
    phoneHelp.style.color = "";
  } else if (faltan > 0) {
    phoneHelp.textContent = `Faltan ${faltan} ${faltan === 1 ? "dígito" : "dígitos"} (${digits.length}/${max}).`;
    phoneHelp.style.color = "var(--amber)";
  } else {
    phoneHelp.textContent = `Número completo: +${getCountryCode()} ${digits}. Correcto.`;
    phoneHelp.style.color = "var(--green)";
  }
});

syncPrefix();

// ---------- TABLERO ----------
function renderNumbers(filter = "") {
  const normalizedFilter = filter.trim().replace(/\D/g, "");
  grid.replaceChildren();
  buttonsByNumber.clear();
  let visibleCount = 0;

  for (let number = 0; number < TOTAL_NUMBERS; number++) {
    const formatted = formatNumber(number);
    if (normalizedFilter && !formatted.includes(normalizedFilter)) continue;
    visibleCount++;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "number";
    button.textContent = formatted;
    button.setAttribute("aria-label", `Número ${formatted}`);

    if (soldNumbers.has(number)) {
      button.classList.add("sold");
      button.disabled = true;
      button.title = "Número vendido definitivamente";
      selectedNumbers.delete(number);
    } else if (pendingNumbers.has(number)) {
      button.classList.add("pending");
      button.disabled = true;
      button.title = "Número apartado en revisión o abono a plazos";
      selectedNumbers.delete(number);
    } else {
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => toggleNumber(number));
    }

    if (selectedNumbers.has(number)) {
      button.classList.add("selected");
      button.setAttribute("aria-pressed", "true");
    }

    buttonsByNumber.set(number, button);
    grid.append(button);
  }

  emptySearch.hidden = visibleCount !== 0;
  updateAvailabilityStats();
}

function toggleNumber(number) {
  if (selectedNumbers.has(number)) selectedNumbers.delete(number);
  else selectedNumbers.add(number);

  const button = buttonsByNumber.get(number);
  if (button) {
    button.classList.toggle("selected", selectedNumbers.has(number));
    button.setAttribute("aria-pressed", String(selectedNumbers.has(number)));
  }
  updateSummary();
}

// ---------- PRECIOS CON DESCUENTO ----------
const PROMO_PRICES = { 5: 130, 10: 250, 50: 1200 };

function getTotalPrice(count) {
  if (PROMO_PRICES[count] !== undefined) return PROMO_PRICES[count];
  return count * PRICE_PER_NUMBER;
}

function getSaving(count) {
  return count * PRICE_PER_NUMBER - getTotalPrice(count);
}

function getNextTier(count) {
  if (count >= 50) return null;
  if (count >= 10) return { qty: 50, total: 1200 };
  if (count >= 5) return { qty: 10, total: 250 };
  return { qty: 5, total: 130 };
}

function updateSummary() {
  const numbers = [...selectedNumbers].sort((a, b) => a - b);
  const count = numbers.length;
  const total = getTotalPrice(count);
  const saving = getSaving(count);

  countOutput.textContent = `${count} ${count === 1 ? "número seleccionado" : "números seleccionados"}`;
  previewOutput.textContent = count ? numbers.map(formatNumber).join(", ") : "Todavía no has elegido números.";

  const originalOutput = document.querySelector("#total-original");
  const savingOutput = document.querySelector("#total-saving");

  if (saving > 0) {
    const original = count * PRICE_PER_NUMBER;
    if (originalOutput) {
      originalOutput.textContent = `$${original.toLocaleString("en-US")}`;
      originalOutput.classList.remove("hidden");
    }
    totalOutput.innerHTML = `$${total.toLocaleString("en-US")} <small>USD</small>`;
    totalOutput.classList.add("promo-active");
    if (savingOutput) {
      savingOutput.textContent = `Ahorras $${saving}`;
      savingOutput.classList.remove("hidden");
    }
  } else {
    if (originalOutput) {
      originalOutput.textContent = "";
      originalOutput.classList.add("hidden");
    }
    totalOutput.innerHTML = `$${total.toLocaleString("en-US")} <small>USD</small>`;
    totalOutput.classList.remove("promo-active");
    if (savingOutput) {
      savingOutput.textContent = "";
      savingOutput.classList.add("hidden");
    }
  }

  const tierHint = document.querySelector("#tier-hint");
  if (tierHint) {
    const next = count > 0 ? getNextTier(count) : { qty: 5, total: 130 };
    if (next) {
      const faltan = next.qty - count;
      tierHint.textContent = `Con ${next.qty} boletas pagarías $${next.total} USD. Te ${faltan === 1 ? "falta 1 boleta" : `faltan ${faltan} boletas`}.`;
      tierHint.classList.remove("hidden");
    } else {
      tierHint.classList.add("hidden");
    }
  }

  whatsappButton.disabled = count === 0;
}

// ---------- APARTAR Y ENVIAR ----------
whatsappButton.addEventListener("click", () => {
  if (selectedNumbers.size === 0) return;
  const numbers = [...selectedNumbers].sort((a, b) => a - b);
  const count = numbers.length;
  const total = getTotalPrice(count);
  const saving = getSaving(count);

  modalTicketsPreview.textContent = numbers.map(formatNumber).join(", ");
  modalTotalPreview.textContent = saving > 0
    ? `$${total} USD (${count} boletas · ahorras $${saving})`
    : `$${total} USD (${count} boletas)`;
  checkoutDialog.showModal();
});

closeCheckoutBtn?.addEventListener("click", () => checkoutDialog.close());

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const buyerName = buyerNameInput.value.trim();
  const countryCode = getCountryCode();
  const expected = getExpectedDigits();
  const localDigits = buyerPhoneInput.value.replace(/\D/g, "");

  if (localDigits.length !== expected) {
    alert(`El número debe tener ${expected} dígitos para el país seleccionado (+${countryCode}).\nAhora escribiste ${localDigits.length}.`);
    buyerPhoneInput.focus();
    return;
  }

  const cleanPhone = buildInternational(countryCode, localDigits);
  const displayPhone = formatPhoneDisplay(countryCode, localDigits);

  const numbers = [...selectedNumbers].sort((a, b) => a - b);
  const count = numbers.length;
  const total = getTotalPrice(count);

  const submitBtn = checkoutForm.querySelector("button[type='submit']");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Procesando..."; }

  try {
    const codigo = `SOL-${Date.now().toString().slice(-6)}`;

    // Subida opcional del comprobante a Supabase Storage (bucket 'comprobantes')
    let comprobanteUrl = null;
    const fileInput = document.querySelector("#payment-receipt");
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      if (submitBtn) submitBtn.textContent = "Subiendo comprobante...";

      const fileExt = file.name.split('.').pop() || "jpg";
      const cleanFileName = `${codigo}_${Date.now()}.${fileExt}`;
      const filePath = `recibos/${cleanFileName}`;

      const { data: uploadData, error: uploadErr } = await supabaseClient
        .storage
        .from("comprobantes")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadErr) {
        console.warn("Aviso al subir comprobante a Storage:", uploadErr.message);
      } else {
        const { data: publicUrlData } = supabaseClient
          .storage
          .from("comprobantes")
          .getPublicUrl(filePath);
        comprobanteUrl = publicUrlData ? publicUrlData.publicUrl : null;
      }
    }

    if (submitBtn) submitBtn.textContent = "Guardando reserva...";

    // Sin .select(): insertamos sin pedir la fila de vuelta, así la web
    // pública no necesita permiso de lectura sobre la tabla solicitudes.
    const { error: errSol } = await supabaseClient
      .from("solicitudes")
      .insert([{
        codigo,
        comprador: buyerName,
        telefono: displayPhone,
        telefono_digitos: cleanPhone,
        codigo_pais: countryCode,
        metodo: "Transferencia / Zelle / Efectivo",
        total,
        abonado: 0,
        saldo: total,
        estado: "pendiente",
        notas: comprobanteUrl ? "Comprobante adjunto en línea" : "",
        numeros: numbers,
        comprobante_url: comprobanteUrl
      }]);

    if (errSol) throw errSol;

    // 2. Marcar los números como apartados en la base de datos.
    // El vínculo con la solicitud lo deja el código (codigo), que la
    // administradora usará para localizarla en el panel.
    const { error: errNum } = await supabaseClient
      .from("numeros")
      .update({ estado: "apartado" })
      .in("numero", numbers)
      .eq("estado", "disponible");

    if (errNum) throw errNum;

    // 3. Refrescar el tablero con el estado real
    await loadBoardFromSupabase();
    renderNumbers(searchInput.value);

    checkoutDialog.close();
    checkoutForm.reset();
    const fileNameEl = document.querySelector("#upload-file-name");
    if (fileNameEl) fileNameEl.textContent = "Toca aquí para subir tu captura o foto";
    document.querySelector("#receipt-dropzone")?.classList.remove("has-file");
    syncPrefix();
    selectedNumbers.clear();
    updateSummary();

    // 4. Abrir WhatsApp con el mensaje redactado
    const formattedNumbers = numbers.map(formatNumber).join(", ");
    const comprobanteAviso = comprobanteUrl
      ? `\n📎 *Comprobante:* Adjuntado en la web\n`
      : `\nTe adjunto por aquí mi comprobante de pago o conversemos para organizar mi abono a plazos.\n`;

    const message = `¡Hola! Acabo de apartar mis números en la web para la Rifa del Vehículo.\n\n` +
      `*Solicitud:* #${codigo}\n` +
      `*Nombre:* ${buyerName}\n` +
      `*Teléfono:* ${displayPhone}\n` +
      `*Números apartados:* ${formattedNumbers}\n` +
      `*Total:* $${total} USD\n` +
      comprobanteAviso +
      `\n¡Muchas gracias!`;

    window.open(`https://wa.me/${ADMIN_WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`, "_blank");

  } catch (err) {
    console.error("Error al guardar la reserva:", err);
    alert("No se pudo guardar la reserva. Revisa tu conexión e inténtalo de nuevo.\n\nDetalle: " + (err.message || err));
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Apartar números y enviar por WhatsApp ↗"; }
  }
});

// ---------- BÚSQUEDA ----------
searchInput.addEventListener("input", () => renderNumbers(searchInput.value));
clearButton.addEventListener("click", () => {
  selectedNumbers.clear();
  renderNumbers(searchInput.value);
  updateSummary();
});

// ---------- ACTUALIZACIÓN AUTOMÁTICA ----------
// Cada 15 segundos volvemos a leer la base de datos para reflejar
// cambios hechos desde otros dispositivos.
function startAutoRefresh() {
  setInterval(async () => {
    const ok = await loadBoardFromSupabase();
    if (ok) {
      renderNumbers(searchInput.value);
      updateSummary();
    }
  }, 15000);
}

// ---------- INICIO ----------
async function init() {
  initCarousel();

  const ok = await loadBoardFromSupabase();
  if (!ok) {
    grid.innerHTML = `<p class="empty-search">No se pudo conectar con la base de datos. Recarga la página o revisa supabase-config.js</p>`;
  }

  renderNumbers();
  updateSummary();
  startAutoRefresh();
}

init();


// ---------- BOTONES DE COPIAR ZELLE ----------
document.querySelectorAll(".copy-zelle-btn").forEach(btn => {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const textToCopy = btn.getAttribute("data-copy");
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      const textSpan = btn.querySelector(".copy-text");
      const iconSpan = btn.querySelector(".copy-icon");
      const origText = textSpan ? textSpan.textContent : "Copiar";

      btn.classList.add("copied");
      if (textSpan) textSpan.textContent = "¡Copiado!";
      if (iconSpan) iconSpan.textContent = "✓";

      setTimeout(() => {
        btn.classList.remove("copied");
        if (textSpan) textSpan.textContent = origText;
        if (iconSpan) iconSpan.textContent = "📋";
      }, 2000);
    } catch (err) {
      prompt("Copia el número manualmente:", textToCopy);
    }
  });
});

// ---------- FEEDBACK DE COMPROBANTE SELECCIONADO ----------
const receiptInput = document.querySelector("#payment-receipt");
const uploadFileName = document.querySelector("#upload-file-name");
const receiptDropzone = document.querySelector("#receipt-dropzone");

if (receiptInput && uploadFileName && receiptDropzone) {
  receiptInput.addEventListener("change", () => {
    if (receiptInput.files && receiptInput.files[0]) {
      const f = receiptInput.files[0];
      const kb = (f.size / 1024).toFixed(0);
      uploadFileName.innerHTML = `<strong>✓ ${f.name}</strong> (${kb} KB)`;
      receiptDropzone.classList.add("has-file");
    } else {
      uploadFileName.textContent = "Toca aquí para subir tu captura o foto";
      receiptDropzone.classList.remove("has-file");
    }
  });
}
