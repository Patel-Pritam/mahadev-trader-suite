-- Make customer_mobile and customer_name nullable since we'll reference customers table
ALTER TABLE public.invoices ALTER COLUMN customer_mobile DROP NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN customer_name DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN public.invoices.customer_mobile IS 'Deprecated: Use customer_id relationship. Kept for historical data.';
COMMENT ON COLUMN public.invoices.customer_name IS 'Deprecated: Use customer_id relationship. Kept for historical data.';