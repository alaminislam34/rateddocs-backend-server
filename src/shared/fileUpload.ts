import multer from 'multer';
import cloudinary from '../config/cloudinary.js';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export const uploadToCloudinary = (
  fileBuffer: Buffer,
  folder = 'rateddocs',
): Promise<{ secure_url: string; public_id: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error || !result) {
        return reject(error || new Error('Upload to Cloudinary failed'));
      }
      resolve({
        secure_url: result.secure_url,
        public_id: result.public_id,
      });
    });
    uploadStream.end(fileBuffer);
  });
};
