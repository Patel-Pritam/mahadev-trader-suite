import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Package, FileText, Users, TrendingUp, Settings, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StockRefillDialog } from "@/components/StockRefillDialog";
import { LowStockAlerts } from "@/components/LowStockAlerts";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stockCount, setStockCount] = useState(0);
  const [stockValue, setStockValue] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [totalSales, setTotalSales] = useState(0);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else {
        fetchDashboardData();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchDashboardData = async () => {
    // Fetch business name from profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('user_id', user.id)
        .single();
      
      if (profile) {
        setBusinessName(profile.business_name);
      }
    }

    // Fetch stock items count and total value
    const { data: stockData, count: stockItems } = await supabase
      .from('stock_items')
      .select('price, quantity', { count: 'exact' });
    
    const stockTotalValue = stockData?.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0) || 0;
    
    // Fetch invoices count and total
    const { data: invoicesData, count: invoices } = await supabase
      .from('invoices')
      .select('total_amount', { count: 'exact' });
    
    const invoicesTotalAmount = invoicesData?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
    
    // Fetch customers count and their total invoice amount
    const { count: customers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
    
    // Customer total is same as invoice total (all invoices linked to customers)
    const customersTotalAmount = invoicesTotalAmount;
    
    setStockCount(stockItems || 0);
    setStockValue(stockTotalValue);
    setInvoiceCount(invoices || 0);
    setInvoiceTotal(invoicesTotalAmount);
    setCustomerCount(customers || 0);
    setCustomerTotal(customersTotalAmount);
    setTotalSales(invoicesTotalAmount);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Store className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-xl shadow-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-elegant animate-glow">
              <Store className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {businessName || "Business Manager"}
              </h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 animate-fade-in">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/settings")}
              className="hover:bg-primary/10 hover:text-primary transition-all duration-300"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-10 animate-slide-up">
          <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            Dashboard
          </h2>
          <p className="text-muted-foreground text-lg">Manage your business with ease</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card 
            className="group hover:shadow-elegant transition-all duration-500 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm animate-fade-in hover:-translate-y-1"
            style={{ animationDelay: '0.1s' }}
            onClick={() => navigate("/stock")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Stock Management</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                ₹{stockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stockCount} items in inventory
              </p>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-elegant transition-all duration-500 cursor-pointer border-2 hover:border-secondary/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm animate-fade-in hover:-translate-y-1"
            style={{ animationDelay: '0.2s' }}
            onClick={() => navigate("/invoices")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Invoices</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-secondary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-secondary">
                ₹{invoiceTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {invoiceCount} invoices created
              </p>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-elegant transition-all duration-500 cursor-pointer border-2 hover:border-accent/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm animate-fade-in hover:-translate-y-1"
            style={{ animationDelay: '0.3s' }}
            onClick={() => navigate("/customers")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Customers</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">
                ₹{customerTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {customerCount} registered customers
              </p>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-elegant transition-all duration-500 cursor-pointer border-2 hover:border-success/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm animate-fade-in hover:-translate-y-1"
            style={{ animationDelay: '0.4s' }}
            onClick={() => navigate("/reports")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">Reports</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                ₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Total sales revenue
              </p>
            </CardContent>
          </Card>

          {/* Stock Refill Quick Action */}
          <StockRefillDialog onRefillComplete={fetchDashboardData}>
            <Card 
              className="group hover:shadow-elegant transition-all duration-500 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm animate-fade-in hover:-translate-y-1 border-dashed"
              style={{ animationDelay: '0.5s' }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold">Quick Refill</CardTitle>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <RefreshCw className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-medium text-primary">
                  Add Stock
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Quickly refill inventory
                </p>
              </CardContent>
            </Card>
          </StockRefillDialog>
        </div>

        {/* Low Stock Alerts Section */}
        <div className="mt-8 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <LowStockAlerts threshold={10} onRefresh={fetchDashboardData} />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
