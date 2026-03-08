import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { Package, FileText, Users, TrendingUp, RefreshCw, ArrowUpRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StockRefillDialog } from "@/components/StockRefillDialog";
import { LowStockAlerts } from "@/components/LowStockAlerts";
import { AppLayout } from "@/components/AppLayout";

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
      if (!session) navigate("/auth");
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
      else fetchDashboardData();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('user_id', user.id)
        .single();
      if (profile) setBusinessName(profile.business_name);
    }

    const { data: stockData, count: stockItems } = await supabase
      .from('stock_items')
      .select('price, quantity', { count: 'exact' });
    const stockTotalValue = stockData?.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0) || 0;

    const { data: invoicesData, count: invoices } = await supabase
      .from('invoices')
      .select('total_amount', { count: 'exact' });
    const invoicesTotalAmount = invoicesData?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

    const { count: customers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    setStockCount(stockItems || 0);
    setStockValue(stockTotalValue);
    setInvoiceCount(invoices || 0);
    setInvoiceTotal(invoicesTotalAmount);
    setCustomerCount(customers || 0);
    setCustomerTotal(invoicesTotalAmount);
    setTotalSales(invoicesTotalAmount);
  };

  if (loading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const stats = [
    {
      label: "Stock Value",
      value: `₹${stockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      sub: `${stockCount} items`,
      icon: Package,
      onClick: () => navigate("/stock"),
      color: "text-primary bg-primary/10",
    },
    {
      label: "Invoices",
      value: `₹${invoiceTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      sub: `${invoiceCount} created`,
      icon: FileText,
      onClick: () => navigate("/invoices"),
      color: "text-success bg-success/10",
    },
    {
      label: "Customers",
      value: `₹${customerTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      sub: `${customerCount} registered`,
      icon: Users,
      onClick: () => navigate("/customers"),
      color: "text-warning bg-warning/10",
    },
    {
      label: "Total Sales",
      value: `₹${totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      sub: "Revenue",
      icon: TrendingUp,
      onClick: () => navigate("/reports"),
      color: "text-primary bg-primary/10",
    },
  ];

  return (
    <AppLayout
      title={businessName || "Dashboard"}
      subtitle={user?.email || ""}
    >
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat, index) => (
            <Card
              key={stat.label}
              onClick={stat.onClick}
              className="group cursor-pointer border border-border hover:border-primary/30 hover-lift shadow-card opacity-0 animate-stagger-in"
              style={{ animationDelay: `${index * 0.08}s`, animationFillMode: 'forwards' }}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color} transition-transform duration-300 group-hover:scale-110`}>
                    <stat.icon className="h-[18px] w-[18px]" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <p className="text-xl sm:text-2xl font-semibold tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Refill */}
        <div className="opacity-0 animate-slide-up" style={{ animationDelay: '0.35s', animationFillMode: 'forwards' }}>
          <StockRefillDialog onRefillComplete={fetchDashboardData}>
            <Card className="cursor-pointer border border-dashed border-border hover:border-primary/40 transition-all duration-300 hover:shadow-md group">
              <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:scale-110 group-hover:rotate-180">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Quick Stock Refill</p>
                  <p className="text-xs text-muted-foreground">Add inventory to multiple items at once</p>
                </div>
              </CardContent>
            </Card>
          </StockRefillDialog>
        </div>

        {/* Low Stock Alerts */}
        <div className="opacity-0 animate-slide-up" style={{ animationDelay: '0.45s', animationFillMode: 'forwards' }}>
          <LowStockAlerts threshold={10} onRefresh={fetchDashboardData} />
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
