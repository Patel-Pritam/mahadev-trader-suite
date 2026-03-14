import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/AppLayout";
import { Info, ImageIcon, Package, Upload, X, Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(100),
  quantity: z.number().nonnegative("Quantity cannot be negative").max(999999),
  price: z.number().nonnegative("Price cannot be negative").max(999999.99),
  unit_type: z.enum(["Kg", "Qty", "L"]),
});

const EditProduct = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    quantity: "0",
    price: "0.00",
    unit_type: "Qty",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }
    if (!id) { navigate("/stock"); return; }

    const { data, error } = await supabase
      .from("stock_items")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      toast({ title: "Error", description: "Product not found", variant: "destructive" });
      navigate("/stock");
      return;
    }

    setFormData({
      name: data.name,
      quantity: data.quantity.toString(),
      price: data.price.toString(),
      unit_type: data.unit_type,
    });
    if (data.image_url) {
      setExistingImageUrl(data.image_url);
      setImagePreview(data.image_url);
    }
    setLastUpdated(data.updated_at);
    setLoading(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be less than 5MB", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async (userId: string): Promise<string | null> => {
    if (!imageFile) return existingImageUrl;
    const ext = imageFile.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, imageFile);
    if (error) throw error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const validated = productSchema.parse({
        name: formData.name,
        quantity: parseFloat(formData.quantity) || 0,
        price: parseFloat(formData.price) || 0,
        unit_type: formData.unit_type,
      });

      let imageUrl: string | null = existingImageUrl;
      try { imageUrl = await uploadImage(user.id); } catch { /* ignore */ }

      const { error } = await supabase
        .from("stock_items")
        .update({
          name: validated.name,
          quantity: validated.quantity,
          price: validated.price,
          unit_type: validated.unit_type,
          image_url: imageUrl,
        })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Success", description: "Product updated successfully" });
      navigate("/stock");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Validation Error", description: error.errors[0].message, variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to update product", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <AppLayout title="Edit Product">
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Edit Product"
      subtitle={`Modify details for ${formData.name}`}
      headerActions={
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/stock")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="btn-3d">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 max-w-6xl space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="card-3d-subtle animate-fade-in">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Info className="h-4 w-4 text-primary" />
                  </div>
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter full product name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="h-11"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="card-3d-subtle animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  Inventory & Pricing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Current Stock</Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Unit Price (₹)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit_type">Unit Type</Label>
                    <Select value={formData.unit_type} onValueChange={(v) => setFormData({ ...formData, unit_type: v })}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border shadow-lg z-50">
                        <SelectItem value="Kg">Kg (Kilogram)</SelectItem>
                        <SelectItem value="Qty">Qty (Quantity)</SelectItem>
                        <SelectItem value="L">L (Litre)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="card-3d-subtle animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ImageIcon className="h-4 w-4 text-primary" />
                  </div>
                  Product Image
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/svg+xml,image/png,image/jpeg,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Product preview"
                      className="w-full h-48 object-contain rounded-lg border border-border bg-muted/30 cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={removeImage}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">Click to change or drag & drop</p>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">SVG, PNG, JPG or WebP (max. 5MB)</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="card-3d-subtle animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Last Updated</p>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                    <span className="text-sm font-medium">
                      {lastUpdated ? getTimeSince(lastUpdated) : "Unknown"}
                    </span>
                  </div>
                </div>
                <Button type="submit" onClick={handleSubmit} disabled={saving} className="w-full h-11 btn-3d">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => navigate("/stock")}
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </AppLayout>
  );
};

export default EditProduct;
