/**
 * Equipo Comercial Interno — roster para identificar reservas del equipo.
 * Coincidencia por email corporativo y por nombre/alias (sin importar tildes o mayúsculas).
 */
export const NIVEL_PLATAFORMA_EQUIPO_INTERNO = 'Equipo Comercial Interno'

export const BP_SLUG_EQUIPO_INTERNO = 'equipo-comercial-interno'

/** @typedef {{ id: string, nombre: string, emails: string[], aliases: string[] }} MiembroEquipoInterno */

/** @type {MiembroEquipoInterno[]} */
export const MIEMBROS_EQUIPO_COMERCIAL_INTERNO = [
  {
    id: 'matilde-perez',
    nombre: 'Matilde Pérez',
    emails: ['mperez@capitalinteligente.cl', 'matilde.perez@capitalinteligente.cl'],
    aliases: ['Matilde Perez', 'Matilde Pérez'],
  },
  {
    id: 'angelica-lugo',
    nombre: 'Angélica Lugo',
    emails: ['alugo@capitalinteligente.cl', 'angelica.lugo@capitalinteligente.cl'],
    aliases: ['Angelica Lugo', 'Angélica Lugo'],
  },
  {
    id: 'paula-sepulveda',
    nombre: 'Paula Sepúlveda',
    emails: ['psepulveda@capitalinteligente.cl', 'paula.sepulveda@capitalinteligente.cl'],
    aliases: ['Paula Sepulveda', 'Paula Sepúlveda'],
  },
  {
    id: 'katherine-lettich',
    nombre: 'Katherine Lettich',
    emails: ['klettich@capitalinteligente.cl', 'katherine.lettich@capitalinteligente.cl'],
    aliases: ['Katherine lettich', 'Katherine Lettich'],
  },
  {
    id: 'ignacio-miranda',
    nombre: 'Ignacio Miranda',
    emails: ['imiranda@capitalinteligente.cl', 'ignacio.miranda@capitalinteligente.cl'],
    aliases: ['Ignacio Miranda'],
  },
  {
    id: 'andres-balmaceda',
    nombre: 'Andrés Balmaceda',
    emails: ['abalmaceda@capitalinteligente.cl', 'andres.balmaceda@capitalinteligente.cl'],
    aliases: ['Andrés balmaceda', 'Andres Balmaceda', 'Andrés Balmaceda'],
  },
  {
    id: 'lissette-padilla',
    nombre: 'Lissette Padilla',
    emails: ['lpadilla@capitalinteligente.cl', 'lissette.padilla@capitalinteligente.cl'],
    aliases: ['Lissette Padilla', 'Lisette Padilla'],
  },
  {
    id: 'claudia-boccieri',
    nombre: 'Claudia Boccieri',
    emails: [
      'cboccieri@capitalinteligente.cl',
      'cbocchieri@capitalinteligente.cl',
      'claudia.boccieri@capitalinteligente.cl',
    ],
    aliases: ['Claudia Boccieri', 'Claudia Bocchieri'],
  },
]
