import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppLayout } from "@/components/AppLayout";
import { Store, Plus, Pencil, Trash2, Search, Package, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";

const stockItemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(100, "Item name must be less than 100 characters"),
  price: z.number().positive("Price must be positive").max(999999.99, "Price must be less than 1,000,000"),
  quantity: z.number().nonnegative("Quantity cannot be negative").max(999999.99, "Quantity must be less than 1,000,000"),
  unit_type: z.enum(["Kg", "Qty", "L"], { errorMap: () => ({ message: "Please select a valid unit type" }) })
});

interface StockItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit_type: string;
}

const Stock = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({ name: "", price: "", quantity: "", unit_type: "Qty" });

  const { data: items = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['stock-items'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.from('stock_items').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as StockItem[];
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  useEffect(() => {
    const channel = supabase.channel('stock-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, () => refetch()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  useEffect(() => { checkAuth(); }, []);
  const checkAuth = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const validatedData = stockItemSchema.parse({ name: formData.name, price: parseFloat(formData.price), quantity: parseFloat(formData.quantity), unit_type: formData.unit_type });
      const itemData = { name: validatedData.name, price: validatedData.price, quantity: validatedData.quantity, unit_type: validatedData.unit_type, user_id: user.id };
      if (editingItem) {
        const { error } = await supabase.from("stock_items").update(itemData).eq("id", editingItem.id);
        if (error) { toast({ title: "Error", description: "Failed to update item", variant: "destructive" }); } else { toast({ title: "Success", description: "Item updated successfully" }); refetch(); resetForm(); }
      } else {
        const { error } = await supabase.from("stock_items").insert([itemData]);
        if (error) { toast({ title: "Error", description: "Failed to add item", variant: "destructive" }); } else { toast({ title: "Success", description: "Item added successfully" }); refetch(); resetForm(); }
      }
    } catch (error) { if (error instanceof z.ZodError) { toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" }); } }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("stock_items").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: "Failed to delete item", variant: "destructive" }); } else { toast({ title: "Success", description: "Item deleted successfully" }); refetch(); }
  };

  const resetForm = () => { setFormData({ name: "", price: "", quantity: "", unit_type: "Qty" }); setEditingItem(null); setOpen(false); };
  const openEditDialog = (item: StockItem) => { setEditingItem(item); setFormData({ name: item.name, price: item.price.toString(), quantity: item.quantity.toString(), unit_type: item.unit_type }); setOpen(true); };

  const filteredItems = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const inStockCount = items.filter(i => i.quantity >= 10).length;
  const lowStockCount = items.filter(i => i.quantity > 0 && i.quantity < 10).length;
  const outOfStockCount = items.filter(i => i.quantity === 0).length;

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: "Out of Stock", color: "bg-destructive/10 text-destructive border-destructive/20" };
    if (qty < 10) return { label: "Low Stock", color: "bg-warning/10 text-warning border-warning/20" };
    return { label: "In Stock", color: "bg-success/10 text-success border-success/20" };
  };

  return (
    <AppLayout
      title="Inventory Management"
      subtitle="Manage products, stock levels, and pricing"
      headerActions={
        <Button onClick={() => navigate("/add-product")} className="btn-3d">
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Add New Product</span>
          <span className="sm:hidden">Add</span>
        </Button>
      }
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Products", value: items.length, color: "text-foreground" },
            { label: "In Stock", value: inStockCount, color: "text-success" },
            { label: "Low Stock", value: lowStockCount, color: "text-warning" },
            { label: "Out of Stock", value: outOfStockCount, color: "text-destructive" },
          ].map((s, i) => (
            <Card key={s.label} className="card-3d-subtle opacity-0 animate-stagger-in" style={{ animationDelay: `${i * 0.06}s`, animationFillMode: 'forwards' }}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.25s' }}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search SKU, name or category..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-11 bg-card border-border" />
          </div>
        </div>

        {/* Table */}
        <Card className="shadow-3d border border-border animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block w-10 h-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
                <p className="text-muted-foreground mt-4 text-sm">Loading inventory...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-primary" />
                </div>
                <p className="text-lg font-semibold mb-1">{searchTerm ? "No items found" : "No stock items yet"}</p>
                <p className="text-sm text-muted-foreground mb-6">{searchTerm ? "Try a different search term" : "Get started by adding your first inventory item"}</p>
                {!searchTerm && <Button onClick={() => { resetForm(); setOpen(true); }} className="btn-3d"><Plus className="mr-2 h-4 w-4" />Add Your First Item</Button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/40 border-b border-border">
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Product Name</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Current Stock</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Unit Price</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item, index) => {
                      const status = getStockStatus(item.quantity);
                      return (
                        <TableRow key={item.id} className="hover:bg-muted/30 transition-colors border-b border-border/50 animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.unit_type}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`font-bold text-sm ${item.quantity === 0 ? 'text-destructive' : item.quantity < 10 ? 'text-warning' : 'text-foreground'}`}>
                              {item.quantity} {item.unit_type}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-sm">₹{item.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${status.color}`}>
                              {item.quantity === 0 ? <XCircle className="h-3 w-3" /> : item.quantity < 10 ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                              {status.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="hover:bg-primary/10 hover:text-primary h-8 w-8">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive h-8 w-8"><Trash2 className="h-3.5 w-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Stock Item</AlertDialogTitle>
                                    <AlertDialogDescription>Are you sure you want to delete "{item.name}"? This action cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {filteredItems.length > 0 && (
          <p className="text-xs text-muted-foreground animate-fade-in">
            Showing <span className="font-semibold text-foreground">1</span> to <span className="font-semibold text-foreground">{filteredItems.length}</span> of <span className="font-semibold text-primary">{items.length}</span> products
          </p>
        )}
      </div>
    </AppLayout>
  );
};

export default Stock;
