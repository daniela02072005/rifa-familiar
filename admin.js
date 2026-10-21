document.addEventListener("DOMContentLoaded", () => {

  // ============================================================
  // RIFA FAMILIAR · PANEL DE ADMINISTRACIÓN CONECTADO A SUPABASE
  // ============================================================

  // ---------- REFERENCIAS DOM ----------
  const loginScreen = document.querySelector("#login-screen");
  const loginForm = document.querySelector("#login-form");
  const emailInput = document.querySelector("#email");
  const passwordInput = document.querySelector("#password");
  const loginError = document.querySelector("#login-error");

  const adminPanel = document.querySelector("#admin-panel");
  const logoutButton = document.querySelector("#logout-button");
  const adminNameEl = document.querySelector("#admin-name");
  const adminEmailLabel = document.querySelector("#admin-email-label");

  const soldCountEl = document.querySelector("#sold-count");
  const pendingCountEl = document.querySelector("#pending-count");
  const partialCountEl = document.querySelector("#partial-count");
  const approvedTotalEl = document.querySelector("#approved-total");
  const debtTotalEl = document.querySelector("#debt-total");
  const requestCounterEl = document.querySelector("#request-counter");

  const searchInput = document.querySelector("#search-input");
  const statusFilter = document.querySelector("#status-filter");
  const requestsTable = document.querySelector("#requests-table");
  const emptyState = document.querySelector("#empty-state");

  const detailsDialog = document.querySelector("#details-dialog");
  const detailsContent = document.querySelector("#details-content");
  const closeDialogBtn = document.querySelector("#close-dialog");
  const toast = document.querySelector("#toast");

  // ---------- UTILIDADES DE TELÉFONO ----------
  function cleanDigits(phoneStr) {
    return (phoneStr || "").replace(/\D/g, "");
  }

  function waLink(phone, message) {
    const digits = cleanDigits(phone);
    const base = `https://wa.me/${digits}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
  }

  function money(n) {
    return `$${Number(n || 0).toLocaleString("en-US")}`;
  }

  function fmtNum(n) {
    return String(n).padStart(3, "0");
  }

  // ---------- ESTADO EN MEMORIA ----------
  let solicitudes = [];   // filas de la tabla solicitudes
  let numerosMap = {};    // numero -> estado
  let abonosPorSolicitud = {}; // solicitud_id -> [abonos]

  // ============================================================
  // 1. ACCESO CON SUPABASE AUTH
  // ============================================================

  function requireSupabase() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      loginError.textContent = "No se pudo cargar la conexión. Revisa supabase-config.js.";
      return false;
    }
    return true;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";

    if (!requireSupabase()) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const submitBtn = loginForm.querySelector("button[type='submit']");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Comprobando acceso...";

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = originalText;

    if (error) {
      loginError.textContent = "Correo o contraseña incorrectos.";
      console.error("Error de acceso:", error.message);
      return;
    }

    passwordInput.value = "";
    await showPanel();
  });

  logoutButton.addEventListener("click", async () => {
    if (typeof supabaseClient !== "undefined" && supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    adminPanel.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    loginForm.reset();
    loginError.textContent = "";
  });

  async function showPanel() {
    loginScreen.classList.add("hidden");
    adminPanel.classList.remove("hidden");

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      const shortName = (user.email || "").split("@")[0];
      if (adminNameEl) adminNameEl.textContent = "ADMINISTRADORA";
      if (adminEmailLabel) adminEmailLabel.textContent = user.email.toUpperCase();
      console.log("Sesión activa:", shortName);
    }

    await loadAll();
    renderAll();
  }

  // ============================================================
  // 2. LECTURA DE DATOS DESDE SUPABASE
  // ============================================================

  async function loadAll() {
    // Solicitudes
    const { data: sols, error: errSol } = await supabaseClient
      .from("solicitudes")
      .select("*")
      .order("creado", { ascending: false });

    if (errSol) {
      console.error("Error al leer solicitudes:", errSol.message);
      showToast("No se pudieron cargar las solicitudes.");
      solicitudes = [];
    } else {
      solicitudes = sols || [];
    }

    // Números
    const { data: nums, error: errNum } = await supabaseClient
      .from("numeros")
      .select("numero,estado");

    if (errNum) {
      console.error("Error al leer números:", errNum.message);
      numerosMap = {};
    } else {
      numerosMap = {};
      (nums || []).forEach(r => { numerosMap[r.numero] = r.estado; });
    }

    // Abonos
    const { data: abs, error: errAb } = await supabaseClient
      .from("abonos")
      .select("solicitud_id,monto,nota,creado");

    if (errAb) {
      console.error("Error al leer abonos:", errAb.message);
      abonosPorSolicitud = {};
    } else {
      abonosPorSolicitud = {};
      (abs || []).forEach(a => {
        if (!abonosPorSolicitud[a.solicitud_id]) abonosPorSolicitud[a.solicitud_id] = [];
        abonosPorSolicitud[a.solicitud_id].push(a);
      });
    }
  }

  // Lee los números de la solicitud desde la columna propia.
  // Si la solicitud es antigua y no tiene columna, intenta leerlos de las notas.
  function numerosDeSolicitud(sol) {
    if (Array.isArray(sol.numeros) && sol.numeros.length) {
      return sol.numeros.map(Number).filter(n => !isNaN(n));
    }

    const match = (sol.notas || "").match(/Números:\s*([0-9,\s]+)/i);
    if (match) {
      return match[1].split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    }
    return [];
  }

  // ============================================================
  // 3. MÉTRICAS Y TABLA
  // ============================================================

  function estadoLegible(estado) {
    if (estado === "pendiente") return "En revisión";
    if (estado === "plazos") return "A plazos";
    if (estado === "pagado") return "Pagado";
    if (estado === "rechazado") return "Rechazada";
    return estado;
  }

  function renderAll() {
    // --- Métricas ---
    const vendidos = Object.values(numerosMap).filter(e => e === "vendido").length;
    const apartados = Object.values(numerosMap).filter(e => e === "apartado").length;

    const pendientes = solicitudes.filter(s => s.estado === "pendiente").length;
    const aPlazos = solicitudes.filter(s => s.estado === "plazos").length;

    if (soldCountEl) soldCountEl.textContent = vendidos.toLocaleString("es-ES");
    if (pendingCountEl) pendingCountEl.textContent = pendientes.toLocaleString("es-ES");
    if (partialCountEl) partialCountEl.textContent = aPlazos.toLocaleString("es-ES");

    // Recaudado real: ventas completas + abonos de solicitudes a plazos
    const recaudado = solicitudes.reduce((sum, s) => {
      if (s.estado === "pagado") return sum + Number(s.total || 0);
      if (s.estado === "plazos") return sum + Number(s.abonado || 0);
      if (s.estado === "pendiente") return sum + Number(s.abonado || 0);
      return sum;
    }, 0);
    if (approvedTotalEl) approvedTotalEl.textContent = money(recaudado);

    // Saldo por cobrar: lo que falta de las solicitudes activas
    const deuda = solicitudes.reduce((sum, s) => {
      if (s.estado === "pendiente" || s.estado === "plazos") {
        return sum + Number(s.saldo || 0);
      }
      return sum;
    }, 0);
    if (debtTotalEl) debtTotalEl.textContent = money(deuda);

    // --- Filtro y búsqueda ---
    const query = searchInput.value.trim().toLowerCase();
    const filter = statusFilter.value;

    const filtered = solicitudes.filter(s => {
      const okFilter = filter === "all" || s.estado === filter;
      if (!okFilter) return false;
      if (!query) return true;

      const nums = numerosDeSolicitud(s).map(fmtNum).join(" ");
      return (
        (s.codigo || "").toLowerCase().includes(query) ||
        (s.comprador || "").toLowerCase().includes(query) ||
        (s.telefono || "").toLowerCase().includes(query) ||
        nums.includes(query)
      );
    });

    if (requestCounterEl) {
      requestCounterEl.textContent = `${filtered.length} ${filtered.length === 1 ? "solicitud" : "solicitudes"}`;
    }

    // --- Dibujar tabla ---
    requestsTable.innerHTML = "";

    if (filtered.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    filtered.forEach(sol => {
      const nums = numerosDeSolicitud(sol);
      const tr = document.createElement("tr");

      const pillClass =
        sol.estado === "pagado" ? "sold-pill" :
        sol.estado === "rechazado" ? "rejected-pill" : "pending-pill";

      tr.innerHTML = `
        <td>
          <strong>${sol.comprador || "—"}</strong><br>
          <small class="muted">${sol.codigo || ""}</small> ·
          <a href="${waLink(sol.telefono_digitos || sol.telefono)}" target="_blank"
             style="color:var(--green); text-decoration:none; font-size:11px;">
            💬 WhatsApp (${sol.telefono || ""})
          </a>
        </td>
        <td>
          <div class="ticket-pills">
            ${nums.length
              ? nums.map(n => `<span class="ticket-pill ${pillClass}">${fmtNum(n)}</span>`).join(" ")
              : '<span class="muted">—</span>'}
          </div>
        </td>
        <td>${nums.length} boletas</td>
        <td>
          <strong>${money(sol.abonado)}</strong> <small class="muted">/ ${money(sol.total)} USD</small>
        </td>
        <td>
          <span style="color:${Number(sol.saldo) > 0 ? "var(--amber)" : "var(--muted)"}; font-weight:600;">
            ${money(sol.saldo)} USD
          </span>
        </td>
        <td><span class="status-badge ${sol.estado}">${estadoLegible(sol.estado)}</span></td>
        <td>
          <button type="button" class="button button-small button-outline" data-id="${sol.id}">
            Gestionar
          </button>
        </td>
      `;

      tr.querySelector("button").addEventListener("click", () => openManageModal(sol.id));
      requestsTable.append(tr);
    });
  }

  // ============================================================
  // 4. MODAL DE GESTIÓN
  // ============================================================

  function openManageModal(solicitudId) {
    const sol = solicitudes.find(s => s.id === solicitudId);
    if (!sol) return;

    const nums = numerosDeSolicitud(sol);
    const numsFmt = nums.map(fmtNum);
    const waPhone = sol.telefono_digitos || cleanDigits(sol.telefono);
    const restante = Number(sol.saldo || 0);
    const abonado = Number(sol.abonado || 0);
    const total = Number(sol.total || 0);

    let statusTitle = "En revisión (Apartado en amarillo)";
    if (sol.estado === "plazos") statusTitle = "Acuerdo a plazos / Abono activo (Amarillo)";
    if (sol.estado === "pagado") statusTitle = "Pagado 100% / Vendido definitivo";
    if (sol.estado === "rechazado") statusTitle = "Solicitud rechazada (Números liberados)";

    const activa = sol.estado === "pendiente" || sol.estado === "plazos";

    detailsContent.innerHTML = `
      <div class="confirm-flow">
        <header class="flow-header">
          <div>
            <p class="eyebrow">SOLICITUD #${sol.codigo || ""}</p>
            <h2 style="font-size:19px; margin:0;">${statusTitle}</h2>
          </div>
          <div class="flow-metrics">
            <div class="metric-card">
              <span class="metric-label">Total boletas</span>
              <strong>${money(total)} USD</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Abonado hasta hoy</span>
              <strong style="color:var(--green);">${money(abonado)} USD</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Saldo pendiente</span>
              <strong style="color:var(--amber);">${money(restante)} USD</strong>
            </div>
          </div>
        </header>

        <section class="step-card">
          <p class="eyebrow">DATOS DEL COMPRADOR</p>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <div>
              <p style="margin:0 0 4px;"><strong>${sol.comprador || "—"}</strong> (${sol.telefono || "—"})</p>
              <p class="muted" style="margin:0;">Método: ${sol.metodo || "—"}</p>
            </div>
            <a href="${waLink(waPhone)}" target="_blank" class="button button-small button-outline" style="color:var(--green);">
              💬 Abrir WhatsApp
            </a>
          </div>

          <div style="margin-top:10px;">
            <span class="muted" style="font-size:11px;">Boletas apartadas (${nums.length}):</span>
            <div class="ticket-pills" style="margin-top:4px;">
              ${numsFmt.length
                ? numsFmt.map(n => `<span class="ticket-pill pending-pill">${n}</span>`).join("")
                : '<span class="muted">Sin números asociados</span>'}
            </div>
          </div>

          ${sol.notas ? `
            <div style="margin-top:10px; background:#111; padding:8px 12px; border-radius:6px; font-size:12px; border:1px solid var(--line);">
              <strong>Historial / acuerdos:</strong><br>
              <span style="color:#ddd;">${sol.notas}</span>
            </div>
          ` : ""}
        </section>

        ${activa ? `
          <section class="step-card">
            <p class="eyebrow">VERIFICACIÓN PREVIA</p>
            <div class="checklist">
              <label>
                <input type="checkbox" id="check-bank-account">
                <span>He verificado el ingreso real (Zelle / banco / efectivo) antes de registrar el movimiento.</span>
              </label>
            </div>
          </section>

          <section class="step-card" style="border-color: rgba(96,165,250,.4);">
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
                  <input type="number" id="installment-paid" min="1" max="${restante}"
                         placeholder="Ej. 30" value="${Math.min(30, restante) || 0}">
                </div>
                <div>
                  <label>Nuevo saldo por cobrar</label>
                  <input type="text" id="calc-remaining" readonly
                         style="color:var(--amber); font-weight:bold;"
                         value="${money(Math.max(0, restante - Math.min(30, restante)))} USD">
                </div>
              </div>
              <div>
                <label for="installment-notes">Acuerdo o fecha límite para el siguiente abono</label>
                <textarea id="installment-notes" rows="2"
                          placeholder="Ej. Abonó $30 hoy por Zelle. Acuerda liquidar el resto el viernes."></textarea>
              </div>

              <button type="button" id="btn-save-installment" class="button full-width" style="margin-top:10px;" disabled>
                💾 Registrar Abono y Enviar Recibo por WhatsApp
              </button>
            </div>
          </section>

          <section class="step-card" style="border-color: rgba(215,181,109,.4);">
            <p class="eyebrow">LIQUIDACIÓN TOTAL (100% PAGADO)</p>
            <h3>${abonado > 0 ? `Liquidar Saldo Restante (${money(restante)} USD)` : `Confirmar Pago Total (${money(total)} USD)`}</h3>
            <p class="muted" style="margin-bottom:12px;">
              Los números pasarán de amarillo a <strong>vendido definitivo</strong> y se generará la confirmación oficial.
            </p>

            <div class="modal-actions">
              <button type="button" id="btn-modal-reject" class="button button-danger">
                Rechazar y liberar números
              </button>
              <button type="button" id="btn-modal-confirm-full" class="button button-gold" disabled>
                ${abonado > 0 ? `Liquidar ${money(restante)} USD y Cerrar Venta` : `Confirmar Pago Total (${money(total)} USD)`}
              </button>
            </div>
          </section>
        ` : `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:10px; flex-wrap:wrap;">
            <span class="muted">Esta solicitud está cerrada como <strong>${sol.estado.toUpperCase()}</strong>.</span>
            <button type="button" id="btn-reopen" class="button button-outline">
              Reabrir a En revisión (Amarillo)
            </button>
          </div>
        `}
      </div>
    `;

    // ---------- INTERACTIVIDAD ----------
    if (activa) {
      const checkBank = detailsContent.querySelector("#check-bank-account");
      const btnConfirmFull = detailsContent.querySelector("#btn-modal-confirm-full");
      const btnReject = detailsContent.querySelector("#btn-modal-reject");
      const btnSaveInstallment = detailsContent.querySelector("#btn-save-installment");
      const inputPaid = detailsContent.querySelector("#installment-paid");
      const calcRemaining = detailsContent.querySelector("#calc-remaining");
      const inputNotes = detailsContent.querySelector("#installment-notes");

      checkBank.addEventListener("change", () => {
        btnConfirmFull.disabled = !checkBank.checked;
        btnSaveInstallment.disabled = !checkBank.checked;
      });

      inputPaid.addEventListener("input", () => {
        const val = parseFloat(inputPaid.value) || 0;
        calcRemaining.value = `${money(Math.max(0, restante - val))} USD`;
      });

      // --- CONFIRMAR PAGO COMPLETO ---
      btnConfirmFull.addEventListener("click", async () => {
        btnConfirmFull.disabled = true;
        btnConfirmFull.textContent = "Registrando venta...";

        // 1. Marcar los números como vendidos
        if (nums.length) {
          const { error: errNum } = await supabaseClient
            .from("numeros")
            .update({ estado: "vendido" })
            .in("numero", nums);

          if (errNum) {
            alert("No se pudieron marcar los números como vendidos: " + errNum.message);
            btnConfirmFull.disabled = false;
            return;
          }
        }

        // 2. Actualizar la solicitud
        const { error: errSol } = await supabaseClient
          .from("solicitudes")
          .update({
            estado: "pagado",
            abonado: total,
            saldo: 0,
            notas: (sol.notas ? sol.notas + " | " : "") + "Liquidado al 100%."
          })
          .eq("id", sol.id);

        if (errSol) {
          alert("No se pudo cerrar la solicitud: " + errSol.message);
          btnConfirmFull.disabled = false;
          return;
        }

        await loadAll();
        renderAll();

        const waMsg =
          `🎉 *¡PAGO CONFIRMADO - RIFA FAMILIAR!* 🎉\n\n` +
          `Hola *${sol.comprador}*, tu pago total de *${money(total)} USD* de la solicitud *#${sol.codigo}* ha sido verificado.\n\n` +
          `🎟 *Tus números oficiales son:* ${numsFmt.join(", ")}\n\n` +
          `¡Ya estás participando formalmente! Muchísima suerte.`;

        detailsContent.innerHTML = `
          <div style="text-align:center; padding:20px 10px;">
            <span style="font-size:42px;">🏆</span>
            <h2 style="color:var(--gold); margin:10px 0;">¡Venta completada!</h2>
            <p class="muted">Los números <strong>${numsFmt.join(", ")}</strong> quedaron bloqueados como vendidos.</p>
            <div style="margin:20px 0; display:flex; flex-direction:column; gap:10px;">
              <a href="${waLink(waPhone, waMsg)}" target="_blank" class="button button-gold full-width" style="text-decoration:none;">
                💬 Enviar confirmación a ${sol.comprador} por WhatsApp
              </a>
              <button type="button" class="button button-outline full-width"
                      onclick="document.querySelector('#details-dialog').close()">
                Cerrar ventana
              </button>
            </div>
          </div>
        `;

        showToast(`Solicitud #${sol.codigo} liquidada al 100%.`);
      });

      // --- REGISTRAR ABONO ---
      btnSaveInstallment.addEventListener("click", async () => {
        const abonoValor = parseFloat(inputPaid.value) || 0;

        if (abonoValor <= 0) { alert("Introduce un monto mayor a $0 USD."); return; }
        if (abonoValor > restante) { alert(`El abono no puede superar el saldo pendiente (${money(restante)} USD).`); return; }

        btnSaveInstallment.disabled = true;
        btnSaveInstallment.textContent = "Registrando abono...";

        const nuevoAbonado = abonado + abonoValor;
        const nuevoSaldo = Math.max(0, total - nuevoAbonado);
        const seCompleta = nuevoSaldo === 0;

        // 1. Registrar el abono en el historial
        const { data: { user } } = await supabaseClient.auth.getUser();
        const { error: errAb } = await supabaseClient
          .from("abonos")
          .insert([{
            solicitud_id: sol.id,
            monto: abonoValor,
            nota: inputNotes.value.trim() || "",
            registrado_por: user ? user.id : null
          }]);

        if (errAb) {
          alert("No se pudo registrar el abono: " + errAb.message);
          btnSaveInstallment.disabled = false;
          return;
        }

        // 2. Actualizar la solicitud
        const notaTexto = inputNotes.value.trim();
        const { error: errSol } = await supabaseClient
          .from("solicitudes")
          .update({
            abonado: nuevoAbonado,
            saldo: nuevoSaldo,
            estado: seCompleta ? "pagado" : "plazos",
            notas: (sol.notas ? sol.notas + " | " : "") +
                   `Abonó ${money(abonoValor)} USD${notaTexto ? ": " + notaTexto : ""}`
          })
          .eq("id", sol.id);

        if (errSol) {
          alert("No se pudo actualizar la solicitud: " + errSol.message);
          btnSaveInstallment.disabled = false;
          return;
        }

        // 3. Si con este abono se completa, los números pasan a vendidos
        if (seCompleta && nums.length) {
          await supabaseClient.from("numeros").update({ estado: "vendido" }).in("numero", nums);
        }

        await loadAll();
        renderAll();

        const waMsgAbono =
          ` *RECIBO DE ABONO - RIFA FIN DE AÑO* \n\n` +
          `Hola *${sol.comprador}*, registramos tu abono de *${money(abonoValor)} USD* de la solicitud *#${sol.codigo}*.\n\n` +
          `- *Boletas apartadas:* ${numsFmt.join(", ")}\n` +
          `- *Total abonado:* ${money(nuevoAbonado)} USD\n` +
          `- *Saldo pendiente:* ${money(nuevoSaldo)} USD\n\n` +
          `${notaTexto ? `= *Acuerdo:* ${notaTexto}\n\n` : ""}` +
          `Tus números siguen apartados y protegidos a tu nombre. ¡Gracias!`;

        detailsContent.innerHTML = `
          <div style="text-align:center; padding:20px 10px;">
            <span style="font-size:42px;">📑</span>
            <h2 style="color:var(--blue); margin:10px 0;">¡Abono registrado!</h2>
            <p class="muted">
              Abono: <strong>${money(abonoValor)} USD</strong>. Saldo pendiente: <strong>${money(nuevoSaldo)} USD</strong>.<br>
              ${seCompleta
                ? "El saldo quedó a cero: las boletas pasaron a <strong>vendido definitivo</strong>."
                : "Las boletas continúan <strong>apartadas en amarillo</strong>."}
            </p>
            <div style="margin:20px 0; display:flex; flex-direction:column; gap:10px;">
              <a href="${waLink(waPhone, waMsgAbono)}" target="_blank" class="button button-gold full-width" style="text-decoration:none;">
                💬 Enviar recibo a ${sol.comprador} por WhatsApp
              </a>
              <button type="button" class="button button-outline full-width"
                      onclick="document.querySelector('#details-dialog').close()">
                Cerrar ventana
              </button>
            </div>
          </div>
        `;

        showToast(`Abono de ${money(abonoValor)} registrado en #${sol.codigo}.`);
      });

      // --- RECHAZAR Y LIBERAR ---
      btnReject.addEventListener("click", async () => {
        if (!confirm(`¿Rechazar la solicitud #${sol.codigo}? Los números quedarán libres.`)) return;

        if (nums.length) {
          await supabaseClient.from("numeros").update({ estado: "disponible" }).in("numero", nums);
        }

        await supabaseClient
          .from("solicitudes")
          .update({ estado: "rechazado" })
          .eq("id", sol.id);

        await loadAll();
        renderAll();
        detailsDialog.close();
        showToast(`Solicitud #${sol.codigo} rechazada. Números liberados.`);
      });

    } else {
      // --- REABRIR SOLICITUD CERRADA ---
      detailsContent.querySelector("#btn-reopen")?.addEventListener("click", async () => {
        if (nums.length) {
          await supabaseClient.from("numeros").update({ estado: "apartado" }).in("numero", nums);
        }

        await supabaseClient
          .from("solicitudes")
          .update({ estado: "pendiente", abonado: 0, saldo: total })
          .eq("id", sol.id);

        await loadAll();
        renderAll();
        detailsDialog.close();
        showToast(`Solicitud #${sol.codigo} reabierta.`);
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

  // ---------- BUSCADOR Y FILTROS ----------
  searchInput.addEventListener("input", renderAll);
  statusFilter.addEventListener("change", renderAll);

  // ---------- ACTUALIZACIÓN AUTOMÁTICA ----------
  let refreshTimer = null;
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(async () => {
      if (adminPanel.classList.contains("hidden")) return;
      if (detailsDialog.open) return; // no refrescar mientras hay un modal abierto
      await loadAll();
      renderAll();
    }, 15000);
  }

  // ---------- ARRANQUE ----------
  (async () => {
    if (!requireSupabase()) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      await showPanel();
    }
    startAutoRefresh();
  })();
});
