import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htzusibdgkkazffyhdns.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0enVzaWJkZ2trYXpmZnloZG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MTcyMTQsImV4cCI6MjA4ODE5MzIxNH0.QRa6TwR02ltpl5CDwhCWkcH6Z3FzukBR_b4Y_BAd8iU';

export const supabase = createClient(supabaseUrl, supabaseKey);
