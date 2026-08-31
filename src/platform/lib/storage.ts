import { supabase, isDemoMode } from "./supabase";
import { BRAND } from "./brand";

// ─── Bucket names ──────────────────────────────────────────

export const BUCKETS = {
  DOCUMENTS: "documents",
  IMAGES: "images",
  ATTACHMENTS: "attachments",
  AVATARS: "avatars",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// ─── Upload result shape ───────────────────────────────────

export interface UploadResult {
  path: string | null;
  url: string | null;
  error: Error | null;
}

// ─── Storage functions ─────────────────────────────────────

export async function uploadFile(
  bucket: BucketName,
  workspaceId: string,
  file: File,
  options?: { upsert?: boolean }
): Promise<UploadResult> {
  if (isDemoMode || !supabase) {
    console.warn(`${BRAND.logPrefix} Demo mode — file upload is a no-op`);
    const demoUrl = URL.createObjectURL(file);
    return { path: `demo/${file.name}`, url: demoUrl, error: null };
  }

  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `${workspaceId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: options?.upsert ?? false });

  if (error) return { path: null, url: null, error };

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { path: data.path, url: urlData.publicUrl, error: null };
}

export async function deleteFile(bucket: BucketName, path: string): Promise<{ error: Error | null }> {
  if (isDemoMode || !supabase) {
    console.warn(`${BRAND.logPrefix} Demo mode — file delete is a no-op`);
    return { error: null };
  }
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return { error: error ?? null };
}

export function getPublicUrl(bucket: BucketName, path: string): string | null {
  if (isDemoMode || !supabase) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function listFiles(bucket: BucketName, workspaceId: string): Promise<{ name: string; path: string; size: number | undefined }[]> {
  if (isDemoMode || !supabase) return [];
  const { data, error } = await supabase.storage.from(bucket).list(workspaceId);
  if (error || !data) return [];
  return data.map((f) => ({
    name: f.name,
    path: `${workspaceId}/${f.name}`,
    size: f.metadata?.size,
  }));
}

export async function getSignedUrl(bucket: BucketName, path: string, expiresInSeconds = 3600): Promise<string | null> {
  if (isDemoMode || !supabase) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
