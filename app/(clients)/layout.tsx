import ClientSidebar from '@/app/components/ClientSidebar';
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Your Sidebar */}
      <ClientSidebar />
      
      {/* THE FIX: Add md:ml-64 to push the content to the right of the fixed sidebar */}
      <main className="transition-all duration-300 md:ml-64">
        {children}
      </main>

    </div>
  );
}