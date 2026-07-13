import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  FaPlus,
  FaEdit,
  FaTimes,
  FaConciergeBell,
} from 'react-icons/fa';
import { apiClient } from '../api/apiClient';
import DataTable from '../components/ui/DataTable';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const categories = ['National ID'];
const emptyForm = {
  name: 'National ID Registration',
  description: 'Book and manage National ID registration appointments for citizens in Banaadir Region.',
  category: 'National ID',
  duration: 15,
  status: 'Active'
};

const ServiceManagement = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadServices = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/services/list');
      setServices(res.data || []);
    } catch (_err) {
      toast.error('Failed to load services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (svc) => {
    setEditing(svc._id || svc.id);
    setForm({
      name: svc.name,
      description: svc.description,
      category: svc.category,
      duration: svc.duration,
      status: svc.status || 'Active'
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Service name is required.');
      return;
    }
    try {
      if (editing) {
        await apiClient.put(`/api/services/${editing}`, form);
        toast.success('Service updated.');
      } else {
        await apiClient.post('/api/services', form);
        toast.success('Service added.');
      }
      await loadServices();
      setModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save service.');
    }
  };

  const columns = [
    { header: 'Name', accessor: 'name', render: (svc) => <span className="font-bold">{svc.name}</span> },
    { header: 'Description', accessor: 'description', render: (svc) => <span className="line-clamp-2">{svc.description}</span> },
    {
      header: 'Category',
      accessor: 'category',
      render: (svc) => (
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          {svc.category || 'National ID'}
        </span>
      )
    },
    { header: 'Duration', accessor: 'duration', render: (svc) => `${svc.duration || 15} min` },
    {
      header: 'Status',
      accessor: 'status',
      render: (svc) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
          svc.status !== 'Inactive'
            ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
            : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
        }`}>
          {svc.status || 'Active'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      sortable: false,
      render: (svc) => (
        <button
          onClick={() => openEdit(svc)}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25"
        >
          <FaEdit /> Edit
        </button>
      )
    }
  ];

  if (loading && services.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading services...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FaConciergeBell className="text-blue-600 dark:text-blue-400" />
              Service Settings
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update the National ID service shown to citizens.</p>
          </div>
          {services.length === 0 && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-xl shadow-lg transition-all text-sm"
            >
              <FaPlus /> Add National ID Service
            </button>
          )}
        </motion.div>

        <motion.div variants={item}>
          <DataTable
            columns={columns}
            data={services}
            loading={loading}
            searchPlaceholder="Search services..."
            toolbar={services.length === 0 ? (
              <button
                onClick={openAdd}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
              >
                <FaPlus /> Add Service
              </button>
            ) : null}
            emptyTitle="No services configured"
            emptyText="Add the National ID service to start accepting citizen appointments."
          />
        </motion.div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editing ? 'Edit Service' : 'Add Service'}
                </h3>
                <button onClick={() => setModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                  <FaTimes />
                </button>
              </div>
              {/* Form */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service Name</label>
                    <input
                      type="text"
                      value={form.name}
                    readOnly
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Service description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select
                      value={form.category}
                      disabled
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (min)</label>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 15 })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, status: form.status === 'Active' ? 'Inactive' : 'Active' })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        form.status === 'Active' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        form.status === 'Active' ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{form.status}</span>
                  </div>
                </div>
              </div>
              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-md transition-colors"
                >
                  {editing ? 'Update Service' : 'Add Service'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ServiceManagement;
