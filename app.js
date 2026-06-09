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
        console.log("Iniciando aplicación SALUD GOYA...");
        
        // 1. Inicializar base de datos
        await window.db.init();

        // 2. Vincular elementos globales del DOM
        this.bindEvents();

        // 3. Inicializar Simulador de Roles
        this.initSimulator();

        // 4. Cargar sesión inicial basada en el rol seleccionado en el simulador
        await this.syncSession();

        // 5. Cargar notificaciones iniciales en la campana
        await this.updateNotificationBell();
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
    },

    // ==========================================
    // MANEJO DE SIMULADOR DE ROLES (PROBADOR)
    // ==========================================
    initSimulator: function() {
        const roleSelect = document.getElementById("sim-role-select");
        const userSelect = document.getElementById("sim-user-select");
        const resetBtn = document.getElementById("sim-reset-db");

        // Evento de cambio de rol
        roleSelect.addEventListener("change", async (e) => {
            this.currentRole = e.target.value;
            await this.populateSimulatorUsers();
            await this.syncSession();
        });

        // Evento de cambio de usuario
        userSelect.addEventListener("change", async (e) => {
            await this.syncSession(e.target.value);
        });

        // Evento resetear base de datos
        resetBtn.addEventListener("click", async () => {
            if (confirm("¿Seguro que deseas reiniciar la base de datos local a sus valores de fábrica? Perderás todos tus cambios.")) {
                await window.db.reset();
                this.showToast("Base de datos local reestablecida correctamente.", "warning");
                setTimeout(() => window.location.reload(), 1000);
            }
        });

        // Poblado inicial de usuarios
        this.populateSimulatorUsers();
    },

    populateSimulatorUsers: async function() {
        const userSelect = document.getElementById("sim-user-select");
        const userGroup = document.getElementById("sim-user-group");
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
            const activeId = userId || userSelect.value;

            if (this.currentRole === "patient") {
                this.currentUser = await window.db.getPatientById(activeId);
                if (!this.currentUser && userSelect.value) {
                    this.currentUser = await window.db.getPatientById(userSelect.value);
                }
                this.activeView = "dashboard";
            } else if (this.currentRole === "doctor") {
                this.currentUser = await window.db.getDoctorById(activeId);
                if (!this.currentUser && userSelect.value) {
                    this.currentUser = await window.db.getDoctorById(userSelect.value);
                }
                this.activeView = "agenda";
            }
        }

        // Actualizar componentes visuales de la sesión
        this.updateProfileUI();

        // Regenerar sidebar de navegación
        this.renderSidebarNav();

        // Cargar la vista predeterminada
        this.navigateTo(this.activeView);
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
        const displayRole = roleLabels[this.currentRole] || "Rol";

        sidebarProfile.innerHTML = `
            <div class="avatar">${this.currentUser.name.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <span class="user-name" title="${this.currentUser.name}">${this.currentUser.name}</span>
                <span class="user-role">${displayRole}</span>
            </div>
        `;
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
                
                // Forzar sincronía en el simulador
                const roleSelect = document.getElementById("sim-role-select");
                roleSelect.value = "patient";
                await this.populateSimulatorUsers();
                
                const userSelect = document.getElementById("sim-user-select");
                userSelect.value = patient.id;

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

            // Sincronizar selectores del simulador
            const roleSelect = document.getElementById("sim-role-select");
            roleSelect.value = "patient";
            await this.populateSimulatorUsers();
            
            const userSelect = document.getElementById("sim-user-select");
            userSelect.value = newPat.id;

            await this.syncSession(newPat.id);
            this.closeModal("auth-modal");
            await this.updateNotificationBell();
        } catch (err) {
            this.showToast(err.message, "error");
        }
    }
};

// Iniciar aplicación al cargar el DOM
window.addEventListener("DOMContentLoaded", () => app.init());

// Exponer globalmente
window.app = app;
