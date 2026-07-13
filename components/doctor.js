/**
 * SALUD GOYA - Vistas y Componentes del Médico (components/doctor.js)
 * Registra vistas de Agenda Médica y Configuración de Horarios.
 */

window.addEventListener("DOMContentLoaded", () => {
    
    // 1. AGENDA MÉDICA
    app.registerView("agenda", async (container) => {
        const doctor = app.currentUser;
        if (!doctor) return renderNoDoctorSession(container);

        // Obtener turnos asignados a este doctor
        const allAppointments = await window.db.getAppointmentsByDoctor(doctor.id);

        let html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fa-solid fa-calendar-days"></i></div>
                    <div class="stat-content">
                        <span class="stat-value">${allAppointments.filter(a => ["Confirmado", "Solicitado"].includes(a.status)).length}</span>
                        <span class="stat-label">Turnos Pendientes</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fa-solid fa-square-check"></i></div>
                    <div class="stat-content">
                        <span class="stat-value">${allAppointments.filter(a => a.status === "Atendido").length}</span>
                        <span class="stat-label">Pacientes Atendidos</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red"><i class="fa-solid fa-user-slash"></i></div>
                    <div class="stat-content">
                        <span class="stat-value">${allAppointments.filter(a => a.status === "Ausente").length}</span>
                        <span class="stat-label">Inasistencias Registradas</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">
                    <span>Pacientes Citados en Agenda</span>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-outline-primary btn-sm btn-filter-agenda active" data-filter="pending">Pendientes</button>
                        <button class="btn btn-outline-primary btn-sm btn-filter-agenda" data-filter="today">Hoy</button>
                        <button class="btn btn-outline-primary btn-sm btn-filter-agenda" data-filter="all">Todos</button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table-custom" id="table-doctor-agenda">
                        <thead>
                            <tr>
                                <th>Fecha y Hora</th>
                                <th>Paciente</th>
                                <th>DNI / Teléfono</th>
                                <th>Copago</th>
                                <th>Estado</th>
                                <th>Acciones de Atención</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Llenado dinámico -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

        const tbody = container.querySelector("#table-doctor-agenda tbody");

        const renderAgendaRows = (filterType) => {
            tbody.innerHTML = "";
            let appointments = [...allAppointments];

            const todayStr = new Date().toISOString().split("T")[0];

            if (filterType === "pending") {
                appointments = appointments.filter(a => ["Solicitado", "Confirmado"].includes(a.status));
            } else if (filterType === "today") {
                appointments = appointments.filter(a => a.date === todayStr);
            }

            // Ordenar por fecha y hora ascendente
            appointments.sort((a, b) => new Date(a.date + "T" + a.time) - new Date(b.date + "T" + b.time));

            if (appointments.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No se encontraron turnos en la agenda bajo este filtro.</td></tr>`;
                return;
            }

            appointments.forEach(async appo => {
                const tr = document.createElement("tr");
                const formattedDate = new Date(appo.date + "T00:00:00").toLocaleDateString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                });
                
                // Buscar datos adicionales del paciente (teléfono)
                const patientObj = await window.db.getPatientById(appo.patientId);
                const phone = patientObj ? patientObj.phone : "-";
                
                const safeStatus = appo.status || "Solicitado";
                const isConfirmado = safeStatus === "Confirmado";
                const isSolicitado = safeStatus === "Solicitado";
                const canAttend = isConfirmado || isSolicitado; // Permitimos atender turnos confirmados o solicitados
                
                const statusBadge = `<span class="badge-status ${safeStatus.toLowerCase()}"><i class="fa-solid fa-circle"></i> ${safeStatus}</span>`;
                const paymentBadge = appo.paid 
                    ? `<span class="badge-payment pago"><i class="fa-solid fa-check"></i> Pago</span>` 
                    : `<span class="badge-payment pendiente"><i class="fa-solid fa-clock"></i> Pendiente</span>`;

                tr.innerHTML = `
                    <td>
                        <strong>${formattedDate}</strong><br>
                        <small class="text-secondary"><i class="fa-regular fa-clock"></i> ${appo.time} hs${appo.duration ? ` · ${appo.duration} min` : ''}</small>
                    </td>
                    <td><strong>${appo.patientName}</strong></td>
                    <td>
                        DNI: ${patientObj ? patientObj.dni : "-"}<br>
                        <small class="text-secondary"><i class="fa-solid fa-phone"></i> ${phone}</small>
                    </td>
                    <td>
                        $${appo.price}<br>
                        ${paymentBadge}
                    </td>
                    <td>${statusBadge}</td>
                    <td class="gap-2" style="display: flex; gap: 8px;">
                        ${canAttend 
                            ? `
                                <button class="btn btn-success btn-sm btn-attend-pat" data-id="${appo.id}" data-pat-id="${appo.patientId}" data-pat-name="${appo.patientName}" data-pat-dni="${patientObj ? patientObj.dni : '-'}" data-datetime="${formattedDate} a las ${appo.time} hs">
                                    <i class="fa-solid fa-stethoscope"></i> Atender
                                </button>
                                <button class="btn btn-info btn-sm btn-advance-pat" data-id="${appo.id}" data-date="${appo.date}" data-time="${appo.time}">
                                    <i class="fa-solid fa-forward"></i> Adelantar
                                </button>
                                <button class="btn btn-warning btn-sm btn-absent-pat" data-id="${appo.id}">
                                    <i class="fa-solid fa-user-slash"></i> Ausente
                                </button>
                            `
                            : `<span class="text-muted">Sin acciones</span>`
                        }
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Delegated click handler for action buttons in the agenda rows
            tbody.addEventListener("click", async (e) => {
                const btn = e.target.closest("button");
                if (!btn) return;

                // Atender
                if (btn.classList.contains("btn-attend-pat")) {
                    const appId = btn.getAttribute("data-id");
                    const patId = btn.getAttribute("data-pat-id");
                    const patName = btn.getAttribute("data-pat-name");
                    const patDni = btn.getAttribute("data-pat-dni");
                    const datetime = btn.getAttribute("data-datetime");

                    document.getElementById("consult-app-id").value = appId;
                    document.getElementById("consult-patient-id").value = patId;
                    document.getElementById("consult-patient-name").textContent = patName;
                    document.getElementById("consult-patient-dni").textContent = patDni;
                    document.getElementById("consult-app-datetime").textContent = datetime;

                    document.getElementById("consult-diagnostic").value = "";
                    document.getElementById("consult-observations").value = "";
                    document.getElementById("consult-indications").value = "";
                    document.getElementById("consult-recipe").value = "";

                    app.openModal("consultation-modal");
                    return;
                }

                // Adelantar
                if (btn.classList.contains("btn-advance-pat")) {
                    const appId = btn.getAttribute("data-id");
                    const appDate = btn.getAttribute("data-date");
                    const appointment = allAppointments.find(a => a.id === appId);
                    if (!appointment) return;

                    try {
                        const duration = parseInt(appointment.duration, 10) || 30;
                        const slots = await window.db.getDoctorAvailability(doctor.id, appDate, duration);
                        const availableEarlier = slots
                            .filter(slot => slot.available && slot.time < appointment.time)
                            .map(slot => slot.time);

                        if (availableEarlier.length === 0) {
                            app.showToast("No hay espacios libres anteriores para adelantar este turno.", "warning");
                            return;
                        }

                        // Mostrar modal con horarios anteriores disponibles
                        const modal = document.getElementById('advance-modal');
                        const list = modal.querySelector('#advance-times-list');
                        modal.querySelector('#advance-modal-info').textContent = `Turno actual: ${appointment.time} hs — seleccione nueva hora anterior disponible:`;
                        list.innerHTML = availableEarlier.map(t => `
                            <label style="display:flex; align-items:center; gap:8px; padding:6px; border-radius:6px; cursor:pointer;">
                                <input type="radio" name="advance-time" value="${t}" ${t === availableEarlier[0] ? 'checked' : ''}>
                                <span style="margin-left:6px;">${t} hs</span>
                            </label>
                        `).join('');

                        const confirmBtn = modal.querySelector('#advance-confirm-btn');
                        confirmBtn.dataset.appId = appId;
                        confirmBtn.dataset.appDate = appDate;

                        const onConfirm = async () => {
                            const selected = modal.querySelector('input[name="advance-time"]:checked');
                            if (!selected) {
                                app.showToast('Debe seleccionar un horario para adelantar.', 'warning');
                                return;
                            }
                            const selectedTime = selected.value;
                            try {
                                await window.db.updateAppointmentSchedule(appId, appDate, selectedTime);
                                app.showToast(`Turno adelantado a las ${selectedTime} hs correctamente.`, 'success');
                                app.closeModal('advance-modal');
                                app.navigateTo('agenda');
                            } catch (err) {
                                app.showToast(err.message, 'error');
                            }
                        };

                        // Usar listener una sola vez
                        confirmBtn.addEventListener('click', onConfirm, { once: true });
                        app.openModal('advance-modal');
                    } catch (err) {
                        app.showToast(err.message, "error");
                    }
                    return;
                }

                // Ausente
                if (btn.classList.contains("btn-absent-pat")) {
                    const appId = btn.getAttribute("data-id");
                    if (!confirm("¿Está seguro de marcar al paciente como AUSENTE en esta consulta? Esto registrará una inasistencia.")) return;
                    try {
                        const updatedApp = await window.db.updateAppointmentStatus(appId, "Ausente");
                        const patient = await window.db.getPatientById(updatedApp.patientId);
                        if (patient.status === "Suspendido") {
                            app.showToast(`Inasistencia registrada. ¡El paciente ${patient.name} ha sido SUSPENDIDO automáticamente por 30 días!`, "danger");
                        } else {
                            const config = await window.db.getSystemConfig();
                            app.showToast(`Ausencia registrada. Inasistencias de ${patient.name}: ${patient.absences}/${config.maxAbsences}`, "warning");
                        }
                        await app.updateNotificationBell();
                        app.navigateTo("agenda");
                    } catch (err) {
                        app.showToast(err.message, "error");
                    }
                    return;
                }
            });
        };

        // Registrar Tabs de Filtro
        container.querySelectorAll(".btn-filter-agenda").forEach(btn => {
            btn.addEventListener("click", (e) => {
                container.querySelectorAll(".btn-filter-agenda").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                renderAgendaRows(btn.getAttribute("data-filter"));
            });
        });

        // Inicializar tabla
        renderAgendaRows("pending");

        // Eventos del formulario del modal de consulta
        const consultForm = document.getElementById("consultation-form");
        
        // Desvincular eventos anteriores para evitar duplicados
        const newConsultForm = consultForm.cloneNode(true);
        consultForm.parentNode.replaceChild(newConsultForm, consultForm);

        newConsultForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            app.setBtnLoading(submitBtn, true);

            const appId = document.getElementById("consult-app-id").value;
            const patId = document.getElementById("consult-patient-id").value;
            const diagnostic = document.getElementById("consult-diagnostic").value.trim();
            const observations = document.getElementById("consult-observations").value.trim();
            const indications = document.getElementById("consult-indications").value.trim();
            const recipe = document.getElementById("consult-recipe").value;

            // Simulación de adjuntos (nombre genérico si sube archivo)
            const attachments = [];
            const fileInput = document.getElementById("consult-attachments");
            if (fileInput && fileInput.files.length > 0) {
                for (let i = 0; i < fileInput.files.length; i++) {
                    attachments.push({
                        name: fileInput.files[i].name,
                        size: (fileInput.files[i].size / (1024 * 1024)).toFixed(1) + " MB"
                    });
                }
            } else {
                // Generar un estudio simulado si seleccionó receta para enriquecer la demo
                if (recipe) {
                    attachments.push({
                        name: "Orden_Estudio_Adjunto.pdf",
                        size: "0.8 MB"
                    });
                }
            }

            try {
                // Buscar el turno para obtener la fecha
                const appointments = await window.db.getAppointments();
                const appo = appointments.find(a => a.id === appId);
                const dateVal = appo ? appo.date : new Date().toISOString().split("T")[0];

                await window.db.createMedicalRecord({
                    appointmentId: appId,
                    patientId: patId,
                    patientName: document.getElementById("consult-patient-name").textContent,
                    doctorId: doctor.id,
                    doctorName: doctor.name,
                    date: dateVal,
                    diagnostic,
                    observations,
                    indications,
                    recipe,
                    attachments
                });

                app.showToast("Atención médica guardada y cargada al Historial Clínico.", "success");
                app.closeModal("consultation-modal");
                await app.updateNotificationBell();
                app.navigateTo("agenda");
            } catch (err) {
                app.showToast(err.message, "error");
                app.setBtnLoading(submitBtn, false);
            }
        });

        // Cancelar consulta
        document.getElementById("consultation-cancel-btn").onclick = () => {
            app.closeModal("consultation-modal");
        };
        document.getElementById("consultation-close-btn").onclick = () => {
            app.closeModal("consultation-modal");
        };
    });

    // 2. CONFIGURACIÓN DE HORARIOS DEL MÉDICO
    app.registerView("config_doctor", async (container) => {
        const doctor = app.currentUser;
        if (!doctor) return renderNoDoctorSession(container);

        // Obtener datos frescos
        const freshDocRaw = await window.db.getDoctorById(doctor.id) || {};
        // Asegurar valores por defecto para evitar errores si faltan campos
        const freshDoc = Object.assign({ workDays: [], workHours: { start: '08:00', end: '12:00' } }, freshDocRaw);

        let html = `
            <div class="card animate__animated animate__fadeIn">
                <div class="card-title">
                    <span>Configurar mis Días y Horas de Atención</span>
                    <i class="fa-solid fa-clock text-muted"></i>
                </div>
                <form id="form-doctor-schedule">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; flex-wrap: wrap;">
                        
                        <div>
                            <label class="mb-4 d-block">Seleccione los Días de Consulta Semanal:</label>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                ${[1, 2, 3, 4, 5, 6].map(dNum => {
                                    const dayNames = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
                                    const isChecked = Array.isArray(freshDoc.workDays) && freshDoc.workDays.includes(dNum);
                                    return `
                                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: normal;">
                                            <input type="checkbox" name="workday" value="${dNum}" ${isChecked ? 'checked' : ''} style="width: auto;">
                                            ${dayNames[dNum]}
                                        </label>
                                    `;
                                }).join("")}
                            </div>
                        </div>

                        <div>
                            <label class="mb-4 d-block">Rango de Horario de Atención Diario:</label>
                            <div class="form-group">
                                <label for="doc-start-hour">Hora de Apertura</label>
                                <input type="time" id="doc-start-hour" value="${freshDoc.workHours.start}" required>
                            </div>
                            <div class="form-group mt-4">
                                <label for="doc-end-hour">Hora de Cierre</label>
                                <input type="time" id="doc-end-hour" value="${freshDoc.workHours.end}" required>
                            </div>
                            <div class="mt-4" style="background: var(--primary-teal-light); border: 1px dashed var(--primary-teal); padding: 12px; border-radius: var(--radius-md); font-size: 12px; color: var(--primary-teal);">
                                <i class="fa-solid fa-lightbulb"></i> Los turnos se generan según la duración seleccionada para cada consulta. Si un turno termina antes, el médico puede adelantar el siguiente disponible.
                            </div>
                        </div>
                    </div>

                    <div class="modal-actions" style="margin-top: 32px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Guardar Configuración</button>
                    </div>
                </form>
            </div>
        `;

        container.innerHTML = html;

        const form = container.querySelector("#form-doctor-schedule");
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');

            // Obtener días seleccionados
            const checkedBoxes = form.querySelectorAll("input[name='workday']:checked");
            const workDays = Array.from(checkedBoxes).map(cb => parseInt(cb.value));

            if (workDays.length === 0) {
                app.showToast("Debe seleccionar al menos un día de atención.", "error");
                return;
            }

            const start = form.querySelector("#doc-start-hour").value;
            const end = form.querySelector("#doc-end-hour").value;

            if (start >= end) {
                app.showToast("La hora de inicio debe ser anterior a la de cierre.", "error");
                return;
            }

            try {
                app.setBtnLoading(submitBtn, true);
                freshDoc.workDays = workDays;
                freshDoc.workHours = { start, end };

                await window.db.saveDoctor(freshDoc);
                app.showToast("Horarios de atención actualizados correctamente.", "success");
                
                // Actualizar sesión activa en el SPA
                app.currentUser = freshDoc;
                app.navigateTo("agenda");
            } catch (err) {
                app.showToast(err.message, "error");
                app.setBtnLoading(submitBtn, false);
            }
        });
    });
});

// Helper de Renderizar pantalla sin Sesión de Médico
function renderNoDoctorSession(container) {
    container.innerHTML = `
        <div class="card p-5 text-center">
            <i class="fa-solid fa-user-lock fa-4x text-muted mb-4"></i>
            <h2>Portal del Profesional - Acceso Restringido</h2>
            <p class="text-secondary mt-2">No se encuentra un médico seleccionado. Por favor, selecciona un Médico en la Barra del Simulador (en la parte superior) para visualizar su agenda.</p>
        </div>
    `;
}
