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
  Camera, PenTool, Navigation, FileText, Activity, ExternalLink,
  Layers, Send, UserCheck, PackageCheck, FileCheck2
} from 'lucide-react';

type StatusFilter = 'all' | 'submitted' | 'assigned' | 'awaiting_countertop' | 'sign_off' | 'in_progress' | 'completed';

const STATUS_FILTERS: { id: StatusFilter; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: List },
  { id: 'submitted', label: 'Pending', icon: Send },
  { id: 'assigned', label: 'Assigned', icon: UserCheck },
  { id: 'awaiting_countertop', label: 'Awaiting Countertop', icon: PackageCheck },
  { id: 'sign_off', label: 'Sign Off', icon: FileCheck2 },
  { id: 'in_progress', label: 'In Progress', icon: Clock3 },
  { id: 'completed', label: 'Completed', icon: Check },
];

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  completed: { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: '✓ Completed' },
  in_progress: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: '● In Progress' },
  submitted: { cls: 'bg-gray-100 text-gray-600 border border-gray-200', label: '◦ Pending' },
  assigned: { cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200', label: '● Assigned' },
  awaiting_countertop: { cls: 'bg-orange-50 text-orange-700 border border-orange-200', label: '◔ Awaiting Countertop' },
  sign_off: { cls: 'bg-violet-50 text-violet-700 border border-violet-200', label: '◑ Sign Off' },
};

const EXPORT_COLUMNS = [
  'Job ID', 'Customer Name', 'Phone', 'Client / Partner', 'City',
  'Project Details', 'Product Link',
  'Assigned Executor ID', 'Scheduled Date', 'Duration', 'Status', 'Created At',
];

export default function ClientModularReportsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [clientData, setClientData] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
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
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('clientUser');
    if (!storedUser) {
      router.push('/');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setClientData(parsedUser);
    fetchProjectsForClient(parsedUser.id);
  }, [router]);

  const fetchProjectsForClient = async (clientId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('modular_projects')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (!error && data) setProjects(data);
    setLoading(false);
  };

  const toNum = (d: string) => {
    const s = String(d || '').substring(0, 10);
    const parts = s.split('-');
    return (parseInt(parts[0]) || 0) * 10000 + (parseInt(parts[1]) || 0) * 100 + (parseInt(parts[2]) || 0);
  };

  const hasFilters = search.trim() !== '' || statusFilter !== 'all' || dateFrom !== '' || dateTo !== '';

  const processed = (() => {
    let result = [...projects];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.customer_name?.toLowerCase().includes(q) ||
        m.phone?.toLowerCase().includes(q) ||
        m.job_id?.toLowerCase().includes(q) ||
        m.city?.toLowerCase().includes(q) ||
        m.project_details?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(m => m.status === statusFilter);
    }

    if (dateFrom && dateTo) {
      const fromNumVal = toNum(dateFrom);
      const toNumVal = toNum(dateTo);
      result = result.filter(m => {
        const projNum = toNum(m.scheduled_date || m.created_at);
        return projNum >= fromNumVal && projNum <= toNumVal;
      });
    } else if (dateFrom) {
      const exactNum = toNum(dateFrom);
      result = result.filter(m => toNum(m.scheduled_date || m.created_at) === exactNum);
    } else if (dateTo) {
      const exactNum = toNum(dateTo);
      result = result.filter(m => toNum(m.scheduled_date || m.created_at) === exactNum);
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
    <ArrowUpDown size={11} className={`inline ml-1 ${sortField === field ? 'text-[#D4A017]' : 'text-gray-300'}`} />
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
    return processed.map(m => ({
      'Job ID': m.job_id || '',
      'Customer Name': m.customer_name || '',
      'Phone': m.phone || '',
      'Client / Partner': m.client || '',
      'City': m.city || '',
      'Project Details': m.project_details || '',
      'Product Link': m.product_link || '',
      'Assigned Executor ID': m.assigned_executor_id || 'Unassigned',
      'Scheduled Date': m.scheduled_date || '',
      'Duration': m.time_taken || '',
      'Status': m.status || '',
      'Created At': m.created_at || '',
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
      if (data.length === 0) { showToast('No projects to export for this selection.'); setDownloading(false); return; }
      const wb = buildWorkbook(data, 'Modular Report');
      XLSX.writeFile(wb, `INSTAFITCORE_Modular_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`Excel downloaded — ${data.length} projects.`);
    } catch { showToast('Failed to download Excel.'); }
    setDownloading(false);
  };

  const downloadCSV = () => {
    setDownloading(true);
    try {
      const data = getExportData();
      if (data.length === 0) { showToast('No projects to export for this selection.'); setDownloading(false); return; }
      const ws = XLSX.utils.json_to_sheet(data, { header: EXPORT_COLUMNS });
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `INSTAFITCORE_Modular_Report_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`CSV downloaded — ${data.length} projects.`);
    } catch { showToast('Failed to download CSV.'); }
    setDownloading(false);
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleViewProject = (project: any) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  if (!clientData) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ── Header ── */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Layers size={22} className="text-[#D4A017]" /> Modular Reports
              </h1>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                <User size={13} />
                <span>{clientData.full_name || clientData.name || 'Client'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm self-start">
              <ClipboardList size={14} />
              <span><strong className="text-gray-700">{processed.length}</strong> projects {hasFilters ? '(filtered)' : 'total'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadExcel}
              disabled={downloading || processed.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#D4A017' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#B98A12')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#D4A017')}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { label: 'Total', value: processed.length, icon: Package, color: 'text-[#D4A017]', bg: 'bg-[#D4A017]/10' },
            { label: 'In Progress', value: processed.filter(m => m.status === 'in_progress').length, icon: Clock3, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Completed', value: processed.filter(m => m.status === 'completed').length, icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Pending Stages', value: processed.filter(m => ['submitted', 'assigned', 'awaiting_countertop', 'sign_off'].includes(m.status)).length, icon: PackageCheck, color: 'text-orange-500', bg: 'bg-orange-50' },
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
                placeholder="Search by name, phone, job ID, city…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#D4A017] focus:ring-2 focus:ring-[#D4A017]/20 transition text-gray-900 placeholder-gray-400"
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
                    ? 'border-[#D4A017] bg-[#fdf6e3] text-[#B98A12]'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <Filter size={14} />
                <span className="hidden sm:inline">Filters</span>
                {hasFilters && <span className="w-2 h-2 rounded-full bg-[#D4A017]" />}
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
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#D4A017] focus:ring-2 focus:ring-[#D4A017]/20 transition text-gray-900 placeholder-gray-400"
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
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#D4A017] focus:ring-2 focus:ring-[#D4A017]/20 transition text-gray-900 placeholder-gray-400"
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
                  <th className="px-4 sm:px-5 py-4">Project</th>
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
                    <td colSpan={6} className="px-5 py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#D4A017] rounded-full animate-spin" />
                        <p className="text-sm">Loading projects…</p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-gray-400">
                      <Layers size={36} className="mx-auto mb-3 text-gray-200" />
                      <p className="font-medium">{hasFilters ? 'No projects match your filters.' : 'No modular projects found.'}</p>
                      {hasFilters && (
                        <button onClick={resetFilters} className="mt-3 text-sm font-semibold hover:underline" style={{ color: '#D4A017' }}>
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginated.map((project) => {
                    const badge = STATUS_BADGE[project.status] || STATUS_BADGE.submitted;
                    return (
                      <tr key={project.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-5 py-4">
                          <span className="text-xs font-mono font-medium text-gray-600 bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200">
                            {project.job_id || '—'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <p className="font-semibold text-gray-900">{project.customer_name || '—'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{project.phone || '—'}</p>
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <p className="font-medium text-gray-900 max-w-[180px] truncate" title={project.project_details}>
                            {project.project_details || '—'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{project.city || '—'}</p>
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(project.created_at)}</span>
                        </td>
                        <td className="px-4 sm:px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleViewProject(project)}
                              className="p-2 text-gray-400 hover:text-[#D4A017] hover:bg-[#fdf6e3] rounded-lg transition"
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
                      style={page === currentPage ? { backgroundColor: '#D4A017', color: 'white' } : { color: '#374151' }}
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
        <div className="mt-4 px-4 py-3 rounded-xl border text-xs text-gray-500 transition-colors" style={{ borderColor: '#D4A01733', backgroundColor: '#fdf6e3' }}>
          <span style={{ color: '#D4A017' }} className="font-semibold">Tip:</span> Select a date range to filter stats & downloads for specific time periods.
        </div>
      </div>

      {/* ── Details Modal ── */}
      {isModalOpen && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#fdf6e3] text-[#B98A12] rounded-xl border border-[#D4A01733]">
                  <Layers size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">Modular Project Details</h2>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedProject.job_id}</p>
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

                {/* Left Col: Customer Info */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Customer & Location</h3>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
                      <div className="flex items-start gap-3">
                        <User size={16} className="text-gray-400 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900">{selectedProject.customer_name || 'N/A'}</p>
                          <p className="text-gray-500 text-xs mt-1">{selectedProject.phone || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 pt-3 border-t border-gray-200/60">
                        <MapPin size={16} className="text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-gray-800">{selectedProject.city || 'No City Provided'}</p>
                          {selectedProject.client && (
                            <p className="text-gray-500 text-xs mt-1">Client / Partner: {selectedProject.client}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Project</h3>
                    <div className="bg-white rounded-xl p-4 space-y-3 border border-gray-100 shadow-sm">
                      <div>
                        <p className="text-xs text-gray-500">Project Details</p>
                        <p className="font-semibold text-gray-900 mt-0.5">{selectedProject.project_details || '—'}</p>
                      </div>
                      {selectedProject.product_link && (
                        <div>
                          <p className="text-xs text-gray-500">Product Link</p>
                          <a
                            href={selectedProject.product_link}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            View Product <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Col: Status Info & Signatures */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Project Status</h3>

                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${STATUS_BADGE[selectedProject.status]?.cls || STATUS_BADGE.submitted.cls}`}>
                          {STATUS_BADGE[selectedProject.status]?.label || selectedProject.status}
                        </span>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                          <span className="text-gray-500 flex items-center gap-2"><Activity size={14}/> Created At</span>
                          <span className="font-medium text-gray-900">{formatDate(selectedProject.created_at)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                          <span className="text-gray-500 flex items-center gap-2"><Calendar size={14}/> Scheduled Date</span>
                          <span className="font-medium text-gray-900">{selectedProject.scheduled_date ? formatDate(selectedProject.scheduled_date) : '—'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-gray-500 flex items-center gap-2"><Clock3 size={14}/> Duration</span>
                          <span className="font-medium text-[#B98A12]">{selectedProject.time_taken || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signatures Section */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Signatures</h3>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
                      {selectedProject.pm_name && (
                        <div>
                          <p className="text-xs text-gray-500">Project Manager</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{selectedProject.pm_name}</p>
                        </div>
                      )}
                      
                      {selectedProject.pm_signature_url && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">PM Signature</p>
                          <div className="bg-white rounded-lg p-2 h-20 flex items-center justify-center border border-gray-200 shadow-sm">
                            <img src={selectedProject.pm_signature_url} alt="PM Signature" className="max-h-full object-contain mix-blend-multiply" />
                          </div>
                        </div>
                      )}

                      {selectedProject.customer_ack_signature_url && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 mt-3">Customer Acknowledgement</p>
                          <div className="bg-white rounded-lg p-2 h-20 flex items-center justify-center border border-gray-200 shadow-sm">
                            <img src={selectedProject.customer_ack_signature_url} alt="Customer Signature" className="max-h-full object-contain mix-blend-multiply" />
                          </div>
                        </div>
                      )}

                      {!selectedProject.pm_signature_url && !selectedProject.customer_ack_signature_url && (
                        <p className="text-sm text-gray-400 italic">No signatures uploaded yet.</p>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}