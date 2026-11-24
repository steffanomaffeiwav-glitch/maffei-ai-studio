
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://moavpfojlftchhdugphd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-OZ3ICC6PYwlDuBfEx1cNg_pin97fN9';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
