import { Platform } from "react-native";

export async function uploadToCloudinary(
  localUri: string,
  uploadPreset: string,
  cloudName: string
): Promise<string> {
  try {
    const data = new FormData();

    const fileName = localUri.split("/").pop() || `upload_${Date.now()}.jpg`;

    const file: any = {
      uri: localUri,
      type: "image/jpeg",
      name: fileName,
    };

    data.append("file", file);
    data.append("upload_preset", uploadPreset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: data,
      }
    );

    const json = await res.json();

    if (json.secure_url) {
      return json.secure_url;
    } else {
      throw new Error(json.error?.message || "Cloudinary upload failed");
    }
  } catch (e: any) {
    console.error("Cloudinary upload error:", e);
    throw e;
  }
}
