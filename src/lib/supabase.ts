import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xgxdstaymvtlxugfsdyk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhneGRzdGF5bXZ0bHh1Z2ZzZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzI4NjcsImV4cCI6MjEwMjU0ODg2N30.J76heFjvqp25RMpSyvX843FzuVV_cgdmU6wYD19RV84';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);