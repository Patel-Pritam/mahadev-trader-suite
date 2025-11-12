import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Store, ArrowLeft, TrendingUp, DollarSign, FileText, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Reports = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalSales: 0,
    pendingPayments: 0,
    invoiceCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndFetchStats();
  }, []);

  const checkAuthAndFetchStats = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    fetchStats();
  };

  const fetchStats = async () => {
    setLoading(true);
    
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("total_amount, payment_type");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch report data",
        variant: "destructive"
      });
    } else if (invoices) {
      const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
      const pendingPayments = invoices
        .filter(inv => inv.payment_type === 'Pending')
        .reduce((sum, inv) => sum + Number(inv.total_amount), 0);
      
      setStats({
        totalSales,
        pendingPayments,
        invoiceCount: invoices.length
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Reports</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <>
                  <div className="text-2xl font-bold">₹{stats.totalSales.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">All time revenue</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <Clock className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <>
                  <div className="text-2xl font-bold">₹{stats.pendingPayments.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Awaiting payment</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              <FileText className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats.invoiceCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">All time count</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Sales Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              Advanced reporting features coming soon. You'll be able to generate monthly reports and download PDFs.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Reports;
