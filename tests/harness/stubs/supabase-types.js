/* The functions import SupabaseClient from esm.sh purely as a type.
   esbuild still has to resolve the module, and fetching from the
   network during a test is not something this suite does, so it
   resolves to nothing instead. */
export const SupabaseClient = class {};
export const createClient = () => { throw new Error('tests must not create a real Supabase client'); };
