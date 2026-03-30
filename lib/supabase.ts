import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  "https://fobudrkniacatvilbofw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYnVkcmtuaWFjYXR2aWxib2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTMyNTIsImV4cCI6MjA4OTg4OTI1Mn0.sTJfLlS4eY81mkdYN4DTEYqp9KMcKUwI7g-BwNLmK-g"
)