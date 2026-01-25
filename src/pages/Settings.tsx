import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TopNav } from "@/components/TopNav";
import { Store, ArrowLeft, Save, Building2, LogOut, Sun, Moon, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTheme } from "next-themes";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [openSection, setOpenSection] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetchProfile();
  }, []);

  const checkAuthAndFetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    fetchProfile();
  };

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("business_name, gst_number, business_address")
      .single();

    if (!error && data) {
      setBusinessName(data.business_name || "");
      setGstNumber(data.gst_number || "");
      setBusinessAddress(data.business_address || "");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!businessName.trim()) {
      toast({
        title: "Error",
        description: "Business name is required",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    // Try update first, if no rows affected, insert
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    let error;
    if (existingProfile) {
      ({ error } = await supabase
        .from("profiles")
        .update({
          business_name: businessName.trim(),
          gst_number: gstNumber.trim() || null,
          business_address: businessAddress.trim() || null
        })
        .eq("user_id", user.id));
    } else {
      ({ error } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          business_name: businessName.trim(),
          gst_number: gstNumber.trim() || null,
          business_address: businessAddress.trim() || null
        }));
    }

    setSaving(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Settings updated successfully"
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate("/auth");
  };

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5 flex items-center justify-center">
        <div className="inline-block w-12 h-12 rounded-full border-4 border-secondary/20 border-t-secondary animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-xl shadow-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 animate-fade-in">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/dashboard")}
              className="hover:bg-secondary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-elegant">
              <Store className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Settings
              </h1>
              <p className="text-xs text-muted-foreground">Manage your preferences</p>
            </div>
          </div>
        </div>
      </header>
      <TopNav />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-3">
          {/* Business Profile Section */}
          <Collapsible open={openSection === "profile"} onOpenChange={() => toggleSection("profile")}>
            <Card className="shadow-card border-2 border-secondary/10 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm overflow-hidden">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Business Profile</p>
                      <p className="text-sm text-muted-foreground">Name, GST & address</p>
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${openSection === "profile" ? "rotate-90" : ""}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-6 space-y-4 border-t border-border/50">
                  <div className="space-y-2 pt-4">
                    <Label htmlFor="business-name">Business Name *</Label>
                    <Input
                      id="business-name"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Enter your business name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gst-number">GST Number (Optional)</Label>
                    <Input
                      id="gst-number"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                      placeholder="e.g., 22AAAAA0000A1Z5"
                      maxLength={15}
                    />
                    <p className="text-xs text-muted-foreground">
                      Add your GST number to enable GST option on invoices
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business-address">Business Address (Optional)</Label>
                    <Textarea
                      id="business-address"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      placeholder="Enter your business address"
                      rows={3}
                    />
                  </div>

                  <Button 
                    onClick={handleSave} 
                    disabled={saving}
                    variant="gradient"
                    className="w-full"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save Profile"}
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Theme Section */}
          <Collapsible open={openSection === "theme"} onOpenChange={() => toggleSection("theme")}>
            <Card className="shadow-card border-2 border-secondary/10 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm overflow-hidden">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                      {theme === "dark" ? <Moon className="w-5 h-5 text-secondary" /> : <Sun className="w-5 h-5 text-secondary" />}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Appearance</p>
                      <p className="text-sm text-muted-foreground">Light or dark theme</p>
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${openSection === "theme" ? "rotate-90" : ""}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 border-t border-border/50">
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setTheme("light")}
                    >
                      <Sun className="mr-2 h-4 w-4" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setTheme("dark")}
                    >
                      <Moon className="mr-2 h-4 w-4" />
                      Dark
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Logout Section */}
          <Card className="shadow-card border-2 border-destructive/20 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm overflow-hidden">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-4 hover:bg-destructive/5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-destructive" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-destructive">Logout</p>
                  <p className="text-sm text-muted-foreground">Sign out of your account</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-destructive" />
            </button>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
