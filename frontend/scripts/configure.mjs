import { mkdirSync, writeFileSync } from 'node:fs';

// Liste explicite : aucune autre variable du processus n'est exportee vers Angular.
const environment = {
  apiUrl: process.env.API_BASE_URL || process.env.PUBLIC_API_URL || 'http://localhost:8000',
  supabaseUrl:
    process.env.SUPABASE_URL ||
    process.env.PUBLIC_SUPABASE_URL ||
    'https://koihgmmtxqlbuexewurx.supabase.co',
  supabasePublishableKey:
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_fj4REl_rFskqdHAZztNLBA_Ej4hhyN7',
};

const directory = new URL('../src/environments/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(
  new URL('environment.ts', directory),
  '// Genere par npm run config. Configuration publique uniquement.\n' +
    `export const environment = ${JSON.stringify(environment, null, 2)} as const;\n`,
  'utf8',
);
