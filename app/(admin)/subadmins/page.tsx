'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { Plus, Trash2, Edit2, Search, ShieldCheck, Eye, EyeOff, Copy, Share2, Check, X } from 'lucide-react';

export default function SubAdminsPage() {
  const supabase = createClient();
  const [subAdmins, setSubAdmins] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '', role: 'admin' });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedId, setCopiedId] = useState<any>(null);
  const [shareUser, setShareUser] = useState<any>(null);
  const [sessionPasswords, setSessionPasswords] = useState<Record<string, string>>({});

  useEffect(() => { fetchSubAdmins(); }, []);

const fetchSubAdmins = async () => {
  const { data } = await supabase
    .from('Admin_Subadmin')
    .select('*')
    .order('created_at', { ascending: false });

  if (data) {
    setSubAdmins(data);

    // Load passwords for copy/share
    const passwords: Record<string, string> = {};

    data.forEach((user: any) => {
      passwords[user.id] = user.password_hash || '';
    });

    setSessionPasswords(passwords);
  }
};

  const handleSave = async () => {
    if (!formData.full_name || !formData.email) { setErrorMsg('Name and email are required.'); return; }
    if (!editingUser && !formData.password) { setErrorMsg('Password is required.'); return; }
    setSaving(true);
    setErrorMsg('');

    if (editingUser) {
      const updates: any = { full_name: formData.full_name, email: formData.email, role: formData.role };
      if (formData.password) {
        updates.password_hash = formData.password;
        setSessionPasswords(prev => ({ ...prev, [editingUser.id]: formData.password }));
      }
      const { error } = await supabase.from('Admin_Subadmin').update(updates).eq('id', editingUser.id);
      if (error) { setErrorMsg(error.message); setSaving(false); return; }
      setSuccessMsg('Sub-admin updated successfully!');
    } else {
      const { data, error } = await supabase.from('Admin_Subadmin').insert([{ full_name: formData.full_name, email: formData.email, password_hash: formData.password, role: formData.role }]).select();
      if (error) { setErrorMsg(error.message); setSaving(false); return; }
      if (data?.[0]) setSessionPasswords(prev => ({ ...prev, [data[0].id]: formData.password }));
      setSuccessMsg('Sub-admin created successfully!');
    }

    setSaving(false);
    resetForm();
    fetchSubAdmins();
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('Admin_Subadmin').delete().eq('id', id);
    fetchSubAdmins();
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({ full_name: '', email: '', password: '', role: 'admin' });
    setErrorMsg('');
    setShowPassword(false);
  };

  const startEdit = (user: any) => {
    setEditingUser(user);
    setFormData({ full_name: user.full_name || '', email: user.email, password: '', role: user.role || 'admin' });
    setErrorMsg('');
    setShowPassword(false);
  };

const handleCopy = (user: any) => {
  const text = `Name: ${user.full_name}
Email: ${user.email}
Role: ${user.role === 'admin' ? 'Admin' : 'Sub Admin'}
Password: ${user.password_hash}`;

  navigator.clipboard.writeText(text);

  setCopiedId(user.id);
  setTimeout(() => setCopiedId(null), 2000);
};

const getShareText = (user: any) => {
  return `Hello ${user.full_name},

Your INSTAFITCORE admin credentials:

Email: ${user.email}
Password: ${user.password_hash}
Role: ${user.role === 'admin' ? 'Admin' : 'Sub Admin'}

Please keep these credentials safe.

— INSTAFITCORE Team`;
};

  const doShare = async (user: any) => {
    const text = getShareText(user);
    if (navigator.share) {
      await navigator.share({ title: 'INSTAFITCORE Admin Credentials', text });
    } else {
      navigator.clipboard.writeText(text);
    }
    setShareUser(null);
  };

  const filtered = subAdmins.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const adminCount = subAdmins.filter(u => u.role === 'admin').length;
  const subadminCount = subAdmins.filter(u => u.role === 'subadmin').length;
  const roleColor = (role: string) => role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-500';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sub Admin Creations</h1>
        <p className="text-sm text-gray-400 mt-1">Manage admin and sub-admin access accounts</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Accounts', value: subAdmins.length, color: '#8ED26B' },
          { label: 'Admins', value: adminCount, color: '#a78bfa' },
          { label: 'Sub Admins', value: subadminCount, color: '#60a5fa' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: stat.color + '22' }}>
              <ShieldCheck size={18} style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-6 items-start">
        {/* LEFT — Sub Admin List */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search by name, email or role..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Account</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400 text-sm">No accounts found.</td></tr>
                ) : filtered.map((user) => (
                  <tr key={user.id} className={`border-t border-gray-50 transition-all ${editingUser?.id === user.id ? 'bg-[#f0fce8]' : 'hover:bg-gray-50'}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#8ED26B' }}>
                          {user.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{user.full_name || '—'}</p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${roleColor(user.role)}`}>
                        <ShieldCheck size={11} />
                        {user.role === 'admin' ? 'Admin' : 'Sub Admin'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-400">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => startEdit(user)} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-blue-100 hover:text-blue-600 text-gray-400 transition">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleCopy(user)} title="Copy credentials" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-green-100 text-gray-400 transition" style={{ color: copiedId === user.id ? '#8ED26B' : undefined }}>
                          {copiedId === user.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button onClick={() => setShareUser(user)} title="Share credentials" className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-purple-500 text-gray-400 transition">
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
                <h2 className="text-base font-bold text-gray-800">{editingUser ? 'Edit Account' : 'Add Sub Admin'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editingUser ? `Editing: ${editingUser.full_name || editingUser.email}` : 'Fill in details to create'}</p>
              </div>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#8ED26B' }} />
            </div>

            {successMsg && <div className="mb-4 px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700 font-medium">✓ {successMsg}</div>}
            {errorMsg && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{errorMsg}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Full Name</label>
                <input className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition placeholder-gray-300" placeholder="Enter full name" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email Address</label>
                <input type="email" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition placeholder-gray-300" placeholder="Enter email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Role</label>
                <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition text-gray-700" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                  <option value="admin">Admin</option>
                  <option value="subadmin">Sub Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Password {editingUser && <span className="ml-1 font-normal text-gray-400">(leave blank to keep current)</span>}
                </label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className="w-full px-4 py-3 pr-11 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#8ED26B] transition placeholder-gray-300" placeholder={editingUser ? 'Enter new password' : 'Enter password'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-xl text-white text-sm font-bold transition disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#8ED26B' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#76c55d')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}>
                {saving ? 'Saving...' : editingUser ? 'Update Account' : <><Plus size={16} /> Create Account</>}
              </button>
              {editingUser && (
                <button onClick={resetForm} className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition">Cancel Edit</button>
              )}
            </div>
          </div>

          <div className="mt-4 px-4 py-3 rounded-xl border text-xs text-gray-400" style={{ borderColor: '#8ED26B33', backgroundColor: '#f4fced' }}>
            <span style={{ color: '#6ab84e' }} className="font-semibold">Tip:</span> Use <Copy size={10} className="inline mx-0.5" /> to copy or <Share2 size={10} className="inline mx-0.5" /> to share credentials after creating an account.
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
                  {shareUser.full_name?.charAt(0).toUpperCase() || shareUser.email?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{shareUser.full_name || '—'}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${roleColor(shareUser.role)}`}>
                    <ShieldCheck size={10} /> {shareUser.role === 'admin' ? 'Admin' : 'Sub Admin'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Email</span>
                  <span className="text-xs font-semibold text-gray-700">{shareUser.email}</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-400">Password</span>
                  <span className="text-xs font-semibold text-gray-700">{shareUser.password_hash}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { navigator.clipboard.writeText(getShareText(shareUser)); setShareUser(null); }} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 text-gray-600 transition">
                <Copy size={15} /> Copy Text
              </button>
              <button onClick={() => doShare(shareUser)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition" style={{ backgroundColor: '#8ED26B' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#76c55d')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#8ED26B')}>
                <Share2 size={15} /> Share
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}