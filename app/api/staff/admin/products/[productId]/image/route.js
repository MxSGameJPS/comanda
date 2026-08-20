import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireStaff } from "@/lib/auth/staff";
import { restSelect, restUpdate, storageEnsureBucket, storageUpload } from "@/lib/supabase/server";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);
const maxBytes = 5 * 1024 * 1024;
const bucketName = "product-images";

export async function POST(request, { params }) {
  try {
    const { profile } = await requireStaff(["OWNER", "ADMIN"]);
    const { productId } = await params;
    const products = await restSelect("products", {
      id: `eq.${productId}`,
      restaurant_id: `eq.${profile.restaurant_id}`,
      select: "id,image_url",
      limit: 1,
    }, { admin: true });
    const product = products?.[0];
    if (!product) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });

    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Formato inválido. Use JPG, PNG, WebP ou AVIF." }, { status: 400 });
    if (file.size > maxBytes) return NextResponse.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 413 });

    await storageEnsureBucket(bucketName, {
      public: true,
      fileSizeLimit: maxBytes,
      allowedMimeTypes: [...allowedTypes.keys()],
    });

    const extension = allowedTypes.get(file.type);
    const objectPath = `${profile.restaurant_id}/${product.id}/${Date.now()}-${randomUUID()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await storageUpload(bucketName, objectPath, bytes, { contentType: file.type });
    const rows = await restUpdate("products", {
      id: `eq.${product.id}`,
      restaurant_id: `eq.${profile.restaurant_id}`,
    }, { image_url: uploaded.publicUrl }, { admin: true });

    return NextResponse.json({ ok: true, imageUrl: uploaded.publicUrl, product: rows?.[0] || null });
  } catch (error) {
    return apiError(error, "Não foi possível salvar a imagem do produto.");
  }
}
