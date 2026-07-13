/**
 * SALUD GOYA - Vistas y Componentes del Médico (components/doctor.js)
 * Registra vistas de Agenda Médica y Configuración de Horarios.
 */

(function() {
    const registerDoctorViews = () => {
        if (!window.app) {
            console.log("Esperando a que 'app' esté listo para registrar vistas de médico...");
            setTimeout(registerDoctorViews, 100);
            return;
        }

        console.log("Registrando vistas de médico en 'app'...");

        // 1. AGENDA MÉDICA
        app.registerView("agenda", async (container) => {
            console.log("SALUD GOYA: Renderizando vista Agenda...");
            const doctor = app.currentUser;
            if (!doctor) return renderNoDoctorSession(container);

            try {
                container.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Cargando turnos...</p></div>`;

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
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                `;

                container.innerHTML = html;
                const tbody = container.querySelector("#table-doctor-agenda tbody");

                const renderRows = async (filterType) => {
                    tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4"><i class="fa-solid fa-circle-notch fa-spin"></i> Filtrando lista...</td></tr>`;

                    let filtered = [...allAppointments];
                    const todayStr = new Date().toISOString().split("T")[0];

                    if (filterType === "pending") {
                        filtered = filtered.filter(a => ["Solicitado", "Confirmado"].includes(a.status));
                    } else if (filterType === "today") {
                        filtered = filtered.filter(a => a.date === todayStr);
                    }

                    filtered.sort((a, b) => new Date(a.date + "T" + a.time) - new Date(b.date + "T" + b.time));

                    if (filtered.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted p-4">No se encontraron turnos para este filtro.</td></tr>`;
                        return;
                    }

                    const rows = await Promise.all(filtered.map(async appo => {
                        let patDni = "-", patPhone = "-";
                        try {
                            const p = await window.db.getPatientById(appo.patientId);
                            if (p) { patDni = p.dni || "-"; patPhone = p.phone || "-"; }
                        } catch(e) {}

                        const statusBadge = `<span class="badge-status ${(appo.status || 'Solicitado').toLowerCase()}">${appo.status || 'Solicitado'}</span>`;
                        const paymentBadge = appo.paid
                            ? `<span class="badge-payment pago"><i class="fa-solid fa-check"></i> Pago</span>`
                            : `<span class="badge-payment pendiente"><i class="fa-solid fa-clock"></i> Pendiente</span>`;

                        const canAttend = ["Solicitado", "Confirmado"].includes(appo.status);

                        return `
                            <tr>
                                <td><strong>${new Date(appo.date + "T00:00:00").toLocaleDateString()}</strong><br><small>${appo.time} hs</small></td>
                                <td><strong>${appo.patientName}</strong></td>
                                <td>DNI: ${patDni}<br><small>${patPhone}</small></td>
                                <td>$${appo.price}<br>${paymentBadge}</td>
                                <td>${statusBadge}</td>
                                <td>
                                    <div style="display: flex; gap: 4px;">
                                        ${canAttend ? `
                                            <button class="btn btn-success btn-sm btn-attend-pat" data-id="${appo.id}" data-pat-id="${appo.patientId}" data-pat-name="${appo.patientName}" data-pat-dni="${patDni}" data-datetime="${appo.date} ${appo.time}">Atender</button>
                                            <button class="btn btn-info btn-sm btn-advance-pat" data-id="${appo.id}" data-date="${appo.date}" data-time="${appo.time}">Adelantar</button>
                                            <button class="btn btn-warning btn-sm btn-absent-pat" data-id="${appo.id}">Ausente</button>
                                        ` : '<span class="text-muted">-</span>'}
                                    </div>
                                </td>
                            </tr>
                        `;
                    }));
                    tbody.innerHTML = rows.join("");

                    // Eventos de botones en la tabla
                    tbody.querySelectorAll(".btn-attend-pat").forEach(btn => {
                        btn.onclick = () => {
                            document.getElementById("consult-app-id").value = btn.dataset.id;
                            document.getElementById("consult-patient-id").value = btn.dataset.patId;
                            document.getElementById("consult-patient-name").textContent = btn.dataset.patName;
                            document.getElementById("consult-patient-dni").textContent = btn.dataset.patDni;
                            document.getElementById("consult-app-datetime").textContent = btn.dataset.datetime;
                            app.openModal("consultation-modal");
                        };
                    });

                    tbody.querySelectorAll(".btn-absent-pat").forEach(btn => {
                        btn.onclick = async () => {
                            if (confirm("¿Marcar paciente como ausente?")) {
                                try {
                                    await window.db.updateAppointmentStatus(btn.dataset.id, "Ausente");
                                    app.showToast("Ausencia registrada", "warning");
                                    app.navigateTo("agenda");
                                } catch(e) { app.showToast(e.message, "error"); }
                            }
                        };
                    });

                    tbody.querySelectorAll(".btn-advance-pat").forEach(btn => {
                        btn.onclick = async () => {
                            const appId = btn.dataset.id;
                            const appDate = btn.dataset.date;
                            const appTime = btn.dataset.time;
                            try {
                                const slots = await window.db.getDoctorAvailability(doctor.id, appDate);
                                const earlier = slots.filter(s => s.available && s.time < appTime);
                                if (earlier.length === 0) return app.showToast("No hay horarios anteriores libres.", "info");

                                const modal = document.getElementById('advance-modal');
                                modal.querySelector('#advance-times-list').innerHTML = earlier.map(s => `
                                    <button class="btn btn-outline-primary btn-block mb-2 btn-sel-new-time" data-time="${s.time}">${s.time} hs</button>
                                `).join("");

                                modal.querySelectorAll(".btn-sel-new-time").forEach(b => {
                                    b.onclick = async () => {
                                        await window.db.updateAppointmentSchedule(appId, appDate, b.dataset.time);
                                        app.closeModal('advance-modal');
                                        app.showToast("Turno adelantado", "success");
                                        app.navigateTo("agenda");
                                    };
                                });
                                app.openModal('advance-modal');
                            } catch(e) { app.showToast(e.message, "error"); }
                        };
                    });
                };

                container.querySelectorAll(".btn-filter-agenda").forEach(btn => {
                    btn.onclick = () => {
                        container.querySelectorAll(".btn-filter-agenda").forEach(b => b.classList.remove("active"));
                        btn.classList.add("active");
                        renderRows(btn.dataset.filter);
                    };
                });

                renderRows("pending");

                // Configurar formulario de consulta
                const form = document.getElementById("consultation-form");
                form.onsubmit = async (e) => {
                    e.preventDefault();
                    const submitBtn = form.querySelector('button[type="submit"]');
                    app.setBtnLoading(submitBtn, true);
                    try {
                        await window.db.createMedicalRecord({
                            appointmentId: document.getElementById("consult-app-id").value,
                            patientId: document.getElementById("consult-patient-id").value,
                            patientName: document.getElementById("consult-patient-name").textContent,
                            doctorId: doctor.id,
                            doctorName: doctor.name,
                            date: new Date().toISOString().split("T")[0],
                            diagnostic: document.getElementById("consult-diagnostic").value,
                            indications: document.getElementById("consult-indications").value,
                            observations: document.getElementById("consult-observations").value,
                            recipe: document.getElementById("consult-recipe").value,
                            attachments: []
                        });
                        app.showToast("Atención finalizada", "success");
                        app.closeModal("consultation-modal");
                        app.navigateTo("agenda");
                    } catch(e) { app.showToast(e.message, "error"); app.setBtnLoading(submitBtn, false); }
                };

            } catch (err) {
                container.innerHTML = `<div class="error-state"><p>Error al cargar la agenda: ${err.message}</p></div>`;
            }
        });

        // 2. CONFIGURACIÓN DE HORARIOS DEL MÉDICO
        app.registerView("configuracion_horarios", async (container) => {
            const doctor = app.currentUser;
            if (!doctor) return renderNoDoctorSession(container);

            try {
                container.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Obteniendo configuración...</p></div>`;

                const freshDoc = await window.db.getDoctorById(doctor.id);
                if (!freshDoc) throw new Error("No se pudo obtener el perfil del médico.");

                freshDoc.workDays = freshDoc.workDays || [];
                freshDoc.workHours = freshDoc.workHours || { start: "08:00", end: "12:00" };
                freshDoc.blockedDates = freshDoc.blockedDates || [];

                let html = `
                    <div class="card animate__animated animate__fadeIn">
                        <div class="card-title">Configuración de Agenda y Días Laborales</div>
                        <form id="form-doc-config">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px;">
                                <div>
                                    <label class="mb-3 d-block">Días de Atención Semanal:</label>
                                    <div style="display: flex; flex-direction: column; gap: 8px;">
                                        ${[1,2,3,4,5,6].map(d => {
                                            const names = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
                                            return `<label style="font-weight:normal; display:flex; align-items:center; gap:8px;">
                                                <input type="checkbox" name="wd" value="${d}" ${freshDoc.workDays.includes(d) ? 'checked' : ''} style="width:auto;"> ${names[d]}
                                            </label>`;
                                        }).join("")}
                                    </div>

                                    <div class="mt-5 pt-4" style="border-top:1px solid var(--border-color);">
                                        <label class="mb-2 d-block"><i class="fa-solid fa-calendar-xmark"></i> Fechas Bloqueadas (Licencias/Vacaciones):</label>
                                        <div style="display:flex; gap:8px; margin-bottom:12px;">
                                            <input type="date" id="block-date" style="flex:1;">
                                            <button type="button" id="btn-add-block" class="btn btn-outline-primary btn-sm">Bloquear</button>
                                        </div>
                                        <div id="block-list" style="display:flex; flex-wrap:wrap; gap:8px; max-height:120px; overflow:auto;"></div>
                                    </div>
                                </div>

                                <div>
                                    <label class="mb-3 d-block">Horario de Consultorio:</label>
                                    <div class="form-group">
                                        <label>Hora de Inicio</label>
                                        <input type="time" id="h-start" value="${freshDoc.workHours.start}" required>
                                    </div>
                                    <div class="form-group mt-3">
                                        <label>Hora de Cierre</label>
                                        <input type="time" id="h-end" value="${freshDoc.workHours.end}" required>
                                    </div>
                                    <div class="alert-card info mt-4" style="font-size:12px;">
                                        <i class="fa-solid fa-info-circle"></i> Los turnos se habilitarán basándose en este rango y los días seleccionados.
                                    </div>
                                </div>
                            </div>

                            <div class="modal-actions mt-5 pt-4" style="border-top:1px solid var(--border-color);">
                                <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                `;

                container.innerHTML = html;
                const form = container.querySelector("#form-doc-config");
                let blocks = [...freshDoc.blockedDates];

                const renderBlocks = () => {
                    const div = container.querySelector("#block-list");
                    if (blocks.length === 0) { div.innerHTML = '<span class="text-muted" style="font-size:11px;">No hay fechas bloqueadas.</span>'; return; }
                    div.innerHTML = blocks.sort().map(d => `
                        <span class="badge-status solicitado" style="display:flex; align-items:center; gap:6px; padding:4px 8px; font-size:11px;">
                            ${d} <i class="fa-solid fa-xmark text-danger btn-rem-block" data-date="${d}" style="cursor:pointer;"></i>
                        </span>
                    `).join("");
                    div.querySelectorAll(".btn-rem-block").forEach(b => {
                        b.onclick = () => { blocks = blocks.filter(x => x !== b.dataset.date); renderBlocks(); };
                    });
                };

                container.querySelector("#btn-add-block").onclick = () => {
                    const input = container.querySelector("#block-date");
                    if (input.value && !blocks.includes(input.value)) {
                        blocks.push(input.value);
                        input.value = "";
                        renderBlocks();
                    }
                };

                renderBlocks();

                form.onsubmit = async (e) => {
                    e.preventDefault();
                    const btn = form.querySelector('button[type="submit"]');
                    const wds = Array.from(form.querySelectorAll("input[name='wd']:checked")).map(c => parseInt(c.value));
                    if (wds.length === 0) return app.showToast("Selecciona al menos un día", "error");

                    try {
                        app.setBtnLoading(btn, true);
                        const updated = {
                            ...freshDoc,
                            workDays: wds,
                            workHours: { start: document.getElementById("h-start").value, end: document.getElementById("h-end").value },
                            blockedDates: blocks
                        };
                        await window.db.saveDoctor(updated);
                        app.showToast("Configuración actualizada", "success");
                        app.currentUser = updated;
                        app.navigateTo("agenda");
                    } catch(e) { app.showToast(e.message, "error"); app.setBtnLoading(btn, false); }
                };

            } catch (err) {
                container.innerHTML = `<div class="error-state"><p>Error al cargar configuración: ${err.message}</p></div>`;
            }
        });
    };

    const renderNoDoctorSession = (container) => {
        container.innerHTML = `
            <div class="card p-5 text-center">
                <i class="fa-solid fa-user-lock fa-4x text-muted mb-4"></i>
                <h2>Acceso Restringido - Portal Médico</h2>
                <p class="text-secondary mt-2">No se ha detectado una sesión de médico activa.</p>
            </div>
        `;
    };

    registerDoctorViews();
})();
