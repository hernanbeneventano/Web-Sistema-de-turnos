/**
 * SALUD GOYA - Vistas y Componentes de Administración (components/admin.js)
 */

window.addEventListener("DOMContentLoaded", () => {
    
    // 1. DASHBOARD ESTADÍSTICO DE ADMINISTRACIÓN
    app.registerView("dashboard_admin", async (container) => {
        try {
            const stats = await window.db.getAdminStats();
            const appointments = await window.db.getAppointments();

            const totalApp = stats.totalApp || 0;
            const absentApp = stats.absentApp || 0;
            const suspendedPatients = stats.suspendedPatients || 0;
            const totalEarnings = stats.totalEarnings || 0;

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
                    <div class="card">
                        <div class="card-title">Rendimiento de Especialidades</div>
                        <div style="display: flex; flex-direction: column; gap: 16px;">
                            ${await renderSpecialtyRanks(appointments)}
                        </div>
                    </div>

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
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            const tbody = container.querySelector("#table-pending-copays tbody");
            const pendingPayments = stats.pendingPayments || [];

            if (pendingPayments.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No hay cobros de copago pendientes.</td></tr>`;
            } else {
                pendingPayments.forEach(appo => {
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

                tbody.querySelectorAll(".btn-confirm-copay").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const appId = btn.getAttribute("data-id");
                        try {
                            // Enviar explícitamente el estado actual o null si el backend lo maneja,
                            // pero para asegurar compatibilidad con Zod .optional() y evitar "null",
                            // llamamos a la API solo con los campos de pago.
                            await window.db.updateAppointmentStatus(appId, undefined, { paid: true });
                            app.showToast("Pago registrado en caja exitosamente.", "success");
                            app.navigateTo("dashboard_admin");
                        } catch (err) {
                            app.showToast(err.message, "error");
                        }
                    });
                });
            }

            // Gráfico
            try {
                const paidCount = appointments.filter(a => a.paid).length;
                const unpaidCount = appointments.filter(a => !a.paid).length;
                const ctxEl = container.querySelector('#admin-pie-chart');
                if (ctxEl) {
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
                console.warn('No se pudo inicializar el gráfico:', err);
            }
        } catch (err) {
            console.error("Error en dashboard_admin:", err);
            container.innerHTML = `<div class="error-state"><p>Error al cargar estadísticas: ${err.message}</p></div>`;
        }
    });

    // 2. GESTIÓN DE PACIENTES Y SANCIONES
    app.registerView("gestion_pacientes", async (container) => {
        const allPatients = await window.db.getPatients();

        container.innerHTML = `
            <div class="card animate__animated animate__fadeIn">
                <div class="card-title">
                    <span>Control de Pacientes y Sanciones</span>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div class="search-box" style="position: relative;">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px;"></i>
                            <input type="text" id="patient-search" placeholder="Buscar por nombre, DNI o email..." style="padding-left: 35px; width: 300px; height: 38px; font-size: 13px;">
                        </div>
                        <i class="fa-solid fa-users-slash text-muted"></i>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table-custom" id="table-admin-patients">
                        <thead>
                            <tr>
                                <th>Paciente</th>
                                <th>Contacto</th>
                                <th>Inasistencias</th>
                                <th>Estado</th>
                                <th>Detalle Sanción</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        `;

        const tbody = container.querySelector("#table-admin-patients tbody");

        const renderPatientRows = (filter = "") => {
            const query = filter.toLowerCase().trim();
            const filtered = allPatients.filter(p =>
                p.name.toLowerCase().includes(query) ||
                (p.dni && p.dni.includes(query)) ||
                p.email.toLowerCase().includes(query)
            );

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted p-4">No se encontraron pacientes que coincidan con "${filter}".</td></tr>`;
                return;
            }

            tbody.innerHTML = filtered.map(p => {
                const statusBadge = `<span class="badge-status ${p.status === 'Suspendido' ? 'ausente' : 'confirmado'}">${p.status}</span>`;
                const isSuspended = p.status === 'Suspendido';

                return `
                    <tr>
                        <td>
                            <strong>${p.name}</strong><br>
                            <small class="text-secondary">DNI: ${p.dni || '-'}</small>
                        </td>
                        <td>
                            <small>${p.email}</small><br>
                            <small>${p.phone || '-'}</small>
                        </td>
                        <td class="text-center">
                            <span class="badge ${p.absences >= 3 ? 'bg-danger' : 'bg-light text-dark'}" style="padding: 4px 8px; border-radius: 4px;">
                                ${p.absences || 0}
                            </span>
                        </td>
                        <td>${statusBadge}</td>
                        <td>
                            ${isSuspended
                                ? `<small class="text-danger">Hasta: ${new Date(p.suspensionEnd).toLocaleDateString()}</small><br>
                                   <small class="text-muted" title="${p.suspensionReason}">${p.suspensionReason?.substring(0, 20)}...</small>`
                                : '<span class="text-muted">-</span>'}
                        </td>
                        <td>
                            <div style="display: flex; gap: 8px;">
                                ${isSuspended
                                    ? `<button class="btn btn-success btn-sm btn-lift-suspension" data-id="${p.id}" title="Levantar Suspensión">
                                          <i class="fa-solid fa-user-check"></i> Activar
                                       </button>`
                                    : `
                                       <button class="btn btn-danger btn-sm btn-manual-sanction" data-id="${p.id}" title="Sanción Manual">
                                          <i class="fa-solid fa-gavel"></i> Sancionar
                                       </button>
                                       <button class="btn btn-warning btn-sm btn-reset-absences" data-id="${p.id}" title="Resetear Inasistencias">
                                          <i class="fa-solid fa-rotate-left"></i> Limpiar
                                       </button>
                                    `}
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");

            // Re-vincular eventos
            tbody.querySelectorAll(".btn-lift-suspension").forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.dataset.id;
                    if (confirm("¿Estás seguro de levantar la suspensión de este paciente?")) {
                        try {
                            await window.db.updatePatient({ id, status: "Activo", absences: 0, suspensionEnd: null, suspensionReason: null });
                            app.showToast("Suspensión levantada.", "success");
                            app.navigateTo("gestion_pacientes");
                        } catch (err) { app.showToast(err.message, "error"); }
                    }
                };
            });

            tbody.querySelectorAll(".btn-manual-sanction").forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.dataset.id;
                    const reason = prompt("Ingrese el motivo de la sanción manual:");
                    if (!reason) return;
                    const days = prompt("¿Cuántos días de suspensión desea aplicar?", "30");
                    if (!days || isNaN(days)) return;

                    const endDate = new Date();
                    endDate.setDate(endDate.getDate() + parseInt(days));

                    try {
                        await window.db.updatePatient({
                            id,
                            status: "Suspendido",
                            suspensionEnd: endDate.toISOString(),
                            suspensionReason: `Sanción Manual: ${reason}`
                        });
                        app.showToast("Paciente sancionado manualmente.", "warning");
                        app.navigateTo("gestion_pacientes");
                    } catch (err) { app.showToast(err.message, "error"); }
                };
            });

            tbody.querySelectorAll(".btn-reset-absences").forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.dataset.id;
                    if (confirm("¿Deseas poner en cero el contador de inasistencias?")) {
                        try {
                            await window.db.updatePatient({ id, absences: 0 });
                            app.showToast("Contador reseteado.", "success");
                            app.navigateTo("gestion_pacientes");
                        } catch (err) { app.showToast(err.message, "error"); }
                    }
                };
            });
        };

        // Evento búsqueda
        const searchInput = container.querySelector("#patient-search");
        searchInput.addEventListener("input", (e) => renderPatientRows(e.target.value));

        // Initial render
        renderPatientRows();
    });

    // 3. GESTIÓN DE MÉDICOS
    app.registerView("gestion_medicos", async (container) => {
        const doctors = await window.db.getDoctors();
        const invitations = await window.db.getInvitations() || [];
        const specialties = await window.db.getSpecialties();

        let html = `
            <div class="admin-grid two-cols-main-sidebar animate__animated animate__fadeIn">
                <div style="display:flex; flex-direction:column; gap:24px;">
                    <!-- Listado de Médicos Activos -->
                    <div class="card">
                        <div class="card-title">Listado de Profesionales Activos</div>
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
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Listado de Invitaciones Pendientes -->
                    <div class="card">
                        <div class="card-title">Invitaciones Pendientes (Médicos por Registrar)</div>
                        <div class="table-responsive">
                            <table class="table-custom" id="table-admin-invites">
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Email</th>
                                        <th>Especialidad</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${invitations.length === 0
                                        ? '<tr><td colspan="4" class="text-center text-muted">No hay invitaciones pendientes.</td></tr>'
                                        : invitations.map(inv => `
                                            <tr>
                                                <td><strong>${inv.name}</strong></td>
                                                <td>${inv.email}</td>
                                                <td>${inv.specialty}</td>
                                                <td>
                                                    <button class="btn btn-danger btn-sm btn-delete-invite" data-token="${inv.token}">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-title" id="form-doc-title">Invitar Nuevo Médico</div>
                    <p class="text-secondary mb-4" style="font-size:13px;">Se generará un enlace único para que el profesional complete su registro.</p>
                    <form id="form-admin-doctor">
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
                            <button type="submit" class="btn btn-primary btn-block" id="btn-submit-doc">Generar Enlace de Invitación</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        container.innerHTML = html;

        const tbody = container.querySelector("#table-admin-doctors tbody");
        if (doctors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay médicos activos.</td></tr>';
        } else {
            doctors.forEach(doc => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>
                        <strong>${doc.name}</strong><br>
                        <small class="text-secondary">Mat. ${doc.matricula}</small>
                    </td>
                    <td>${doc.specialty}</td>
                    <td><small>${getScheduleSummary(doc)}</small></td>
                    <td>
                        <button class="btn btn-danger btn-sm btn-delete-doc" data-id="${doc.id}"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Eliminar médico
        tbody.querySelectorAll(".btn-delete-doc").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.dataset.id;
                if (confirm("¿Seguro que deseas eliminar a este profesional?")) {
                    await window.db.deleteDoctor(id);
                    app.showToast("Médico eliminado", "success");
                    app.navigateTo("gestion_medicos");
                }
            });
        });

        // Eliminar invitación
        container.querySelectorAll(".btn-delete-invite").forEach(btn => {
            btn.addEventListener("click", async () => {
                const token = btn.dataset.token;
                if (confirm("¿Seguro que deseas cancelar esta invitación?")) {
                    await window.db.deleteInvitation(token);
                    app.showToast("Invitación cancelada", "success");
                    app.navigateTo("gestion_medicos");
                }
            });
        });

        const form = container.querySelector("#form-admin-doctor");
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');

            const name = document.getElementById("doc-name").value.trim();
            const email = document.getElementById("doc-email").value.trim();
            const specialty = document.getElementById("doc-specialty").value;
            const matricula = document.getElementById("doc-matricula").value.trim();
            const phone = document.getElementById("doc-phone").value.trim();
            const start = document.getElementById("doc-start").value;
            const end = document.getElementById("doc-end").value;

            const daysChecked = form.querySelectorAll("input[name='admin-workday']:checked");
            const workDays = Array.from(daysChecked).map(cb => parseInt(cb.value));

            if (workDays.length === 0) {
                app.showToast("Seleccione al menos un día de atención.", "warning");
                return;
            }

            app.setBtnLoading(submitBtn, true);

            try {
                app.showToast("Generando invitación...", "info");
                const invite = await window.db.createInvitation({
                    name, email, specialty, matricula, phone, workDays,
                    workHours: { start, end }
                });

                const inviteLink = `${window.location.origin}${window.location.pathname}?invite=${invite.token}`;

                // Mostrar el link al admin para que lo envíe
                const modalHtml = `
                    <div class="card p-4 text-center">
                        <i class="fa-solid fa-envelope-circle-check fa-3x text-success mb-3"></i>
                        <h3>Invitación Generada</h3>
                        <p class="text-secondary mt-2">Envía este enlace al profesional para que complete su registro:</p>
                        <div class="mt-3" style="background:var(--bg-light); padding:12px; border-radius:8px; word-break:break-all; font-family:monospace; border:1px solid var(--border-color);">
                            ${inviteLink}
                        </div>
                        <div class="modal-actions" style="border:none; margin-top:24px;">
                            <button class="btn btn-secondary btn-close-modal">Cerrar</button>
                            <button class="btn btn-primary btn-copy-invite" data-link="${inviteLink}">
                                <i class="fa-solid fa-copy"></i> Copiar Enlace
                            </button>
                        </div>
                    </div>
                `;

                container.innerHTML = modalHtml;
                container.querySelector(".btn-copy-invite").onclick = () => {
                    navigator.clipboard.writeText(inviteLink);
                    app.showToast("Copiado al portapapeles", "success");
                };
                container.querySelector(".btn-close-modal").onclick = () => {
                    app.navigateTo("gestion_medicos");
                };

            } catch (err) {
                app.showToast(err.message, "error");
                app.setBtnLoading(submitBtn, false);
            }
        });
    });

    // 4. GESTIÓN DE ESPECIALIDADES
    app.registerView("gestion_especialidades", async (container) => {
        const specialties = await window.db.getSpecialties();

        container.innerHTML = `
            <div class="card animate__animated animate__fadeIn">
                <div class="card-title">Gestión de Especialidades Médicas</div>
                <div class="table-responsive">
                    <table class="table-custom">
                        <thead>
                            <tr>
                                <th>Nombre de la Especialidad</th>
                                <th style="width: 150px;">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${specialties.length === 0
                                ? '<tr><td colspan="2" class="text-center text-muted">No hay especialidades registradas.</td></tr>'
                                : specialties.map(s => `
                                    <tr>
                                        <td><strong>${s}</strong></td>
                                        <td>
                                            <button class="btn btn-danger btn-sm btn-delete-specialty" data-name="${s}">
                                                <i class="fa-solid fa-trash-can"></i> Eliminar
                                            </button>
                                        </td>
                                    </tr>`).join("")
                            }
                        </tbody>
                    </table>
                </div>

                <div class="mt-4" style="background: var(--bg-light); padding: 20px; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                    <h4 style="font-size: 14px; margin-bottom: 12px; color: var(--text-secondary);">Agregar Nueva Especialidad</h4>
                    <form id="form-add-specialty" style="display: flex; gap: 12px;">
                        <input type="text" id="new-specialty-name" placeholder="Ej: Cardiología, Pediatría..." required style="flex: 1;">
                        <button type="submit" class="btn btn-primary">
                            <i class="fa-solid fa-plus"></i> Agregar
                        </button>
                    </form>
                </div>
            </div>
        `;

        // Evento para Agregar
        const addForm = container.querySelector("#form-add-specialty");
        addForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const input = document.getElementById("new-specialty-name");
            const name = input.value.trim();
            if (!name) return;

            app.setBtnLoading(submitBtn, true);

            try {
                app.showToast("Agregando especialidad...", "info");
                await window.db.addSpecialty(name);
                app.showToast("Especialidad agregada correctamente", "success");
                app.navigateTo("gestion_especialidades");
            } catch (err) {
                app.showToast(err.message, "error");
                app.setBtnLoading(submitBtn, false);
            }
        });

        // Eventos para Eliminar
        container.querySelectorAll(".btn-delete-specialty").forEach(btn => {
            btn.addEventListener("click", async () => {
                const name = btn.getAttribute("data-name");
                if (confirm(`¿Seguro que deseas eliminar "${name}"?`)) {
                    try {
                        await window.db.deleteSpecialty(name);
                        app.showToast("Especialidad eliminada", "success");
                        app.navigateTo("gestion_especialidades");
                    } catch (err) {
                        app.showToast(err.message, "error");
                    }
                }
            });
        });
    });

    // 5. MONITOR DE TURNOS
    app.registerView("gestion_turnos", async (container) => {
        const appointments = await window.db.getAppointments();
        // Ordenar por fecha más reciente
        appointments.sort((a, b) => new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time));

        container.innerHTML = `
            <div class="card animate__animated animate__fadeIn">
                <div class="card-title">Todos los Turnos del Sistema</div>
                <div class="table-responsive">
                    <table class="table-custom" id="table-all-appointments">
                        <thead>
                            <tr>
                                <th>Fecha y Hora</th>
                                <th>Paciente</th>
                                <th>Médico / Especialidad</th>
                                <th>Estado</th>
                                <th>Pago</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${appointments.length === 0
                                ? '<tr><td colspan="6" class="text-center">No hay turnos registrados</td></tr>'
                                : appointments.map(a => {
                                    const paymentBadge = a.paid
                                        ? `<span class="badge-payment pago"><i class="fa-solid fa-check"></i> Pago</span>`
                                        : `<span class="badge-payment pendiente"><i class="fa-solid fa-clock"></i> Pendiente</span>`;

                                    const statusClass = (a.status || 'solicitado').toLowerCase();

                                    return `
                                        <tr>
                                            <td>
                                                <strong>${new Date(a.date + 'T00:00:00').toLocaleDateString()}</strong><br>
                                                <small class="text-secondary">${a.time} hs</small>
                                            </td>
                                            <td>${a.patientName}</td>
                                            <td>
                                                ${a.doctorName}<br>
                                                <small class="text-secondary">${a.specialty}</small>
                                            </td>
                                            <td><span class="badge-status ${statusClass}">${a.status}</span></td>
                                            <td>${paymentBadge}</td>
                                            <td>
                                                ${!a.paid
                                                    ? `<button class="btn btn-success btn-sm btn-action-cobrar" data-id="${a.id}">Cobrar</button>`
                                                    : '<span class="text-muted">-</span>'
                                                }
                                            </td>
                                        </tr>
                                    `;
                                }).join("")
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.querySelectorAll(".btn-action-cobrar").forEach(btn => {
            btn.addEventListener("click", async () => {
                const appId = btn.dataset.id;
                try {
                    await window.db.updateAppointmentStatus(appId, undefined, { paid: true });
                    app.showToast("Pago registrado correctamente.", "success");
                    app.navigateTo("gestion_turnos");
                } catch (err) {
                    app.showToast(err.message, "error");
                }
            });
        });
    });

    // 6. LOG DE NOTIFICACIONES
    app.registerView("gestion_notificaciones", async (container) => {
        const notifs = await window.db.getNotifications();
        container.innerHTML = `
            <div class="card animate__animated animate__fadeIn">
                <div class="card-title">Historial de Notificaciones Enviadas</div>
                <div class="table-responsive">
                    <table class="table-custom">
                        <thead><tr><th>Fecha</th><th>Tipo</th><th>Destinatario</th><th>Mensaje</th></tr></thead>
                        <tbody>
                            ${notifs.length === 0
                                ? '<tr><td colspan="4" class="text-center">No hay notificaciones</td></tr>'
                                : notifs.map(n => `<tr><td>${new Date(n.date).toLocaleDateString()}</td><td>${n.type}</td><td>${n.recipient}</td><td>${n.message}</td></tr>`).join("")
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    // 7. AJUSTES DEL SISTEMA
    app.registerView("configuracion_sistema", async (container) => {
        const config = await window.db.getSystemConfig() || { copayDefault: 0 };
        container.innerHTML = `
            <div class="card animate__animated animate__fadeIn">
                <div class="card-title">Configuración Global</div>
                <form id="form-system-config">
                    <div class="form-group">
                        <label>Costo de Copago por Defecto</label>
                        <input type="number" id="copay-default" value="${config.copayDefault}">
                    </div>
                    <button type="submit" class="btn btn-primary">Guardar Ajustes</button>
                </form>
            </div>
        `;

        container.querySelector("#form-system-config").addEventListener("submit", async (e) => {
            e.preventDefault();
            const copay = document.getElementById("copay-default").value;
            await window.db.saveSystemConfig({ copayDefault: parseInt(copay) });
            app.showToast("Configuración guardada", "success");
        });
    });
});

async function renderSpecialtyRanks(appointments) {
    if (!appointments || appointments.length === 0) return "<p class='text-muted'>Sin datos de turnos.</p>";
    const counts = {};
    appointments.forEach(a => {
        counts[a.specialty] = (counts[a.specialty] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...Object.values(counts), 1);

    return sorted.map(([name, count]) => {
        const pct = Math.round((count / max) * 100);
        return `
            <div style="margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                    <span>${name}</span>
                    <span>${count} turnos</span>
                </div>
                <div style="background:#eee; height:6px; border-radius:3px;">
                    <div style="background:var(--primary-teal); width:${pct}%; height:100%; border-radius:3px;"></div>
                </div>
            </div>
        `;
    }).join("");
}

function getScheduleSummary(doc) {
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const daysStr = (doc.workDays || []).map(d => dayNames[d]).join(", ");
    return `${daysStr} | ${(doc.workHours || {}).start || '00:00'} - ${(doc.workHours || {}).end || '00:00'} hs`;
}
