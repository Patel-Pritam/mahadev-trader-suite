-- Add document_type column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN document_type TEXT NOT NULL DEFAULT 'Invoice' 
CHECK (document_type IN ('Invoice', 'Quotation'));