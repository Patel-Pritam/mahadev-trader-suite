import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopNav } from "@/components/TopNav";
import { Store, ArrowLeft, Plus, FileText, Download, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Invoice {
  id: string;
  customer_id: string | null;
  customer_name: string | null; // Deprecated - for old invoices only
  customer_mobile: string | null; // Deprecated - for old invoices only
  payment_type: string;
  total_amount: number;
  invoice_date: string;
  customers: {
    name: string;
    mobile_number: string;
  } | null;
}

interface InvoiceItem {
  id: string;
  item_name: string;
  quantity: number;
  price: number;
  subtotal: number;
  unit_type: string;
}

const Invoices = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<InvoiceItem[]>([]);

  const { data: invoices = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch invoices with customer details via JOIN
      const { data, error } = await supabase
        .from('invoices')
        .select('*, customers(name, mobile_number)')
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('invoice-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices'
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

  const handleDelete = async () => {
    if (!invoiceToDelete) return;

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", invoiceToDelete);

    if (itemsError) {
      toast({
        title: "Error",
        description: "Failed to delete invoice items",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoiceToDelete);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Invoice deleted successfully"
      });
      refetch();
    }
    
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  };

  const handleShowSummary = async (invoice: Invoice) => {
    const { data: items, error } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id);

    if (error || !items) {
      toast({
        title: "Error",
        description: "Failed to load invoice items",
        variant: "destructive"
      });
      return;
    }

    setSelectedInvoice(invoice);
    setSelectedInvoiceItems(items);
    setSummaryDialogOpen(true);
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    const { data: items, error } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id);

    if (error || !items) {
      toast({
        title: "Error",
        description: "Failed to load invoice items",
        variant: "destructive"
      });
      return;
    }

    const doc = new jsPDF();
    
    // Modern header with gradient effect (simulated with colors)
    doc.setFillColor(155, 81, 224); // Primary purple
    doc.rect(0, 0, 210, 45, 'F');
    
    // Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont(undefined, 'bold');
    doc.text("MAHADEV TRADERS", 105, 20, { align: "center" });
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text("Business Management System", 105, 28, { align: "center" });
    
    // Invoice badge
    doc.setFillColor(251, 146, 60); // Accent orange
    doc.roundedRect(15, 10, 35, 12, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("INVOICE", 32.5, 17, { align: "center" });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Invoice details section
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(15, 55, 180, 35, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 120);
    doc.text("Invoice Details", 20, 62);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text("Invoice ID:", 20, 70);
    doc.setFont(undefined, 'normal');
    doc.text(`#${invoice.id.substring(0, 8).toUpperCase()}`, 60, 70);
    
    doc.setFont(undefined, 'bold');
    doc.text("Date:", 20, 78);
    doc.setFont(undefined, 'normal');
    doc.text(new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }), 60, 78);
    
    doc.setFont(undefined, 'bold');
    doc.text("Payment:", 20, 86);
    doc.setFont(undefined, 'normal');
    
    // Payment type badge
    const paymentColors: Record<string, number[]> = {
      'Cash': [34, 197, 94],
      'Online': [59, 130, 246],
      'Pending': [251, 146, 60]
    };
    const color = paymentColors[invoice.payment_type] || [100, 100, 120];
    doc.setFillColor(color[0], color[1], color[2], 0.1);
    doc.roundedRect(58, 81, 25, 7, 2, 2, 'F');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(invoice.payment_type, 60, 86);
    doc.setTextColor(0, 0, 0);
    
    // Customer section
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 120);
    doc.text("Customer Details", 120, 62);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    const customerName = invoice.customers?.name || invoice.customer_name || 'Unknown';
    const customerMobile = invoice.customers?.mobile_number || invoice.customer_mobile || '-';
    doc.text(customerName, 120, 70);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`Mobile: ${customerMobile}`, 120, 78);
    
    // Items table with modern styling
    autoTable(doc, {
      startY: 100,
      head: [['Item Name', 'Qty', 'Unit', 'Price (Rs.)', 'Amount (Rs.)']],
      body: items.map((item: InvoiceItem) => [
        item.item_name,
        item.quantity.toString(),
        item.unit_type,
        'Rs. ' + item.price.toFixed(2),
        'Rs. ' + item.subtotal.toFixed(2)
      ]),
      foot: [['', '', '', 'Total Amount:', 'Rs. ' + invoice.total_amount.toFixed(2)]],
      theme: 'grid',
      headStyles: {
        fillColor: [155, 81, 224],
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 5
      },
      footStyles: {
        fillColor: [34, 197, 94],
        textColor: [255, 255, 255],
        fontSize: 12,
        fontStyle: 'bold',
        halign: 'right'
      },
      alternateRowStyles: {
        fillColor: [250, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 35, fontStyle: 'bold' }
      }
    });

    // Footer section
    const finalY = (doc as any).lastAutoTable.finalY || 200;
    
    // Thank you message
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(15, finalY + 15, 180, 20, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 120);
    doc.text("Thank you for your business!", 105, finalY + 25, { align: "center" });
    doc.setFontSize(8);
    doc.text("For any queries, please contact us", 105, finalY + 30, { align: "center" });
    
    // Company footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 160);
    doc.text("Generated by Mahadev Traders Business Management System", 105, 285, { align: "center" });

    doc.save(`Invoice-${customerName.replace(/\s+/g, '-')}-${invoice.id.substring(0, 8)}.pdf`);
    
    toast({
      title: "Success",
      description: "Professional invoice PDF downloaded"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-xl shadow-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 animate-fade-in">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/dashboard")}
              className="hover:bg-secondary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-elegant">
              <Store className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Invoices
              </h1>
              <p className="text-xs text-muted-foreground">Manage billing & payments</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <TopNav />

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-card border-2 border-secondary/10 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                Invoice History
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {invoices.length} invoices generated
              </p>
            </div>
            <Button 
              onClick={() => navigate("/create-invoice")}
              variant="gradient"
              size="lg"
              className="shadow-elegant"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Invoice
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-12 h-12 rounded-full border-4 border-secondary/20 border-t-secondary animate-spin"></div>
                <p className="text-muted-foreground mt-4">Loading invoices...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-3xl bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-secondary" />
                </div>
                <p className="text-lg font-semibold mb-2">No invoices yet</p>
                <p className="text-muted-foreground mb-6">Start creating invoices for your customers</p>
                <Button onClick={() => navigate("/create-invoice")} variant="gradient">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Invoice
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/50">
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Customer</TableHead>
                      <TableHead className="font-bold">Mobile</TableHead>
                      <TableHead className="font-bold">Payment</TableHead>
                      <TableHead className="text-right font-bold">Amount</TableHead>
                      <TableHead className="text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice, index) => (
                      <TableRow 
                        key={invoice.id}
                        className="hover:bg-secondary/5 transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <TableCell className="text-muted-foreground">
                          {new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </TableCell>
                        <TableCell 
                          className="font-medium cursor-pointer hover:text-primary transition-colors"
                          onClick={() => handleShowSummary(invoice)}
                        >
                          {invoice.customers?.name || invoice.customer_name || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-secondary">
                          {invoice.customers?.mobile_number || invoice.customer_mobile || '-'}
                        </TableCell>
                        <TableCell>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            invoice.payment_type === 'Cash'
                              ? 'bg-success/10 text-success' 
                              : invoice.payment_type === 'Online'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-accent/10 text-accent'
                          }`}>
                            {invoice.payment_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-success text-base">
                          ₹{invoice.total_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/edit-invoice/${invoice.id}`)}
                              title="Edit"
                              className="hover:bg-primary/10 hover:text-primary"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadPDF(invoice)}
                              title="Download PDF"
                              className="hover:bg-success/10 hover:text-success"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setInvoiceToDelete(invoice.id);
                                setDeleteDialogOpen(true);
                              }}
                              title="Delete"
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Summary</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invoice ID</p>
                  <p className="font-medium">{selectedInvoice.id.substring(0, 8).toUpperCase()}</p>
                </div>
                <div>
                   <p className="text-sm text-muted-foreground">Customer Name</p>
                   <p className="font-medium">{selectedInvoice.customers?.name || selectedInvoice.customer_name || 'Unknown'}</p>
                 </div>
                 <div>
                   <p className="text-sm text-muted-foreground">Mobile Number</p>
                   <p className="font-medium">{selectedInvoice.customers?.mobile_number || selectedInvoice.customer_mobile || '-'}</p>
                 </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Type</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                    selectedInvoice.payment_type === 'Pending' 
                      ? 'bg-destructive/10 text-destructive' 
                      : 'bg-accent/10 text-accent'
                  }`}>
                    {selectedInvoice.payment_type}
                  </span>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-4">Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoiceItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell>{item.unit_type}</TableCell>
                        <TableCell className="text-right">₹{item.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{item.subtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                  <p className="text-2xl font-bold">₹{selectedInvoice.total_amount.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
