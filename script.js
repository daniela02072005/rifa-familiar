const PRICE_PER_NUMBER = 30;
const TOTAL_NUMBERS = 1000; // Numeración del 000 al 999

// Número de WhatsApp de la ADMINISTRACIÓN (formato internacional sin '+' ni símbolos)
// Ejemplo EE. UU. (305) 123-4567 -> "13051234567"
const ADMIN_WHATSAPP_PHONE = "13050000000";

// Fotos del carrusel del vehículo.
// Coloca tus imágenes en una carpeta llamada "fotos" junto a estos archivos
// con estos nombres exactos, o cambia aquí las rutas.
const CAROUSEL_IMAGES = [
  { src: "fotos/carro-1.jpg", alt: "Vista frontal del vehículo" },
  { src: "fotos/carro-2.jpg", alt: "Vista lateral del vehículo" },
  { src: "fotos/carro-3.jpg", alt: "Interior del vehículo" },
  { src: "fotos/carro-4.jpg", alt: "Detalle del frente del vehículo" }
];

const CAROUSEL_INTERVAL = 4000; // milisegundos entre fotos

const STORAGE_KEYS = {
  SOLD_NUMBERS: "rifa_sold_v3",
  PENDING_NUMBERS: "rifa_pending_v3",
  REQUESTS: "rifa_requests_v3"
};

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

// ---------- ALMACENAMIENTO ----------

// Números vendidos definitivamente
function getSoldNumbers() {
  const saved = localStorage.getItem(STORAGE_KEYS.SOLD_NUMBERS);
  if (saved) return new Set(JSON.parse(saved));
  localStorage.setItem(STORAGE_KEYS.SOLD_NUMBERS, JSON.stringify([]));
  return new Set([]);
}

// Números apartados / en revisión / a plazos
function getPendingNumbers() {
  const saved = localStorage.getItem(STORAGE_KEYS.PENDING_NUMBERS);
  if (saved) return new Set(JSON.parse(saved));
  localStorage.setItem(STORAGE_KEYS.PENDING_NUMBERS, JSON.stringify([]));
  return new Set([]);
}

let soldNumbers = getSoldNumbers();
let pendingNumbers = getPendingNumbers();

// ---------- REFERENCIAS DEL DOM ----------
const grid = document.querySelector("#numbers-grid");
const searchInput = document.querySelector("#search-number");
const clearButton = document.querySelector("#clear-selection");
const countOutput = document.querySelector("#selection-count");
const previewOutput = document.querySelector("#selection-preview");
const totalOutput = document.querySelector("#selection-total");
const whatsappButton = document.querySelector("#whatsapp-button");
const emptySearch = document.querySelector("#empty-search");

// Estadísticas del hero
const statAvailable = document.querySelector("#stat-available");
const statPending = document.querySelector("#stat-pending");
const statSold = document.querySelector("#stat-sold");

// Modal de reserva
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

// ---------- CONTADOR DE DISPONIBLES ----------

function updateAvailabilityStats() {
  const sold = getSoldNumbers();
  const pending = getPendingNumbers();

  const totalOcupados = new Set([...sold, ...pending]).size;
  const disponibles = TOTAL_NUMBERS - totalOcupados;

  if (statAvailable) statAvailable.textContent = disponibles.toLocaleString("es-ES");
  if (statPending) statPending.textContent = pending.size.toLocaleString("es-ES");
  if (statSold) statSold.textContent = sold.size.toLocaleString("es-ES");
}

// ---------- CARRUSEL DE FOTOS ----------

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

    // Si la foto todavía no existe, mostramos un marcador discreto
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

  function startAuto() {
    stopAuto();
    carouselTimer = setInterval(nextSlide, CAROUSEL_INTERVAL);
  }

  function stopAuto() {
    if (carouselTimer) clearInterval(carouselTimer);
    carouselTimer = null;
  }

  nextBtn?.addEventListener("click", () => { nextSlide(); startAuto(); });
  prevBtn?.addEventListener("click", () => { goToSlide(carouselIndex - 1); startAuto(); });

  // Se pausa al pasar el ratón por encima
  carousel?.addEventListener("mouseenter", stopAuto);
  carousel?.addEventListener("mouseleave", startAuto);

  // Pausa también en móvil mientras se toca
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

// ---------- TABLERO DE NÚMEROS ----------

function renderNumbers(filter = "") {
  soldNumbers = getSoldNumbers();
  pendingNumbers = getPendingNumbers();

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
  if (selectedNumbers.has(number)) {
    selectedNumbers.delete(number);
  } else {
    selectedNumbers.add(number);
  }

  const button = buttonsByNumber.get(number);
  if (button) {
    button.classList.toggle("selected", selectedNumbers.has(number));
    button.setAttribute("aria-pressed", String(selectedNumbers.has(number)));
  }

  updateSummary();
}

// ---------- PRECIOS CON DESCUENTO POR CANTIDAD ----------
// El descuento se aplica SOLO cuando la cantidad coincide exactamente con el escalón.
const PROMO_PRICES = {
  5: 130,
  10: 250,
  50: 1200
};

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

  // Total: si hay promo, el precio normal tachado arriba y el rebajado en grande debajo
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

  // Aviso del próximo escalón de descuento
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

checkoutForm.addEventListener("submit", (e) => {
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
  const saving = getSaving(count);

  const rawRequests = localStorage.getItem(STORAGE_KEYS.REQUESTS);
  const requests = rawRequests ? JSON.parse(rawRequests) : [];

  const newId = `SOL-${String(requests.length + 1).padStart(4, "0")}`;
  const newRequest = {
    id: newId,
    buyer: buyerName,
    phone: displayPhone,
    phoneDigits: cleanPhone,
    countryCode: countryCode,
    method: "Transferencia / Zelle / Efectivo",
    numbers: numbers,
    amount: total,
    paidAmount: 0,
    remainingAmount: total,
    status: "pending",
    notes: "",
    createdAt: new Date().toLocaleDateString("es-ES")
  };

  requests.unshift(newRequest);
  localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));

  // Los números pasan a apartado de inmediato
  const pSet = getPendingNumbers();
  numbers.forEach(n => pSet.add(n));
  localStorage.setItem(STORAGE_KEYS.PENDING_NUMBERS, JSON.stringify([...pSet]));

  checkoutDialog.close();
  checkoutForm.reset();
  syncPrefix();
  selectedNumbers.clear();
  renderNumbers(searchInput.value);
  updateSummary();

  const formattedNumbers = numbers.map(formatNumber).join(", ");
  const message = `¡Hola! Acabo de apartar mis números en la web para la Rifa del Vehículo.\n\n` +
    `📋 *Solicitud:* #${newId}\n` +
    `👤 *Nombre:* ${buyerName}\n` +
    `📱 *Teléfono:* ${displayPhone}\n` +
    `🎟 *Números apartados:* ${formattedNumbers}\n` +
    `💵 *Total:* $${total} USD${saving > 0 ? ` _(promo aplicada, ahorro de $${saving})_` : ''}\n\n` +
    `Te adjunto por aquí mi comprobante de pago o conversemos para organizar mi abono a plazos. ¡Gracias!`;

  const waUrl = `https://wa.me/${ADMIN_WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
});

// ---------- BÚSQUEDA Y SINCRONIZACIÓN ----------

searchInput.addEventListener("input", () => renderNumbers(searchInput.value));
clearButton.addEventListener("click", () => {
  selectedNumbers.clear();
  renderNumbers(searchInput.value);
  updateSummary();
});

window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEYS.SOLD_NUMBERS ||
      e.key === STORAGE_KEYS.PENDING_NUMBERS ||
      e.key === STORAGE_KEYS.REQUESTS) {
    renderNumbers(searchInput.value);
    updateSummary();
  }
});

// ---------- INICIO ----------
initCarousel();
renderNumbers();
updateSummary();
