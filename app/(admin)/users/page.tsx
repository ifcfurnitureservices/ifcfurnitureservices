'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import { Plus, Trash2, Edit2, UserX, UserCheck, Search, Users, Eye, EyeOff, Copy, Share2, Check, X, ChevronDown, ArrowLeft } from 'lucide-react';
import { APP_PAGES } from '@/app/utils/pages';

export default function UsersPage() {
  const supabase = createClient();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    password: string;
    category: string;
    permissions: string[];
  }>({ name: '', email: '', phone: '', password: '', category: '', permissions: [] });
  
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedId, setCopiedId] = useState<any>(null);
  const [shareUser, setShareUser] = useState<any>(null);
  // Track plain-text passwords per user (only available after creation in this session)
  const [sessionPasswords, setSessionPasswords] = useState<Record<string, string>>({});

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setUsers(data);

      // Load passwords for copy/share
      const passwords: Record<string, string> = {};

      data.forEach((user: any) => {
        passwords[user.id] = user.password_hash || '';
      });

      setSessionPasswords(passwords);
    }
  };

  const handleSave = async () => {
    // Check for required fields, including category
    if (!formData.name || !formData.email) { setErrorMsg('Name and email are required.'); return; }
    if (!formData.category) { setErrorMsg('Category is required.'); return; }
    if (!editingUser && !formData.password) { setErrorMsg('Password is required.'); return; }
    
    setSaving(true);
    setErrorMsg('');

    if (editingUser) {
      const updates: any = { 
        full_name: formData.name, 
        email: formData.email, 
        phone: formData.phone,
        category: formData.category,
        permissions: formData.permissions
      };
      if (formData.password) {
        updates.password_hash = formData.password;
        setSessionPasswords(prev => ({ ...prev, [editingUser.id]: formData.password }));
      }
      const { error } = await supabase.from('users').update(updates).eq('id', editingUser.id);
      if (error) { setErrorMsg(error.message); setSaving(false); return; }
      setSuccessMsg('User updated successfully!');
    } else {
      const { data, error } = await supabase.from('users').insert([{ 
        full_name: formData.name, 
        email: formData.email, 
        phone: formData.phone, 
        password_hash: formData.password,
        category: formData.category,
        permissions: formData.permissions
      }]).select();
      if (error) { setErrorMsg(error.message); setSaving(false); return; }
      if (data?.[0]) setSessionPasswords(prev => ({ ...prev, [data[0].id]: formData.password }));
      setSuccessMsg('User created successfully!');
    }
    setSaving(false);
    resetForm();
    fetchUsers();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('users').delete().eq('id', id);
    fetchUsers();
  };

  const handleToggleStatus = async (user: any) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    await supabase.from('users').update({ status: newStatus }).eq('id', user.id);
    fetchUsers();
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', phone: '', password: '', category: '', permissions: [] });
    setErrorMsg('');
    setShowPassword(false);
  };

  const startEdit = (user: any) => {
    setEditingUser(user);
    setFormData({ 
      name: user.full_name, 
      email: user.email, 
      phone: user.phone || '', 
      password: '',
      category: user.category || '',
      permissions: user.permissions || []
    });
    setErrorMsg('');
    setShowPassword(false);
  };

  const handleCopy = (user: any) => {
    const text = `Name: ${user.full_name}
Email: ${user.email}
Phone: ${user.phone || 'N/A'}
Category: ${user.category?.charAt(0).toUpperCase() + user.category?.slice(1) || 'N/A'}
Password: ${user.password_hash}`;

    navigator.clipboard.writeText(text);

    setCopiedId(user.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = (user: any) => {
    setShareUser(user);
  };

  const toggleFormPermission = (key: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key]
    }));
  };

  const getShareText = (user: any) => {
    return `Hello ${user.full_name},

Your INSTAFITCORE login credentials:

 Email: ${user.email}
 Phone: ${user.phone || 'N/A'}
 Category: ${user.category?.charAt(0).toUpperCase() + user.category?.slice(1) || 'N/A'}
 Password: ${user.password_hash}

Please keep these credentials safe.

— INSTAFITCORE Team`;
  };

  const doShare = async (user: any) => {
    const text = getShareText(user);
    if (navigator.share) {
      await navigator.share({ title: 'INSTAFITCORE Credentials', text });
    } else {
      navigator.clipboard.writeText(text);
    }
    setShareUser(null);
  };

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = users.filter(u => u.status === 'active').length;

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
          <h1 className="text-2xl font-bold text-gray-900">User Credentials</h1>
          <p className="text-sm text-gray-400 mt-1">Manage and monitor all registered users</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Users', value: users.length, color: '#8ED26B' },
          { label: 'Active', value: activeCount, color: '#34d399' },
          { label: 'Inactive', value: users.length - activeCount, color: '#f87171' },
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
        {/* LEFT — User List */}
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
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400 text-sm">No users found.</td></tr>
                ) : filtered.map((user) => (
                  <tr key={user.id} className={`border-t border-gray-50 transition-all ${editingUser?.id === user.id ? 'bg-[#f0fce8]' : 'hover:bg-gray-50'}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#8ED26B' }}>
                          {user.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{user.full_name}</p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-600 capitalize">
                        {user.category || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${user.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-red-400'}`} />
                        {user.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => startEdit(user)} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-blue-100 hover:text-blue-600 text-gray-400 transition">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleToggleStatus(user)} title={user.status === 'active' ? 'Deactivate' : 'Activate'} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-yellow-100 hover:text-yellow-600 text-gray-400 transition">
                          {user.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button onClick={() => handleCopy(user)} title="Copy credentials" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-green-100 text-gray-400 transition" style={{ color: copiedId === user.id ? '#8ED26B' : undefined }}>
                          {copiedId === user.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button onClick={() => handleShare(user)} title="Share credentials" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-purple-500 text-gray-400 transition">
                          <Share2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(user.id)} title="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-500 text-gray-400 transition">
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
                <h2 className="text-base font-bold text-gray-800">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editingUser ? `Editing: ${editingUser.full_name}` : 'Fill in details to create'}</p>
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
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email Address</label>
                <input type="email" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder="Enter email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phone Number</label>
                <input type="tel" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder="Enter phone number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Password {editingUser && <span className="ml-1 font-normal text-gray-400">(leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className="w-full px-4 py-3 pr-11 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-900 placeholder-gray-400" placeholder={editingUser ? 'Enter new password' : 'Enter password'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* MANDATORY CATEGORY DROPDOWN */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Category</label>
                <select 
                  className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition ${!formData.category ? 'text-gray-400' : 'text-gray-900'}`}
                  value={formData.category} 
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="" disabled>Select</option>
                  <option value="finance">Finance</option>
                  <option value="allotment">Allotment</option>
                  <option value="investor">Investor</option>
                  <option value="dealer">Dealer</option>
                </select>
              </div>

              {/* CUSTOM PAGE PERMISSIONS — list with small select boxes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-500">In-house users Permissions</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, permissions: APP_PAGES.map(p => p.key) }))}
                      className="text-[11px] font-semibold text-[#6ab84e] hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-gray-300 text-[11px]">|</span>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, permissions: [] }))}
                      className="text-[11px] font-semibold text-gray-400 hover:text-red-500 hover:underline"
                    >
                      Deselect all
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {APP_PAGES.map(page => {
                    const active = formData.permissions.includes(page.key);
                    return (
                      <button
                        key={page.key}
                        type="button"
                        onClick={() => toggleFormPermission(page.key)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-[#f4fced]' : 'hover:bg-gray-50'}`}
                      >
                        <span
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                            active ? 'border-transparent' : 'border-gray-300 bg-white'
                          }`}
                          style={active ? { backgroundColor: '#8ED26B' } : undefined}
                        >
                          {active && <Check size={11} className="text-white" strokeWidth={3} />}
                        </span>
                        <span className={`text-sm ${active ? 'text-gray-800 font-semibold' : 'text-gray-600'}`}>
                          {page.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-gray-400 mt-1.5">
                  {formData.permissions.length === 0
                    ? 'No pages selected'
                    : formData.permissions.length === APP_PAGES.length
                      ? 'All pages selected'
                      : `${formData.permissions.length} of ${APP_PAGES.length} pages selected`}
                </p>
              </div>

              <button onClick={handleSave} disabled={saving} className="w-full py-3 mt-2 rounded-xl text-white text-sm font-bold transition disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#8ED26B' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#76c55d')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}>
                {saving ? 'Saving...' : editingUser ? 'Update User' : <><Plus size={16} /> Create User</>}
              </button>
              {editingUser && (
                <button onClick={resetForm} className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition">Cancel Edit</button>
              )}
            </div>
          </div>

          <div className="mt-4 px-4 py-3 rounded-xl border text-xs text-gray-400" style={{ borderColor: '#8ED26B33', backgroundColor: '#f4fced' }}>
            <span style={{ color: '#6ab84e' }} className="font-semibold">Tip:</span> Use <Copy size={10} className="inline mx-0.5" /> to copy or <Share2 size={10} className="inline mx-0.5" /> to share credentials.
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {shareUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-800">Share Credentials</h2>
              <button onClick={() => setShareUser(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-400 transition"><X size={16} /></button>
            </div>

            {/* Preview card */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: '#8ED26B' }}>
                  {shareUser.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{shareUser.full_name}</p>
                  <p className="text-xs text-gray-400">INSTAFITCORE User</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Email</span>
                  <span className="text-xs font-semibold text-gray-700">{shareUser.email}</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Phone</span>
                  <span className="text-xs font-semibold text-gray-700">{shareUser.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Category</span>
                  <span className="text-xs font-semibold text-gray-700 capitalize">{shareUser.category || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Password</span>
                  <span className="text-xs font-semibold text-gray-700">{sessionPasswords[shareUser.id] || '(not available)'}</span>
                </div>
              </div>
            </div>

            {/* Share options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { navigator.clipboard.writeText(getShareText(shareUser)); setShareUser(null); }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 text-gray-600 transition"
              >
                <Copy size={15} /> Copy Text
              </button>
              <button
                onClick={() => doShare(shareUser)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#8ED26B' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#76c55d')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}
              >
                <Share2 size={15} /> Share
              </button>
            </div>

            {!sessionPasswords[shareUser.id] && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mt-3 border border-amber-100">
                ⚠ Password not available for existing users. Edit the user and set a new password to share it.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}