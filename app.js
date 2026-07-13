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
        console.log("SALUD GOYA: Inicializando aplicación...");

        if (!window.apiClient) {
            console.error("API Client no encontrado. Asegúrate de que apiClient.js se carga correctamente.");
            return;
        }

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

        // 4. Verificar si venimos desde un enlace de invitación
        const urlParams = new URLSearchParams(window.location.search);
        const inviteToken = urlParams.get('invite');
        if (inviteToken) {
            await this.handleInviteFlow(inviteToken);
        }
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
        const pageInviteForm = document.getElementById("page-invite-form");

        if (pageLoginForm) pageLoginForm.addEventListener("submit", (e) => this.handlePageLogin(e));
        if (pageRegisterForm) pageRegisterForm.addEventListener("submit", (e) => this.handlePageRegister(e));
        if (pageInviteForm) pageInviteForm.addEventListener("submit", (e) => this.handlePageInvite(e));

        this.applyInputRestrictions();
    },

    applyInputRestrictions: function() {
        // Restringir DNI a solo números
        document.querySelectorAll('input[id*="dni"]').forEach(input => {
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 10);
            });
        });

        // Restringir Teléfono a solo números
        document.querySelectorAll('input[id*="phone"]').forEach(input => {
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').substring(0, 15);
            });
        });

        // Restringir Nombres a letras y espacios
        document.querySelectorAll('input[id*="name"]').forEach(input => {
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
            });
        });

        // Bloquear emojis globalmente en todos los inputs
        document.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                const regex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
                if (regex.test(e.target.value)) {
                    e.target.value = e.target.value.replace(regex, '');
                    this.showToast("No se permiten emojis en este campo", "warning");
                }
            }
        }, true);
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
        const pageTitle = document.getElementById("view-title");
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
        const mainContent = document.getElementById("content-body");
        if (mainContent && this.views[viewId]) {
            mainContent.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';
            try {
                await this.views[viewId](mainContent);
                // Re-aplicar restricciones a los nuevos elementos del DOM
                this.applyInputRestrictions();
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
        const submitBtn = e.target.querySelector('button[type="submit"]');
        this.setBtnLoading(submitBtn, true);

        console.log("Intentando iniciar sesión...");
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
            this.showToast(err.message || "Credenciales incorrectas o cuenta inexistente", "error");
        } finally {
            this.setBtnLoading(submitBtn, false);
        }
    },

    handlePageRegister: async function(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        this.setBtnLoading(submitBtn, true);

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

            this.showToast("Cuenta creada exitosamente. Ya puede iniciar sesión.", "success");
            this.switchPageAuthTab("login");
        } catch (err) {
            console.error("Register error:", err);
            this.showToast(err.message || "Error al registrarse", "error");
        } finally {
            this.setBtnLoading(submitBtn, false);
        }
    },

    handleInviteFlow: async function(token) {
        try {
            this.showToast("Validando invitación...", "info");
            const invite = await window.db.getInvitationByToken(token);

            // Si es válida, mostrar form de finalización
            document.getElementById("auth-page").classList.add("active");

            // Ocultar tabs y otros forms
            document.querySelector(".auth-tab-buttons").style.display = "none";
            document.getElementById("page-login-form").classList.remove("active");
            document.getElementById("page-register-form").classList.remove("active");

            // Mostrar form de invitación
            const inviteForm = document.getElementById("page-invite-form");
            inviteForm.classList.add("active");
            document.getElementById("auth-page-title").textContent = "Completar Registro";
            document.getElementById("auth-page-subtitle").textContent = "Staff Médico Salud Goya";

            document.getElementById("page-invite-token").value = token;
            document.getElementById("invite-welcome-title").textContent = `¡Hola, ${invite.name}!`;
            document.getElementById("invite-welcome-msg").textContent = `Has sido invitado/a como especialista en ${invite.specialty}. Define tu contraseña para activar tu cuenta.`;

        } catch (err) {
            this.showToast("Enlace de invitación inválido o expirado", "error");
            console.error(err);
        }
    },

    handlePageInvite: async function(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        this.setBtnLoading(submitBtn, true);

        const token = document.getElementById("page-invite-token").value;
        const password = document.getElementById("page-invite-password").value;
        const confirm = document.getElementById("page-invite-confirm").value;

        if (password !== confirm) {
            this.showToast("Las contraseñas no coinciden", "warning");
            this.setBtnLoading(submitBtn, false);
            return;
        }

        try {
            this.showToast("Activando cuenta...", "info");
            await window.apiClient.post("/auth/register/doctor", {
                inviteToken: token,
                password
            });

            this.showToast("¡Cuenta activada! Ya puede ingresar con sus credenciales.", "success");
            setTimeout(() => {
                window.location.href = window.location.pathname; // Limpiar URL y volver al login
            }, 2000);
        } catch (err) {
            this.showToast(err.message || "Error al activar cuenta", "error");
            this.setBtnLoading(submitBtn, false);
        }
    },

    handleLogout: function() {
        window.apiClient.logout();
    },

    setBtnLoading: function(btn, isLoading) {
        if (!btn) return;
        if (isLoading) {
            btn.classList.add("btn-loading");
            btn.disabled = true;
        } else {
            btn.classList.remove("btn-loading");
            btn.disabled = false;
        }
    },

    switchPageAuthTab: function(tab) {
        console.log("Cambiando a pestaña:", tab);
        const loginBtn = document.getElementById("page-tab-login");
        const regBtn = document.getElementById("page-tab-register");
        const loginForm = document.getElementById("page-login-form");
        const regForm = document.getElementById("page-register-form");
        const title = document.getElementById("auth-page-title");

        if (!loginForm || !regForm) {
            console.error("No se encontraron los formularios de login/registro en el DOM.");
            return;
        }

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
        if (!this.currentUser) return;
        try {
            const notifs = await window.db.getNotifications();
            const badge = document.getElementById("notif-count");
            if (badge) {
                badge.textContent = notifs.length;
                badge.style.display = notifs.length > 0 ? "flex" : "none";
            }
        } catch (err) {
            console.warn("Error al actualizar campana:", err);
        }
    },

    renderNotificationList: async function() {
        const container = document.getElementById("notif-list-container");
        if (!container) return;
        container.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

        try {
            const notifs = await window.db.getNotifications();
            if (!notifs || notifs.length === 0) {
                container.innerHTML = `
                    <div class="text-center p-5 text-muted">
                        <i class="fa-solid fa-envelope-open fa-3x mb-3"></i>
                        <p>No tienes notificaciones registradas.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = notifs.map(n => `
                <div class="notif-item animate__animated animate__fadeIn">
                    <div class="notif-header-item">
                        <span class="notif-type"><i class="fa-solid ${n.type === 'Correo' ? 'fa-envelope' : 'fa-whatsapp'}"></i> ${n.type}</span>
                        <span class="notif-date">${new Date(n.date).toLocaleDateString()} ${new Date(n.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p class="notif-msg">${n.message}</p>
                    <div class="notif-recipient">
                        <i class="fa-solid fa-user-tag"></i> Destino: ${n.recipient}
                    </div>
                </div>
            `).join("");
        } catch (err) {
            container.innerHTML = `
                <div class="text-danger p-4 text-center">
                    <i class="fa-solid fa-circle-exclamation fa-2x mb-2"></i>
                    <p>Error al cargar notificaciones.</p>
                </div>
            `;
        }
    }
};

// Iniciar aplicación al cargar el DOM
window.addEventListener("DOMContentLoaded", () => app.init());

// Exponer globalmente
window.app = app;
