import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.https://fgrbkiaiujdxgvibpgtn.supabase.co;
const supabaseAnonKey = process.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZncmJraWFpdWpkeGd2aWJwZ3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2NTg0NzMsImV4cCI6MjA1ODIzNDQ3M30.36KHAbis7d1w81aX-4B3C8tXrKy6230NIxFu7Fwd3YA;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
