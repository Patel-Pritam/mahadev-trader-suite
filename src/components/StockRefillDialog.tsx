import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Plus } from "lucide-react";

interface StockItem {
  id: string;
  name: string;
  quantity: number;
  unit_type: string;
  price: number;
}

interface StockRefillDialogProps {
  children: React.ReactNode;
  onRefillComplete?: () => void;
}

export const StockRefillDialog = ({ children, onRefillComplete }: StockRefillDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [refillQuantity, setRefillQuantity] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchStockItems();
    }
  }, [open]);

  const fetchStockItems = async () => {
    const { data, error } = await supabase
      .from("stock_items")
      .select("id, name, quantity, unit_type, price")
      .order("name");

    if (!error && data) {
      setStockItems(data);
    }
  };

  const selectedItem = stockItems.find(item => item.id === selectedItemId);

  const handleRefill = async () => {
    if (!selectedItemId || !refillQuantity) {
      toast({
        title: "Error",
        description: "Please select an item and enter quantity",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseFloat(refillQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("stock_items")
      .update({ 
        quantity: (selectedItem?.quantity || 0) + quantity,
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedItemId);

    setLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to refill stock",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Added ${quantity} ${selectedItem?.unit_type} to ${selectedItem?.name}`,
      });
      setOpen(false);
      setSelectedItemId("");
      setRefillQuantity("");
      onRefillComplete?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Quick Stock Refill
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="stock-item">Select Item</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger id="stock-item">
                <SelectValue placeholder="Choose an item to refill" />
              </SelectTrigger>
              <SelectContent>
                {stockItems.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No items in stock
                  </SelectItem>
                ) : (
                  stockItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} (Current: {item.quantity} {item.unit_type})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedItem && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-medium">{selectedItem.name}</p>
              <p className="text-xs text-muted-foreground">
                Current Stock: {selectedItem.quantity} {selectedItem.unit_type}
              </p>
              <p className="text-xs text-muted-foreground">
                Price: ₹{selectedItem.price.toLocaleString('en-IN')} per {selectedItem.unit_type}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity to Add</Label>
            <div className="flex gap-2">
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={refillQuantity}
                onChange={(e) => setRefillQuantity(e.target.value)}
                placeholder="Enter quantity"
                className="flex-1"
              />
              {selectedItem && (
                <span className="flex items-center text-sm text-muted-foreground px-2">
                  {selectedItem.unit_type}
                </span>
              )}
            </div>
          </div>

          {selectedItem && refillQuantity && !isNaN(parseFloat(refillQuantity)) && parseFloat(refillQuantity) > 0 && (
            <div className="rounded-lg bg-success/10 border border-success/20 p-3">
              <p className="text-sm text-success font-medium">
                New Stock: {(selectedItem.quantity + parseFloat(refillQuantity)).toFixed(2)} {selectedItem.unit_type}
              </p>
            </div>
          )}

          <Button
            onClick={handleRefill}
            disabled={loading || !selectedItemId || !refillQuantity}
            variant="gradient"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            {loading ? "Adding..." : "Add Stock"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
