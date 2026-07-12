/**
 * SALUD GOYA - Capa de Base de Datos (db.js)
 * Adaptada para usar turnos-api en lugar de LocalStorage/Firestore directo.
 */

const db = {
    init: async function() {
        console.log("SALUD GOYA DB: Conectado a turnos-api.");
        // La inicialización ahora es implícita vía API
    },

    // ESPECIALIDADES
    getSpecialties: async function() {
        try {
            const data = await window.apiClient.get("/specialties");
            return data.map(s => s.name);
        } catch (err) {
            console.error(err);
            return [];
        }
    },

    addSpecialty: async function(name) {
        await window.apiClient.post("/specialties", { name });
        return this.getSpecialties();
    },

    deleteSpecialty: async function(name) {
        // La API usa IDs para borrar, pero el frontend actual usa nombres.
        // Buscamos el ID primero si es necesario o ajustamos la API.
        const specialties = await window.apiClient.get("/specialties");
        const spec = specialties.find(s => s.name === name);
        if (spec) {
            await window.apiClient.delete(`/specialties/${spec.id}`);
        }
        return this.getSpecialties();
    },

    // MEDICOS
    getDoctors: async function() {
        return await window.apiClient.get("/users/doctors");
    },

    getDoctorById: async function(id) {
        return await window.apiClient.get(`/users/doctors/${id}`);
    },

    saveDoctor: async function(doctor) {
        if (doctor.id && !doctor.id.startsWith("doc_temp")) {
            return await window.apiClient.patch(`/users/doctors/${doctor.id}`, doctor);
        } else {
            // Si es nuevo, la API usa invitaciones o creación directa por admin
            return await window.apiClient.post("/users/doctors", doctor);
        }
    },

    deleteDoctor: async function(id) {
        return await window.apiClient.delete(`/users/doctors/${id}`);
    },

    // PACIENTES
    getPatients: async function() {
        return await window.apiClient.get("/users/patients");
    },

    getPatientById: async function(id) {
        return await window.apiClient.get(`/users/patients/${id}`);
    },

    getPatientByDni: async function(dni) {
        const patients = await this.getPatients();
        return patients.find(p => p.dni === dni) || null;
    },

    updatePatient: async function(patient) {
        return await window.apiClient.patch(`/users/patients/${patient.id}`, patient);
    },

    // TURNOS
    getAppointments: async function() {
        return await window.apiClient.get("/appointments");
    },

    getAppointmentsByPatient: async function(patientId) {
        return await window.apiClient.get(`/appointments?patientId=${patientId}`);
    },

    getAppointmentsByDoctor: async function(doctorId) {
        return await window.apiClient.get(`/appointments?doctorId=${doctorId}`);
    },

    createAppointment: async function(appData) {
        return await window.apiClient.post("/appointments", appData);
    },

    updateAppointmentStatus: async function(appId, newStatus, additionalDetails = {}) {
        return await window.apiClient.patch(`/appointments/${appId}/status`, {
            status: newStatus,
            ...additionalDetails
        });
    },

    updateAppointmentSchedule: async function(appId, newDate, newTime) {
        return await window.apiClient.patch(`/appointments/${appId}/schedule`, {
            date: newDate,
            time: newTime
        });
    },

    // HISTORIAL CLINICO
    getMedicalHistoryByPatient: async function(patientId) {
        return await window.apiClient.get(`/medical-history/patient/${patientId}`);
    },

    createMedicalRecord: async function(recordData) {
        return await window.apiClient.post("/medical-history", recordData);
    },

    // NOTIFICACIONES
    getNotifications: async function() {
        return await window.apiClient.get("/notifications");
    },

    // CONFIGURACIÓN GLOBAL
    getSystemConfig: async function() {
        return await window.apiClient.get("/system-config");
    },

    saveSystemConfig: async function(newConfig) {
        return await window.apiClient.put("/system-config", newConfig);
    },

    // OBTENER DISPONIBILIDAD DE UN MÉDICO
    getDoctorAvailability: async function(doctorId, dateString, durationMinutes = 30) {
        return await window.apiClient.get(`/doctors/${doctorId}/availability?date=${dateString}&duration=${durationMinutes}`);
    },

    // ENDPOINT DE ESTADÍSTICAS PARA ADMIN
    getAdminStats: async function() {
        return await window.apiClient.get("/admin/stats");
    }
};

window.db = db;
