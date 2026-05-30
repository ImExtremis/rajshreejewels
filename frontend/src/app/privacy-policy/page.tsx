import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Understand how Rajshree Jewels handles, stores, and protects your personal and transactional information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-8 pb-24">
      <div className="text-center space-y-2">
        <span className="text-accent uppercase tracking-widest text-xs font-semibold font-body">
          TRUST & SECURITY
        </span>
        <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-wide text-primary">
          Privacy Policy
        </h1>
        <p className="font-body text-xs text-text-muted">
          Last updated: May 2026
        </p>
      </div>

      <div className="bg-surface-2 border border-border-custom p-8 rounded-card shadow-card space-y-6 font-body text-sm text-text-muted leading-relaxed">
        <p>
          At <strong>Rajshree Jewels</strong>, we are committed to safeguarding the privacy and digital trust of our distinguished patrons. This policy details how we handle, store, and secure the personal information collected when you browse our storefront, engage in bespoke inquiries, or acquire our unique handcrafted jewellery.
        </p>

        <hr className="border-border-custom" />

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          1. Information We Collect
        </h2>
        <p>
          To complete your transactions and provide an unmatched, personalized shopping experience, we may collect the following details:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Identity Data:</strong> Full name and account profile details when you register with us.</li>
          <li><strong>Contact Information:</strong> Shipping address, billing address, phone number, and email address.</li>
          <li><strong>Financial Transaction Data:</strong> Safe tokens generated via our integration partner Razorpay. <em>(Please note: Rajshree Jewels never stores raw credit/debit card details or payment credentials on our servers.)</em></li>
          <li><strong>Digital Preferences:</strong> Wishlist configurations, order logs, and correspondence exchanged via our live chat client.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          2. How We Utilize Your Information
        </h2>
        <p>
          The gathered metrics are exclusively used to fulfill our commitments, specifically:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Processing, packing, and dispatching your unique order via integrated logistics carriers (Shiprocket, BlueDart, Delhivery).</li>
          <li>Generating tax invoices and sending transaction notifications (SMS/Email confirmations).</li>
          <li>Enabling real-time communication between you and our curators regarding orders or custom pieces.</li>
          <li>Informing you immediately when a previously wishlisted one-of-a-kind design is relisted or available.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          3. Information Sharing & Third-Party Disclosure
        </h2>
        <p>
          We respect your privacy. Rajshree Jewels does not sell, rent, or lease your personal profiles to any third-party marketers. Information is strictly shared with authorized service nodes to complete operations:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Razorpay:</strong> To process secure payment transactions.</li>
          <li><strong>Shiprocket & Couriers:</strong> To deliver physical inventory to your doorstep.</li>
          <li><strong>MSG91 & SMTP Relays:</strong> To dispatch transactional updates.</li>
        </ul>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          4. Security of Your Data
        </h2>
        <p>
          We employ state-of-the-art administrative, technical, and physical security measures, including SSL encryption for all data in transit and robust firewall partitions. Your data is housed securely in managed databases, protected by multi-factor protocols to prevent unauthorized leakage or access.
        </p>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          5. Patrons' Rights
        </h2>
        <p>
          You hold the absolute right to view, correct, update, or request the deletion of your personal records at any time. Simply navigate to your Account dashboard or reach out to our support channel for assistance.
        </p>

        <h2 className="font-display text-xl font-bold text-accent tracking-wide mt-6">
          6. Updates to This Policy
        </h2>
        <p>
          We may refine this Privacy Policy periodically to align with evolving web standards or regulatory updates. Patron notifications will be updated clearly on this page.
        </p>
      </div>
    </div>
  );
}
