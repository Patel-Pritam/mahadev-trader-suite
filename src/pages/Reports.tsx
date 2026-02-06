import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopNav } from "@/components/TopNav";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Store, ArrowLeft, TrendingUp, DollarSign, FileText, Clock, CalendarIcon, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportInvoice {
  id: string;
  customer_name: string | null;
  customer_mobile: string | null;
  payment_type: string;
  document_type: string;
  total_amount: number;
  invoice_date: string;
  customers: {
    name: string;
    mobile_number: string;
  } | null;
}

const Reports = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));

  const { data: invoices = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['invoices-report'],
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
      })) as ReportInvoice[];
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  // Fetch profile for PDF
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('business_name, gst_number, business_address')
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('invoice-report-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  // Filter invoices by date range
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const invDate = new Date(inv.invoice_date);
      return isWithinInterval(invDate, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
    });
  }, [invoices, dateFrom, dateTo]);

  // Stats for filtered data
  const stats = useMemo(() => {
    const totalSales = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const pendingPayments = filteredInvoices
      .filter(inv => inv.payment_type === 'Pending')
      .reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const cashPayments = filteredInvoices
      .filter(inv => inv.payment_type === 'Cash')
      .reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const onlinePayments = filteredInvoices
      .filter(inv => inv.payment_type === 'Online')
      .reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    return { totalSales, pendingPayments, cashPayments, onlinePayments, invoiceCount: filteredInvoices.length };
  }, [filteredInvoices]);

  const handleDownloadPDF = () => {
    if (filteredInvoices.length === 0) {
      toast({ title: "No data", description: "No invoices found for the selected period", variant: "destructive" });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const periodLabel = `${format(dateFrom, 'dd/MM/yyyy')} - ${format(dateTo, 'dd/MM/yyyy')}`;

    // Header
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(profile?.business_name || "MAHADEV TRADERS", pageWidth / 2, 18, { align: "center" });

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    let headerY = 25;
    if (profile?.business_address) {
      doc.text(profile.business_address, pageWidth / 2, headerY, { align: "center" });
      headerY += 5;
    }

    headerY += 3;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("SALES REPORT", pageWidth / 2, headerY, { align: "center" });

    headerY += 7;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Period: ${periodLabel}`, pageWidth / 2, headerY, { align: "center" });

    // Line
    headerY += 5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(15, headerY, pageWidth - 15, headerY);

    // Summary section
    const summaryY = headerY + 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("Summary", 15, summaryY);

    doc.setFont(undefined, 'normal');
    doc.text(`Total Invoices: ${stats.invoiceCount}`, 15, summaryY + 7);
    doc.text(`Total Sales: Rs. ${stats.totalSales.toFixed(2)}`, 15, summaryY + 13);
    doc.text(`Cash: Rs. ${stats.cashPayments.toFixed(2)}`, 110, summaryY + 7);
    doc.text(`Online: Rs. ${stats.onlinePayments.toFixed(2)}`, 110, summaryY + 13);
    doc.text(`Pending: Rs. ${stats.pendingPayments.toFixed(2)}`, 110, summaryY + 19);

    // Line
    const tableTopY = summaryY + 27;
    doc.setLineWidth(0.3);
    doc.line(15, tableTopY, pageWidth - 15, tableTopY);

    // Invoices table
    autoTable(doc, {
      startY: tableTopY + 3,
      head: [['S.No', 'Date', 'Type', 'Customer', 'Payment', 'Amount']],
      body: filteredInvoices.map((inv, index) => [
        (index + 1).toString(),
        format(new Date(inv.invoice_date), 'dd/MM/yyyy'),
        inv.document_type,
        inv.customers?.name || inv.customer_name || 'Walk-in',
        inv.payment_type,
        `Rs. ${inv.total_amount.toFixed(2)}`
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
        fontSize: 9,
        cellPadding: 3,
        textColor: [0, 0, 0],
        lineWidth: 0.1,
        lineColor: [150, 150, 150]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        1: { halign: 'center', cellWidth: 28 },
        2: { halign: 'center', cellWidth: 25 },
        3: { cellWidth: 50 },
        4: { halign: 'center', cellWidth: 25 },
        5: { halign: 'right', cellWidth: 35 }
      },
      margin: { left: 15, right: 15 }
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY || 200;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - 100, finalY + 5, pageWidth - 15, finalY + 5);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("Grand Total:", pageWidth - 95, finalY + 12);
    doc.text(`Rs. ${stats.totalSales.toFixed(2)}`, pageWidth - 18, finalY + 12, { align: 'right' });
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 100, finalY + 16, pageWidth - 15, finalY + 16);

    doc.save(`Sales-Report-${format(dateFrom, 'dd-MM-yyyy')}-to-${format(dateTo, 'dd-MM-yyyy')}.pdf`);
    toast({ title: "Success", description: "Report PDF downloaded" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <header className="border-b border-border/40 bg-card/80 backdrop-blur-xl shadow-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 animate-fade-in">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="hover:bg-secondary/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-elegant">
              <Store className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Reports
              </h1>
              <p className="text-xs text-muted-foreground">Sales analytics & reports</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <TopNav />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Date Range Picker */}
        <Card className="shadow-card border-2 border-secondary/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Select Time Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal border-2")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => date && setDateFrom(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground font-medium">to</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal border-2")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => date && setDateTo(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              <Button onClick={handleDownloadPDF} variant="gradient" className="shadow-elegant ml-auto">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : (
                <>
                  <div className="text-xl font-bold">₹{stats.totalSales.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stats.invoiceCount} invoices</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : (
                <div className="text-xl font-bold text-success">₹{stats.cashPayments.toFixed(2)}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : (
                <div className="text-xl font-bold text-primary">₹{stats.onlinePayments.toFixed(2)}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : (
                <div className="text-xl font-bold text-destructive">₹{stats.pendingPayments.toFixed(2)}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card className="shadow-card border-2 border-secondary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Invoices ({filteredInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-12 h-12 rounded-full border-4 border-secondary/20 border-t-secondary animate-spin" />
                <p className="text-muted-foreground mt-4">Loading...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-semibold mb-1">No invoices found</p>
                <p className="text-muted-foreground">Try selecting a different date range</p>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Type</TableHead>
                      <TableHead className="font-bold">Customer</TableHead>
                      <TableHead className="font-bold">Payment</TableHead>
                      <TableHead className="text-right font-bold">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice, index) => (
                      <TableRow key={invoice.id} className="hover:bg-secondary/5 transition-colors animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(invoice.invoice_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            invoice.document_type === 'Quotation'
                              ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}>
                            {invoice.document_type}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {invoice.customers?.name || invoice.customer_name || 'Walk-in'}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            invoice.payment_type === 'Cash'
                              ? 'bg-success/10 text-success'
                              : invoice.payment_type === 'Online'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-destructive/10 text-destructive'
                          }`}>
                            {invoice.payment_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-success">
                          ₹{invoice.total_amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={4} className="text-right font-bold text-base">Grand Total:</TableCell>
                      <TableCell className="text-right font-bold text-base text-success">
                        ₹{stats.totalSales.toFixed(2)}
                      </TableCell>
                    </TableRow>
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

export default Reports;
