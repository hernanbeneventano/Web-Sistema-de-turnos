/**
 * SALUD GOYA - Controlador Principal SPA (app.js)
 * Maneja el enrutamiento, sesión activa, notificaciones y sincronización del Simulador de Roles.
 */

const app = {
    currentRole: "patient", // patient, doctor, admin
    currentUser: null,       // Objeto de usuario activo (Paciente o Médico o Admin)
    activeView: "dashboard", // ID de la vista activa

    // Vistas registradas por los componentes correspondientes
    views: {},

    init: async function() {
        // Iniciado
        
        // 1. Inicializar base de datos
        await window.db.init();

        // 2. Vincular elementos globales del DOM
        this.bindEvents();

        // 3. Inicializar Simulador de Roles (si existe en el DOM - en producción puede estar removido)
        this.initSimulator();

        // 4. Configurar escuchas de autenticación en Firebase
        if (window.firebaseEnabled && window.auth) {
            window.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    // Usuario Firebase detectado
                    try {
                            // Obtener perfil desde Firestore o crear uno por defecto
                            const userDoc = await window.firestore.collection("users").doc(user.uid).get();
                            let profile;
                            try {
                                const idTokenResult = await user.getIdTokenResult(true);
                                const tokenClaims = idTokenResult && idTokenResult.claims ? idTokenResult.claims : {};

                                if (userDoc.exists) {
                                    profile = userDoc.data();
                                    // Sincronizar role desde claims si difiere
                                    if (tokenClaims.role && profile.role !== tokenClaims.role) {
                                        try {
                                            profile.role = tokenClaims.role;
                                            await window.firestore.collection('users').doc(user.uid).update({ role: tokenClaims.role });
                                        } catch (err) {
                                            console.warn('No se pudo sincronizar role desde custom claim al perfil:', err);
                                        }
                                    }
                                } else {
                                    // Si este usuario acaba de registrarse por la ruta de registro,
                                    // evitar sobrescribir el perfil que el flujo de registro va a crear.
                                    if (this._justRegistered && this._justRegistered === user.uid) {
                                        // evitar sobrescribir el perfil creado en el flujo de registro
                                    } else {
                                        // Crear perfil por defecto usando role inferido desde claims si existe
                                        const inferredRole = tokenClaims.role || 'patient';
                                        profile = {
                                            id: user.uid,
                                            name: user.displayName || user.email.split("@")[0],
                                            email: user.email,
                                            dni: "Sin DNI",
                                            phone: "",
                                            absences: 0,
                                            status: "Activo",
                                            role: inferredRole,
                                            suspensionEnd: null,
                                            suspensionReason: null
                                        };
                                        try {
                                            await window.firestore.collection("users").doc(user.uid).set(profile);
                                        } catch (err) {
                                            console.error('Error al crear perfil por defecto en Firestore:', err);
                                        }
                                    }
                                }

                                // No iniciar sesión automáticamente; (banner eliminado)
                            } catch (err) {
                                console.error('Error procesando token/claims:', err);
                                this.showToast('Error al cargar perfil de usuario.', 'error');
                            }
                    } catch (e) {
                        console.error("Error al cargar perfil de Firestore:", e);
                        this.showToast("Error al cargar perfil de usuario.", "error");
                    }
                } else {
                    if (this.simulatedMode) {
                        // Continuar en modo simulación local
                        await this.syncSession();
                    } else {
                        // Mostrar pantalla de inicio de sesión
                        this.currentUser = null;
                        document.getElementById("auth-page").classList.add("active");
                        this.updateProfileUI();
                    }
                }
            });
        } else {
            // Modo local: Cargar sesión inicial del simulador
            await this.syncSession();
        }

        // 5. Cargar notificaciones iniciales en la campana
        await this.updateNotificationBell();

        // (connectivity check removed)

        // 6. Si la URL contiene un token de invitación, preseleccionar formulario de registro
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const inviteToken = urlParams.get('invite');
            if (inviteToken && window.firebaseEnabled && window.firestore) {
                try {
                    const invSnap = await window.firestore.collection('invitations').doc(inviteToken).get();
                    if (invSnap.exists) {
                        const inv = invSnap.data();
                        if (!inv.used) {
                            // Mostrar la pestaña de registro (vista de página) y prellenar campos
                            this.switchPageAuthTab('register');
                            const nameEl = document.getElementById('page-reg-name');
                            const emailEl = document.getElementById('page-reg-email');
                            const phoneEl = document.getElementById('page-reg-phone');
                            const dniEl = document.getElementById('page-reg-dni');
                            if (nameEl && inv.name) nameEl.value = inv.name;
                            if (emailEl && inv.email) emailEl.value = inv.email;
                            if (phoneEl && inv.phone) phoneEl.value = inv.phone;
                            if (dniEl && inv.dni) dniEl.value = inv.dni;
                            this.showToast('Invitación detectada: complete la contraseña para finalizar el registro.', 'info');
                        }
                    }
                } catch (err) {
                    console.warn('Error leyendo invitación en init:', err);
                }
            }
        } catch (err) {
            // no bloquear si falla URL parsing
        }
    },

    bindEvents: function() {
        // Campana de notificaciones
        const bell = document.getElementById("notif-bell-btn");
        const notifSidebar = document.getElementById("notification-sidebar");
        const notifClose = document.getElementById("notif-close-btn");

        bell.addEventListener("click", async () => {
            notifSidebar.classList.toggle("active");
            if (notifSidebar.classList.contains("active")) {
                await this.renderNotificationList();
            }
        });

        notifClose.addEventListener("click", () => {
            notifSidebar.classList.remove("active");
        });

        // Cerrar modales genéricos al hacer clic en fondo
        document.querySelectorAll(".modal-overlay").forEach(modal => {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Botón de cerrar modal de auth
        document.getElementById("auth-close-btn").addEventListener("click", () => {
            this.closeModal("auth-modal");
        });

        // Botones con atributo data-close (cerrar modales genéricos)
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-close');
                if (target) this.closeModal(target);
            });
        });

        // Tabs de Auth
        document.getElementById("tab-login-btn").addEventListener("click", () => this.switchAuthTab("login"));
        document.getElementById("tab-register-btn").addEventListener("click", () => this.switchAuthTab("register"));

        // Forms de Auth
        document.getElementById("login-form").addEventListener("submit", (e) => this.handleLogin(e));
        document.getElementById("register-form").addEventListener("submit", (e) => this.handleRegister(e));

        // Eventos para la pantalla de Login y Registro Profesional (Firebase)
        document.getElementById("page-tab-login").addEventListener("click", () => this.switchPageAuthTab("login"));
        document.getElementById("page-tab-register").addEventListener("click", () => this.switchPageAuthTab("register"));

        document.getElementById("page-login-form").addEventListener("submit", (e) => this.handlePageLogin(e));
        document.getElementById("page-register-form").addEventListener("submit", (e) => this.handlePageRegister(e));

        // Bypass a modo simulador eliminado en producción
    },

    // ==========================================
    // MANEJO DE SIMULADOR DE ROLES (PROBADOR)
    // ==========================================
    initSimulator: function() {
        const roleSelect = document.getElementById("sim-role-select");
        if (!roleSelect) return; // simulador UI removido en producción

        const userSelect = document.getElementById("sim-user-select");
        const resetBtn = document.getElementById("sim-reset-db");

        // Evento de cambio de rol
        roleSelect.addEventListener("change", async (e) => {
            this.currentRole = e.target.value;
            await this.populateSimulatorUsers();
            await this.syncSession();
        });

        // Evento de cambio de usuario
        if (userSelect) {
            userSelect.addEventListener("change", async (e) => {
                await this.syncSession(e.target.value);
            });
        }

        // Evento resetear base de datos
        if (resetBtn) {
            resetBtn.addEventListener("click", async () => {
                if (confirm("¿Seguro que deseas reiniciar la base de datos local a sus valores de fábrica? Perderás todos tus cambios.")) {
                    await window.db.reset();
                    this.showToast("Base de datos local reestablecida correctamente.", "warning");
                    setTimeout(() => window.location.reload(), 1000);
                }
            });
        }

        // Poblado inicial de usuarios
        this.populateSimulatorUsers();
    },

    populateSimulatorUsers: async function() {
        const userSelect = document.getElementById("sim-user-select");
        const userGroup = document.getElementById("sim-user-group");
        if (!userSelect || !userGroup) return; // nothing to populate when simulator removed

        userSelect.innerHTML = "";

        if (this.currentRole === "admin") {
            userGroup.style.display = "none";
            return;
        }

        userGroup.style.display = "flex";

        if (this.currentRole === "patient") {
            const patients = await window.db.getPatients();
            patients.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.textContent = `${p.name} (DNI ${p.dni}) - ${p.status}`;
                userSelect.appendChild(opt);
            });
        } else if (this.currentRole === "doctor") {
            const doctors = await window.db.getDoctors();
            doctors.forEach(d => {
                const opt = document.createElement("option");
                opt.value = d.id;
                opt.textContent = `${d.name} (${d.specialty})`;
                userSelect.appendChild(opt);
            });
        }
    },

    // Sincroniza la sesión activa del usuario a partir del simulador o ID
    syncSession: async function(userId = null) {
        if (this.currentRole === "admin") {
            this.currentUser = {
                id: "admin_1",
                name: "Administrador General",
                role: "admin",
                email: "admin@saludgoya.com"
            };
            this.activeView = "dashboard_admin";
        } else {
            const userSelect = document.getElementById("sim-user-select");
            const activeId = userId || (userSelect ? userSelect.value : null);

            if (this.currentRole === "patient") {
                this.currentUser = activeId ? await window.db.getPatientById(activeId) : null;
                if (!this.currentUser && userSelect && userSelect.value) {
                    this.currentUser = await window.db.getPatientById(userSelect.value);
                }
                this.activeView = "dashboard";
            } else if (this.currentRole === "doctor") {
                this.currentUser = activeId ? await window.db.getDoctorById(activeId) : null;
                if (!this.currentUser && userSelect && userSelect.value) {
                    this.currentUser = await window.db.getDoctorById(userSelect.value);
                }
                this.activeView = "agenda";
            }
        }

        // Ocultar pantalla de auth si se está en simulación
        document.getElementById("auth-page").classList.remove("active");

        // Actualizar componentes visuales de la sesión
        this.updateProfileUI();

        // Regenerar sidebar de navegación
        this.renderSidebarNav();

        // Cargar la vista predeterminada
        await this.navigateTo(this.activeView);
    },

    // ==========================================
    // MANEJO DE INTERFAZ DEL USUARIO (SESSION)
    // ==========================================
    updateProfileUI: function() {
        const headerUserName = document.getElementById("header-user-name");
        const headerAvatar = document.getElementById("header-avatar");
        const sidebarProfile = document.getElementById("sidebar-user-profile");

        if (!this.currentUser) {
            headerUserName.textContent = "Invitado";
            headerAvatar.textContent = "I";
            sidebarProfile.innerHTML = `
                <div class="user-info">
                    <span class="user-name">Sin Sesión Activa</span>
                    <span class="user-role">Por favor inicia sesión</span>
                </div>
            `;
            return;
        }

        // Header Superior
        headerUserName.textContent = this.currentUser.name;
        headerAvatar.textContent = this.currentUser.name.charAt(0).toUpperCase();

        // Footer del Sidebar
        const roleLabels = { patient: "Paciente", doctor: "Médico", admin: "Administrador" };
        const displayRole = roleLabels[this.currentUser.role || this.currentRole] || "Rol";

        sidebarProfile.innerHTML = `
            <div class="avatar">${this.currentUser.name.charAt(0).toUpperCase()}</div>
            <div class="user-info" style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; flex-direction: column;">
                    <span class="user-name" title="${this.currentUser.name}">${this.currentUser.name}</span>
                    <span class="user-role">${displayRole}</span>
                </div>
                <a id="btn-logout" style="color: hsla(0, 0%, 100%, 0.6); cursor: pointer; padding: 4px; font-size: 16px; transition: var(--transition-fast);" title="Cerrar Sesión">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </a>
            </div>
        `;

        // Registrar evento logout
        setTimeout(() => {
            const logoutBtn = document.getElementById("btn-logout");
            if (logoutBtn) {
                logoutBtn.addEventListener("click", () => this.handleLogout());
                logoutBtn.addEventListener("mouseenter", () => logoutBtn.style.color = "var(--danger)");
                logoutBtn.addEventListener("mouseleave", () => logoutBtn.style.color = "hsla(0, 0%, 100%, 0.6)");
            }
        }, 100);
    },

    // Helper: activa la sesión cuando el usuario decide continuar
    _activateSession: async function(profile, firebaseUser) {
        this.currentUser = profile;
        this.currentRole = profile.role || 'patient';

        const roleSelect = document.getElementById('sim-role-select');
        if (roleSelect) roleSelect.value = this.currentRole;
        await this.populateSimulatorUsers();
        const userSelect = document.getElementById('sim-user-select');
        if (userSelect) userSelect.value = profile.id;

        this.activeView = this.currentRole === 'patient' ? 'dashboard' : this.currentRole === 'doctor' ? 'agenda' : 'dashboard_admin';
        document.getElementById('auth-page').classList.remove('active');
        this.updateProfileUI();
        this.renderSidebarNav();
        await this.navigateTo(this.activeView);
        await this.updateNotificationBell();
        // Remove any detected banner
        const banner = document.getElementById('detected-session-banner');
        if (banner && banner.parentElement) banner.remove();
    },

    _showDetectedSessionBanner: function(profile, firebaseUser) {
        // Banner eliminado: no-op
        return;

    },

    renderSidebarNav: function() {
        const navList = document.getElementById("nav-list");
        navList.innerHTML = "";

        const navItems = {
            patient: [
                { id: "dashboard", label: "Mis Turnos", icon: "fa-calendar-check" },
                { id: "reservar", label: "Reservar Turno", icon: "fa-calendar-plus" },
                { id: "historial", label: "Historial Médico", icon: "fa-notes-medical" }
            ],
            doctor: [
                { id: "agenda", label: "Mi Agenda", icon: "fa-stethoscope" },
                { id: "config_doctor", label: "Configurar Horarios", icon: "fa-clock" }
            ],
            admin: [
                { id: "dashboard_admin", label: "Panel Principal", icon: "fa-chart-pie" },
                { id: "medicos", label: "Médicos", icon: "fa-user-md" },
                { id: "especialidades", label: "Especialidades", icon: "fa-tags" },
                { id: "turnos", label: "Supervisar Turnos", icon: "fa-list-check" },
                { id: "notificaciones", label: "Alertas y Notificaciones", icon: "fa-envelope-open-text" }
            ]
        };

        const items = navItems[this.currentRole] || [];

        items.forEach(item => {
            const li = document.createElement("li");
            li.className = `nav-item ${this.activeView === item.id ? 'active' : ''}`;
            li.innerHTML = `
                <a data-view="${item.id}">
                    <i class="fa-solid ${item.icon}"></i>
                    <span>${item.label}</span>
                </a>
            `;
            li.querySelector("a").addEventListener("click", () => {
                this.navigateTo(item.id);
            });
            navList.appendChild(li);
        });
    },

    // ==========================================
    // ENRUTAMIENTO (SPA VIEW CONTROLLER)
    // ==========================================
    registerView: function(viewId, renderFn) {
        this.views[viewId] = renderFn;
    },

    navigateTo: async function(viewId) {
        // CONTROL DE AUTORIZACIÓN BASADO EN ROLES
        const rolePermissions = {
            patient: ["dashboard", "reservar", "historial"],
            doctor: ["agenda", "config_doctor"],
            admin: ["dashboard_admin", "medicos", "especialidades", "turnos", "notificaciones"]
        };

        const activeRole = this.currentUser ? this.currentUser.role : this.currentRole;
        const allowedViews = rolePermissions[activeRole] || [];

        if (this.currentUser && !allowedViews.includes(viewId)) {
            console.warn(`SALUD GOYA: Acceso denegado a la vista ${viewId} para el rol ${activeRole}.`);
            const defaultView = activeRole === "patient" ? "dashboard" : 
                                activeRole === "doctor" ? "agenda" : "dashboard_admin";
            return this.navigateTo(defaultView);
        }

        this.activeView = viewId;
        
        // Actualizar item activo en el sidebar
        document.querySelectorAll(".nav-item").forEach(item => {
            const link = item.querySelector("a");
            if (link && link.getAttribute("data-view") === viewId) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        // Configurar título de la cabecera
        const titles = {
            dashboard: "Mis Turnos Programados",
            reservar: "Solicitar Nuevo Turno",
            historial: "Mi Historial Clínico",
            agenda: "Agenda Médica de Consultas",
            config_doctor: "Configuración de Horarios de Atención",
            dashboard_admin: "Panel de Gestión General",
            medicos: "Administración de Médicos",
            especialidades: "Gestión de Especialidades",
            turnos: "Supervisión de Turnos Clínicos",
            notificaciones: "Consola de Notificaciones y Sanciones"
        };
        
        document.getElementById("view-title").textContent = titles[viewId] || "Dashboard";

        // Renderizar la vista correspondiente
        const contentContainer = document.getElementById("content-body");
        contentContainer.innerHTML = `<div class="d-flex justify-content-center p-5"><i class="fa-solid fa-circle-notch fa-spin fa-2x text-muted"></i></div>`;

        if (this.views[viewId]) {
            try {
                await this.views[viewId](contentContainer);
            } catch (err) {
                console.error("Error al renderizar vista " + viewId, err);
                contentContainer.innerHTML = `
                    <div class="card p-4 text-center">
                        <i class="fa-solid fa-triangle-exclamation fa-3x text-danger mb-3"></i>
                        <h3>Error al Cargar la Vista</h3>
                        <p class="text-secondary">${err.message}</p>
                    </div>
                `;
            }
        } else {
            contentContainer.innerHTML = `
                <div class="card p-4 text-center">
                    <i class="fa-solid fa-circle-question fa-3x text-warning mb-3"></i>
                    <h3>Vista en Construcción</h3>
                    <p class="text-secondary">El componente "${viewId}" no se encuentra registrado en el SPA.</p>
                </div>
            `;
        }
    },

    // ==========================================
    // NOTIFICACIONES TOAST & SYSTEM BELL
    // ==========================================
    showToast: function(message, type = "info") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;

        const icons = {
            success: "fa-circle-check",
            error: "fa-circle-xmark",
            warning: "fa-triangle-exclamation",
            info: "fa-circle-info"
        };

        toast.innerHTML = `
            <i class="fa-solid ${icons[type] || 'fa-bell'}"></i>
            <div class="toast-message">${message}</div>
            <button class="toast-close">&times;</button>
        `;

        // Cerrar toast
        const closeBtn = toast.querySelector(".toast-close");
        closeBtn.addEventListener("click", () => {
            toast.style.animation = "fadeOut 0.2s ease forwards";
            setTimeout(() => toast.remove(), 200);
        });

        container.appendChild(toast);

        // Auto-eliminar después de 4.5 segundos
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = "fadeOut 0.2s ease forwards";
                setTimeout(() => toast.remove(), 200);
            }
        }, 4500);
    },

    updateNotificationBell: async function() {
        const logs = await window.db.getNotifications();
        const countBadge = document.getElementById("notif-count");
        // Contar las notificaciones enviadas hoy
        countBadge.textContent = logs.length > 9 ? "9+" : logs.length;
    },

    renderNotificationList: async function() {
        const container = document.getElementById("notif-list-container");
        container.innerHTML = "";
        
        const logs = await window.db.getNotifications();
        if (logs.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted p-4">
                    <i class="fa-regular fa-envelope fa-2x mb-2"></i>
                    <p>No hay notificaciones registradas.</p>
                </div>
            `;
            return;
        }

        logs.forEach(log => {
            const item = document.createElement("div");
            item.className = "notif-item";
            
            const isEmail = log.type === "Correo";
            const typeClass = isEmail ? "correo" : "whatsapp";
            const icon = isEmail ? "fa-envelope" : "fa-whatsapp";
            const formattedDate = new Date(log.date).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });

            item.innerHTML = `
                <div class="notif-meta">
                    <span class="notif-type ${typeClass}">
                        <i class="fa-solid ${icon}"></i> ${log.type}
                    </span>
                    <span class="notif-date">${formattedDate}</span>
                </div>
                <div class="notif-dest">Para: ${log.recipient}</div>
                <div class="notif-msg">${log.message}</div>
            `;
            container.appendChild(item);
        });
    },

    // ==========================================
    // MODALES GENERALES
    // ==========================================
    openModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add("active");
            document.body.style.overflow = "hidden"; // Desactivar scroll
        }
    },

    closeModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove("active");
            document.body.style.overflow = ""; // Reactivar scroll
        }
    },

    // Gestión del Modal Auth (Login/Registro)
    switchAuthTab: function(tabName) {
        const loginBtn = document.getElementById("tab-login-btn");
        const registerBtn = document.getElementById("tab-register-btn");
        const loginForm = document.getElementById("login-form");
        const registerForm = document.getElementById("register-form");

        if (tabName === "login") {
            loginBtn.classList.add("active");
            registerBtn.classList.remove("active");
            loginForm.classList.add("active");
            registerForm.classList.remove("active");
        } else {
            loginBtn.classList.remove("active");
            registerBtn.classList.add("active");
            loginForm.classList.remove("active");
            registerForm.classList.add("active");
        }
    },

    handleLogin: async function(e) {
        e.preventDefault();
        const dni = document.getElementById("login-dni").value.trim();
        
        try {
            const patient = await window.db.getPatientByDni(dni);
            if (patient) {
                this.currentUser = patient;
                this.currentRole = "patient";
                
                // Forzar sincronía en el simulador (si la UI del simulador existe)
                const roleSelect = document.getElementById("sim-role-select");
                if (roleSelect) {
                    roleSelect.value = "patient";
                    await this.populateSimulatorUsers();
                    const userSelect = document.getElementById("sim-user-select");
                    if (userSelect) userSelect.value = patient.id;
                }

                await this.syncSession(patient.id);
                this.closeModal("auth-modal");
                this.showToast(`Bienvenido de nuevo, ${patient.name}.`, "success");
            } else {
                this.showToast("DNI no registrado como paciente en el sistema.", "error");
            }
        } catch (err) {
            this.showToast(err.message, "error");
        }
    },

    handleRegister: async function(e) {
        e.preventDefault();
        const name = document.getElementById("reg-name").value.trim();
        const dni = document.getElementById("reg-dni").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const phone = document.getElementById("reg-phone").value.trim();

        try {
            const newPat = await window.db.savePatient({
                name, dni, email, phone
            });

            // Registrar notificación de bienvenida
            await window.db.createNotification({
                type: "Correo",
                recipient: email,
                message: `Bienvenido a SALUD GOYA, ${name}. Su cuenta de portal médico ha sido creada exitosamente. Su usuario de acceso es su DNI: ${dni}.`
            });

            this.showToast("Registro completado. Bienvenido!", "success");
            
            // Forzar login
            this.currentUser = newPat;
            this.currentRole = "patient";

            // Sincronizar selectores del simulador (si existe)
            const roleSelect = document.getElementById("sim-role-select");
            if (roleSelect) {
                roleSelect.value = "patient";
                await this.populateSimulatorUsers();
                const userSelect = document.getElementById("sim-user-select");
                if (userSelect) userSelect.value = newPat.id;
            }

            await this.syncSession(newPat.id);
            this.closeModal("auth-modal");
            await this.updateNotificationBell();
        } catch (err) {
            this.showToast(err.message, "error");
        }
    },

    // ==========================================
    // METODOS DE LA NUEVA PANTALLA DE AUTH
    // ==========================================
    switchPageAuthTab: function(tabName) {
        const loginBtn = document.getElementById("page-tab-login");
        const registerBtn = document.getElementById("page-tab-register");
        const loginForm = document.getElementById("page-login-form");
        const registerForm = document.getElementById("page-register-form");
        const title = document.getElementById("auth-page-title");
        const subtitle = document.getElementById("auth-page-subtitle");

        if (tabName === "login") {
            loginBtn.classList.add("active");
            registerBtn.classList.remove("active");
            loginForm.classList.add("active");
            registerForm.classList.remove("active");
            title.textContent = "Iniciar Sesión";
            subtitle.textContent = "Ingresá tus credenciales para acceder al portal";
        } else {
            loginBtn.classList.remove("active");
            registerBtn.classList.add("active");
            loginForm.classList.remove("active");
            registerForm.classList.add("active");
            title.textContent = "Crear Cuenta";
            subtitle.textContent = "Completá tus datos para registrarte en el portal";
        }
    },

    handlePageLogin: async function(e) {
        e.preventDefault();
        const email = document.getElementById("page-login-email").value.trim();
        const password = document.getElementById("page-login-password").value;

        if (window.firebaseEnabled && window.auth) {
            try {
                this.showToast("Iniciando sesión...", "info");
                const credential = await window.auth.signInWithEmailAndPassword(email, password);
                const user = credential.user;

                // Obtener perfil desde Firestore y activar sesión inmediatamente
                try {
                    const userDoc = await window.firestore.collection('users').doc(user.uid).get();
                    let profile;
                    if (userDoc.exists) {
                        profile = userDoc.data();
                    } else {
                        // Crear perfil mínimo si no existe
                        profile = {
                            id: user.uid,
                            name: user.displayName || user.email.split('@')[0],
                            email: user.email,
                            dni: 'Sin DNI',
                            phone: '',
                            role: 'patient',
                            absences: 0,
                            status: 'Activo',
                            suspensionEnd: null,
                            suspensionReason: null
                        };
                        try {
                            await window.firestore.collection('users').doc(user.uid).set(profile);
                        } catch (err) {
                            console.warn('handlePageLogin: no se pudo crear perfil por defecto:', err);
                        }
                    }

                    await this._activateSession(profile, user);
                    this.showToast("Sesión iniciada con éxito.", "success");
                } catch (err) {
                    console.error('handlePageLogin: error obteniendo perfil tras login:', err);
                    this.showToast('Error al cargar perfil tras iniciar sesión.', 'error');
                }
            } catch (err) {
                console.error("Error al iniciar sesión con Firebase:", err);
                this.showToast("Credenciales incorrectas o error de conexión.", "error");
            }
        } else {
            this.showToast("Firebase no está configurado. Use el bypass al Modo Simulador.", "warning");
        }
    },

    handlePageRegister: async function(e) {
        e.preventDefault();
        const name = document.getElementById("page-reg-name").value.trim();
        const dni = document.getElementById("page-reg-dni").value.trim();
        const email = document.getElementById("page-reg-email").value.trim();
        const phone = document.getElementById("page-reg-phone").value.trim();
        const password = document.getElementById("page-reg-password").value;
        // Determinar si viene con token de invitación
        const urlParams = new URLSearchParams(window.location.search);
        const inviteToken = urlParams.get('invite');
        let role = 'patient';

        if (inviteToken && window.firebaseEnabled && window.firestore) {
            // Intentar leer invitación
            try {
                const invSnap = await window.firestore.collection('invitations').doc(inviteToken).get();
                if (!invSnap.exists) {
                    this.showToast('Token de invitación inválido.', 'error');
                    return;
                }
                const inv = invSnap.data();
                if (inv.used) {
                    this.showToast('Esta invitación ya fue utilizada.', 'error');
                    return;
                }
                // role propuesto por la invitación
                role = inv.role || 'doctor';
            } catch (err) {
                console.error('Error al leer invitación:', err);
                this.showToast('Error al procesar la invitación.', 'error');
                return;
            }
        }

        if (window.firebaseEnabled && window.auth) {
            try {
                this.showToast("Registrando usuario...", "info");
                // Deshabilitar botón para evitar envíos múltiples
                const submitBtn = document.querySelector('#page-register-form button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
                
                // 1. Crear usuario en Firebase Auth
                const credential = await window.auth.createUserWithEmailAndPassword(email, password);
                const user = credential.user;
                // Marcar temporalmente que acabamos de registrar este UID para evitar race conditions
                this._justRegistered = user.uid;

                // 2. Guardar perfil de usuario en Firestore
                const profile = {
                    id: user.uid,
                    name,
                    dni,
                    email,
                    phone,
                    role,
                    absences: 0,
                    status: "Activo",
                    suspensionEnd: null,
                    suspensionReason: null
                };

                // Si viene con token de invitación, anexarlo al perfil para que las reglas de Firestore lo permitan
                if (inviteToken) {
                    profile.inviteToken = inviteToken;
                }

                // Si se registró por invitación y es médico, intentar obtener datos desde la invitación
                if (role === "doctor" && inviteToken) {
                    try {
                        const invSnap2 = await window.firestore.collection('invitations').doc(inviteToken).get();
                        if (invSnap2.exists) {
                            const inv = invSnap2.data();
                            profile.matricula = inv.matricula || inv.matricula || ("MN-" + Math.floor(10000 + Math.random() * 90000));
                            profile.specialty = inv.specialty || 'Clínica Médica';
                            profile.workDays = inv.workDays || [1,2,3,4,5];
                            profile.workHours = inv.workHours || { start: '08:00', end: '12:00' };
                        }
                    } catch (err) {
                        console.warn('No se pudo leer invitación al crear perfil:', err);
                    }
                }

                await window.firestore.collection("users").doc(user.uid).set(profile);

                // Marcar invitación como utilizada
                if (inviteToken) {
                    try {
                        await window.firestore.collection('invitations').doc(inviteToken).update({ used: true, usedBy: user.uid, usedAt: window.firebase && window.firebase.firestore ? window.firebase.firestore.FieldValue.serverTimestamp() : null });
                    } catch (err) {
                        console.warn('No se pudo actualizar invitación como usada:', err);
                    }
                }
                
                // 3. Crear notificación inicial
                await window.db.createNotification({
                    type: "Correo",
                    recipient: email,
                    message: `Bienvenido a SALUD GOYA, ${name}. Su portal médico ha sido creado exitosamente con el rol de ${role === 'patient' ? 'Paciente' : role === 'doctor' ? 'Médico' : 'Administrador'}.`
                });

                this.showToast("Registro completado con éxito.", "success");

                // Iniciar sesión automáticamente con el usuario recién creado
                try {
                    await this._activateSession(profile, user);
                } catch (err) {
                    console.warn('No se pudo activar sesión automáticamente tras registro:', err);
                }
                // Limpiar flag de registro reciente
                if (this._justRegistered && this._justRegistered === user.uid) this._justRegistered = null;
            } catch (err) {
                console.error("Error al registrarse con Firebase:", err);
                this.showToast(err.message || 'Error al registrarse', "error");
            } finally {
                const submitBtn = document.querySelector('#page-register-form button[type="submit"]');
                if (submitBtn) submitBtn.disabled = false;
            }
        } else {
            console.warn('Firebase no configurado o auth ausente:', { firebaseEnabled: window.firebaseEnabled, auth: !!window.auth });
            alert('Firebase no está configurado en este entorno. Use el bypass al Modo Simulador.');
            this.showToast("Firebase no está configurado. Use el bypass al Modo Simulador.", "warning");
        }
    },

    handleLogout: async function() {
        if (window.firebaseEnabled && window.auth) {
            try {
                await window.auth.signOut();
                this.simulatedMode = false;
                this.currentUser = null;
                document.getElementById("auth-page").classList.add("active");
                this.showToast("Sesión cerrada.", "info");
            } catch (err) {
                console.error("Error al cerrar sesión:", err);
            }
        } else {
            this.simulatedMode = false;
            this.currentUser = null;
            document.getElementById("auth-page").classList.add("active");
            this.showToast("Modo Simulador cerrado.", "info");
        }
    }
};

// Iniciar aplicación al cargar el DOM
window.addEventListener("DOMContentLoaded", () => app.init());

// Exponer globalmente
window.app = app;
