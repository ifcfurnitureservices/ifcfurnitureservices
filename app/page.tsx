'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import {
  User,
  ShieldCheck,
  LayoutDashboard,
  Clock,
  ArrowRight,
  Building2,
  Mail,
  MapPin,
  CheckCircle2,
  MessageSquare,
  Send,
  Menu,
  X,
  Star,
  Loader2,
  Layers,
  Sparkles,
  Camera
} from 'lucide-react';

// ── Import Auth Modals ──
import ClientAuthModal from '@/app/components/clientauth';
import UnifiedAuthModal from '@/app/components/UnifiedAuthModal';

interface Testimonial {
  name: string;
  rating: number;
  text: string;
}

export default function HomePortal() {
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Auth Modal State ──
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  // ── Inquiry Form State ──
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    serviceType: 'Furniture Installation',
    message: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Testimonial State ──
  const [testimonials, setTestimonials] = useState<Testimonial[]>([
    { name: 'Arjun Mehta', rating: 5, text: 'The Furniture Installation team was exceptionally professional. They assembled our entire modular office workspace layout flawlessly within hours.' },
    { name: 'Priya Swamy', rating: 5, text: 'Requested an emergency Furniture Repair setup for a broken wardrobe hinge. Fast turnaround time and neat execution.' },
    { name: 'Karan Malhotra', rating: 4, text: 'Smooth Furniture Dismantling execution during our residential relocation. Highly disciplined staff and clean workspace maintenance.' }
  ]);
  const [testimonialForm, setTestimonialForm] = useState({ name: '', rating: 0, text: '' });
  const [hoveredStar, setHoveredStar] = useState(0);
  const [testimonialSubmitting, setTestimonialSubmitting] = useState(false);
  const [testimonialSubmitted, setTestimonialSubmitted] = useState(false);
  const [testimonialError, setTestimonialError] = useState('');

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    const { error } = await supabase.from('inquiry_submissions').insert({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      service_type: formData.serviceType,
      message: formData.message,
    });

    setFormSubmitting(false);

    if (error) {
      setFormError('Something went wrong. Please try again.');
      console.error('Inquiry insert error:', error.message);
      return;
    }

    setFormSubmitted(true);
    setTimeout(() => {
      setFormSubmitted(false);
      setFormData({ name: '', email: '', phone: '', serviceType: 'Furniture Installation', message: '' });
    }, 4000);
  };

  const handleTestimonialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testimonialForm.rating === 0) return;
    setTestimonialError('');
    setTestimonialSubmitting(true);

    const { error } = await supabase.from('testimonials').insert({
      name: testimonialForm.name,
      rating: testimonialForm.rating,
      review_text: testimonialForm.text,
      approved: false,
    });

    setTestimonialSubmitting(false);

    if (error) {
      setTestimonialError('Something went wrong. Please try again.');
      console.error('Testimonial insert error:', error.message);
      return;
    }

    setTestimonials(prev => [...prev, { ...testimonialForm }]);
    setTestimonialSubmitted(true);
    setTimeout(() => {
      setTestimonialSubmitted(false);
      setTestimonialForm({ name: '', rating: 0, text: '' });
      setHoveredStar(0);
    }, 3000);
  };

  const serviceOptions = [
    'Furniture Installation',
    'Furniture Repair',
    'Furniture Dismantling',
    'Modular Furniture Installation',
    'Custom Modular Kitchen Solutions',
    'Packers & Movers Operations',
    'Corporate B2B Services Execution',
  ];

  const recentActivities = [
    { id: 1, text: 'Bangalore Head Office processed 14 new B2B project requests.', time: '12 mins ago' },
    { id: 2, text: 'Modular Kitchen verification checklist updated for certified teams.', time: '2 hours ago' },
    { id: 3, text: 'Relocation & Logistics router synced with field mobile apps.', time: '5 hours ago' },
  ];

  const showcaseImages = [
    {
      title: 'Modular Kitchen Engineering',
      desc: 'Precision fit-outs & hardware alignment.',
      url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=600&auto=format&fit=crop'
    },
    {
      title: 'Corporate Office Layouts',
      desc: 'Ergonomic workstations & multi-unit desks.',
      url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600&auto=format&fit=crop'
    },
    {
      title: 'Premium Living Environments',
      desc: 'Custom sofa setups and custom cabinetry panels.',
      url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=600&auto=format&fit=crop'
    },
    {
      title: 'Smart Wardrobe Architectural Systems',
      desc: 'Sliding frameworks, structural tracks, and deep storage builds.',
      url: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?q=80&w=600&auto=format&fit=crop'
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-gray-800 scroll-smooth selection:bg-[#8ED26B]/30">

      {/* ── Auth Modals ── */}
      <ClientAuthModal isOpen={clientModalOpen} onClose={() => setClientModalOpen(false)} />
      <UnifiedAuthModal isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} />

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative bg-white p-1.5 rounded-2xl border border-gray-100/70 max-w-[180px] sm:max-w-[240px] transition-all duration-300 group-hover:shadow-md group-hover:border-gray-200">
              <Image
                src="/logo.jpeg"
                alt="InstaFitCore One Stop Solutions"
                width={220}
                height={65}
                className="w-auto h-12 sm:h-14 object-contain block"
                priority
              />
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 font-semibold text-sm text-gray-500">
            <Link href="/" className="hover:text-[#5aaa3a] transition-colors" style={{ color: '#5aaa3a' }}>Home</Link>
            <a href="#about-us" className="hover:text-gray-900 transition-colors">Who We Are</a>
            <a href="#gallery" className="hover:text-gray-900 transition-colors">Showcase</a>
            <a href="#testimonials" className="hover:text-gray-900 transition-colors">Reviews</a>
            <a href="#inquiry" className="hover:text-gray-900 transition-colors">Inquiry Form</a>
          </nav>

          <div className="hidden md:flex items-center gap-3.5">
            <button
              onClick={() => setClientModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-gray-50 border border-gray-200/60 hover:bg-gray-100 text-gray-700 hover:shadow-sm"
            >
              <User size={16} style={{ color: '#5aaa3a' }} />
              Client Login
            </button>
            <button
              onClick={() => setAdminModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 shadow-sm shadow-[#8ED26B]/20 hover:shadow-md"
              style={{ backgroundColor: '#8ED26B' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#72bf4e')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}
            >
              <ShieldCheck size={16} />
              Admin Login
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl text-gray-500 bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-gray-100 bg-white/95 backdrop-blur-lg px-6 pt-2 pb-6 space-y-4 shadow-inner">
            <nav className="flex flex-col gap-3.5 font-semibold text-gray-600">
              <Link href="/" onClick={() => setMobileMenuOpen(false)} style={{ color: '#5aaa3a' }}>Home</Link>
              <a href="#about-us" onClick={() => setMobileMenuOpen(false)}>Who We Are</a>
              <a href="#gallery" onClick={() => setMobileMenuOpen(false)}>Showcase</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)}>Core Value</a>
              <a href="#testimonials" onClick={() => setMobileMenuOpen(false)}>Reviews</a>
              <a href="#inquiry" onClick={() => setMobileMenuOpen(false)}>Inquiry Form</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>
            </nav>
            <hr className="border-gray-100" />
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => { setMobileMenuOpen(false); setClientModalOpen(true); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 border border-gray-200/50"
                >
                  <User size={16} style={{ color: '#5aaa3a' }} />
                  Client Login
                </button>
              </div>
              <button
                onClick={() => { setMobileMenuOpen(false); setAdminModalOpen(true); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: '#8ED26B' }}
              >
                <ShieldCheck size={16} />
                Admin Login
              </button>
            </div>
          </div>
        )}
      </header>

      {/* MAIN */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">

        {/* HERO */}
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white p-8 md:p-16 shadow-xl border border-slate-800">
          <div className="absolute right-0 bottom-0 -mt-24 -mr-24 w-[28rem] h-[28rem] rounded-full opacity-20 blur-[100px] pointer-events-none" style={{ backgroundColor: '#8ED26B' }} />
          <div className="absolute left-1/3 top-0 w-72 h-72 rounded-full opacity-10 blur-[80px] pointer-events-none" style={{ backgroundColor: '#5aaa3a' }} />
          <div className="relative z-10 max-w-3xl space-y-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full text-white bg-white/10 border border-white/10 backdrop-blur-md">
              <Sparkles size={12} className="text-[#8ED26B]" /> One Stop Enterprise Solutions
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight leading-[1.15]">
              Integrated Operations &amp; <br />
              <span className="bg-gradient-to-r from-[#8ED26B] to-emerald-400 bg-clip-text text-transparent">Furniture Lifecycle</span> Management
            </h2>
            <p className="text-sm md:text-lg text-slate-300 font-medium leading-relaxed max-w-2xl">
              Welcome to the administrative pipeline control system of InstaFitCore Solutions. Streamline verification tracks for last-mile delivery deployments, certified field technical personnel, and end-to-end furniture ecosystems.
            </p>
            <div className="pt-4 flex flex-wrap gap-4">
              <a href="#quick-nav" className="group flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold bg-white text-slate-900 shadow-lg hover:bg-gray-50 transition-all duration-200 hover:scale-[1.02]">
                Access Control Nodes <ArrowRight size={16} className="text-[#5aaa3a] group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>
        </section>

        {/* NAVIGATION PIPELINE + RECENT ACTIVITY */}
        <div id="quick-nav" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <LayoutDashboard size={16} style={{ color: '#5aaa3a' }} /> Core Portal Access Nodes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Card → opens AdminAuthModal */}
              <button
                onClick={() => setAdminModalOpen(true)}
                className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-300 flex gap-4 items-start text-left"
              >
                <div className="p-3.5 rounded-xl transition-all duration-300 group-hover:scale-105 shrink-0 shadow-sm" style={{ color: '#5aaa3a', backgroundColor: '#edfae3' }}>
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 group-hover:text-green-700 transition-colors">Admin Login</h4>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">Access centralized dashboard controls, configure dispatch teams, and coordinate corporate operations pipelines.</p>
                </div>
              </button>
              {/* Card → opens ClientAuthModal */}
              <button
                onClick={() => setClientModalOpen(true)}
                className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-300 flex gap-4 items-start text-left"
              >
                <div className="p-3.5 rounded-xl transition-all duration-300 group-hover:scale-105 shrink-0 shadow-sm" style={{ color: '#5aaa3a', backgroundColor: '#edfae3' }}>
                  <User size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 group-hover:text-green-700 transition-colors">Client Login</h4>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">Monitor real-time implementation workflows, review completion sign-offs, and track logistical fulfillment nodes.</p>
                </div>
              </button>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border-b border-gray-50 pb-3">
                <Clock size={16} style={{ color: '#5aaa3a' }} /> System Logs Stream
              </h3>
              <div className="space-y-4 mt-3">
                {recentActivities.map((act) => (
                  <div key={act.id} className="flex gap-3 text-xs leading-relaxed">
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0 bg-gradient-to-r from-[#8ED26B] to-emerald-500 shadow-sm" />
                    <div className="flex-1">
                      <p className="text-gray-700 font-semibold">{act.text}</p>
                      <span className="text-gray-400 block mt-0.5 font-medium">{act.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ABOUT US */}
        <section id="about-us" className="bg-white rounded-[2rem] p-8 lg:p-12 border border-gray-100 shadow-sm space-y-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#edfae3]/40 rounded-bl-[100px] pointer-events-none" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1 space-y-3">
              <div className="inline-flex p-3 rounded-xl shadow-sm" style={{ backgroundColor: '#edfae3', color: '#5aaa3a' }}>
                <Building2 size={24} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight">Who We Are</h3>
              <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md inline-block">Corporate Profile</p>
            </div>
            <div className="lg:col-span-2">
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                At InstaFitCore Solutions Pvt. Ltd., we deliver end-to-end furniture and home service solutions for residential and commercial spaces. From last-mile delivery to professional installation and completion, our certified professionals ensure every project is executed with precision, safety, and accountability. We specialize in customized modular furniture, modular kitchen solutions, packers &amp; movers, and B2B services operations, all powered by a technology-driven platform. Our commitment is to provide consistent quality, timely execution, and a seamless customer experience across every engagement.
              </p>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 p-6 rounded-2xl bg-gradient-to-b from-gray-50/70 to-gray-50/20 border border-gray-100">
              <h4 className="text-base font-bold flex items-center gap-2" style={{ color: '#5aaa3a' }}>
                <span className="w-1.5 h-4 rounded-full bg-[#5aaa3a]" /> Our Mission
              </h4>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                At InstaFitCore Solutions Pvt. Ltd., we simplify furniture and home services through trust, technology, and transparency, delivering reliable outcomes and complete peace of mind.
              </p>
            </div>
            <div className="space-y-3 p-6 rounded-2xl bg-gradient-to-b from-gray-50/70 to-gray-50/20 border border-gray-100">
              <h4 className="text-base font-bold flex items-center gap-2" style={{ color: '#5aaa3a' }}>
                <span className="w-1.5 h-4 rounded-full bg-[#5aaa3a]" /> Our Vision
              </h4>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                To become India&apos;s most trusted platform for furniture assembly and home services, connecting customers, retailers, and professionals through technology and transparency.
              </p>
            </div>
          </div>

          <div id="features" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-4">
            {[
              { title: 'Professional & Punctual', desc: 'Services delivered by trained and certified professionals with a strong focus on quality, safety, and on-time completion.' },
              { title: 'End-to-End Execution', desc: 'From delivery, installation, and setup to modular kitchens, relocation services, and post-service support, we manage the entire service lifecycle.' },
              { title: 'Fair & Transparent Pricing', desc: 'Clear and upfront pricing with no hidden charges, ensuring full clarity before service confirmation.' },
              { title: 'Empowering Technicians', desc: 'We invest in training, compliance, and long-term growth opportunities to build a reliable and professional service ecosystem.' },
            ].map((f, i) => (
              <div key={i} className="p-5 border border-gray-100 bg-white hover:border-gray-200 rounded-2xl space-y-2.5 hover:shadow-sm transition-all duration-200">
                <CheckCircle2 size={18} style={{ color: '#8ED26B' }} />
                <h5 className="font-bold text-xs text-gray-900 tracking-tight">{f.title}</h5>
                <p className="text-[11px] text-gray-400 font-medium leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* GALLERY */}
        <section id="gallery" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Camera size={20} style={{ color: '#5aaa3a' }} /> Furniture &amp; Setup Project Gallery
            </h3>
            <span className="text-xs font-bold text-gray-400 tracking-wide uppercase">Real Field Implementations</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {showcaseImages.map((img, i) => (
              <div key={i} className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col">
                <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between space-y-1">
                  <h4 className="font-bold text-xs text-gray-900 tracking-tight group-hover:text-[#5aaa3a] transition-colors">{img.title}</h4>
                  <p className="text-[11px] text-gray-400 font-medium leading-normal">{img.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section id="testimonials" className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm space-y-8">
          <div className="flex items-center justify-between border-b border-gray-50 pb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare size={20} style={{ color: '#5aaa3a' }} /> Client Feedback Ecosystem
            </h3>
            <span className="text-xs font-bold text-gray-400 tracking-wide uppercase">Operational Reviews</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1 bg-gray-50/60 border border-gray-100/80 rounded-2xl p-6 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Share your experience</p>
              {testimonialSubmitted ? (
                <div className="py-6 text-center text-xs font-bold text-green-700 bg-green-50 border border-green-100/60 rounded-xl shadow-inner animate-pulse">
                  Thank you! Review captured for verification.
                </div>
              ) : (
                <form onSubmit={handleTestimonialSubmit} className="space-y-4">
                  <input
                    type="text" required placeholder="Your name"
                    value={testimonialForm.name}
                    onChange={e => setTestimonialForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full text-xs px-4 py-3 bg-white border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all font-medium"
                  />
                  <div className="flex items-center gap-1.5 py-1 px-2 bg-white rounded-xl border border-gray-200/50">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star} type="button"
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(0)}
                        onClick={() => setTestimonialForm(prev => ({ ...prev, rating: star }))}
                        className="transition-transform hover:scale-110 focus:outline-none"
                      >
                        <Star size={22}
                          fill={star <= (hoveredStar || testimonialForm.rating) ? '#f59e0b' : 'none'}
                          stroke={star <= (hoveredStar || testimonialForm.rating) ? '#f59e0b' : '#cbd5e1'}
                          strokeWidth={1.5}
                        />
                      </button>
                    ))}
                    <span className="text-[11px] text-gray-400 font-bold ml-auto pr-1">
                      {testimonialForm.rating > 0 ? `${testimonialForm.rating}/5 Rating` : 'Rate standard'}
                    </span>
                  </div>
                  <textarea
                    rows={3} required placeholder="Write operational experience details here..."
                    value={testimonialForm.text}
                    onChange={e => setTestimonialForm(prev => ({ ...prev, text: e.target.value }))}
                    className="w-full text-xs px-4 py-3 bg-white border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all resize-none font-medium h-24"
                  />
                  {testimonialError && <p className="text-[11px] text-red-500 font-bold">{testimonialError}</p>}
                  <button
                    type="submit" disabled={testimonialSubmitting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 shadow-sm disabled:opacity-60"
                    style={{ backgroundColor: '#8ED26B' }}
                    onMouseEnter={e => { if (!testimonialSubmitting) e.currentTarget.style.backgroundColor = '#72bf4e'; }}
                    onMouseLeave={e => { if (!testimonialSubmitting) e.currentTarget.style.backgroundColor = '#8ED26B'; }}
                  >
                    {testimonialSubmitting ? <><Loader2 size={14} className="animate-spin" /> Transmitting...</> : 'Publish Review Directive'}
                  </button>
                </form>
              )}
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {testimonials.map((t, i) => (
                <div key={i} className="p-5 bg-gradient-to-b from-gray-50/60 to-white border border-gray-100 rounded-2xl flex flex-col justify-between shadow-xs hover:border-gray-200 transition-colors">
                  <p className="text-xs text-gray-500 font-medium leading-relaxed italic">&ldquo;{t.text}&rdquo;</p>
                  <div className="flex items-center justify-between border-t border-gray-100/60 pt-3.5 mt-4">
                    <span className="text-xs font-bold text-slate-800">{t.name}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={12}
                          fill={s <= t.rating ? '#f59e0b' : 'none'}
                          stroke={s <= t.rating ? '#f59e0b' : '#cbd5e1'}
                          strokeWidth={1.5}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* INQUIRY */}
        <div id="inquiry" className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">Submit Operational Inquiry</h3>
              <p className="text-xs text-gray-400 mt-1 font-medium">Initialize routing pathways by populating the parameters below.</p>
            </div>

            {formSubmitted ? (
              <div className="p-8 bg-green-50/70 border border-green-100 rounded-2xl text-center text-sm font-bold text-green-700 shadow-inner">
                Thank you! Operational inquiry data mapped successfully to database registry.
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Client Nomenclature</label>
                    <input type="text" name="name" required value={formData.name} onChange={handleInputChange} placeholder="Enter full name"
                      className="w-full text-xs px-4 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Contact Phone</label>
                    <input type="tel" name="phone" required value={formData.phone} onChange={handleInputChange} placeholder="Enter mobile number"
                      className="w-full text-xs px-4 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Electronic Mailing Node</label>
                  <input type="email" name="email" required value={formData.email} onChange={handleInputChange} placeholder="name@company.com"
                    className="w-full text-xs px-4 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Required Classification Service Node</label>
                  <div className="relative">
                    <select name="serviceType" value={formData.serviceType} onChange={handleInputChange}
                      className="w-full text-xs px-4 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all appearance-none font-semibold text-gray-700"
                    >
                      {serviceOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                      <Layers size={14} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Specification Directive Message</label>
                  <textarea rows={4} name="message" required value={formData.message} onChange={handleInputChange}
                    placeholder="Describe specific volume dimensions, layout properties, deadlines, etc..."
                    className="w-full text-xs px-4 py-3 bg-gray-50 border border-gray-200/70 rounded-xl outline-none focus:ring-2 focus:ring-[#8ED26B]/50 transition-all resize-none font-medium h-28"
                  />
                </div>
                {formError && <p className="text-xs text-red-500 font-bold">{formError}</p>}
                <button type="submit" disabled={formSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-300 shadow-md disabled:opacity-60"
                  style={{ backgroundColor: '#8ED26B' }}
                  onMouseEnter={e => { if (!formSubmitting) e.currentTarget.style.backgroundColor = '#72bf4e'; }}
                  onMouseLeave={e => { if (!formSubmitting) e.currentTarget.style.backgroundColor = '#8ED26B'; }}
                >
                  {formSubmitting ? <><Loader2 size={16} className="animate-spin" /> Appending Records...</> : <><Send size={15} /> Transmit Operational Inquiry</>}
                </button>
              </form>
            )}
          </div>

          <div id="contact" className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-7 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Contact Matrix Channels</h3>
                <p className="text-xs text-gray-400 mt-1 font-medium">Immediate communication lines managed by routing desk controllers.</p>
              </div>
              <div className="space-y-5 text-xs font-medium">
                <div className="flex gap-4 items-start p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div className="p-2.5 rounded-xl bg-white shadow-xs shrink-0"><Mail size={18} style={{ color: '#5aaa3a' }} /></div>
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Customer Support Desk</h4>
                    <a href="mailto:customersupport@instafitcore.com" className="text-gray-800 font-bold hover:underline block mt-1 text-xs">customersupport@instafitcore.com</a>
                  </div>
                </div>
                <div className="flex gap-4 items-start p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div className="p-2.5 rounded-xl bg-white shadow-xs shrink-0"><Mail size={18} style={{ color: '#f59e0b' }} /></div>
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Grievance &amp; Escalation</h4>
                    <a href="mailto:Feedback@instafitcore.com" className="text-gray-800 font-bold hover:underline block mt-1 text-xs">Feedback@instafitcore.com</a>
                  </div>
                </div>
                <div className="flex gap-4 items-start p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div className="p-2.5 rounded-xl bg-white shadow-xs shrink-0"><MapPin size={18} style={{ color: '#ef4444' }} /></div>
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">HQ Headquarters</h4>
                    <p className="text-gray-700 font-semibold leading-relaxed mt-1 text-xs">
                      G7 Kemps Green View, Ayyappanagar, <br />KR Puram, Bangalore
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 text-center text-[11px] text-gray-400 font-bold uppercase tracking-wider bg-gray-50/50 -mx-8 -mb-8 py-4 rounded-b-[2rem]">
              SLA target latency: &lt; 24 business hours
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-gray-100 py-6 mt-16 shadow-inner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-400 font-bold tracking-wider uppercase">
          <div>&copy; 2026 INSTAFITCORE Solutions Pvt. Ltd. | One Stop Solutions Platform. All Rights Reserved.</div>
          <div className="flex items-center gap-1.5 normal-case font-semibold text-gray-400 text-xs">
            <span className="uppercase text-[11px] font-bold tracking-wider text-gray-400">Developed by</span>
            <Link href="https://rakvih.in" target="_blank" rel="noopener noreferrer" className="text-[#5aaa3a] font-bold hover:underline hover:text-[#72bf4e] transition-colors tracking-wide">
              RAKVIH
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}