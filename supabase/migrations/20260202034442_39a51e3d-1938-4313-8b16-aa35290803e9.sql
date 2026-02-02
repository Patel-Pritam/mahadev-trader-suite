-- Add language and notification preference columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS language_preference text NOT NULL DEFAULT 'en',
ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_notifications boolean NOT NULL DEFAULT false;