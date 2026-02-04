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
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Plus, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchStockItems();
      setSearchQuery("");
      setSelectedItemId("");
      setRefillQuantity("");
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

  const filteredItems = stockItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
  };

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
      setSearchQuery("");
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
            <Label>Search & Select Item</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="h-40 rounded-md border">
            <div className="p-2 space-y-1">
              {filteredItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {stockItems.length === 0 ? "No items in stock" : "No items match your search"}
                </p>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item.id)}
                    className={`p-2 rounded-md cursor-pointer transition-colors ${
                      selectedItemId === item.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock: {item.quantity} {item.unit_type} • ₹{item.price.toLocaleString('en-IN')}/{item.unit_type}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {selectedItem && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-medium">Selected: {selectedItem.name}</p>
              <p className="text-xs text-muted-foreground">
                Current Stock: {selectedItem.quantity} {selectedItem.unit_type}
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
