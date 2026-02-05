import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface LowStockItem {
  id: string;
  name: string;
  quantity: number;
  unit_type: string;
}

interface LowStockAlertsProps {
  threshold?: number;
  onRefresh?: () => void;
}

export const LowStockAlerts = ({ threshold = 10, onRefresh }: LowStockAlertsProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refillAmounts, setRefillAmounts] = useState<Record<string, string>>({});
  const [refilling, setRefilling] = useState<string | null>(null);

  useEffect(() => {
    fetchLowStockItems();
  }, [threshold]);

  const fetchLowStockItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stock_items")
      .select("id, name, quantity, unit_type")
      .lte("quantity", threshold)
      .order("quantity", { ascending: true });

    if (!error && data) {
      setLowStockItems(data);
    }
    setLoading(false);
  };

  // Subscribe to stock changes
  useEffect(() => {
    const channel = supabase
      .channel('low-stock-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_items',
        },
        () => {
          fetchLowStockItems();
          onRefresh?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threshold, onRefresh]);

  if (loading) {
    return null;
  }

  if (lowStockItems.length === 0) {
    return null;
  }

  const handleQuickRefill = async (item: LowStockItem) => {
    const amount = parseFloat(refillAmounts[item.id] || "0");
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid quantity to add",
        variant: "destructive",
      });
      return;
    }

    setRefilling(item.id);
    const { error } = await supabase
      .from("stock_items")
      .update({ 
        quantity: item.quantity + amount,
        updated_at: new Date().toISOString()
      })
      .eq("id", item.id);

    setRefilling(null);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to refill stock",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Stock Updated",
        description: `Added ${amount} ${item.unit_type} to ${item.name}`,
      });
      setRefillAmounts(prev => ({ ...prev, [item.id]: "" }));
      fetchLowStockItems();
      onRefresh?.();
    }
  };

  const criticalItems = lowStockItems.filter(item => item.quantity <= 5);
  const warningItems = lowStockItems.filter(item => item.quantity > 5 && item.quantity <= threshold);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Low Stock Alerts
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/stock")}
          className="text-primary hover:text-primary/80"
        >
          View All Stock
        </Button>
      </div>

      {criticalItems.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-semibold">Critical Stock Level!</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {criticalItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-sm bg-background/50 rounded-md p-2">
                  <div className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <Package className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="text-xs opacity-80">
                      {item.quantity} {item.unit_type} left
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={refillAmounts[item.id] || ""}
                      onChange={(e) => setRefillAmounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="w-16 h-7 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 bg-background hover:bg-primary hover:text-primary-foreground"
                      onClick={() => handleQuickRefill(item)}
                      disabled={refilling === item.id}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {warningItems.length > 0 && (
        <Alert className="border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="font-semibold text-warning">Low Stock Warning</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {warningItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-sm bg-background/50 rounded-md p-2">
                  <div className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <Package className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="text-xs opacity-80">
                      {item.quantity} {item.unit_type} left
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={refillAmounts[item.id] || ""}
                      onChange={(e) => setRefillAmounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="w-16 h-7 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 bg-background hover:bg-primary hover:text-primary-foreground"
                      onClick={() => handleQuickRefill(item)}
                      disabled={refilling === item.id}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
