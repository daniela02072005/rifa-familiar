document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEYS = {
    SOLD_NUMBERS: "rifa_sold_v3",
    PENDING_NUMBERS: "rifa_pending_v3",
    REQUESTS: "rifa_requests_v3"
  };

  // Referencias DOM
  const loginScreen = document.querySelector("#login-screen");
  const loginForm = document.querySelector("#login-form");
  const usernameInput = document.querySelector("#username");
  const passwordInput = document.querySelector("#password");
  const loginError = document.querySelector("#login-error");

  const adminPanel = document.querySelector("#admin-panel");
  const logoutButton = document.querySelector("#logout-button");

  // Métricas
  const soldCountEl = document.querySelector("#sold-count");
  const pendingCountEl = document.querySelector("#pending-count");
  const partialCountEl = document.querySelector("#partial-count");
  const approvedTotalEl = document.querySelector("#approved-total");
  const debtTotalEl = document.querySelector("#debt-total");
  const requestCounterEl = document.querySelector("#request-counter");

  // Filtros y tabla
  const searchInput = document.querySelector("#search-input");
  const statusFilter = document.querySelector("#status-filter");
  const requestsTable = document.querySelector("#requests-table");
  const emptyState = document.querySelector("#empty-state");

  // Modal y Toast
  const detailsDialog = document.querySelector("#details-dialog");
  const detailsContent = document.querySelector("#details-content");
  const closeDialogBtn = document.querySelector("#close-dialog");
  const toast = document.querySelector("#toast");

  // Formato y limpieza de teléfono de EE.UU.
  function getUSCleanDigits(phoneStr) {
    const digits = (phoneStr || "").replace(/\D/g, "");
    if (digits.length === 10) return `1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return digits;
    return digits;
  }

  function formatUSDisplay(phoneStr) {
    const digits = (phoneStr || "").replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      const d = digits.slice(1);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    return phoneStr;
  }

  // 1. GESTIÓN DE ACCESO
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (usernameInput.value.trim() && passwordInput.value.trim()) {
      sessionStorage.setItem("admin_logged", "true");
      showPanel();
    } else {
      loginError.textContent = "Introduce un usuario y contraseña para entrar.";
    }
  });

  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("admin_logged");
    adminPanel.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    loginForm.reset();
  });

  function showPanel() {
    loginScreen.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    initInitialData();
    renderAll();
  }

  // 2. LECTURA Y ESCRITURA EN LOCALSTORAGE
  function getStoredData() {
    const sold = JSON.parse(localStorage.getItem(STORAGE_KEYS.SOLD_NUMBERS) || "[]");
    const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_NUMBERS) || "[]");
    const requests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS) || "[]");
    return {
      soldSet: new Set(sold),
      pendingSet: new Set(pending),
      requests
    };
  }

  function saveStoredData(soldSet, pendingSet, requests) {
    localStorage.setItem(STORAGE_KEYS.SOLD_NUMBERS, JSON.stringify([...soldSet]));
    localStorage.setItem(STORAGE_KEYS.PENDING_NUMBERS, JSON.stringify([...pendingSet]));
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
  }

  // No se crean solicitudes de ejemplo: el panel arranca completamente vacío.
  // Todos los números quedan disponibles hasta que llegue una reserva real desde la web.
  function initInitialData() {
    const { soldSet, pendingSet, requests } = getStoredData();
    // Solo nos aseguramos de que las claves existan en el almacenamiento.
    saveStoredData(soldSet, pendingSet, requests);
  }

  // 3. RENDERIZADO DE TABLA Y MÉTRICAS
  function renderAll() {
    const { soldSet, pendingSet, requests } = getStoredData();

    const pendingList = requests.filter(r => r.status === "pending");
    const partialList = requests.filter(r => r.status === "partial");

    // Métricas
    soldCountEl.textContent = soldSet.size;
    pendingCountEl.textContent = pendingList.length;
    partialCountEl.textContent = partialList.length;

    // Dinero recaudado real (ventas completas + parte abonada de plazos)
    const collected = requests.reduce((sum, r) => {
      if (r.status === "approved") return sum + (r.amount || 0);
      if (r.status === "partial") return sum + (r.paidAmount || 0);
      return sum;
    }, 0);
    approvedTotalEl.textContent = `$${collected.toLocaleString("en-US")}`;

    // Dinero pendiente de cobro en solicitudes activas
    const debt = requests.reduce((sum, r) => {
      if (r.status === "partial" || r.status === "pending") {
        return sum + (r.remainingAmount !== undefined ? r.remainingAmount : r.amount);
      }
      return sum;
    }, 0);
    debtTotalEl.textContent = `$${debt.toLocaleString("en-US")}`;

    // Filtrar solicitudes
    const query = searchInput.value.trim().toLowerCase();
    const filter = statusFilter.value;

    const filtered = requests.filter(req => {
      const matchFilter = filter === "all" || req.status === filter;
      const matchQuery =
        req.id.toLowerCase().includes(query) ||
        req.buyer.toLowerCase().includes(query) ||
        req.phone.toLowerCase().includes(query) ||
        req.numbers.some(n => String(n).includes(query));
      return matchFilter && matchQuery;
    });

    requestCounterEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'solicitud' : 'solicitudes'}`;

    // Dibujar filas de tabla
    requestsTable.innerHTML = "";
    if (filtered.length === 0) {
      emptyState.classList.remove("hidden");
    } else {
      emptyState.classList.add("hidden");
      filtered.forEach(req => {
        const waPhone = getUSCleanDigits(req.phone);
        const tr = document.createElement("tr");

        let statusText = "En revisión";
        if (req.status === "partial") statusText = "A plazos";
        if (req.status === "approved") statusText = "Pagado";
        if (req.status === "rejected") statusText = "Rechazada";

        const pillClass = req.status === "approved" ? "sold-pill" : "pending-pill";

        tr.innerHTML = `
          <td>
            <strong>${req.buyer}</strong><br>
            <small class="muted">${req.id}</small> · 
            <a href="https://wa.me/${waPhone}" target="_blank" style="color:var(--green); text-decoration:none; font-size:11px;">
              💬 WhatsApp (${formatUSDisplay(req.phone)})
            </a>
          </td>
          <td>
            <div class="ticket-pills">
              ${req.numbers.map(n => `<span class="ticket-pill ${pillClass}">${String(n).padStart(3, "0")}</span>`).join(" ")}
            </div>
          </td>
          <td>${req.numbers.length} boletas</td>
          <td>
            <strong>$${req.paidAmount || 0}</strong> <small class="muted">/ $${req.amount} USD</small>
          </td>
          <td>
            <span style="color: ${req.remainingAmount > 0 ? 'var(--amber)' : 'var(--muted)'}; font-weight:600;">
              $${req.remainingAmount !== undefined ? req.remainingAmount : req.amount} USD
            </span>
          </td>
          <td>
            <span class="status-badge ${req.status}">${statusText}</span>
          </td>
          <td>
            <button type="button" class="button button-small button-outline" data-id="${req.id}">
              Gestionar
            </button>
          </td>
        `;

        tr.querySelector("button").addEventListener("click", () => openManageModal(req.id));
        requestsTable.append(tr);
      });
    }
  }

  // 4. MODAL DE GESTIÓN (PAGO COMPLETO, A PLAZOS O RECHAZO)
  function openManageModal(requestId) {
    const { requests, soldSet, pendingSet } = getStoredData();
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    const formattedNumbers = req.numbers.map(n => String(n).padStart(3, "0"));
    const waPhone = getUSCleanDigits(req.phone);
    const displayPhone = formatUSDisplay(req.phone);
    const currentRemaining = req.remainingAmount !== undefined ? req.remainingAmount : req.amount;

    let statusTitle = "En revisión (Apartado en amarillo)";
    if (req.status === "partial") statusTitle = "Acuerdo a plazos / Abono activo (Amarillo)";
    if (req.status === "approved") statusTitle = "Pagado 100% / Vendido definitivo";
    if (req.status === "rejected") statusTitle = "Solicitud rechazada (Números liberados)";

    detailsContent.innerHTML = `
      <div class="confirm-flow">
        <header class="flow-header">
          <div>
            <p class="eyebrow">SOLICITUD #${req.id} · ${req.createdAt}</p>
            <h2 style="font-size: 19px; margin: 0;">${statusTitle}</h2>
          </div>
          <div class="flow-metrics">
            <div class="metric-card">
              <span class="metric-label">Total boletas</span>
              <strong>$${req.amount} USD</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Abonado hasta hoy</span>
              <strong style="color:var(--green);">$${req.paidAmount || 0} USD</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Saldo pendiente</span>
              <strong style="color:var(--amber);">$${currentRemaining} USD</strong>
            </div>
          </div>
        </header>

        <!-- DATOS DEL COMPRADOR -->
        <section class="step-card">
          <p class="eyebrow">DATOS DEL COMPRADOR</p>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <p style="margin: 0 0 4px;"><strong>${req.buyer}</strong> (${displayPhone})</p>
              <p class="muted" style="margin: 0;">Método: ${req.method}</p>
            </div>
            <a href="https://wa.me/${waPhone}" target="_blank" class="button button-small button-outline" style="color:var(--green);">
              💬 Abrir WhatsApp (${displayPhone})
            </a>
          </div>

          <div style="margin-top: 10px;">
            <span class="muted" style="font-size:11px;">Boletas apartadas (${req.numbers.length}):</span>
            <div class="ticket-pills" style="margin-top: 4px;">
              ${formattedNumbers.map(n => `<span class="ticket-pill pending-pill">${n}</span>`).join("")}
            </div>
          </div>

          ${req.notes ? `
            <div style="margin-top: 10px; background:#111; padding: 8px 12px; border-radius: 6px; font-size:12px; border:1px solid var(--line);">
              <strong>Historial de notas / acuerdos:</strong><br>
              <span style="color:#ddd;">${req.notes}</span>
            </div>
          ` : ''}
        </section>

        ${req.status !== "approved" && req.status !== "rejected" ? `
          <!-- VERIFICACIÓN BANCARIA PREVIA -->
          <section class="step-card">
            <p class="eyebrow">VERIFICACIÓN PREVIA</p>
            <div class="checklist">
              <label>
                <input type="checkbox" id="check-bank-account">
                <span>He verificado el ingreso real (Zelle / banco / efectivo) antes de registrar el movimiento.</span>
              </label>
            </div>
          </section>

          <!-- OPCIÓN B: REGISTRAR ABONO / PAGO A PLAZOS -->
          <section class="step-card" style="border-color: rgba(96, 165, 250, 0.4);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <p class="eyebrow" style="color:var(--blue);">PLAN A PLAZOS</p>
                <h3 style="color:var(--blue); margin:0;">Registrar Abono Parcial</h3>
              </div>
              <span class="muted" style="font-size:11px;">Mantiene las boletas en amarillo</span>
            </div>

            <div class="installment-box">
              <div class="field-row">
                <div>
                  <label for="installment-paid">Monto que abona en este pago ($ USD)</label>
                  <input type="number" id="installment-paid" min="1" max="${currentRemaining}" placeholder="Ej. 30" value="${Math.min(30, currentRemaining)}">
                </div>
                <div>
                  <label>Nuevo saldo por cobrar</label>
                  <input type="text" id="calc-remaining" readonly style="color:var(--amber); font-weight:bold;" value="$${Math.max(0, currentRemaining - Math.min(30, currentRemaining))} USD">
                </div>
              </div>
              <div>
                <label for="installment-notes">Acuerdo o fecha límite para el siguiente abono</label>
                <textarea id="installment-notes" rows="2" placeholder="Ej. Abonó $30 hoy por Zelle. Acuerda liquidar los $30 restantes el viernes."></textarea>
              </div>

              <button type="button" id="btn-save-installment" class="button button-blue full-width" style="margin-top:10px;" disabled>
                💾 Registrar Abono y Enviar Recibo por WhatsApp
              </button>
            </div>
          </section>

          <!-- OPCIÓN A: LIQUIDAR PAGO COMPLETO Y VENDER DEFINITIVAMENTE -->
          <section class="step-card" style="border-color: rgba(215, 181, 109, 0.4);">
            <p class="eyebrow">LIQUIDACIÓN TOTAL (100% PAGADO)</p>
            <h3>${req.paidAmount > 0 ? `Liquidar Saldo Restante ($${currentRemaining} USD)` : `Confirmar Pago Total ($${req.amount} USD)`}</h3>
            <p class="muted" style="margin-bottom: 12px;">
              Los números pasarán de amarillo a <strong>Vendido definitivo (gris tachado)</strong> y se generará la confirmación oficial.
            </p>

            <div class="modal-actions">
              <button type="button" id="btn-modal-reject" class="button button-danger">
                Rechazar y liberar números
              </button>

              <button type="button" id="btn-modal-confirm-full" class="button button-gold" disabled>
                ${req.paidAmount > 0 ? `Liquidar $${currentRemaining} USD y Cerrar Venta` : `Confirmar Pago Total ($${req.amount} USD)`}
              </button>
            </div>
          </section>
        ` : `
          <!-- SOLICITUD YA CERRADA -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
            <span class="muted">Esta solicitud está cerrada como <strong>${req.status.toUpperCase()}</strong>.</span>
            <button type="button" id="btn-reopen" class="button button-outline">
              Reabrir a En revisión (Amarillo)
            </button>
          </div>
        `}

      </div>
    `;

    // Lógica interactiva cuando la solicitud está activa
    if (req.status !== "approved" && req.status !== "rejected") {
      const checkBank = detailsContent.querySelector("#check-bank-account");
      const btnConfirmFull = detailsContent.querySelector("#btn-modal-confirm-full");
      const btnReject = detailsContent.querySelector("#btn-modal-reject");
      const btnSaveInstallment = detailsContent.querySelector("#btn-save-installment");
      const inputPaid = detailsContent.querySelector("#installment-paid");
      const calcRemaining = detailsContent.querySelector("#calc-remaining");
      const inputNotes = detailsContent.querySelector("#installment-notes");

      // La casilla de verificación habilita ambos botones de cobro
      checkBank.addEventListener("change", () => {
        btnConfirmFull.disabled = !checkBank.checked;
        btnSaveInstallment.disabled = !checkBank.checked;
      });

      // Cálculo en tiempo real del saldo restante al cambiar el input de abono
      inputPaid.addEventListener("input", () => {
        const val = parseFloat(inputPaid.value) || 0;
        const newRem = Math.max(0, currentRemaining - val);
        calcRemaining.value = `$${newRem} USD`;
      });

      // ACCIÓN 1: LIQUIDAR PAGO COMPLETO (Vendido definitivo)
      btnConfirmFull.addEventListener("click", () => {
        const { soldSet, pendingSet, requests: curReqs } = getStoredData();

        // Mover números de amarillo (pending) a vendido definitivo (sold)
        req.numbers.forEach(n => {
          pendingSet.delete(n);
          soldSet.add(n);
        });

        const target = curReqs.find(r => r.id === req.id);
        if (target) {
          target.status = "approved";
          target.paidAmount = target.amount;
          target.remainingAmount = 0;
          target.notes = (target.notes ? target.notes + " | " : "") + "Liquidado al 100%.";
        }

        saveStoredData(soldSet, pendingSet, curReqs);
        renderAll();

        // Mensaje oficial redactado con formato US
        const waMsg = encodeURIComponent(
          `🎉 *¡PAGO CONFIRMADO - RIFA DEL VEHÍCULO!* 🎉\n\n` +
          `Hola *${req.buyer}*, tu pago total de *$${req.amount} USD* correspondiente a la solicitud *#${req.id}* ha sido verificado con éxito.\n\n` +
          `🎟 *Tus números oficiales son:* ${formattedNumbers.join(", ")}\n\n` +
          `¡Ya estás participando formalmente en el sorteo! Te deseamos muchísima suerte.`
        );

        detailsContent.innerHTML = `
          <div style="text-align: center; padding: 20px 10px;">
            <span style="font-size: 42px;">🏆</span>
            <h2 style="color: var(--gold); margin: 10px 0;">¡Venta Completada y Cerrada!</h2>
            <p class="muted">
              Los números <strong>${formattedNumbers.join(", ")}</strong> pasaron a vendidos definitivamente (gris tachado).
            </p>
            <div style="margin: 20px 0; display:flex; flex-direction:column; gap:10px;">
              <a href="https://wa.me/${waPhone}?text=${waMsg}" target="_blank" class="button button-gold full-width" style="text-decoration:none;">
                💬 Enviar felicitación oficial a ${req.buyer} por WhatsApp
              </a>
              <button type="button" class="button button-outline full-width" onclick="document.querySelector('#details-dialog').close()">
                Cerrar ventana
              </button>
            </div>
          </div>
        `;

        showToast(`Solicitud #${req.id} liquidada al 100%.`);
      });

      // ACCIÓN 2: GUARDAR ABONO A PLAZOS
      btnSaveInstallment.addEventListener("click", () => {
        const abonoValor = parseFloat(inputPaid.value) || 0;
        if (abonoValor <= 0) {
          alert("Por favor introduce un monto de abono mayor a $0 USD.");
          return;
        }
        if (abonoValor > currentRemaining) {
          alert(`El abono ($${abonoValor} USD) no puede superar el saldo pendiente ($${currentRemaining} USD).`);
          return;
        }

        const { soldSet, pendingSet, requests: curReqs } = getStoredData();

        // Los números SE MANTIENEN en amarillo (pendingSet)
        req.numbers.forEach(n => pendingSet.add(n));

        const target = curReqs.find(r => r.id === req.id);
        if (target) {
          target.paidAmount = (target.paidAmount || 0) + abonoValor;
          target.remainingAmount = Math.max(0, target.amount - target.paidAmount);

          const notaTexto = inputNotes.value.trim();
          if (notaTexto) {
            target.notes = (target.notes ? target.notes + " | " : "") + `Abonó $${abonoValor} USD: ${notaTexto}`;
          }

          target.status = target.remainingAmount === 0 ? "approved" : "partial";

          // Si con este abono completó el total, se convierte en vendido definitivo automáticamente
          if (target.status === "approved") {
            req.numbers.forEach(n => {
              pendingSet.delete(n);
              soldSet.add(n);
            });
          }
        }

        saveStoredData(soldSet, pendingSet, curReqs);
        renderAll();

        const saldoRestante = target.remainingAmount;
        const waMsgAbono = encodeURIComponent(
          `📑 *RECIBO DE ABONO - RIFA DEL VEHÍCULO* 📑\n\n` +
          `Hola *${req.buyer}*, hemos registrado tu abono de *$${abonoValor} USD* para la solicitud *#${req.id}*.\n\n` +
          `🎟 *Boletas apartadas:* ${formattedNumbers.join(", ")}\n` +
          `💵 *Total acumulado abonado:* $${target.paidAmount} USD\n` +
          `⏳ *Saldo pendiente por liquidar:* $${saldoRestante} USD\n\n` +
          `${inputNotes.value.trim() ? `📌 *Acuerdo:* ${inputNotes.value.trim()}\n\n` : ''}` +
          `Tus números permanecen apartados y protegidos a tu nombre en la rifa. ¡Gracias!`
        );

        detailsContent.innerHTML = `
          <div style="text-align: center; padding: 20px 10px;">
            <span style="font-size: 42px;">📑</span>
            <h2 style="color: var(--blue); margin: 10px 0;">¡Abono registrado con éxito!</h2>
            <p class="muted">
              Abono: <strong>$${abonoValor} USD</strong>. Saldo pendiente: <strong>$${saldoRestante} USD</strong>.<br>
              Las boletas continúan <strong>apartadas en amarillo</strong> para el comprador.
            </p>
            <div style="margin: 20px 0; display:flex; flex-direction:column; gap:10px;">
              <a href="https://wa.me/${waPhone}?text=${waMsgAbono}" target="_blank" class="button button-blue full-width" style="text-decoration:none;">
                💬 Enviar recibo de abono a ${req.buyer} por WhatsApp
              </a>
              <button type="button" class="button button-outline full-width" onclick="document.querySelector('#details-dialog').close()">
                Cerrar ventana
              </button>
            </div>
          </div>
        `;

        showToast(`Abono de $${abonoValor} USD registrado en #${req.id}.`);
      });

      // ACCIÓN 3: RECHAZAR Y LIBERAR NÚMEROS
      btnReject.addEventListener("click", () => {
        if (!confirm(`¿Deseas rechazar la solicitud #${req.id}? Los números quedarán libres y disponibles para cualquier otro comprador.`)) {
          return;
        }

        const { soldSet, pendingSet, requests: curReqs } = getStoredData();

        req.numbers.forEach(n => {
          pendingSet.delete(n);
          soldSet.delete(n);
        });

        const target = curReqs.find(r => r.id === req.id);
        if (target) target.status = "rejected";

        saveStoredData(soldSet, pendingSet, curReqs);
        renderAll();
        detailsDialog.close();
        showToast(`Solicitud #${req.id} rechazada. Números liberados.`);
      });

    } else {
      // REABRIR SOLICITUD CERRADA
      detailsContent.querySelector("#btn-reopen")?.addEventListener("click", () => {
        const { soldSet, pendingSet, requests: curReqs } = getStoredData();
        const target = curReqs.find(r => r.id === req.id);

        if (target) {
          req.numbers.forEach(n => {
            soldSet.delete(n);
            pendingSet.add(n);
          });
          target.status = "pending";
        }

        saveStoredData(soldSet, pendingSet, curReqs);
        renderAll();
        detailsDialog.close();
        showToast(`Solicitud #${req.id} reabierta a En revisión (Amarillo).`);
      });
    }

    detailsDialog.showModal();
  }

  closeDialogBtn?.addEventListener("click", () => detailsDialog.close());

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
  }

  // Buscador y filtros
  searchInput.addEventListener("input", renderAll);
  statusFilter.addEventListener("change", renderAll);

  // Auto-login si ya inició sesión
  if (sessionStorage.getItem("admin_logged") === "true") {
    showPanel();
  }
});
