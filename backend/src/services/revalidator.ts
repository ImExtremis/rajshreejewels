import axios from 'axios';
import { config } from '../config';
import prisma from './db';

/**
 * Dispatches an asynchronous on-demand ISR revalidation HTTP request to the Next.js Storefront.
 * Never blocks the main thread or throws errors that disrupt parent operations.
 */
export async function triggerRevalidation(slugOrProductId?: string): Promise<void> {
  try {
    let slug = slugOrProductId;
    const revalidateUrl = `${config.FRONTEND_URL}/api/revalidate`;
    const params: any = {
      secret: config.REVALIDATE_SECRET
    };

    if (slugOrProductId) {
      // If a product ID is passed instead of a slug, resolve the slug from DB first
      if (slugOrProductId.startsWith('prod-') || slugOrProductId.length > 20) {
        const product = await prisma.product.findUnique({
          where: { id: slugOrProductId },
          select: { slug: true }
        });
        if (product?.slug) {
          slug = product.slug;
        } else {
          console.warn(`⚠️ Revalidation skipped: Could not resolve product with ID '${slugOrProductId}'`);
          return;
        }
      }
      params.slug = slug;
      console.log(`🔄 Triggering on-demand storefront ISR revalidation for slug: ${slug}...`);
    } else {
      console.log(`🔄 Triggering on-demand storefront full ISR revalidation...`);
    }
    
    // Asynchronous non-blocking dispatch
    axios.get(revalidateUrl, { params, timeout: 5000 })
      .then(res => {
        if (res.status === 200) {
          console.log(`✅ Storefront ISR cache purged successfully for: ${slug ? '/shop/' + slug : '/shop'}`);
        } else {
          console.warn(`⚠️ Storefront ISR cache purge returned status ${res.status}:`, res.data);
        }
      })
      .catch(err => {
        console.error(`❌ Storefront ISR cache revalidation request failed:`, err.message || err);
      });

  } catch (err: any) {
    console.error(`❌ Failed in triggerRevalidation container execution:`, err.message || err);
  }
}
