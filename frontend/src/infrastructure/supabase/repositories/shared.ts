import { supabase, unwrap } from '../client'

export { supabase, unwrap }
export const cpfEmail = (cpf: string) => `${cpf.replace(/\D/g, '')}@auth.igreja-viagens.invalid`
