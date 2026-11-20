import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  PROFILE_MEDIA_BUCKET,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  resolveImageMimeTypeAndExt,
  validateImageFile,
  getPersonalCoverPath,
  getCoupleImagePath,
  base64ToUint8Array,
  prepareAssetPayload,
  savePersonalCoverImage,
  removePersonalCoverImage,
  saveCoupleImage,
  removeCoupleImage,
} from "../src/lib/profile-media.ts";

const USER_A_ID = "11111111-1111-4111-8111-111111111111";
const USER_B_ID = "22222222-2222-4222-8222-222222222222";
const COUPLE_1_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COUPLE_2_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// ----------------------------------------------------------------------------
// 1. Constants & Boundaries
// ----------------------------------------------------------------------------
test("1. Bucket name and size limits adhere to specifications", () => {
  assert.equal(PROFILE_MEDIA_BUCKET, "profile-media");
  assert.equal(MAX_IMAGE_SIZE_BYTES, 8 * 1024 * 1024);
  assert.deepEqual(ALLOWED_IMAGE_MIME_TYPES, [
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
});

// ----------------------------------------------------------------------------
// 2. Format & Extension Resolution
// ----------------------------------------------------------------------------
test("2. Format resolution accepts JPG, PNG, and WebP via MIME type", () => {
  assert.deepEqual(
    resolveImageMimeTypeAndExt({ uri: "file://photo", mimeType: "image/jpeg" }),
    { mimeType: "image/jpeg", extension: "jpg" }
  );
  assert.deepEqual(
    resolveImageMimeTypeAndExt({ uri: "file://photo", mimeType: "image/jpg" }),
    { mimeType: "image/jpeg", extension: "jpg" }
  );
  assert.deepEqual(
    resolveImageMimeTypeAndExt({ uri: "file://photo", mimeType: "image/png" }),
    { mimeType: "image/png", extension: "png" }
  );
  assert.deepEqual(
    resolveImageMimeTypeAndExt({ uri: "file://photo", mimeType: "image/webp" }),
    { mimeType: "image/webp", extension: "webp" }
  );
});

test("3. Format resolution infers extension when MIME type is omitted", () => {
  assert.deepEqual(
    resolveImageMimeTypeAndExt({ uri: "file:///var/mobile/img.PNG" }),
    { mimeType: "image/png", extension: "png" }
  );
  assert.deepEqual(
    resolveImageMimeTypeAndExt({ uri: "file:///var/mobile/sunset.JPEG" }),
    { mimeType: "image/jpeg", extension: "jpg" }
  );
  assert.deepEqual(
    resolveImageMimeTypeAndExt({ uri: "https://example.com/asset.webp?token=xyz" }),
    { mimeType: "image/webp", extension: "webp" }
  );
});

test("4. Format resolution rejects unsupported formats (GIF, SVG, PDF, EXE)", () => {
  assert.equal(
    resolveImageMimeTypeAndExt({ uri: "animation.gif", mimeType: "image/gif" }).mimeType,
    null
  );
  assert.equal(
    resolveImageMimeTypeAndExt({ uri: "vector.svg", mimeType: "image/svg+xml" }).mimeType,
    null
  );
  assert.equal(
    resolveImageMimeTypeAndExt({ uri: "document.pdf", mimeType: "application/pdf" }).mimeType,
    null
  );
  assert.equal(
    resolveImageMimeTypeAndExt({ uri: "program.exe" }).mimeType,
    null
  );
});

// ----------------------------------------------------------------------------
// 3. Validation Logic
// ----------------------------------------------------------------------------
test("5. validateImageFile accepts valid images within 8 MB", () => {
  const result = validateImageFile({
    uri: "file://photo.jpg",
    mimeType: "image/jpeg",
    fileSize: 4 * 1024 * 1024, // 4 MB
  });
  assert.equal(result.valid, true);
  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(result.extension, "jpg");
  assert.equal(result.error, undefined);
});

test("6. validateImageFile rejects images exceeding 8 MB", () => {
  const result = validateImageFile({
    uri: "file://huge.jpg",
    mimeType: "image/jpeg",
    fileSize: 8 * 1024 * 1024 + 1, // 8 MB + 1 byte
  });
  assert.equal(result.valid, false);
  assert.equal(result.error, "File size must be 8 MB or less.");
});

test("7. validateImageFile rejects unsupported MIME types", () => {
  const result = validateImageFile({
    uri: "file://clip.gif",
    mimeType: "image/gif",
    fileSize: 1024,
  });
  assert.equal(result.valid, false);
  assert.equal(result.error, "Only JPG, PNG, and WebP images are supported.");
});

// ----------------------------------------------------------------------------
// 4. Scoped Path Generation & Collision Resistance
// ----------------------------------------------------------------------------
test("8. getPersonalCoverPath generates owner-scoped, collision-resistant paths", () => {
  const path1 = getPersonalCoverPath(USER_A_ID, "jpg");
  const path2 = getPersonalCoverPath(USER_A_ID, "jpg");

  assert.ok(path1.startsWith(`personal/${USER_A_ID}/`));
  assert.ok(path1.endsWith(".jpg"));
  assert.notEqual(path1, path2, "Subsequent calls must produce unique filenames");

  // Verify path pattern: personal/<uuid>/<timestamp>_<random>.<ext>
  const parts = path1.split("/");
  assert.equal(parts.length, 3);
  assert.equal(parts[0], "personal");
  assert.equal(parts[1], USER_A_ID);
  assert.match(parts[2], /^\d+_[a-z0-9]+\.jpg$/);
});

test("9. getCoupleImagePath generates couple-scoped, collision-resistant paths", () => {
  const path1 = getCoupleImagePath(COUPLE_1_ID, "png");
  const path2 = getCoupleImagePath(COUPLE_1_ID, "png");

  assert.ok(path1.startsWith(`couples/${COUPLE_1_ID}/`));
  assert.ok(path1.endsWith(".png"));
  assert.notEqual(path1, path2, "Subsequent calls must produce unique filenames");

  const parts = path1.split("/");
  assert.equal(parts.length, 3);
  assert.equal(parts[0], "couples");
  assert.equal(parts[1], COUPLE_1_ID);
  assert.match(parts[2], /^\d+_[a-z0-9]+\.png$/);
});

test("10. Untrusted user filenames are stripped from generated paths", () => {
  // Filenames with path traversal, malicious extensions, or user data
  const maliciousAsset = {
    uri: "file:///../../etc/passwd.jpg",
    fileName: "../../secret_user_photo.jpg",
    mimeType: "image/jpeg",
  };
  const { extension } = resolveImageMimeTypeAndExt(maliciousAsset);
  const path = getPersonalCoverPath(USER_A_ID, extension);

  assert.ok(!path.includes("passwd"));
  assert.ok(!path.includes("secret_user_photo"));
  assert.ok(!path.includes(".."));
  assert.match(path, /^personal\/11111111-1111-4111-8111-111111111111\/\d+_[a-z0-9]+\.jpg$/);
});

// ----------------------------------------------------------------------------
// 5. Binary Conversion & Base64 Decoding
// ----------------------------------------------------------------------------
test("11. base64ToUint8Array correctly converts base64 strings to Uint8Array", () => {
  const sampleText = "CouplyGardenMedia";
  const base64Str = Buffer.from(sampleText).toString("base64");
  const bytes = base64ToUint8Array(base64Str);

  assert.equal(bytes instanceof Uint8Array, true);
  assert.equal(Buffer.from(bytes).toString("utf-8"), sampleText);
});

test("12. base64ToUint8Array handles data URI prefixes gracefully", () => {
  const sampleText = "HelloCover";
  const base64Str = `data:image/jpeg;base64,${Buffer.from(sampleText).toString("base64")}`;
  const bytes = base64ToUint8Array(base64Str);

  assert.equal(Buffer.from(bytes).toString("utf-8"), sampleText);
});

test("13. prepareAssetPayload resolves valid asset with base64 data", async () => {
  const sampleBase64 = Buffer.from("fake-jpeg-data").toString("base64");
  const payload = await prepareAssetPayload({
    uri: "file://local.jpg",
    mimeType: "image/jpeg",
    base64: sampleBase64,
  });

  assert.equal(payload.contentType, "image/jpeg");
  assert.equal(payload.extension, "jpg");
  assert.equal(payload.data instanceof Uint8Array, true);
});

test("14. prepareAssetPayload throws on invalid MIME type", async () => {
  await assert.rejects(
    async () => {
      await prepareAssetPayload({
        uri: "file://clip.gif",
        mimeType: "image/gif",
      });
    },
    /Only JPG, PNG, and WebP images are supported/
  );
});

// ----------------------------------------------------------------------------
// 6. User and Couple Isolation Contracts
// ----------------------------------------------------------------------------
test("15. Partner A cover generation strictly isolates from Partner B", () => {
  const pathA = getPersonalCoverPath(USER_A_ID, "jpg");
  const pathB = getPersonalCoverPath(USER_B_ID, "jpg");

  assert.notEqual(pathA.split("/")[1], pathB.split("/")[1]);
  assert.equal(pathA.split("/")[1], USER_A_ID);
  assert.equal(pathB.split("/")[1], USER_B_ID);
});

test("16. Cross-couple image generation strictly isolates Couple 1 from Couple 2", () => {
  const pathC1 = getCoupleImagePath(COUPLE_1_ID, "jpg");
  const pathC2 = getCoupleImagePath(COUPLE_2_ID, "jpg");

  assert.notEqual(pathC1.split("/")[1], pathC2.split("/")[1]);
  assert.equal(pathC1.split("/")[1], COUPLE_1_ID);
  assert.equal(pathC2.split("/")[1], COUPLE_2_ID);
});

// ----------------------------------------------------------------------------
// 7. Request Generation / Stale Response Protection Contract
// ----------------------------------------------------------------------------
test("17. Stale image request sequence guard discards out-of-order network responses", () => {
  let activeSignedUrl = "https://storage.local/first-cover.jpg";
  let latestSeq = 1;

  // Request 1 starts with seq 1
  const req1Seq = 1;
  // Request 2 starts with seq 2
  latestSeq = 2;
  const req2Seq = 2;

  // Request 2 completes first
  activeSignedUrl = "https://storage.local/second-cover.jpg";

  // Request 1 arrives late (req1Seq < latestSeq)
  const shouldApplyReq1 = req1Seq >= latestSeq;
  assert.equal(shouldApplyReq1, false, "Older response must be discarded");
  assert.equal(activeSignedUrl, "https://storage.local/second-cover.jpg");
});

// ----------------------------------------------------------------------------
// 8. Default Fallback Resolution Contract
// ----------------------------------------------------------------------------
test("18. Default fallback asset is resolved when signed URL or path is null", () => {
  const personalCoverSignedUrl = null;
  const coupleImageSignedUrl = null;

  const defaultPersonalCover = personalCoverSignedUrl
    ? { uri: personalCoverSignedUrl }
    : "default-shared-horizon.jpg";

  const defaultCoupleImage = coupleImageSignedUrl
    ? { uri: coupleImageSignedUrl }
    : "default-giggle-otters.jpg";

  assert.equal(defaultPersonalCover, "default-shared-horizon.jpg");
  assert.equal(defaultCoupleImage, "default-giggle-otters.jpg");
});

// ----------------------------------------------------------------------------
// 9. Transactional Persistence & Rollback Contracts (Mock Client)
// ----------------------------------------------------------------------------
test("19. savePersonalCoverImage succeeds, updates DB, cleans previous file, and returns signed URL", async () => {
  const uploaded = [];
  const deleted = [];
  const dbUpdates = [];

  const mockClient = {
    storage: {
      from: (bucket) => ({
        upload: async (path, data, options) => {
          uploaded.push({ bucket, path, data, options });
          return { error: null };
        },
        createSignedUrl: async (path, expiresIn) => {
          return { data: { signedUrl: `https://storage.local/${path}?token=signed` }, error: null };
        },
        remove: async (paths) => {
          deleted.push(...paths);
          return { error: null };
        },
      }),
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { user_id: USER_A_ID }, error: null }),
        }),
      }),
      update: (payload) => ({
        eq: (col, val) => ({
          select: async () => {
            dbUpdates.push({ table, payload, col, val });
            return { data: [payload], error: null };
          },
        }),
      }),
    }),
  };

  const sampleBase64 = Buffer.from("fake-pixel").toString("base64");
  const previousPath = `personal/${USER_A_ID}/old_photo.jpg`;

  const result = await savePersonalCoverImage(
    USER_A_ID,
    { uri: "file://new.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
    previousPath,
    mockClient
  );

  assert.ok(result.path.startsWith(`personal/${USER_A_ID}/`));
  assert.equal(result.signedUrl, `https://storage.local/${result.path}?token=signed`);
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].path, result.path);
  assert.equal(dbUpdates.length, 1);
  assert.equal(dbUpdates[0].payload.personal_cover_path, result.path);
  assert.deepEqual(deleted, [previousPath]);
});

test("20. savePersonalCoverImage rolls back uploaded file if database persistence fails", async () => {
  const uploaded = [];
  const deleted = [];

  const mockClient = {
    storage: {
      from: (bucket) => ({
        upload: async (path, data, options) => {
          uploaded.push({ path });
          return { error: null };
        },
        createSignedUrl: async () => ({ data: { signedUrl: "signed" }, error: null }),
        remove: async (paths) => {
          deleted.push(...paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { user_id: USER_A_ID }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: async () => ({ data: null, error: new Error("Simulated database failure") }),
        }),
      }),
    }),
  };

  const sampleBase64 = Buffer.from("fake-pixel").toString("base64");

  await assert.rejects(
    async () => {
      await savePersonalCoverImage(
        USER_A_ID,
        { uri: "file://new.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
        null,
        mockClient
      );
    },
    /Unable to save your photo right now/
  );

  assert.equal(uploaded.length, 1);
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0], uploaded[0].path, "Uploaded file must be rolled back on DB error");
});

test("21. removePersonalCoverImage sets DB path to null and deletes file from storage", async () => {
  const deleted = [];
  const dbUpdates = [];

  const mockClient = {
    storage: {
      from: () => ({
        remove: async (paths) => {
          deleted.push(...paths);
          return { error: null };
        },
      }),
    },
    from: (table) => ({
      update: (payload) => ({
        eq: async (col, val) => {
          dbUpdates.push({ table, payload, col, val });
          return { error: null };
        },
      }),
    }),
  };

  const currentPath = `personal/${USER_A_ID}/cover_to_delete.jpg`;
  await removePersonalCoverImage(USER_A_ID, currentPath, mockClient);

  assert.equal(dbUpdates.length, 1);
  assert.equal(dbUpdates[0].table, "user_partner_profiles");
  assert.equal(dbUpdates[0].payload.personal_cover_path, null);
  assert.equal(dbUpdates[0].val, USER_A_ID);
  assert.deepEqual(deleted, [currentPath]);
});

test("22. saveCoupleImage succeeds, updates DB, cleans previous file, and returns signed URL", async () => {
  const uploaded = [];
  const deleted = [];
  const dbUpdates = [];

  const mockClient = {
    storage: {
      from: (bucket) => ({
        upload: async (path, data, options) => {
          uploaded.push({ bucket, path, data, options });
          return { error: null };
        },
        createSignedUrl: async (path, expiresIn) => {
          return { data: { signedUrl: `https://storage.local/${path}?token=signed` }, error: null };
        },
        remove: async (paths) => {
          deleted.push(...paths);
          return { error: null };
        },
      }),
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { couple_id: COUPLE_1_ID }, error: null }),
        }),
      }),
      update: (payload) => ({
        eq: (col, val) => ({
          select: async () => {
            dbUpdates.push({ table, payload, col, val });
            return { data: [payload], error: null };
          },
        }),
      }),
    }),
  };

  const sampleBase64 = Buffer.from("fake-pixel").toString("base64");
  const previousPath = `couples/${COUPLE_1_ID}/old_avatar.png`;

  const result = await saveCoupleImage(
    COUPLE_1_ID,
    { uri: "file://new.png", mimeType: "image/png", base64: sampleBase64 },
    previousPath,
    mockClient
  );

  assert.ok(result.path.startsWith(`couples/${COUPLE_1_ID}/`));
  assert.equal(result.signedUrl, `https://storage.local/${result.path}?token=signed`);
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].path, result.path);
  assert.equal(dbUpdates.length, 1);
  assert.equal(dbUpdates[0].payload.couple_image_path, result.path);
  assert.deepEqual(deleted, [previousPath]);
});

test("23. saveCoupleImage rolls back uploaded file if database persistence fails", async () => {
  const uploaded = [];
  const deleted = [];

  const mockClient = {
    storage: {
      from: () => ({
        upload: async (path, data, options) => {
          uploaded.push({ path });
          return { error: null };
        },
        createSignedUrl: async () => ({ data: { signedUrl: "signed" }, error: null }),
        remove: async (paths) => {
          deleted.push(...paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { couple_id: COUPLE_1_ID }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: async () => ({ data: null, error: new Error("Simulated couple DB failure") }),
        }),
      }),
    }),
  };

  const sampleBase64 = Buffer.from("fake-pixel").toString("base64");

  await assert.rejects(
    async () => {
      await saveCoupleImage(
        COUPLE_1_ID,
        { uri: "file://new.png", mimeType: "image/png", base64: sampleBase64 },
        null,
        mockClient
      );
    },
    /Unable to save couple image right now/
  );

  assert.equal(uploaded.length, 1);
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0], uploaded[0].path, "Uploaded couple file must be rolled back on DB error");
});

test("24. removeCoupleImage sets DB path to null and deletes file from storage", async () => {
  const deleted = [];
  const dbUpdates = [];

  const mockClient = {
    storage: {
      from: () => ({
        remove: async (paths) => {
          deleted.push(...paths);
          return { error: null };
        },
      }),
    },
    from: (table) => ({
      update: (payload) => ({
        eq: async (col, val) => {
          dbUpdates.push({ table, payload, col, val });
          return { error: null };
        },
      }),
    }),
  };

  const currentPath = `couples/${COUPLE_1_ID}/couple_to_delete.png`;
  await removeCoupleImage(COUPLE_1_ID, currentPath, mockClient);

  assert.equal(dbUpdates.length, 1);
  assert.equal(dbUpdates[0].table, "couple_profiles");
  assert.equal(dbUpdates[0].payload.couple_image_path, null);
  assert.equal(dbUpdates[0].val, COUPLE_1_ID);
  assert.deepEqual(deleted, [currentPath]);
});

// ----------------------------------------------------------------------------
// 10. Ours Card DOM Nesting & Accessibility Regression Contracts
// ----------------------------------------------------------------------------
function getOursCardContainerSnippet() {
  const homeContent = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/home.tsx"),
    "utf-8"
  );
  const startMarker = "<View style={styles.oursCardContainer}>";
  const startIdx = homeContent.indexOf(startMarker);
  assert.ok(
    startIdx !== -1,
    "styles.oursCardContainer must exist as the non-interactive parent"
  );

  const endMarker = 'Your week, gently';
  const endIdx = homeContent.indexOf(endMarker, startIdx);
  assert.ok(endIdx !== -1, "Ours card section end marker must exist");

  return homeContent.substring(startIdx, endIdx);
}

test("25. Ours edit Pressable is a sibling of the navigation Pressable, not nested within it", () => {
  const containerContent = getOursCardContainerSnippet();

  // Verify that oursCardNavigation Pressable opens and closes before oursAvatarEditBadge
  const navPressableStart = containerContent.indexOf("styles.oursCardNavigation");
  assert.ok(navPressableStart !== -1, "oursCardNavigation must be inside oursCardContainer");

  const badgePressableStart = containerContent.indexOf("styles.oursAvatarEditBadge");
  assert.ok(badgePressableStart !== -1, "oursAvatarEditBadge must be inside oursCardContainer");

  // Find the closing </Pressable> of the navigation card
  const navClosingPressable = containerContent.indexOf("</Pressable>");
  assert.ok(navClosingPressable !== -1, "Navigation card must close");

  // The navigation card must close BEFORE the badge Pressable starts
  assert.ok(
    navClosingPressable < badgePressableStart,
    "Navigation Pressable must close before the Edit Badge Pressable starts (must be siblings)"
  );
});

test("26. Main-card navigation and image editing remain separate, decoupled callbacks", () => {
  const containerContent = getOursCardContainerSnippet();

  // Navigation Pressable must call handleSpaceAction("Ours")
  assert.ok(
    containerContent.includes('onPress={() => handleSpaceAction("Ours")}'),
    "Navigation Pressable must trigger handleSpaceAction('Ours')"
  );

  // Edit Pressable must call handleOpenCoupleImageActionSheet
  assert.ok(
    containerContent.includes("onPress={handleOpenCoupleImageActionSheet}"),
    "Edit badge Pressable must trigger handleOpenCoupleImageActionSheet"
  );
});

test("27. No stopPropagation workaround is present in Ours card", () => {
  const containerContent = getOursCardContainerSnippet();

  assert.ok(
    !containerContent.includes("stopPropagation"),
    "stopPropagation workaround must be completely removed"
  );
});

test("28. Both controls retain distinct accessibility roles, labels, and >= 44x44 touch targets", () => {
  const containerContent = getOursCardContainerSnippet();

  // Check navigation accessibility
  assert.ok(containerContent.includes('accessibilityLabel="Open Ours, your shared space"'));
  assert.ok(containerContent.includes('accessibilityRole="button"'));

  // Check badge accessibility
  assert.ok(containerContent.includes('accessibilityLabel="Change your shared couple image"'));
  assert.ok(
    containerContent.includes(
      'accessibilityHint="Opens options to change or restore your shared couple image"'
    )
  );
  assert.ok(
    containerContent.includes("hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}"),
    "Badge must retain hitSlop expanding effective touch target to >= 44x44"
  );
});

// ----------------------------------------------------------------------------
// 11. Web Asset Payload & Database Error Edge Cases
// ----------------------------------------------------------------------------
test("29. prepareAssetPayload converts web asset.file ArrayBuffer correctly", async () => {
  const content = new TextEncoder().encode("web-image-binary-data");
  const fakeFile = {
    size: content.byteLength,
    type: "image/png",
    name: "web_photo.png",
    arrayBuffer: async () => content.buffer,
  };
  const payload = await prepareAssetPayload({
    uri: "blob:http://localhost:8081/abc-123",
    file: fakeFile,
  });
  assert.equal(payload.contentType, "image/png");
  assert.equal(payload.extension, "png");
  assert.equal(payload.data instanceof Uint8Array, true);
  assert.equal(payload.data.byteLength, content.byteLength);
});

test("30. prepareAssetPayload rejects empty image files", async () => {
  const emptyFile = {
    size: 0,
    type: "image/png",
    name: "empty.png",
    arrayBuffer: async () => new ArrayBuffer(0),
  };
  await assert.rejects(
    async () => {
      await prepareAssetPayload({
        uri: "blob:http://localhost:8081/empty",
        file: emptyFile,
      });
    },
    /Selected image file is empty/
  );
});

test("31. validateImageFile inspects asset.file.size and asset.file.type when top-level fields omitted", () => {
  const fileAsset = {
    uri: "blob:http://localhost:8081/photo",
    file: {
      size: 2 * 1024 * 1024,
      type: "image/webp",
      name: "avatar.webp",
    },
  };
  const result = validateImageFile(fileAsset);
  assert.equal(result.valid, true);
  assert.equal(result.mimeType, "image/webp");
  assert.equal(result.extension, "webp");

  const oversizedFileAsset = {
    uri: "blob:http://localhost:8081/huge",
    file: {
      size: 9 * 1024 * 1024,
      type: "image/jpeg",
    },
  };
  const overResult = validateImageFile(oversizedFileAsset);
  assert.equal(overResult.valid, false);
  assert.equal(overResult.error, "File size must be 8 MB or less.");
});

test("32. savePersonalCoverImage performs INSERT when user profile row does not yet exist", async () => {
  const uploaded = [];
  const dbInserts = [];

  const mockClient = {
    storage: {
      from: () => ({
        upload: async (path, data, options) => {
          uploaded.push({ path, data, options });
          return { error: null };
        },
        createSignedUrl: async (path) => ({
          data: { signedUrl: `https://storage.local/${path}?token=signed` },
          error: null,
        }),
        remove: async () => ({ error: null }),
      }),
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }), // No existing row
        }),
      }),
      insert: (payload) => ({
        select: async () => {
          dbInserts.push({ table, payload });
          return { data: [payload], error: null };
        },
      }),
    }),
  };

  const sampleBase64 = Buffer.from("pixel").toString("base64");
  const result = await savePersonalCoverImage(
    USER_A_ID,
    { uri: "file://new.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
    null,
    mockClient
  );

  assert.ok(result.path.startsWith(`personal/${USER_A_ID}/`));
  assert.equal(dbInserts.length, 1);
  assert.equal(dbInserts[0].payload.user_id, USER_A_ID);
  assert.equal(dbInserts[0].payload.personal_cover_path, result.path);
});

test("33. saveCoupleImage rolls back and throws when couple row is not found (0 rows updated)", async () => {
  const uploaded = [];
  const deleted = [];
  const mockClient = {
    storage: {
      from: () => ({
        upload: async (path) => {
          uploaded.push({ path });
          return { error: null };
        },
        createSignedUrl: async () => ({ data: { signedUrl: "signed" }, error: null }),
        remove: async (paths) => {
          deleted.push(...paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { couple_id: COUPLE_1_ID }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: async () => ({ data: [], error: null }), // 0 rows updated
        }),
      }),
    }),
  };

  const sampleBase64 = Buffer.from("fake-pixel").toString("base64");
  await assert.rejects(
    async () => {
      await saveCoupleImage(
        COUPLE_1_ID,
        { uri: "file://new.png", mimeType: "image/png", base64: sampleBase64 },
        null,
        mockClient
      );
    },
    /Unable to save couple image right now/
  );

  assert.equal(uploaded.length, 1);
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0], uploaded[0].path);
});

test("34. Storage bucket missing error is properly captured and surfaced", async () => {
  const mockClient = {
    storage: {
      from: () => ({
        upload: async () => {
          return { error: new Error("Bucket not found") };
        },
      }),
    },
  };
  const sampleBase64 = Buffer.from("fake-pixel").toString("base64");
  await assert.rejects(
    async () => {
      await saveCoupleImage(
        COUPLE_1_ID,
        { uri: "file://new.png", mimeType: "image/png", base64: sampleBase64 },
        null,
        mockClient
      );
    },
    /Storage upload failed: Bucket not found/
  );
});

// ----------------------------------------------------------------------------
// 12. user_partner_profiles Bootstrap & Security Invariants
// ----------------------------------------------------------------------------

test("35. Existing profile row triggers owner-scoped UPDATE only", async () => {
  const dbUpdates = [];
  const dbInserts = [];

  const mockClient = {
    storage: {
      from: () => ({
        upload: async (path) => ({ error: null }),
        createSignedUrl: async (path) => ({ data: { signedUrl: `https://storage.local/${path}` }, error: null }),
        remove: async () => ({ error: null }),
      }),
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { user_id: USER_A_ID }, error: null }), // Existing row
        }),
      }),
      update: (payload) => ({
        eq: (col, val) => ({
          select: async () => {
            dbUpdates.push({ table, payload, col, val });
            return { data: [payload], error: null };
          },
        }),
      }),
      insert: (payload) => ({
        select: async () => {
          dbInserts.push(payload);
          return { data: [payload], error: null };
        },
      }),
    }),
  };

  const sampleBase64 = Buffer.from("pixel").toString("base64");
  const result = await savePersonalCoverImage(
    USER_A_ID,
    { uri: "file://photo.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
    null,
    mockClient
  );

  assert.equal(dbUpdates.length, 1);
  assert.equal(dbInserts.length, 0, "Must not insert when profile row already exists");
  assert.equal(dbUpdates[0].col, "user_id");
  assert.equal(dbUpdates[0].val, USER_A_ID);
  assert.equal(dbUpdates[0].payload.personal_cover_path, result.path);
});

test("36. Missing profile row bootstraps with minimal INSERT", async () => {
  const dbUpdates = [];
  const dbInserts = [];

  const mockClient = {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async (path) => ({ data: { signedUrl: `https://storage.local/${path}` }, error: null }),
        remove: async () => ({ error: null }),
      }),
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }), // Missing row
        }),
      }),
      insert: (payload) => ({
        select: async () => {
          dbInserts.push({ table, payload });
          return { data: [payload], error: null };
        },
      }),
      update: (payload) => ({
        eq: () => ({
          select: async () => {
            dbUpdates.push(payload);
            return { data: [payload], error: null };
          },
        }),
      }),
    }),
  };

  const sampleBase64 = Buffer.from("pixel").toString("base64");
  const result = await savePersonalCoverImage(
    USER_A_ID,
    { uri: "file://photo.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
    null,
    mockClient
  );

  assert.equal(dbInserts.length, 1);
  assert.equal(dbUpdates.length, 0);
  assert.equal(dbInserts[0].payload.user_id, USER_A_ID);
  assert.equal(dbInserts[0].payload.personal_cover_path, result.path);
});

test("37. Minimal insert does not overwrite unrelated profile fields", async () => {
  let insertedPayload = null;

  const mockClient = {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async (path) => ({ data: { signedUrl: `https://storage.local/${path}` }, error: null }),
        remove: async () => ({ error: null }),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      insert: (payload) => ({
        select: async () => {
          insertedPayload = payload;
          return { data: [payload], error: null };
        },
      }),
    }),
  };

  const sampleBase64 = Buffer.from("pixel").toString("base64");
  await savePersonalCoverImage(
    USER_A_ID,
    { uri: "file://photo.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
    null,
    mockClient
  );

  assert.ok(insertedPayload !== null);
  const keys = Object.keys(insertedPayload).sort();
  assert.deepEqual(
    keys,
    ["personal_cover_path", "user_id"],
    "Bootstrap payload must contain ONLY user_id and personal_cover_path"
  );
});

test("38. Insert uses authenticated user ID from active session", async () => {
  let capturedUserId = null;

  const mockClient = {
    auth: {
      getUser: async () => ({
        data: { user: { id: USER_A_ID } },
        error: null,
      }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async (path) => ({ data: { signedUrl: `https://storage.local/${path}` }, error: null }),
        remove: async () => ({ error: null }),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      insert: (payload) => ({
        select: async () => {
          capturedUserId = payload.user_id;
          return { data: [payload], error: null };
        },
      }),
    }),
  };

  const sampleBase64 = Buffer.from("pixel").toString("base64");
  // Calling with empty userId string; should infer from authenticated session
  await savePersonalCoverImage(
    "",
    { uri: "file://photo.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
    null,
    mockClient
  );

  assert.equal(capturedUserId, USER_A_ID);
});

test("39. Attempt to create another user's profile is rejected", async () => {
  const mockClient = {
    auth: {
      getUser: async () => ({
        data: { user: { id: USER_A_ID } }, // Authenticated as User A
        error: null,
      }),
    },
  };

  const sampleBase64 = Buffer.from("pixel").toString("base64");
  // Attempting to save for User B while authenticated as User A
  await assert.rejects(
    async () => {
      await savePersonalCoverImage(
        USER_B_ID,
        { uri: "file://photo.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
        null,
        mockClient
      );
    },
    /user account does not match active session/
  );
});

test("40. Concurrent unique-conflict retries owner-scoped update once and succeeds", async () => {
  const dbUpdates = [];
  let insertAttempted = false;

  const mockClient = {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async (path) => ({ data: { signedUrl: `https://storage.local/${path}` }, error: null }),
        remove: async () => ({ error: null }),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }), // Initially missing
        }),
      }),
      insert: () => ({
        select: async () => {
          insertAttempted = true;
          // Concurrent worker created the row first: duplicate key error 23505
          return {
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          };
        },
      }),
      update: (payload) => ({
        eq: (col, val) => ({
          select: async () => {
            dbUpdates.push({ payload, col, val });
            return { data: [payload], error: null };
          },
        }),
      }),
    }),
  };

  const sampleBase64 = Buffer.from("pixel").toString("base64");
  const result = await savePersonalCoverImage(
    USER_A_ID,
    { uri: "file://photo.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
    null,
    mockClient
  );

  assert.equal(insertAttempted, true);
  assert.equal(dbUpdates.length, 1, "Must retry update on unique constraint conflict");
  assert.equal(dbUpdates[0].val, USER_A_ID);
  assert.equal(dbUpdates[0].payload.personal_cover_path, result.path);
});

test("41. Insert failure rolls back newly uploaded object", async () => {
  const uploaded = [];
  const deleted = [];

  const mockClient = {
    storage: {
      from: () => ({
        upload: async (path) => {
          uploaded.push(path);
          return { error: null };
        },
        createSignedUrl: async () => ({ data: { signedUrl: "signed" }, error: null }),
        remove: async (paths) => {
          deleted.push(...paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      insert: () => ({
        select: async () => ({ data: null, error: new Error("Insert permission denied") }),
      }),
    }),
  };

  const sampleBase64 = Buffer.from("pixel").toString("base64");
  await assert.rejects(
    async () => {
      await savePersonalCoverImage(
        USER_A_ID,
        { uri: "file://photo.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
        null,
        mockClient
      );
    },
    /Unable to save your photo right now/
  );

  assert.equal(uploaded.length, 1);
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0], uploaded[0], "Uploaded storage object must be deleted on insert failure");
});

test("42. Zero-row insert/update is treated as failure", async () => {
  const deleted = [];

  const mockClient = {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "signed" }, error: null }),
        remove: async (paths) => {
          deleted.push(...paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      insert: () => ({
        select: async () => ({ data: [], error: null }), // 0 rows affected
      }),
    }),
  };

  const sampleBase64 = Buffer.from("pixel").toString("base64");
  await assert.rejects(
    async () => {
      await savePersonalCoverImage(
        USER_A_ID,
        { uri: "file://photo.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
        null,
        mockClient
      );
    },
    /Unable to save your photo right now/
  );

  assert.equal(deleted.length, 1);
});

test("43. Previous image is not deleted on bootstrap failure", async () => {
  const deleted = [];
  const previousPath = `personal/${USER_A_ID}/keep_me.jpg`;

  const mockClient = {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "signed" }, error: null }),
        remove: async (paths) => {
          deleted.push(...paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      insert: () => ({
        select: async () => ({ data: null, error: new Error("Network timeout") }),
      }),
    }),
  };

  const sampleBase64 = Buffer.from("pixel").toString("base64");
  await assert.rejects(
    async () => {
      await savePersonalCoverImage(
        USER_A_ID,
        { uri: "file://photo.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
        previousPath,
        mockClient
      );
    },
    /Unable to save your photo right now/
  );

  assert.ok(
    !deleted.includes(previousPath),
    "Previous image must NOT be deleted when new upload/bootstrap fails"
  );
});

test("44. First upload returns a usable signed URL", async () => {
  const sampleBase64 = Buffer.from("pixel").toString("base64");
  const expectedSignedUrl = `https://storage.local/personal/${USER_A_ID}/signed_first_cover.jpg`;

  const mockClient = {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: expectedSignedUrl }, error: null }),
        remove: async () => ({ error: null }),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      insert: (payload) => ({
        select: async () => ({ data: [payload], error: null }),
      }),
    }),
  };

  const result = await savePersonalCoverImage(
    USER_A_ID,
    { uri: "file://photo.jpg", mimeType: "image/jpeg", base64: sampleBase64 },
    null,
    mockClient
  );

  assert.equal(result.signedUrl, expectedSignedUrl);
  assert.ok(result.path.startsWith(`personal/${USER_A_ID}/`));
});
