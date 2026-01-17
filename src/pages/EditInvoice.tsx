import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Store, ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { z } from "zod";

const invoiceItemSchema = z.object({
  quantity: z.number().positive("Quantity must be positive"),
  price: z.number().positive("Price must be positive").max(999999.99, "Price must be less than 1,000,000")
});

const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Mobile number must be a valid 10-digit number starting with 6-9")
});

interface StockItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit_type: string;
}

interface InvoiceItem {
  id?: string;
  stock_item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  unit_type: string;
  available_quantity: number;
}

const EditInvoice = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [paymentType, setPaymentType] = useState<"Online" | "Cash" | "Pending">("Cash");
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndFetchData();
  }, [id]);

  const checkAuthAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    await fetchInvoiceData();
    await fetchStockItems();
    setLoading(false);
  };

  const fetchInvoiceData = async () => {
    if (!id) return;

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .single();

    if (invoiceError || !invoice) {
      toast({
        title: "Error",
        description: "Failed to load invoice",
        variant: "destructive"
      });
      navigate("/invoices");
      return;
    }

    // Fetch customer details from customers table if customer_id exists
    if (invoice.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("name, mobile_number")
        .eq("id", invoice.customer_id)
        .single();
      
      if (customer) {
        setCustomerName(customer.name);
        setCustomerMobile(customer.mobile_number);
      }
    } else {
      // Fallback for old invoices with inline customer data
      setCustomerName(invoice.customer_name || '');
      setCustomerMobile(invoice.customer_mobile || '');
    }
    
    setPaymentType(invoice.payment_type as "Online" | "Cash" | "Pending");

    const { data: items, error: itemsError } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id);

    if (itemsError || !items) {
      toast({
        title: "Error",
        description: "Failed to load invoice items",
        variant: "destructive"
      });
      return;
    }

    // Fetch stock quantities for validation
    const stockIds = items.map(item => item.stock_item_id).filter(Boolean);
    const { data: stockData } = await supabase
      .from("stock_items")
      .select("id, quantity")
      .in("id", stockIds);

    const stockMap = new Map(stockData?.map(s => [s.id, s.quantity]) || []);

    setInvoiceItems(items.map(item => ({
      id: item.id,
      stock_item_id: item.stock_item_id || "",
      item_name: item.item_name,
      price: Number(item.price),
      quantity: Number(item.quantity),
      unit_type: item.unit_type,
      available_quantity: stockMap.get(item.stock_item_id || "") || 0
    })));
  };

  const fetchStockItems = async () => {
    const { data, error } = await supabase
      .from("stock_items")
      .select("*")
      .order("name");

    if (!error && data) {
      setStockItems(data);
    }
  };

  const addItemToInvoice = (item: StockItem) => {
    const existing = invoiceItems.find(i => i.stock_item_id === item.id);
    if (existing) {
      toast({
        title: "Already added",
        description: "This item is already in the invoice",
        variant: "destructive"
      });
      return;
    }

    setInvoiceItems([...invoiceItems, {
      stock_item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: 1,
      unit_type: item.unit_type,
      available_quantity: item.quantity
    }]);
    setShowItemDialog(false);
    setSearchTerm("");
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    try {
      invoiceItemSchema.shape.quantity.parse(quantity);
      
      const newItems = [...invoiceItems];
      if (quantity > newItems[index].available_quantity) {
        toast({
          title: "Insufficient stock",
          description: `Only ${newItems[index].available_quantity} ${newItems[index].unit_type} available`,
          variant: "destructive"
        });
        return;
      }
      newItems[index].quantity = quantity;
      setInvoiceItems(newItems);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid quantity",
          description: error.errors[0].message,
          variant: "destructive"
        });
      }
    }
  };

  const updateItemPrice = (index: number, price: number) => {
    try {
      invoiceItemSchema.shape.price.parse(price);
      
      const newItems = [...invoiceItems];
      newItems[index].price = price;
      setInvoiceItems(newItems);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid price",
          description: error.errors[0].message,
          variant: "destructive"
        });
      }
    }
  };

  const removeItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return invoiceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleUpdateInvoice = async () => {
    // Validate customer data
    try {
      customerSchema.parse({
        name: customerName,
        mobile: customerMobile
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive"
        });
      }
      return;
    }

    if (invoiceItems.length === 0) {
      toast({
        title: "No items",
        description: "Please add at least one item to the invoice",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);

    try {
      const totalAmount = calculateTotal();

      // Update invoice (customer details are in customers table, not duplicated here)
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          payment_type: paymentType,
          total_amount: totalAmount
        })
        .eq("id", id);

      if (invoiceError) throw invoiceError;

      // Delete existing items
      await supabase
        .from("invoice_items")
        .delete()
        .eq("invoice_id", id);

      // Insert new items
      const itemsToInsert = invoiceItems.map(item => ({
        invoice_id: id,
        stock_item_id: item.stock_item_id,
        item_name: item.item_name,
        price: item.price,
        quantity: item.quantity,
        unit_type: item.unit_type,
        subtotal: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: "Invoice updated successfully"
      });

      navigate("/invoices");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update invoice",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredStockItems = stockItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Edit Invoice</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Customer Name</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>
            <div>
              <Label>Mobile Number</Label>
              <Input
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="Enter mobile number"
              />
            </div>
            <div>
              <Label>Payment Type</Label>
              <Select value={paymentType} onValueChange={(value: any) => setPaymentType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Invoice Items</CardTitle>
            <Button onClick={() => setShowItemDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            {invoiceItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No items added yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.price}
                          onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                          className="w-24"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, parseFloat(e.target.value) || 0)}
                          className="w-24"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>₹{(item.price * item.quantity).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">Total:</TableCell>
                    <TableCell className="font-bold">₹{calculateTotal().toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button variant="outline" onClick={() => navigate("/invoices")}>
            Cancel
          </Button>
          <Button onClick={handleUpdateInvoice} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Updating..." : "Update Invoice"}
          </Button>
        </div>
      </main>

      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {filteredStockItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => addItemToInvoice(item)}
                >
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-muted-foreground">
                    ₹{item.price.toFixed(2)} per {item.unit_type} • Stock: {item.quantity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EditInvoice;
