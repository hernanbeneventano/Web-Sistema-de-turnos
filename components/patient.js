/**
 * SALUD GOYA - Vistas y Componentes del Paciente (components/patient.js)
 * Registra vistas de Dashboard, Reservas y Historial Médico.
 */

// Registrar vistas de Paciente en la app al cargar
window.addEventListener("DOMContentLoaded", () => {
    
    // 1. DASHBOARD DE PACIENTES
    app.registerView("dashboard", async (container) => {
        const patient = app.currentUser;
        if (!patient) return renderNoSession(container);

        // Actualizar datos de paciente desde DB por si hubo cambios
        const freshPatient = await window.db.getPatientById(patient.id);

        let html = "";

        // Alerta si el paciente está suspendido
        if (freshPatient.status === "Suspendido") {
            const endDate = new Date(freshPatient.suspensionEnd).toLocaleDateString('es-AR');
            html += `
                <div class="alert-card animate__animated animate__fadeIn">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <div>
                        <h4>CUENTA SUSPENDIDA TEMPORALMENTE</h4>
                        <p>Has acumulado <strong>${freshPatient.absences} inasistencias</strong> consecutivas sin aviso. Tu posibilidad de reservar nuevos turnos ha sido deshabilitada hasta el <strong>${endDate}</strong> inclusive (30 días de penalización).</p>
                        <p class="mt-2"><small><strong>Motivo:</strong> ${freshPatient.suspensionReason}</small></p>
                    </div>
                </div>
            `;
        }

        // Obtener turnos
        const appointments = await window.db.getAppointmentsByPatient(freshPatient.id);
        
        html += `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon blue"><i class="fa-solid fa-calendar-check"></i></div>
                    <div class="stat-content">
                        <span class="stat-value">${appointments.filter(a => ["Solicitado", "Confirmado"].includes(a.status)).length}</span>
                        <span class="stat-label">Turnos Activos</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green"><i class="fa-solid fa-clipboard-user"></i></div>
                    <div class="stat-content">
                        <span class="stat-value">${appointments.filter(a => a.status === "Atendido").length}</span>
                        <span class="stat-label">Consultas Atendidas</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red"><i class="fa-solid fa-user-slash"></i></div>
                    <div class="stat-content">
                        <span class="stat-value">${freshPatient.absences} / 3</span>
                        <span class="stat-label">Inasistencias Registradas</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">
                    <span>Mis Turnos Programados</span>
                    ${freshPatient.status !== "Suspendido" 
                        ? `<button id="btn-quick-book" class="btn btn-primary btn-sm"><i class="fa-solid fa-calendar-plus"></i> Reservar Turno</button>`
                        : `<button class="btn btn-secondary btn-sm" disabled><i class="fa-solid fa-ban"></i> Reservas Bloqueadas</button>`
                    }
                </div>
                <div class="table-responsive">
                    <table class="table-custom" id="table-patient-appointments">
                        <thead>
                            <tr>
                                <th>Fecha y Hora</th>
                                <th>Especialidad</th>
                                <th>Médico</th>
                                <th>Costo Copago</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Se llena dinámicamente -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Cargar tabla de turnos
        const tbody = container.querySelector("#table-patient-appointments tbody");
        if (appointments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No posees turnos agendados en el sistema.</td></tr>`;
        } else {
            // Ordenar por fecha (más recientes primero)
            appointments.sort((a, b) => new Date(b.date + "T" + b.time) - new Date(a.date + "T" + a.time));

            appointments.forEach(appo => {
                const tr = document.createElement("tr");
                const formattedDate = new Date(appo.date + "T00:00:00").toLocaleDateString('es-AR', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                });

                const safeStatus = appo.status || "Solicitado";
                const canCancel = ["Solicitado", "Confirmado"].includes(safeStatus);
                const statusBadge = `<span class="badge-status ${safeStatus.toLowerCase()}"><i class="fa-solid fa-circle"></i> ${safeStatus}</span>`;
                
                tr.innerHTML = `
                    <td>
                        <strong>${formattedDate}</strong><br>
                        <small class="text-secondary"><i class="fa-regular fa-clock"></i> ${appo.time} hs${appo.duration ? ` · ${appo.duration} min` : ''}</small>
                    </td>
                    <td>${appo.specialty}</td>
                    <td>${appo.doctorName}</td>
                    <td>$${appo.price}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${canCancel 
                            ? `<button class="btn btn-danger btn-sm btn-cancel-appointment" data-id="${appo.id}"><i class="fa-solid fa-xmark"></i> Cancelar</button>` 
                            : `<span class="text-muted">-</span>`
                        }
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Registrar eventos para cancelar
            tbody.querySelectorAll(".btn-cancel-appointment").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    const appId = btn.getAttribute("data-id");
                    if (confirm("¿Seguro que deseas cancelar este turno?")) {
                        try {
                            await window.db.updateAppointmentStatus(appId, "Cancelado");
                            app.showToast("Turno cancelado exitosamente. Se ha notificado al correo.", "success");
                            await app.updateNotificationBell();
                            // Recargar vista
                            app.navigateTo("dashboard");
                        } catch (err) {
                            app.showToast(err.message, "error");
                        }
                    }
                });
            });
        }

        // Registrar evento para botón rápido de agendar
        const quickBook = container.querySelector("#btn-quick-book");
        if (quickBook) {
            quickBook.addEventListener("click", () => app.navigateTo("reservar"));
        }
    });

    // 2. RESERVAR TURNO - ASISTENTE DE AGENDAMIENTO (WIZARD)
    app.registerView("reservar", async (container) => {
        const patient = app.currentUser;
        if (!patient) return renderNoSession(container);

        const freshPatient = await window.db.getPatientById(patient.id);

        // Si está suspendido, bloquear flujo completamente
        if (freshPatient.status === "Suspendido") {
            const endDate = new Date(freshPatient.suspensionEnd).toLocaleDateString('es-AR');
            container.innerHTML = `
                <div class="card p-5 text-center">
                    <i class="fa-solid fa-ban fa-4x text-danger mb-4"></i>
                    <h2>Acceso Bloqueado por Suspensión</h2>
                    <p class="text-secondary mt-3">Tu cuenta de paciente ha sido suspendida automáticamente debido a inasistencias reiteradas.</p>
                    <p class="text-secondary">Podrás volver a agendar turnos a partir de la fecha de levantamiento: <strong>${endDate}</strong>.</p>
                    <p class="mt-4">Si consideras que es un error, por favor comunícate con la administración en el centro médico.</p>
                    <button class="btn btn-primary mt-4" onclick="app.navigateTo('dashboard')"><i class="fa-solid fa-chevron-left"></i> Volver a Mis Turnos</button>
                </div>
            `;
            return;
        }

        // Datos del estado de reserva en memoria
        let selectedSpecialty = "";
        let selectedDoctor = null;
        let selectedDate = "";
        let selectedTime = "";
        let selectedDuration = 30;
        let selectedPaid = false;
        let selectedPaymentMethod = "Efectivo";

        const renderWizard = () => {
            container.innerHTML = `
                <div class="booking-wizard animate__animated animate__fadeIn">
                    <div class="wizard-steps">
                        <div class="wizard-step active" id="step-node-1">
                            <div class="step-number">1</div>
                            <div class="step-label">Especialidad</div>
                        </div>
                        <div class="wizard-step" id="step-node-2">
                            <div class="step-number">2</div>
                            <div class="step-label">Médico</div>
                        </div>
                        <div class="wizard-step" id="step-node-3">
                            <div class="step-number">3</div>
                            <div class="step-label">Fecha y Hora</div>
                        </div>
                        <div class="wizard-step" id="step-node-4">
                            <div class="step-number">4</div>
                            <div class="step-label">Confirmar</div>
                        </div>
                    </div>

                    <div id="wizard-content-panel" class="py-4">
                        <!-- Renderizado dinámico del paso activo -->
                    </div>

                    <div class="modal-actions" style="border-top: 1px solid var(--border-color); padding-top: 20px;">
                        <button id="wizard-back-btn" class="btn btn-secondary" style="display:none;"><i class="fa-solid fa-chevron-left"></i> Atrás</button>
                        <button id="wizard-next-btn" class="btn btn-primary" disabled>Siguiente <i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
            `;

            // Cargar primer paso
            goToStep1();
        };

        const updateStepNodes = (activeStep) => {
            for (let i = 1; i <= 4; i++) {
                const node = container.querySelector(`#step-node-${i}`);
                node.className = "wizard-step";
                if (i < activeStep) node.classList.add("completed");
                else if (i === activeStep) node.classList.add("active");
            }
        };

        // PASO 1: ESPECIALIDADES
        const goToStep1 = async () => {
            updateStepNodes(1);
            const panel = container.querySelector("#wizard-content-panel");
            const backBtn = container.querySelector("#wizard-back-btn");
            const nextBtn = container.querySelector("#wizard-next-btn");

            backBtn.style.display = "none";
            nextBtn.style.display = "inline-flex";
            nextBtn.disabled = !selectedSpecialty;
            nextBtn.onclick = goToStep2;

            const specialties = await window.db.getSpecialties();
            
            panel.innerHTML = `
                <h3 class="mb-4">Paso 1: Seleccione la Especialidad Médica</h3>
                <div style="margin-bottom:12px; display:flex; gap:8px; align-items:center;">
                    <input id="spec-search" placeholder="Buscar especialidad..." style="flex:1; padding:8px; border-radius:6px; border:1px solid var(--border-color);">
                </div>
                <div class="wizard-grid" id="spec-grid">
                    ${specialties.map(spec => {
                        const isSelected = spec === selectedSpecialty;
                        const cardIcon = getSpecialtyIcon(spec);
                        return `
                            <div class="selector-card spec-card ${isSelected ? 'selected' : ''}" data-value="${spec}">
                                <i class="fa-solid ${cardIcon}"></i>
                                <h4>${spec}</h4>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;

            // Eventos para tarjetas y búsqueda
            const searchInput = panel.querySelector("#spec-search");
            const specGrid = panel.querySelectorAll(".spec-card");

            const filterSpecs = (q) => {
                const val = q.trim().toLowerCase();
                specGrid.forEach(card => {
                    const txt = card.textContent.toLowerCase();
                    card.style.display = txt.includes(val) ? "flex" : "none";
                });
            };

            searchInput.addEventListener("input", (e) => filterSpecs(e.target.value));

            panel.querySelectorAll(".spec-card").forEach(card => {
                card.addEventListener("click", () => {
                    panel.querySelectorAll(".spec-card").forEach(c => c.classList.remove("selected"));
                    card.classList.add("selected");
                    selectedSpecialty = card.getAttribute("data-value");
                    
                    // Resetear selecciones posteriores
                    selectedDoctor = null;
                    selectedDate = "";
                    selectedTime = "";
                    
                    nextBtn.disabled = false;
                });
            });
        };

        // PASO 2: MÉDICOS
        const goToStep2 = async () => {
            updateStepNodes(2);
            const panel = container.querySelector("#wizard-content-panel");
            const backBtn = container.querySelector("#wizard-back-btn");
            const nextBtn = container.querySelector("#wizard-next-btn");

            backBtn.style.display = "inline-flex";
            backBtn.onclick = goToStep1;
            nextBtn.disabled = !selectedDoctor;
            nextBtn.onclick = goToStep3;

            const allDoctors = await window.db.getDoctors();
            const filteredDocs = allDoctors.filter(d => d.specialty === selectedSpecialty);

            if (filteredDocs.length === 0) {
                panel.innerHTML = `
                    <div class="text-center p-4">
                        <i class="fa-solid fa-user-slash fa-3x text-muted mb-3"></i>
                        <h4>No hay médicos disponibles</h4>
                        <p class="text-secondary">Lo sentimos, no hay médicos asignados a ${selectedSpecialty} en este momento.</p>
                    </div>
                `;
                return;
            }

            panel.innerHTML = `
                <h3 class="mb-4">Paso 2: Seleccione el Profesional</h3>
                <p class="text-secondary mb-4">Mostrando especialistas en <strong>${selectedSpecialty}</strong>:</p>
                <div class="wizard-grid">
                    ${filteredDocs.map(doc => {
                        const isSelected = selectedDoctor && doc.id === selectedDoctor.id;
                        return `
                            <div class="selector-card doc-card ${isSelected ? 'selected' : ''}" data-id="${doc.id}">
                                <i class="fa-solid fa-user-doctor"></i>
                                <h4>${doc.name}</h4>
                                <p>Matrícula: ${doc.matricula}</p>
                                <small style="font-size: 10px;">${getScheduleSummary(doc)}</small>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;

            panel.querySelectorAll(".doc-card").forEach(card => {
                card.addEventListener("click", async () => {
                    panel.querySelectorAll(".doc-card").forEach(c => c.classList.remove("selected"));
                    card.classList.add("selected");
                    const docId = card.getAttribute("data-id");
                    selectedDoctor = await window.db.getDoctorById(docId);
                    
                    selectedDate = "";
                    selectedTime = "";
                    nextBtn.disabled = false;
                });
            });
        };

        // PASO 3: FECHA Y HORA
        const goToStep3 = async () => {
            updateStepNodes(3);
            const panel = container.querySelector("#wizard-content-panel");
            const backBtn = container.querySelector("#wizard-back-btn");
            const nextBtn = container.querySelector("#wizard-next-btn");

            backBtn.onclick = goToStep2;
            nextBtn.disabled = !selectedTime;
            nextBtn.onclick = goToStep4;

            // Restringir la fecha desde hoy en adelante
            const today = new Date().toISOString().split("T")[0];

            panel.innerHTML = `
                <h3 class="mb-4">Paso 3: Seleccione la Fecha y Horario</h3>
                <div class="row" style="display: flex; gap: 24px; flex-wrap: wrap;">
                    <div class="col-datepicker" style="flex: 1; min-width: 250px;">
                        <div class="form-group">
                            <label for="booking-date">Fecha de Consulta</label>
                            <input type="date" id="booking-date" min="${today}" value="${selectedDate}">
                        </div>
                        <div class="form-group mt-3">
                            <label for="booking-duration">Duración estimada de la consulta</label>
                            <select id="booking-duration" class="form-control">
                                <option value="15">15 minutos</option>
                                <option value="20">20 minutos</option>
                                <option value="30" selected>30 minutos</option>
                                <option value="45">45 minutos</option>
                                <option value="60">60 minutos</option>
                            </select>
                        </div>
                        <div class="doctor-availability-info mt-4" style="background: var(--bg-light); padding: 16px; border-radius: var(--radius-md);">
                            <h5>Horario de Atención del Profesional:</h5>
                            <p class="text-secondary mt-2"><i class="fa-solid fa-circle-info"></i> ${selectedDoctor.name} atiende de ${getScheduleSummary(selectedDoctor)}.</p>
                        </div>
                    </div>
                    <div class="col-slots" style="flex: 1.5; min-width: 300px;">
                        <label>Turnos Disponibles</label>
                        <div id="slots-container" class="slots-grid">
                            <p class="text-muted" style="grid-column: 1/-1;">Por favor, seleccione una fecha para consultar disponibilidad.</p>
                        </div>
                    </div>
                </div>
            `;

            const dateInput = panel.querySelector("#booking-date");
            const durationSelect = panel.querySelector("#booking-duration");
            durationSelect.value = String(selectedDuration);
            const slotsContainer = panel.querySelector("#slots-container");

            const loadSlots = async (dateVal) => {
                slotsContainer.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-muted"></i> Buscando disponibilidad...`;
                try {
                    const slots = await window.db.getDoctorAvailability(selectedDoctor.id, dateVal, selectedDuration);
                    
                    if (slots.length === 0) {
                        slotsContainer.innerHTML = `
                            <div class="alert alert-warning text-center" style="grid-column: 1/-1; background: var(--warning-light); color: var(--warning); padding: 12px; border-radius: var(--radius-md);">
                                <i class="fa-solid fa-triangle-exclamation"></i> El médico no atiende o no tiene disponibilidad para este día de la semana.
                            </div>
                        `;
                        return;
                    }

                    slotsContainer.innerHTML = "";
                    slots.forEach(slot => {
                        const btn = document.createElement("button");
                        btn.className = `slot-btn ${selectedTime === slot.time ? 'selected' : ''}`;
                        btn.textContent = slot.time + " hs";
                        btn.disabled = !slot.available;
                        
                        btn.addEventListener("click", () => {
                            slotsContainer.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("selected"));
                            btn.classList.add("selected");
                            selectedTime = slot.time;
                            nextBtn.disabled = false;
                        });

                        slotsContainer.appendChild(btn);
                    });
                } catch (err) {
                    slotsContainer.innerHTML = `<span class="text-danger">Error: ${err.message}</span>`;
                }
            };

            // Si ya hay fecha seleccionada, cargar slots
            if (selectedDate) {
                await loadSlots(selectedDate);
            }

            dateInput.addEventListener("change", async (e) => {
                selectedDate = e.target.value;
                selectedTime = "";
                nextBtn.disabled = true;
                await loadSlots(selectedDate);
            });

            durationSelect.addEventListener("change", async (e) => {
                selectedDuration = parseInt(e.target.value, 10);
                selectedTime = "";
                nextBtn.disabled = true;
                if (selectedDate) {
                    await loadSlots(selectedDate);
                }
            });
        };

        // PASO 4: CONFIRMACIÓN Y RESERVA
        const goToStep4 = async () => {
            updateStepNodes(4);
            const panel = container.querySelector("#wizard-content-panel");
            const backBtn = container.querySelector("#wizard-back-btn");
            const nextBtn = container.querySelector("#wizard-next-btn");

            backBtn.onclick = goToStep3;
            nextBtn.innerHTML = `<i class="fa-solid fa-calendar-check"></i> Reservar y Finalizar`;
            nextBtn.disabled = false;
            nextBtn.className = "btn btn-success";

            let config = { copayDefault: 0 };
            try {
                const fetchedConfig = await window.db.getSystemConfig();
                if (fetchedConfig) config = fetchedConfig;
            } catch (err) {
                console.warn("No se pudo obtener la configuración del sistema para el copago, usando valor por defecto.");
            }

            const formattedDate = new Date(selectedDate + "T00:00:00").toLocaleDateString('es-AR', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            panel.innerHTML = `
                <h3 class="mb-4">Paso 4: Resumen y Confirmación del Turno</h3>
                <div class="row" style="display: flex; gap: 32px; flex-wrap: wrap;">
                    <div style="flex: 1.5; min-width: 300px;">
                        <div style="background-color: var(--bg-light); border-radius: var(--radius-lg); padding: 24px; border: 1px solid var(--border-color);">
                            <div class="d-flex" style="display: flex; gap: 16px; margin-bottom: 20px;">
                                <div class="avatar" style="width: 48px; height: 48px; background: var(--primary-teal-light); color: var(--primary-teal); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700;">
                                    ${selectedDoctor.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 style="font-weight: 700;">${selectedDoctor.name}</h4>
                                    <p class="text-secondary" style="font-size: 14px;">${selectedSpecialty} | Matrícula: ${selectedDoctor.matricula}</p>
                                </div>
                            </div>
                            <hr style="border: none; border-top: 1px solid var(--border-color); margin: 20px 0;">
                            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 15px;">
                                <p><strong><i class="fa-regular fa-calendar-days text-muted mr-2"></i> Fecha:</strong> <span style="text-transform: capitalize;">${formattedDate}</span></p>
                                <p><strong><i class="fa-regular fa-clock text-muted mr-2"></i> Horario:</strong> ${selectedTime} hs</p>
                                <p><strong><i class="fa-solid fa-hourglass-half text-muted mr-2"></i> Duración estimada:</strong> ${selectedDuration} minutos</p>
                                <p><strong><i class="fa-solid fa-hospital-user text-muted mr-2"></i> Paciente:</strong> ${patient.name} (DNI ${patient.dni})</p>
                            </div>
                        </div>
                    </div>
                    
                    <div style="flex: 1; min-width: 250px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div style="background: var(--primary-teal-light); border: 1px solid var(--primary-teal); padding: 20px; border-radius: var(--radius-md);">
                            <h5 style="color: var(--primary-teal); font-weight: 700; display: flex; justify-content: space-between;">
                                <span>Copago Administrativo</span>
                                <span>$${config.copayDefault}</span>
                            </h5>
                            <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                                Copago correspondiente a la cobertura de atención primaria de Salud Goya. Podrá ser abonado en administración al momento de asistir.
                            </p>
                        </div>
                        <div class="mt-3" style="background: #fff; border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-md);">
                            <label style="font-weight:600;">Pago del turno</label>
                            <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
                                <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="booking-paid-checkbox"> Pagar ahora</label>
                            </div>
                            <div style="margin-top:8px;">
                                <label for="booking-payment-method">Método de Pago</label>
                                <select id="booking-payment-method" class="form-control">
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Tarjeta">Tarjeta</option>
                                    <option value="Transferencia">Transferencia</option>
                                </select>
                            </div>
                        </div>
                        <div class="mt-4" style="background: var(--warning-light); border: 1px dashed var(--warning); padding: 12px; border-radius: var(--radius-md); font-size: 12px; color: hsl(38, 92%, 30%);">
                            <i class="fa-solid fa-circle-exclamation"></i> <strong>Recuerda:</strong> Si no asistes al turno y no cancelas con anticipación, acumularás una inasistencia. 3 inasistencias resultan en la suspensión de tu cuenta.
                        </div>
                    </div>
                </div>
            `;

            // Confirmar Acción
            nextBtn.onclick = async () => {
                app.setBtnLoading(nextBtn, true);

                try {
                    // Leer opciones de pago seleccionadas en el resumen
                    const paidCheckbox = document.getElementById('booking-paid-checkbox');
                    const paymentMethodSelect = document.getElementById('booking-payment-method');
                    const paid = paidCheckbox ? paidCheckbox.checked : false;
                    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : '';

                    await window.db.createAppointment({
                        patientId: patient.id || patient.uid,
                        doctorId: selectedDoctor.id,
                        doctorName: selectedDoctor.name,
                        specialty: selectedSpecialty,
                        date: selectedDate,
                        time: selectedTime,
                        duration: selectedDuration,
                        paid,
                        paymentMethod
                    });

                    app.showToast("¡Turno reservado exitosamente! Recibirás un correo electrónico de confirmación.", "success");
                    await app.updateNotificationBell();
                    app.navigateTo("dashboard");
                } catch (err) {
                    app.showToast(err.message, "error");
                    app.setBtnLoading(nextBtn, false);
                }
            };
        };

        // Renderizar por primera vez
        renderWizard();
    });

    // 3. HISTORIAL CLÍNICO DEL PACIENTE
    app.registerView("historial", async (container) => {
        const patient = app.currentUser;
        if (!patient) return renderNoSession(container);

        const history = await window.db.getMedicalHistoryByPatient(patient.id);

        let html = `
            <div class="card">
                <div class="card-title">
                    <span>Historial de Consultas Médicas</span>
                    <i class="fa-solid fa-clock-rotate-left text-muted"></i>
                </div>
        `;

        if (history.length === 0) {
            html += `
                <div class="text-center p-5 text-muted">
                    <i class="fa-solid fa-folder-open fa-3x mb-3"></i>
                    <p>No posees registros médicos cargados en el sistema aún.</p>
                </div>
            `;
        } else {
            // Ordenar de más reciente a más antiguo
            history.sort((a, b) => new Date(b.date) - new Date(a.date));

            html += `
                <div class="history-timeline" style="margin-top: 20px;">
                    ${history.map(record => {
                        const formattedDate = new Date(record.date + "T00:00:00").toLocaleDateString('es-AR', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        });
                        return `
                            <div class="history-item animate__animated animate__fadeIn">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                                    <div>
                                        <h4 style="font-weight: 700; color: var(--text-primary); text-transform: capitalize;">${formattedDate}</h4>
                                        <p class="text-secondary" style="font-size: 14px;"><i class="fa-solid fa-user-md"></i> ${record.doctorName}</p>
                                    </div>
                                    <button class="btn btn-outline-primary btn-sm btn-view-history-detail" data-id="${record.id}">
                                        <i class="fa-solid fa-magnifying-glass-plus"></i> Ver Detalle y Recetas
                                    </button>
                                </div>
                                <div style="margin-top: 12px; background-color: var(--bg-light); border-radius: var(--radius-md); padding: 14px;">
                                    <p><strong>Diagnóstico:</strong> ${record.diagnostic}</p>
                                    <p class="text-secondary mt-1"><strong>Indicaciones:</strong> ${record.indications.substring(0, 80)}...</p>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;

        // Registrar eventos para el modal detallado
        container.querySelectorAll(".btn-view-history-detail").forEach(btn => {
            btn.addEventListener("click", () => {
                const recordId = btn.getAttribute("data-id");
                const record = history.find(h => h.id === recordId);
                if (record) {
                    showHistoryModal(record);
                }
            });
        });
    });
});

// Helper de Renderizar pantalla sin Sesión
function renderNoSession(container) {
    container.innerHTML = `
        <div class="card p-5 text-center">
            <i class="fa-solid fa-user-lock fa-4x text-muted mb-4"></i>
            <h2>Acceso Restringido</h2>
            <p class="text-secondary mt-2">Debes iniciar sesión con tu cuenta de paciente para poder ver tu información clínica.</p>
            <button class="btn btn-primary mt-4" onclick="app.openModal('auth-modal')"><i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión / Registrarse</button>
        </div>
    `;
}

// Iconos por especialidad
function getSpecialtyIcon(specName) {
    const icons = {
        "Clínica Médica": "fa-user-doctor",
        "Pediatría": "fa-baby",
        "Cardiología": "fa-heart-pulse",
        "Traumatología": "fa-bone",
        "Ginecología": "fa-venus",
        "Dermatología": "fa-hand-dots"
    };
    return icons[specName] || "fa-stethoscope";
}

// Convertir array de días de la semana a String
function getScheduleSummary(doc) {
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const daysStr = doc.workDays.map(d => dayNames[d]).join(", ");
    return `${daysStr} | ${doc.workHours.start} - ${doc.workHours.end} hs`;
}

// Muestra el Modal con detalle e impresión de Receta
function showHistoryModal(record) {
    const content = document.getElementById("history-detail-content");
    const formattedDate = new Date(record.date + "T00:00:00").toLocaleDateString('es-AR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    let attachmentsHtml = "<p class='text-muted' style='font-size: 13px;'>No se adjuntaron estudios complementarios.</p>";
    if (record.attachments && record.attachments.length > 0) {
        attachmentsHtml = record.attachments.map(att => `
            <div style="background: var(--bg-light); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                <span style="font-size: 13px;"><i class="fa-regular fa-file-pdf text-danger"></i> ${att.name} (${att.size})</span>
                <a href="#" class="btn btn-secondary btn-sm" onclick="app.showToast('Descargando archivo...', 'info')"><i class="fa-solid fa-download"></i> Descargar</a>
            </div>
        `).join("");
    }

    let recipeHtml = "<p class='text-muted' style='font-size: 13px;'>Esta consulta no requirió prescripción de medicamentos.</p>";
    if (record.recipe) {
        recipeHtml = `
            <div style="border: 2px dashed var(--primary-teal); background-color: var(--primary-teal-light); padding: 20px; border-radius: var(--radius-md); position: relative; margin-top: 10px;">
                <div style="position: absolute; top: 12px; right: 12px; opacity: 0.1; font-size: 40px; color: var(--primary-teal);"><i class="fa-solid fa-prescription"></i></div>
                <h6 style="color: var(--primary-teal); font-weight: 700; border-bottom: 1px solid var(--primary-teal); padding-bottom: 6px; font-size: 14px;">RECETA DIGITAL DE SALUD GOYA</h6>
                <div style="margin-top: 10px; font-family: monospace; font-size: 13px; color: var(--text-primary);">
                    <p><strong>Rp.</strong></p>
                    <p style="margin-left: 20px; margin-top: 4px;">- ${record.indications}</p>
                </div>
                <div style="margin-top: 20px; text-align: right; font-size: 11px;">
                    <p><strong>Firma y Sello Digital</strong></p>
                    <p>${record.doctorName}</p>
                </div>
                <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
                    <button class="btn btn-primary btn-sm" id="btn-download-recipe-pdf">
                        <i class="fa-solid fa-file-arrow-down"></i> Descargar PDF Receta
                    </button>
                </div>
            </div>
        `;
    }

    content.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <div style="background-color: var(--bg-light); padding: 16px; border-radius: var(--radius-md);">
                <p><strong>Paciente:</strong> ${record.patientName}</p>
                <p><strong>Profesional:</strong> ${record.doctorName}</p>
                <p><strong>Fecha de Atención:</strong> <span style="text-transform: capitalize;">${formattedDate}</span></p>
            </div>
            
            <div>
                <h5 style="font-weight: 700; margin-bottom: 8px; font-size: 15px;"><i class="fa-solid fa-stethoscope text-muted"></i> Diagnóstico Médico</h5>
                <p>${record.diagnostic}</p>
            </div>
            
            <div>
                <h5 style="font-weight: 700; margin-bottom: 8px; font-size: 15px;"><i class="fa-solid fa-notes-medical text-muted"></i> Observaciones de la Consulta</h5>
                <p class="text-secondary">${record.observations}</p>
            </div>

            <div>
                <h5 style="font-weight: 700; margin-bottom: 8px; font-size: 15px;"><i class="fa-solid fa-prescription-bottle-medical text-muted"></i> Recetas y Órdenes Digitales</h5>
                ${recipeHtml}
            </div>

            <div>
                <h5 style="font-weight: 700; margin-bottom: 8px; font-size: 15px;"><i class="fa-solid fa-paperclip text-muted"></i> Estudios y Archivos Adjuntos</h5>
                ${attachmentsHtml}
            </div>
        </div>
        
        <div class="modal-actions" style="margin-top: 24px; border-top: 1px solid var(--border-color); padding-top: 16px;">
            <button class="btn btn-secondary" onclick="app.closeModal('history-detail-modal')">Cerrar Ventana</button>
            <button class="btn btn-info" onclick="window.print()"><i class="fa-solid fa-print"></i> Imprimir Registro</button>
        </div>
    `;

    app.openModal("history-detail-modal");

    // Evento de descarga real de PDF
    const downloadBtn = document.getElementById("btn-download-recipe-pdf");
    if (downloadBtn) {
        downloadBtn.onclick = () => downloadRecipePDF(record);
    }

    // Registrar cierre de modal
    document.getElementById("history-close-btn").onclick = () => {
        app.closeModal("history-detail-modal");
    };
}

/**
 * Genera y descarga un PDF real usando jsPDF
 */
function downloadRecipePDF(record) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // -- ENCABEZADO --
    doc.setFillColor(33, 150, 243); // Azul
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("SALUD GOYA", 15, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Portal del Paciente - Receta Digital", 15, 30);
    doc.text(new Date().toLocaleDateString(), pageWidth - 40, 20);

    // -- CUERPO --
    doc.setTextColor(40, 40, 40);

    // Datos del Paciente
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL PACIENTE", 15, 55);
    doc.setLineWidth(0.5);
    doc.line(15, 57, 70, 57);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Nombre: ${record.patientName}`, 15, 65);
    doc.text(`Fecha de Atención: ${record.date}`, 15, 72);

    // Datos del Médico
    doc.setFont("helvetica", "bold");
    doc.text("PROFESIONAL", 120, 55);
    doc.line(120, 57, 160, 57);
    doc.setFont("helvetica", "normal");
    doc.text(`Dr/a. ${record.doctorName}`, 120, 65);

    // Diagnóstico
    doc.setFont("helvetica", "bold");
    doc.text("DIAGNÓSTICO:", 15, 90);
    doc.setFont("helvetica", "normal");
    doc.text(record.diagnostic || "No especificado", 50, 90);

    // Prescripción (Rp)
    doc.setDrawColor(200, 200, 200);
    doc.rect(15, 100, pageWidth - 30, 80);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Rp.", 20, 110);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    // Manejo de texto largo en indicaciones
    const splitIndications = doc.splitTextToSize(record.indications || "Sin indicaciones adicionales.", pageWidth - 40);
    doc.text(splitIndications, 25, 120);

    // -- FIRMA --
    doc.setFontSize(10);
    doc.text("__________________________", pageWidth - 70, 200);
    doc.text("Firma y Sello Digital", pageWidth - 65, 205);
    doc.text(`Dr/a. ${record.doctorName}`, pageWidth - 65, 210);

    // Pie de página
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Este documento es una receta digital válida generada por el sistema Salud Goya.", pageWidth / 2, 280, { align: "center" });

    // Descargar
    doc.save(`Receta_${record.patientName.replace(/\s+/g, '_')}_${record.date}.pdf`);
    app.showToast("PDF generado y descargado correctamente", "success");
}
