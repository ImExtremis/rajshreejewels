import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export interface ProcessedImage {
  url: string;        // Added for matching the model schema field
  urlThumb: string;   // 300×300 WebP
  urlMedium: string;  // 800×800 WebP
  urlFull: string;    // 1600×1600 WebP contain, white bg
  order: number;
  altText: string;
}

export async function processProductImages(
  productId: string,
  imagePaths: string[],         // Raw input paths (temp files)
  displayName: string
): Promise<ProcessedImage[]> {
  const outputDir = path.join('/data/images/products', productId);
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const processedImages: ProcessedImage[] = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const rawPath = imagePaths[i];
    const filenameBase = `img_${i}`;
    
    const thumbFilename = `${filenameBase}_thumb.webp`;
    const mediumFilename = `${filenameBase}_medium.webp`;
    const fullFilename = `${filenameBase}_full.webp`;

    const thumbPath = path.join(outputDir, thumbFilename);
    const mediumPath = path.join(outputDir, mediumFilename);
    const fullPath = path.join(outputDir, fullFilename);

    // 1. Generate thumb: 300x300 cover, WebP, quality 85
    await sharp(rawPath)
      .resize(300, 300, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(thumbPath);

    // 2. Generate medium: 800x800 cover, WebP, quality 88
    await sharp(rawPath)
      .resize(800, 800, { fit: 'cover' })
      .webp({ quality: 88 })
      .toFile(mediumPath);

    // 3. Generate full: 1600x1600 contain, background #FFFFFF, WebP, quality 92
    await sharp(rawPath)
      .resize(1600, 1600, { fit: 'contain', background: '#FFFFFF' })
      .webp({ quality: 92 })
      .toFile(fullPath);

    processedImages.push({
      url: `/images/products/${productId}/${fullFilename}`,
      urlThumb: `/images/products/${productId}/${thumbFilename}`,
      urlMedium: `/images/products/${productId}/${mediumFilename}`,
      urlFull: `/images/products/${productId}/${fullFilename}`,
      order: i,
      altText: `${displayName} - Image ${i + 1}`,
    });
  }

  return processedImages;
}

export function cleanupTempFiles(paths: string[]): void {
  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🧹 Cleaned up temp file: ${filePath}`);
      }
    } catch (err: any) {
      console.error(`❌ Failed to delete temp file ${filePath}:`, err.message || err);
    }
  }
}
