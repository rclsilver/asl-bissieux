import { ValidationErrors } from '@angular/forms';

export function validateTemplateValues(
  value: string,
  fields?: { name?: string }[] | null
): ValidationErrors | null {
  let data;
  try {
    data = JSON.parse(value);
  } catch {
    return { templateData: 'Le JSON n’est pas valide.' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return { templateData: 'Les valeurs doivent former un objet JSON.' };
  const missing = fields?.find(
    (field) => field.name && !Object.hasOwn(data, field.name)
  );
  return missing
    ? { templateData: `Renseigne la valeur « ${missing.name} ».` }
    : null;
}
