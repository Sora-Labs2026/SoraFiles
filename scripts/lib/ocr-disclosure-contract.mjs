export const spanishHomepageOcrRequirements = [
  /páginas escaneadas pueden usar OCR local/iu,
  /claridad/iu,
  /idioma/iu,
  /(?:escritura|manuscrit)/iu,
  /tablas/iu,
  /columnas/iu,
  /diseño exacto(?: de la página)? no se reconstruye/iu,
];

export function missingTextRequirements(text, requirements) {
  return requirements.filter((requirement) => !requirement.test(text));
}
