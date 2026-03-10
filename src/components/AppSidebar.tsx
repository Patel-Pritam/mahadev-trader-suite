import { LayoutDashboard, Package, FileText, Users, BarChart3, Settings, LogOut, Store } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Stock", url: "/stock", icon: Package },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out", description: "You've been logged out." });
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Logo */}
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-md shrink-0">
            <Store className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0 animate-fade-in">
              <p className="text-sm font-bold tracking-tight truncate">Mahadev Trader</p>
              <p className="text-[10px] text-muted-foreground truncate">Business Suite</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item, index) => (
                <SidebarMenuItem
                  key={item.title}
                  className="animate-stagger-in opacity-0"
                  style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
                >
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive(item.url)
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                      activeClassName=""
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={handleSignOut}
          className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 justify-start gap-3 transition-all duration-200"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="text-sm">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
