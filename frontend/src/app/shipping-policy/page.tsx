import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shipping Policy',
  description: 'Learn about our premium insured delivery services, dispatch timelines, and shipping partners.',
};

export default function ShippingPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-8 pb-24">
      <div className="text-center space-y-2">
        <span className="text-accent uppercase tracking-widest text-xs font-semibold font-body">
          DELIVERY & LOGISTICS
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-wide text-primary">
          Shipping Policy
        </h1>
        <p className="font-body text-xs text-text-muted">
          Last updated: May 2026
        </p>
      </div>

      <div className="bg-surface-2 border border-border-custom p-8 rounded-card shadow-card space-y-6 font-body text-sm text-text-muted leading-relaxed">
        <p>
          At <strong>Rajshree Jewels</strong>, we treat every unique handcrafted piece of jewellery as a precious heirloom. We have established secure agreements with India's leading courier services to ensure your purchases are delivered safely, fully insured, and completely intact.
        </p>

        <hr className="border-border-custom" />

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          1. Shipping Coverage & Destination Nodes
        </h2>
        <p>
          We offer secure shipping to over 26,000+ pincodes across India, extending from major metropolitan hubs to deep regional towns. We partner with:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>BlueDart:</strong> For express premium air shipping (our primary option).</li>
          <li><strong>Delhivery & Xpressbees:</strong> For extensive regional ground connections.</li>
        </ul>
        <p>
          Please note that we do not ship to P.O. Box addresses or secure defense sector nodes. A physical residential or commercial address is required for dispatch.
        </p>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          2. Shipping Charges
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Free Shipping:</strong> Standard on all orders of ₹999 or above.</li>
          <li><strong>Flat Rate:</strong> A shipping fee of ₹99 is applied to orders below ₹999.</li>
          <li><strong>Cash on Delivery (COD):</strong> Where available, COD transactions carry a standard handling charge of ₹50 to cover security and verification overheads.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          3. Dispatch & Delivery Timelines
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Preparation Phase:</strong> Because our inventory is physically unique, each item undergoes rigorous quality audits and is packed in premium, tamper-evident boxes. Dispatch occurs within <strong>1 to 2 business days</strong> of payment confirmation.</li>
          <li><strong>In Transit:</strong> Metros and Tier-1 cities can expect delivery within <strong>2 to 4 business days</strong> post-dispatch. Regional towns and Tier-2 locations generally require <strong>4 to 7 business days</strong>.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          4. Real-time Tracking and Notifications
        </h2>
        <p>
          Once your package is booked and handed over to our shipping carriers:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>A tracking code (AWB number) and link will be generated automatically.</li>
          <li>We will dispatch these tracking details to your registered email and phone number (via MSG91 SMS).</li>
          <li>You can monitor the live delivery status directly from your Rajshree Jewels account under Order History.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          5. Tamper-evident Packaging & Transit Safety
        </h2>
        <p>
          Your package is insured from our vault to your door. If you observe that the secure outer tape is cut, ripped, or tampered with at the time of delivery, <strong>please refuse to accept the shipment</strong> and notify our team immediately. We will initiate investigations and assist you.
        </p>
      </div>
    </div>
  );
}
