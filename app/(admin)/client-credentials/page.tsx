'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { Plus, Trash2, Edit2, UserX, UserCheck, Search, Users, Eye, EyeOff, Copy, Share2, Check, X, Briefcase, Building, MapPin, RefreshCw, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const SERVICES = [
  'Delivery',
  'Delivery & Installation',
  'Furniture Installation',
  'Furniture Dismantling',
  'Repair & Modification',
  'Reverse Pickup',
  'Store Display Setup'
];

export default function ClientsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    service_type: [] as string[],
    client_id: '',
    company_name: '',
    company_address: '',
    pincode: ''
  });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedId, setCopiedId] = useState<any>(null);
  const [shareClient, setShareClient] = useState<any>(null);
  const [sessionPasswords, setSessionPasswords] = useState<Record<string, string>>({});
  const [nextSeq, setNextSeq] = useState<number>(0);

  useEffect(() => { 
    fetchClients(); 
    fetchNextSequence();
  }, []);

  // Auto-generate Client ID when company name or full name changes (only for new clients)
  useEffect(() => {
    if (!editingClient && nextSeq > 0) {
      const prefixSource = formData.company_name?.trim() || formData.name?.trim() || 'CLI';
      const prefix = prefixSource.substring(0, 3).toUpperCase().padEnd(3, 'X');
      const seqStr = String(nextSeq).padStart(4, '0');
      setFormData(prev => ({ ...prev, client_id: `${prefix}${seqStr}` }));
    }
  }, [formData.company_name, formData.name, nextSeq, editingClient]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setClients(data);

      const passwords: Record<string, string> = {};
      data.forEach((client: any) => {
        passwords[client.id] = client.password_hash || '';
      });
      setSessionPasswords(passwords);
    }
  };

  const fetchNextSequence = async () => {
    const { count, error } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });

    const nextSequence = error || count === null ? 1 : count + 1;
    setNextSeq(nextSequence);
  };

  const handleServiceCheckboxChange = (service: string) => {
    setFormData(prev => {
      const currentServices = prev.service_type || [];
      const isChecked = currentServices.includes(service);
      const updatedServices = isChecked 
        ? currentServices.filter(s => s !== service)
        : [...currentServices, service];
      return { ...prev, service_type: updatedServices };
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) { setErrorMsg('Name and email are required.'); return; }
    if (!editingClient && !formData.password) { setErrorMsg('Password is required.'); return; }
    setSaving(true);
    setErrorMsg('');

    const payload: any = { 
      full_name: formData.name, 
      email: formData.email,
      service_type: formData.service_type,
      client_id: formData.client_id || null,
      company_name: formData.company_name || null,
      company_address: formData.company_address || null,
      pincode: formData.pincode || null
    };

    if (editingClient) {
      if (formData.password) {
        payload.password_hash = formData.password;
        setSessionPasswords(prev => ({ ...prev, [editingClient.id]: formData.password }));
      }
      const { error } = await supabase.from('clients').update(payload).eq('id', editingClient.id);
      if (error) { setErrorMsg(error.message); setSaving(false); return; }
      setSuccessMsg('Client updated successfully!');
    } else {
      payload.password_hash = formData.password;
      const { data, error } = await supabase.from('clients').insert([payload]).select();
      if (error) { setErrorMsg(error.message); setSaving(false); return; }
      if (data?.[0]) setSessionPasswords(prev => ({ ...prev, [data[0].id]: formData.password }));
      setSuccessMsg('Client created successfully!');
    }
    setSaving(false);
    resetForm();
    fetchClients();
    fetchNextSequence(); // Update sequence for the next creation
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDelete = async (id: string) => {
    if(confirm('Are you sure you want to delete this client?')) {
        await supabase.from('clients').delete().eq('id', id);
        fetchClients();
    }
  };

  const handleToggleStatus = async (client: any) => {
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    await supabase.from('clients').update({ status: newStatus }).eq('id', client.id);
    fetchClients();
  };

  const resetForm = () => {
    setEditingClient(null);
    setFormData({ name: '', email: '', password: '', service_type: [], client_id: '', company_name: '', company_address: '', pincode: '' });
    setErrorMsg('');
    setShowPassword(false);
    fetchNextSequence();
  };

  const startEdit = (client: any) => {
    setEditingClient(client);
    setFormData({ 
      name: client.full_name, 
      email: client.email, 
      password: '',
      service_type: Array.isArray(client.service_type) ? client.service_type : [],
      client_id: client.client_id || '',
      company_name: client.company_name || '',
      company_address: client.company_address || '',
      pincode: client.pincode || ''
    });
    setErrorMsg('');
    setShowPassword(false);
  };

  const handleCopy = (client: any) => {
    const servicesText = Array.isArray(client.service_type) ? client.service_type.join(', ') : 'N/A';
    const text = `Name: ${client.full_name}\nCompany: ${client.company_name || 'N/A'}\nAddress: ${client.company_address || 'N/A'}\nPincode: ${client.pincode || 'N/A'}\nClient ID: ${client.client_id || 'N/A'}\nEmail: ${client.email}\nServices: ${servicesText}\nPassword: ${client.password_hash}`;
    navigator.clipboard.writeText(text);
    setCopiedId(client.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = (client: any) => {
    setShareClient(client);
  };

  const getShareText = (client: any) => {
    const servicesText = Array.isArray(client.service_type) ? client.service_type.join(', ') : 'N/A';
    return `Hello ${client.full_name},

Your INSTAFITCORE client login credentials:

 Company: ${client.company_name || 'N/A'}
 Address: ${client.company_address || 'N/A'}
 Pincode: ${client.pincode || 'N/A'}
 Client ID: ${client.client_id || 'N/A'}
 Services: ${servicesText}
 Email: ${client.email}
 Password: ${client.password_hash}

Please keep these credentials safe.

— INSTAFITCORE Team`;
  };

  const doShare = async (client: any) => {
    const text = getShareText(client);
    if (navigator.share) {
      await navigator.share({ title: 'INSTAFITCORE Client Credentials', text });
    } else {
      navigator.clipboard.writeText(text);
    }
    setShareClient(null);
  };

  const filtered = clients.filter(c => {
    const searchLower = search.toLowerCase();
    const servicesArray = Array.isArray(c.service_type) ? c.service_type : [];
    
    return (
      c.full_name?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower) ||
      c.client_id?.toLowerCase().includes(searchLower) ||
      c.company_name?.toLowerCase().includes(searchLower) ||
      c.company_address?.toLowerCase().includes(searchLower) ||
      c.pincode?.toLowerCase().includes(searchLower) ||
      servicesArray.some((s: string) => s.toLowerCase().includes(searchLower))
    );
  });

  const activeCount = clients.filter(c => c.status === 'active').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          title="Go back"
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white transition shrink-0"
          style={{ backgroundColor: '#8ED26B' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#76c55d')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Credentials</h1>
          <p className="text-sm text-gray-400 mt-1">Manage and monitor all registered clients and their services</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Clients', value: clients.length, color: '#8ED26B' },
          { label: 'Active', value: activeCount, color: '#34d399' },
          { label: 'Inactive', value: clients.length - activeCount, color: '#f87171' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: stat.color + '22' }}>
              <Users size={18} style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-6 items-start">
        {/* LEFT — Client List */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, company, address, pincode, client id..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Client & Assignment</th>
                  <th className="px-5 py-3">Services</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400 text-sm">No clients found.</td></tr>
                ) : filtered.map((client) => (
                  <tr key={client.id} className={`border-t border-gray-50 transition-all ${editingClient?.id === client.id ? 'bg-[#f0fce8]' : 'hover:bg-gray-50'}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#8ED26B' }}>
                          {client.full_name?.charAt(0).toUpperCase() || 'C'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{client.full_name}</p>
                          <p className="text-xs text-gray-400 mb-1">{client.email}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1 max-w-sm">
                            {client.company_name && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                                <Building size={10} /> {client.company_name}
                              </span>
                            )}
                            {client.client_id && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">
                                <Briefcase size={10} /> {client.client_id}
                              </span>
                            )}
                            {(client.company_address || client.pincode) && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium truncate max-w-[200px]" title={`${client.company_address || ''} ${client.pincode || ''}`}>
                                <MapPin size={10} /> {client.company_address || ''} {client.pincode ? `(${client.pincode})` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 max-w-[180px]">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(client.service_type) && client.service_type.length > 0 ? (
                          client.service_type.map((srv: string) => (
                            <span key={srv} className="bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded-full font-medium">
                              {srv}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-xs">None assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${client.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${client.status === 'active' ? 'bg-green-500' : 'bg-red-400'}`} />
                        {client.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => startEdit(client)} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-blue-100 hover:text-blue-600 text-gray-400 transition">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleToggleStatus(client)} title={client.status === 'active' ? 'Deactivate' : 'Activate'} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-yellow-100 hover:text-yellow-600 text-gray-400 transition">
                          {client.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button onClick={() => handleCopy(client)} title="Copy credentials" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-green-100 text-gray-400 transition" style={{ color: copiedId === client.id ? '#8ED26B' : undefined }}>
                          {copiedId === client.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button onClick={() => handleShare(client)} title="Share credentials" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-purple-500 text-gray-400 transition">
                          <Share2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(client.id)} title="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-500 text-gray-400 transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT — Create / Edit Panel */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-gray-800">{editingClient ? 'Edit Client' : 'Add New Client'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editingClient ? `Editing: ${editingClient.full_name}` : 'Fill in details to create'}</p>
              </div>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#8ED26B' }} />
            </div>

            {successMsg && (
              <div className="mb-4 px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700 font-medium">✓ {successMsg}</div>
            )}
            {errorMsg && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{errorMsg}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Full Name</label>
                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder="Enter full name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Company Name</label>
                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder="Enter company name" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} />
              </div>
              
              {/* Split Address Input Fields */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Company Address</label>
                <textarea rows={2} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400 resize-none" placeholder="Street, Building, Area details..." value={formData.company_address} onChange={e => setFormData({ ...formData, company_address: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Pincode</label>
                <input type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder="e.g. 560001" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-500">Client ID (Auto-Generated)</label>
                  {!editingClient && (
                    <button type="button" onClick={fetchNextSequence} title="Recalculate sequence" className="text-gray-400 hover:text-gray-600 transition flex items-center gap-0.5 text-[10px]">
                      <RefreshCw size={10} /> Reset Auto
                    </button>
                  )}
                </div>
                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400 font-mono text-xs tracking-wider" placeholder="COM0001" value={formData.client_id} onChange={e => setFormData({ ...formData, client_id: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email Address</label>
                <input type="email" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder="Enter email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Password {editingClient && <span className="ml-1 font-normal text-gray-400">(leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className="w-full px-4 py-3 pr-11 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder={editingClient ? 'Enter new password' : 'Enter password'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Service Type Checkboxes */}
              <div className="pt-2 pb-1 border-t border-gray-100 mt-2">
                <label className="block text-xs font-semibold text-gray-500 mb-2">Assign Service Type(s)</label>
                <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                  {SERVICES.map((service) => (
                    <label key={service} className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer hover:text-gray-900 transition">
                      <input
                        type="checkbox"
                        value={service}
                        checked={(formData.service_type || []).includes(service)}
                        onChange={() => handleServiceCheckboxChange(service)}
                        className="w-3.5 h-3.5 accent-[#8ED26B] rounded cursor-pointer"
                      />
                      {service}
                    </label>
                  ))}
                </div>
              </div>

              <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl text-white text-sm font-bold transition disabled:opacity-60 flex items-center justify-center gap-2 mt-4" style={{ backgroundColor: '#8ED26B' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#76c55d')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}>
                {saving ? 'Saving...' : editingClient ? 'Update Client' : <><Plus size={16} /> Create Client</>}
              </button>
              {editingClient && (
                <button onClick={resetForm} className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition">Cancel Edit</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {shareClient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-800">Share Credentials</h2>
              <button onClick={() => setShareClient(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-400 transition"><X size={16} /></button>
            </div>

            {/* Preview card */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: '#8ED26B' }}>
                  {shareClient.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{shareClient.full_name}</p>
                  <p className="text-xs text-gray-500">{shareClient.company_name || 'INSTAFITCORE Client'}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Client ID</span>
                  <span className="text-xs font-semibold text-gray-700 font-mono">{shareClient.client_id || 'N/A'}</span>
                </div>
                <div className="flex flex-col bg-white rounded-xl px-3 py-2 border border-gray-100 text-left">
                  <span className="text-xs text-gray-400">Address Details</span>
                  <span className="text-xs font-semibold text-gray-700 mt-0.5 line-clamp-2">{shareClient.company_address || 'N/A'}</span>
                  {shareClient.pincode && <span className="text-[11px] font-medium text-gray-500 mt-0.5 font-mono">Pincode: {shareClient.pincode}</span>}
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Email</span>
                  <span className="text-xs font-semibold text-gray-700">{shareClient.email}</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100 text-right">
                  <span className="text-xs text-gray-400 text-left">Services</span>
                  <span className="text-xs font-semibold text-gray-700 max-w-[150px] truncate block">
                    {Array.isArray(shareClient.service_type) ? shareClient.service_type.join(', ') : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Password</span>
                  <span className="text-xs font-semibold text-gray-700">{sessionPasswords[shareClient.id] || '(not available)'}</span>
                </div>
              </div>
            </div>

            {/* Share options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { navigator.clipboard.writeText(getShareText(shareClient)); setShareClient(null); }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 text-gray-600 transition"
              >
                <Copy size={15} /> Copy Text
              </button>
              <button
                onClick={() => doShare(shareClient)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#8ED26B' }}
              >
                <Share2 size={15} /> Share
              </button>
            </div>

            {!sessionPasswords[shareClient.id] && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mt-3 border border-amber-100">
                ⚠ Password not available for existing clients. Edit the client and set a new password to share it.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}