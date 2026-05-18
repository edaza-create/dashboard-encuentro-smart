/**
 * Competencia Capital Open Equipos — datos por broker/BP.
 *
 * `nombresPlataforma`: valores exactos de `nivel_jerarquia_nombre` en reservas (origen plataforma).
 * `referenciaLista`: nombre usado en la lista comercial (solo referencia; la UI prioriza la plataforma).
 *
 * Si `nombresPlataforma` está vacío, no hay coincidencia en el extracto de datos actual.
 *
 * `backgroundImage`: ruta en /public (p. ej. /teams/team-williams.jpg). Se muestra difuminada en la tarjeta de puntuación.
 */

export const EQUIPOS_CAPITAL_ONE = [
  {
    id: 1,
    label: 'Team Williams',
    backgroundImage: '/teams/team-williams.png',
    brokers: [
      { referenciaLista: 'CFM Inversiones', nombresPlataforma: ['BP CFM Invest'] },
      {
        referenciaLista: 'Olivero Partners',
        nombresPlataforma: ['BP Olivero Partners', 'BP Olivero Partner'],
      },
      { referenciaLista: 'Select Capital', nombresPlataforma: ['BP Select Capital'] },
      {
        referenciaLista: 'Forza Capital',
        nombresPlataforma: ['BP Forza Capital', 'MBP-Forza Capital', 'MBP Forza Capital'],
      },
      { referenciaLista: 'Invierte y Acierta', nombresPlataforma: [] },
    ],
  },
  {
    id: 2,
    label: 'Team Djokovic',
    backgroundImage: '/teams/team-djokovic.png',
    brokers: [
      { referenciaLista: 'Equipo Interno', nombresPlataforma: ['Equipo Comercial Interno'] },
      { referenciaLista: 'Greca', nombresPlataforma: ['BP Greca'] },
      { referenciaLista: 'JTF Invest', nombresPlataforma: [] },
      { referenciaLista: 'Inversión 360', nombresPlataforma: [] },
      { referenciaLista: 'Prop Inversiones', nombresPlataforma: [] },
    ],
  },
  {
    id: 3,
    label: 'Team Federer',
    backgroundImage: '/teams/team-federer.png',
    brokers: [
      { referenciaLista: 'Skala', nombresPlataforma: [] },
      {
        referenciaLista: 'Avanti Invest',
        nombresPlataforma: ['BP Avanti Invest MC'],
      },
      {
        referenciaLista: 'Vanema',
        nombresPlataforma: ['BP Vanema Inversiones', 'MBP Vanema Inversiones'],
      },
      {
        referenciaLista: 'IRC Inversiones',
        nombresPlataforma: ['BP IRC Inversiones Inmobiliarias'],
      },
      { referenciaLista: 'Trama Gestión', nombresPlataforma: ['Trama Gestion'] },
    ],
  },
  {
    id: 4,
    label: 'Team Alcaraz',
    backgroundImage: '/teams/team-alcaraz.png',
    brokers: [
      { referenciaLista: 'Sinapsis', nombresPlataforma: ['BP Sinapsis'] },
      {
        referenciaLista: 'Debora Capital Inmobiliario',
        nombresPlataforma: ['BP Deborah Mendez'],
      },
      { referenciaLista: 'Sion', nombresPlataforma: ['BP Sion'] },
      { referenciaLista: 'Vivvoen', nombresPlataforma: [] },
      { referenciaLista: 'House Family', nombresPlataforma: ['BP House Family'] },
    ],
  },
  {
    id: 5,
    label: 'Team Sabalenka',
    backgroundImage: '/teams/team-sabalenka.png',
    brokers: [
      { referenciaLista: 'Mendoza Real State', nombresPlataforma: ['BP Mendoza Inversiones'] },
      { referenciaLista: 'Capital Growth', nombresPlataforma: ['BP Growth Capital'] },
      { referenciaLista: 'Domca', nombresPlataforma: ['BP Domca'] },
      { referenciaLista: 'Invest U', nombresPlataforma: ['BP Invest U'] },
    ],
  },
]

/** Texto principal en UI: nombre en plataforma o referencia de lista si no hay mapeo. */
export function etiquetaBrokerPlataforma(broker) {
  const n = broker.nombresPlataforma
  if (n?.length) return n[0]
  return broker.referenciaLista
}

/** Cuenta reservas cuyo nivel jerárquico coincide con alguno de los nombres de plataforma del broker. */
export function cuentaReservasBroker(reservas, nombresPlataforma) {
  if (!nombresPlataforma?.length || !reservas?.length) return 0
  const set = new Set(nombresPlataforma)
  return reservas.filter((r) => set.has(r.nivel_jerarquia_nombre)).length
}
