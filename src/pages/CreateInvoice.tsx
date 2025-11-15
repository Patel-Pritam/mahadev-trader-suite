import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const [paymentType, setPaymentType] = useState<"Online" | "Cash" | "Pending">("Cash");
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    fetchCustomers();
    fetchStockItems();
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name");

    if (!error && data) {
      setCustomers(data);
    }
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
    const newItems = [...invoiceItems];
    
    if (quantity <= 0) {
      toast({
        title: "Validation Error",
        description: "Quantity must be positive",
        variant: "destructive"
      });
      return;
    }
    
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
  };

  const updateItemPrice = (index: number, price: number) => {
    const newItems = [...invoiceItems];
    
    if (price <= 0) {
      toast({
        title: "Validation Error",
        description: "Price must be positive",
        variant: "destructive"
      });
      return;
    }
    
    if (price > 999999.99) {
      toast({
        title: "Validation Error",
        description: "Price must be less than 1,000,000",
        variant: "destructive"
      });
      return;
    }
    
    newItems[index].price = price;
    setInvoiceItems(newItems);
  };

  const removeItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return invoiceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSaveInvoice = async () => {
    if (!selectedCustomer && !newCustomerMode) {
      toast({
        title: "Customer required",
        description: "Please select or add a customer",
        variant: "destructive"
      });
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

    // Validate all invoice items
    for (const item of invoiceItems) {
      try {
        invoiceItemSchema.parse({
          quantity: item.quantity,
          price: item.price
        });
        
        if (item.quantity > item.available_quantity) {
          toast({
            title: "Validation Error",
            description: `${item.item_name}: Cannot exceed available stock (${item.available_quantity} ${item.unit_type})`,
            variant: "destructive"
          });
          return;
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast({
            title: "Validation Error",
            description: `${item.item_name}: ${error.errors[0].message}`,
            variant: "destructive"
          });
          return;
        }
      }
    }

    let customerName = "";
    let customerMobile = "";
    let customerId: string | undefined = undefined;

    // Validate customer data
    if (newCustomerMode) {
      try {
        const validatedCustomer = newCustomerSchema.parse({
          name: newCustomerName,
          mobile: newCustomerMobile
        });
        customerName = validatedCustomer.name;
        customerMobile = validatedCustomer.mobile;
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast({
            title: "Validation Error",
            description: error.errors[0].message,
            variant: "destructive"
          });
          return;
        }
      }
    } else {
      if (!selectedCustomer) {
        toast({
          title: "Error",
          description: "Please select a customer",
          variant: "destructive"
        });
        return;
      }
      customerName = selectedCustomer.name;
      customerMobile = selectedCustomer.mobile_number;
      customerId = selectedCustomer.id;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create new customer if needed
      if (newCustomerMode) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert([{
            name: customerName,
            mobile_number: customerMobile,
            user_id: user.id
          }])
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert([{
          user_id: user.id,
          customer_id: customerId,
          customer_name: customerName,
          customer_mobile: customerMobile,
          payment_type: paymentType,
          total_amount: calculateTotal()
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items and update stock
      for (const item of invoiceItems) {
        // Insert invoice item
        const { error: itemError } = await supabase
          .from("invoice_items")
          .insert([{
            invoice_id: invoice.id,
            stock_item_id: item.stock_item_id,
            item_name: item.item_name,
            price: item.price,
            quantity: item.quantity,
            unit_type: item.unit_type,
            subtotal: item.price * item.quantity
          }]);

        if (itemError) throw itemError;

        // Update stock quantity atomically to prevent race conditions
        const { error: stockError } = await supabase.rpc('decrement_stock', {
          _stock_item_id: item.stock_item_id,
          _quantity: item.quantity
        });

        if (stockError) throw stockError;
      }

      toast({
        title: "Success!",
        description: "Invoice created successfully"
      });

      navigate("/invoices");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredStockItems = stockItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    item.quantity > 0
  );

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
            <h1 className="text-xl font-bold">Create Invoice</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant={!newCustomerMode ? "default" : "outline"}
                  onClick={() => setNewCustomerMode(false)}
                >
                  Select Existing
                </Button>
                <Button
                  variant={newCustomerMode ? "default" : "outline"}
                  onClick={() => setNewCustomerMode(true)}
                >
                  Add New Customer
                </Button>
              </div>

              {!newCustomerMode ? (
                <div className="space-y-2">
                  <Label>Select Customer</Label>
                  <Select
                    value={selectedCustomer?.id}
                    onValueChange={(value) => {
                      const customer = customers.find(c => c.id === value);
                      setSelectedCustomer(customer || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} - {customer.mobile_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">Customer Name</Label>
                    <Input
                      id="customer-name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-mobile">Mobile Number</Label>
                    <Input
                      id="customer-mobile"
                      type="tel"
                      value={newCustomerMobile}
                      onChange={(e) => setNewCustomerMobile(e.target.value)}
                      placeholder="Enter mobile number"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select
                  value={paymentType}
                  onValueChange={(value: any) => setPaymentType(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Invoice Items</CardTitle>
              <Button onClick={() => setShowItemDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {invoiceItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No items added yet. Click "Add Item" to start.
                </p>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Subtotal</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {item.item_name}
                            <div className="text-xs text-muted-foreground">
                              Available: {item.available_quantity} {item.unit_type}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => updateItemPrice(index, parseFloat(e.target.value))}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(index, parseFloat(e.target.value))}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>₹{(item.price * item.quantity).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex justify-end pt-4 border-t">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="text-3xl font-bold">₹{calculateTotal().toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button
            onClick={handleSaveInvoice}
            disabled={saving}
            size="lg"
            className="w-full"
          >
            <Save className="mr-2 h-5 w-5" />
            {saving ? "Saving..." : "Save Invoice"}
          </Button>
        </div>
      </main>

      {/* Item Selection Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Item from Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="max-h-96 overflow-y-auto">
              {filteredStockItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchTerm ? "No items found" : "No stock items available"}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredStockItems.map((item) => (
                    <Card
                      key={item.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => addItemToInvoice(item)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Available: {item.quantity} {item.unit_type}
                            </p>
                          </div>
                          <p className="text-lg font-bold">₹{item.price.toFixed(2)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateInvoice;
