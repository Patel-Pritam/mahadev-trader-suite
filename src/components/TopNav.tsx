import { NavLink } from "@/components/NavLink";
import { Package, FileText, Users, BarChart } from "lucide-react";

export const TopNav = () => {
  return (
    <nav className="border-b border-border/40 bg-card/80 backdrop-blur-xl shadow-card">
      <div className="container mx-auto px-4">
        <div className="flex gap-1">
          <NavLink
            to="/stock"
            className="group flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-300 border-b-2 border-transparent hover:bg-primary/5 rounded-t-lg"
            activeClassName="text-primary border-primary bg-primary/5"
          >
            <Package className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>Stock</span>
          </NavLink>
          <NavLink
            to="/invoices"
            className="group flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-300 border-b-2 border-transparent hover:bg-secondary/5 rounded-t-lg"
            activeClassName="text-secondary border-secondary bg-secondary/5"
          >
            <FileText className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>Invoices</span>
          </NavLink>
          <NavLink
            to="/customers"
            className="group flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-300 border-b-2 border-transparent hover:bg-accent/5 rounded-t-lg"
            activeClassName="text-accent border-accent bg-accent/5"
          >
            <Users className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>Customers</span>
          </NavLink>
          <NavLink
            to="/reports"
            className="group flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-300 border-b-2 border-transparent hover:bg-success/5 rounded-t-lg"
            activeClassName="text-success border-success bg-success/5"
          >
            <BarChart className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>Reports</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
};
