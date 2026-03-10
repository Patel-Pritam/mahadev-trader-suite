import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppLayout } from "@/components/AppLayout";
import { Plus, Search, Trash2, Pencil, Users } from "lucide-react";
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
  const [formData, setFormData] = useState({ name: "", mobile_number: "" });

  const { data: customers = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  useEffect(() => {
    const channel = supabase.channel('customer-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => refetch()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  useEffect(() => { checkAuth(); }, []);
  const checkAuth = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const validatedData = customerSchema.parse({ name: formData.name, mobile_number: formData.mobile_number });
      if (editingCustomer) {
        const { error } = await supabase.from("customers").update({ name: validatedData.name, mobile_number: validatedData.mobile_number }).eq("id", editingCustomer.id);
        if (error) { toast({ title: "Error", description: "Failed to update customer", variant: "destructive" }); } else { toast({ title: "Success", description: "Customer updated" }); refetch(); resetForm(); }
      } else {
        const { error } = await supabase.from("customers").insert([{ name: validatedData.name, mobile_number: validatedData.mobile_number, user_id: user.id }]);
        if (error) { toast({ title: "Error", description: "Failed to add customer", variant: "destructive" }); } else { toast({ title: "Success", description: "Customer added" }); refetch(); resetForm(); }
      }
    } catch (error) { if (error instanceof z.ZodError) { toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" }); } }
  };

  const resetForm = () => { setFormData({ name: "", mobile_number: "" }); setEditingCustomer(null); setOpen(false); };
  const openEditDialog = (customer: Customer) => { setEditingCustomer(customer); setFormData({ name: customer.name, mobile_number: customer.mobile_number }); setOpen(true); };
  const handleDelete = async (customerId: string) => {
    const { error } = await supabase.from("customers").delete().eq('id', customerId);
    if (error) { toast({ title: "Error", description: "Failed to delete customer", variant: "destructive" }); } else { toast({ title: "Success", description: "Customer deleted" }); refetch(); }
  };

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.mobile_number.includes(searchTerm));

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const getAvatarColor = (name: string) => {
    const colors = ['bg-primary/15 text-primary', 'bg-success/15 text-success', 'bg-warning/15 text-warning', 'bg-destructive/15 text-destructive'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <AppLayout
      title="Customer Directory"
      subtitle="Overview of your client portfolio and lifetime value tracking."
      headerActions={
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); setOpen(isOpen); }}>
          <DialogTrigger asChild>
            <Button className="btn-3d" onClick={() => { resetForm(); setOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Add Customer</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border border-border shadow-3d bg-card">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Customer Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input id="mobile" type="tel" placeholder="10-digit mobile number" value={formData.mobile_number} onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })} required className="h-11" />
              </div>
              <Button type="submit" className="w-full h-11 btn-3d">{editingCustomer ? "Update" : "Add"} Customer</Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6">
        {/* Search */}
        <div className="relative max-w-lg animate-fade-in">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, company, or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-11 bg-card border-border" />
        </div>

        {/* Table */}
        <Card className="shadow-3d border border-border animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block w-10 h-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <p className="text-lg font-semibold mb-1">{searchTerm ? "No customers found" : "No customers yet"}</p>
                <p className="text-sm text-muted-foreground mb-6">{searchTerm ? "Try adjusting your search" : "Start building your customer directory"}</p>
                {!searchTerm && <Button onClick={() => setOpen(true)} className="btn-3d"><Plus className="mr-2 h-4 w-4" />Add Your First Customer</Button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/40 border-b border-border">
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Name</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Contact Details</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Added On</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer, index) => (
                      <TableRow key={customer.id} className="hover:bg-muted/30 transition-colors border-b border-border/50 animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(customer.name)}`}>
                              {getInitials(customer.name)}
                            </div>
                            <span className="font-semibold text-sm">{customer.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{customer.mobile_number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(customer.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-success/10 text-success border border-success/20">Active</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(customer)} className="hover:bg-primary/10 hover:text-primary h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive h-8 w-8"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                                  <AlertDialogDescription>Are you sure you want to delete {customer.name}?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(customer.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
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

        {filteredCustomers.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">1-{filteredCustomers.length}</span> of <span className="font-semibold text-primary">{customers.length}</span> customers
          </p>
        )}
      </div>
    </AppLayout>
  );
};

export default Customers;
