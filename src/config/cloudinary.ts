import { v2 as cloudinary } from 'cloudinary';
import { envVars } from './env.js';

cloudinary.config({
  cloud_name: envVars.CLOUDINARY_CLOUD_NAME as string,
  api_key: envVars.CLOUDINARY_API_KEY as string,
  api_secret: envVars.CLOUDINARY_API_SECRET as string,
});

export default cloudinary;
