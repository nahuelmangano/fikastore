"use client";

import ModernProductEditor from "@/components/admin/products/ModernProductEditor";

type CategoryOption = {
  id: string;
  parentId?: string | null;
  name: string;
  label?: string;
};

export default function AdminProductCreate({ categories }: { categories: CategoryOption[] }) {
  return (
    <ModernProductEditor
      mode="create"
      product={{
        name: "",
        sku: "",
        slug: "",
        description: "",
        price: 1000,
        stock: 0,
        isActive: true,
        categoryId: "",
        images: [],
        hasVariants: false,
      }}
      initialOptions={[]}
      initialVariants={[]}
      categories={categories}
      backHref="/admin/products"
    />
  );
}
