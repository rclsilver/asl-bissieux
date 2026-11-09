import catalogue from './template-variables.json';

export const templateVariableGroups = catalogue.groups;
export const templateSampleData = catalogue.sampleData;
export const automaticTemplateRoots = new Set([
  'member',
  'budget',
  'amount',
  'cotisations',
  'expenses',
]);
