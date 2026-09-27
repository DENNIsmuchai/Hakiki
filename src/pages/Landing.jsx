import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";

function ImageWithFallback({ src, alt, className = "", fallbackClassName = "" }) {
  const [errored, setErrored] = useState(false);

  const handleError = useCallback(() => setErrored(true), []);

  if (errored || !src) {
    return (
      <div
        className={`bg-navy flex items-center justify-center ${fallbackClassName || className}`}
      >
        <span className="font-mono text-navy-400 text-xs uppercase tracking-widest">
          {alt || "Image"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      loading="lazy"
    />
  );
}

function DuotoneImage({ src, alt, className = "", fallbackText }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <ImageWithFallback
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
        fallbackClassName="absolute inset-0 w-full h-full bg-navy"
        fallbackText={fallbackText}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-navy/40 via-navy/20 to-brand-yellow/10 mix-blend-multiply" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy/30 to-transparent" />
    </div>
  );
}

function Stamp({ className = "" }) {
  return (
    <div
      className={`
        relative inline-flex items-center justify-center
        font-display text-brand-yellow tracking-widest
        border-4 border-brand-yellow rounded-full
        rotate-[-8deg] select-none
        shadow-[0_0_0_4px_rgba(255,194,41,0.15),0_0_0_8px_rgba(255,194,41,0.05)]
        ${className}
      `}
      style={{
        textShadow: "0 2px 8px rgba(0,0,0,0.4)",
        padding: "0.5rem 1.5rem",
        lineHeight: 1,
      }}
    >
      VERIFIED
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper text-navy">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-paper/80 backdrop-blur-md border-b-2 border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 no-underline">
              <span className="font-display text-2xl text-navy tracking-wide">
                Hakiki<span className="text-brand-yellow-deep">.</span>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a href="#how" className="font-body text-sm text-navy-600 hover:text-navy transition-colors">How it works</a>
              <a href="#context" className="font-body text-sm text-navy-600 hover:text-navy transition-colors">Built for Kenya</a>
              <Link to="/seller">
                <Button variant="primary" size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Photo panel with stamp */}
            <div className="relative order-2 lg:order-1">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-hard-lg border-2 border-navy/10">
                <DuotoneImage
                  src="/src/assets/images/hero.jpg"
                  alt="Market scene"
                  className="w-full h-full"
                  fallbackText="HERO"
                />
                {/* Stamp pressed onto the photo */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Stamp className="text-5xl md:text-7xl px-8 py-4 border-8" />
                </div>
              </div>
            </div>

            {/* Right: Hero text */}
            <div className="order-1 lg:order-2 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-yellow/10 border border-brand-yellow/20">
                <span className="w-2 h-2 rounded-full bg-brand-yellow animate-pulse" />
                <span className="font-mono text-xs font-semibold text-navy uppercase tracking-wider">
                  Payment Links for Kenya
                </span>
              </div>
              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl tracking-wide text-navy leading-[0.9]">
                VERIFIED<br />
                <span className="text-brand-yellow-deep">PAYMENTS</span><br />
                FOR EVERY<br />
                CHAT
              </h1>
              <p className="font-body text-lg md:text-xl text-navy-600 max-w-lg leading-relaxed">
                Turn any conversation into a secure payment link. Buyer verified, item locked, receipt confirmed.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link to="/seller">
                  <Button variant="primary" size="xl" className="shadow-glow">
                    Start Selling
                  </Button>
                </Link>
                <Button variant="outline" size="xl">
                  See How It Works
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="border-y-2 border-navy/10 bg-navy-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: "🔒", title: "Buyer Verified", desc: "Phone number confirmed before payment" },
              { icon: "📸", title: "Item Locked", desc: "Photos and description saved on-chain" },
              { icon: "🧾", title: "Receipt Confirmed", desc: "Both parties get proof of transaction" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-savanna-light flex items-center justify-center shrink-0">
                  <span className="text-savanna text-lg">{item.icon}</span>
                </div>
                <div>
                  <h3 className="font-display text-xl tracking-wide text-navy">{item.title}</h3>
                  <p className="font-body text-sm text-navy-500 mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for how Kenya actually sells */}
      <section id="context" className="py-16 md:py-24 bg-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl md:text-6xl tracking-wide text-navy">
              BUILT FOR HOW<br />KENYA <span className="text-brand-yellow-deep">ACTUALLY</span> SELLS
            </h2>
            <p className="font-body text-navy-500 mt-4 text-lg max-w-2xl mx-auto">
              From market stalls to matatu seats, we designed Hakiki for the way business really happens.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                src: "/src/assets/images/context-1.jpg",
                caption: "Marketplace deals, verified instantly",
                alt: "Market scene",
              },
              {
                src: "/src/assets/images/context-2.jpg",
                caption: "Matatu payments, secured at the tap",
                alt: "Matatu payment",
              },
              {
                src: "/src/assets/images/context-3.jpg",
                caption: "Phone-to-phone trust, no middleman needed",
                alt: "Phone payment",
              },
            ].map((item, idx) => (
              <div key={idx} className="group">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-soft border-2 border-navy/5 mb-4">
                  <DuotoneImage
                    src={item.src}
                    alt={item.alt}
                    className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                    fallbackText={item.alt}
                  />
                </div>
                <p className="font-body text-navy-600 text-center font-medium">
                  {item.caption}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-yellow rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-savanna rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="font-display text-4xl md:text-6xl tracking-wide text-paper mb-6">
            READY TO GET <span className="text-brand-yellow">VERIFIED</span>?
          </h2>
          <p className="font-body text-navy-300 text-lg mb-8 max-w-xl mx-auto">
            Join thousands of Kenyan sellers already using Hakiki to close deals with confidence.
          </p>
          <Link to="/seller">
            <Button variant="primary" size="xl" className="shadow-glow text-lg">
              Create Your First Link
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-900 text-navy-300 py-12 border-t-2 border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl text-paper tracking-wide">
                Hakiki<span className="text-brand-yellow">.</span>
              </span>
              <span className="font-mono text-xs text-navy-500 ml-2">© 2025</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="font-body text-sm text-navy-400 hover:text-brand-yellow transition-colors">Privacy</a>
              <a href="#" className="font-body text-sm text-navy-400 hover:text-brand-yellow transition-colors">Terms</a>
              <a href="#" className="font-body text-sm text-navy-400 hover:text-brand-yellow transition-colors">Contact</a>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-savanna" />
              <span className="font-mono text-xs text-navy-400">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
