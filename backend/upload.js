// upload.js
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// Debug: Check env variables
console.log("🔧 Cloudinary Config Check:");
console.log(" - CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log(" - API_KEY:", process.env.CLOUDINARY_API_KEY ? "(loaded)" : "(missing)");
console.log(" - API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "(loaded)" : "(missing)");

// Configure cloudinary
cloudinary.config({
  cloud_name:
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_URL?.match(/cloudinary:\/\/([^:]+):([^@]+)@([^/]+)/)?.[3],
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Debug: Confirm config applied
console.log("🌩 Cloudinary initialized with cloud name:", cloudinary.config().cloud_name);

function uploadBufferToCloudinary(
  buffer,
  { folder = "", publicId = null, resource_type = "image" } = {}
) {
  console.log("⬆️ Starting Cloudinary Upload");
  console.log(" - Folder:", folder);
  console.log(" - Public ID (optional):", publicId);

  return new Promise((resolve, reject) => {
    const opts = {};
    if (folder) opts.folder = folder;
    if (publicId) opts.public_id = publicId;
    opts.resource_type = resource_type;

    console.log("📦 Upload Options:", opts);

    const uploadStream = cloudinary.uploader.upload_stream((err, result) => {
      if (err) {
        console.error("❌ Cloudinary Upload Error:", err);
        return reject(err);
      }

      console.log("✅ Cloudinary Upload Success:");
      console.log(" - URL:", result.secure_url);
      console.log(" - Public ID:", result.public_id);

      resolve(result);
    });

    // Debug: Verify buffer size
    console.log("📏 Uploading buffer size:", buffer.length, "bytes");

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

async function destroyPublicId(publicId) {
  if (!publicId) {
    console.log("⚠️ destroyPublicId called with null publicId");
    return null;
  }

  console.log("🗑 Destroying Cloudinary public ID:", publicId);

  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    console.log("🧹 Cloudinary destroy result:", res);
    return res;
  } catch (err) {
    console.warn("❌ Cloudinary destroy error:", err?.message || err);
    return null;
  }
}

module.exports = {
  uploadBufferToCloudinary,
  destroyPublicId,
  cloudinary, // export for debugging
};
