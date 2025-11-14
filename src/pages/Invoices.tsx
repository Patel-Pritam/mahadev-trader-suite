import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Store, ArrowLeft, Plus, FileText, Download, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Invoice {
  id: string;
  customer_name: string;
  customer_mobile: string;
  payment_type: string;
  total_amount: number;
  invoice_date: string;
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetchInvoices();
  }, []);

  const checkAuthAndFetchInvoices = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    fetchInvoices();
  };

  const fetchInvoices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("invoice_date", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch invoices",
        variant: "destructive"
      });
    } else {
      setInvoices(data || []);
    }
    setLoading(false);
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
      fetchInvoices();
    }
    
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
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
    
    doc.setFontSize(20);
    doc.text("INVOICE", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, 20, 35);
    doc.text(`Invoice ID: ${invoice.id.substring(0, 8).toUpperCase()}`, 20, 42);
    
    doc.text(`Customer: ${invoice.customer_name}`, 20, 55);
    doc.text(`Mobile: ${invoice.customer_mobile}`, 20, 62);
    doc.text(`Payment: ${invoice.payment_type}`, 20, 69);

    autoTable(doc, {
      startY: 80,
      head: [['Item', 'Quantity', 'Unit', 'Price', 'Subtotal']],
      body: items.map((item: InvoiceItem) => [
        item.item_name,
        item.quantity,
        item.unit_type,
        `₹${item.price.toFixed(2)}`,
        `₹${item.subtotal.toFixed(2)}`
      ]),
      foot: [['', '', '', 'Total:', `₹${invoice.total_amount.toFixed(2)}`]],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`invoice-${invoice.id.substring(0, 8)}.pdf`);
    
    toast({
      title: "Success",
      description: "Invoice PDF downloaded"
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Invoices</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Invoice List</CardTitle>
            <Button onClick={() => navigate("/create-invoice")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No invoices yet. Create your first invoice!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{invoice.customer_name}</TableCell>
                      <TableCell>{invoice.customer_mobile}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          invoice.payment_type === 'Pending' 
                            ? 'bg-destructive/10 text-destructive' 
                            : 'bg-accent/10 text-accent'
                        }`}>
                          {invoice.payment_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">₹{invoice.total_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/edit-invoice/${invoice.id}`)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadPDF(invoice)}
                            title="Download PDF"
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
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
    </div>
  );
};

export default Invoices;
