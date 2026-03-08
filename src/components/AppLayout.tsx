import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
}

export function AppLayout({ children, title, subtitle, headerActions }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 sm:px-6 glass sticky top-0 z-10 animate-fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="shrink-0 hover:scale-110 transition-transform duration-200" />
              {title && (
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-semibold truncate">{title}</h1>
                  {subtitle && <p className="text-xs text-muted-foreground truncate hidden sm:block">{subtitle}</p>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
