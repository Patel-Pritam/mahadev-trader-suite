-- Add GST number and business address to profiles
ALTER TABLE public.profiles 
ADD COLUMN gst_number TEXT,
ADD COLUMN business_address TEXT;

-- Add include_gst flag to invoices (optional per invoice)
ALTER TABLE public.invoices 
ADD COLUMN include_gst BOOLEAN NOT NULL DEFAULT false;