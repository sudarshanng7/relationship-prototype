import type { SupabaseClient } from "@supabase/supabase-js";

async function getClient(client?: any) {
  if (client) return client;
  const mod = await import("./supabase");
  return mod.supabase;
}

export const PROFILE_MEDIA_BUCKET = "profile-media";
export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export interface ProfileMediaAsset {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
  fileName?: string | null;
  base64?: string | null;
  width?: number;
  height?: number;
  file?: any;
}

export interface ProfileMediaValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: AllowedImageMimeType;
  extension?: string;
}

export interface ProfileMediaSaveResult {
  path: string;
  signedUrl: string;
}

/**
 * Extracts a normalized file extension from a MIME type or file name/URI.
 */
export function resolveImageMimeTypeAndExt(
  asset: Pick<ProfileMediaAsset, "uri" | "mimeType" | "fileName">
): { mimeType: AllowedImageMimeType | null; extension: string } {
  const mime = asset.mimeType?.toLowerCase().trim();
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (mime === "image/png") {
    return { mimeType: "image/png", extension: "png" };
  }
  if (mime === "image/webp") {
    return { mimeType: "image/webp", extension: "webp" };
  }

  // Fallback: inspect URI or fileName extension
  const candidate = (asset.fileName || asset.uri || "").toLowerCase();
  const cleanPath = candidate.split("?")[0].split("#")[0];
  if (cleanPath.endsWith(".jpg") || cleanPath.endsWith(".jpeg")) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (cleanPath.endsWith(".png")) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (cleanPath.endsWith(".webp")) {
    return { mimeType: "image/webp", extension: "webp" };
  }

  return { mimeType: null, extension: "jpg" };
}

/**
 * Validates an image asset against maximum file size and supported MIME types.
 */
export function validateImageFile(
  asset: Pick<ProfileMediaAsset, "uri" | "mimeType" | "fileSize" | "fileName" | "file">
): ProfileMediaValidationResult {
  const size =
    typeof asset.fileSize === "number"
      ? asset.fileSize
      : typeof asset.file?.size === "number"
      ? asset.file.size
      : undefined;

  if (typeof size === "number" && size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: "File size must be 8 MB or less.",
    };
  }

  const effectiveMime = asset.mimeType || asset.file?.type || null;
  const effectiveName = asset.fileName || asset.file?.name || null;

  const { mimeType, extension } = resolveImageMimeTypeAndExt({
    uri: asset.uri,
    mimeType: effectiveMime,
    fileName: effectiveName,
  });

  if (!mimeType) {
    return {
      valid: false,
      error: "Only JPG, PNG, and WebP images are supported.",
    };
  }

  return {
    valid: true,
    mimeType,
    extension,
  };
}

/**
 * Generates an unpredictable, collision-resistant storage path for a personal cover image.
 * Path format: personal/{userId}/{timestamp}_{random}.{ext}
 */
export function getPersonalCoverPath(
  userId: string,
  extension: string = "jpg"
): string {
  const cleanExt = extension.replace(/^\./, "").toLowerCase() || "jpg";
  const uniqueToken = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `personal/${userId}/${uniqueToken}.${cleanExt}`;
}

/**
 * Generates an unpredictable, collision-resistant storage path for a shared couple image.
 * Path format: couples/{coupleId}/{timestamp}_{random}.{ext}
 */
export function getCoupleImagePath(
  coupleId: string,
  extension: string = "jpg"
): string {
  const cleanExt = extension.replace(/^\./, "").toLowerCase() || "jpg";
  const uniqueToken = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `couples/${coupleId}/${uniqueToken}.${cleanExt}`;
}

/**
 * Decodes a base64 string to Uint8Array across all JS runtimes without external dependencies.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  // Strip optional data URI prefix if present
  const cleaned = base64.includes(",") ? base64.split(",")[1] : base64;
  if (typeof atob === "function") {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  const maybeBuffer = (globalThis as any).Buffer;
  if (maybeBuffer && typeof maybeBuffer.from === "function") {
    return new Uint8Array(maybeBuffer.from(cleaned, "base64"));
  }
  throw new Error("Base64 decoding is not available in the current runtime.");
}

/**
 * Converts a picked media asset into an ArrayBuffer or Uint8Array ready for Supabase Storage.
 */
export async function prepareAssetPayload(
  asset: ProfileMediaAsset
): Promise<{ data: Uint8Array | ArrayBuffer; contentType: string; extension: string }> {
  const validation = validateImageFile(asset);
  if (!validation.valid || !validation.mimeType) {
    throw new Error(validation.error || "Invalid image asset.");
  }

  const contentType = validation.mimeType;
  const extension = validation.extension || "jpg";

  if (asset.file && typeof asset.file.arrayBuffer === "function") {
    const buffer = await asset.file.arrayBuffer();
    const data = new Uint8Array(buffer);
    if (data.byteLength === 0) {
      throw new Error("Selected image file is empty.");
    }
    if (data.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("File size must be 8 MB or less.");
    }
    return {
      data,
      contentType,
      extension,
    };
  }

  if (asset.base64 && asset.base64.trim().length > 0) {
    const data = base64ToUint8Array(asset.base64);
    if (data.byteLength === 0) {
      throw new Error("Selected image file is empty.");
    }
    if (data.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("File size must be 8 MB or less.");
    }
    return {
      data,
      contentType,
      extension,
    };
  }

  if (asset.uri) {
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error(`Failed to load local image asset (${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    if (data.byteLength === 0) {
      throw new Error("Selected image file is empty.");
    }
    if (data.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("File size must be 8 MB or less.");
    }
    return {
      data,
      contentType,
      extension,
    };
  }

  throw new Error("No image data or URI was provided.");
}

/**
 * Uploads an image buffer to the profile-media bucket at the specified path.
 */
export async function uploadProfileMedia(
  params: {
    path: string;
    data: Uint8Array | ArrayBuffer;
    contentType: string;
  },
  client?: any
): Promise<void> {
  const supabase = await getClient(client);
  const { error } = await supabase.storage
    .from(PROFILE_MEDIA_BUCKET)
    .upload(params.path, params.data, {
      contentType: params.contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
}

/**
 * Creates a signed URL for a private profile-media storage object.
 */
export async function createProfileMediaSignedUrl(
  path: string,
  expiresInSeconds: number = 3600,
  client?: any
): Promise<string | null> {
  if (!path || typeof path !== "string") {
    return null;
  }

  const supabase = await getClient(client);
  const { data, error } = await supabase.storage
    .from(PROFILE_MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

/**
 * Safely deletes an object from the profile-media storage bucket.
 */
export async function deleteProfileMedia(
  path: string | null | undefined,
  client?: any
): Promise<void> {
  if (!path || typeof path !== "string") {
    return;
  }

  try {
    const supabase = await getClient(client);
    await supabase.storage.from(PROFILE_MEDIA_BUCKET).remove([path]);
  } catch {
    // Non-blocking cleanup
  }
}

/**
 * Transactionally saves a personal cover image:
 * 1. Validates authenticated identity (must match active session).
 * 2. Validates and converts the asset.
 * 3. Uploads the file to personal/{userId}/{timestamp}_{token}.{ext}.
 * 4. Bootstraps or updates user_partner_profiles.personal_cover_path.
 * 5. Rolls back the uploaded file if database persistence fails.
 * 6. Cleans up any previous storage object.
 * 7. Generates and returns a signed URL for immediate display.
 */
export async function savePersonalCoverImage(
  userId: string,
  asset: ProfileMediaAsset,
  previousPath?: string | null,
  client?: any
): Promise<ProfileMediaSaveResult> {
  const supabase = await getClient(client);

  // Authenticated identity validation
  let authUserId = userId;
  if (supabase.auth && typeof supabase.auth.getUser === "function") {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      throw new Error("Unable to save your photo right now. Please try again.");
    }
    if (userId && userId.trim() !== "" && userId !== authData.user.id) {
      throw new Error("Unable to save photo: user account does not match active session.");
    }
    authUserId = authData.user.id;
  }

  if (!authUserId) {
    throw new Error("Unable to save your photo right now. Please try again.");
  }

  const { data, contentType, extension } = await prepareAssetPayload(asset);
  const newPath = getPersonalCoverPath(authUserId, extension);

  // 1. Upload to storage
  await uploadProfileMedia(
    {
      path: newPath,
      data,
      contentType,
    },
    supabase
  );

  // 2. Persist to database with safe bootstrap support
  let dbSuccess = false;
  try {
    const { data: existingProfile, error: checkError } = await supabase
      .from("user_partner_profiles")
      .select("user_id")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existingProfile) {
      const { data: updatedRows, error: updateError } = await supabase
        .from("user_partner_profiles")
        .update({ personal_cover_path: newPath })
        .eq("user_id", authUserId)
        .select("personal_cover_path");

      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length !== 1) {
        throw new Error("Failed to update personal cover path.");
      }
      dbSuccess = true;
    } else {
      // Missing profile row: bootstrap minimal row with owner user_id and personal_cover_path
      const { data: insertedRows, error: insertError } = await supabase
        .from("user_partner_profiles")
        .insert({
          user_id: authUserId,
          personal_cover_path: newPath,
        })
        .select("personal_cover_path");

      if (insertError) {
        // Handle concurrent insertion conflict gracefully by retrying update once
        if (
          insertError.code === "23505" ||
          insertError.message?.toLowerCase().includes("duplicate") ||
          insertError.message?.toLowerCase().includes("unique")
        ) {
          const { data: retryRows, error: retryError } = await supabase
            .from("user_partner_profiles")
            .update({ personal_cover_path: newPath })
            .eq("user_id", authUserId)
            .select("personal_cover_path");

          if (retryError) throw retryError;
          if (!retryRows || retryRows.length !== 1) {
            throw new Error("Failed to update personal cover path on retry.");
          }
          dbSuccess = true;
        } else {
          throw insertError;
        }
      } else {
        if (!insertedRows || insertedRows.length !== 1) {
          throw new Error("Failed to insert user profile record.");
        }
        dbSuccess = true;
      }
    }
  } catch {
    dbSuccess = false;
  }

  if (!dbSuccess) {
    // Rollback uploaded file
    await deleteProfileMedia(newPath, supabase);
    throw new Error("Unable to save your photo right now. Please try again.");
  }

  // 3. Clean up previous file if different
  if (previousPath && previousPath !== newPath) {
    await deleteProfileMedia(previousPath, supabase);
  }

  // 4. Generate signed URL
  const signedUrl = await createProfileMediaSignedUrl(newPath, 3600, supabase);
  if (!signedUrl) {
    throw new Error("Could not generate secure view URL for cover photo.");
  }

  return {
    path: newPath,
    signedUrl,
  };
}

/**
 * Removes the personal cover image:
 * Sets user_partner_profiles.personal_cover_path = null and removes the storage file.
 */
export async function removePersonalCoverImage(
  userId: string,
  currentPath?: string | null,
  client?: any
): Promise<void> {
  const supabase = await getClient(client);
  const { error: dbError } = await supabase
    .from("user_partner_profiles")
    .update({ personal_cover_path: null })
    .eq("user_id", userId);

  if (dbError) {
    throw new Error(`Failed to remove cover image: ${dbError.message}`);
  }

  if (currentPath) {
    await deleteProfileMedia(currentPath, supabase);
  }
}

/**
 * Transactionally saves a shared couple image:
 * 1. Validates and converts the asset.
 * 2. Uploads the file to couples/{coupleId}/{timestamp}_{token}.{ext}.
 * 3. Updates couple_profiles.couple_image_path.
 * 4. Rolls back the uploaded file if database persistence fails.
 * 5. Cleans up any previous storage object.
 * 6. Generates and returns a signed URL for immediate display.
 */
export async function saveCoupleImage(
  coupleId: string,
  asset: ProfileMediaAsset,
  previousPath?: string | null,
  client?: any
): Promise<ProfileMediaSaveResult> {
  const supabase = await getClient(client);

  // Authenticated identity validation & couple membership check
  if (supabase.auth && typeof supabase.auth.getUser === "function") {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      throw new Error("Unable to save couple image right now. Please try again.");
    }
    const authenticatedUserId = authData.user.id;

    const { data: membership, error: memError } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("couple_id", coupleId)
      .eq("user_id", authenticatedUserId)
      .maybeSingle();

    if (memError || !membership) {
      throw new Error("Unable to save couple image: shared space not found or permission denied.");
    }
  }

  const { data, contentType, extension } = await prepareAssetPayload(asset);
  const newPath = getCoupleImagePath(coupleId, extension);

  // 1. Upload to storage
  await uploadProfileMedia(
    {
      path: newPath,
      data,
      contentType,
    },
    supabase
  );

  // 2. Persist to database with safe bootstrap support
  let dbSuccess = false;
  try {
    const { data: existingCoupleProfile, error: checkError } = await supabase
      .from("couple_profiles")
      .select("couple_id")
      .eq("couple_id", coupleId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existingCoupleProfile) {
      const { data: updatedRows, error: updateError } = await supabase
        .from("couple_profiles")
        .update({ couple_image_path: newPath })
        .eq("couple_id", coupleId)
        .select("couple_image_path");

      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length !== 1) {
        throw new Error("Failed to update couple image path.");
      }
      dbSuccess = true;
    } else {
      // Missing couple profile row: bootstrap minimal row with couple_id and couple_image_path
      const { data: insertedRows, error: insertError } = await supabase
        .from("couple_profiles")
        .insert({
          couple_id: coupleId,
          couple_image_path: newPath,
        })
        .select("couple_image_path");

      if (insertError) {
        // Handle concurrent insertion conflict gracefully by retrying update once
        if (
          insertError.code === "23505" ||
          insertError.message?.toLowerCase().includes("duplicate") ||
          insertError.message?.toLowerCase().includes("unique")
        ) {
          const { data: retryRows, error: retryError } = await supabase
            .from("couple_profiles")
            .update({ couple_image_path: newPath })
            .eq("couple_id", coupleId)
            .select("couple_image_path");

          if (retryError) throw retryError;
          if (!retryRows || retryRows.length !== 1) {
            throw new Error("Failed to update couple image path on retry.");
          }
          dbSuccess = true;
        } else {
          throw insertError;
        }
      } else {
        if (!insertedRows || insertedRows.length !== 1) {
          throw new Error("Failed to insert couple profile record.");
        }
        dbSuccess = true;
      }
    }
  } catch {
    dbSuccess = false;
  }

  if (!dbSuccess) {
    // Rollback uploaded file
    await deleteProfileMedia(newPath, supabase);
    throw new Error("Unable to save couple image right now. Please try again.");
  }

  // 3. Clean up previous file if different
  if (previousPath && previousPath !== newPath) {
    await deleteProfileMedia(previousPath, supabase);
  }

  // 4. Generate signed URL
  const signedUrl = await createProfileMediaSignedUrl(newPath, 3600, supabase);
  if (!signedUrl) {
    throw new Error("Could not generate secure view URL for couple image.");
  }

  return {
    path: newPath,
    signedUrl,
  };
}

/**
 * Removes the shared couple image:
 * Sets couple_profiles.couple_image_path = null and removes the storage file.
 */
export async function removeCoupleImage(
  coupleId: string,
  currentPath?: string | null,
  client?: any
): Promise<void> {
  const supabase = await getClient(client);
  const { error: dbError } = await supabase
    .from("couple_profiles")
    .update({ couple_image_path: null })
    .eq("couple_id", coupleId);

  if (dbError) {
    throw new Error(`Failed to remove couple image: ${dbError.message}`);
  }

  if (currentPath) {
    await deleteProfileMedia(currentPath, supabase);
  }
}
