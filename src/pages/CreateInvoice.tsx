import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppLayout } from "@/components/AppLayout";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, ArrowLeft, FileText, User, CalendarIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { z } from "zod";

const newCustomerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(100, "Name must be less than 100 characters"),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number starting with 6-9")
});

const invoiceItemSchema = z.object({
  quantity: z.number().positive("Quantity must be positive"),
  price: z.number().positive("Price must be positive").max(999999.99, "Price must be less than 1,000,000")
});

interface StockItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit_type: string;
}

interface Customer {
  id: string;
  name: string;
  mobile_number: string;
}

interface InvoiceItem {
  stock_item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  unit_type: string;
  available_quantity: number;
}

const CreateInvoice = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerMobile, setNewCustomerMobile] = useState("");
  const [paymentType, setPaymentType] = useState<"Online" | "Cash" | "Pending">("Pending");
  const [documentType, setDocumentType] = useState<"Invoice" | "Quotation">("Invoice");
  const [includeGst, setIncludeGst] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{ gst_number?: string; business_address?: string } | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('create-invoice-stock-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, () => fetchStockItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const checkAuthAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }
    fetchCustomers();
    fetchStockItems();
    fetchProfile();
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from("customers").select("*").order("name");
    if (!error && data) setCustomers(data);
  };

  const fetchStockItems = async () => {
    const { data, error } = await supabase.from("stock_items").select("*").order("name");
    if (!error && data) setStockItems(data);
  };

  const fetchProfile = async () => {
    const { data, error } = await supabase.from("profiles").select("gst_number, business_address").single();
    if (!error && data) setProfile(data);
  };

  const addItemToInvoice = (item: StockItem) => {
    if (invoiceItems.find(i => i.stock_item_id === item.id)) {
      toast({ title: "Already added", description: "This item is already in the invoice", variant: "destructive" });
      return;
    }
    setInvoiceItems([...invoiceItems, {
      stock_item_id: item.id, item_name: item.name, price: item.price,
      quantity: 1, unit_type: item.unit_type, available_quantity: item.quantity
    }]);
    setShowItemDialog(false);
    setSearchTerm("");
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...invoiceItems];
    if (quantity <= 0) { toast({ title: "Validation Error", description: "Quantity must be positive", variant: "destructive" }); return; }
    if (quantity > newItems[index].available_quantity) {
      toast({ title: "Insufficient stock", description: `Only ${newItems[index].available_quantity} ${newItems[index].unit_type} available`, variant: "destructive" });
      return;
    }
    newItems[index].quantity = quantity;
    setInvoiceItems(newItems);
  };

  const updateItemPrice = (index: number, price: number) => {
    const newItems = [...invoiceItems];
    if (price <= 0) { toast({ title: "Validation Error", description: "Price must be positive", variant: "destructive" }); return; }
    if (price > 999999.99) { toast({ title: "Validation Error", description: "Price must be less than 1,000,000", variant: "destructive" }); return; }
    newItems[index].price = price;
    setInvoiceItems(newItems);
  };

  const removeItem = (index: number) => setInvoiceItems(invoiceItems.filter((_, i) => i !== index));

  const subtotal = invoiceItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = subtotal * (discount / 100);
  const taxAmount = includeGst ? (subtotal - discountAmount) * 0.18 : 0;
  const grandTotal = subtotal - discountAmount + taxAmount;

  const handleSaveInvoice = async () => {
    if (!selectedCustomer && !newCustomerMode) {
      toast({ title: "Customer required", description: "Please select or add a customer", variant: "destructive" }); return;
    }
    if (invoiceItems.length === 0) {
      toast({ title: "No items", description: "Please add at least one item", variant: "destructive" }); return;
    }

    for (const item of invoiceItems) {
      try {
        invoiceItemSchema.parse({ quantity: item.quantity, price: item.price });
        if (item.quantity > item.available_quantity) {
          toast({ title: "Validation Error", description: `${item.item_name}: Cannot exceed available stock (${item.available_quantity} ${item.unit_type})`, variant: "destructive" }); return;
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast({ title: "Validation Error", description: `${item.item_name}: ${error.errors[0].message}`, variant: "destructive" }); return;
        }
      }
    }

    let customerName = "", customerMobile = "";
    let customerId: string | undefined;

    if (newCustomerMode) {
      try {
        const v = newCustomerSchema.parse({ name: newCustomerName, mobile: newCustomerMobile });
        customerName = v.name; customerMobile = v.mobile;
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" }); return;
        }
      }
    } else {
      if (!selectedCustomer) { toast({ title: "Error", description: "Please select a customer", variant: "destructive" }); return; }
      customerName = selectedCustomer.name;
      customerMobile = selectedCustomer.mobile_number;
      customerId = selectedCustomer.id;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (newCustomerMode) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers").insert([{ name: customerName, mobile_number: customerMobile, user_id: user.id }]).select().single();
        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices").insert([{
          user_id: user.id, customer_id: customerId, payment_type: paymentType,
          document_type: documentType, include_gst: includeGst,
          total_amount: grandTotal, customer_address: customerAddress.trim() || null
        }]).select().single();
      if (invoiceError) throw invoiceError;

      for (const item of invoiceItems) {
        const { error: itemError } = await supabase
          .from("invoice_items").insert([{
            invoice_id: invoice.id, stock_item_id: item.stock_item_id, item_name: item.item_name,
            price: item.price, quantity: item.quantity, unit_type: item.unit_type, subtotal: item.price * item.quantity
          }]);
        if (itemError) throw itemError;

        if (documentType === "Invoice") {
          const { error: stockError } = await supabase.rpc('decrement_stock', { _stock_item_id: item.stock_item_id, _quantity: item.quantity });
          if (stockError) throw stockError;
        }
      }

      toast({ title: "Success!", description: `${documentType} created successfully` });
      navigate("/invoices");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create invoice", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredStockItems = stockItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) && item.quantity > 0
  );

  return (
    <AppLayout title={`Create ${documentType}`} subtitle="New billing document">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
        {/* Back Link */}
        <button onClick={() => navigate("/invoices")} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 mb-2 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          BACK TO INVOICES
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Create New {documentType}</h1>
        <p className="text-muted-foreground mb-8">Generate a professional {documentType.toLowerCase()} for your client in seconds.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Info + Invoice Details Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Information */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-primary" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Select Customer</Label>
                    {!newCustomerMode ? (
                      <Select value={selectedCustomer?.id} onValueChange={(value) => setSelectedCustomer(customers.find(c => c.id === value) || null)}>
                        <SelectTrigger><SelectValue placeholder="Search or select a customer" /></SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name} - {c.mobile_number}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-2">
                        <Input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Customer name" />
                        <Input type="tel" value={newCustomerMobile} onChange={(e) => setNewCustomerMobile(e.target.value)} placeholder="Mobile number" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setNewCustomerMode(!newCustomerMode)}
                    className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {newCustomerMode ? "Select Existing" : "Add New Customer"}
                  </button>

                  {/* Address */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Address <span className="opacity-60">(Optional)</span></Label>
                    <Textarea value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Enter customer address" rows={2} className="resize-none text-sm" />
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Details */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-primary" />
                    {documentType} Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Document Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Document Type</Label>
                    <Select value={documentType} onValueChange={(v) => setDocumentType(v as "Invoice" | "Quotation")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Invoice">Invoice</SelectItem>
                        <SelectItem value="Quotation">Quotation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Date</Label>
                    <div className="relative">
                      <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                    </div>
                  </div>

                  {/* Payment Status */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Payment Status</Label>
                    <Select value={paymentType} onValueChange={(v: any) => setPaymentType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Online">Online</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* GST Toggle */}
                  {profile?.gst_number && (
                    <div className="flex items-center justify-between pt-1">
                      <Label htmlFor="include-gst" className="text-sm">Include GST (18%)</Label>
                      <Switch id="include-gst" checked={includeGst} onCheckedChange={setIncludeGst} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Items & Services */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-base">Items & Services</CardTitle>
                <Button onClick={() => setShowItemDialog(true)} size="sm" variant="outline" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent>
                {invoiceItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10 text-sm">No items added yet. Click "Add Item" to start.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[500px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs uppercase text-muted-foreground font-medium">Description</TableHead>
                          <TableHead className="text-xs uppercase text-muted-foreground font-medium w-20">Qty</TableHead>
                          <TableHead className="text-xs uppercase text-muted-foreground font-medium w-28">Unit Price</TableHead>
                          <TableHead className="text-xs uppercase text-muted-foreground font-medium text-right">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <span className="font-medium text-sm">{item.item_name}</span>
                              <span className="block text-xs text-muted-foreground">Avail: {item.available_quantity} {item.unit_type}</span>
                            </TableCell>
                            <TableCell>
                              <Input type="number" step="0.01" value={item.quantity} onChange={(e) => updateItemQuantity(index, parseFloat(e.target.value))} className="w-16 h-8 text-sm" />
                            </TableCell>
                            <TableCell>
                              <Input type="number" step="0.01" value={item.price} onChange={(e) => updateItemPrice(index, parseFloat(e.target.value))} className="w-24 h-8 text-sm" />
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">₹{(item.price * item.quantity).toFixed(2)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeItem(index)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes & Terms */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Notes & Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Notes for Customer</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a personal note..." rows={3} className="resize-y text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Terms & Conditions</Label>
                  <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms, bank details, etc..." rows={3} className="resize-y text-sm" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{documentType} Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Discount (%)</span>
                  <Input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} className="w-16 h-8 text-sm text-right" />
                </div>

                {includeGst && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (18% GST)</span>
                    <span className="font-medium">₹{taxAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t pt-4 flex justify-between items-center">
                  <span className="font-semibold text-base">Grand Total</span>
                  <span className="text-2xl font-bold text-primary">₹{grandTotal.toFixed(2)}</span>
                </div>

                <Button onClick={handleSaveInvoice} disabled={saving} className="w-full mt-2 gap-2" size="lg">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : `Save & Send ${documentType}`}
                </Button>

                <Button variant="outline" className="w-full" onClick={() => navigate("/invoices")}>
                  Discard Draft
                </Button>
              </CardContent>
            </Card>

            {documentType === "Quotation" && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-primary mb-1">💡 Pro Tip</p>
                  <p className="text-xs text-muted-foreground">Quotations don't deduct stock. Convert to invoice when confirmed by the customer.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Item Selection Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Item from Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <div className="max-h-96 overflow-y-auto">
              {filteredStockItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{searchTerm ? "No items found" : "No stock items available"}</p>
              ) : (
                <div className="space-y-2">
                  {filteredStockItems.map((item) => (
                    <Card key={item.id} className="cursor-pointer hover:bg-accent transition-colors" onClick={() => addItemToInvoice(item)}>
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">Available: {item.quantity} {item.unit_type}</p>
                        </div>
                        <p className="text-lg font-bold">₹{item.price.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CreateInvoice;
