import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezrroridxfxbuthgjdgq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6cnJvcmlkeGZ4YnV0aGdqZGdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTA3NDAsImV4cCI6MjA2NjU4Njc0MH0.t3nwTj6xmxDsG-QHLnCG81Iaxpfi1LqlYKMYxwgdJ3A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
window.supabase = supabase; 