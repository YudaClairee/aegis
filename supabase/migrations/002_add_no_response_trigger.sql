-- Drop the old constraint for trigger_type
ALTER TABLE public.incidents
DROP CONSTRAINT IF EXISTS incidents_trigger_type_check;

-- Re-add check constraint to support 'no_response' trigger type
ALTER TABLE public.incidents
ADD CONSTRAINT incidents_trigger_type_check
CHECK (trigger_type IN ('manual', 'keyword', 'risk_engine', 'notification_button', 'no_response'));
