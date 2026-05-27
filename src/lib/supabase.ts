import { createClient } from "@supabase/supabase-js";

const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = raw.startsWith("http") ? raw : "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
