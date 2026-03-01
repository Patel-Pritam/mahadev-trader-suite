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
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopNav } from "@/components/TopNav";
import { Store, ArrowLeft, Plus, Pencil, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    quantity: "",
    unit_type: "Qty"
  });

  const { data: items = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['stock-items'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('stock_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StockItem[];
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('stock-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_items'
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const validatedData = stockItemSchema.parse({
        name: formData.name,
        price: parseFloat(formData.price),
        quantity: parseFloat(formData.quantity),
        unit_type: formData.unit_type,
      });

      const itemData = {
        name: validatedData.name,
        price: validatedData.price,
        quantity: validatedData.quantity,
        unit_type: validatedData.unit_type,
        user_id: user.id,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("stock_items")
          .update(itemData)
          .eq("id", editingItem.id);

        if (error) {
          toast({
            title: "Error",
            description: "Failed to update item",
            variant: "destructive"
          });
        } else {
          toast({ title: "Success", description: "Item updated successfully" });
          refetch();
          resetForm();
        }
      } else {
        const { error } = await supabase
          .from("stock_items")
          .insert([itemData]);

        if (error) {
          toast({
            title: "Error",
            description: "Failed to add item",
            variant: "destructive"
          });
        } else {
          toast({ title: "Success", description: "Item added successfully" });
          refetch();
          resetForm();
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive"
        });
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("stock_items")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive"
      });
    } else {
      toast({ title: "Success", description: "Item deleted successfully" });
      refetch();
    }
  };

  const resetForm = () => {
    setFormData({ name: "", price: "", quantity: "", unit_type: "Qty" });
    setEditingItem(null);
    setOpen(false);
  };

  const openEditDialog = (item: StockItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price.toString(),
      quantity: item.quantity.toString(),
      unit_type: item.unit_type
    });
    setOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-xl shadow-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 animate-fade-in">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/dashboard")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-elegant">
              <Store className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Stock Management
              </h1>
              <p className="text-xs text-muted-foreground">Manage inventory items</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <TopNav />

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-card border-2 border-primary/10 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-4 pb-6">
            <div className="flex flex-row items-center justify-between gap-3">
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                  Stock Items
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {items.length} items in inventory
                </p>
              </div>
              
              {/* Collapsible Search */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center transition-all duration-300 overflow-hidden ${
                  searchOpen ? 'w-48 sm:w-64' : 'w-0'
                }`}>
                  <Input
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-2 focus:border-primary/50"
                    autoFocus={searchOpen}
                  />
                </div>
                <Button
                  variant={searchOpen ? "default" : "outline"}
                  size="icon"
                  onClick={() => {
                    setSearchOpen(!searchOpen);
                    if (searchOpen) setSearchTerm("");
                  }}
                  className={`flex-shrink-0 ${searchOpen ? 'bg-primary text-primary-foreground' : ''}`}
                >
                  <Search className="h-4 w-4" />
                </Button>

                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => { resetForm(); setOpen(true); }}
                      variant="gradient"
                      className="shadow-elegant flex-shrink-0"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border-2 border-primary/20 shadow-elegant bg-background">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        {editingItem ? "Edit Item" : "Add New Item"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="font-semibold">Item Name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                          className="border-2 focus:border-primary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price" className="font-semibold">Price (₹)</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          required
                          className="border-2 focus:border-primary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quantity" className="font-semibold">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          step="0.01"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                          required
                          className="border-2 focus:border-primary/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unit_type" className="font-semibold">Unit Type</Label>
                        <Select value={formData.unit_type} onValueChange={(value) => setFormData({ ...formData, unit_type: value })}>
                          <SelectTrigger className="border-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-lg z-50">
                            <SelectItem value="Kg">Kg (Kilogram)</SelectItem>
                            <SelectItem value="Qty">Qty (Quantity)</SelectItem>
                            <SelectItem value="L">L (Litre)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" variant="gradient" className="w-full" size="lg">
                        {editingItem ? "Update" : "Add"} Item
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                <p className="text-muted-foreground mt-4">Loading inventory...</p>
              </div>
            ) : (() => {
              const filteredItems = items.filter(item => 
                item.name.toLowerCase().includes(searchTerm.toLowerCase())
              );
              
              return filteredItems.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Store className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-lg font-semibold mb-2">
                    {searchTerm ? "No items found" : "No stock items yet"}
                  </p>
                  <p className="text-muted-foreground mb-6">
                    {searchTerm ? "Try a different search term" : "Get started by adding your first inventory item"}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => { resetForm(); setOpen(true); }} variant="gradient">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Item
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border-2 border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/50">
                        <TableHead className="font-bold">Name</TableHead>
                        <TableHead className="font-bold">Price</TableHead>
                        <TableHead className="font-bold">Quantity</TableHead>
                        <TableHead className="font-bold">Unit</TableHead>
                        <TableHead className="text-right font-bold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item, index) => (
                        <TableRow 
                          key={item.id} 
                          className="hover:bg-primary/5 transition-colors animate-fade-in"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-success font-semibold">₹{item.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`font-semibold ${item.quantity < 10 ? 'text-destructive' : 'text-foreground'}`}>
                              {item.quantity}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                              {item.unit_type}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => openEditDialog(item)}
                                className="hover:bg-primary/10 hover:text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Stock Item</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{item.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>No, Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDelete(item.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Yes, Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Stock;
