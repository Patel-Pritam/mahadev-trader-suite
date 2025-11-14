import { NavLink } from "@/components/NavLink";
import { Package, FileText, Users, BarChart } from "lucide-react";

export const TopNav = () => {
  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex gap-1">
          <NavLink
            to="/stock"
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent"
            activeClassName="text-foreground border-primary"
          >
            <Package className="h-4 w-4" />
            Stock
          </NavLink>
          <NavLink
            to="/invoices"
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent"
            activeClassName="text-foreground border-primary"
          >
            <FileText className="h-4 w-4" />
            Invoices
          </NavLink>
          <NavLink
            to="/customers"
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent"
            activeClassName="text-foreground border-primary"
          >
            <Users className="h-4 w-4" />
            Customers
          </NavLink>
          <NavLink
            to="/reports"
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent"
            activeClassName="text-foreground border-primary"
          >
            <BarChart className="h-4 w-4" />
            Reports
          </NavLink>
        </div>
      </div>
    </nav>
  );
};
