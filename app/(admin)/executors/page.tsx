'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { Plus, Trash2, Edit2, UserX, UserCheck, Search, Users, Eye, EyeOff, Copy, Share2, Check, X, ChevronDown, ArrowLeft } from 'lucide-react';

export default function ExecutorsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [executors, setExecutors] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editingExecutor, setEditingExecutor] = useState<any>(null);

  // Set role to empty string initially to force selection
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', role: '' });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedId, setCopiedId] = useState<any>(null);
  const [shareExecutor, setShareExecutor] = useState<any>(null);
  // Track plain-text passwords per executor (only available after creation in this session)
  const [sessionPasswords, setSessionPasswords] = useState<Record<string, string>>({});

  useEffect(() => { fetchExecutors(); }, []);

  const fetchExecutors = async () => {
    const { data } = await supabase
      .from('executors')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setExecutors(data);

      // Load passwords for copy/share
      const passwords: Record<string, string> = {};
      data.forEach((executor: any) => {
        passwords[executor.id] = executor.password_hash || '';
      });
      setSessionPasswords(passwords);
    }
  };

  const handleSave = async () => {
    // Add validation for the mandatory name, phone, and role fields
    if (!formData.name || !formData.phone) { setErrorMsg('Name and phone number are required.'); return; }
    if (!formData.role) { setErrorMsg('Please select a role.'); return; }
    if (!editingExecutor && !formData.password) { setErrorMsg('Password is required.'); return; }
    setSaving(true);
    setErrorMsg('');

    if (editingExecutor) {
      const updates: any = {
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role
      };
      if (formData.password) {
        updates.password_hash = formData.password;
        setSessionPasswords(prev => ({ ...prev, [editingExecutor.id]: formData.password }));
      }
      const { error } = await supabase.from('executors').update(updates).eq('id', editingExecutor.id);
      if (error) { setErrorMsg(error.message); setSaving(false); return; }
      setSuccessMsg('Executor updated successfully!');
    } else {
      const { data, error } = await supabase.from('executors').insert([{
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password_hash: formData.password,
        role: formData.role
      }]).select();
      if (error) { setErrorMsg(error.message); setSaving(false); return; }
      if (data?.[0]) setSessionPasswords(prev => ({ ...prev, [data[0].id]: formData.password }));
      setSuccessMsg('Executor created successfully!');
    }
    setSaving(false);
    resetForm();
    fetchExecutors();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('executors').delete().eq('id', id);
    fetchExecutors();
  };

  const handleToggleStatus = async (executor: any) => {
    const newStatus = executor.status === 'active' ? 'inactive' : 'active';
    await supabase.from('executors').update({ status: newStatus }).eq('id', executor.id);
    fetchExecutors();
  };

  const resetForm = () => {
    setEditingExecutor(null);
    setFormData({ name: '', email: '', phone: '', password: '', role: '' });
    setErrorMsg('');
    setShowPassword(false);
  };

  const startEdit = (executor: any) => {
    setEditingExecutor(executor);
    setFormData({
      name: executor.full_name,
      email: executor.email,
      phone: executor.phone || '',
      password: '',
      role: executor.role || ''
    });
    setErrorMsg('');
    setShowPassword(false);
  };

  const handleCopy = (executor: any) => {
    const text = `Name: ${executor.full_name}
Role: ${executor.role || 'N/A'}
Email: ${executor.email}
Phone: ${executor.phone || 'N/A'}
Password: ${executor.password_hash}`;

    navigator.clipboard.writeText(text);
    setCopiedId(executor.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = (executor: any) => {
    setShareExecutor(executor);
  };

  const getShareText = (executor: any) => {
    return `Hello ${executor.full_name},

Your INSTAFITCORE Executor login credentials:

 Role: ${executor.role || 'N/A'}
 Email: ${executor.email}
 Phone: ${executor.phone || 'N/A'}
 Password: ${executor.password_hash}

Please keep these credentials safe.

— INSTAFITCORE Team`;
  };

  const doShare = async (executor: any) => {
    const text = getShareText(executor);
    if (navigator.share) {
      await navigator.share({ title: 'INSTAFITCORE Executor Credentials', text });
    } else {
      navigator.clipboard.writeText(text);
    }
    setShareExecutor(null);
  };

  const filtered = executors.filter(e =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = executors.filter(e => e.status === 'active').length;

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
          <h1 className="text-2xl font-bold text-gray-900">Executor Credentials</h1>
          <p className="text-sm text-gray-400 mt-1">Manage and monitor all registered users</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Executors', value: executors.length, color: '#8ED26B' },
          { label: 'Active Executors', value: activeCount, color: '#34d399' },
          { label: 'Inactive Executors', value: executors.length - activeCount, color: '#f87171' },
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
        {/* LEFT — Executor List */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
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
                  <th className="px-5 py-3">Executor</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400 text-sm">No executors found.</td></tr>
                ) : filtered.map((executor) => (
                  <tr key={executor.id} className={`border-t border-gray-50 transition-all ${editingExecutor?.id === executor.id ? 'bg-[#f0fce8]' : 'hover:bg-gray-50'}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#8ED26B' }}>
                          {executor.full_name?.charAt(0).toUpperCase() || 'E'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{executor.full_name}</p>
                          <p className="text-xs text-gray-400">{executor.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200/60">
                        {executor.role || 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${executor.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${executor.status === 'active' ? 'bg-green-500' : 'bg-red-400'}`} />
                        {executor.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => startEdit(executor)} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-blue-100 hover:text-blue-600 text-gray-400 transition">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleToggleStatus(executor)} title={executor.status === 'active' ? 'Deactivate' : 'Activate'} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-yellow-100 hover:text-yellow-600 text-gray-400 transition">
                          {executor.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button onClick={() => handleCopy(executor)} title="Copy credentials" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-green-100 text-gray-400 transition" style={{ color: copiedId === executor.id ? '#8ED26B' : undefined }}>
                          {copiedId === executor.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button onClick={() => handleShare(executor)} title="Share credentials" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-purple-500 text-gray-400 transition">
                          <Share2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(executor.id)} title="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-500 text-gray-400 transition">
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
                <h2 className="text-base font-bold text-gray-800">{editingExecutor ? 'Edit Executor' : 'Add New Executor'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editingExecutor ? `Editing: ${editingExecutor.full_name}` : 'Fill in details to create'}</p>
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
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Full Name <span className="text-red-400">*</span></label>
                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder="Enter full name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email Address <span className="text-gray-400 font-normal">(Optional)</span></label>
                <input type="email" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder="Enter email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phone Number <span className="text-red-400">*</span></label>
                <input type="tel" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder="Enter phone number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Role <span className="text-red-400">*</span></label>
                <div className="relative">
                  <select
                    className={`w-full px-4 py-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition appearance-none cursor-pointer ${!formData.role ? 'text-gray-400' : 'text-gray-900'}`}
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="" disabled>Select Role</option>
                    <option value="Delivery" className="text-gray-900">Delivery</option>
                    <option value="Carpenter" className="text-gray-900">Carpenter</option>
                    <option value="Technician" className="text-gray-900">Technician</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Password {!editingExecutor && <span className="text-red-400">*</span>}
                  {editingExecutor && <span className="ml-1 font-normal text-gray-400">(leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className="w-full px-4 py-3 pr-11 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder={editingExecutor ? 'Enter new password' : 'Enter password'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl text-white text-sm font-bold transition disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#8ED26B' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#76c55d')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}>
                {saving ? 'Saving...' : editingExecutor ? 'Update Executor' : <><Plus size={16} /> Create Executor</>}
              </button>
              {editingExecutor && (
                <button onClick={resetForm} className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition">Cancel Edit</button>
              )}
            </div>
          </div>

          <div className="mt-4 px-4 py-3 rounded-xl border text-xs text-gray-400" style={{ borderColor: '#8ED26B33', backgroundColor: '#f4fced' }}>
            <span style={{ color: '#6ab84e' }} className="font-semibold">Tip:</span> Use <Copy size={10} className="inline mx-0.5" /> to copy or <Share2 size={10} className="inline mx-0.5" /> to share credentials after creating an executor.
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {shareExecutor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-800">Share Credentials</h2>
              <button onClick={() => setShareExecutor(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-400 transition"><X size={16} /></button>
            </div>

            {/* Preview card */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: '#8ED26B' }}>
                  {shareExecutor.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{shareExecutor.full_name}</p>
                  <p className="text-xs text-gray-400">Role: {shareExecutor.role || 'N/A'}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Email</span>
                  <span className="text-xs font-semibold text-gray-700">{shareExecutor.email}</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Phone</span>
                  <span className="text-xs font-semibold text-gray-700">{shareExecutor.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Password</span>
                  <span className="text-xs font-semibold text-gray-700">{sessionPasswords[shareExecutor.id] || '(not available)'}</span>
                </div>
              </div>
            </div>

            {/* Share options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { navigator.clipboard.writeText(getShareText(shareExecutor)); setShareExecutor(null); }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 text-gray-600 transition"
              >
                <Copy size={15} /> Copy Text
              </button>
              <button
                onClick={() => doShare(shareExecutor)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#8ED26B' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#76c55d')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}
              >
                <Share2 size={15} /> Share
              </button>
            </div>

            {!sessionPasswords[shareExecutor.id] && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mt-3 border border-amber-100">
                ⚠ Password not available for existing executors. Edit the executor and set a new password to share it.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}