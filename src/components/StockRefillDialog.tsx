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
import { RefreshCw, Plus, Search, X, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface StockItem {
  id: string;
  name: string;
  quantity: number;
  unit_type: string;
  price: number;
}

interface SelectedItem {
  item: StockItem;
  refillQuantity: string;
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
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      fetchStockItems();
      setSearchQuery("");
      setSelectedItems([]);
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

  const filteredItems = stockItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedItems.some(s => s.item.id === item.id)
  );

  const handleSelectItem = (item: StockItem) => {
    setSelectedItems(prev => [...prev, { item, refillQuantity: "" }]);
    setSearchQuery("");
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(s => s.item.id !== itemId));
  };

  const handleQuantityChange = (itemId: string, quantity: string) => {
    setSelectedItems(prev =>
      prev.map(s => s.item.id === itemId ? { ...s, refillQuantity: quantity } : s)
    );
  };

  const validItems = selectedItems.filter(s => {
    const qty = parseFloat(s.refillQuantity);
    return !isNaN(qty) && qty > 0;
  });

  const handleRefill = async () => {
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Please select items and enter valid quantities", variant: "destructive" });
      return;
    }

    setLoading(true);

    const updates = validItems.map(s => {
      const qty = parseFloat(s.refillQuantity);
      return supabase
        .from("stock_items")
        .update({
          quantity: s.item.quantity + qty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", s.item.id);
    });

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);
    setLoading(false);

    if (errors.length > 0) {
      toast({ title: "Error", description: `Failed to update ${errors.length} item(s)`, variant: "destructive" });
    } else {
      const summary = validItems.map(s => `${s.item.name} +${parseFloat(s.refillQuantity)} ${s.item.unit_type}`).join(", ");
      toast({ title: "Success", description: `Updated: ${summary}` });
      setOpen(false);
      setSelectedItems([]);
      setSearchQuery("");
      onRefillComplete?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Quick Stock Refill
            {selectedItems.length > 0 && (
              <Badge variant="secondary">{selectedItems.length} selected</Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Search & Add Items</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items to add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {searchQuery && (
            <ScrollArea className="h-32 rounded-md border">
              <div className="p-2 space-y-1">
                {filteredItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No items found</p>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className="p-2 rounded-md cursor-pointer transition-colors hover:bg-muted/50"
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
          )}

          {selectedItems.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Items — Enter Quantities</Label>
              <ScrollArea className="max-h-48 rounded-md border">
                <div className="p-2 space-y-2">
                  {selectedItems.map((s) => (
                    <div key={s.item.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{s.item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Current: {s.item.quantity} {s.item.unit_type}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Qty"
                        value={s.refillQuantity}
                        onChange={(e) => handleQuantityChange(s.item.id, e.target.value)}
                        className="w-24 h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground w-8">{s.item.unit_type}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleRemoveItem(s.item.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {selectedItems.length === 0 && !searchQuery && (
            <div className="text-center py-6 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Search and select items to refill</p>
            </div>
          )}

          <Button
            onClick={handleRefill}
            disabled={loading || validItems.length === 0}
            variant="gradient"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            {loading ? "Updating..." : `Update ${validItems.length} Item${validItems.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
