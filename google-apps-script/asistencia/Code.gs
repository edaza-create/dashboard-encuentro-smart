/**
 * ENCUENTRO SMART — Asistencia Google Forms → Dashboard (+15 pts actividades)
 *
 * CONFIGURACIÓN (una vez):
 * 1. Proyecto → ⚙ Configuración → Propiedades del script:
 *      WEBHOOK_URL    = https://TU_PROJECT.supabase.co/functions/v1/forms-asistencia
 *      WEBHOOK_SECRET = (mismo valor que FORMS_WEBHOOK_SECRET en Supabase)
 * 2. Activadores → + Agregar activador → Enviar formulario → onFormSubmit
 *
 * PROBAR sin formulario: ejecutar manualmente → probarWebhook
 */

/** Nombres de columnas del Form (deben coincidir exactamente con el formulario). */
var FORM_KEYS_ = {
  timestamp: "Marca temporal",
  email: "Dirección de correo electrónico",
  nombre: "Nombre Completo",
  modalidad: "¿Cómo estás participando en la reunión?",
  reunion: "¿En que reunión te encuentras?",
};

/**
 * Se ejecuta automáticamente al enviar el formulario.
 * @param {GoogleAppsScript.Events.FormsOnFormSubmit} e
 */
function onFormSubmit(e) {
  if (!e || !e.namedValues) {
    throw new Error("onFormSubmit: evento sin namedValues. ¿Activador ligado al formulario correcto?");
  }
  enviarAsistencia_(e.namedValues);
}

/**
 * Prueba manual desde el editor (▶ Ejecutar → probarWebhook).
 * Ajusta email / modalidad / reunion abajo si quieres.
 */
function probarWebhook() {
  var fakeNamed = {};
  fakeNamed[FORM_KEYS_.timestamp] = [Utilities.formatDate(new Date(), "America/Santiago", "dd/MM/yyyy HH:mm:ss")];
  fakeNamed[FORM_KEYS_.email] = ["klettich@capitalinteligente.cl"];
  fakeNamed[FORM_KEYS_.nombre] = ["Katherine Lettich"];
  fakeNamed[FORM_KEYS_.modalidad] = ["Online"];
  fakeNamed[FORM_KEYS_.reunion] = ["Prueba manual Apps Script"];
  enviarAsistencia_(fakeNamed);
}

/**
 * @param {Object<string, string[]>} named
 */
function enviarAsistencia_(named) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("WEBHOOK_URL");
  var secret = props.getProperty("WEBHOOK_SECRET");

  if (!url || !secret) {
    throw new Error(
      "Faltan propiedades WEBHOOK_URL o WEBHOOK_SECRET. " +
        "Proyecto → Configuración → Propiedades del script."
    );
  }

  var payload = {
    timestamp: pick_(named, FORM_KEYS_.timestamp),
    email: pick_(named, FORM_KEYS_.email),
    nombre: pick_(named, FORM_KEYS_.nombre),
    modalidad: pick_(named, FORM_KEYS_.modalidad),
    reunion: pick_(named, FORM_KEYS_.reunion),
  };

  if (!payload.email) {
    throw new Error("El formulario no trajo email. Revisa la pregunta de correo.");
  }
  if (!payload.reunion) {
    throw new Error("El formulario no trajo reunión. Revisa la pregunta de reunión.");
  }
  if (!payload.modalidad) {
    throw new Error("El formulario no trajo modalidad (Online / Presencial).");
  }

  Logger.log("[forms] Enviando: " + JSON.stringify(payload));

  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { "X-Webhook-Secret": secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  var body = res.getContentText();
  Logger.log("[forms] HTTP " + code + " → " + body);

  if (code === 404) {
    Logger.log(
      "[forms] AVISO: " +
        payload.email +
        " no está en la maestra de asesores. Ejecuta npm run sync:asesores en el dashboard."
    );
    return;
  }

  if (code === 200 || code === 201) {
    Logger.log("[forms] OK — asistencia registrada. Revisa Competencia Equipos / pestaña Asistencia.");
    return;
  }

  throw new Error("Webhook falló (" + code + "): " + body);
}

/**
 * @param {Object<string, string[]>} named
 * @param {string} key
 * @returns {string}
 */
function pick_(named, key) {
  var v = named[key];
  if (Array.isArray(v) && v.length > 0) {
    return String(v[0]).trim();
  }
  return "";
}
