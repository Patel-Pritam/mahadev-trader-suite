import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Store, Package, FileText, Users, TrendingUp, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
                Mahadev Traders
              </h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 animate-fade-in">
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSignOut}
              className="hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
            >
              <LogOut className="h-5 w-5" />
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
              <div className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">Inventory</div>
              <p className="text-xs text-muted-foreground mt-2">
                Track and manage your stock items
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
              <div className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">Billing</div>
              <p className="text-xs text-muted-foreground mt-2">
                Create and manage invoices
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
              <div className="text-2xl font-bold gradient-accent bg-clip-text text-transparent">Directory</div>
              <p className="text-xs text-muted-foreground mt-2">
                Manage customer information
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
              <div className="text-2xl font-bold gradient-success bg-clip-text text-transparent">Analytics</div>
              <p className="text-xs text-muted-foreground mt-2">
                View business insights
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
