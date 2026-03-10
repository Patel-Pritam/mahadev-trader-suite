import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FileText, Users, TrendingUp, RefreshCw, ArrowUpRight, AlertTriangle, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StockRefillDialog } from "@/components/StockRefillDialog";
import { LowStockAlerts } from "@/components/LowStockAlerts";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";

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
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingInvoices, setPendingInvoices] = useState(0);

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
    const lowStock = stockData?.filter(item => Number(item.quantity) < 10).length || 0;

    const { data: invoicesData, count: invoices } = await supabase
      .from('invoices')
      .select('total_amount, payment_type', { count: 'exact' });
    const invoicesTotalAmount = invoicesData?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
    const pending = invoicesData?.filter(inv => inv.payment_type === 'Pending').length || 0;

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
    setLowStockCount(lowStock);
    setPendingInvoices(pending);
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
      label: "TOTAL REVENUE",
      value: `₹${stockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      sub: `${stockCount} items`,
      icon: IndianRupee,
      badge: "+12.5%",
      badgeColor: "text-success",
      onClick: () => navigate("/stock"),
      iconBg: "bg-primary/10 text-primary",
    },
    {
      label: "ACTIVE CUSTOMERS",
      value: customerCount.toString(),
      sub: `₹${customerTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} total`,
      icon: Users,
      badge: `+${Math.max(1, Math.floor(customerCount * 0.032))}`,
      badgeColor: "text-success",
      onClick: () => navigate("/customers"),
      iconBg: "bg-success/10 text-success",
    },
    {
      label: "LOW STOCK ALERTS",
      value: lowStockCount > 0 ? "Action Needed" : "All Good",
      sub: `${lowStockCount} items below threshold`,
      icon: AlertTriangle,
      badge: lowStockCount > 0 ? `${lowStockCount} Urgent` : "✓",
      badgeColor: lowStockCount > 0 ? "text-warning" : "text-success",
      onClick: () => navigate("/stock"),
      iconBg: "bg-warning/10 text-warning",
    },
    {
      label: "PENDING INVOICES",
      value: pendingInvoices.toString(),
      sub: `₹${invoiceTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} total`,
      icon: FileText,
      badge: pendingInvoices > 0 ? "Priority" : "Clear",
      badgeColor: pendingInvoices > 0 ? "text-destructive" : "text-success",
      onClick: () => navigate("/invoices"),
      iconBg: "bg-destructive/10 text-destructive",
    },
  ];

  return (
    <AppLayout
      title="Dashboard Overview"
      subtitle={businessName || ""}
      headerActions={
        <Button onClick={() => navigate("/create-invoice")} className="btn-3d hidden sm:flex">
          <FileText className="mr-2 h-4 w-4" />
          + New Invoice
        </Button>
      }
    >
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card
              key={stat.label}
              onClick={stat.onClick}
              className="group cursor-pointer card-3d border border-border opacity-0 animate-stagger-in"
              style={{ animationDelay: `${index * 0.08}s`, animationFillMode: 'forwards' }}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full bg-muted ${stat.badgeColor}`}>
                    {stat.badge}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase mb-1">{stat.label}</p>
                <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Refill */}
        <div className="opacity-0 animate-slide-up" style={{ animationDelay: '0.35s', animationFillMode: 'forwards' }}>
          <StockRefillDialog onRefillComplete={fetchDashboardData}>
            <Card className="cursor-pointer border border-dashed border-border hover:border-primary/40 transition-all duration-300 hover:shadow-md group card-3d-subtle">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:scale-110 group-hover:rotate-180">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Quick Stock Refill</p>
                  <p className="text-xs text-muted-foreground">Add inventory to multiple items at once</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-all duration-300" />
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
