// backend/upload.js
const { v2: cloudinary } = require("cloudinary");

/**
 * Cloudinary Configuration
 * -------------------------
 * We expect environment variables:
 *   - CLOUDINARY_CLOUD_NAME
 *   - CLOUDINARY_API_KEY
 *   - CLOUDINARY_API_SECRET
 */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

/**
 * Utility: Upload buffer to Cloudinary
 *
 * @param {Buffer} buffer - Image/file buffer from multer memory storage
 * @param {object} options
 *    - folder: Cloudinary folder path
 *
 * Example return object from Cloudinary:
 * {
 *   asset_id, public_id, secure_url,
 *   format, bytes, width, height
 * }
 */

function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      if (!buffer) {
        console.error("❌ uploadBufferToCloudinary: Missing buffer");
        return reject(new Error("Missing file buffer"));
      }

      console.log("🌥️ Uploading buffer to Cloudinary… folder=", options.folder);

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || "kaurta/uploads",
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            console.error("❌ Cloudinary upload error:", error);
            return reject(error);
          }

          console.log("✅ Cloudinary upload success:", {
            public_id: result.public_id,
            url: result.secure_url,
          });

          resolve(result);
        }
      );

      uploadStream.end(buffer);
    } catch (err) {
      console.error("❌ uploadBufferToCloudinary unexpected error:", err);
      reject(err);
    }
  });
}

/**
 * Delete a Cloudinary asset by public_id
 *
 * @param {string} publicId
 */
async function destroyPublicId(publicId) {
  if (!publicId) {
    console.warn("⚠️ destroyPublicId: publicId is empty");
    return { result: "no_public_id" };
  }

  try {
    console.log("🗑️ Deleting Cloudinary asset public_id=", publicId);

    const result = await cloudinary.uploader.destroy(publicId);
    console.log("🗑️ Cloudinary destroy result:", result);
    return result;
  } catch (err) {
    console.error("❌ destroyPublicId error for", publicId, err);
    return { error: err.message };
  }
}

module.exports = {
  uploadBufferToCloudinary,
  destroyPublicId,
};
