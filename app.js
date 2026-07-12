/**
 * SALUD GOYA - Controlador Principal SPA (app.js)
 * Maneja el enrutamiento, sesión activa, notificaciones y sincronización con turnos-api.
 */

const app = {
    currentRole: "patient", // patient, doctor, admin
    currentUser: null,       // Objeto de usuario activo
    activeView: "dashboard", // ID de la vista activa

    // Vistas registradas por los componentes correspondientes
    views: {},

    init: async function() {
        // 1. Vincular elementos globales del DOM
        this.bindEvents();

        // 2. Verificar si hay una sesión activa en localStorage
        const token = localStorage.getItem("accessToken");
        if (token) {
            try {
                const user = await window.apiClient.get("/auth/me");
                this.currentUser = user;
                this.currentRole = user.role;
                this.activeView = this.currentRole === 'patient' ? 'dashboard' : this.currentRole === 'doctor' ? 'agenda' : 'dashboard_admin';

                document.getElementById("auth-page").classList.remove("active");
                this.updateProfileUI();
                this.renderSidebarNav();
                await this.navigateTo(this.activeView);
            } catch (err) {
                console.warn("Token inválido o expirado:", err);
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                document.getElementById("auth-page").classList.add("active");
            }
        } else {
            document.getElementById("auth-page").classList.add("active");
        }

        // 3. Cargar notificaciones iniciales en la campana
        await this.updateNotificationBell();
    },

    bindEvents: function() {
        // Campana de notificaciones
        const bell = document.getElementById("notif-bell-btn");
        const notifSidebar = document.getElementById("notification-sidebar");
        const notifClose = document.getElementById("notif-close-btn");

        if (bell) {
            bell.addEventListener("click", async () => {
                notifSidebar.classList.toggle("active");
                if (notifSidebar.classList.contains("active")) {
                    await this.renderNotificationList();
                }
            });
        }

        if (notifClose) {
            notifClose.addEventListener("click", () => {
                notifSidebar.classList.remove("active");
            });
        }

        // Cerrar modales genéricos al hacer clic en fondo
        document.querySelectorAll(".modal-overlay").forEach(modal => {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // Botón de cerrar modal de auth
        const authCloseBtn = document.getElementById("auth-close-btn");
        if (authCloseBtn) {
            authCloseBtn.addEventListener("click", () => {
                this.closeModal("auth-modal");
            });
        }

        // Tabs de Auth (Pantalla principal)
        const pageTabLogin = document.getElementById("page-tab-login");
        const pageTabRegister = document.getElementById("page-tab-register");
        if (pageTabLogin) pageTabLogin.addEventListener("click", () => this.switchPageAuthTab("login"));
        if (pageTabRegister) pageTabRegister.addEventListener("click", () => this.switchPageAuthTab("register"));

        // Forms de Auth (Pantalla principal)
        const pageLoginForm = document.getElementById("page-login-form");
        const pageRegisterForm = document.getElementById("page-register-form");
        if (pageLoginForm) pageLoginForm.addEventListener("submit", (e) => this.handlePageLogin(e));
        if (pageRegisterForm) pageRegisterForm.addEventListener("submit", (e) => this.handlePageRegister(e));
    },

    // ==========================================
    // MANEJO DE INTERFAZ DEL USUARIO (SESSION)
    // ==========================================
    updateProfileUI: function() {
        const headerUserName = document.getElementById("header-user-name");
        const headerAvatar = document.getElementById("header-avatar");
        const sidebarProfile = document.getElementById("sidebar-user-profile");

        if (!this.currentUser) {
            if (headerUserName) headerUserName.textContent = "Invitado";
            if (headerAvatar) headerAvatar.textContent = "I";
            if (sidebarProfile) {
                sidebarProfile.innerHTML = `
                    <div class="user-info">
                        <span class="user-name">Sin Sesión Activa</span>
                        <span class="user-role">Por favor inicia sesión</span>
                    </div>
                `;
            }
            return;
        }

        // Header Superior
        if (headerUserName) headerUserName.textContent = this.currentUser.name;
        if (headerAvatar) headerAvatar.textContent = this.currentUser.name.charAt(0).toUpperCase();

        // Footer del Sidebar
        const roleLabels = { patient: "Paciente", doctor: "Médico", admin: "Administrador" };
        const displayRole = roleLabels[this.currentUser.role] || "Rol";

        if (sidebarProfile) {
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
                }
            }, 100);
        }
    },

    renderSidebarNav: function() {
        const navList = document.getElementById("nav-list");
        if (!navList) return;
        navList.innerHTML = "";

        const navItems = {
            patient: [
                { id: "dashboard", label: "Mis Turnos", icon: "fa-calendar-check" },
                { id: "reservar", label: "Reservar Turno", icon: "fa-calendar-plus" },
                { id: "historial", label: "Historial Médico", icon: "fa-notes-medical" }
            ],
            doctor: [
                { id: "agenda", label: "Mi Agenda", icon: "fa-calendar-days" },
                { id: "configuracion_horarios", label: "Horarios Laborales", icon: "fa-clock" }
            ],
            admin: [
                { id: "dashboard_admin", label: "Panel Admin", icon: "fa-chart-pie" },
                { id: "gestion_medicos", label: "Médicos", icon: "fa-user-doctor" },
                { id: "gestion_especialidades", label: "Especialidades", icon: "fa-tags" },
                { id: "gestion_turnos", label: "Todos los Turnos", icon: "fa-list-check" },
                { id: "gestion_notificaciones", label: "Notificaciones", icon: "fa-envelope" },
                { id: "configuracion_sistema", label: "Ajustes", icon: "fa-gears" }
            ]
        };

        const items = navItems[this.currentRole] || [];

        items.forEach(item => {
            const li = document.createElement("li");
            li.className = "nav-item" + (this.activeView === item.id ? " active" : "");
            li.innerHTML = `
                <a href="#" data-view="${item.id}">
                    <i class="fa-solid ${item.icon}"></i>
                    <span>${item.label}</span>
                </a>
            `;
            li.addEventListener("click", (e) => {
                e.preventDefault();
                this.navigateTo(item.id);
            });
            navList.appendChild(li);
        });
    },

    navigateTo: async function(viewId) {
        this.activeView = viewId;
        
        // Actualizar UI activa en sidebar
        document.querySelectorAll(".nav-item").forEach(li => {
            li.classList.remove("active");
            if (li.querySelector(`a[data-view="${viewId}"]`)) {
                li.classList.add("active");
            }
        });

        // Título de la vista
        const pageTitle = document.getElementById("page-view-title");
        const titles = {
            dashboard: "Mis Turnos Reservados",
            reservar: "Solicitar Nuevo Turno",
            historial: "Mi Historial Clínico Digital",
            agenda: "Agenda de Pacientes",
            configuracion_horarios: "Mis Horarios Laborales",
            dashboard_admin: "Panel de Control y Estadísticas",
            gestion_medicos: "Administración del Staff Médico",
            gestion_especialidades: "Gestión de Especialidades Médicas",
            gestion_turnos: "Monitor de Turnos del Sistema",
            gestion_notificaciones: "Log de Notificaciones Enviadas",
            configuracion_sistema: "Configuración Global del Sistema"
        };
        if (pageTitle) pageTitle.textContent = titles[viewId] || "SALUD GOYA";

        // Renderizar la vista
        const mainContent = document.getElementById("main-content");
        if (mainContent && this.views[viewId]) {
            mainContent.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
            try {
                await this.views[viewId](mainContent);
            } catch (err) {
                console.error(`Error al cargar vista ${viewId}:`, err);
                mainContent.innerHTML = `<div class="error-state">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>No se pudo cargar la vista solicitada.</p>
                </div>`;
            }
        }
    },

    registerView: function(id, renderFn) {
        this.views[id] = renderFn;
    },

    handlePageLogin: async function(e) {
        e.preventDefault();
        const email = document.getElementById("page-login-email").value.trim();
        const password = document.getElementById("page-login-password").value;

        try {
            this.showToast("Iniciando sesión...", "info");
            const user = await window.apiClient.login(email, password);
            this.currentUser = user;
            this.currentRole = user.role;
            this.activeView = this.currentRole === 'patient' ? 'dashboard' : this.currentRole === 'doctor' ? 'agenda' : 'dashboard_admin';

            document.getElementById("auth-page").classList.remove("active");
            this.updateProfileUI();
            this.renderSidebarNav();
            await this.navigateTo(this.activeView);
            this.showToast(`Bienvenido de nuevo, ${user.name}`, "success");
        } catch (err) {
            console.error("Login error:", err);
            this.showToast(err.message || "Error al iniciar sesión", "error");
        }
    },

    handlePageRegister: async function(e) {
        e.preventDefault();
        const name = document.getElementById("page-reg-name").value.trim();
        const dni = document.getElementById("page-reg-dni").value.trim();
        const email = document.getElementById("page-reg-email").value.trim();
        const phone = document.getElementById("page-reg-phone").value.trim();
        const password = document.getElementById("page-reg-password").value;

        try {
            this.showToast("Creando cuenta...", "info");
            // Usamos la API de registro de pacientes por defecto
            await window.apiClient.post("/auth/register/patient", {
                name, dni, email, phone, password
            });

            this.showToast("Cuenta creada. Iniciando sesión...", "success");
            // Auto-login
            const user = await window.apiClient.login(email, password);
            this.currentUser = user;
            this.currentRole = user.role;
            this.activeView = 'dashboard';

            document.getElementById("auth-page").classList.remove("active");
            this.updateProfileUI();
            this.renderSidebarNav();
            await this.navigateTo(this.activeView);
        } catch (err) {
            console.error("Register error:", err);
            this.showToast(err.message || "Error al registrarse", "error");
        }
    },

    handleLogout: function() {
        window.apiClient.logout();
    },

    switchPageAuthTab: function(tab) {
        const loginBtn = document.getElementById("page-tab-login");
        const regBtn = document.getElementById("page-tab-register");
        const loginForm = document.getElementById("page-login-form");
        const regForm = document.getElementById("page-register-form");
        const title = document.getElementById("auth-page-title");

        if (tab === "login") {
            loginBtn.classList.add("active");
            regBtn.classList.remove("active");
            loginForm.classList.add("active");
            regForm.classList.remove("active");
            title.textContent = "Iniciar Sesión";
        } else {
            loginBtn.classList.remove("active");
            regBtn.classList.add("active");
            loginForm.classList.remove("active");
            regForm.classList.add("active");
            title.textContent = "Crear Cuenta de Paciente";
        }
    },

    showToast: function(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast toast-${type} animate__animated animate__fadeInUp`;

        const icons = {
            info: "fa-circle-info",
            success: "fa-circle-check",
            warning: "fa-triangle-exclamation",
            error: "fa-circle-xmark"
        };

        toast.innerHTML = `
            <i class="fa-solid ${icons[type]}"></i>
            <span>${message}</span>
        `;

        const container = document.getElementById("toast-container") || document.body;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.replace("animate__fadeInUp", "animate__fadeOutDown");
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    },

    openModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add("active");
    },

    closeModal: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove("active");
    },

    updateNotificationBell: async function() {
        if (!this.currentUser || this.currentUser.role !== 'admin') return;
        try {
            const notifs = await window.db.getNotifications();
            const badge = document.getElementById("notif-badge");
            if (badge) {
                badge.textContent = notifs.length;
                badge.style.display = notifs.length > 0 ? "flex" : "none";
            }
        } catch (err) {
            console.warn("Error al actualizar campana:", err);
        }
    },

    renderNotificationList: async function() {
        const container = document.getElementById("notification-list");
        if (!container) return;
        container.innerHTML = '<div class="loader"></div>';

        try {
            const notifs = await window.db.getNotifications();
            if (notifs.length === 0) {
                container.innerHTML = '<div class="text-center text-muted p-4">No hay notificaciones registradas.</div>';
                return;
            }

            container.innerHTML = notifs.map(n => `
                <div class="notif-item">
                    <div class="notif-header">
                        <span class="notif-type">${n.type}</span>
                        <span class="notif-date">${new Date(n.date).toLocaleDateString()}</span>
                    </div>
                    <p class="notif-msg">${n.message}</p>
                    <div class="notif-recipient">Para: ${n.recipient}</div>
                </div>
            `).join("");
        } catch (err) {
            container.innerHTML = '<div class="text-danger p-4">Error al cargar notificaciones.</div>';
        }
    }
};

// Iniciar aplicación al cargar el DOM
window.addEventListener("DOMContentLoaded", () => app.init());

// Exponer globalmente
window.app = app;
