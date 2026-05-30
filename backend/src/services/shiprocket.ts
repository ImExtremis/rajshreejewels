import axios from 'axios';
import { config } from '../config';
import prisma from './db';
import { notificationsService } from './notifications';

let shiprocketToken: string | null = null;
let tokenExpiry: number = 0;

async function getShiprocketToken(): Promise<string> {
  if (shiprocketToken && Date.now() < tokenExpiry) return shiprocketToken;

  const res = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', {
    email: config.SHIPROCKET_EMAIL || process.env.SHIPROCKET_EMAIL,
    password: config.SHIPROCKET_PASSWORD || process.env.SHIPROCKET_PASSWORD,
  });

  shiprocketToken = res.data.token;
  tokenExpiry = Date.now() + (9 * 60 * 60 * 1000); // Token valid ~10hrs — refresh at 9hrs
  return shiprocketToken!;
}

// All Shiprocket API calls use this
async function shiprocket(method: 'get' | 'post', path: string, data?: any) {
  const token = await getShiprocketToken();
  return axios({
    method,
    url: `https://apiv2.shiprocket.in/v1/external${path}`,
    data,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
}

export interface CourierOption {
  courier_company_id: number;
  courier_name: string;
  rate: number;
  estimated_delivery_days: number;
  cod_available: boolean;
  is_surface: boolean;
}

export async function getAvailableCouriers(
  pickupPincode: string,
  deliveryPincode: string,
  weightKg: number,
  codRequired: boolean
): Promise<CourierOption[]> {
  const res = await shiprocket('get',
    `/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=${weightKg}&cod=${codRequired ? 1 : 0}`
  );

  const available = res.data?.data?.available_courier_companies || [];

  // Filter: only couriers that can deliver to this pincode
  return available
    .filter((c: any) => c.serviceable === true)
    .map((c: any) => ({
      courier_company_id: c.courier_company_id,
      courier_name: c.courier_name,
      rate: Number(c.rate),
      estimated_delivery_days: Number(c.estimated_delivery_days),
      cod_available: c.cod_charges !== undefined || c.cod === 1,
      is_surface: c.is_surface,
    }));
}

export function selectBestCourier(couriers: CourierOption[], codRequired: boolean): CourierOption {
  let eligible = couriers;

  if (codRequired) {
    eligible = couriers.filter(c => c.cod_available);
    if (eligible.length === 0) throw new Error('NO_COD_COURIER_AVAILABLE');
  }

  if (eligible.length === 0) throw new Error('NO_COURIER_SERVICEABLE');

  // Prefer BlueDart
  const bluedart = eligible.find(c =>
    c.courier_name.toLowerCase().includes('bluedart') ||
    c.courier_name.toLowerCase().includes('blue dart')
  );
  if (bluedart) return bluedart;

  // Prefer Delhivery
  const delhivery = eligible.find(c =>
    c.courier_name.toLowerCase().includes('delhivery')
  );
  if (delhivery) return delhivery;

  // Sort by ETD asc, then rate asc
  return eligible.slice().sort((a, b) =>
    a.estimated_delivery_days - b.estimated_delivery_days ||
    a.rate - b.rate
  )[0];
}

export const shiprocketService = {
  getAvailableCouriers,
  selectBestCourier,
  bookShipment: async (orderId: string, courierOverride?: number): Promise<void> => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true, address: true, user: true }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== 'CONFIRMED') {
      throw new Error(`Order must be in CONFIRMED status to book courier (current: ${order.status})`);
    }

    // For weight: convert grams to kg, default to 100g if null, add 100g buffer
    const weightGrams = order.product.weightGrams ?? 100;
    const weightKg = (weightGrams / 1000) + 0.1;

    try {
      // 1. Create adhoc order in Shiprocket
      const orderPayload = {
        order_id: order.orderNumber,
        order_date: order.createdAt.toISOString(),
        pickup_location: config.SHIPROCKET_PICKUP_LOCATION || 'Primary',
        billing_customer_name: order.address.name,
        billing_address: order.address.line1,
        billing_address_2: order.address.line2 || '',
        billing_city: order.address.city,
        billing_pincode: order.address.pincode,
        billing_state: order.address.state,
        billing_country: 'India',
        billing_email: order.user.email,
        billing_phone: order.address.phone,
        shipping_is_billing: true,
        order_items: [{
          name: order.product.displayName,
          sku: order.product.id,
          units: 1,
          selling_price: order.priceINR,
          discount: 0,
          tax: 0,
          hsn: 7113, // HSN code for jewellery
        }],
        payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
        sub_total: order.priceINR,
        weight: weightKg,
      };

      const orderRes = await shiprocket('post', '/orders/create/adhoc', orderPayload);
      const shiprocketOrderId = orderRes.data.order_id?.toString();
      const shiprocketShipmentId = orderRes.data.shipment_id?.toString();

      if (!shiprocketShipmentId) {
        throw new Error(`Shiprocket order creation did not return a shipment_id. Response: ${JSON.stringify(orderRes.data)}`);
      }

      // 2. Get serviceability + select best courier or use override
      const codRequired = order.paymentMethod === 'COD';
      const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || (config as any).SHIPROCKET_PICKUP_PINCODE || '302001';
      const deliveryPincode = order.address.pincode;

      const availableCouriers = await getAvailableCouriers(
        pickupPincode,
        deliveryPincode,
        weightKg,
        codRequired
      );

      let selectedCourier: CourierOption;
      if (courierOverride) {
        const matched = availableCouriers.find(c => c.courier_company_id === courierOverride);
        if (!matched) {
          throw new Error(`OVERRIDE_COURIER_NOT_SERVICEABLE: Courier ID ${courierOverride} is not serviceable for this pincode.`);
        }
        selectedCourier = matched;
      } else {
        selectedCourier = selectBestCourier(availableCouriers, codRequired);
      }

      // 3. Assign specific courier (not auto-assign)
      const assignRes = await shiprocket('post', '/courier/assign/awb', {
        shipment_id: parseInt(shiprocketShipmentId),
        courier_id: selectedCourier.courier_company_id,
      });

      const courierData = assignRes.data.response?.data;
      const awbCode = courierData?.awb_code || assignRes.data.awb_code || orderRes.data.awb_code;

      if (!awbCode) {
        throw new Error(`Courier assignment did not return an AWB code. Response: ${JSON.stringify(assignRes.data)}`);
      }

      // 4. Generate label
      await shiprocket('post', '/courier/generate/label', {
        shipment_id: [parseInt(shiprocketShipmentId)]
      });

      const trackingUrl = `https://shiprocket.co/tracking/${awbCode}`;

      // 5. Update DB with courier info
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          shiprocketOrderId,
          shiprocketShipmentId,
          courierName: selectedCourier.courier_name,
          awbCode,
          trackingUrl,
          status: 'SHIPPED',
          shippedAt: new Date(),
        },
        include: { product: true, address: true, user: true }
      });

      // 6. Send shipping notification email and SMS
      await notificationsService.sendShippingNotificationEmail(updatedOrder, awbCode);

      if (order.user.phone) {
        const { sendShippedSMS } = require('./notifications');
        await sendShippedSMS(order.user.phone, order.user.name, order.orderNumber, selectedCourier.courier_name, trackingUrl).catch((err: any) => {
          console.error('❌ Failed to send Shipped SMS:', err);
        });
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'SHIPROCKET_BOOKING_FAILED';
      console.error(`❌ Shiprocket booking failed for order ${order.orderNumber}:`, errorMsg, err.response?.data);
      throw new Error(errorMsg);
    }
  },

  cancelShiprocketOrder: async (shiprocketOrderId: string): Promise<void> => {
    try {
      await shiprocket('post', '/orders/cancel', {
        ids: [parseInt(shiprocketOrderId)]
      });
    } catch (err: any) {
      console.error(`❌ Failed to cancel Shiprocket order ${shiprocketOrderId}:`, err.response?.data || err.message);
      throw err;
    }
  },

  getShiprocketTracking: async (awbCode: string): Promise<{ currentStatus: string; lastUpdate: string; trackingUrl: string }> => {
    try {
      const res = await shiprocket('get', `/courier/track/awb/${awbCode}`);
      const trackData = res.data.tracking_data?.shipment_track?.[0];
      return {
        currentStatus: trackData?.current_status || 'UNKNOWN',
        lastUpdate: trackData?.updated_at || new Date().toISOString(),
        trackingUrl: `https://shiprocket.co/tracking/${awbCode}`,
      };
    } catch (err: any) {
      console.error(`❌ Failed to fetch tracking for AWB ${awbCode}:`, err.response?.data || err.message);
      throw err;
    }
  }
};
