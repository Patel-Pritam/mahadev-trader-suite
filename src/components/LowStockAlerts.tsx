import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

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
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);

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
            <div className="mt-2 space-y-1">
              {criticalItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Package className="h-3 w-3" />
                    {item.name}
                  </span>
                  <span className="font-medium">
                    {item.quantity} {item.unit_type} remaining
                  </span>
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
            <div className="mt-2 space-y-1">
              {warningItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Package className="h-3 w-3" />
                    {item.name}
                  </span>
                  <span className="font-medium">
                    {item.quantity} {item.unit_type} remaining
                  </span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
