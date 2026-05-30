import fs from 'fs';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';
import prisma from './db';
import { config } from '../config';
import { processProductImages, cleanupTempFiles } from './imageProcessor';
import { listingQueue } from './queue';
import { Category, Metal, Finish } from '@prisma/client';

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY || 'mock_key',
});

export interface RawListingInput {
  name: string;
  category: Category;
  metal: Metal;
  finish: Finish;
  weightGrams?: number;
  stoneType?: string;
  occasion?: string;
  priceINR: number;
  imagePaths: string[];  // Local temp paths
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

async function ensureUniqueSlug(slug: string): Promise<string> {
  const baseSlug = slugify(slug);
  let uniqueSlug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: uniqueSlug }
    });
    if (!existing) {
      return uniqueSlug;
    }
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }
}

function validateCopy(copy: any): void {
  const requiredFields = ['displayName', 'shortDesc', 'description', 'metaTitle', 'metaDescription', 'keywords', 'slug'];
  for (const field of requiredFields) {
    if (copy[field] === undefined || copy[field] === null || copy[field] === '') {
      throw new Error('AI_RESPONSE_INCOMPLETE');
    }
  }
  if (!Array.isArray(copy.keywords)) {
    throw new Error('AI_RESPONSE_INCOMPLETE');
  }
}

export async function enhanceListing(productId: string, input: RawListingInput): Promise<void> {
  let tempFilesToCleanup: string[] = [];

  try {
    console.log(`🤖 Starting AI Listing Enhancement for Product: ${productId}`);

    // STEP 1: Generate copy via GPT-4o
    const copyResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a luxury jewellery copywriter for an Indian jewellery brand. 
Write in English. Tone: warm, aspirational, elegant — never salesy or generic.
Always mention the specific material and craftsmanship technique.
Output must be valid JSON matching the schema exactly. No markdown, no extra text.`
        },
        {
          role: 'user',
          content: `Generate product listing content for this jewellery piece:
Name: ${input.name}
Category: ${input.category}
Metal: ${input.metal}
Finish: ${input.finish}
Stone/Detail: ${input.stoneType || 'none'}
Weight: ${input.weightGrams ? input.weightGrams + 'g' : 'not specified'}
Occasion: ${input.occasion || 'not specified'}
Price: ₹${input.priceINR}

Return JSON:
{
  "displayName": "Short elegant product name (5-8 words)",
  "shortDesc": "One-line description under 55 characters",
  "description": "SEO product description — 130-160 words. Include material, craftsmanship, occasion, and styling tip. Warm, aspirational tone.",
  "metaTitle": "SEO title under 60 chars — include key material + category + India",
  "metaDescription": "SEO meta description under 155 chars — compelling, include price signal",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "slug": "url-slug-lowercase-hyphens-descriptive-under-60-chars"
}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = copyResponse.choices[0].message?.content;
    if (!content) {
      throw new Error('AI_SERVICE_UNAVAILABLE');
    }

    const copy = JSON.parse(content);
    validateCopy(copy);

    // Ensure slug is unique and URL-safe
    const uniqueSlug = await ensureUniqueSlug(copy.slug);

    // STEP 2: Enhance images via GPT-Image-1 (sequentially due to rate limits)
    const enhancedImagePaths: string[] = [];

    for (const imagePath of input.imagePaths) {
      try {
        console.log(`📸 AI Enhancing background/lighting for image: ${imagePath}`);
        const enhancedResponse = await openai.images.edit({
          model: 'gpt-image-1',
          image: fs.createReadStream(imagePath),
          prompt: `Professional jewellery product photography. 
Remove the background completely. Replace with pure white (#FFFFFF) or very light cream background.
Add soft, even studio lighting — no harsh shadows.
The jewellery should appear centered, well-lit, and sharp.
Make it look like a professional e-commerce product photo.
Do not add any props, hands, or accessories.`,
          size: '1024x1024',
          n: 1,
          response_format: 'b64_json',
        });

        if (!enhancedResponse.data || !enhancedResponse.data[0] || !enhancedResponse.data[0].b64_json) {
          throw new Error('No b64_json returned by OpenAI Images Edit');
        }
        const enhancedBase64 = enhancedResponse.data[0].b64_json;

        const tempEnhancedPath = path.join(
          os.tmpdir(),
          `enhanced_${productId}_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`
        );
        fs.writeFileSync(tempEnhancedPath, Buffer.from(enhancedBase64, 'base64'));
        
        enhancedImagePaths.push(tempEnhancedPath);
        tempFilesToCleanup.push(tempEnhancedPath);
      } catch (err: any) {
        console.error(`⚠️ OpenAI Image Enhancement failed for image ${imagePath}, using original. Error:`, err.message || err);
        // Fallback: use original raw image
        enhancedImagePaths.push(imagePath);
      }
    }

    // STEP 3: Process images with Sharp
    console.log(`🎨 Resizing and optimizing images with Sharp...`);
    const processedImages = await processProductImages(productId, enhancedImagePaths, copy.displayName);

    // STEP 4: Write everything to database
    console.log(`💾 Persisting product and image records to Postgres...`);
    
    // Delete existing images to avoid duplicates on re-enhance
    await prisma.productImage.deleteMany({
      where: { productId }
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        slug: uniqueSlug,
        displayName: copy.displayName,
        shortDesc: copy.shortDesc,
        description: copy.description,
        metaTitle: copy.metaTitle,
        metaDescription: copy.metaDescription,
        keywords: copy.keywords,
        primaryImageUrl: processedImages[0]?.urlMedium || '',
        aiEnhanced: true,
        status: 'UNLISTED', // Remains UNLISTED so the admin can review first and then publish
        images: {
          createMany: {
            data: processedImages.map(img => ({
              url: img.url,
              urlThumb: img.urlThumb,
              urlMedium: img.urlMedium,
              urlFull: img.urlFull,
              order: img.order,
              altText: img.altText,
            }))
          }
        },
      }
    });

    console.log(`✅ AI listing pipeline completed successfully for product: ${productId}`);
  } catch (err: any) {
    console.error(`❌ AI Listing Pipeline error for product: ${productId}:`, err);
    throw err; // Throw to fail the Bull job
  } finally {
    // Clean up temporary generated files
    if (tempFilesToCleanup.length > 0) {
      cleanupTempFiles(tempFilesToCleanup);
    }
  }
}

// Register as the Bull job processor for listingQueue
listingQueue.process(async (job) => {
  const { productId, input } = job.data;
  await enhanceListing(productId, input);
});

// Setup complete-fail temp file cleanup event handlers
listingQueue.on('completed', async (job) => {
  console.log(`Job completed for product: ${job.data.productId}`);
  const { input } = job.data;
  if (input && input.imagePaths) {
    cleanupTempFiles(input.imagePaths);
  }
});

listingQueue.on('failed', async (job, err) => {
  console.error(`Job failed for product: ${job.data.productId}, Error:`, err);
  const { input } = job.data;
  if (input && input.imagePaths) {
    cleanupTempFiles(input.imagePaths);
  }
});
