/**
 * SALUD GOYA - Capa de Base de Datos Local (db.js)
 * Abstracción de base de datos relacional simulada utilizando localStorage con soporte asíncrono.
 */

const DB_PREFIX = "salud_goya_";

// Helper para leer de localStorage
function getTable(tableName) {
    const data = localStorage.getItem(DB_PREFIX + tableName);
    return data ? JSON.parse(data) : null;
}

// Helper para escribir en localStorage
function setTable(tableName, data) {
    localStorage.setItem(DB_PREFIX + tableName, JSON.stringify(data));
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(timeMinutes) {
    const hours = Math.floor(timeMinutes / 60);
    const minutes = timeMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function rangesOverlap(startA, endA, startB, endB) {
    return startA < endB && startB < endA;
}

// Datos semilla iniciales
const SEED_DATA = {
    specialties: [
        "Clínica Médica",
        "Pediatría",
        "Cardiología",
        "Traumatología",
        "Ginecología",
        "Dermatología"
    ],
    doctors: [
        {
            id: "doc_1",
            name: "Dr. Hernán Beneventano",
            specialty: "Clínica Médica",
            matricula: "MN-48291",
            email: "h.beneventano@saludgoya.com",
            phone: "+543777123456",
            workDays: [1, 2, 3, 4, 5], // Lunes a Viernes
            workHours: { start: "08:00", end: "12:00" }
        },
        {
            id: "doc_2",
            name: "Dra. Sofía Gómez",
            specialty: "Pediatría",
            matricula: "MN-92841",
            email: "s.gomez@saludgoya.com",
            phone: "+543777654321",
            workDays: [1, 2, 3, 4], // Lunes a Jueves
            workHours: { start: "14:00", end: "18:00" }
        },
        {
            id: "doc_3",
            name: "Dr. Carlos Pérez",
            specialty: "Cardiología",
            matricula: "MN-73819",
            email: "c.perez@saludgoya.com",
            phone: "+543777998877",
            workDays: [2, 4], // Martes y Jueves
            workHours: { start: "09:00", end: "13:00" }
        },
        {
            id: "doc_4",
            name: "Dra. Ana Martínez",
            specialty: "Traumatología",
            matricula: "MN-51283",
            email: "a.martinez@saludgoya.com",
            phone: "+543777112233",
            workDays: [1, 3, 5], // Lunes, Miércoles, Viernes
            workHours: { start: "08:00", end: "12:00" }
        },
        {
            id: "doc_5",
            name: "Dr. Luis Rodríguez",
            specialty: "Ginecología",
            matricula: "MN-30492",
            email: "l.rodriguez@saludgoya.com",
            phone: "+543777445566",
            workDays: [2, 3, 5], // Martes, Miércoles, Viernes
            workHours: { start: "15:00", end: "19:00" }
        },
        {
            id: "doc_6",
            name: "Dra. Elena Silva",
            specialty: "Dermatología",
            matricula: "MN-61849",
            email: "e.silva@saludgoya.com",
            phone: "+543777778899",
            workDays: [1, 4], // Lunes y Jueves
            workHours: { start: "10:00", end: "14:00" }
        }
    ],
    patients: [
        {
            id: "pat_1",
            name: "Juan Pérez",
            dni: "35123456",
            email: "juan.perez@email.com",
            phone: "+543777881122",
            absences: 0,
            status: "Activo", // Activo, Suspendido
            suspensionEnd: null,
            suspensionReason: null
        },
        {
            id: "pat_2",
            name: "María Rodríguez",
            dni: "38987654",
            email: "maria.rod@email.com",
            phone: "+543777883344",
            absences: 2,
            status: "Activo",
            suspensionEnd: null,
            suspensionReason: null
        },
        {
            id: "pat_3",
            name: "Pedro Gómez",
            dni: "40112233",
            email: "pedro.gomez@email.com",
            phone: "+543777885566",
            absences: 3,
            status: "Suspendido",
            suspensionEnd: "2026-07-08T09:30:00.000Z", // 30 días después
            suspensionReason: "Superó el límite de 3 inasistencias consecutivas sin justificación."
        }
    ],
    appointments: [
        {
            id: "app_1",
            patientId: "pat_1",
            patientName: "Juan Pérez",
            doctorId: "doc_1",
            doctorName: "Dr. Hernán Beneventano",
            specialty: "Clínica Médica",
            date: "2026-06-09",
            time: "09:00",
            status: "Confirmado", // Solicitado, Confirmado, Atendido, Cancelado, Ausente
            paid: true,
            price: 1500
        },
        {
            id: "app_2",
            patientId: "pat_1",
            patientName: "Juan Pérez",
            doctorId: "doc_3",
            doctorName: "Dr. Carlos Pérez",
            specialty: "Cardiología",
            date: "2026-06-11",
            time: "10:30",
            status: "Solicitado",
            paid: false,
            price: 2500
        },
        {
            id: "app_3",
            patientId: "pat_2",
            patientName: "María Rodríguez",
            doctorId: "doc_2",
            doctorName: "Dra. Sofía Gómez",
            specialty: "Pediatría",
            date: "2026-06-05",
            time: "15:00",
            status: "Atendido",
            paid: true,
            price: 1800
        },
        {
            id: "app_4",
            patientId: "pat_3",
            patientName: "Pedro Gómez",
            doctorId: "doc_1",
            doctorName: "Dr. Hernán Beneventano",
            specialty: "Clínica Médica",
            date: "2026-06-01",
            time: "08:30",
            status: "Ausente",
            paid: false,
            price: 1500
        },
        {
            id: "app_5",
            patientId: "pat_3",
            patientName: "Pedro Gómez",
            doctorId: "doc_4",
            doctorName: "Dra. Ana Martínez",
            specialty: "Traumatología",
            date: "2026-06-03",
            time: "10:00",
            status: "Ausente",
            paid: false,
            price: 2000
        },
        {
            id: "app_6",
            patientId: "pat_3",
            patientName: "Pedro Gómez",
            doctorId: "doc_6",
            doctorName: "Dra. Elena Silva",
            specialty: "Dermatología",
            date: "2026-06-04",
            time: "11:00",
            status: "Ausente",
            paid: false,
            price: 2200
        }
    ],
    medicalHistory: [
        {
            id: "hist_1",
            patientId: "pat_2",
            patientName: "María Rodríguez",
            doctorId: "doc_2",
            doctorName: "Dra. Sofía Gómez",
            date: "2026-06-05",
            diagnostic: "Faringitis Aguda",
            observations: "Paciente presenta fiebre de 38.5°C y dolor de garganta intenso desde hace 48 horas.",
            indications: "Tomar Ibuprofeno 400mg cada 8 horas por 3 días. Amoxicilina 500mg cada 12 horas por 7 días. Reposo y abundantes líquidos.",
            recipe: "Receta_Amoxicilina_SofiaGomez.pdf",
            attachments: [
                { name: "Estudio_Hisopado_Faringeo.pdf", size: "1.2 MB" }
            ]
        }
    ],
    notificationLogs: [
        {
            id: "not_1",
            type: "Correo",
            recipient: "juan.perez@email.com",
            message: "Su turno con el Dr. Hernán Beneventano para el 2026-06-09 a las 09:00 ha sido RESERVADO exitosamente.",
            date: "2026-06-07T10:00:00.000Z",
            status: "Enviado"
        },
        {
            id: "not_2",
            type: "Correo",
            recipient: "maria.rod@email.com",
            message: "Su turno con la Dra. Sofía Gómez para el 2026-06-05 a las 15:00 ha sido CONFIRMADO.",
            date: "2026-06-04T12:00:00.000Z",
            status: "Enviado"
        }
    ],
    config: {
        maxAbsences: 3,
        penaltyDays: 30,
        copayDefault: 2000
    }
};

// Inicialización de la Base de Datos
const db = {
    init: async function() {
        // Simular retraso de red de 100ms
        await new Promise(resolve => setTimeout(resolve, 100));

        for (const [key, value] of Object.entries(SEED_DATA)) {
            if (!getTable(key)) {
                setTable(key, value);
            }
        }

        // Reparación/Migración defensiva de datos en localStorage
        try {
            const appointments = getTable("appointments");
            if (appointments) {
                let modified = false;
                appointments.forEach(app => {
                    if (app.status === null || app.status === undefined) {
                        app.status = "Solicitado";
                        modified = true;
                    }
                });
                if (modified) {
                    setTable("appointments", appointments);
                    console.log("SALUD GOYA DB: Turnos reparados con éxito (estados nulos corregidos).");
                }
            }
        } catch (e) {
            console.error("Error al ejecutar migración defensiva de turnos:", e);
        }

        console.log("SALUD GOYA DB inicializada correctamente.");
    },

    // Resetear base de datos a valores semilla
    reset: async function() {
        await new Promise(resolve => setTimeout(resolve, 100));
        for (const [key, value] of Object.entries(SEED_DATA)) {
            setTable(key, value);
        }
        return true;
    },

    // ESPECIALIDADES
    getSpecialties: async function() {
        await new Promise(resolve => setTimeout(resolve, 50));
        return getTable("specialties") || [];
    },

    addSpecialty: async function(name) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const specialties = getTable("specialties") || [];
        if (!specialties.includes(name)) {
            specialties.push(name);
            setTable("specialties", specialties);
        }
        return specialties;
    },

    deleteSpecialty: async function(name) {
        await new Promise(resolve => setTimeout(resolve, 50));
        let specialties = getTable("specialties") || [];
        specialties = specialties.filter(s => s !== name);
        setTable("specialties", specialties);
        return specialties;
    },

    // MEDICOS
    getDoctors: async function() {
        await new Promise(resolve => setTimeout(resolve, 50));
        return getTable("doctors") || [];
    },

    getDoctorById: async function(id) {
        await new Promise(resolve => setTimeout(resolve, 30));
        const doctors = getTable("doctors") || [];
        return doctors.find(d => d.id === id) || null;
    },

    saveDoctor: async function(doctor) {
        await new Promise(resolve => setTimeout(resolve, 80));
        const doctors = getTable("doctors") || [];
        if (doctor.id) {
            const index = doctors.findIndex(d => d.id === doctor.id);
            if (index !== -1) {
                doctors[index] = doctor;
            }
        } else {
            doctor.id = "doc_" + Date.now();
            doctors.push(doctor);
        }
        setTable("doctors", doctors);
        return doctor;
    },

    deleteDoctor: async function(id) {
        await new Promise(resolve => setTimeout(resolve, 80));
        let doctors = getTable("doctors") || [];
        doctors = doctors.filter(d => d.id !== id);
        setTable("doctors", doctors);
        return true;
    },

    // PACIENTES
    getPatients: async function() {
        await new Promise(resolve => setTimeout(resolve, 50));
        return getTable("patients") || [];
    },

    getPatientById: async function(id) {
        await new Promise(resolve => setTimeout(resolve, 30));
        const patients = getTable("patients") || [];
        return patients.find(p => p.id === id) || null;
    },

    getPatientByDni: async function(dni) {
        await new Promise(resolve => setTimeout(resolve, 30));
        const patients = getTable("patients") || [];
        return patients.find(p => p.dni === dni) || null;
    },

    savePatient: async function(patient) {
        await new Promise(resolve => setTimeout(resolve, 80));
        const patients = getTable("patients") || [];
        
        // Validar si es un paciente nuevo o edición
        if (patient.id) {
            const index = patients.findIndex(p => p.id === patient.id);
            if (index !== -1) {
                patients[index] = patient;
            }
        } else {
            // Verificar DNI duplicado
            const exists = patients.some(p => p.dni === patient.dni);
            if (exists) throw new Error("Ya existe un paciente registrado con ese DNI.");
            
            patient.id = "pat_" + Date.now();
            patient.absences = 0;
            patient.status = "Activo";
            patient.suspensionEnd = null;
            patient.suspensionReason = null;
            patients.push(patient);
        }
        setTable("patients", patients);
        return patient;
    },

    updatePatient: async function(patient) {
        return this.savePatient(patient);
    },

    // TURNOS
    getAppointments: async function() {
        await new Promise(resolve => setTimeout(resolve, 60));
        return getTable("appointments") || [];
    },

    getAppointmentsByPatient: async function(patientId) {
        await new Promise(resolve => setTimeout(resolve, 40));
        const appointments = getTable("appointments") || [];
        return appointments.filter(a => a.patientId === patientId);
    },

    getAppointmentsByDoctor: async function(doctorId) {
        await new Promise(resolve => setTimeout(resolve, 40));
        const appointments = getTable("appointments") || [];
        return appointments.filter(a => a.doctorId === doctorId);
    },

    createAppointment: async function(appData) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verificar si el paciente está suspendido
        const patient = await this.getPatientById(appData.patientId);
        if (!patient) throw new Error("Paciente no encontrado.");
        
        // Verificar suspensión de forma dinámica
        if (patient.status === "Suspendido") {
            const now = new Date();
            const end = new Date(patient.suspensionEnd);
            if (now < end) {
                const diffTime = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
                throw new Error(`Paciente suspendido. No puede solicitar turnos por los próximos ${diffTime} días.`);
            } else {
                // Suspención expirada, levantar automáticamente
                patient.status = "Activo";
                patient.suspensionEnd = null;
                patient.suspensionReason = null;
                await this.updatePatient(patient);
            }
        }

        const appointments = getTable("appointments") || [];
        const duration = parseInt(appData.duration, 10) || 30;
        const requestedStart = timeToMinutes(appData.time);
        const requestedEnd = requestedStart + duration;

        // Verificar superposición (mismo médico, misma fecha y rango de tiempo)
        const overlaps = appointments.some(a => {
            if (a.doctorId !== appData.doctorId || a.date !== appData.date || a.status === "Cancelado") return false;
            const bookedStart = timeToMinutes(a.time);
            const bookedDuration = parseInt(a.duration, 10) || 30;
            const bookedEnd = bookedStart + bookedDuration;
            return rangesOverlap(requestedStart, requestedEnd, bookedStart, bookedEnd);
        });
        if (overlaps) throw new Error("El horario seleccionado ya se encuentra reservado o se superpone con otro turno.");

        const config = getTable("config") || SEED_DATA.config;

        const newApp = {
            id: "app_" + Date.now(),
            patientId: appData.patientId,
            patientName: patient.name,
            doctorId: appData.doctorId,
            doctorName: appData.doctorName,
            specialty: appData.specialty,
            date: appData.date,
            time: appData.time,
            duration: duration,
            status: "Solicitado",
            paid: !!appData.paid,
            paymentMethod: appData.paymentMethod || "",
            price: config.copayDefault
        };

        appointments.push(newApp);
        setTable("appointments", appointments);

        // Registrar notificación automatica
        await this.createNotification({
            type: "Correo",
            recipient: patient.email,
            message: `Su turno con el ${newApp.doctorName} (${newApp.specialty}) para el día ${newApp.date} a las ${newApp.time} hs ha sido SOLICITADO. Estado: Pendiente de Confirmación.`
        });

        return newApp;
    },

    updateAppointmentStatus: async function(appId, newStatus, additionalDetails = {}) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const appointments = getTable("appointments") || [];
        const index = appointments.findIndex(a => a.id === appId);
        if (index === -1) throw new Error("Turno no encontrado.");

        const app = appointments[index];
        const oldStatus = app.status;
        if (newStatus !== null && newStatus !== undefined) {
            app.status = newStatus;
        }

        if (newStatus === "Ausente" && oldStatus !== "Ausente") {
            // Manejar inasistencia del paciente
            const patient = await this.getPatientById(app.patientId);
            if (patient) {
                patient.absences = (patient.absences || 0) + 1;
                const config = getTable("config") || SEED_DATA.config;

                if (patient.absences >= config.maxAbsences) {
                    patient.status = "Suspendido";
                    const endSuspension = new Date();
                    endSuspension.setDate(endSuspension.getDate() + config.penaltyDays);
                    patient.suspensionEnd = endSuspension.toISOString();
                    patient.suspensionReason = `Superó el límite de ${config.maxAbsences} inasistencias configurado en el sistema.`;
                    
                    // Notificación de suspensión
                    await this.createNotification({
                        type: "Correo",
                        recipient: patient.email,
                        message: `ALERTA DE SUSPENSIÓN: Su cuenta de paciente ha sido suspendida temporalmente por 30 días debido a la acumulación de ${patient.absences} inasistencias.`
                    });
                } else {
                    await this.createNotification({
                        type: "Correo",
                        recipient: patient.email,
                        message: `Notificación de Inasistencia: Se ha registrado una ausencia para su turno del ${app.date} a las ${app.time}. Inasistencias acumuladas: ${patient.absences}/${config.maxAbsences}.`
                    });
                }
                await this.updatePatient(patient);
            }
        }

        if (additionalDetails.paid !== undefined) {
            app.paid = additionalDetails.paid;
        }

        setTable("appointments", appointments);

        // Enviar correos de notificación simulados según el cambio de estado
        const patientObj = await this.getPatientById(app.patientId);
        if (patientObj) {
            let msg = "";
            if (newStatus === "Confirmado") {
                msg = `Su turno con el ${app.doctorName} el ${app.date} a las ${app.time} hs ha sido CONFIRMADO por la administración.`;
            } else if (newStatus === "Cancelado") {
                msg = `Su turno con el ${app.doctorName} el ${app.date} a las ${app.time} hs ha sido CANCELADO.`;
            } else if (newStatus === "Atendido") {
                msg = `Su consulta con el ${app.doctorName} ha finalizado. Ya puede consultar las indicaciones y recetas en su Historial Médico Digital.`;
            }

            if (msg) {
                await this.createNotification({
                    type: "Correo",
                    recipient: patientObj.email,
                    message: msg
                });
            }
        }

        return app;
    },

    // HISTORIAL CLINICO
    getMedicalHistoryByPatient: async function(patientId) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const history = getTable("medicalHistory") || [];
        return history.filter(h => h.patientId === patientId);
    },

    createMedicalRecord: async function(recordData) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const history = getTable("medicalHistory") || [];
        
        const newRecord = {
            id: "hist_" + Date.now(),
            patientId: recordData.patientId,
            patientName: recordData.patientName,
            doctorId: recordData.doctorId,
            doctorName: recordData.doctorName,
            date: recordData.date,
            diagnostic: recordData.diagnostic,
            observations: recordData.observations,
            indications: recordData.indications,
            recipe: recordData.recipe || "",
            attachments: recordData.attachments || []
        };

        history.push(newRecord);
        setTable("medicalHistory", history);

        // Actualizar estado del turno a Atendido
        if (recordData.appointmentId) {
            await this.updateAppointmentStatus(recordData.appointmentId, "Atendido");
        }

        return newRecord;
    },

    // NOTIFICACIONES
    getNotifications: async function() {
        await new Promise(resolve => setTimeout(resolve, 40));
        const logs = getTable("notificationLogs") || [];
        // Ordenar del más reciente al más antiguo
        return logs.reverse();
    },

    createNotification: async function(notData) {
        await new Promise(resolve => setTimeout(resolve, 30));
        const logs = getTable("notificationLogs") || [];
        const newLog = {
            id: "not_" + Date.now(),
            type: notData.type, // Correo, WhatsApp
            recipient: notData.recipient,
            message: notData.message,
            date: new Date().toISOString(),
            status: notData.status || "Enviado"
        };
        logs.push(newLog);
        setTable("notificationLogs", logs);
        return newLog;
    },

    updateAppointmentSchedule: async function(appId, newDate, newTime) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const appointments = getTable("appointments") || [];
        const idx = appointments.findIndex(a => a.id === appId);
        if (idx === -1) throw new Error("Turno no encontrado.");

        const appointment = appointments[idx];
        const duration = parseInt(appointment.duration, 10) || 30;
        const requestedStart = timeToMinutes(newTime);
        const requestedEnd = requestedStart + duration;

        const overlaps = appointments.some(a => {
            if (a.id === appId || a.doctorId !== appointment.doctorId || a.date !== newDate || a.status === "Cancelado") return false;
            const bookedStart = timeToMinutes(a.time);
            const bookedDuration = parseInt(a.duration, 10) || 30;
            const bookedEnd = bookedStart + bookedDuration;
            return rangesOverlap(requestedStart, requestedEnd, bookedStart, bookedEnd);
        });
        if (overlaps) throw new Error("No se puede adelantar el turno porque el horario elegido se superpone con otro turno.");

        appointment.date = newDate;
        appointment.time = newTime;
        setTable("appointments", appointments);

        const patientObj = await this.getPatientById(appointment.patientId);
        if (patientObj) {
            await this.createNotification({
                type: "Correo",
                recipient: patientObj.email,
                message: `Su turno con el ${appointment.doctorName} ha sido adelantado al ${appointment.date} a las ${appointment.time} hs.`
            });
        }

        return appointment;
    },

    // CONFIGURACIÓN GLOBAL
    getSystemConfig: async function() {
        await new Promise(resolve => setTimeout(resolve, 20));
        return getTable("config") || SEED_DATA.config;
    },

    saveSystemConfig: async function(newConfig) {
        await new Promise(resolve => setTimeout(resolve, 50));
        setTable("config", newConfig);
        return newConfig;
    },

    // OBTENER DISPONIBILIDAD DE UN MÉDICO
    getDoctorAvailability: async function(doctorId, dateString, durationMinutes = 30) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const doctor = await this.getDoctorById(doctorId);
        if (!doctor) throw new Error("Médico no encontrado.");

        const date = new Date(dateString + "T00:00:00");
        const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, etc.

        // Verificar si trabaja ese día de la semana
        if (!doctor.workDays.includes(dayOfWeek)) {
            return []; // No atiende este día
        }

        const slots = [];
        const [startHour, startMin] = doctor.workHours.start.split(":").map(Number);
        const [endHour, endMin] = doctor.workHours.end.split(":").map(Number);

        const startOfDay = timeToMinutes(doctor.workHours.start);
        const endOfDay = timeToMinutes(doctor.workHours.end);

        // Cargar turnos ya agendados para este médico en esta fecha
        const appointments = await this.getAppointments();
        const bookedIntervals = appointments
            .filter(a => a.doctorId === doctorId && a.date === dateString && a.status !== "Cancelado")
            .map(a => {
                const start = timeToMinutes(a.time);
                const duration = parseInt(a.duration, 10) || 30;
                return { start, end: start + duration };
            });

        for (let current = startOfDay; current + durationMinutes <= endOfDay; current += 15) {
            const slotEnd = current + durationMinutes;
            const available = !bookedIntervals.some(interval => rangesOverlap(current, slotEnd, interval.start, interval.end));
            slots.push({
                time: minutesToTime(current),
                available
            });
        }

        return slots;
    }
};

// Exponer la base de datos al ámbito global
window.db = db;
