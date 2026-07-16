-- Migration to add trigger_context to incidents table
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS trigger_context JSONB DEFAULT '{}'::jsonb;
