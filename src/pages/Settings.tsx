import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopNav } from "@/components/TopNav";
import { Store, ArrowLeft, Save, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");

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

    const { error } = await supabase
      .from("profiles")
      .update({
        business_name: businessName.trim(),
        gst_number: gstNumber.trim() || null,
        business_address: businessAddress.trim() || null
      })
      .eq("user_id", user.id);

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
              <p className="text-xs text-muted-foreground">Business profile & preferences</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <TopNav />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="shadow-card border-2 border-secondary/10 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Business Profile</CardTitle>
                <CardDescription>
                  Update your business details for invoices
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
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
              <p className="text-xs text-muted-foreground">
                This will appear on your invoice headers
              </p>
            </div>

            <Button 
              onClick={handleSave} 
              disabled={saving}
              variant="gradient"
              size="lg"
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
