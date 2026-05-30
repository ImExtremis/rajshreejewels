import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'Understand the legal conditions, ordering rules, and payment terms of Rajshree Jewels.',
};

export default function TermsAndConditionsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-8 pb-24">
      <div className="text-center space-y-2">
        <span className="text-accent uppercase tracking-widest text-xs font-semibold font-body">
          LEGAL & COMPLIANCE
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-wide text-primary">
          Terms & Conditions
        </h1>
        <p className="font-body text-xs text-text-muted">
          Last updated: May 2026
        </p>
      </div>

      <div className="bg-surface-2 border border-border-custom p-8 rounded-card shadow-card space-y-6 font-body text-sm text-text-muted leading-relaxed">
        <p>
          Welcome to the <strong>Rajshree Jewels</strong> digital marketplace (referred to as the "Service"). By creating an account, browsing our premium designs, or making purchases, you agree to comply with and be bound by the following Terms and Conditions. Please review them carefully.
        </p>

        <hr className="border-border-custom" />

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          1. Store Philosophy & One-of-a-Kind Inventory
        </h2>
        <p>
          Our boutique operates on a strict single-item inventory rule:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Every listing represented on our storefront corresponds to a completely unique, physically handcrafted piece of jewellery.</li>
          <li>Once a transaction is finalized and payment is confirmed, that specific item is sold and can never be bought again.</li>
          <li>Adding a creation to your digital cart reserves the item temporarily (for up to 10 minutes) during checkout. If the transaction is not completed within this timeline, the item is released back to our public listing.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          2. Intellectual Property Rights
        </h2>
        <p>
          All digital assets, product photographs, luxury copy, AI-enhanced mockups, font structures, vector logos, and design patterns represented on this storefront are the exclusive property of Rajshree Jewels. Unauthorized duplication, modification, redistribution, or extraction is strictly prohibited and subject to legal action.
        </p>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          3. Price Estimates & Transacting
        </h2>
        <p>
          Prices are declared in Indian Rupees (INR) and include all relevant service taxes. We make every effort to display accurate details. In the highly unlikely event that a technical pricing error occurs on our listings:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>We reserve the right to cancel any orders placed under the erroneous price.</li>
          <li>Patrons will be notified immediately and provided a full refund back to their original payment mode.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          4. Payments and Webhook Processing
        </h2>
        <p>
          Payments are secured via Razorpay. Transactions are finalized once we receive automated webhook notifications from the gate. If a transaction fails or times out, the corresponding order is cancelled, and any temporarily held inventory is immediately unreserved.
        </p>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          5. Cash on Delivery (COD) Rules
        </h2>
        <p>
          To maintain catalog integrity and prevent fraudulent bookings of our one-of-a-kind inventory, patrons choosing Cash on Delivery (COD) must answer verification calls or SMS prompts sent by our logistics managers. Rajshree Jewels reserves the right to cancel unverified COD bookings to release items back to active shoppers.
        </p>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          6. Limitation of Liability
        </h2>
        <p>
          Rajshree Jewels provides this storefront on an "as is" and "as available" basis without express or implied warranties. In no event shall Rajshree Jewels be held liable for indirect, incidental, or consequential damages arising out of your use of or inability to access the platform.
        </p>
      </div>
    </div>
  );
}
