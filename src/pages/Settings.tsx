import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AppLayout } from "@/components/AppLayout";
import { Save, Building2, LogOut, Sun, Moon, ChevronRight, Globe, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [languagePreference, setLanguagePreference] = useState("en");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
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
      .select("business_name, gst_number, business_address, language_preference, notifications_enabled, email_notifications, sms_notifications")
      .single();

    if (!error && data) {
      setBusinessName(data.business_name || "");
      setGstNumber(data.gst_number || "");
      setBusinessAddress(data.business_address || "");
      setLanguagePreference(data.language_preference || "en");
      setNotificationsEnabled(data.notifications_enabled ?? true);
      setEmailNotifications(data.email_notifications ?? true);
      setSmsNotifications(data.sms_notifications ?? false);
    }
    setLoading(false);
  };

  const handleSave = async (skipBusinessValidation = false) => {
    setSaving(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, business_name")
      .eq("user_id", user.id)
      .single();

    let error;
    if (existingProfile) {
      // Profile exists - update it
      // For language/notification saves, we don't need to update business_name
      const updateData = skipBusinessValidation 
        ? {
            language_preference: languagePreference,
            notifications_enabled: notificationsEnabled,
            email_notifications: emailNotifications,
            sms_notifications: smsNotifications
          }
        : {
            business_name: businessName.trim(),
            gst_number: gstNumber.trim() || null,
            business_address: businessAddress.trim() || null,
            language_preference: languagePreference,
            notifications_enabled: notificationsEnabled,
            email_notifications: emailNotifications,
            sms_notifications: smsNotifications
          };

      if (!skipBusinessValidation && !businessName.trim()) {
        toast({
          title: "Error",
          description: "Business name is required",
          variant: "destructive"
        });
        setSaving(false);
        return;
      }

      ({ error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id));
    } else {
      // Profile doesn't exist - create it
      // For language/notification saves, use default business name if not provided
      const profileBusinessName = businessName.trim() || "My Business";
      
      if (!skipBusinessValidation && !businessName.trim()) {
        toast({
          title: "Error",
          description: "Business name is required",
          variant: "destructive"
        });
        setSaving(false);
        return;
      }

      ({ error } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          business_name: profileBusinessName,
          gst_number: gstNumber.trim() || null,
          business_address: businessAddress.trim() || null,
          language_preference: languagePreference,
          notifications_enabled: notificationsEnabled,
          email_notifications: emailNotifications,
          sms_notifications: smsNotifications
        }));
      
      // Update local state if we used default name
      if (skipBusinessValidation && !businessName.trim()) {
        setBusinessName(profileBusinessName);
      }
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
      <AppLayout title="Settings">
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings" subtitle="Manage your preferences">
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
        <div className="space-y-4">
          {/* Business Profile Section */}
          <Collapsible open={openSection === "profile"} onOpenChange={() => toggleSection("profile")}>
            <Card className="shadow-3d border border-border overflow-hidden animate-fade-in opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
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
                    onClick={() => handleSave()}
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
            <Card className="shadow-card border border-border overflow-hidden animate-fade-in opacity-0" style={{ animationDelay: '0.15s', animationFillMode: 'forwards' }}>
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

          {/* Language Section */}
          <Collapsible open={openSection === "language"} onOpenChange={() => toggleSection("language")}>
            <Card className="shadow-card border border-border overflow-hidden animate-fade-in opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Language</p>
                      <p className="text-sm text-muted-foreground">Choose your preferred language</p>
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${openSection === "language" ? "rotate-90" : ""}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 border-t border-border/50">
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Select value={languagePreference} onValueChange={setLanguagePreference}>
                        <SelectTrigger id="language">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                          <SelectItem value="mr">मराठी (Marathi)</SelectItem>
                          <SelectItem value="gu">ગુજરાતી (Gujarati)</SelectItem>
                          <SelectItem value="ta">தமிழ் (Tamil)</SelectItem>
                          <SelectItem value="te">తెలుగు (Telugu)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={() => handleSave(true)}
                      disabled={saving}
                      variant="gradient"
                      className="w-full"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? "Saving..." : "Save Language"}
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Notifications Section */}
          <Collapsible open={openSection === "notifications"} onOpenChange={() => toggleSection("notifications")}>
            <Card className="shadow-card border border-border overflow-hidden animate-fade-in opacity-0" style={{ animationDelay: '0.25s', animationFillMode: 'forwards' }}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-warning" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">Notifications</p>
                      <p className="text-sm text-muted-foreground">Manage notification preferences</p>
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${openSection === "notifications" ? "rotate-90" : ""}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 border-t border-border/50">
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Enable Notifications</p>
                        <p className="text-sm text-muted-foreground">Receive app notifications</p>
                      </div>
                      <Switch 
                        checked={notificationsEnabled} 
                        onCheckedChange={setNotificationsEnabled}
                      />
                    </div>
                    
                    {notificationsEnabled && (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Email Notifications</p>
                            <p className="text-sm text-muted-foreground">Receive updates via email</p>
                          </div>
                          <Switch 
                            checked={emailNotifications} 
                            onCheckedChange={setEmailNotifications}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">SMS Notifications</p>
                            <p className="text-sm text-muted-foreground">Receive updates via SMS</p>
                          </div>
                          <Switch 
                            checked={smsNotifications} 
                            onCheckedChange={setSmsNotifications}
                          />
                        </div>
                      </>
                    )}
                    
                    <Button 
                      onClick={() => handleSave(true)}
                      disabled={saving}
                      variant="gradient"
                      className="w-full"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? "Saving..." : "Save Notifications"}
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Logout Section */}
          <Card className="shadow-card border border-destructive/20 overflow-hidden animate-fade-in opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
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
      </div>
    </AppLayout>
  );
};

export default Settings;
