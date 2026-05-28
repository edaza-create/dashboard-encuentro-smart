import { reservaMatchesBroker } from '../utils/brokerReservaMatch.js'

/**
 * Competencia Capital Open Equipos — datos por broker/BP.
 *
 * `nombresPlataforma`: valores de `nivel_jerarquia_nombre` en reservas (PostgREST / mock).
 * `emails` / `bpSlugs`: mapeo desde roster oficial (`asesores-bp.json`).
 * `referenciaLista`: nombre en la lista comercial de competencia.
 *
 * `backgroundImage`: ruta en /public (p. ej. /teams/team-williams.png).
 */

/** @typedef {object} BrokerCompetencia
 * @property {string} referenciaLista
 * @property {string[]} [nombresPlataforma]
 * @property {string[]} [emails]
 * @property {string[]} [bpSlugs]
 * @property {string[]} [asesorNombres]
 */

export const EQUIPOS_CAPITAL_ONE = [
  {
    id: 1,
    label: 'Team Williams',
    backgroundImage: '/teams/team-williams.png',
    brokers: [
      {
        referenciaLista: 'CFM Inversiones',
        nombresPlataforma: ['BP CFM Invest'],
        bpSlugs: ['cfm-inversiones'],
      },
      {
        referenciaLista: 'Olivero Partners',
        nombresPlataforma: ['BP Olivero Partners', 'BP Olivero Partner'],
        bpSlugs: ['olivero-partners'],
      },
      {
        referenciaLista: 'Select Capital',
        nombresPlataforma: ['BP Select Capital'],
        bpSlugs: ['select-capital'],
      },
      {
        referenciaLista: 'Forza Capital',
        nombresPlataforma: ['BP Forza Capital', 'MBP-Forza Capital', 'MBP Forza Capital'],
        bpSlugs: ['forza-capital'],
      },
      {
        referenciaLista: 'Invierte y Acierta',
        nombresPlataforma: ['BP Invierte y Acierta', 'Invierte y Acierta', 'MBP Invierte y Acierta'],
        bpSlugs: ['invierte-y-acierta'],
      },
      {
        referenciaLista: 'Neumann Stanley',
        nombresPlataforma: ['BP Neumann-Stanley Group', 'Neumann-Stanley Group'],
        bpSlugs: ['neumann-stanley'],
      },
    ],
  },
  {
    id: 2,
    label: 'Team Djokovic',
    backgroundImage: '/teams/team-djokovic.png',
    brokers: [
      {
        referenciaLista: 'Equipo Interno',
        nombresPlataforma: ['Equipo Comercial Interno'],
      },
      {
        referenciaLista: 'Greca',
        nombresPlataforma: ['BP Greca'],
        bpSlugs: ['servicios-integrales'],
      },
      {
        referenciaLista: 'JTF Invest',
        nombresPlataforma: ['BP JTF Invest', 'JTF Invest', 'MBP JTF Invest'],
        bpSlugs: ['jtf-invest'],
      },
      {
        referenciaLista: 'Inversión 360',
        nombresPlataforma: ['BP Marisio Inversiones', 'MBP Marisio Inversiones', 'Inversión 360'],
        bpSlugs: ['marisio-inversiones', 'rise-inversiones'],
      },
      {
        referenciaLista: 'Prop Inversiones',
        nombresPlataforma: ['BP Prop Inversiones', 'Prop Inversiones', 'Broker En propiedades'],
        bpSlugs: ['prop-inversiones'],
      },
    ],
  },
  {
    id: 3,
    label: 'Team Federer',
    backgroundImage: '/teams/team-federer.png',
    brokers: [
      {
        referenciaLista: 'Skala',
        nombresPlataforma: ['BP Skala', 'MBP Skala', 'Equipo Rosicela Fernandez', 'BP Rosicela Fernández'],
        bpSlugs: ['skala'],
      },
      {
        referenciaLista: 'Avanti Invest',
        nombresPlataforma: ['BP Avanti Invest MC'],
        bpSlugs: ['avanti-invest'],
      },
      {
        referenciaLista: 'Vanema',
        nombresPlataforma: ['BP Vanema Inversiones', 'MBP Vanema Inversiones'],
        bpSlugs: ['vanema'],
      },
      {
        referenciaLista: 'Inm e Inv FIR',
        nombresPlataforma: ['BP Inm e Inv FIR'],
        bpSlugs: ['inm-inv-fir'],
      },
      {
        referenciaLista: 'IRC Inversiones',
        nombresPlataforma: ['BP IRC Inversiones Inmobiliarias'],
        bpSlugs: ['irc-inversiones'],
      },
      {
        referenciaLista: 'Trama Gestión',
        nombresPlataforma: ['Trama Gestion'],
        bpSlugs: ['trama-gestion'],
      },
    ],
  },
  {
    id: 4,
    label: 'Team Alcaraz',
    backgroundImage: '/teams/team-alcaraz.png',
    brokers: [
      {
        referenciaLista: 'Sinapsis',
        nombresPlataforma: ['BP Sinapsis'],
        bpSlugs: ['sinapsis'],
      },
      {
        referenciaLista: 'Nazar Property',
        nombresPlataforma: ['BP Nazar Property'],
        bpSlugs: ['nazar-property'],
      },
      {
        referenciaLista: 'Debora Capital Inmobiliario',
        nombresPlataforma: ['BP Deborah Mendez'],
        bpSlugs: ['debora-capital'],
      },
      {
        referenciaLista: 'Sion',
        nombresPlataforma: ['BP Sion'],
        bpSlugs: ['sion'],
      },
      {
        referenciaLista: 'Vivvoen',
        nombresPlataforma: ['BP Vivvoen', 'Vivvo en', 'VIVVOEN'],
        emails: ['vivvoen@capitalinteligente.cl', 'gsuarez@capitalinteligente.cl'],
        asesorNombres: ['Vivvo en', 'Gabriel Eduardo Chacon'],
        bpSlugs: ['vivvoen'],
      },
      {
        referenciaLista: 'House Family',
        nombresPlataforma: ['BP House Family'],
        bpSlugs: ['house-family'],
      },
    ],
  },
  {
    id: 5,
    label: 'Team Sabalenka',
    backgroundImage: '/teams/team-sabalenka.png',
    brokers: [
      {
        referenciaLista: 'Mendoza Real State',
        nombresPlataforma: ['BP Mendoza Inversiones'],
        bpSlugs: ['mendoza'],
      },
      {
        referenciaLista: 'Capital Growth',
        nombresPlataforma: ['BP Growth Capital'],
        bpSlugs: ['capital-growth'],
      },
      {
        referenciaLista: 'Domca',
        nombresPlataforma: ['BP Domca'],
        bpSlugs: ['domca'],
      },
      {
        referenciaLista: 'Invest U',
        nombresPlataforma: ['BP Invest U'],
        bpSlugs: ['invest-u'],
      },
    ],
  },
]

/** Texto principal en UI: nombre en plataforma o referencia de lista si no hay mapeo. */
export function etiquetaBrokerPlataforma(broker) {
  const n = broker.nombresPlataforma
  if (n?.length) return n[0]
  if (broker.emails?.length) return broker.referenciaLista
  if (broker.bpSlugs?.length) return broker.referenciaLista
  return broker.referenciaLista
}

/** Cuenta reservas que coinciden con el broker (plataforma, email o slug Mayo). */
export function cuentaReservasBroker(reservas, brokerOrNombres) {
  if (!reservas?.length) return 0
  const broker =
    typeof brokerOrNombres === 'object' && brokerOrNombres !== null && 'referenciaLista' in brokerOrNombres
      ? brokerOrNombres
      : { referenciaLista: '', nombresPlataforma: brokerOrNombres ?? [] }

  return reservas.filter((r) => reservaMatchesBroker(r, broker)).length
}
