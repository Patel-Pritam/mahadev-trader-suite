import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopNav } from "@/components/TopNav";
import { Store, ArrowLeft, Plus, FileText, Download, Pencil, Trash2, Search, MoreVertical, Eye, CreditCard, Banknote, Clock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
  document_type: string;
  include_gst: boolean;
  total_amount: number;
  invoice_date: string;
  customers: {
    name: string;
    mobile_number: string;
  } | null;
}

interface Profile {
  business_name: string;
  gst_number: string | null;
  business_address: string | null;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

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
      // Add default document_type for old invoices that might not have it
      return (data || []).map((inv: any) => ({
        ...inv,
        document_type: inv.document_type || 'Invoice',
        include_gst: inv.include_gst || false
      })) as Invoice[];
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  // Fetch profile for business info
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('business_name, gst_number, business_address')
        .single();

      if (error) throw error;
      return data as Profile;
    },
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

  const handleUpdatePaymentType = async (invoiceId: string, newPaymentType: string) => {
    const { error } = await supabase
      .from("invoices")
      .update({ payment_type: newPaymentType })
      .eq("id", invoiceId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update payment type",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Updated",
        description: `Payment type changed to ${newPaymentType}`
      });
      refetch();
    }
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

  const handleDownloadPDF = async (invoice: Invoice, invoiceNumber?: string) => {
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
    const pageWidth = doc.internal.pageSize.getWidth();
    const documentType = invoice.document_type || 'Invoice';
    const isQuotation = documentType === 'Quotation';
    const showGst = invoice.include_gst && profile?.gst_number;
    
    // Simple header - Business name
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(profile?.business_name || "MAHADEV TRADERS", pageWidth / 2, 18, { align: "center" });
    
    // Business address and GST
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    let headerY = 25;
    if (profile?.business_address) {
      doc.text(profile.business_address, pageWidth / 2, headerY, { align: "center" });
      headerY += 5;
    }
    if (showGst) {
      doc.text(`GSTIN: ${profile.gst_number}`, pageWidth / 2, headerY, { align: "center" });
      headerY += 5;
    }
    
    // Document type title
    headerY += 3;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(isQuotation ? "QUOTATION" : "TAX INVOICE", pageWidth / 2, headerY, { align: "center" });
    
    // Simple line
    headerY += 5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(15, headerY, pageWidth - 15, headerY);
    
    // Customer and Invoice details
    const customerName = invoice.customers?.name || invoice.customer_name || 'Walk-in Customer';
    const customerMobile = invoice.customers?.mobile_number || invoice.customer_mobile || '-';
    const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const docNo = invoiceNumber || invoice.id.substring(0, 8).toUpperCase();
    
    const detailsY = headerY + 8;
    doc.setFontSize(10);
    
    // Left side - Customer details
    doc.setFont(undefined, 'bold');
    doc.text("Customer", 15, detailsY);
    doc.setFont(undefined, 'normal');
    doc.text(`: ${customerName}`, 35, detailsY);
    
    doc.setFont(undefined, 'bold');
    doc.text("Mobile", 15, detailsY + 6);
    doc.setFont(undefined, 'normal');
    doc.text(`: ${customerMobile}`, 35, detailsY + 6);
    
    doc.setFont(undefined, 'bold');
    doc.text("Payment", 15, detailsY + 12);
    doc.setFont(undefined, 'normal');
    doc.text(`: ${invoice.payment_type}`, 35, detailsY + 12);
    
    // Right side - Date and Invoice No
    doc.setFont(undefined, 'bold');
    doc.text("Date", 130, detailsY);
    doc.setFont(undefined, 'normal');
    doc.text(`: ${invoiceDate}`, 145, detailsY);
    
    doc.setFont(undefined, 'bold');
    doc.text(isQuotation ? "Quote No" : "Invoice No", 130, detailsY + 6);
    doc.setFont(undefined, 'normal');
    doc.text(`: ${docNo}`, isQuotation ? 150 : 155, detailsY + 6);
    
    // Items table - simple black and white
    const tableStartY = detailsY + 22;
    autoTable(doc, {
      startY: tableStartY,
      head: [['S.No', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: items.map((item: InvoiceItem, index: number) => [
        (index + 1).toString(),
        item.item_name,
        item.quantity.toString(),
        item.unit_type,
        `Rs. ${item.price.toFixed(2)}`,
        `Rs. ${item.subtotal.toFixed(2)}`
      ]),
      theme: 'plain',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 3,
        lineWidth: 0.3,
        lineColor: [0, 0, 0]
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: 3,
        textColor: [0, 0, 0],
        lineWidth: 0.1,
        lineColor: [150, 150, 150]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { cellWidth: 70 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 25 },
        4: { halign: 'right', cellWidth: 30 },
        5: { halign: 'right', cellWidth: 30 }
      },
      margin: { left: 15, right: 15 }
    });

    // Total section
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - 100, finalY + 5, pageWidth - 15, finalY + 5);
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("Total:", pageWidth - 95, finalY + 12);
    doc.text(`Rs. ${invoice.total_amount.toFixed(2)}`, pageWidth - 18, finalY + 12, { align: 'right' });
    
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 100, finalY + 16, pageWidth - 15, finalY + 16);
    
    // Amount in words
    const numberToWords = (num: number): string => {
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      
      if (num === 0) return 'Zero';
      if (num < 20) return ones[num];
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
      if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
      if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
      if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
      return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
    };
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Amount in Words: Rupees ${numberToWords(Math.floor(invoice.total_amount))} Only`, 15, finalY + 28);
    
    // Signature
    doc.setFontSize(9);
    doc.text("Authorised Signature", pageWidth - 50, finalY + 55);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - 70, finalY + 50, pageWidth - 20, finalY + 50);

    doc.save(`${documentType}-${customerName.replace(/\s+/g, '-')}-${docNo}.pdf`);
    
    toast({
      title: "Success",
      description: `${documentType} PDF downloaded`
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
                Invoices & Quotations
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 gap-3">
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                Documents
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {invoices.length} documents generated
              </p>
            </div>
            
            {/* Collapsible Search */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center transition-all duration-300 overflow-hidden ${
                searchOpen ? 'w-48 sm:w-64' : 'w-0'
              }`}>
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-2 focus:border-secondary/50"
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
                className={`flex-shrink-0 ${searchOpen ? 'bg-secondary text-secondary-foreground' : ''}`}
              >
                <Search className="h-4 w-4" />
              </Button>

              <Button 
                onClick={() => navigate("/create-invoice")}
                variant="gradient"
                className="shadow-elegant flex-shrink-0"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-12 h-12 rounded-full border-4 border-secondary/20 border-t-secondary animate-spin"></div>
                <p className="text-muted-foreground mt-4">Loading invoices...</p>
              </div>
            ) : (() => {
              const filteredInvoices = invoices.filter((invoice, _, arr) => {
                if (!searchTerm) return true;
                const customerName = invoice.customers?.name || invoice.customer_name || '';
                const customerMobile = invoice.customers?.mobile_number || invoice.customer_mobile || '';
                const searchLower = searchTerm.toLowerCase();
                const amount = invoice.total_amount.toFixed(2);
                const date = new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric'
                }).toLowerCase();
                // Calculate invoice number
                const chronologicalIndex = arr.length - arr.indexOf(invoice);
                const invoiceNumber = String(chronologicalIndex).padStart(4, '0');
                return (
                  customerName.toLowerCase().includes(searchLower) ||
                  customerMobile.includes(searchTerm) ||
                  invoice.document_type?.toLowerCase().includes(searchLower) ||
                  invoice.payment_type?.toLowerCase().includes(searchLower) ||
                  amount.includes(searchTerm) ||
                  date.includes(searchLower) ||
                  invoiceNumber.includes(searchTerm) ||
                  `#${invoiceNumber}`.includes(searchTerm)
                );
              });

              return filteredInvoices.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-3xl bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-10 h-10 text-secondary" />
                  </div>
                  <p className="text-lg font-semibold mb-2">
                    {searchTerm ? "No invoices found" : "No invoices yet"}
                  </p>
                  <p className="text-muted-foreground mb-6">
                    {searchTerm ? "Try a different search term" : "Start creating invoices for your customers"}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => navigate("/create-invoice")} variant="gradient">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Invoice
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border-2 border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/50">
                        <TableHead className="font-bold">Inv No.</TableHead>
                        <TableHead className="font-bold">Date</TableHead>
                        <TableHead className="font-bold">Type</TableHead>
                        <TableHead className="font-bold">Customer</TableHead>
                        <TableHead className="font-bold">Mobile</TableHead>
                        <TableHead className="font-bold">Payment</TableHead>
                        <TableHead className="text-right font-bold">Amount</TableHead>
                        <TableHead className="text-right font-bold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice, index) => {
                        // Calculate invoice number based on chronological order (oldest = 0001)
                        const chronologicalIndex = invoices.length - invoices.indexOf(invoice);
                        const invoiceNumber = String(chronologicalIndex).padStart(4, '0');
                        
                        return (
                        <TableRow 
                          key={invoice.id}
                          className="hover:bg-secondary/5 transition-colors animate-fade-in"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <TableCell className="font-mono font-semibold text-primary">
                            #{invoiceNumber}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              invoice.document_type === 'Quotation'
                                ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            }`}>
                              {invoice.document_type || 'Invoice'}
                            </span>
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
                            {invoice.payment_type === 'Pending' ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="px-3 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity bg-destructive/10 text-destructive">
                                    Pending ▾
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem onClick={() => handleUpdatePaymentType(invoice.id, 'Cash')}>
                                    <Banknote className="mr-2 h-4 w-4 text-success" />
                                    Cash
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdatePaymentType(invoice.id, 'Online')}>
                                    <CreditCard className="mr-2 h-4 w-4 text-primary" />
                                    Online
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                invoice.payment_type === 'Cash'
                                  ? 'bg-success/10 text-success' 
                                  : 'bg-primary/10 text-primary'
                              }`}>
                                {invoice.payment_type}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-success text-base">
                            ₹{invoice.total_amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleShowSummary(invoice)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/edit-invoice/${invoice.id}`)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadPDF(invoice, invoiceNumber)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setInvoiceToDelete(invoice.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
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
            <DialogTitle>{selectedInvoice?.document_type || 'Invoice'} Summary</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.document_type || 'Invoice'} ID</p>
                  <p className="font-medium">{selectedInvoice.id.substring(0, 8).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                    selectedInvoice.document_type === 'Quotation'
                      ? 'bg-violet-500/10 text-violet-600'
                      : 'bg-blue-500/10 text-blue-600'
                  }`}>
                    {selectedInvoice.document_type || 'Invoice'}
                  </span>
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
