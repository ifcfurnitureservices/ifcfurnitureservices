'use client';
import { useState, useRef, useEffect, Suspense } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/app/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, Trash2, Edit2, Search, Package, MapPin,
  Upload, Eye, Check, X, AlertCircle, CheckCircle,
  Loader2, Calendar, List, FilePlus, Ban, Clock3,
  FileQuestion, User, ClipboardList, FileSpreadsheet, FileDown,
  Filter, ChevronLeft, ChevronRight, ArrowUpDown
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
  user_id: null as string | null, // <-- Fixes TS error when adding a string ID
  client: '',
  client_id: '',                  // <-- Fixes the missing field error
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
  scheduled_date: '',
  product_link: '',
  // NEW FIELDS
  order_date: '',
  invoice_no: '',
  invoice_date: '',
};

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

const STATUS_FILTERS: { id: StatusFilter; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: List },
  { id: 'pending', label: 'Pending', icon: Calendar },
  { id: 'in_progress', label: 'In Progress', icon: Clock3 },
  { id: 'completed', label: 'Completed', icon: Check },
  { id: 'cancelled', label: 'Cancelled', icon: Ban },
];

const ORDER_TABLE_COLUMNS = [
  { label: 'Job ID', key: 'job_id' }, 
  { label: 'Customer', key: 'customer_name' },
  { label: 'Product', key: 'product_name' },
  { label: 'Service', key: 'type_of_service' },
  { label: 'Schedule Date', key: 'scheduled_date' },
  { label: 'Status', key: 'status' },
];

const IMPORT_COLUMNS = [
  'Date*', 'OrderId', 'Customer Name', 'Phone', 'Email', 'Client',
  'Service Company', 'SKU', 'Product Name', 'Qty', 'Image', 'Pincode',
  'City', 'Address', 'Location', 'Landmark', 'State',
  'Remarks / Special Comments', 'Type of Service', 'Schedule Date', 'PRODUCT LINK'
];

const EXCEL_REQUIRED_FIELDS = [
  'Customer Name', 'SKU', 'Product Name', 'PRODUCT LINK',
  'Address', 'City', 'State', 'Pincode', 'Type of Service'
];

const SAMPLE_ROW = {
  'Date*': '2026-07-02',
  'OrderId': 'ORD-SAMPLE-123',
  'Customer Name': 'John Doe (example)',
  'Phone': '9800000000',
  'Email': 'john@example.com',
  'Client': 'Sample Client Ltd',
  'Service Company': 'Sample Service Co',
  'SKU': 'SKU-001',
  'Product Name': 'Sample Furniture Name',
  'Qty': 1,
  'Image': 'https://example.com/img.jpg',
  'Pincode': '110001',
  'City': 'New Delhi',
  'Address': '123, Sample Street',
  'Location': 'Ground Floor',
  'Landmark': 'Near Metro Station',
  'State': 'Delhi',
  'Remarks / Special Comments': 'Handle with care',
  'Type of Service': 'Delivery & Installation',
  'Schedule Date': '2026-07-02',
  'PRODUCT LINK': 'https://example.com/product'
};

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  completed: { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: '✓ Completed' },
  cancelled: { cls: 'bg-red-50 text-red-700 border border-red-200', label: '✕ Cancelled' },
  in_progress: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', label: '● In Progress' },
  pending: { cls: 'bg-amber-50 text-amber-700 border border-amber-200', label: '○ Pending' },
};

const TEMPLATE_PLACEHOLDER_VALUES = new Set([
  'client',
  'auto generate',
  'by instafitcore team',
]);

const isTemplatePlaceholderRow = (row: any): boolean => {
  const candidateFields = [
    'Client', 'SKU', 'Product Name', 'PRODUCT LINK',
    'Address', 'City', 'State', 'Pincode', 'Type of Service',
  ];
  const placeholderHits = candidateFields.filter(f => {
    const v = row[f];
    return v && TEMPLATE_PLACEHOLDER_VALUES.has(v.toString().trim().toLowerCase());
  });
  return placeholderHits.length >= 4;
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

// ── Inner component handling the logic ──
function ClientOrdersContent() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get('status');

  const [clientData, setClientData] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  
  const [uploading, setUploading] = useState(false);
  const [viewOrder, setViewOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [formData, setFormData] = useState({
    ...EMPTY_FORM,
    scheduled_date: new Date().toISOString().split('T')[0],
    order_date: new Date().toISOString().split('T')[0],
    invoice_date: new Date().toISOString().split('T')[0],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read URL parameters from KPI cards
  useEffect(() => {
    if (urlStatus && ['all', 'pending', 'in_progress', 'completed', 'cancelled'].includes(urlStatus)) {
      setStatusFilter(urlStatus as StatusFilter);
      setActiveTab('list');
    }
  }, [urlStatus]);

  useEffect(() => {
    const storedUser = localStorage.getItem('clientUser');
    if (!storedUser) {
      router.push('/');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setClientData(parsedUser);
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (clientData?.id) {
      fetchOrders(clientData.id);
      fetchDropdownData();
    }
  }, [clientData]);

  const fetchOrders = async (clientId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('client_id', clientId) 
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch error:', error);
      setErrorMsg('Failed to load your orders. Please contact support.');
    } else if (data) {
      setOrders(data);
    }
  };

  const fetchDropdownData = async () => {
    const { data: usersData } = await supabase.from('users').select('id, full_name, email, phone');
    if (usersData) setUsersList(usersData);

    const { data: clientsData } = await supabase.from('clients').select('*');
    if (clientsData) setClientsList(clientsData);
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
      const idStr = (row.order_id || '').toString();
      const match = idStr.match(seqPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(5, '0');
    return `${prefix}${nextSeq}`;
  };

  // NEW: Invoice number generator (mirrors admin panel logic)
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

  // Continuous IFSC-CODE-XXXX format based on service type
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

  const handleCreateNewOrder = async () => {
    setEditingOrder(null);
    setErrorMsg('');
    setActiveTab('create');
    
    // Generate both Order ID and Invoice No upfront
    const newOrderId = await generateOrderId();
    const newInvoiceNo = await generateInvoiceNo(); 
    const todayStr = new Date().toISOString().split('T')[0];
    
    setFormData({ 
      ...EMPTY_FORM, 
      scheduled_date: todayStr, 
      job_id: '', // Left blank to be generated exactly on save to ensure accurate code
      order_id: newOrderId,
      client: clientData?.full_name || '',
      client_id: clientData?.id || '',
      order_date: todayStr,
      invoice_no: newInvoiceNo, // <-- Updated: Now pre-fills the generated invoice number
      invoice_date: todayStr,
    });
  };

  const handleCustomerSelect = async (name: string) => {
    const matchedUser = usersList.find(u => u.full_name === name);

    if (matchedUser) {
      setFormData(prev => ({
        ...prev,
        customer_name: name,
        phone: matchedUser.phone || '',
        email: matchedUser.email || '',
        user_id: matchedUser.id,
      }));
    }
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
    if (!clientData?.id) {
      setErrorMsg('You must be logged in to create an order.');
      return;
    }

    const requiredFields = [
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
        client_id: clientData.id, 
        // FIX: Force their name here just in case the form dropdown was skipped
        client: clientData?.full_name || formData.client,
      };

      if (editingOrder) {
        orderDataToSave.status = editingOrder.status;
        orderDataToSave.job_id = formData.job_id || editingOrder.job_id || await generateJobId(formData.type_of_service);
        orderDataToSave.order_id = formData.order_id || editingOrder.order_id;
        orderDataToSave.user_id = editingOrder.user_id;
        // NEW FIELDS
        orderDataToSave.invoice_no = formData.invoice_no || editingOrder.invoice_no || await generateInvoiceNo();
        orderDataToSave.invoice_date = editingOrder.invoice_date || todayStr;

        const { error } = await supabase
          .from('orders')
          .update(orderDataToSave)
          .eq('id', editingOrder.id)
          .eq('client_id', clientData.id); 

        if (error) throw error;
        showSuccess('Order updated successfully!');
      } else {
        orderDataToSave.job_id = await generateJobId(formData.type_of_service);
        orderDataToSave.order_id = formData.order_id || await generateOrderId();
        orderDataToSave.status = 'pending';
        // NEW FIELDS
        orderDataToSave.invoice_no = formData.invoice_no || await generateInvoiceNo();
        orderDataToSave.invoice_date = todayStr;

        const { error } = await supabase.from('orders').insert([orderDataToSave]);
        if (error) throw error;
        showSuccess('Order created successfully!');
      }

      resetForm();
      fetchOrders(clientData.id);
      setActiveTab('list');
    } catch (error: any) {
      if (error.code === '23505') {
        setErrorMsg('Duplicate! An order with this SKU already exists.');
      } else {
        setErrorMsg('Error saving order: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!clientData?.id) return;
    if (confirm('Are you sure you want to delete this order?')) {
      setErrorMsg('');
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id)
        .eq('client_id', clientData.id); 

      if (error) {
        setErrorMsg('Failed to delete: ' + error.message);
      } else {
        showSuccess('Order deleted successfully!');
        fetchOrders(clientData.id);
      }
    }
  };

  const resetForm = () => {
    setEditingOrder(null);
    const todayStr = new Date().toISOString().split('T')[0];
    setFormData({
      ...EMPTY_FORM,
      scheduled_date: todayStr,
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

    setFormData({
      date_str: order.date_str || '',
      order_id: order.order_id || '',
      job_id: resolvedJobId,
      customer_name: order.customer_name || '',
      phone: order.phone || '',
      email: order.email || '',
      user_id: order.user_id || null,
      client: order.client || '',
      client_id: order.client_id || '',
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
      scheduled_date: order.scheduled_date || order.purchase_date || '',
      product_link: order.product_link || '',
      // NEW FIELDS
      order_date: order.order_date || todayStr,
      invoice_no: resolvedInvoiceNo,
      invoice_date: order.invoice_date || todayStr,
    });
    setErrorMsg('');
    setActiveTab('create');
  };

  const downloadSampleFormat = () => {
    try {
      const ws = XLSX.utils.json_to_sheet([SAMPLE_ROW], { header: IMPORT_COLUMNS });
      const cols = IMPORT_COLUMNS.map(k => ({
        wch: Math.min(40, Math.max(12, k.length, String((SAMPLE_ROW as any)[k] || '').length))
      }));
      ws['!cols'] = cols;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sample Format');
      XLSX.writeFile(wb, `INSTAFITCORE_Bulk_Import_Sample.xlsx`);
      showSuccess('Sample format downloaded.');
    } catch (err) {
      setErrorMsg('Failed to download sample format.');
    }
  };

  const processOrders = async (ordersData: any[], firstDataExcelRow: number = 2) => {
    if (!clientData?.id) {
      setErrorMsg('You must be logged in to import orders.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setUploadErrors([]);

    const validationErrors: string[] = [];
    const validOrdersToProcess: any[] = [];

    ordersData.forEach((row, index) => {
      const excelRowNum = firstDataExcelRow + index; 

      if (isTemplatePlaceholderRow(row)) return;

      const hasAnyData = Object.values(row).some(
        v => v !== undefined && v !== null && v.toString().trim() !== ''
      );
      if (!hasAnyData) return;

      const missingFields: string[] = [];
      EXCEL_REQUIRED_FIELDS.forEach(field => {
        const val = row[field];
        if (val === undefined || val === null || val.toString().trim() === '') {
          missingFields.push(field);
        }
      });

      if (missingFields.length > 0) {
        validationErrors.push(`Row ${excelRowNum}: Missing ${missingFields.join(', ')}`);
      } else {
        validOrdersToProcess.push(row);
      }
    });

    if (validationErrors.length > 0) {
      setUploadErrors(validationErrors);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return; 
    }

    if (validOrdersToProcess.length === 0) {
      setErrorMsg('No valid data found. Ensure your file has filled rows.');
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}${mm}${yyyy}`;
    const orderPrefix = `ORDINST-${dateStr}`;
    const invPrefix = `INV-INST-${dateStr}`;
    const todayStr = today.toISOString().split('T')[0];

    const { data: orderData } = await supabase
      .from('orders')
      .select('order_id')
      .like('order_id', `${orderPrefix}%`);
      
    const { data: jobData } = await supabase
      .from('orders')
      .select('job_id')
      .like('job_id', 'IFSC-%');

    // NEW: fetch existing invoice numbers for today's prefix
    const { data: invData } = await supabase
      .from('orders')
      .select('invoice_no')
      .like('invoice_no', `${invPrefix}%`);

    const orderSeqPattern = new RegExp(`^${orderPrefix}(\\d{4,})$`);
    const jobSeqPattern = /^IFSC-[A-Z]{2}-(\d{4,})$/;
    const invSeqPattern = new RegExp(`^${invPrefix}(\\d{4,})$`);

    let currentOrderCount = 0;
    (orderData || []).forEach((row: any) => {
      const match = (row.order_id || '').toString().match(orderSeqPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > currentOrderCount) currentOrderCount = num;
      }
    });

    let currentJobCount = 0;
    (jobData || []).forEach((row: any) => {
      const match = (row.job_id || '').toString().match(jobSeqPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > currentJobCount) currentJobCount = num;
      }
    });

    // NEW: track invoice sequence for this batch
    let currentInvCount = 0;
    (invData || []).forEach((row: any) => {
      const match = (row.invoice_no || '').toString().match(invSeqPattern);
      if (match) currentInvCount = Math.max(currentInvCount, parseInt(match[1], 10));
    });

    const mappedOrders = validOrdersToProcess.map((o) => {
      const matchedUser = usersList.find(u => u.full_name === o['Customer Name']);
      
      let finalOrderId = o['OrderId']?.toString() || '';
      if (!finalOrderId) {
        currentOrderCount++;
        finalOrderId = `${orderPrefix}${String(currentOrderCount).padStart(5, '0')}`;
      }

      currentJobCount++;
      const serviceCode = getServiceCode(o['Type of Service']);
      const finalJobId = `IFSC-${serviceCode}-${String(currentJobCount).padStart(5, '0')}`;

      // NEW: sequential invoice number for this row
      currentInvCount++;
      const finalInvoiceNo = `${invPrefix}${String(currentInvCount).padStart(5, '0')}`;

      return {
        client_id: clientData.id, 
        date_str: excelSerialToDateStr(o['Date*']),
        // FIX: Automatically attach the logged-in client's name so it shows in Admin Panel
        client: clientData?.full_name || o['Client'] || '',
        service_company: o['Service Company'] || '',
        order_id: finalOrderId,
        job_id: finalJobId,
        customer_name: o['Customer Name'] || '',
        phone: o['Phone']?.toString() || matchedUser?.phone || '',
        email: o['Email'] || matchedUser?.email || '',
        user_id: matchedUser?.id || null,
        sku: o['SKU']?.toString() || '',
        product_name: o['Product Name'] || '',
        quantity: Number(o['Qty']) || 1,
        image_url: o['Image'] || '',
        pincode: o['Pincode']?.toString() || '',
        city: o['City'] || '',
        address: o['Address'] || '',
        location_details: o['Location'] || '',
        landmark: o['Landmark'] || '',
        state: o['State'] || '',
        remarks: o['Remarks / Special Comments'] || '',
        type_of_service: o['Type of Service'] || '',
        scheduled_date: excelSerialToDateStr(o['Schedule Date']) || new Date().toISOString().split('T')[0],
        product_link: o['PRODUCT LINK'] || '',
        status: 'pending',
        // NEW FIELDS
        order_date: todayStr,
        invoice_no: finalInvoiceNo,
        invoice_date: todayStr,
      };
    });

    const { error, data } = await supabase
      .from('orders')
      .upsert(mappedOrders, { onConflict: 'order_id,sku', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error('Import error:', error);
      setErrorMsg('Database error during upload: ' + error.message);
    } else {
      const importedCount = data?.length ?? 0;
      const skippedCount = mappedOrders.length - importedCount;
      showSuccess(
        skippedCount > 0
          ? `Import complete! ${importedCount} new order${importedCount !== 1 ? 's' : ''} added, ${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''} skipped.`
          : `Import complete! ${importedCount} order${importedCount !== 1 ? 's' : ''} added.`
      );
      fetchOrders(clientData.id);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, {
          raw: false,
          dateNF: 'yyyy-mm-dd',
          defval: '',
          blankrows: true,
        });
        if (json.length === 0) {
          setErrorMsg('The uploaded file appears to be empty.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
        const headerExcelRow = range.s.r + 1;
        const firstDataExcelRow = headerExcelRow + 1;
        processOrders(json, firstDataExcelRow);
      } catch (err: any) {
        setErrorMsg('Could not read the file. Make sure it is a valid .xlsx or .xls file.');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read the file.');
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
      o.job_id?.toLowerCase().includes(search.toLowerCase()) ||
      o.order_id?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const completedOrders = orders.filter(o => o.status === 'completed').length;

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { label: string; cls: string }> = {
      completed:   { label: '✓ Completed',   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
      cancelled:   { label: '✕ Cancelled',   cls: 'bg-red-50 text-red-700 border border-red-200' },
      in_progress: { label: '● In Progress', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
      pending:     { label: '○ Pending',      cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
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

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 font-medium">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#8ED26B] rounded-full animate-spin mb-3" />
        Loading your workspace...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {clientData?.full_name?.split(' ')[0] || 'Client'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Create, manage, and track all your orders</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
            {uploading && (
              <span className="text-xs text-gray-500 flex items-center gap-1.5 bg-gray-100 px-3 py-2 rounded-lg border border-gray-200">
                <Loader2 size={14} className="animate-spin text-[#8ED26B]" /> Importing…
              </span>
            )}
            <button
              onClick={downloadSampleFormat}
              disabled={uploading}
              title="Download template format"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm bg-white text-gray-500 hover:bg-gray-50 border border-dashed border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileQuestion size={15} className="text-gray-400" />
              Sample Format
            </button>
            <label className="cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <span className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm
                bg-white text-gray-700 hover:bg-gray-50 border border-gray-200
                ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                <Upload size={15} className="text-gray-400" />
                Bulk Import (.xlsx)
              </span>
            </label>
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

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Orders', value: totalOrders, icon: Package, color: 'text-[#8ED26B]', bg: 'bg-[#8ED26B]/10' },
            { label: 'Pending',      value: pendingOrders,   icon: Calendar, color: 'text-amber-600',   bg: 'bg-amber-50' },
            { label: 'Completed',    value: completedOrders, icon: Check,    color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl px-6 py-5 border border-gray-200 shadow-sm flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon size={20} className={color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Bulk Upload Validation Banner ── */}
        {uploadErrors.length > 0 && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={20} className="text-red-600" />
                <h3 className="text-lg font-bold text-red-800">Upload Failed: Missing Required Data</h3>
              </div>
              <button 
                onClick={() => setUploadErrors([])}
                className="text-red-400 hover:text-red-700 transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-red-700 mb-4">
              Your file could not be imported because critical information is missing. Please fix the following rows in your Excel file and try again:
            </p>
            
            <div className="max-h-60 overflow-y-auto bg-white border border-red-100 rounded-xl p-4 shadow-inner text-sm text-gray-700 font-mono">
              <ul className="list-disc pl-5 space-y-1.5">
                {uploadErrors.map((err, i) => (
                  <li key={i} className="text-red-600">
                    <span className="font-semibold text-gray-800">{err.split(':')[0]}:</span> {err.split(':')[1]}
                  </li>
                ))}
              </ul>
            </div>
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
                  onClick={() => { 
                    if (id === 'list') {
                      if (editingOrder) resetForm();
                      setActiveTab('list');
                    } else {
                      if (!editingOrder && activeTab !== 'create') {
                        handleCreateNewOrder();
                      } else {
                        setActiveTab('create');
                      }
                    }
                  }}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap
                    ${activeTab === id
                      ? 'border-[#8ED26B] text-[#8ED26B] bg-[#8ED26B]/5'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                  {id === 'list' && (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold
                      ${activeTab === 'list' ? 'bg-[#8ED26B] text-white' : 'bg-gray-100 text-gray-600'}`}>
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
                    placeholder="Search orders by Job ID, name, email…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition"
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
                          <button
                            onClick={handleCreateNewOrder}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8ED26B] text-white text-sm font-semibold hover:brightness-95 transition"
                          >
                            <Plus size={15} /> Create First Order
                          </button>
                        </td>
                      </tr>
                    ) : filtered.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        {ORDER_TABLE_COLUMNS.map(col => (
                          <td key={col.key} className="px-4 py-3">
                            {col.key === 'status' ? (
                              <StatusBadge status={order.status} />
                            ) : col.key === 'scheduled_date' ? (
                              <span className="text-xs text-gray-700">{formatDate(order[col.key])}</span>
                            ) : col.key === 'customer_name' ? (
                              <div className="text-xs">
                                <p className="font-semibold text-gray-900">
                                  {truncate(order[col.key])}
                                </p>
                                <p className="text-gray-500">{truncate(order.email, 24)}</p>
                              </div>
                            ): (
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
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-[#8ED26B]/10 text-gray-500 hover:text-[#8ED26B] transition"
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
                    <button
                      onClick={handleCreateNewOrder}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#8ED26B] text-white text-sm font-semibold hover:brightness-95 transition"
                    >
                      <Plus size={15} /> Create First Order
                    </button>
                  </div>
                ) : filtered.map((order) => (
                  <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#8ED26B]">{order.job_id || order.order_id}</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {order.customer_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{order.email}</p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <p className="text-xs text-gray-600"><span className="font-semibold">Product:</span> {truncate(order.product_name)}</p>
                      <p className="text-xs text-gray-600"><span className="font-semibold">Service:</span> {truncate(order.type_of_service, 30)}</p>
                      <p className="text-xs text-gray-600"><span className="font-semibold">Date:</span> {formatDate(order.scheduled_date)}</p>
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
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 hover:bg-[#8ED26B]/10 text-gray-600 hover:text-[#8ED26B] text-xs font-semibold transition"
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

              {/* Row count footer */}
              {filtered.length > 0 && (
                <div className="px-4 sm:px-5 py-3 border-t border-gray-100 text-xs text-gray-400 font-medium">
                  Showing {filtered.length} of {orders.length} order{orders.length !== 1 ? 's' : ''}
                </div>
              )}
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
                    {editingOrder ? `Editing: ${editingOrder.customer_name}` : 'New Service Order'}
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

                {/* User Info */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-3 rounded-full bg-[#8ED26B]" /> User Info
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Customer Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter customer name"
                        value={formData.customer_name}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData({ ...formData, customer_name: val });
                          if (val.length > 2) handleCustomerSelect(val);
                        }}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number</label>
                      <input
                        type="text"
                        placeholder="Enter phone number"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                      <input
                        type="email"
                        placeholder="Enter email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </div>
                </section>

                {/* Product Details */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-3 rounded-full bg-[#8ED26B]" /> Product Details
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* NEW: Order Date */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Order Date</label>
                      <input
                        type="date"
                        value={formData.order_date}
                        onChange={e => setFormData({ ...formData, order_date: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Order ID</label>
                      <input
                        type="text"
                        placeholder="Auto-generated (editable)"
                        value={formData.order_id}
                        onChange={e => setFormData({ ...formData, order_id: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400 font-medium"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Auto-generated by default, but you can edit it to match the client's own Order ID format.</p>
                    </div>

                    {/* NEW: Auto Generated Invoice Section */}
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                    />
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Product Name *"
                        value={formData.product_name}
                        onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Product Link *"
                        value={formData.product_link}
                        onChange={e => setFormData({ ...formData, product_link: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </div>
                </section>

                {/* Address */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-3 rounded-full bg-[#8ED26B]" /> Address
                  </p>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Address *"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="City *"
                        value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="State *"
                        value={formData.state}
                        onChange={e => setFormData({ ...formData, state: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Pincode *"
                        value={formData.pincode}
                        onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Landmark (Optional)"
                      value={formData.landmark}
                      onChange={e => setFormData({ ...formData, landmark: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                    />
                    <input
                      type="text"
                      placeholder="Location Details (Optional)"
                      value={formData.location_details}
                      onChange={e => setFormData({ ...formData, location_details: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                    />
                  </div>
                </section>

                {/* Service Details */}
                <section className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-3 rounded-full bg-[#8ED26B]" /> Service Details
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Type of Service *</label>
                      <div className="flex flex-wrap gap-3">
                        {SERVICE_TYPES.map(service => (
                          <label key={service} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                            <input
                              type="checkbox"
                              checked={formData.type_of_service.split(', ').includes(service)}
                              onChange={e => handleServiceTypeChange(service, e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-[#8ED26B] focus:ring-[#8ED26B] transition"
                            />
                            {service}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Schedule Date</label>
                      <input
                        type="date"
                        value={formData.scheduled_date || new Date().toISOString().split('T')[0]}
                        onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <textarea
                        placeholder="Remarks / Special Comments (Optional)"
                        value={formData.remarks}
                        onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#8ED26B] focus:ring-2 focus:ring-[#8ED26B]/20 transition bg-white text-gray-900 placeholder-gray-400 resize-none"
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
                  className="w-full sm:w-auto px-8 py-2.5 rounded-lg text-white text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm bg-[#8ED26B] hover:brightness-95"
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
                <p className="text-xs text-gray-400 mt-0.5 truncate">ID: {viewOrder.id}</p>
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
                  title: 'User Information',
                  fields: [
                    { label: 'User Name',       value: viewOrder.customer_name },
                    { label: 'Email',           value: viewOrder.email },
                    { label: 'Phone',           value: viewOrder.phone },
                  ],
                },
                {
                  title: 'Product Information',
                  fields: [
                    { label: 'Order Date',      value: formatDate(viewOrder.order_date) },
                    { label: 'Order ID',        value: viewOrder.order_id },
                    { label: 'Invoice Date',    value: formatDate(viewOrder.invoice_date) },
                    { label: 'Invoice No',      value: viewOrder.invoice_no },
                    { label: 'SKU',             value: viewOrder.sku },
                    { label: 'Quantity',        value: viewOrder.quantity },
                    { label: 'Product Name',    value: viewOrder.product_name },
                    { label: 'Product Link',    value: viewOrder.product_link },
                  ],
                },
                {
                  title: 'Service Details',
                  fields: [
                    { label: 'Type of Service', value: viewOrder.type_of_service },
                    { label: 'Schedule Date',   value: formatDate(viewOrder.scheduled_date) },
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

              <div className="bg-[#8ED26B]/5 border border-[#8ED26B]/20 rounded-lg p-3">
                <p className="text-xs text-[#8ED26B] font-semibold">Status: <StatusBadge status={viewOrder.status} /></p>
              </div>
            </div>

            <div className="border-t border-gray-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => { startEdit(viewOrder); setViewOrder(null); }}
                className="flex-1 py-2.5 rounded-xl bg-[#8ED26B] text-white text-sm font-bold hover:brightness-95 transition flex items-center justify-center gap-2"
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

      <style jsx global>{`
        html, body {
          color-scheme: light;
        }
      `}</style>
    </div>
  );
}

// ── 3. Main Export wrapped in Suspense (Required by Next.js for URL params) ──
export default function ClientOrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 font-medium">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#8ED26B] rounded-full animate-spin mb-3" />
        Loading module...
      </div>
    }>
      <ClientOrdersContent />
    </Suspense>
  );
}