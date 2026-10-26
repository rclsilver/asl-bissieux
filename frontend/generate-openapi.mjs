import { readFileSync, writeFileSync } from 'node:fs';
import { format } from 'prettier';
import { SchemaParser } from '@grafikart/o2ts/dist/SchemaParser.js';

const schema = JSON.parse(readFileSync(process.argv[2] ?? 0, 'utf8'));

// Fizz represents unrestricted map values as additionalProperties: {}.
// JSON Schema gives this the same meaning as true, which o2ts supports.
function normalize(value) {
  if (!value || typeof value !== 'object') return;
  if (value.additionalProperties && typeof value.additionalProperties === 'object'
      && !Array.isArray(value.additionalProperties)
      && Object.keys(value.additionalProperties).length === 0) {
    value.additionalProperties = true;
  }
  for (const child of Object.values(value)) normalize(child);
}

normalize(schema);
const source = new SchemaParser(schema).convertToCode();
writeFileSync('./src/app/core/api/openapi.ts', await format(source, {
  parser: 'typescript', semi: true, singleQuote: true, trailingComma: 'es5',
}));
