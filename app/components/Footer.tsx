import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-6 mt-auto shadow-inner">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-400 font-bold tracking-wider uppercase">
        <div>© {new Date().getFullYear()} INSTAFITCORE Solutions Pvt. Ltd. | One Stop Solutions Platform.</div>
        <div className="flex items-center gap-1.5 normal-case font-semibold text-gray-400 text-xs">
          <span className="uppercase text-[11px] font-bold tracking-wider text-gray-400">Developed by</span>
          <Link href="https://rakvih.in" target="_blank" rel="noopener noreferrer" className="text-[#5aaa3a] font-bold hover:underline hover:text-[#72bf4e] transition-colors tracking-wide">
            RAKVIH
          </Link>
        </div>
      </div>
    </footer>
  );
}