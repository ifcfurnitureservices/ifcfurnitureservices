import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';

export default function ExecutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f7f6] flex flex-col font-sans text-gray-800 scroll-smooth selection:bg-[#8ED26B]/30">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}