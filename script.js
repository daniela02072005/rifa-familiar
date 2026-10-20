const PRICE_PER_NUMBER = 30;
const TOTAL_NUMBERS = 1000; // Numeración del 000 al 999

// Número de WhatsApp de la ADMINISTRACIÓN (formato internacional sin '+' ni símbolos)
// Ejemplo EE. UU. (305) 123-4567 -> "13051234567"
const ADMIN_WHATSAPP_PHONE = "13050000000";

const STORAGE_KEYS = {
  SOLD_NUMBERS: "rifa_sold_v3",
  PENDING_NUMBERS: "rifa_pending_v3",
  REQUESTS: "rifa_requests_v3"
};

// ---------- UTILIDADES DE TELÉFONO ----------

// Une el código de país con el número local -> número internacional para WhatsApp
function buildInternational(countryCode, localNumber) {
  const code = String(countryCode || "").replace(/\D/g, "");
  const local = String(localNumber || "").replace(/\D/g, "");
  return `${code}${local}`;
}

// Formato bonito para mostrar y guardar: +1 (305) 123-4567 / +52 5512 3456 78
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

// ---------- ALMACENAMIENTO (localStorage) ----------

// Números vendidos definitivamente (gris tachado)
function getSoldNumbers() {
  const saved = localStorage.getItem(STORAGE_KEYS.SOLD_NUMBERS);
  if (saved) return new Set(JSON.parse(saved));
  localStorage.setItem(STORAGE_KEYS.SOLD_NUMBERS, JSON.stringify([]));
  return new Set([]);
}

// Números apartados / en revisión / a plazos (AMARILLO)
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

// ---------- SELECTOR DE PAÍS ----------

function getCountryCode() {
  return buyerCountrySelect.value.replace(/\D/g, "");
}

function getExpectedDigits() {
  const opt = buyerCountrySelect.options[buyerCountrySelect.selectedIndex];
  return parseInt(opt.dataset.digits || "10", 10);
}

// Sincroniza el prefijo visible y el texto de ayuda con el país elegido
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

// Solo dígitos, con aviso en vivo de cuántos faltan
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
      // VENDIDO DEFINITIVO
      button.classList.add("sold");
      button.disabled = true;
      button.title = "Número vendido definitivamente";
      selectedNumbers.delete(number);
    } else if (pendingNumbers.has(number)) {
      // APARTADO / EN REVISIÓN / A PLAZOS (AMARILLO)
      button.classList.add("pending");
      button.disabled = true;
      button.title = "Número apartado en revisión o abono a plazos";
      selectedNumbers.delete(number);
    } else {
      // DISPONIBLE
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

function updateSummary() {
  const numbers = [...selectedNumbers].sort((a, b) => a - b);
  const count = numbers.length;
  const total = count * PRICE_PER_NUMBER;

  countOutput.textContent = `${count} ${count === 1 ? "número seleccionado" : "números seleccionados"}`;
  previewOutput.textContent = count ? numbers.map(formatNumber).join(", ") : "Todavía no has elegido números.";
  totalOutput.innerHTML = `$${total.toLocaleString("en-US")} <small>USD</small>`;
  whatsappButton.disabled = count === 0;
}

// ---------- APARTAR Y ENVIAR ----------

whatsappButton.addEventListener("click", () => {
  if (selectedNumbers.size === 0) return;
  const numbers = [...selectedNumbers].sort((a, b) => a - b);
  const total = numbers.length * PRICE_PER_NUMBER;

  modalTicketsPreview.textContent = numbers.map(formatNumber).join(", ");
  modalTotalPreview.textContent = `$${total} USD (${numbers.length} boletas)`;
  checkoutDialog.showModal();
});

closeCheckoutBtn?.addEventListener("click", () => checkoutDialog.close());

checkoutForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const buyerName = buyerNameInput.value.trim();
  const countryCode = getCountryCode();
  const expected = getExpectedDigits();
  const localDigits = buyerPhoneInput.value.replace(/\D/g, "");

  // Validación por país: el número local debe tener los dígitos esperados
  if (localDigits.length !== expected) {
    alert(`El número debe tener ${expected} dígitos para el país seleccionado (+${countryCode}).\nAhora escribiste ${localDigits.length}.`);
    buyerPhoneInput.focus();
    return;
  }

  // Número internacional final para WhatsApp, guardado y mostrado
  const cleanPhone = buildInternational(countryCode, localDigits);
  const displayPhone = formatPhoneDisplay(countryCode, localDigits);

  const numbers = [...selectedNumbers].sort((a, b) => a - b);
  const total = numbers.length * PRICE_PER_NUMBER;

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
    status: "pending", // pending (amarillo) | partial (plazos) | approved (vendido) | rejected
    notes: "",
    createdAt: new Date().toLocaleDateString("es-ES")
  };

  requests.unshift(newRequest);
  localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));

  // Los números pasan a AMARILLO de inmediato
  const pSet = getPendingNumbers();
  numbers.forEach(n => pSet.add(n));
  localStorage.setItem(STORAGE_KEYS.PENDING_NUMBERS, JSON.stringify([...pSet]));

  checkoutDialog.close();
  checkoutForm.reset();
  syncPrefix();
  selectedNumbers.clear();
  renderNumbers(searchInput.value);
  updateSummary();

  // Abrir WhatsApp con el mensaje ya redactado
  const formattedNumbers = numbers.map(formatNumber).join(", ");
  const message = `¡Hola! Acabo de apartar mis números en la web para la Rifa del Vehículo.\n\n` +
    `📋 *Solicitud:* #${newId}\n` +
    `👤 *Nombre:* ${buyerName}\n` +
    `📱 *Teléfono:* ${displayPhone}\n` +
    `🎟 *Números apartados:* ${formattedNumbers}\n` +
    `💵 *Total:* $${total} USD\n\n` +
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
  if (e.key === STORAGE_KEYS.SOLD_NUMBERS || e.key === STORAGE_KEYS.PENDING_NUMBERS) {
    renderNumbers(searchInput.value);
    updateSummary();
  }
});

renderNumbers();
updateSummary();
