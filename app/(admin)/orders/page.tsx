'use client';
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import { createClient } from '@/app/utils/supabase/client';
import {
  Plus, Trash2, Edit2, Search, Package, MapPin,
  Upload, Eye, Check, X, AlertCircle, CheckCircle,
  Loader2, Calendar, List, FilePlus, Ban, Clock3,
} from 'lucide-react';

type Tab = 'list' | 'create';
type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

const EMPTY_FORM = {
  date_str: '',
  order_id: '',
  job_id: '',
  customer_name: '',
  phone: '',
  email: '',
  user_id: null,
  client: '',
  client_id: '',
  service_company: '',
  sku: '',
  product_name: '',
  quantity: '1',
  image_url: '',
  pincode: '',
  city: '',
  address: '',
  location_details: '',
  landmark: '',
  state: '',
  remarks: '',
  type_of_service: '',
  purchase_date: '',
  date_of_appointment: '',
  product_link: '',
  // NEW FIELDS
  order_date: '',
  invoice_no: '',
  invoice_date: '',
};

// ── Updated: Service types taken from the client-facing reference page ──
const SERVICE_TYPES = [
  'Delivery',
  'Delivery & Installation',
  'Furniture Installation',
  'Furniture Dismantling',
  'Repair & Modification',
  'Reverse Pickup',
  'Store Display Setup'
];

// Helper to extract the 2-letter code based on the first selected service
const getServiceCode = (servicesStr: string) => {
  if (!servicesStr) return 'XX';
  const firstService = servicesStr.split(',')[0].trim();
  switch (firstService) {
    case 'Delivery': return 'DE';
    case 'Delivery & Installation': return 'DI';
    case 'Furniture Installation': return 'FI';
    case 'Furniture Dismantling': return 'FD';
    case 'Repair & Modification': return 'RM';
    case 'Reverse Pickup': return 'RP';
    case 'Store Display Setup': return 'SD';
    default: return 'XX';
  }
};

const excelSerialToDateStr = (val: any): string => {
  if (val === null || val === undefined || val === '') return '';
  const str = val.toString().trim();

  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = Number(str);
    const utcDays = Math.floor(serial - 25569); 
    const utcMs = utcDays * 86400 * 1000;
    const date = new Date(utcMs);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(str)) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  }

  return '';
};

const STATUS_FILTERS: { id: StatusFilter; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: List },
  { id: 'pending', label: 'Pending', icon: Calendar },
  { id: 'in_progress', label: 'In Progress', icon: Clock3 },
  { id: 'completed', label: 'Completed', icon: Check },
  { id: 'cancelled', label: 'Cancelled', icon: Ban },
];

const ORDER_TABLE_COLUMNS = [
  { label: 'Order ID', key: 'order_id' },
  { label: 'Job ID', key: 'job_id' },
  { label: 'Client Name', key: 'client' },
  { label: 'Customer', key: 'customer_name' },
  { label: 'Product', key: 'product_name' },
  { label: 'Date', key: 'purchase_date' },
  { label: 'Status', key: 'status' },
];

export default function OrderIntakePage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [viewOrder, setViewOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [formData, setFormData] = useState({ 
    ...EMPTY_FORM, 
    purchase_date: new Date().toISOString().split('T')[0],
    order_date: new Date().toISOString().split('T')[0],
    invoice_date: new Date().toISOString().split('T')[0],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    const validStatuses: StatusFilter[] = ['all', 'pending', 'in_progress', 'completed', 'cancelled'];
    if (statusParam && validStatuses.includes(statusParam as StatusFilter)) {
      setStatusFilter(statusParam as StatusFilter);
    }

    fetchOrders();
    fetchDropdownData();
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch error:', error);
    } else if (data) {
      setOrders(data);
    }
  };

  const fetchDropdownData = async () => {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, email, phone');
    if (usersData) setUsersList(usersData);

    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.error("Supabase Error fetching clients:", clientsError.message);
    } else if (clientsData) {
      setClientsList(clientsData);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const generateOrderId = async () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}${mm}${yyyy}`;
    const prefix = `ORDINST-${dateStr}`;

    const { data, error } = await supabase
      .from('orders')
      .select('order_id')
      .like('order_id', `${prefix}%`);

    if (error) {
      console.error('Order ID fetch error:', error);
    }

    let maxSeq = 0;
    const seqPattern = new RegExp(`^${prefix}(\\d{4,})$`);
    (data || []).forEach((row: any) => {
      const match = (row.order_id || '').toString().match(seqPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(5, '0');
    return `${prefix}${nextSeq}`;
  };

  const generateInvoiceNo = async () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}${mm}${yyyy}`;
    const prefix = `INV-INST-${dateStr}`;

    const { data, error } = await supabase
      .from('orders')
      .select('invoice_no')
      .like('invoice_no', `${prefix}%`);

    if (error) console.error('Invoice fetch error:', error);

    let maxSeq = 0;
    const seqPattern = new RegExp(`^${prefix}(\\d{4,})$`);
    (data || []).forEach((row: any) => {
      const idStr = (row.invoice_no || '').toString();
      const match = idStr.match(seqPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(5, '0');
    return `${prefix}${nextSeq}`;
  };

  const generateJobId = async (serviceStr: string) => {
    const code = getServiceCode(serviceStr);

    const { data, error } = await supabase
      .from('orders')
      .select('job_id')
      .like('job_id', `IFSC-%`);

    if (error) {
      console.error('Job ID fetch error:', error);
    }

    let maxSeq = 0;
    const seqPattern = /^IFSC-[A-Z]{2}-(\d{4,})$/;
    (data || []).forEach((row: any) => {
      const idStr = (row.job_id || '').toString();
      const match = idStr.match(seqPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(5, '0');
    return `IFSC-${code}-${nextSeq}`;
  };

  const handleClientSelect = async (name: string) => {
    if (!name) {
      setFormData(prev => ({
        ...prev,
        client: '',
        client_id: '',
      }));
      return;
    }

    const matchedClient = clientsList.find(c => c.full_name === name);

    if (matchedClient) {
      const newOrderId = await generateOrderId();

      setFormData(prev => ({
        ...prev,
        client: name,
        client_id: matchedClient.client_id || '',
        order_id: prev.order_id || newOrderId, 
      }));
    }
  };

  const handleSave = async () => {
    const requiredFields = [
      { key: 'client', name: 'Client Name' },
      { key: 'customer_name', name: 'Customer Name' },
      { key: 'sku', name: 'SKU' },
      { key: 'quantity', name: 'Quantity' },
      { key: 'product_name', name: 'Product Name' },
      { key: 'product_link', name: 'Product Link' },
      { key: 'address', name: 'Address' },
      { key: 'city', name: 'City' },
      { key: 'state', name: 'State' },
      { key: 'pincode', name: 'Pincode' },
      { key: 'type_of_service', name: 'Type of Service' },
    ];

    const missingField = requiredFields.find(
      field => !formData[field.key as keyof typeof formData]?.toString().trim()
    );

    if (missingField) {
      setErrorMsg(`${missingField.name} is required to create an order.`);
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const todayStr = new Date().toISOString().split('T')[0];

      let orderDataToSave: any = {
        ...formData,
        quantity: Number(formData.quantity) || 1,
      };
      delete orderDataToSave.date_of_appointment;

      const actualClient = clientsList.find(c => c.full_name === formData.client);
      if (actualClient) {
        orderDataToSave.client_id = actualClient.id; 
      }

      if (editingOrder) {
        orderDataToSave.status = editingOrder.status;
        orderDataToSave.order_id = formData.order_id || editingOrder.order_id;
        orderDataToSave.job_id = formData.job_id || editingOrder.job_id || await generateJobId(formData.type_of_service);
        orderDataToSave.invoice_no = formData.invoice_no || editingOrder.invoice_no || await generateInvoiceNo();
        orderDataToSave.purchase_date = formData.purchase_date || editingOrder.purchase_date || todayStr;
        orderDataToSave.user_id = editingOrder.user_id;

        const { error } = await supabase
          .from('orders')
          .update(orderDataToSave)
          .eq('id', editingOrder.id);

        if (error) throw error;
        showSuccess('Order updated successfully!');
      } else {
        orderDataToSave.order_id = formData.order_id || await generateOrderId();
        orderDataToSave.job_id = formData.job_id || await generateJobId(formData.type_of_service);
        orderDataToSave.invoice_no = formData.invoice_no || await generateInvoiceNo();
        orderDataToSave.status = 'pending';
        orderDataToSave.purchase_date = formData.purchase_date || todayStr;

        const { error } = await supabase.from('orders').insert([orderDataToSave]);
        if (error) throw error;
        showSuccess('Order created successfully!');
      }

      resetForm();
      fetchOrders();
      setActiveTab('list');
    } catch (error: any) {
      if (error.code === '23505') {
        setErrorMsg('Duplicate! An order with this Order ID and SKU already exists.');
      } else {
        setErrorMsg('Error saving order: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this order?')) {
      setErrorMsg('');
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) {
        setErrorMsg('Failed to delete: ' + error.message);
      } else {
        showSuccess('Order deleted successfully!');
        fetchOrders();
      }
    }
  };

  const resetForm = () => {
    setEditingOrder(null);
    const todayStr = new Date().toISOString().split('T')[0];
    setFormData({ 
      ...EMPTY_FORM, 
      purchase_date: todayStr,
      order_date: todayStr,
      invoice_date: todayStr,
    });
    setErrorMsg('');
  };

  const startEdit = async (order: any) => {
    setEditingOrder(order);

    const resolvedJobId = order.job_id || await generateJobId(order.type_of_service);
    const resolvedInvoiceNo = order.invoice_no || await generateInvoiceNo();
    const todayStr = new Date().toISOString().split('T')[0];

    const getRealClientId = (uuid: string) => {
      if (!uuid) return '';
      const matchedClient = clientsList.find(c => c.id === uuid);
      return matchedClient?.client_id || 'No ID';
    };

    setFormData({
      date_str: order.date_str || '',
      order_id: order.order_id || '',
      job_id: resolvedJobId,
      customer_name: order.customer_name || '',
      phone: order.phone || '',
      email: order.email || '',
      user_id: order.user_id,
      client: order.client || '',
      client_id: getRealClientId(order.client_id) || '',
      service_company: order.service_company || '',
      sku: order.sku || '',
      product_name: order.product_name || '',
      quantity: order.quantity?.toString() || '1',
      image_url: order.image_url || '',
      pincode: order.pincode || '',
      city: order.city || '',
      address: order.address || '',
      location_details: order.location_details || '',
      landmark: order.landmark || '',
      state: order.state || '',
      remarks: order.remarks || '',
      type_of_service: order.type_of_service || '',
      purchase_date: order.purchase_date || '',
      date_of_appointment: order.date_of_appointment || '',
      product_link: order.product_link || '',
      order_date: order.order_date || todayStr,
      invoice_no: resolvedInvoiceNo,
      invoice_date: order.invoice_date || todayStr,
    });
    setErrorMsg('');
    setActiveTab('create');
  };

  const processOrders = async (ordersData: any[]) => {
    setUploading(true);
    setErrorMsg('');

    const validOrders = ordersData.filter(o => o['Customer Name']);
    if (validOrders.length === 0) {
      setErrorMsg('No valid data found. Ensure your file has a "Customer Name" column.');
      setUploading(false);
      return;
    }

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}${mm}${yyyy}`;
    const todayStr = today.toISOString().split('T')[0];

    const invPrefix = `INV-INST-${dateStr}`;

    const { data: jobData } = await supabase.from('orders').select('job_id').like('job_id', 'IFSC-%');
    const { data: invData } = await supabase.from('orders').select('invoice_no').like('invoice_no', `${invPrefix}%`);

    const jobSeqPattern = /^IFSC-[A-Z]{2}-(\d{4,})$/;
    const invSeqPattern = new RegExp(`^${invPrefix}(\\d{4,})$`);

    let currentJobCount = 0;
    (jobData || []).forEach((row: any) => {
      const match = (row.job_id || '').toString().match(jobSeqPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > currentJobCount) currentJobCount = num;
      }
    });

    let currentInvCount = 0;
    (invData || []).forEach((row: any) => {
      const match = (row.invoice_no || '').toString().match(invSeqPattern);
      if (match) currentInvCount = Math.max(currentInvCount, parseInt(match[1], 10));
    });

    const mappedOrders = validOrders.map((o) => {
      const matchedUser = usersList.find(u => u.full_name === o['Customer Name']);
      const matchedClient = clientsList.find(c => c.full_name === o['Client']);

      currentJobCount++;
      const serviceCode = getServiceCode(o['Type of Service']);
      const finalJobId = `IFSC-${serviceCode}-${String(currentJobCount).padStart(5, '0')}`;

      currentInvCount++;
      const finalInvoiceNo = `${invPrefix}${String(currentInvCount).padStart(5, '0')}`;

      return {
        job_id: finalJobId,
        date_str: o['Date*']?.toString(),
        client: o['Client'],
        client_id: matchedClient?.id || null, 
        service_company: o['Service Company'],
        order_id: o['OrderId']?.toString() || '',
        customer_name: o['Customer Name'],
        phone: o['Phone']?.toString() || matchedUser?.phone || '',
        email: o['Email'] || matchedUser?.email || '',
        user_id: matchedUser?.id || null,
        sku: o['SKU']?.toString(),
        product_name: o['Product Name'],
        quantity: Number(o['Qty']) || 1,
        image_url: o['Image'],
        pincode: o['Pincode']?.toString(),
        city: o['City'],
        address: o['Address'],
        location_details: o['Location'],
        landmark: o['Landmark'],
        state: o['State'],
        remarks: o['Remarks / Special Comments'],
        type_of_service: o['Type of Service'],
        purchase_date: o['Purchase Date']?.toString() || todayStr,
        date_of_appointment: o['Date of Appointment']?.toString(),
        product_link: o['PRODUCT LINK'],
        status: 'pending',
        order_date: excelSerialToDateStr(o['Order Date']) || todayStr,
        invoice_no: finalInvoiceNo,
        invoice_date: todayStr,
      };
    });

    const { error } = await supabase
      .from('orders')
      .upsert(mappedOrders, { onConflict: 'order_id, sku', ignoreDuplicates: true });

    if (error) {
      setErrorMsg('Failed to upload: ' + error.message);
    } else {
      showSuccess('Import complete! New orders were added, duplicates were skipped.');
      fetchOrders();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      processOrders(json);
    };
    reader.readAsBinaryString(file);
  };

  const handleServiceTypeChange = (service: string, checked: boolean) => {
    let currentServices = formData.type_of_service ? formData.type_of_service.split(', ') : [];
    if (checked) {
      currentServices.push(service);
    } else {
      currentServices = currentServices.filter(s => s !== service);
    }
    setFormData({ ...formData, type_of_service: currentServices.join(', ') });
  };

  const filtered = orders.filter(o => {
    const matchesSearch =
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.email?.toLowerCase().includes(search.toLowerCase()) ||
      o.phone?.toLowerCase().includes(search.toLowerCase()) ||
      o.city?.toLowerCase().includes(search.toLowerCase()) ||
      o.order_id?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { label: string; cls: string }> = {
      completed:   { label: '✓ Completed',   cls: 'bg-emerald-50 text-emerald-700' },
      cancelled:   { label: '✕ Cancelled',   cls: 'bg-red-50 text-red-700' },
      in_progress: { label: '● In Progress', cls: 'bg-blue-50 text-blue-700' },
      pending:     { label: '○ Pending',      cls: 'bg-amber-50 text-amber-700' },
    };
    const s = map[status] ?? map['pending'];
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${s.cls}`}>
        {s.label}
      </span>
    );
  };

  const truncate = (val: any, len = 20) => {
    const str = val?.toString() ?? '';
    if (!str) return '—';
    return str.length > len ? str.slice(0, len) + '…' : str;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getRealClientId = (uuid: string) => {
    if (!uuid) return '';
    const matchedClient = clientsList.find(c => c.id === uuid);
    return matchedClient?.client_id || 'No ID';
  };

  const getClientEmail = (clientName: string) => {
    if (!clientName) return 'No Email';
    const matchedClient = clientsList.find(c => c.full_name === clientName);
    return matchedClient?.email || 'No Email';
  };

  return (
    <div className="flex-1 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Header & Upload */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
            <p className="text-sm text-gray-500 mt-1">Create, update, and track service orders</p>
          </div>
          <div className="flex items-center gap-3">
            {uploading && (
              <span className="text-xs text-gray-500 flex items-center gap-1.5 bg-gray-100 px-3 py-2 rounded-lg border border-gray-200">
                <Loader2 size={14} className="animate-spin text-blue-500" /> Processing…
              </span>
            )}
            <label className="cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm
                bg-white text-gray-700 hover:bg-gray-50 border border-gray-200
                ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                <Upload size={15} className="text-gray-400" />
                Bulk Import (.xlsx)
              </span>
            </label>
            <button
              onClick={() => setActiveTab('create')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition shadow-sm"
            >
              <Plus size={15} /> Create Order
            </button>
          </div>
        </div>

        {/* Generic Alerts */}
        {successMsg && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
            <CheckCircle size={16} className="flex-shrink-0" /> {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0" /> {errorMsg}
          </div>
        )}

        {/* Tabs Container */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Tab bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 p-4 gap-4">
            <div className="flex gap-0">
              {([
                { id: 'list',   label: 'Orders List',                               icon: List },
                { id: 'create', label: editingOrder ? 'Edit Order' : 'Create Order', icon: FilePlus },
              ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { if (id === 'list' && editingOrder) resetForm(); setActiveTab(id); }}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap
                    ${activeTab === id
                      ? 'border-gray-900 text-gray-900 bg-gray-50'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                  {id === 'list' && (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold
                      ${activeTab === 'list' ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-600'}`}>
                      {filtered.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Status filter chips */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 flex-wrap">
              {STATUS_FILTERS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap
                    ${statusFilter === id
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-800'}`}
                >
                  <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════
              TAB — ORDERS LIST
          ══════════════════════════════════════════ */}
          {activeTab === 'list' && (
            <div>
              {/* Search bar */}
              <div className="p-4 sm:p-5 border-b border-gray-100">
                <div className="relative max-w-md">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search orders…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 focus:bg-white transition text-gray-900 placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Table — Desktop view */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                      {ORDER_TABLE_COLUMNS.map(col => (
                        <th key={col.key} className="px-4 py-3 whitespace-nowrap">{col.label}</th>
                      ))}
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={ORDER_TABLE_COLUMNS.length + 1} className="px-5 py-16 text-center text-gray-400">
                          <Package size={36} className="mx-auto mb-3 text-gray-200" />
                          <p className="font-medium">No orders found</p>
                        </td>
                      </tr>
                    ) : filtered.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        {ORDER_TABLE_COLUMNS.map(col => (
                          <td key={col.key} className="px-4 py-3">
                            {col.key === 'status' ? (
                              <StatusBadge status={order.status} />
                            ) : col.key === 'purchase_date' ? (
                              <span className="text-xs text-gray-700">{formatDate(order[col.key])}</span>
                            ) : col.key === 'client' ? (
                              <div className="text-xs">
                                <p className="font-semibold text-gray-900">{order.client ? truncate(order.client, 25) : '—'}</p>
                                <p className="text-gray-500">{order.client_id ? getRealClientId(order.client_id) : '—'}</p>
                              </div>
                            ) : col.key === 'customer_name' ? (
                              <div className="text-xs">
                                <p className="font-semibold text-gray-900">{truncate(order.customer_name)}</p>
                                <p className="text-gray-500">{truncate(order.email, 24)}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-700 block truncate" title={order[col.key]?.toString()}>
                                {truncate(order[col.key])}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setViewOrder(order)}
                              title="View"
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => startEdit(order)}
                              title="Edit"
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-green-50 text-gray-500 hover:text-green-600 transition"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(order.id)}
                              title="Delete"
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Card view — Mobile */}
              <div className="sm:hidden divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <div className="px-4 py-16 text-center text-gray-400">
                    <Package size={36} className="mx-auto mb-3 text-gray-200" />
                    <p className="font-medium">No orders found</p>
                  </div>
                ) : filtered.map((order) => (
                  <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-blue-600">{order.order_id}</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{order.customer_name}</p>
                        <p className="text-xs text-gray-500 truncate">{order.email}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {order.client || '—'} {order.client_id ? `(${getRealClientId(order.client_id)})` : ''} · Job: {order.job_id || '—'}
                        </p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <p className="text-xs text-gray-600"><span className="font-semibold">Product:</span> {truncate(order.product_name)}</p>
                      <p className="text-xs text-gray-600"><span className="font-semibold">Date:</span> {formatDate(order.purchase_date)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewOrder(order)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-600 text-xs font-semibold transition"
                      >
                        <Eye size={14} /> View
                      </button>
                      <button
                        onClick={() => startEdit(order)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 hover:bg-green-50 text-gray-600 hover:text-green-600 text-xs font-semibold transition"
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-semibold transition"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB — CREATE / EDIT ORDER
          ══════════════════════════════════════════ */}
          {activeTab === 'create' && (
            <div className="p-4 sm:p-6 max-w-4xl mx-auto">

              {/* Form header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-gray-100 gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {editingOrder ? `Editing Order for: ${editingOrder.customer_name}` : 'New Service Order'}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    {editingOrder ? 'Update the fields below and save.' : 'Fill in the details below to create an order.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Job ID (Auto-generated, readonly) */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Job ID</label>
                    <input
                      type="text"
                      placeholder="Auto-generated on save"
                      value={formData.job_id}
                      readOnly
                      className="w-48 px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none bg-gray-50 text-gray-600 cursor-not-allowed font-semibold"
                    />
                  </div>
                  {editingOrder && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white shadow-sm"
                    >
                      <X size={13} /> Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-6 sm:space-y-8">

                {/* Client Details */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-3 rounded-full bg-green-500" /> Client Details
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Client Name dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Client Name <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={formData.client}
                        onChange={e => handleClientSelect(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900"
                      >
                        <option value="">Select Client *</option>
                        {clientsList.map(client => (
                          <option key={client.id} value={client.full_name}>
                            {client.full_name} {client.client_id ? `(${client.client_id})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Client ID (Auto-filled from client) */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client ID</label>
                      <input
                        type="text"
                        placeholder="Auto-filled from client"
                        value={formData.client_id}
                        readOnly
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed outline-none font-semibold"
                      />
                    </div>
                  </div>
                </section>

                {/* Customer Details */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-3 rounded-full bg-green-500" /> Customer Details
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Customer Name input */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Customer Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Customer Name *"
                        value={formData.customer_name}
                        onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>

                    {/* Phone Number input */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number</label>
                      <input
                        type="text"
                        placeholder="Enter Phone Number"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>

                    {/* Email input */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                      <input
                        type="email"
                        placeholder="Enter Email Address"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </div>
                </section>

                {/* Product Details */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-3 rounded-full bg-green-500" /> Product Details
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Order Date */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Order Date</label>
                      <input
                        type="date"
                        value={formData.order_date}
                        onChange={e => setFormData({ ...formData, order_date: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Order ID</label>
                      <input
                        type="text"
                        placeholder="Auto-generated (editable)"
                        value={formData.order_id}
                        onChange={e => setFormData({ ...formData, order_id: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400 font-medium"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Auto-generated by default, but you can edit it to match the client's own Order ID format.</p>
                    </div>

                    {/* Auto Generated Invoice Section */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Invoice No (Auto)</label>
                      <input
                        type="text"
                        value={formData.invoice_no}
                        readOnly
                        placeholder="Auto-generated on save"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none bg-gray-100 text-gray-500 font-medium cursor-not-allowed placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Invoice Date (Auto)</label>
                      <input
                        type="date"
                        value={formData.invoice_date}
                        readOnly
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none bg-gray-100 text-gray-500 font-medium cursor-not-allowed"
                      />
                    </div>
                    
                    <div className="sm:col-span-2 border-t border-gray-100 my-2 pt-4"></div>

                    <input
                      type="text"
                      placeholder="SKU *"
                      value={formData.sku}
                      onChange={e => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Quantity *"
                      value={formData.quantity}
                      onChange={e => {
                        const val = e.target.value;
                        const numericVal = parseInt(val);
                        setFormData({ ...formData, quantity: val === '' ? '' : Math.max(1, numericVal).toString() });
                      }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                    />
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Product Name *"
                        value={formData.product_name}
                        onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Product Link *"
                        value={formData.product_link}
                        onChange={e => setFormData({ ...formData, product_link: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </div>
                </section>

                {/* Address */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-3 rounded-full bg-green-500" /> Address
                  </p>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Address *"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="City *"
                        value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="State *"
                        value={formData.state}
                        onChange={e => setFormData({ ...formData, state: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Pincode *"
                        value={formData.pincode}
                        onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Landmark (Optional)"
                      value={formData.landmark}
                      onChange={e => setFormData({ ...formData, landmark: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                    />
                    <input
                      type="text"
                      placeholder="Location Details (Optional)"
                      value={formData.location_details}
                      onChange={e => setFormData({ ...formData, location_details: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                    />
                  </div>
                </section>

                {/* Service Details */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-3 rounded-full bg-green-500" /> Service Details
                  </p>
                  <div className="space-y-4">
                    <div className="w-full sm:w-1/2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Purchase Date</label>
                      <input
                        type="date"
                        value={formData.purchase_date}
                        onChange={e => setFormData({ ...formData, purchase_date: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Type of Service *</label>
                      <div className="flex flex-wrap gap-3">
                        {SERVICE_TYPES.map(service => (
                          <label key={service} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                            <input
                              type="checkbox"
                              checked={formData.type_of_service.split(', ').includes(service)}
                              onChange={e => handleServiceTypeChange(service, e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 transition"
                            />
                            {service}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <textarea
                        placeholder="Remarks / Special Comments (Optional)"
                        value={formData.remarks}
                        onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition bg-white resize-none text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </div>
                </section>
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { resetForm(); setActiveTab('list'); }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 bg-white transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto px-8 py-2.5 rounded-lg text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm bg-gray-900 hover:bg-black"
                >
                  {saving ? (
                    <><Loader2 size={16} className="animate-spin" /> Saving…</>
                  ) : (
                    <><Plus size={16} /> {editingOrder ? 'Save Changes' : 'Create Order'}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ View Order Modal ══ */}
      {viewOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900 truncate">{viewOrder.job_id || viewOrder.order_id}</h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  ID: {viewOrder.id} {viewOrder.order_id && `| Order: ${viewOrder.order_id}`}
                </p>
              </div>
              <button
                onClick={() => setViewOrder(null)}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition ml-2"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {[
                {
                  title: 'Client Information',
                  fields: [
                    { label: 'Client Name',  value: viewOrder.client || '—' },
                    { label: 'Client ID',    value: viewOrder.client_id ? getRealClientId(viewOrder.client_id) : '—' },
                    { label: 'Client Email', value: getClientEmail(viewOrder.client), full: true },
                  ],
                },
                {
                  title: 'Customer Information',
                  fields: [
                    { label: 'Customer Name', value: viewOrder.customer_name },
                    { label: 'Phone',         value: viewOrder.phone },
                    { label: 'Email',         value: viewOrder.email, full: true },
                  ],
                },
                {
                  title: 'Product & Billing Information',
                  fields: [
                    { label: 'Order Date',      value: formatDate(viewOrder.order_date) },
                    { label: 'Order ID',        value: viewOrder.order_id },
                    { label: 'Invoice Date',    value: formatDate(viewOrder.invoice_date) },
                    { label: 'Invoice No',      value: viewOrder.invoice_no },
                    { label: 'SKU',             value: viewOrder.sku },
                    { label: 'Quantity',        value: viewOrder.quantity },
                    { label: 'Product Name',    value: viewOrder.product_name, full: true },
                    { label: 'Product Link',    value: viewOrder.product_link, full: true },
                  ],
                },
                {
                  title: 'Service Details',
                  fields: [
                    { label: 'Type of Service', value: viewOrder.type_of_service },
                    { label: 'Purchase Date',   value: formatDate(viewOrder.purchase_date) },
                  ],
                },
                {
                  title: 'Delivery Address',
                  fields: [
                    { label: 'Address',  value: viewOrder.address,  full: true },
                    { label: 'City',     value: viewOrder.city },
                    { label: 'State',    value: viewOrder.state },
                    { label: 'Pincode',  value: viewOrder.pincode },
                    { label: 'Landmark', value: viewOrder.landmark },
                  ],
                },
              ].map(({ title, fields }) => (
                <div key={title}>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{title}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fields.map(({ label, value, full }: any) => (
                      <div key={label} className={full ? 'sm:col-span-2' : ''}>
                        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                        <p className="text-sm font-semibold text-gray-900 break-all">{value || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {viewOrder.remarks && (
                <div className="border-t border-gray-100 pt-6">
                  <p className="text-xs text-gray-400 mb-2">Remarks</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{viewOrder.remarks}</p>
                </div>
              )}

              <div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-600 font-semibold">Status: <StatusBadge status={viewOrder.status} /></p>
              </div>
            </div>

            <div className="border-t border-gray-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => { startEdit(viewOrder); setViewOrder(null); }}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black transition flex items-center justify-center gap-2"
              >
                <Edit2 size={15} /> Edit Order
              </button>
              <button
                onClick={() => setViewOrder(null)}
                className="flex-1 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}