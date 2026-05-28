/**
 * Catálogo de BPs / subgrupos Capital Open.
 * `plataforma` = valor de nivel_jerarquia_nombre en reservas y API pública (mapReservaPublica).
 */
export const BP_CATALOG = [
  { slug: 'forza-capital', display: 'Forza Capital', label_origen: 'Equipo Forza Capital', plataforma: 'BP Forza Capital' },
  { slug: 'cfm-inversiones', display: 'CFM Inversiones', label_origen: 'Cristian Farías / CFM inversiones', plataforma: 'BP CFM Invest' },
  { slug: 'olivero-partners', display: 'Olivero Partners', label_origen: 'Olivero Partners / Camilo, JP y Felipe', plataforma: 'BP Olivero Partners' },
  { slug: 'select-capital', display: 'Select Capital', label_origen: 'Emily Rivero / Select Capital', plataforma: 'BP Select Capital' },
  { slug: 'invierte-y-acierta', display: 'Invierte y Acierta', label_origen: 'Daniela Deocares / Invierte y Acierta', plataforma: 'BP Invierte y Acierta' },
  { slug: 'servicios-integrales', display: 'Greca', label_origen: 'Carmen René / Greca Consultores', plataforma: 'BP Greca' },
  { slug: 'jtf-invest', display: 'JTF Invest', label_origen: 'Jimena Tapia / JTF Invest', plataforma: 'BP JTF Invest' },
  { slug: 'marisio-inversiones', display: 'Inversión 360', label_origen: 'Areli Marisio / Inversion 360', plataforma: 'BP Marisio Inversiones' },
  { slug: 'rise-inversiones', display: 'RISE', label_origen: 'Giovanni Marisio / RISE', plataforma: 'BP Marisio Inversiones' },
  { slug: 'prop-inversiones', display: 'Prop Inversiones', label_origen: 'Nicole Del Pilar / Prop Inversiones', plataforma: 'BP Prop Inversiones' },
  { slug: 'skala', display: 'Skala', label_origen: 'Equipo Rosicela Fernandez', plataforma: 'BP Skala' },
  { slug: 'avanti-invest', display: 'Avanti Invest', label_origen: 'Avanti Invest MC / Maria Carolina Pinto', plataforma: 'BP Avanti Invest MC' },
  { slug: 'vanema', display: 'Vanema', label_origen: 'Vanessa Chirinos / VANEMA', plataforma: 'BP Vanema Inversiones' },
  { slug: 'vivvoen', display: 'Vivvoen', label_origen: 'Manuel Duran / Vivvoen', plataforma: 'BP Vivvoen' },
  { slug: 'irc-inversiones', display: 'IRC Inversiones', label_origen: 'Bastián Rodriguez / IRC', plataforma: 'BP IRC Inversiones Inmobiliarias' },
  { slug: 'trama-gestion', display: 'Trama Gestión', label_origen: 'Denyz Leyton / Tramagestion', plataforma: 'Trama Gestion' },
  { slug: 'sinapsis', display: 'Sinapsis', label_origen: 'Equipo Sinapsis / Leandro Rios y Francisco Reyes', plataforma: 'BP Sinapsis' },
  { slug: 'debora-capital', display: 'Debora Capital', label_origen: 'Debora Mendez', plataforma: 'BP Deborah Mendez' },
  { slug: 'sion', display: 'Sion', label_origen: 'Ynes Lastra / SION', plataforma: 'BP Sion' },
  { slug: 'house-family', display: 'House Family', label_origen: 'Rafael Cordero / House Family', plataforma: 'BP House Family' },
  { slug: 'mendoza', display: 'Mendoza Real State', label_origen: 'Francisco Mendoza / Mendoza Real State', plataforma: 'BP Mendoza Inversiones' },
  { slug: 'capital-growth', display: 'Capital Growth', label_origen: 'Paulina Contreras / Capital Growth', plataforma: 'BP Growth Capital' },
  { slug: 'domca', display: 'Domca', label_origen: 'Domca / Hermanos Dominguez', plataforma: 'BP Domca' },
  { slug: 'invest-u', display: 'Invest U', label_origen: 'Olmar Lugo / Invest U', plataforma: 'BP Invest U' },
  { slug: 'neumann-stanley', display: 'Neumann Stanley', label_origen: 'Neumann Stanley / Neuman Stanley Group', plataforma: 'BP Neumann-Stanley Group' },
]

/** @type {Record<string, string>} */
export const BP_SLUG_TO_PLATAFORMA = Object.fromEntries(
  BP_CATALOG.map((b) => [b.slug, b.plataforma])
)

export function bpDisplayBySlug(slug) {
  return BP_CATALOG.find((b) => b.slug === slug)?.display ?? slug
}
