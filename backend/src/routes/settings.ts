import { Router, Request, Response } from 'express';
import prisma from '../services/db';
import { catchAsync } from '../utils/errors';
import { config } from '../config';

const router = Router();

router.get(
  '/public',
  catchAsync(async (req: Request, res: Response) => {
    const settingsList = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: [
            'store_name',
            'store_tagline',
            'store_phone',
            'store_email',
            'store_whatsapp',
            'store_address',
            'shipping_free_above_inr',
            'shipping_flat_rate_inr',
            'cod_enabled',
            'announcement_banner',
            'instagram_url',
            'facebook_url',
            'whatsapp_number'
          ]
        }
      }
    });

    const settingsMap = new Map(settingsList.map((s) => [s.key, s.value]));

    res.json({
      storeName: settingsMap.get('store_name') || config.STORE_NAME || 'Rajshree Jewels',
      storeTagline: settingsMap.get('store_tagline') || config.STORE_TAGLINE || '1-Gram Gold, Imitation & Fashion Jewellery',
      storePhone: settingsMap.get('store_phone') || process.env.STORE_PHONE || '',
      storeEmail: settingsMap.get('store_email') || '',
      storeAddress: settingsMap.get('store_address') || process.env.STORE_ADDRESS || '',
      shippingFreeAboveINR: parseInt(settingsMap.get('shipping_free_above_inr') || '999', 10),
      shippingFlatRateINR: parseInt(settingsMap.get('shipping_flat_rate_inr') || '99', 10),
      codEnabled: (settingsMap.get('cod_enabled') || 'false') === 'true',
      announcementBanner: settingsMap.get('announcement_banner') || null,
      instagramUrl: settingsMap.get('instagram_url') || process.env.STORE_INSTAGRAM || '',
      facebookUrl: settingsMap.get('facebook_url') || process.env.STORE_FACEBOOK || '',
      whatsappNumber: settingsMap.get('store_whatsapp') || settingsMap.get('whatsapp_number') || process.env.STORE_WHATSAPP || null,
    });
  })
);

router.get(
  '/sale',
  catchAsync(async (req: Request, res: Response) => {
    const sale = await prisma.siteSale.findUnique({
      where: { id: '1' }
    });
    if (!sale) {
      return res.json({ isActive: false, label: 'Sale', discountPct: 0 });
    }
    res.json(sale);
  })
);

export default router;
