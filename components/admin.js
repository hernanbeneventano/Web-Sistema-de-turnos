/**
 * SALUD GOYA - Vistas y Componentes de Administración (components/admin.js)
 * Registra vistas de Dashboard Estadístico, Gestión de Médicos, Especialidades, Turnos y Notificaciones.
 */

window.addEventListener("DOMContentLoaded", () => {
    
    // 1. DASHBOARD ESTADÍSTICO DE ADMINISTRACIÓN
    app.registerView("dashboard_admin", async (container) => {
        const appointments = await window.db.getAppointments();
        const patients = await window.db.getPatients();
        const doctors = await window.db.getDoctors();
        const config = await window.db.getSystemConfig();

        const totalApp = appointments.length;
        const attendedApp = appointments.filter(a => a.status === "Atendido").length;
        const cancelledApp = appointments.filter(a => a.status === "Cancelado").length;
        const absentApp = appointments.filter(a => a.status === "Ausente").length;
        const suspendedPatients = patients.filter(p => p.status === "Suspendido").length;

        // Calcular Ganancias Totales
        const totalEarnings = appointments
            .filter(a => a.paid)
            .reduce((sum, a) => sum + (a.price || 0), 0);

        let html = `
            <div class="stats-grid animate__animated animate__fadeIn">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fa-solid fa-calendar-check"></i></div>
                    <div class="stat-content">
                        <span class="stat-value">${totalApp}</span>
                        <span class="stat-label">Turnos Totales</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fa-solid fa-hand-holding-dollar"></i></div>
                    <div class="stat-content">
                        <span class="stat-value">$${totalEarnings}</span>
                        <span class="stat-label">Caja Cobrada (Copagos)</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red"><i class="fa-solid fa-user-xmark"></i></div>
                    <div class="stat-content">
                        <span class="stat-value">${absentApp}</span>
                        <span class="stat-label">Ausencias Totales</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple"><i class="fa-solid fa-user-slash"></i></div>
                    <div class="stat-content">
                        <span class="stat-value">${suspendedPatients}</span>
                        <span class="stat-label">Pacientes Suspendidos</span>
                    </div>
                </div>
            </div>

            <div class="admin-grid two-cols-dashboard animate__animated animate__fadeIn">
                <!-- Gráfico de Especialidades y Rendimiento (Barritas de CSS) -->
                <div class="card">
                    <div class="card-title">Rendimiento de Especialidades</div>
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        ${await renderSpecialtyRanks(appointments)}
                    </div>
                </div>

                <!-- Control Rápido de Caja y Copagos -->
                <div class="card">
                    <div class="card-title">Copagos Pendientes de Cobro</div>
                    <div style="margin-bottom:12px;">
                        <canvas id="admin-pie-chart" style="width:100%; height:200px;"></canvas>
                    </div>
                    <div class="table-responsive">
                        <table class="table-custom" id="table-pending-copays">
                            <thead>
                                <th>Paciente</th>
                                <th>Médico</th>
                                <th>Costo</th>
                                <th>Acción</th>
                            </thead>
                            <tbody>
                                <!-- Dinámico -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Cargar copagos pendientes
        const tbody = container.querySelector("#table-pending-copays tbody");
        const pendingPayments = appointments.filter(a => !a.paid && ["Confirmado", "Atendido"].includes(a.status));

        if (pendingPayments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No hay cobros de copago pendientes.</td></tr>`;
        } else {
            // Mostrar últimos 5 pendientes
            pendingPayments.slice(0, 5).forEach(appo => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${appo.patientName}</strong></td>
                    <td>${appo.doctorName}</td>
                    <td>$${appo.price}</td>
                    <td>
                        <button class="btn btn-success btn-sm btn-confirm-copay" data-id="${appo.id}">
                            <i class="fa-solid fa-dollar-sign"></i> Cobrar
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Registrar evento de cobro
            tbody.querySelectorAll(".btn-confirm-copay").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const appId = btn.getAttribute("data-id");
                    try {
                        await window.db.updateAppointmentStatus(appId, null, { paid: true });
                        app.showToast("Pago registrado en caja exitosamente.", "success");
                        // Recargar vista
                        app.navigateTo("dashboard_admin");
                    } catch (err) {
                        app.showToast(err.message, "error");
                    }
                });
            });
        }

        // Inicializar gráfico de torta (Pagos vs Pendientes)
        try {
            const paidCount = appointments.filter(a => a.paid).length;
            const unpaidCount = appointments.filter(a => !a.paid).length;
            const ctxEl = container.querySelector('#admin-pie-chart');
            if (ctxEl) {
                // destruir instancia previa si existe
                if (window.adminPieChart && typeof window.adminPieChart.destroy === 'function') {
                    window.adminPieChart.destroy();
                }
                const ctx = ctxEl.getContext('2d');
                window.adminPieChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Pagos', 'Pendientes'],
                        datasets: [{
                            data: [paidCount, unpaidCount],
                            backgroundColor: ['#4caf50', '#ff9800'],
                            hoverOffset: 6
                        }]
                    },
                    options: {
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: { enabled: true }
                        },
                        maintainAspectRatio: false,
                        responsive: true
                    }
                });
            }
        } catch (err) {
            console.warn('No se pudo inicializar el gráfico de administración:', err);
        }
    });

    // 2. GESTIÓN DE MÉDICOS
    app.registerView("medicos", async (container) => {
        const doctors = await window.db.getDoctors();
        const specialties = await window.db.getSpecialties();

        let html = `
            <div class="admin-grid two-cols-main-sidebar animate__animated animate__fadeIn">
                <!-- Listado de Médicos -->
                <div class="card">
                    <div class="card-title">Listado de Profesionales</div>
                    <div class="table-responsive">
                        <table class="table-custom" id="table-admin-doctors">
                            <thead>
                                <tr>
                                    <th>Médico</th>
                                    <th>Especialidad</th>
                                    <th>Horarios</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Dinámico -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Formulario Agregar/Editar -->
                <div class="card">
                    <div class="card-title" id="form-doc-title">Registrar Nuevo Médico</div>
                    <form id="form-admin-doctor">
                        <input type="hidden" id="edit-doc-id">
                        
                        <div class="form-group">
                            <label for="doc-name">Nombre Completo</label>
                            <input type="text" id="doc-name" required placeholder="Ej: Dr. Juan Pérez">
                        </div>

                        <div class="form-group">
                            <label for="doc-specialty">Especialidad</label>
                            <select id="doc-specialty" required>
                                <option value="">Seleccione Especialidad</option>
                                ${specialties.map(s => `<option value="${s}">${s}</option>`).join("")}
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="doc-matricula">Matrícula Profesional</label>
                            <input type="text" id="doc-matricula" required placeholder="Ej: MN-48912">
                        </div>

                        <div class="form-group">
                            <label for="doc-email">Correo Electrónico</label>
                            <input type="email" id="doc-email" required placeholder="medico@saludgoya.com">
                        </div>

                        <div class="form-group">
                            <label for="doc-phone">Teléfono / WhatsApp</label>
                            <input type="tel" id="doc-phone" required placeholder="Ej: +543777112233">
                        </div>

                        <div class="form-group">
                            <label>Días de Atención</label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <label style="font-weight:normal;"><input type="checkbox" name="admin-workday" value="1" checked style="width:auto;"> Lunes</label>
                                <label style="font-weight:normal;"><input type="checkbox" name="admin-workday" value="2" checked style="width:auto;"> Martes</label>
                                <label style="font-weight:normal;"><input type="checkbox" name="admin-workday" value="3" checked style="width:auto;"> Miércoles</label>
                                <label style="font-weight:normal;"><input type="checkbox" name="admin-workday" value="4" checked style="width:auto;"> Jueves</label>
                                <label style="font-weight:normal;"><input type="checkbox" name="admin-workday" value="5" checked style="width:auto;"> Viernes</label>
                                <label style="font-weight:normal;"><input type="checkbox" name="admin-workday" value="6" style="width:auto;"> Sábado</label>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="doc-start">Hora Inicio</label>
                                <input type="time" id="doc-start" value="08:00" required>
                            </div>
                            <div class="form-group">
                                <label for="doc-end">Hora Fin</label>
                                <input type="time" id="doc-end" value="12:00" required>
                            </div>
                        </div>

                        <div class="modal-actions" style="margin-top: 20px;">
                            <button type="button" class="btn btn-secondary" id="btn-cancel-doc-edit" style="display:none;">Cancelar</button>
                            <button type="submit" class="btn btn-primary" id="btn-submit-doc">Registrar Médico</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Rellenar tabla
        const tbody = container.querySelector("#table-admin-doctors tbody");
        doctors.forEach(doc => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <strong>${doc.name}</strong><br>
                    <small class="text-secondary">Mat. ${doc.matricula}</small>
                </td>
                <td>${doc.specialty}</td>
                <td><small>${getScheduleSummary(doc)}</small></td>
                <td style="display: flex; gap: 6px;">
                    <button class="btn btn-outline-primary btn-sm btn-edit-doc" data-id="${doc.id}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-danger btn-sm btn-delete-doc" data-id="${doc.id}"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Lógica de Alta/Edición
        const form = container.querySelector("#form-admin-doctor");
        const cancelEditBtn = container.querySelector("#btn-cancel-doc-edit");
        const submitBtn = container.querySelector("#btn-submit-doc");
        const titleEl = container.querySelector("#form-doc-title");

        const resetForm = () => {
            form.reset();
            container.querySelector("#edit-doc-id").value = "";
            titleEl.textContent = "Registrar Nuevo Médico";
            submitBtn.textContent = "Registrar Médico";
            cancelEditBtn.style.display = "none";
        };

        // Eventos Editar
        tbody.querySelectorAll(".btn-edit-doc").forEach(btn => {
            btn.addEventListener("click", () => {
                const docId = btn.getAttribute("data-id");
                const doc = doctors.find(d => d.id === docId);
                if (doc) {
                    titleEl.textContent = "Editar Profesional";
                    submitBtn.textContent = "Guardar Cambios";
                    cancelEditBtn.style.display = "inline-flex";

                    container.querySelector("#edit-doc-id").value = doc.id;
                    container.querySelector("#doc-name").value = doc.name;
                    container.querySelector("#doc-specialty").value = doc.specialty;
                    container.querySelector("#doc-matricula").value = doc.matricula;
                    container.querySelector("#doc-email").value = doc.email;
                    container.querySelector("#doc-phone").value = doc.phone || "";
                    container.querySelector("#doc-start").value = doc.workHours.start;
                    container.querySelector("#doc-end").value = doc.workHours.end;

                    // Checkboxes de días
                    form.querySelectorAll("input[name='admin-workday']").forEach(cb => {
                        cb.checked = doc.workDays.includes(parseInt(cb.value));
                    });
                }
            });
        });

        cancelEditBtn.addEventListener("click", resetForm);

        // Evento Enviar Formulario (Registrar / Guardar)
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = container.querySelector("#edit-doc-id").value;
            const name = container.querySelector("#doc-name").value.trim();
            const specialty = container.querySelector("#doc-specialty").value;
            const matricula = container.querySelector("#doc-matricula").value.trim();
            const email = container.querySelector("#doc-email").value.trim();
            const phone = container.querySelector("#doc-phone").value.trim();
            const start = container.querySelector("#doc-start").value;
            const end = container.querySelector("#doc-end").value;

            const daysChecked = form.querySelectorAll("input[name='admin-workday']:checked");
            const workDays = Array.from(daysChecked).map(cb => parseInt(cb.value));

            if (workDays.length === 0) {
                app.showToast("Seleccione al menos un día de atención.", "error");
                return;
            }

            try {
                if (window.firebaseEnabled && window.firestore && !id) {
                    // Crear invitación en Firestore para que el médico complete su registro
                    const token = Math.random().toString(36).substring(2, 10);
                    const invite = {
                        token,
                        email,
                        name,
                        specialty,
                        matricula,
                        phone,
                        workDays,
                        workHours: { start, end },
                        role: 'doctor',
                        used: false,
                        createdBy: app.currentUser ? app.currentUser.id : null,
                        createdAt: window.firebaseEnabled && window.firestore ? window.firestore.FieldValue ? window.firestore.FieldValue.serverTimestamp() : null : null
                    };

                    // Guardar invitación con ID = token
                    await window.firestore.collection('invitations').doc(token).set(invite);

                    const inviteLink = `${window.location.origin}${window.location.pathname}?invite=${token}`;
                    try {
                        await navigator.clipboard.writeText(inviteLink);
                        app.showToast('Invitación creada. Enlace copiado al portapapeles.', 'success');
                    } catch (err) {
                        app.showToast('Invitación creada. Copie manualmente el enlace mostrado.', 'info');
                        // Mostrar enlace en prompt como fallback
                        window.prompt('Enlace de invitación (copiar):', inviteLink);
                    }

                    resetForm();
                    app.navigateTo('medicos');
                } else {
                    // Editar o modo local: guarda directamente el registro del médico
                    await window.db.saveDoctor({
                        id: id || undefined,
                        name, specialty, matricula, email, phone,
                        workDays,
                        workHours: { start, end }
                    });

                    app.showToast(id ? 'Médico modificado exitosamente.' : 'Médico registrado exitosamente.', 'success');
                    resetForm();
                    app.navigateTo('medicos');
                }
            } catch (err) {
                app.showToast(err.message, "error");
            }
        });

        // Evento Eliminar Médico
        tbody.querySelectorAll(".btn-delete-doc").forEach(btn => {
            btn.addEventListener("click", async () => {
                const docId = btn.getAttribute("data-id");
                if (confirm("¿Está seguro de desvincular a este profesional del centro médico? Se conservará su registro histórico.")) {
                    try {
                        await window.db.deleteDoctor(docId);
                        app.showToast("Médico desvinculado correctamente.", "success");
                        app.navigateTo("medicos");
                    } catch (err) {
                        app.showToast(err.message, "error");
                    }
                }
            });
        });
    });

    // 3. GESTIÓN DE ESPECIALIDADES
    app.registerView("especialidades", async (container) => {
        const specialties = await window.db.getSpecialties();

        let html = `
            <div class="admin-grid two-cols-sidebar-main animate__animated animate__fadeIn">
                <!-- Listado de especialidades -->
                <div class="card">
                    <div class="card-title">Especialidades Médicas Ofrecidas</div>
                    <div style="margin-bottom:12px; display:flex; gap:8px; align-items:center;">
                        <input id="admin-spec-search" placeholder="Buscar especialidad..." style="flex:1; padding:8px; border-radius:6px; border:1px solid var(--border-color);">
                    </div>
                    <div class="table-responsive">
                        <table class="table-custom" id="table-admin-specialties">
                            <thead>
                                <tr>
                                    <th>Especialidad</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Dinámico -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Formulario Agregar Especialidad -->
                <div class="card">
                    <div class="card-title">Agregar Nueva Especialidad</div>
                    <form id="form-admin-specialty">
                        <div class="form-group">
                            <label for="spec-new-name">Nombre de la Especialidad</label>
                            <input type="text" id="spec-new-name" required placeholder="Ej: Neumonología / Nutrición">
                        </div>
                        <button type="submit" class="btn btn-primary btn-block"><i class="fa-solid fa-plus"></i> Dar de Alta</button>
                    </form>
                </div>
            </div>
        `;

        container.innerHTML = html;

        const tbody = container.querySelector("#table-admin-specialties tbody");
        specialties.forEach(spec => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${spec}</strong></td>
                <td>
                    <button class="btn btn-danger btn-sm btn-delete-spec" data-value="${spec}"><i class="fa-solid fa-trash-can"></i> Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Buscador rápido para especialidades
        const specSearch = container.querySelector('#admin-spec-search');
        if (specSearch) {
            specSearch.addEventListener('input', (e) => {
                const q = e.target.value.trim().toLowerCase();
                tbody.querySelectorAll('tr').forEach(row => {
                    const txt = row.textContent.toLowerCase();
                    row.style.display = txt.includes(q) ? '' : 'none';
                });
            });
        }

        // Registrar Evento Agregar
        container.querySelector("#form-admin-specialty").addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = container.querySelector("#spec-new-name").value.trim();
            if (!name) return;

            try {
                await window.db.addSpecialty(name);
                app.showToast("Especialidad dada de alta.", "success");
                app.navigateTo("especialidades");
            } catch (err) {
                app.showToast(err.message, "error");
            }
        });

        // Registrar Evento Eliminar
        tbody.querySelectorAll(".btn-delete-spec").forEach(btn => {
            btn.addEventListener("click", async () => {
                const specName = btn.getAttribute("data-value");
                if (confirm(`¿Está seguro de eliminar la especialidad "${specName}"? Esto no afectará a los médicos ya registrados, pero no se podrá seleccionar para nuevos.`)) {
                    try {
                        await window.db.deleteSpecialty(specName);
                        app.showToast("Especialidad eliminada.", "success");
                        app.navigateTo("especialidades");
                    } catch (err) {
                        app.showToast(err.message, "error");
                    }
                }
            });
        });
    });

    // 4. SUPERVISIÓN COMPLETA DE TURNOS
    app.registerView("turnos", async (container) => {
        const appointments = await window.db.getAppointments();
        const specialties = await window.db.getSpecialties();
        const doctors = await window.db.getDoctors();

        let html = `
            <div class="card animate__animated animate__fadeIn">
                <div class="card-title">Consola de Control de Turnos</div>
                
                <!-- Filtros Avanzados -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="filter-app-specialty">Filtrar por Especialidad</label>
                        <select id="filter-app-specialty">
                            <option value="all">Todas las Especialidades</option>
                            ${specialties.map(s => `<option value="${s}">${s}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="filter-app-doctor">Filtrar por Médico</label>
                        <select id="filter-app-doctor">
                            <option value="all">Todos los Médicos</option>
                            ${doctors.map(d => `<option value="${d.id}">${d.name}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label for="filter-app-status">Filtrar por Estado</label>
                        <select id="filter-app-status">
                            <option value="all">Todos los Estados</option>
                            <option value="Solicitado">Solicitado</option>
                            <option value="Confirmado">Confirmado</option>
                            <option value="Atendido">Atendido</option>
                            <option value="Cancelado">Cancelado</option>
                            <option value="Ausente">Ausente</option>
                        </select>
                    </div>
                </div>

                <!-- Tabla de Turnos General -->
                <div class="table-responsive">
                    <table class="table-custom" id="table-admin-appointments">
                        <thead>
                            <tr>
                                <th>Fecha y Hora</th>
                                <th>Paciente</th>
                                <th>Médico / Especialidad</th>
                                <th>Copago</th>
                                <th>Estado</th>
                                <th>Acciones Administrativas</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Dinámico -->
                        </tbody>
                    </table>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; gap:12px;">
                    <div>
                        <label for="per-page-select">Mostrar por página:</label>
                        <select id="per-page-select">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="25">25</option>
                        </select>
                    </div>
                    <div id="appointments-pagination" style="display:flex; gap:8px; align-items:center;"></div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        const tbody = container.querySelector("#table-admin-appointments tbody");

        let currentPage = 1;
        const renderFilteredAppointments = () => {
            tbody.innerHTML = "";
            const specVal = container.querySelector("#filter-app-specialty").value;
            const docVal = container.querySelector("#filter-app-doctor").value;
            const statusVal = container.querySelector("#filter-app-status").value;
            const perPage = parseInt(container.querySelector('#per-page-select').value, 10) || 10;

            let filtered = [...appointments];

            if (specVal !== "all") {
                filtered = filtered.filter(a => a.specialty === specVal);
            }
            if (docVal !== "all") {
                filtered = filtered.filter(a => a.doctorId === docVal);
            }
            if (statusVal !== "all") {
                filtered = filtered.filter(a => a.status === statusVal);
            }

            // Ordenar por fecha y hora descendente (más recientes primero)
            filtered.sort((a, b) => new Date(b.date + "T" + b.time) - new Date(a.date + "T" + a.time));

            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
            if (currentPage > totalPages) currentPage = totalPages;

            const startIdx = (currentPage - 1) * perPage;
            const endIdx = startIdx + perPage;
            const pageItems = filtered.slice(startIdx, endIdx);

            if (pageItems.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No se encontraron turnos con los filtros seleccionados.</td></tr>`;
                return;
            }
            pageItems.forEach(appo => {
                const tr = document.createElement("tr");
                const formattedDate = new Date(appo.date + "T00:00:00").toLocaleDateString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                });

                const safeStatus = appo.status || "Solicitado";
                const statusBadge = `<span class="badge-status ${safeStatus.toLowerCase()}"><i class="fa-solid fa-circle"></i> ${safeStatus}</span>`;
                const paymentBadge = appo.paid 
                    ? `<span class="badge-payment pago"><i class="fa-solid fa-check"></i> Pago</span>` 
                    : `<span class="badge-payment pendiente"><i class="fa-solid fa-clock"></i> Pendiente</span>`;

                const canConfirm = safeStatus === "Solicitado";
                const canCancel = ["Solicitado", "Confirmado"].includes(safeStatus);
                const canTogglePayment = ["Confirmado", "Atendido"].includes(safeStatus);

                tr.innerHTML = `
                    <td>
                        <strong>${formattedDate}</strong><br>
                        <small class="text-secondary"><i class="fa-regular fa-clock"></i> ${appo.time} hs</small>
                    </td>
                    <td><strong>${appo.patientName}</strong></td>
                    <td>
                        ${appo.doctorName}<br>
                        <small class="text-secondary">${appo.specialty}</small>
                    </td>
                    <td>
                        $${appo.price} / ${paymentBadge}<br>
                        <small class="text-secondary">${appo.paymentMethod ? appo.paymentMethod : '-'}</small>
                    </td>
                    <td>${statusBadge}</td>
                    <td style="display: flex; gap: 6px; flex-wrap: wrap;">
                        ${canConfirm ? `<button class="btn btn-info btn-sm btn-adm-confirm" data-id="${appo.id}"><i class="fa-solid fa-calendar-check"></i> Confirmar</button>` : ""}
                        ${canTogglePayment && !appo.paid ? `<button class="btn btn-success btn-sm btn-adm-pay" data-id="${appo.id}"><i class="fa-solid fa-dollar-sign"></i> Cobrar</button>` : ""}
                        ${canCancel ? `<button class="btn btn-danger btn-sm btn-adm-cancel" data-id="${appo.id}"><i class="fa-solid fa-ban"></i> Cancelar</button>` : ""}
                        ${!canConfirm && !canCancel && (!canTogglePayment || appo.paid) ? `<span class="text-muted">Sin acciones</span>` : ""}
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Registrar eventos de acciones
            tbody.querySelectorAll(".btn-adm-confirm").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.getAttribute("data-id");
                    try {
                        await window.db.updateAppointmentStatus(id, "Confirmado");
                        app.showToast("Turno confirmado. Se notificó al paciente por correo.", "success");
                        await app.updateNotificationBell();
                        app.navigateTo("turnos");
                    } catch (err) {
                        app.showToast(err.message, "error");
                    }
                });
            });

            tbody.querySelectorAll(".btn-adm-pay").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.getAttribute("data-id");
                    try {
                        await window.db.updateAppointmentStatus(id, null, { paid: true });
                        app.showToast("Copago cobrado correctamente.", "success");
                        app.navigateTo("turnos");
                    } catch (err) {
                        app.showToast(err.message, "error");
                    }
                });
            });

            tbody.querySelectorAll(".btn-adm-cancel").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.getAttribute("data-id");
                    if (confirm("¿Está seguro de cancelar este turno administrativo?")) {
                        try {
                            await window.db.updateAppointmentStatus(id, "Cancelado");
                            app.showToast("Turno cancelado.", "warning");
                            await app.updateNotificationBell();
                            app.navigateTo("turnos");
                        } catch (err) {
                            app.showToast(err.message, "error");
                        }
                    }
                });
            });
        };

        // Pagination controls render
        const renderPaginationControls = () => {
            const perPage = parseInt(container.querySelector('#per-page-select').value, 10) || 10;
            const specVal = container.querySelector("#filter-app-specialty").value;
            const docVal = container.querySelector("#filter-app-doctor").value;
            const statusVal = container.querySelector("#filter-app-status").value;

            let filtered = [...appointments];
            if (specVal !== "all") filtered = filtered.filter(a => a.specialty === specVal);
            if (docVal !== "all") filtered = filtered.filter(a => a.doctorId === docVal);
            if (statusVal !== "all") filtered = filtered.filter(a => a.status === statusVal);

            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

            const pager = container.querySelector('#appointments-pagination');
            pager.innerHTML = '';

            const prev = document.createElement('button');
            prev.className = 'btn btn-secondary btn-sm';
            prev.textContent = 'Anterior';
            prev.disabled = currentPage <= 1;
            prev.addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); renderFilteredAppointments(); renderPaginationControls(); });
            pager.appendChild(prev);

            const info = document.createElement('span');
            info.style.margin = '0 8px';
            info.textContent = `Página ${currentPage} / ${totalPages}`;
            pager.appendChild(info);

            const next = document.createElement('button');
            next.className = 'btn btn-secondary btn-sm';
            next.textContent = 'Siguiente';
            next.disabled = currentPage >= totalPages;
            next.addEventListener('click', () => { currentPage = Math.min(totalPages, currentPage + 1); renderFilteredAppointments(); renderPaginationControls(); });
            pager.appendChild(next);
        };

        // Hook per-page select
        container.querySelector('#per-page-select').addEventListener('change', () => { currentPage = 1; renderFilteredAppointments(); renderPaginationControls(); });

        // Vincular filtros
        container.querySelector("#filter-app-specialty").addEventListener("change", renderFilteredAppointments);
        container.querySelector("#filter-app-doctor").addEventListener("change", renderFilteredAppointments);
        container.querySelector("#filter-app-status").addEventListener("change", renderFilteredAppointments);

        // Carga inicial
        renderFilteredAppointments();
        renderPaginationControls();
    });

    // 5. ALERTAS, SANCIONES Y RECORDATORIOS (WHATSAPP/CORREO)
    app.registerView("notificaciones", async (container) => {
        const patients = await window.db.getPatients();
        const appointments = await window.db.getAppointments();

        // Filtrar pacientes suspendidos
        const suspendedList = patients.filter(p => p.status === "Suspendido");

        // Calcular turnos en las próximas 24 horas (Simulador de recordatorio)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];
        
        // Turnos para mañana
        const upcomingAppointments = appointments.filter(a => a.date === tomorrowStr && ["Solicitado", "Confirmado"].includes(a.status));

        let html = `
            <div style="display: flex; flex-direction: column; gap: 24px;" class="animate__animated animate__fadeIn">
                
                <!-- Panel 1: Sanciones por Inasistencias -->
                <div class="card">
                    <div class="card-title">
                        <span>Control de Pacientes Suspendidos</span>
                        <span class="badge-status ausente">${suspendedList.length} Activas</span>
                    </div>
                    <p class="text-secondary mb-4" style="font-size:13px;">Pacientes con penalización de 30 días tras acumular 3 inasistencias en turnos confirmados.</p>
                    <div class="table-responsive">
                        <table class="table-custom" id="table-admin-suspensions">
                            <thead>
                                <tr>
                                    <th>Paciente</th>
                                    <th>Inasistencias</th>
                                    <th>Fin de Suspensión</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Dinámico -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Panel 2: Recordatorios de 24 Horas (Agenda Mañana: ${tomorrowStr}) -->
                <div class="card">
                    <div class="card-title">
                        <span>Recordatorios Pendientes (Próximas 24hs)</span>
                        <span class="badge-status solicitado">${upcomingAppointments.length} Turnos</span>
                    </div>
                    <p class="text-secondary mb-4" style="font-size:13px;">Turnos programados para mañana. Envía notificaciones directas por WhatsApp o Correo.</p>
                    <div class="table-responsive">
                        <table class="table-custom" id="table-admin-reminders">
                            <thead>
                                <tr>
                                    <th>Paciente / Hora</th>
                                    <th>Médico</th>
                                    <th>Enviar Recordatorio</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Dinámico -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Renderizado Suspenciones
        const tbodySusp = container.querySelector("#table-admin-suspensions tbody");
        if (suspendedList.length === 0) {
            tbodySusp.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No hay pacientes suspendidos en este momento.</td></tr>`;
        } else {
            suspendedList.forEach(p => {
                const tr = document.createElement("tr");
                const formattedEnd = new Date(p.suspensionEnd).toLocaleDateString('es-AR');
                tr.innerHTML = `
                    <td>
                        <strong>${p.name}</strong><br>
                        <small class="text-secondary">DNI: ${p.dni}</small>
                    </td>
                    <td><strong class="text-danger">${p.absences} inasistencias</strong></td>
                    <td>${formattedEnd}</td>
                    <td>
                        <button class="btn btn-success btn-sm btn-lift-suspension" data-id="${p.id}">
                            <i class="fa-solid fa-user-check"></i> Levantar Sanción
                        </button>
                    </td>
                `;
                tbodySusp.appendChild(tr);
            });

            // Evento levantar sanción
            tbodySusp.querySelectorAll(".btn-lift-suspension").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const patId = btn.getAttribute("data-id");
                    const pat = patients.find(p => p.id === patId);
                    if (pat && confirm(`¿Desea levantar la suspensión al paciente ${pat.name} y reestablecer su contador de inasistencias a 0?`)) {
                        try {
                            pat.status = "Activo";
                            pat.absences = 0;
                            pat.suspensionEnd = null;
                            pat.suspensionReason = null;
                            await window.db.updatePatient(pat);

                            // Registrar notificación
                            await window.db.createNotification({
                                type: "Correo",
                                recipient: pat.email,
                                message: `Su suspensión ha sido LEVANTADA manualmente por la administración de Salud Goya. Ya puede solicitar turnos normalmente.`
                            });

                            app.showToast(`Sanción levantada para ${pat.name}.`, "success");
                            await app.updateNotificationBell();
                            app.navigateTo("notificaciones");
                        } catch (err) {
                            app.showToast(err.message, "error");
                        }
                    }
                });
            });
        }

        // Renderizado Recordatorios
        const tbodyRem = container.querySelector("#table-admin-reminders tbody");
        if (upcomingAppointments.length === 0) {
            tbodyRem.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No hay turnos agendados para mañana (${tomorrowStr}).</td></tr>`;
        } else {
            upcomingAppointments.forEach(appo => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>
                        <strong>${appo.patientName}</strong><br>
                        <small class="text-secondary"><i class="fa-regular fa-clock"></i> ${appo.time} hs</small>
                    </td>
                    <td>${appo.doctorName}</td>
                    <td style="display: flex; gap: 6px;">
                        <button class="btn btn-success btn-sm btn-send-wa" data-id="${appo.id}">
                            <i class="fa-brands fa-whatsapp"></i> WhatsApp
                        </button>
                        <button class="btn btn-primary btn-sm btn-send-email" data-id="${appo.id}">
                            <i class="fa-regular fa-envelope"></i> Correo
                        </button>
                    </td>
                `;
                tbodyRem.appendChild(tr);
            });

            // Evento WhatsApp
            tbodyRem.querySelectorAll(".btn-send-wa").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.getAttribute("data-id");
                    const appo = upcomingAppointments.find(a => a.id === id);
                    if (appo) {
                        const pat = await window.db.getPatientById(appo.patientId);
                        const phone = pat ? pat.phone.replace(/[^0-9+]/g, "") : "";
                        
                        // Mensaje pre-redactado profesional
                        const messageText = `Hola ${appo.patientName}, le recordamos que tiene un turno reservado en el centro médico SALUD GOYA con el profesional ${appo.doctorName} (${appo.specialty}) para mañana el día ${appo.date} a las ${appo.time} hs. Por favor confirme su asistencia respondiendo a este mensaje. Muchas gracias.`;
                        
                        const encodedText = encodeURIComponent(messageText);
                        const whatsappUrl = `https://wa.me/${phone}?text=${encodedText}`;

                        // Registrar notificación de WhatsApp en la DB
                        await window.db.createNotification({
                            type: "WhatsApp",
                            recipient: pat ? pat.phone : "Paciente",
                            message: `Recordatorio enviado por WhatsApp: "${messageText.substring(0, 50)}..."`
                        });

                        app.showToast("Mensaje de WhatsApp preparado. Abriendo pestaña...", "success");
                        await app.updateNotificationBell();
                        
                        // Abrir enlace real en otra pestaña
                        window.open(whatsappUrl, '_blank');
                    }
                });
            });

            // Evento Correo
            tbodyRem.querySelectorAll(".btn-send-email").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.getAttribute("data-id");
                    const appo = upcomingAppointments.find(a => a.id === id);
                    if (appo) {
                        const pat = await window.db.getPatientById(appo.patientId);
                        const recipient = pat ? pat.email : "correo@email.com";
                        
                        const messageText = `Estimado/a ${appo.patientName}, le recordamos que tiene un turno médico programado con el profesional ${appo.doctorName} (${appo.specialty}) para mañana el día ${appo.date} a las ${appo.time} hs. Si no puede asistir, recuerde ingresar a su portal para cancelarlo y evitar inasistencias. Centro Médico SALUD GOYA.`;

                        await window.db.createNotification({
                            type: "Correo",
                            recipient: recipient,
                            message: messageText
                        });

                        app.showToast(`Recordatorio de correo enviado exitosamente a ${recipient}.`, "success");
                        await app.updateNotificationBell();
                    }
                });
            });
        }
    });
});

// Helper de Renderizado de Barritas de Especialidades en CSS
async function renderSpecialtyRanks(appointments) {
    const specialties = await window.db.getSpecialties();
    
    // Contar citas por especialidad
    const counts = {};
    specialties.forEach(s => counts[s] = 0);
    
    appointments.forEach(a => {
        if (counts[a.specialty] !== undefined) {
            counts[a.specialty]++;
        }
    });

    const maxVal = Math.max(...Object.values(counts), 1); // Evitar división por cero

    // Retornar HTML de barritas
    return specialties.map(spec => {
        const items = appointments.filter(a => a.specialty === spec).sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
        const count = counts[spec];
        const pct = Math.round((count / maxVal) * 100);

        const listHtml = items.slice(0, 5).map(it => `
            <div style="display:flex; justify-content:space-between; gap:12px; font-size:12px; padding:6px 0; border-bottom:1px dashed rgba(0,0,0,0.04);">
                <div style="min-width:120px;">${new Date(it.date + 'T00:00:00').toLocaleDateString('es-AR')} ${it.time}</div>
                <div style="flex:1;">${it.doctorName} — ${it.patientName}</div>
                <div style="min-width:120px; text-align:right;">${it.paid ? '$' + (it.price||0) + ' · ' + (it.paymentMethod||'') : 'Pendiente'}</div>
            </div>
        `).join('');

        const moreNote = items.length > 5 ? `<div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">Mostrando 5 de ${items.length} turnos</div>` : '';

        return `
            <div style="margin-bottom:12px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 6px;">
                    <span>${spec}</span>
                    <span class="text-secondary">${count} Turnos</span>
                </div>
                <div style="background-color: var(--border-color); height: 8px; border-radius: var(--radius-full); overflow: hidden; margin-bottom:8px;">
                    <div style="background: linear-gradient(90deg, var(--primary-teal), #0284c7); height: 100%; width: ${pct}%; border-radius: var(--radius-full);"></div>
                </div>
                <div style="background:#fff; border:1px solid var(--border-color); padding:8px; border-radius:6px;">
                    ${listHtml || '<div style="font-size:12px; color:var(--text-secondary);">No hay turnos registrados para esta especialidad.</div>'}
                    ${moreNote}
                </div>
            </div>
        `;
    }).join("");
}

// Convertir array de días de la semana a String
function getScheduleSummary(doc) {
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const daysStr = doc.workDays.map(d => dayNames[d]).join(", ");
    return `${daysStr} | ${doc.workHours.start} - ${doc.workHours.end} hs`;
}
