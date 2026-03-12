import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Store, Mail, Lock, Eye, EyeOff, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import ForgotPasswordDialog from "@/components/ForgotPasswordDialog";

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const emailSchema = z.string().email('Invalid email address');

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/dashboard");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      toast({ title: "Invalid email", description: emailValidation.error.errors[0].message, variant: "destructive" });
      return;
    }

    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      toast({ title: "Invalid password", description: passwordValidation.error.errors[0].message, variant: "destructive" });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure your passwords match.", variant: "destructive" });
      return;
    }

    if (!businessName.trim()) {
      toast({ title: "Business name required", description: "Please enter your business name.", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    if (error) {
      setLoading(false);
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ user_id: data.user.id, business_name: businessName.trim() });

      if (profileError) {
        setLoading(false);
        toast({ title: "Profile creation failed", description: profileError.message, variant: "destructive" });
        return;
      }
    }

    setLoading(false);
    toast({ title: "Success!", description: "Account created successfully. You can now log in." });
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setBusinessName("");
    setIsSignUp(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-md">
            <Store className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">Mahadev Trader</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setEmail("");
              setPassword("");
              setConfirmPassword("");
              setBusinessName("");
            }}
            className="font-medium"
          >
            {isSignUp ? "Sign In" : "Get Started"}
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-[10%] w-72 h-72 bg-primary/[0.03] rounded-full blur-3xl float-slow" />
          <div className="absolute bottom-20 left-[10%] w-96 h-96 bg-primary/[0.02] rounded-full blur-3xl float-slow" style={{ animationDelay: '3s' }} />
        </div>

        <div className="w-full max-w-md relative z-10">
          {/* Title above card */}
          {isSignUp && (
            <div className="text-center mb-8 animate-fade-in">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Create your account</h1>
              <p className="text-muted-foreground mt-2 text-base">Join businesses managing growth effectively.</p>
            </div>
          )}

          {/* Card */}
          <div className="bg-card rounded-2xl border border-border shadow-3d p-8 sm:p-10 card-3d-subtle animate-scale-in">
            {!isSignUp && (
              <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="text-muted-foreground mt-1">Please enter your details to access your dashboard.</p>
              </div>
            )}

            <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-5">
              {isSignUp && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="business-name" className="text-sm font-semibold">Business Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="business-name"
                      type="text"
                      placeholder="Acme Corp"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      required
                      className="pl-10 h-11 bg-muted/50 border-border focus:bg-card transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="alex@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 h-11 bg-muted/50 border-border focus:bg-card transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
                  {!isSignUp && (
                    <button type="button" onClick={() => setForgotPasswordOpen(true)} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-10 h-11 bg-muted/50 border-border focus:bg-card transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isSignUp && (
                  <p className="text-xs text-muted-foreground">Must be at least 8 characters long.</p>
                )}
              </div>

              {isSignUp && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="confirm-password" className="text-sm font-semibold">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 h-11 bg-muted/50 border-border focus:bg-card transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold btn-3d group"
                disabled={loading}
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    {isSignUp ? "Create Account" : "Log In"}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>

            {!isSignUp && (
              <p className="text-center text-sm text-muted-foreground mt-6">
                Don't have an account?{" "}
                <button
                  onClick={() => setIsSignUp(true)}
                  className="text-primary font-semibold hover:text-primary/80 transition-colors"
                >
                  Sign Up
                </button>
              </p>
            )}

            {isSignUp && (
              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <button
                  onClick={() => setIsSignUp(false)}
                  className="text-primary font-semibold hover:text-primary/80 transition-colors"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>

          <ForgotPasswordDialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen} />

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-8 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            © {new Date().getFullYear()} Mahadev Trader. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Auth;
