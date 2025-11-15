-- Create function to atomically decrement stock
CREATE OR REPLACE FUNCTION public.decrement_stock(
  _stock_item_id uuid,
  _quantity numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_quantity numeric;
BEGIN
  UPDATE stock_items
  SET quantity = quantity - _quantity
  WHERE id = _stock_item_id
    AND user_id = auth.uid()
    AND quantity >= _quantity
  RETURNING quantity INTO _new_quantity;
  
  IF _new_quantity IS NULL THEN
    RAISE EXCEPTION 'Insufficient stock or item not found';
  END IF;
  
  RETURN _new_quantity;
END;
$$;