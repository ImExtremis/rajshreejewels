import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/checkout', '/api'],
    },
    sitemap: 'https://rajshreejewels.com/sitemap.xml',
  };
}
