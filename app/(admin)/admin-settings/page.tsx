'use client';
import { useRouter } from 'next/navigation';
import { KeyRound, UserCheck, Users, MoveRight, ShieldCheck } from 'lucide-react';

export default function AdminSettingsPage() {
  const router = useRouter();

  const settingsCards = [
    {
      name: 'Client Credentials',
      description: 'Access and manage client login details',
      path: '/client-credentials',
      icon: KeyRound,
      index: '01',
    },
    {
      name: 'Executors Credentials',
      description: 'Access and manage executor login details',
      path: '/executors',
      icon: UserCheck,
      index: '02',
    },
    {
      name: 'Inhouse Credentials',
      description: 'Access and manage inhouse team login details',
      path: '/users',
      icon: Users,
      index: '03',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* Ambient background glow — adds depth without being loud */}
      <div className="pointer-events-none absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-[#8ED26B]/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[10%] w-[500px] h-[500px] rounded-full bg-[#8ED26B]/[0.07] blur-[140px]" />

      {/* Faint grid texture for a premium, engineered feel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-5xl mx-auto">

        {/* Refined Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full bg-white border border-neutral-100 shadow-sm">
            <ShieldCheck size={14} className="text-[#6cb149]" strokeWidth={2.5} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
              Administration
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-neutral-800 tracking-tighter mb-4">
            Access Control
          </h1>

          <p className="text-neutral-400 text-base max-w-md mx-auto leading-relaxed">
            Select a category below to manage credentials and permissions.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {settingsCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.name}
                onClick={() => router.push(card.path)}
                className="group relative flex flex-col items-center justify-center aspect-square text-center bg-white/90 backdrop-blur-sm rounded-[2.5rem] p-8 border-2 border-transparent shadow-[0_2px_20px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_24px_60px_-15px_rgba(142,210,107,0.3)] hover:-translate-y-4 hover:border-[#8ED26B]/30 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden"
              >
                {/* Index number — subtle premium detail */}
                <span className="absolute top-6 left-7 text-xs font-bold tracking-widest text-neutral-200 group-hover:text-[#8ED26B]/50 transition-colors duration-500">
                  {card.index}
                </span>

                {/* Glowing orb bloom on hover */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 rounded-full blur-[60px] opacity-0 group-hover:w-full group-hover:h-full group-hover:opacity-100 transition-all duration-700 ease-out pointer-events-none bg-[#8ED26B]/25" />

                {/* Giant translucent background icon */}
                <Icon
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#8ED26B] w-56 h-56 opacity-0 scale-50 group-hover:opacity-5 group-hover:scale-110 transition-all duration-700 ease-out pointer-events-none"
                  strokeWidth={0.5}
                />

                {/* Fine top-edge accent line */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-0 group-hover:w-16 bg-[#8ED26B] rounded-full transition-all duration-500 ease-out" />

                <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
                  {/* Icon Container */}
                  <div className="flex items-center justify-center w-20 h-20 mb-6 rounded-3xl bg-neutral-50 text-neutral-400 group-hover:scale-110 group-hover:-translate-y-2 group-hover:bg-[#8ED26B]/15 group-hover:text-[#6cb149] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]">
                    <Icon size={36} strokeWidth={1.5} />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-neutral-800 tracking-tight mb-2 group-hover:text-neutral-900 transition-colors duration-300">
                    {card.name}
                  </h3>

                  {/* Description — new, quiet supporting line */}
                  <p className="text-sm text-neutral-400 mb-5 px-2 leading-relaxed group-hover:text-neutral-500 transition-colors duration-300">
                    {card.description}
                  </p>

                  {/* Arrow Action */}
                  <div className="flex items-center gap-1.5 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 text-[#6cb149] transition-all duration-500 delay-100">
                    <span className="text-xs font-semibold uppercase tracking-wider">Manage</span>
                    <MoveRight size={18} strokeWidth={2.5} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}