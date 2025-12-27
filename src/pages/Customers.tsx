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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopNav } from "@/components/TopNav";
import { Store, ArrowLeft, Plus, Search, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(100, "Name must be less than 100 characters"),
  mobile_number: z.string().trim().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number starting with 6-9")
});

interface Customer {
  id: string;
  name: string;
  mobile_number: string;
  created_at: string;
}

const Customers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    mobile_number: ""
  });

  const { data: customers = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Customer[];
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('customer-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers'
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
      const validatedData = customerSchema.parse({
        name: formData.name,
        mobile_number: formData.mobile_number,
      });

      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update({
            name: validatedData.name,
            mobile_number: validatedData.mobile_number
          })
          .eq("id", editingCustomer.id);

        if (error) {
          toast({
            title: "Error",
            description: "Failed to update customer",
            variant: "destructive"
          });
        } else {
          toast({ title: "Success", description: "Customer updated successfully" });
          refetch();
          resetForm();
        }
      } else {
        const { error } = await supabase
          .from("customers")
          .insert([{
            name: validatedData.name,
            mobile_number: validatedData.mobile_number,
            user_id: user.id
          }]);

        if (error) {
          toast({
            title: "Error",
            description: "Failed to add customer",
            variant: "destructive"
          });
        } else {
          toast({ title: "Success", description: "Customer added successfully" });
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

  const resetForm = () => {
    setFormData({ name: "", mobile_number: "" });
    setEditingCustomer(null);
    setOpen(false);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      mobile_number: customer.mobile_number
    });
    setOpen(true);
  };

  const handleDelete = async (customerId: string) => {
    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq('id', customerId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete customer",
          variant: "destructive"
        });
      } else {
        toast({ title: "Success", description: "Customer deleted successfully" });
        refetch();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive"
      });
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.mobile_number.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-xl shadow-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 animate-fade-in">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/dashboard")}
              className="hover:bg-accent/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-12 h-12 rounded-2xl gradient-accent flex items-center justify-center shadow-elegant">
              <Store className="w-7 h-7 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                Customers
              </h1>
              <p className="text-xs text-muted-foreground">Manage customer directory</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <TopNav />

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-card border-2 border-accent/10 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                Customer Directory
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {customers.length} registered customers
              </p>
            </div>
            <Dialog open={open} onOpenChange={(isOpen) => {
              if (!isOpen) resetForm();
              setOpen(isOpen);
            }}>
              <DialogTrigger asChild>
                <Button 
                  variant="gradient" 
                  size="lg" 
                  className="shadow-elegant"
                  onClick={() => { resetForm(); setOpen(true); }}
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="border-2 border-accent/20 shadow-elegant">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                    {editingCustomer ? "Edit Customer" : "Add New Customer"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="font-semibold">Customer Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="border-2 focus:border-accent/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile" className="font-semibold">Mobile Number</Label>
                    <Input
                      id="mobile"
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={formData.mobile_number}
                      onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                      required
                      className="border-2 focus:border-accent/50"
                    />
                  </div>
                  <Button type="submit" variant="gradient" className="w-full" size="lg">
                    {editingCustomer ? "Update" : "Add"} Customer
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name or mobile..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 border-2 focus:border-accent/50"
                />
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-12 h-12 rounded-full border-4 border-accent/20 border-t-accent animate-spin"></div>
                <p className="text-muted-foreground mt-4">Loading customers...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-3xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Store className="w-10 h-10 text-accent" />
                </div>
                <p className="text-lg font-semibold mb-2">
                  {searchTerm ? "No customers found" : "No customers yet"}
                </p>
                <p className="text-muted-foreground mb-6">
                  {searchTerm ? "Try adjusting your search" : "Start building your customer directory"}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setOpen(true)} variant="gradient">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Customer
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/50">
                      <TableHead className="font-bold">Name</TableHead>
                      <TableHead className="font-bold">Mobile Number</TableHead>
                      <TableHead className="font-bold">Added On</TableHead>
                      <TableHead className="font-bold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer, index) => (
                      <TableRow 
                        key={customer.id}
                        className="hover:bg-accent/5 transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell className="text-accent font-semibold">{customer.mobile_number}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(customer.created_at).toLocaleDateString('en-IN', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => openEditDialog(customer)}
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
                                  <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {customer.name}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDelete(customer.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
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
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Customers;
