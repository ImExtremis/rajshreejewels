'use client';

import React, { useState } from 'react';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Validation state
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (val && !val.includes('@')) {
      setEmailError('Please enter a valid email address.');
    } else {
      setEmailError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim() || emailError) {
      setErrorMsg('Please ensure all fields are filled out correctly.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit contact inquiry');
      }

      setSuccessMsg('✨ Thank you! Your inquiry has been received. Our luxury curators will reach out to you shortly.');
      setName('');
      setEmail('');
      setMessage('');
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 space-y-12 pb-24">
      {/* Header */}
      <div className="text-center space-y-3">
        <span className="text-accent uppercase tracking-widest text-xs font-semibold font-body">
          GET IN TOUCH
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wide text-primary">
          Contact Our Vault
        </h1>
        <p className="font-body text-xs sm:text-sm text-text-muted max-w-xl mx-auto leading-relaxed">
          Have an inquiry regarding a specific unique creation, custom dimensions, or order shipment? Let our curators assist you.
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Contact Info (4 cols) */}
        <div className="md:col-span-5 bg-surface-2 border border-border-custom p-8 rounded-card shadow-card space-y-8 font-body">
          <div className="space-y-2">
            <h3 className="font-display text-lg font-bold text-accent tracking-wide uppercase">
              Corporate Office
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              Rajshree Jewels Vault<br />
              Johri Bazar, Old City,<br />
              Jaipur, Rajasthan - 302001
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display text-lg font-bold text-accent tracking-wide uppercase">
              Bespoke Assistance
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              <strong>Email:</strong> <a href="mailto:support@rajshreejewels.com" className="hover:text-accent transition-colors">support@rajshreejewels.com</a><br />
              <strong>Helpline:</strong> +91 141 2345678
            </p>
          </div>

          <div className="space-y-2 border-t border-border-custom/50 pt-6">
            <h3 className="font-display text-sm font-bold text-primary tracking-wide uppercase">
              Hours of Curation
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Monday – Saturday: 10:00 AM – 7:00 PM IST<br />
              Sunday: Vault Closed (Online bookings active)
            </p>
          </div>
        </div>

        {/* Form (7 cols) */}
        <div className="md:col-span-7 bg-surface-2 border border-border-custom p-8 rounded-card shadow-card">
          <form onSubmit={handleSubmit} className="space-y-6 font-body">
            
            {/* Success and Error messages */}
            {errorMsg && (
              <div className="p-4 bg-red-950/30 border border-red-900/50 text-red-400 rounded-card text-xs">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-4 bg-green-950/30 border border-green-900/50 text-green-400 rounded-card text-xs">
                {successMsg}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs uppercase tracking-wider font-bold text-primary">
                Your Full Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Maharani Gayatri Devi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface border border-border-custom rounded-card px-4 py-3 text-sm text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs uppercase tracking-wider font-bold text-primary">
                Your Email Address
              </label>
              <input
                type="email"
                required
                placeholder="e.g. gayatri.devi@palace.in"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className={`w-full bg-surface border rounded-card px-4 py-3 text-sm text-primary placeholder-text-muted focus:outline-none transition-colors ${
                  emailError ? 'border-red-500 focus:border-red-500' : 'border-border-custom focus:border-accent'
                }`}
              />
              {emailError && (
                <span className="text-3xs text-red-500 block">{emailError}</span>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs uppercase tracking-wider font-bold text-primary">
                Your Message / Inquiry
              </label>
              <textarea
                required
                rows={5}
                placeholder="Describe the jewellery design or inquiry details..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-surface border border-border-custom rounded-card px-4 py-3 text-sm text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || emailError !== null}
              className="w-full bg-accent hover:bg-accent-light text-primary font-bold uppercase tracking-widest text-xs py-4 rounded-card shadow-lg transition-all transform active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Transmitting inquiry...' : 'Send Message'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
