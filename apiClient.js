/**
 * SALUD GOYA - API Client
 * Maneja las peticiones al backend, inyección de tokens JWT y refresco automático.
 */

const API_BASE_URL = "https://api-turnos-s0rd.onrender.com/api";

const apiClient = {
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;

        // Inyectar token de acceso si existe
        const token = localStorage.getItem("accessToken");
        const headers = {
            "Content-Type": "application/json",
            ...options.headers
        };

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        let response = await fetch(url, config);

        // Si el token expiró (401), intentar refrescar
        if (response.status === 401 && localStorage.getItem("refreshToken")) {
            const refreshed = await this.refreshToken();
            if (refreshed) {
                // Reintentar la petición original con el nuevo token
                headers["Authorization"] = `Bearer ${localStorage.getItem("accessToken")}`;
                response = await fetch(url, config);
            } else {
                // Si el refresh falla, desloguear
                this.logout();
                throw new Error("Sesión expirada");
            }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "Error en la petición");
        }

        if (response.status === 204) return null;
        return await response.json();
    },

    async refreshToken() {
        try {
            const refreshToken = localStorage.getItem("refreshToken");
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem("accessToken", data.accessToken);
                localStorage.setItem("refreshToken", data.refreshToken);
                return true;
            }
            return false;
        } catch (err) {
            return false;
        }
    },

    async login(email, password) {
        const data = await this.request("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        return data.user;
    },

    logout() {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.reload();
    },

    get(endpoint) {
        return this.request(endpoint, { method: "GET" });
    },

    post(endpoint, body) {
        return this.request(endpoint, { method: "POST", body: JSON.stringify(body) });
    },

    patch(endpoint, body) {
        return this.request(endpoint, { method: "PATCH", body: JSON.stringify(body) });
    },

    put(endpoint, body) {
        return this.request(endpoint, { method: "PUT", body: JSON.stringify(body) });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: "DELETE" });
    }
};

window.apiClient = apiClient;
