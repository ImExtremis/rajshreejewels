import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Return & Refund Policy',
  description: 'Understand the returns, replacements, and refunds process at Rajshree Jewels.',
};

export default function ReturnPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-8 pb-24">
      <div className="text-center space-y-2">
        <span className="text-accent uppercase tracking-widest text-xs font-semibold font-body">
          RETURNS & REFUNDS
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-wide text-primary">
          Return & Refund Policy
        </h1>
        <p className="font-body text-xs text-text-muted">
          Last updated: May 2026
        </p>
      </div>

      <div className="bg-surface-2 border border-border-custom p-8 rounded-card shadow-card space-y-6 font-body text-sm text-text-muted leading-relaxed">
        <p>
          At <strong>Rajshree Jewels</strong>, we are committed to client satisfaction. Because each of our physical creations is unique, handcrafted, and one-of-a-kind, we have established clear guidelines regarding returns and refunds to protect our inventory and ensure fairness.
        </p>

        <hr className="border-border-custom" />

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          1. Return Eligibility Window
        </h2>
        <p>
          We offer a **48-hour return window** from the exact timestamp of delivery registered by our shipping aggregators:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Return requests must be initiated by contacting our customer desk within this 48-hour period.</li>
          <li>Due to the irreplaceable nature of our inventory, requests made after this window are not eligible for refunds or exchanges.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          2. Conditions for Return Approval
        </h2>
        <p>
          To maintain high safety and hygiene standards, items must meet the following criteria:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>The jewellery piece must be completely unworn, clean, and in pristine condition.</li>
          <li>It must be returned in its original product box, complete with velvet linings, authentication tags, and protective padding.</li>
          <li>All accompanying documentation (invoices, certificates, care guides) must be returned.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          3. Process to Request Return
        </h2>
        <ul className="list-decimal pl-6 space-y-2">
          <li><strong>Step 1:</strong> Email our support desk at <code>support@rajshreejewels.com</code> or reach out on our direct WhatsApp line. Please provide your order number and clear photos of the item.</li>
          <li><strong>Step 2:</strong> Our curators will review the photos and confirm your request.</li>
          <li><strong>Step 3:</strong> Once confirmed, we will arrange a secure reverse pickup from your address via our logistics partner (BlueDart/Delhivery) at no cost to you.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          4. Refund Processing and Razorpay Webhooks
        </h2>
        <p>
          Upon receiving the returned parcel at our central inspection vault:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Our quality managers will audit the returned piece to verify its condition.</li>
          <li>Once approved, a full refund will be initiated back to your original payment mode via Razorpay.</li>
          <li>Razorpay refunds typically reflect in your account within <strong>5 to 7 business days</strong>.</li>
          <li>For verified Cash on Delivery (COD) orders, refunds will be processed via direct Bank Transfer or UPI once bank details are verified.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          5. Damages & Defective Items
        </h2>
        <p>
          If your unique creation arrives damaged during transit:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Please record an **unboxing video** when opening the parcel. This helps us file claims with our shipping partners.</li>
          <li>Contact us immediately (within 24 hours of delivery). We will arrange an immediate reverse pickup and process a priority refund.</li>
        </ul>
      </div>
    </div>
  );
}
