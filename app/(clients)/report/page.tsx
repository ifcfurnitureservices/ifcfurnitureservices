'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { createClient } from '@/app/utils/supabase/client';
import {
  Search, Package, MapPin, FileSpreadsheet,
  Calendar, List, Check, Ban, Clock3, Filter,
  ChevronLeft, ChevronRight, ArrowUpDown,
  FileDown, ClipboardList, User, Eye, X, Star,
  Camera, PenTool, Navigation, FileText, Activity, ExternalLink
} from 'lucide-react';

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

const STATUS_FILTERS: { id: StatusFilter; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: List },
  { id: 'pending', label: 'Pending', icon: Calendar },
  { id: 'in_progress', label: 'In Progress', icon: Clock3 },
  { id: 'completed', label: 'Completed', icon: Check },
  { id: 'cancelled', label: 'Cancelled', icon: Ban },
];

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  completed: { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: '✓ Completed' },
  cancelled: { cls: 'bg-red-50 text-red-700 border border-red-200', label: '✕ Cancelled' },
  in_progress: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: '● In Progress' },
  pending: { cls: 'bg-amber-50 text-amber-700 border border-amber-200', label: '○ Pending' },
};

const EXPORT_COLUMNS = [
  'Job ID', 'Invoice No', 'Invoice Date', 'Customer Name', 'Email', 'Phone', 'Client / Partner',
  'Service Company', 'SKU', 'Product Name', 'Quantity', 'Type of Service',
  'Address', 'City', 'State', 'Pincode', 'Landmark', 'Location Details',
  'Purchase Date', 'Product Link', 'Remarks', 'Status', 'Created At',
];

export default function ClientReportsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [clientData, setClientData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadToast, setDownloadToast] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 12;

  // Modal State
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedJobExecution, setSelectedJobExecution] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('clientUser');
    if (!storedUser) {
      router.push('/');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setClientData(parsedUser);
    fetchOrdersForClient(parsedUser.id);
  }, [router]);

  const fetchOrdersForClient = async (clientId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, clients!inner(id, full_name)')
      .eq('client_id', clientId) 
      .order('created_at', { ascending: false });

    if (!error && data) setOrders(data);
    setLoading(false);
  };

  const toNum = (d: string) => {
    const s = String(d || '').substring(0, 10);
    const parts = s.split('-');
    return (parseInt(parts[0]) || 0) * 10000 + (parseInt(parts[1]) || 0) * 100 + (parseInt(parts[2]) || 0);
  };
  
  const hasFilters = search.trim() !== '' || statusFilter !== 'all' || dateFrom !== '' || dateTo !== '';
  
  const processed = (() => {
    let result = [...orders];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.customer_name?.toLowerCase().includes(q) ||
        o.email?.toLowerCase().includes(q) ||
        o.phone?.toLowerCase().includes(q) ||
        o.job_id?.toLowerCase().includes(q) ||
        o.invoice_no?.toLowerCase().includes(q) ||
        o.sku?.toLowerCase().includes(q) ||
        o.product_name?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }

    if (dateFrom && dateTo) {
      const fromNumVal = toNum(dateFrom);
      const toNumVal = toNum(dateTo);
      result = result.filter(o => {
        const orderNum = toNum(o.purchase_date || o.created_at);
        return orderNum >= fromNumVal && orderNum <= toNumVal;
      });
    } else if (dateFrom) {
      const exactNum = toNum(dateFrom);
      result = result.filter(o => toNum(o.purchase_date || o.created_at) === exactNum);
    } else if (dateTo) {
      const exactNum = toNum(dateTo);
      result = result.filter(o => toNum(o.purchase_date || o.created_at) === exactNum);
    }

    result.sort((a, b) => {
      let av: any = a[sortField as keyof typeof a];
      let bv: any = b[sortField as keyof typeof b];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  })();

  const totalPages = Math.ceil(processed.length / perPage);
  const paginated = processed.slice((currentPage - 1) * perPage, currentPage * perPage);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, dateFrom, dateTo]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <ArrowUpDown size={11} className={`inline ml-1 ${sortField === field ? 'text-[#8ED26B]' : 'text-gray-300'}`} />
  );

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const showToast = (msg: string) => {
    setDownloadToast(msg);
    setTimeout(() => setDownloadToast(''), 3000);
  };

  const getExportData = () => {
    return processed.map(o => ({
      'Job ID': o.job_id || '',
      'Invoice No': o.invoice_no || '',
      'Invoice Date': o.invoice_date || '',
      'Customer Name': o.customer_name || '',
      'Email': o.email || '',
      'Phone': o.phone || '',
      'Client / Partner': o.clients?.full_name || o.client || '',
      'Service Company': o.service_company || '',
      'SKU': o.sku || '',
      'Product Name': o.product_name || '',
      'Quantity': o.quantity || 1,
      'Type of Service': o.type_of_service || '',
      'Address': o.address || '',
      'City': o.city || '',
      'State': o.state || '',
      'Pincode': o.pincode || '',
      'Landmark': o.landmark || '',
      'Location Details': o.location_details || '',
      'Purchase Date': o.purchase_date || '',
      'Product Link': o.product_link || '',
      'Remarks': o.remarks || '',
      'Status': o.status || '',
      'Created At': o.created_at || '',
    }));
  };

  const buildWorkbook = (rows: Record<string, any>[], sheetName: string) => {
    const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS });
    const cols = EXPORT_COLUMNS.map(k => ({
      wch: Math.min(40, Math.max(12, k.length, ...rows.map(r => String(r[k] || '').length)))
    }));
    ws['!cols'] = cols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return wb;
  };

  const downloadExcel = () => {
    setDownloading(true);
    try {
      const data = getExportData();
      if (data.length === 0) { showToast('No orders to export for this selection.'); setDownloading(false); return; }
      const wb = buildWorkbook(data, 'Orders Report');
      XLSX.writeFile(wb, `INSTAFITCORE_Orders_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`Excel downloaded — ${data.length} orders.`);
    } catch { showToast('Failed to download Excel.'); }
    setDownloading(false);
  };

  const downloadCSV = () => {
    setDownloading(true);
    try {
      const data = getExportData();
      if (data.length === 0) { showToast('No orders to export for this selection.'); setDownloading(false); return; }
      const ws = XLSX.utils.json_to_sheet(data, { header: EXPORT_COLUMNS });
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `INSTAFITCORE_Orders_Report_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`CSV downloaded — ${data.length} orders.`);
    } catch { showToast('Failed to download CSV.'); }
    setDownloading(false);
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  };

  // --- Actions ---
  const handleViewOrder = async (order: any) => {
    setSelectedOrder(order);
    setSelectedJobExecution(null);
    setIsModalOpen(true);
    setLoadingJob(true);

    const { data } = await supabase
      .from('job_execution')
      .select('*')
      .eq('order_id', order.id)
      .single();

    if (data) setSelectedJobExecution(data);
    setLoadingJob(false);
  };

  if (!clientData) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ── Header ── */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Your Reports</h1>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                <User size={13} />
                <span>{clientData.full_name || clientData.name || 'Client'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm self-start">
              <ClipboardList size={14} />
              <span><strong className="text-gray-600">{processed.length}</strong> orders {hasFilters ? '(filtered)' : 'total'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadExcel}
              disabled={downloading || processed.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#8ED26B' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#76c55d')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}
            >
              <FileSpreadsheet size={15} />
              {downloading ? 'Downloading…' : 'Excel'}
            </button>
            <button
              onClick={downloadCSV}
              disabled={downloading || processed.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown size={15} className="text-gray-400" />
              CSV
            </button>
          </div>
        </div>

        {/* ── Toast ── */}
        {downloadToast && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
            <Check size={16} className="flex-shrink-0" />
            {downloadToast}
          </div>
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { label: 'Total', value: processed.length, icon: Package, color: 'text-[#8ED26B]', bg: 'bg-[#8ED26B]/10' },
            { label: 'Pending', value: processed.filter(o => o.status === 'pending').length, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'In Progress', value: processed.filter(o => o.status === 'in_progress').length, icon: Clock3, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Completed', value: processed.filter(o => o.status === 'completed').length, icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Cancelled', value: processed.filter(o => o.status === 'cancelled').length, icon: Ban, color: 'text-red-500', bg: 'bg-red-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 border border-gray-200 shadow-sm flex items-center gap-3 sm:gap-4">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Icon size={16} className={`${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-gray-900">{value}</p>
                <p className="text-[11px] sm:text-xs text-gray-500 truncate">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Table Card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          <div className="p-4 sm:p-5 border-b border-gray-200">
            <div className="relative mb-4 sm:mb-0 sm:max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, phone, Job ID, Invoice No…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition text-gray-900 placeholder-gray-400"
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 min-w-0 overflow-x-auto">
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 w-max min-w-full sm:min-w-0">
                  {STATUS_FILTERS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setStatusFilter(id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap flex-shrink-0
                        ${statusFilter === id
                          ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                          : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-medium border transition flex-shrink-0
                  ${showFilters
                    ? 'border-[#8ED26B] bg-[#f4fced] text-[#6ab84e]'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <Filter size={14} />
                <span className="hidden sm:inline">Filters</span>
                {hasFilters && <span className="w-2 h-2 rounded-full bg-[#8ED26B]" />}
              </button>
            </div>

            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date From</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date To</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    {hasFilters ? (
                      <button
                        onClick={resetFilters}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 bg-white transition"
                      >
                        Clear All Filters
                      </button>
                    ) : (
                      <div className="w-full px-4 py-2.5 rounded-lg border border-gray-100 text-gray-400 text-sm text-center bg-gray-50">
                        No active filters
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className="px-4 sm:px-5 py-4 cursor-pointer hover:text-gray-700 transition select-none" onClick={() => handleSort('job_id')}>
                    Job ID <SortIcon field="job_id" />
                  </th>
                  <th className="px-4 sm:px-5 py-4 cursor-pointer hover:text-gray-700 transition select-none" onClick={() => handleSort('customer_name')}>
                    Customer <SortIcon field="customer_name" />
                  </th>
                  <th className="px-4 sm:px-5 py-4">Product</th>
                  <th className="px-4 sm:px-5 py-4">Service</th>
                  <th className="px-4 sm:px-5 py-4 cursor-pointer hover:text-gray-700 transition select-none" onClick={() => handleSort('status')}>
                    Status <SortIcon field="status" />
                  </th>
                  <th className="px-4 sm:px-5 py-4 cursor-pointer hover:text-gray-700 transition select-none" onClick={() => handleSort('created_at')}>
                    Date <SortIcon field="created_at" />
                  </th>
                  <th className="px-4 sm:px-5 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#8ED26B] rounded-full animate-spin" />
                        <p className="text-sm">Loading orders…</p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-gray-400">
                      <Package size={36} className="mx-auto mb-3 text-gray-200" />
                      <p className="font-medium">{hasFilters ? 'No orders match your filters.' : 'No orders found.'}</p>
                      {hasFilters && (
                        <button onClick={resetFilters} className="mt-3 text-sm font-semibold hover:underline" style={{ color: '#8ED26B' }}>
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginated.map((order) => {
                    const badge = STATUS_BADGE[order.status] || STATUS_BADGE.pending;
                    return (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-5 py-4">
                          <span className="text-xs font-mono font-medium text-gray-600 bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200">
                            {order.job_id || '—'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <p className="font-semibold text-gray-900">{order.customer_name || '—'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{order.email || order.phone || '—'}</p>
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <p className="font-medium text-gray-900">{order.product_name || '—'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">SKU: {order.sku || '—'} · Qty: {order.quantity || 1}</p>
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <span className="text-xs text-gray-600 leading-relaxed block max-w-[120px]">
                            {order.type_of_service || '—'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(order.created_at)}</span>
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleViewOrder(order)}
                              className="p-2 text-gray-400 hover:text-[#8ED26B] hover:bg-[#f4fced] rounded-lg transition"
                              title="View Details"
                            >
                              <Eye size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 sm:px-5 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
              <p className="text-xs text-gray-400 order-2 sm:order-1">
                Showing {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, processed.length)} of {processed.length}
              </p>
              <div className="flex items-center gap-1 order-1 sm:order-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-gray-700 disabled:opacity-30 transition"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition"
                      style={page === currentPage ? { backgroundColor: '#8ED26B', color: 'white' } : {}}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-gray-700 disabled:opacity-30 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 px-4 py-3 rounded-xl border text-xs text-gray-500" style={{ borderColor: '#8ED26B33', backgroundColor: '#f4fced' }}>
          <span style={{ color: '#6ab84e' }} className="font-semibold">Tip:</span> Select a date range to filter stats & downloads for specific time periods.
        </div>
      </div>

      {/* ── Beautiful Details Modal ── */}
      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#f4fced] text-[#6ab84e] rounded-xl border border-[#8ED26B33]">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">Order Details</h2>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedOrder.job_id}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 text-sm">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Col: Order Info */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Customer & Location</h3>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
                      <div className="flex items-start gap-3">
                        <User size={16} className="text-gray-400 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900">{selectedOrder.customer_name || 'N/A'}</p>
                          <p className="text-gray-500 text-xs mt-1">{selectedOrder.email} • {selectedOrder.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 pt-3 border-t border-gray-200/60">
                        <MapPin size={16} className="text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-gray-800">{selectedOrder.address || 'No Address Provided'}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            {selectedOrder.city}, {selectedOrder.state} {selectedOrder.pincode}
                          </p>
                          {selectedOrder.landmark && (
                            <p className="text-gray-400 text-xs mt-1">Landmark: {selectedOrder.landmark}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Product & Billing</h3>
                    <div className="bg-white rounded-xl p-4 space-y-3 border border-gray-100 shadow-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Invoice No</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{selectedOrder.invoice_no || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Invoice Date</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{selectedOrder.invoice_date ? formatDate(selectedOrder.invoice_date) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Product</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{selectedOrder.product_name || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">SKU</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{selectedOrder.sku || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Service Type</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{selectedOrder.type_of_service || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Quantity</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{selectedOrder.quantity || 1}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Col: Execution Info */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Execution Status</h3>
                    
                    {loadingJob ? (
                      <div className="flex items-center gap-3 text-gray-400 p-4">
                        <div className="w-5 h-5 border-2 border-gray-200 border-t-[#8ED26B] rounded-full animate-spin" />
                        Fetching job records...
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${STATUS_BADGE[selectedOrder.status]?.cls || STATUS_BADGE.pending.cls}`}>
                            {STATUS_BADGE[selectedOrder.status]?.label || selectedOrder.status}
                          </span>
                          {selectedJobExecution?.customer_rating && (
                            <div className="flex items-center gap-1 text-amber-500 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                              <Star size={14} className="fill-current" />
                              <span className="font-bold text-xs">{selectedJobExecution.customer_rating}/5</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 text-sm">
                           <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                             <span className="text-gray-500 flex items-center gap-2"><Activity size={14}/> Started At</span>
                             <span className="font-medium text-gray-900">{selectedJobExecution?.start_time ? formatDate(selectedJobExecution.start_time) : '—'}</span>
                           </div>
                           <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                             <span className="text-gray-500 flex items-center gap-2"><Check size={14}/> Completed At</span>
                             <span className="font-medium text-gray-900">{selectedJobExecution?.end_time ? formatDate(selectedJobExecution.end_time) : '—'}</span>
                           </div>
                           
                           {/* ----- ADDED COMPLETION LOCATION HERE ----- */}
                           {selectedJobExecution?.signature_latitude && selectedJobExecution?.signature_longitude && (
                             <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                               <span className="text-gray-500 flex items-center gap-2"><MapPin size={14}/> Completion Location</span>
                               <a 
                                 href={`https://www.google.com/maps/search/?api=1&query=${selectedJobExecution.signature_latitude},${selectedJobExecution.signature_longitude}`}
                                 target="_blank"
                                 rel="noreferrer"
                                 className="font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                               >
                                 View on Map <ExternalLink size={12} />
                               </a>
                             </div>
                           )}

                           <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                             <span className="text-gray-500 flex items-center gap-2"><Clock3 size={14}/> Actual Work Time</span>
                             <span className="font-medium text-[#6ab84e]">{formatDuration(selectedJobExecution?.actual_worked_ms)}</span>
                           </div>
                           <div className="flex justify-between items-center py-2">
                             <span className="text-gray-500 flex items-center gap-2"><Navigation size={14}/> Travel Time</span>
                             <span className="font-medium text-gray-900">{formatDuration(selectedJobExecution?.travel_duration_ms)}</span>
                           </div>
                        </div>

                        {selectedJobExecution?.customer_feedback && (
                          <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-400 mb-1">Customer Feedback</p>
                            <p className="text-sm italic text-gray-700">"{selectedJobExecution.customer_feedback}"</p>
                          </div>
                        )}
                        {selectedJobExecution?.execution_notes && (
                          <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-400 mb-1">Execution Notes</p>
                            <p className="text-sm text-gray-700">{selectedJobExecution.execution_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Photos & Signatures Area (Full Width Bottom) */}
              {!loadingJob && selectedJobExecution && (
                <div className="mt-8 border-t border-gray-100 pt-6">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Camera size={14} /> Proof of Work
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Before Photos */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700">Before ({selectedJobExecution.before_photos?.length || 0})</p>
                      {selectedJobExecution.before_photos?.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {selectedJobExecution.before_photos.map((url: string, i: number) => (
                            <img key={i} src={url} alt="Before" className="h-24 w-24 object-cover rounded-xl border border-gray-200 flex-shrink-0 bg-gray-50" />
                          ))}
                        </div>
                      ) : (
                        <div className="h-24 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">No photos</div>
                      )}
                    </div>

                    {/* After Photos */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700">After ({selectedJobExecution.after_photos?.length || 0})</p>
                      {selectedJobExecution.after_photos?.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {selectedJobExecution.after_photos.map((url: string, i: number) => (
                            <img key={i} src={url} alt="After" className="h-24 w-24 object-cover rounded-xl border border-gray-200 flex-shrink-0 bg-gray-50" />
                          ))}
                        </div>
                      ) : (
                        <div className="h-24 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">No photos</div>
                      )}
                    </div>

                    {/* Signature */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><PenTool size={14}/> Signature</p>
                      {selectedJobExecution.signature_url ? (
                        <img src={selectedJobExecution.signature_url} alt="Signature" className="h-24 w-full object-contain bg-white rounded-xl border border-gray-200 p-2" />
                      ) : (
                        <div className="h-24 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">Not signed</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        html, body {
          color-scheme: light;
        }
      `}</style>
    </div>
  );
}