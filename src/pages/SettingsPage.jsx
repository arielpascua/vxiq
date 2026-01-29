import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, DoorOpen, ListOrdered, Plus, Pencil, Trash2,
  Save, X, Check, Eye, EyeOff, Building
} from 'lucide-react';
import { sitesAPI, roomsAPI, stepsAPI } from '../api';

// Generic CRUD Table Component
function CrudTable({ title, icon: Icon, items, columns, onAdd, onEdit, onDelete, onToggle }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({});

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    await onEdit(editingId, editForm);
    setEditingId(null);
    setEditForm({});
  };

  const startAdd = () => {
    setIsAdding(true);
    const initial = {};
    columns.filter(c => c.editable).forEach(c => {
      initial[c.field] = c.defaultValue || '';
    });
    setAddForm(initial);
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setAddForm({});
  };

  const saveAdd = async () => {
    await onAdd(addForm);
    setIsAdding(false);
    setAddForm({});
  };

  return (
    <div className="glass-card rounded-xl sm:rounded-2xl border border-vxi-orange-500/30 overflow-hidden shadow-xl">
      <div className="p-4 sm:p-5 border-b border-vxi-orange-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-vxi-black-50 to-vxi-black-100">
        <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-vxi-white">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-vxi-orange-500" />
          {title}
        </h2>
        <button
          onClick={startAdd}
          className="flex items-center gap-2 bg-gradient-to-r from-vxi-orange-500 to-vxi-orange-600 hover:from-vxi-orange-600 hover:to-vxi-orange-700 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-lg text-white w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          Add New
        </button>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden divide-y divide-vxi-white-300/10">
        {/* Add Card */}
        {isAdding && (
          <div className="p-4 bg-vxi-orange-500/10 border-l-4 border-vxi-orange-500">
            <div className="space-y-3">
              {columns.filter(col => col.editable).map(col => (
                <div key={col.field}>
                  <label className="block text-xs text-vxi-white-300 mb-1">{col.header}</label>
                  {col.type === 'select' ? (
                    <select
                      value={addForm[col.field] || ''}
                      onChange={e => setAddForm(f => ({ ...f, [col.field]: e.target.value }))}
                      className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                    >
                      <option value="">Select...</option>
                      {col.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : col.type === 'number' ? (
                    <input
                      type="number"
                      value={addForm[col.field] || ''}
                      onChange={e => setAddForm(f => ({ ...f, [col.field]: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={addForm[col.field] || ''}
                      onChange={e => setAddForm(f => ({ ...f, [col.field]: e.target.value }))}
                      className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white placeholder-vxi-white-400 focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                      placeholder={col.placeholder || ''}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveAdd} className="flex-1 py-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Save
              </button>
              <button onClick={cancelAdd} className="flex-1 py-2 bg-vxi-black-50 border border-vxi-white-300/20 rounded-lg text-vxi-white-300 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Data Cards */}
        {items.map(item => (
          <div key={item.id} className={`p-4 ${!item.is_active ? 'opacity-50' : ''}`}>
            {editingId === item.id ? (
              <div className="space-y-3">
                {columns.filter(col => col.editable).map(col => (
                  <div key={col.field}>
                    <label className="block text-xs text-vxi-white-300 mb-1">{col.header}</label>
                    {col.type === 'select' ? (
                      <select
                        value={editForm[col.field] || ''}
                        onChange={e => setEditForm(f => ({ ...f, [col.field]: e.target.value }))}
                        className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                      >
                        <option value="">Select...</option>
                        {col.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : col.type === 'number' ? (
                      <input
                        type="number"
                        value={editForm[col.field] || ''}
                        onChange={e => setEditForm(f => ({ ...f, [col.field]: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={editForm[col.field] || ''}
                        onChange={e => setEditForm(f => ({ ...f, [col.field]: e.target.value }))}
                        className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-2 mt-4">
                  <button onClick={saveEdit} className="flex-1 py-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> Save
                  </button>
                  <button onClick={cancelEdit} className="flex-1 py-2 bg-vxi-black-50 border border-vxi-white-300/20 rounded-lg text-vxi-white-300 text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {columns.filter(col => col.field !== 'is_active' && col.field !== 'id').slice(0, 2).map(col => (
                      <div key={col.field} className="mb-1">
                        <span className="text-xs text-vxi-white-400">{col.header}: </span>
                        <span className="text-vxi-white font-medium">
                          {col.render ? col.render(item[col.field], item) : item[col.field] || '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.is_active ? 'bg-vxi-orange-500/20 text-vxi-orange-400' : 'bg-red-900/30 text-red-400'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onToggle(item.id, !item.is_active)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${item.is_active ? 'bg-vxi-black-50 border border-vxi-white-300/20 text-vxi-white-300' : 'bg-vxi-orange-500 text-white'}`}
                  >
                    {item.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {item.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => startEdit(item)}
                    className="flex-1 py-2 bg-vxi-orange-500/20 border border-vxi-orange-500/50 rounded-lg text-vxi-orange-400 text-sm font-medium flex items-center justify-center gap-1.5"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="py-2 px-3 bg-red-600/20 border border-red-500/50 rounded-lg text-red-400 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {items.length === 0 && !isAdding && (
          <div className="p-8 text-center text-vxi-white-400 text-sm">
            No items found. Tap "Add New" to create one.
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-vxi-black-50/50">
            <tr>
              {columns.map(col => (
                <th key={col.field} className="text-left px-5 py-4 text-sm font-semibold text-vxi-orange-400 uppercase tracking-wider">
                  {col.header}
                </th>
              ))}
              <th className="text-right px-5 py-4 text-sm font-semibold text-vxi-orange-400 uppercase tracking-wider w-40">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vxi-white-300/10">
            {/* Add Row */}
            {isAdding && (
              <tr className="bg-vxi-orange-500/10 border-l-4 border-vxi-orange-500">
                {columns.map(col => (
                  <td key={col.field} className="px-5 py-4">
                    {col.editable ? (
                      col.type === 'select' ? (
                        <select
                          value={addForm[col.field] || ''}
                          onChange={e => setAddForm(f => ({ ...f, [col.field]: e.target.value }))}
                          className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                        >
                          <option value="">Select...</option>
                          {col.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : col.type === 'number' ? (
                        <input
                          type="number"
                          value={addForm[col.field] || ''}
                          onChange={e => setAddForm(f => ({ ...f, [col.field]: parseInt(e.target.value) || 0 }))}
                          className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={addForm[col.field] || ''}
                          onChange={e => setAddForm(f => ({ ...f, [col.field]: e.target.value }))}
                          className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white placeholder-vxi-white-400 focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                          placeholder={col.placeholder || ''}
                        />
                      )
                    ) : (
                      <span className="text-vxi-white-400">-</span>
                    )}
                  </td>
                ))}
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={saveAdd}
                      className="p-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 rounded-lg transition-all hover:scale-[1.02] shadow-lg"
                    >
                      <Check className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={cancelAdd}
                      className="p-2 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 rounded-lg transition-all"
                    >
                      <X className="w-5 h-5 text-vxi-white-300" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Data Rows */}
            {items.map(item => (
              <tr key={item.id} className={`zebra-row hover:bg-vxi-orange-500/5 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                {columns.map(col => (
                  <td key={col.field} className="px-5 py-4">
                    {editingId === item.id && col.editable ? (
                      col.type === 'select' ? (
                        <select
                          value={editForm[col.field] || ''}
                          onChange={e => setEditForm(f => ({ ...f, [col.field]: e.target.value }))}
                          className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                        >
                          <option value="">Select...</option>
                          {col.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : col.type === 'number' ? (
                        <input
                          type="number"
                          value={editForm[col.field] || ''}
                          onChange={e => setEditForm(f => ({ ...f, [col.field]: parseInt(e.target.value) || 0 }))}
                          className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={editForm[col.field] || ''}
                          onChange={e => setEditForm(f => ({ ...f, [col.field]: e.target.value }))}
                          className="w-full bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-3 py-2 text-sm text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
                        />
                      )
                    ) : (
                      <span className={col.className || 'text-vxi-white-100'}>
                        {col.render ? col.render(item[col.field], item) : item[col.field]}
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {editingId === item.id ? (
                      <>
                        <button
                          onClick={saveEdit}
                          className="p-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 rounded-lg transition-all hover:scale-[1.02] shadow-lg"
                        >
                          <Save className="w-5 h-5 text-white" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-2 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 rounded-lg transition-all"
                        >
                          <X className="w-5 h-5 text-vxi-white-300" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onToggle(item.id, !item.is_active)}
                          className={`p-2 rounded-lg transition-all hover:scale-[1.02] ${item.is_active ? 'bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20' : 'bg-vxi-orange-500 hover:bg-vxi-orange-600 shadow-lg'}`}
                          title={item.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {item.is_active ? <EyeOff className="w-5 h-5 text-vxi-white-300" /> : <Eye className="w-5 h-5 text-white" />}
                        </button>
                        <button
                          onClick={() => startEdit(item)}
                          className="p-2 bg-vxi-orange-500/20 hover:bg-vxi-orange-500 border border-vxi-orange-500/50 rounded-lg transition-all hover:scale-[1.02]"
                        >
                          <Pencil className="w-5 h-5 text-vxi-orange-400 hover:text-white" />
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-2 bg-red-600/20 hover:bg-red-600 border border-red-500/50 rounded-lg transition-all hover:scale-[1.02]"
                        >
                          <Trash2 className="w-5 h-5 text-red-400 hover:text-white" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {items.length === 0 && !isAdding && (
              <tr>
                <td colSpan={columns.length + 1} className="px-5 py-12 text-center text-vxi-white-400">
                  No items found. Click "Add New" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('sites');
  const [sites, setSites] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sitesData, roomsData, stepsData] = await Promise.all([
        sitesAPI.getAllIncludeInactive(),
        roomsAPI.getAllIncludeInactive(),
        stepsAPI.getAllIncludeInactive()
      ]);
      setSites(sitesData);
      setRooms(roomsData);
      setSteps(stepsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Site handlers
  const handleAddSite = async (data) => {
    await sitesAPI.create(data.name);
    loadData();
  };

  const handleEditSite = async (id, data) => {
    await sitesAPI.update(id, data);
    loadData();
  };

  const handleToggleSite = async (id, isActive) => {
    const site = sites.find(s => s.id === id);
    await sitesAPI.update(id, { ...site, is_active: isActive });
    loadData();
  };

  const handleDeleteSite = async (id) => {
    if (!confirm('Are you sure you want to delete this site?')) return;
    await sitesAPI.delete(id);
    loadData();
  };

  // Room handlers
  const handleAddRoom = async (data) => {
    await roomsAPI.create(data);
    loadData();
  };

  const handleEditRoom = async (id, data) => {
    await roomsAPI.update(id, data);
    loadData();
  };

  const handleToggleRoom = async (id, isActive) => {
    const room = rooms.find(r => r.id === id);
    await roomsAPI.update(id, { ...room, is_active: isActive });
    loadData();
  };

  const handleDeleteRoom = async (id) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    await roomsAPI.delete(id);
    loadData();
  };

  // Step handlers
  const handleAddStep = async (data) => {
    await stepsAPI.create(data);
    loadData();
  };

  const handleEditStep = async (id, data) => {
    await stepsAPI.update(id, data);
    loadData();
  };

  const handleToggleStep = async (id, isActive) => {
    const step = steps.find(s => s.id === id);
    await stepsAPI.update(id, { ...step, is_active: isActive });
    loadData();
  };

  const handleDeleteStep = async (id) => {
    if (!confirm('Are you sure you want to delete this step?')) return;
    await stepsAPI.delete(id);
    loadData();
  };

  const tabs = [
    { id: 'sites', label: 'Sites', icon: MapPin },
    { id: 'rooms', label: 'Rooms', icon: DoorOpen },
    { id: 'steps', label: 'Steps', icon: ListOrdered },
  ];

  const siteOptions = sites.filter(s => s.is_active).map(s => ({ value: s.id, label: s.name }));

  return (
    <div className="min-h-screen bg-vxi-black-300 text-vxi-white">
      {/* Header */}
      <header className="bg-vxi-black-100 border-b border-vxi-orange-500/30 px-4 sm:px-6 py-3 sm:py-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/admin"
              className="p-2 sm:p-2.5 bg-vxi-black-50 hover:bg-vxi-orange-500 border border-vxi-white-300/20 hover:border-vxi-orange-500 rounded-lg sm:rounded-xl transition-all hover:scale-[1.02] active:scale-95"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-vxi-white-200 hover:text-white" />
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-vxi-orange-500 p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-lg">
                <Building className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-vxi-white">Settings</h1>
                <p className="text-vxi-white-300 text-xs sm:text-sm hidden sm:block">VXI TA Queue Configuration</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap text-sm sm:text-base ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-vxi-orange-500 to-vxi-orange-600 text-white shadow-lg shadow-vxi-orange-500/25'
                  : 'bg-vxi-black-100 text-vxi-white-300 hover:bg-vxi-black-50 border border-vxi-white-300/20 hover:border-vxi-orange-500/30'
              }`}
            >
              <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-vxi-black-100 rounded-xl sm:rounded-2xl p-12 sm:p-16 text-center text-vxi-white-400 border border-vxi-orange-500/30">
            <div className="animate-spin w-10 h-10 sm:w-12 sm:h-12 border-4 border-vxi-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            Loading...
          </div>
        ) : (
          <>
            {/* Sites Table */}
            {activeTab === 'sites' && (
              <div className="animate-fade-in" key="sites">
                <CrudTable
                  title="Sites"
                  icon={MapPin}
                  items={sites}
                  columns={[
                    { field: 'id', header: 'ID', editable: false },
                    { field: 'name', header: 'Site Name', editable: true, placeholder: 'e.g., Clark' },
                    {
                      field: 'is_active',
                      header: 'Status',
                      editable: false,
                      render: (val) => (
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${val ? 'bg-vxi-orange-500/20 text-vxi-orange-400 border border-vxi-orange-500/50' : 'bg-red-900/30 text-red-400 border border-red-500/50'}`}>
                          {val ? 'Active' : 'Inactive'}
                        </span>
                      )
                    },
                  ]}
                  onAdd={handleAddSite}
                  onEdit={handleEditSite}
                  onDelete={handleDeleteSite}
                  onToggle={handleToggleSite}
                />
              </div>
            )}

            {/* Rooms Table */}
            {activeTab === 'rooms' && (
              <div className="animate-fade-in" key="rooms">
                <CrudTable
                  title="Rooms"
                  icon={DoorOpen}
                  items={rooms}
                  columns={[
                    { field: 'id', header: 'ID', editable: false },
                    { field: 'room_number', header: 'Room Number', editable: true, placeholder: 'e.g., 101' },
                    {
                      field: 'site_id',
                      header: 'Site',
                      editable: true,
                      type: 'select',
                      options: siteOptions,
                      render: (val, item) => <span className="text-vxi-orange-400 font-medium">{item.site_name || '-'}</span>
                    },
                    { field: 'description', header: 'Description', editable: true, placeholder: 'e.g., Interview Room' },
                    {
                      field: 'is_active',
                      header: 'Status',
                      editable: false,
                      render: (val) => (
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${val ? 'bg-vxi-orange-500/20 text-vxi-orange-400 border border-vxi-orange-500/50' : 'bg-red-900/30 text-red-400 border border-red-500/50'}`}>
                          {val ? 'Active' : 'Inactive'}
                        </span>
                      )
                    },
                  ]}
                  onAdd={handleAddRoom}
                  onEdit={handleEditRoom}
                  onDelete={handleDeleteRoom}
                  onToggle={handleToggleRoom}
                />
              </div>
            )}

            {/* Steps Table */}
            {activeTab === 'steps' && (
              <div className="animate-fade-in" key="steps">
                <CrudTable
                  title="Recruitment Steps"
                  icon={ListOrdered}
                  items={steps}
                  columns={[
                    { field: 'id', header: 'ID', editable: false },
                    { field: 'name', header: 'Step Name', editable: true, placeholder: 'e.g., Initial Interview' },
                    { field: 'sequence', header: 'Order', editable: true, type: 'number', defaultValue: 0 },
                    {
                      field: 'is_active',
                      header: 'Status',
                      editable: false,
                      render: (val) => (
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${val ? 'bg-vxi-orange-500/20 text-vxi-orange-400 border border-vxi-orange-500/50' : 'bg-red-900/30 text-red-400 border border-red-500/50'}`}>
                          {val ? 'Active' : 'Inactive'}
                        </span>
                      )
                    },
                  ]}
                  onAdd={handleAddStep}
                  onEdit={handleEditStep}
                  onDelete={handleDeleteStep}
                  onToggle={handleToggleStep}
                />
              </div>
            )}
          </>
        )}

        {/* Help Text */}
        <div className="mt-4 sm:mt-6 glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-vxi-orange-500/30 shadow-xl">
          <h3 className="font-bold text-vxi-orange-500 mb-3 text-base sm:text-lg flex items-center gap-2">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Configuration Tips
          </h3>
          <ul className="text-xs sm:text-sm text-vxi-white-200 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-vxi-orange-500 font-bold">•</span>
              <span><strong className="text-vxi-orange-400">Sites:</strong> Add your VXI locations (Clark, Makati, Cebu, etc.)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-vxi-orange-500 font-bold">•</span>
              <span><strong className="text-vxi-orange-400">Rooms:</strong> Configure interview rooms per site for proper routing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-vxi-orange-500 font-bold">•</span>
              <span><strong className="text-vxi-orange-400">Steps:</strong> Define your recruitment process stages in order</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-vxi-orange-500 font-bold">•</span>
              <span>Deactivated items won't appear in the queue forms but historical data is preserved</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
