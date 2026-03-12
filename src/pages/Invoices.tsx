import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppLayout } from "@/components/AppLayout";
import { Plus, FileText, Download, Pencil, Trash2, Search, MoreVertical, Eye, CreditCard, Banknote, IndianRupee, TrendingUp, ChevronLeft, ChevronRight, Calendar, SlidersHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Invoice {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  customer_address: string | null;
  payment_type: string;
  document_type: string;
  include_gst: boolean;
  total_amount: number;
  paid_amount: number;
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

type TabFilter = "all" | "paid" | "pending" | "quotation";

const ITEMS_PER_PAGE = 8;

const Invoices = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<InvoiceItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Online">("Cash");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: invoices = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from('invoices')
        .select('*, customers(name, mobile_number)')
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return (data || []).map((inv: any) => ({
        ...inv,
        document_type: inv.document_type || 'Invoice',
        include_gst: inv.include_gst || false
      })) as Invoice[];
    },
    staleTime: 30000,
    gcTime: 300000,
  });

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

  useEffect(() => {
    const channel = supabase
      .channel('invoice-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
    });
  }, []);

  // Stats
  const stats = useMemo(() => {
    const totalReceivables = invoices.reduce((s, i) => s + i.total_amount, 0);
    const paidInvoices = invoices.filter(i => i.payment_type !== 'Pending');
    const pendingInvoices = invoices.filter(i => i.payment_type === 'Pending');
    const paidTotal = paidInvoices.reduce((s, i) => s + i.total_amount, 0);
    const pendingTotal = pendingInvoices.reduce((s, i) => s + i.total_amount, 0);
    const quotations = invoices.filter(i => i.document_type === 'Quotation');
    return {
      totalReceivables,
      paidCount: paidInvoices.length,
      paidTotal,
      pendingCount: pendingInvoices.length,
      pendingTotal,
      quotationCount: quotations.length,
    };
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    // Tab filter
    if (activeTab === "paid") filtered = filtered.filter(i => i.payment_type !== 'Pending');
    else if (activeTab === "pending") filtered = filtered.filter(i => i.payment_type === 'Pending');
    else if (activeTab === "quotation") filtered = filtered.filter(i => i.document_type === 'Quotation');

    // Search
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter((invoice) => {
        const name = invoice.customers?.name || invoice.customer_name || '';
        const mobile = invoice.customers?.mobile_number || invoice.customer_mobile || '';
        const amount = invoice.total_amount.toFixed(2);
        const chronoIdx = invoices.length - invoices.indexOf(invoice);
        const num = String(chronoIdx).padStart(4, '0');
        const date = new Date(invoice.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase();
        return name.toLowerCase().includes(s) || mobile.includes(searchTerm) || amount.includes(searchTerm) || num.includes(searchTerm) || `#${num}`.includes(searchTerm) || date.includes(s) || invoice.payment_type.toLowerCase().includes(s) || invoice.document_type?.toLowerCase().includes(s);
      });
    }

    return filtered;
  }, [invoices, activeTab, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE));
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [activeTab, searchTerm]);

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
      'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-orange-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getStatusBadge = (invoice: Invoice) => {
    if (invoice.payment_type === 'Pending') {
      if ((invoice.paid_amount || 0) > 0) {
        return { label: 'Partial', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' };
      }
      return { label: 'Pending', className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400' };
    }
    return { label: 'Paid', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' };
  };

  // --- All existing handlers (delete, payment, summary, PDF) ---

  const handleDelete = async () => {
    if (!invoiceToDelete) return;
    const { error: itemsError } = await supabase.from("invoice_items").delete().eq("invoice_id", invoiceToDelete);
    if (itemsError) { toast({ title: "Error", description: "Failed to delete invoice items", variant: "destructive" }); return; }
    const { error } = await supabase.from("invoices").delete().eq("id", invoiceToDelete);
    if (error) { toast({ title: "Error", description: "Failed to delete invoice", variant: "destructive" }); }
    else { toast({ title: "Success", description: "Invoice deleted successfully" }); refetch(); }
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  };

  const handleUpdatePaymentType = async (invoiceId: string, newPaymentType: string, invoice: Invoice) => {
    const { error } = await supabase.from("invoices").update({ payment_type: newPaymentType, paid_amount: invoice.total_amount }).eq("id", invoiceId);
    if (error) { toast({ title: "Error", description: "Failed to update payment type", variant: "destructive" }); }
    else { toast({ title: "Updated", description: `Payment marked as ${newPaymentType}` }); refetch(); }
  };

  const handleReceivePayment = async () => {
    if (!paymentInvoice) return;
    const amount = parseFloat(paymentAmount);
    const pendingAmount = paymentInvoice.total_amount - (paymentInvoice.paid_amount || 0);
    if (isNaN(amount) || amount <= 0) { toast({ title: "Invalid amount", description: "Please enter a valid amount", variant: "destructive" }); return; }
    if (amount > pendingAmount) { toast({ title: "Too much", description: `Amount cannot exceed pending ₹${pendingAmount.toFixed(2)}`, variant: "destructive" }); return; }
    const newPaidAmount = (paymentInvoice.paid_amount || 0) + amount;
    const fullyPaid = newPaidAmount >= paymentInvoice.total_amount;
    const { error } = await supabase.from("invoices").update({ paid_amount: newPaidAmount, ...(fullyPaid ? { payment_type: paymentMethod } : {}), }).eq("id", paymentInvoice.id);
    if (error) { toast({ title: "Error", description: "Failed to record payment", variant: "destructive" }); }
    else { toast({ title: fullyPaid ? "Fully Paid" : "Payment Received", description: fullyPaid ? `Invoice fully paid - ₹${paymentInvoice.total_amount.toFixed(2)}` : `₹${amount.toFixed(2)} received. Pending: ₹${(pendingAmount - amount).toFixed(2)}` }); refetch(); }
    setPaymentDialogOpen(false);
    setPaymentInvoice(null);
    setPaymentAmount("");
  };

  const handleShowSummary = async (invoice: Invoice) => {
    const { data: items, error } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoice.id);
    if (error || !items) { toast({ title: "Error", description: "Failed to load invoice items", variant: "destructive" }); return; }
    setSelectedInvoice(invoice);
    setSelectedInvoiceItems(items);
    setSummaryDialogOpen(true);
  };

  const handleDownloadPDF = async (invoice: Invoice, invoiceNumber?: string) => {
    const { data: items, error } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoice.id);
    if (error || !items) { toast({ title: "Error", description: "Failed to load invoice items", variant: "destructive" }); return; }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const documentType = invoice.document_type || 'Invoice';
    const isQuotation = documentType === 'Quotation';
    const showGst = invoice.include_gst && profile?.gst_number;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(profile?.business_name || "MAHADEV TRADERS", pageWidth / 2, 18, { align: "center" });

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    let headerY = 25;
    if (profile?.business_address) { doc.text(profile.business_address, pageWidth / 2, headerY, { align: "center" }); headerY += 5; }
    if (showGst) { doc.text(`GSTIN: ${profile.gst_number}`, pageWidth / 2, headerY, { align: "center" }); headerY += 5; }

    headerY += 3;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(isQuotation ? "QUOTATION" : "TAX INVOICE", pageWidth / 2, headerY, { align: "center" });

    headerY += 5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(15, headerY, pageWidth - 15, headerY);

    const customerName = invoice.customers?.name || invoice.customer_name || 'Walk-in Customer';
    const customerMobile = invoice.customers?.mobile_number || invoice.customer_mobile || '-';
    const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const docNo = invoiceNumber || invoice.id.substring(0, 8).toUpperCase();

    const detailsY = headerY + 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold'); doc.text("Customer", 15, detailsY);
    doc.setFont(undefined, 'normal'); doc.text(`: ${customerName}`, 35, detailsY);
    doc.setFont(undefined, 'bold'); doc.text("Mobile", 15, detailsY + 6);
    doc.setFont(undefined, 'normal'); doc.text(`: ${customerMobile}`, 35, detailsY + 6);
    doc.setFont(undefined, 'bold'); doc.text("Payment", 15, detailsY + 12);
    doc.setFont(undefined, 'normal'); doc.text(`: ${invoice.payment_type}`, 35, detailsY + 12);
    doc.setFont(undefined, 'bold'); doc.text("Date", 130, detailsY);
    doc.setFont(undefined, 'normal'); doc.text(`: ${invoiceDate}`, 145, detailsY);
    doc.setFont(undefined, 'bold'); doc.text(isQuotation ? "Quote No" : "Invoice No", 130, detailsY + 6);
    doc.setFont(undefined, 'normal'); doc.text(`: ${docNo}`, isQuotation ? 150 : 155, detailsY + 6);

    const tableStartY = detailsY + 22;
    autoTable(doc, {
      startY: tableStartY,
      head: [['S.No', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: items.map((item: InvoiceItem, index: number) => [
        (index + 1).toString(), item.item_name, item.quantity.toString(), item.unit_type, `Rs. ${item.price.toFixed(2)}`, `Rs. ${item.subtotal.toFixed(2)}`
      ]),
      theme: 'plain',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 10, fontStyle: 'bold', halign: 'center', cellPadding: 3, lineWidth: 0.3, lineColor: [0, 0, 0] },
      bodyStyles: { fontSize: 10, cellPadding: 3, textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [150, 150, 150] },
      columnStyles: { 0: { halign: 'center', cellWidth: 15 }, 1: { cellWidth: 70 }, 2: { halign: 'center', cellWidth: 20 }, 3: { halign: 'center', cellWidth: 25 }, 4: { halign: 'right', cellWidth: 30 }, 5: { halign: 'right', cellWidth: 30 } },
      margin: { left: 15, right: 15 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
    doc.line(pageWidth - 100, finalY + 5, pageWidth - 15, finalY + 5);
    doc.setFontSize(11); doc.setFont(undefined, 'bold');
    doc.text("Total:", pageWidth - 95, finalY + 12);
    doc.text(`Rs. ${invoice.total_amount.toFixed(2)}`, pageWidth - 18, finalY + 12, { align: 'right' });
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 100, finalY + 16, pageWidth - 15, finalY + 16);

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

    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.text(`Amount in Words: Rupees ${numberToWords(Math.floor(invoice.total_amount))} Only`, 15, finalY + 28);
    doc.setFontSize(9);
    doc.text("Authorised Signature", pageWidth - 50, finalY + 55);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - 70, finalY + 50, pageWidth - 20, finalY + 50);
    doc.save(`${documentType}-${customerName.replace(/\s+/g, '-')}-${docNo}.pdf`);
    toast({ title: "Success", description: `${documentType} PDF downloaded` });
  };

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All Invoices" },
    { key: "paid", label: "Paid" },
    { key: "pending", label: "Pending" },
    { key: "quotation", label: "Quotation" },
  ];

  return (
    <AppLayout
      title="Invoice Management"
      subtitle="Manage, create and track all your outgoing bills"
      headerActions={
        <Button onClick={() => navigate("/create-invoice")} className="btn-3d">
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Create New Invoice</span>
          <span className="sm:hidden">Create</span>
        </Button>
      }
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Receivables",
              value: `₹${stats.totalReceivables.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
              sub: `+12.5% from last month`,
              icon: <TrendingUp className="h-4 w-4" />,
              subColor: "text-emerald-600 dark:text-emerald-400",
            },
            {
              label: "Paid Invoices",
              value: stats.paidCount.toString(),
              sub: `₹${stats.paidTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} total`,
              icon: <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />,
              subColor: "text-emerald-600 dark:text-emerald-400",
            },
            {
              label: "Pending",
              value: stats.pendingCount.toString(),
              sub: `₹${stats.pendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} awaiting`,
              icon: <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />,
              subColor: "text-amber-600 dark:text-amber-400",
            },
            {
              label: "Quotations",
              value: stats.quotationCount.toString(),
              sub: `${invoices.length} total documents`,
              icon: <FileText className="h-4 w-4" />,
              subColor: "text-muted-foreground",
            },
          ].map((s, i) => (
            <Card key={s.label} className="card-3d-subtle opacity-0 animate-stagger-in" style={{ animationDelay: `${i * 0.06}s`, animationFillMode: 'forwards' }}>
              <CardContent className="p-4 sm:p-5">
                <p className="text-xs font-medium text-muted-foreground mb-1">{s.label}</p>
                <p className="text-2xl sm:text-3xl font-bold tracking-tight">{s.value}</p>
                <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${s.subColor}`}>
                  {s.icon}
                  <span>{s.sub}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs & Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 w-[220px] bg-card border-border"
              />
            </div>
          </div>
        </div>

        {/* Invoice Table */}
        <Card className="shadow-3d border border-border animate-fade-in overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block w-10 h-10 rounded-full border-3 border-primary/20 border-t-primary animate-spin"></div>
                <p className="text-muted-foreground mt-4 text-sm">Loading invoices...</p>
              </div>
            ) : paginatedInvoices.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-muted-foreground" />
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
              <div className="overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground pl-6">Invoice #</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Customer</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Date</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Type</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInvoices.map((invoice, index) => {
                      const chronologicalIndex = invoices.length - invoices.indexOf(invoice);
                      const invoiceNumber = String(chronologicalIndex).padStart(4, '0');
                      const customerName = invoice.customers?.name || invoice.customer_name || 'Walk-in';
                      const customerMobile = invoice.customers?.mobile_number || invoice.customer_mobile || '';
                      const status = getStatusBadge(invoice);

                      return (
                        <TableRow
                          key={invoice.id}
                          className="hover:bg-muted/20 transition-colors border-b border-border/50 group"
                        >
                          <TableCell className="font-mono font-semibold text-primary pl-6">
                            INV-{invoiceNumber}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className={`${getAvatarColor(customerName)} text-white text-xs font-bold`}>
                                  {getInitials(customerName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p
                                  className="font-medium text-sm cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => handleShowSummary(invoice)}
                                >
                                  {customerName}
                                </p>
                                {customerMobile && (
                                  <p className="text-xs text-muted-foreground">{customerMobile}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric'
                            })}
                          </TableCell>
                          <TableCell className="font-semibold text-sm">
                            ₹{invoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              invoice.document_type === 'Quotation'
                                ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
                            }`}>
                              {invoice.document_type || 'Invoice'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {invoice.payment_type === 'Pending' ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 ${status.className}`}>
                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                    {status.label} ▾
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem onClick={() => handleUpdatePaymentType(invoice.id, 'Cash', invoice)}>
                                    <Banknote className="mr-2 h-4 w-4 text-emerald-500" />
                                    Paid - Cash
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdatePaymentType(invoice.id, 'Online', invoice)}>
                                    <CreditCard className="mr-2 h-4 w-4 text-blue-500" />
                                    Paid - Online
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setPaymentInvoice(invoice); setPaymentAmount(""); setPaymentDialogOpen(true); }}>
                                    <IndianRupee className="mr-2 h-4 w-4 text-amber-500" />
                                    Receive Partial Payment
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${status.className}`}>
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {invoice.payment_type}
                              </span>
                            )}
                            {invoice.payment_type === 'Pending' && (invoice.paid_amount || 0) > 0 && (
                              <div className="text-[10px] mt-1 text-muted-foreground">
                                Paid: ₹{(invoice.paid_amount || 0).toFixed(2)} | Due: ₹{(invoice.total_amount - (invoice.paid_amount || 0)).toFixed(2)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleShowSummary(invoice)}>
                                  <Eye className="mr-2 h-4 w-4" /> View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/edit-invoice/${invoice.id}`)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadPDF(invoice, invoiceNumber)}>
                                  <Download className="mr-2 h-4 w-4" /> Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setInvoiceToDelete(invoice.id); setDeleteDialogOpen(true); }} className="text-destructive focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
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
            )}
          </CardContent>

          {/* Pagination */}
          {filteredInvoices.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredInvoices.length)}</span> of <span className="font-semibold text-foreground">{filteredInvoices.length}</span> results
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button variant="outline" size="icon" className="h-9 w-9" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Dialogs */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete this invoice? This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
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
                  <div><p className="text-sm text-muted-foreground">Date</p><p className="font-medium">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p></div>
                  <div><p className="text-sm text-muted-foreground">{selectedInvoice.document_type || 'Invoice'} ID</p><p className="font-medium">{selectedInvoice.id.substring(0, 8).toUpperCase()}</p></div>
                  <div><p className="text-sm text-muted-foreground">Type</p><span className={`inline-block px-2 py-1 rounded-full text-xs ${selectedInvoice.document_type === 'Quotation' ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'}`}>{selectedInvoice.document_type || 'Invoice'}</span></div>
                  <div><p className="text-sm text-muted-foreground">Customer Name</p><p className="font-medium">{selectedInvoice.customers?.name || selectedInvoice.customer_name || 'Unknown'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Mobile Number</p><p className="font-medium">{selectedInvoice.customers?.mobile_number || selectedInvoice.customer_mobile || '-'}</p></div>
                  <div><p className="text-sm text-muted-foreground">Payment Type</p><span className={`inline-block px-2 py-1 rounded-full text-xs ${selectedInvoice.payment_type === 'Pending' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'}`}>{selectedInvoice.payment_type}</span></div>
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

        <Dialog open={paymentDialogOpen} onOpenChange={(open) => { setPaymentDialogOpen(open); if (!open) { setPaymentInvoice(null); setPaymentAmount(""); setPaymentMethod("Cash"); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Receive Payment</DialogTitle>
              <DialogDescription>Enter the amount received from the customer</DialogDescription>
            </DialogHeader>
            {paymentInvoice && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Amount:</span><span className="font-semibold">₹{paymentInvoice.total_amount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Already Paid:</span><span className="font-semibold text-emerald-600">₹{(paymentInvoice.paid_amount || 0).toFixed(2)}</span></div>
                  <Separator />
                  <div className="flex justify-between"><span className="text-muted-foreground font-medium">Pending Amount:</span><span className="font-bold text-destructive">₹{(paymentInvoice.total_amount - (paymentInvoice.paid_amount || 0)).toFixed(2)}</span></div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-amount">Amount Received (₹)</Label>
                  <Input id="payment-amount" type="number" placeholder="Enter amount..." value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} min="1" max={paymentInvoice.total_amount - (paymentInvoice.paid_amount || 0)} autoFocus />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={paymentMethod === "Cash" ? "default" : "outline"} className="flex-1" onClick={() => setPaymentMethod("Cash")}>Cash</Button>
                    <Button type="button" variant={paymentMethod === "Online" ? "default" : "outline"} className="flex-1" onClick={() => setPaymentMethod("Online")}>Online</Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleReceivePayment} variant="gradient">
                    <IndianRupee className="mr-2 h-4 w-4" />
                    Receive ₹{paymentAmount || '0'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Invoices;
