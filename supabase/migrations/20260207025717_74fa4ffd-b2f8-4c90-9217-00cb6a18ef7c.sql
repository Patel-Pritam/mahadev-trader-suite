-- Add paid_amount column to track partial payments on pending invoices
ALTER TABLE public.invoices ADD COLUMN paid_amount numeric NOT NULL DEFAULT 0;