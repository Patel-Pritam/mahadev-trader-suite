import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Stock = lazy(() => import("./pages/Stock"));
const Invoices = lazy(() => import("./pages/Invoices"));
const CreateInvoice = lazy(() => import("./pages/CreateInvoice"));
const EditInvoice = lazy(() => import("./pages/EditInvoice"));
const Customers = lazy(() => import("./pages/Customers"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <main>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
              <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/stock" element={<Stock />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/create-invoice" element={<CreateInvoice />} />
                <Route path="/edit-invoice/:id" element={<EditInvoice />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
