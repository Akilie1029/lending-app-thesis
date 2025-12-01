// upload.js
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// Configure cloudinary via env (set on Railway)
// CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_URL?.match(/cloudinary:\/\/([^:]+):([^@]+)@([^/]+)/)?.[3],
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function uploadBufferToCloudinary(buffer, { folder = "", publicId = null, resource_type = "image" } = {}) {
  return new Promise((resolve, reject) => {
    const opts = {};
    if (folder) opts.folder = folder;
    if (publicId) opts.public_id = publicId;
    opts.resource_type = resource_type;
    const uploadStream = cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

async function destroyPublicId(publicId) {
  if (!publicId) return null;
  try {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    return res;
  } catch (err) {
    console.warn("cloudinary destroy error", err?.message || err);
    return null;
  }
}

module.exports = {
  uploadBufferToCloudinary,
  destroyPublicId,
  cloudinary, // export for debugging if needed
};
