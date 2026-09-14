import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bmmehjjycyhbygddsnmq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbWVoamp5Y3loYnlnZGRzbm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzODA2ODksImV4cCI6MjEwNDk1NjY4OX0.lYUNVdJWgMyXCVjTqZyVZt5xC4_NM8yG1uWaSs0gGqQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
