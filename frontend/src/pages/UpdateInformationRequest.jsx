import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiCheckCircle, FiEdit3 } from 'react-icons/fi';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks';
import {
  UPDATE_INFO_SERVICE_NAME,
  findService,
  inputClass,
  labelClass,
  pageShellClass,
  panelClass,
  updateFieldOptions
} from './appointments/appointmentShared';

const UpdateInformationRequest = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const resubmitId = searchParams.get('resubmit');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState(null);
  const [resubmitRequest, setResubmitRequest] = useState(null);
  const [form, setForm] = useState({
    nationalIdNumber: user?.nationalId || '',
    fullName: user?.name || '',
    phone: user?.phone || '',
    selectedFields: [],
    changes: [],
    notes: ''
  });

  const service = useMemo(() => findService(services, UPDATE_INFO_SERVICE_NAME), [services]);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await apiClient.get('/api/services/list');
        setServices(res.data || []);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Could not load service information.');
      } finally {
        setLoading(false);
      }
    };
    loadServices();
  }, []);

  useEffect(() => {
    if (!resubmitId) return;

    let mounted = true;
    const loadResubmitRequest = async () => {
      try {
        const res = await apiClient.get(`/api/bookings/${resubmitId}`);
        const existing = res.data || {};
        if (!mounted) return;
        if (existing.status !== 'Cancelled') {
          toast.error('Only cancelled requests can be resubmitted.');
          return;
        }

        const details = existing.updateDetails || {};
        const changes = details.changes?.length
          ? details.changes
          : [{
              field: details.fieldToUpdate || '',
              currentValue: details.currentValue || '',
              newValue: details.newValue || '',
              reason: details.reason || ''
            }].filter((change) => change.field);

        setResubmitRequest(existing);
        setRequest(null);
        setForm({
          nationalIdNumber: details.nationalIdNumber || user?.nationalId || '',
          fullName: details.fullName || existing.citizenName || user?.name || '',
          phone: details.phone || existing.citizen?.phone || user?.phone || '',
          selectedFields: details.selectedFields?.length ? details.selectedFields : changes.map((change) => change.field),
          changes,
          notes: details.notes || ''
        });
      } catch (error) {
        toast.error(error.response?.data?.message || 'Could not load the cancelled request.');
      }
    };

    loadResubmitRequest();
    return () => {
      mounted = false;
    };
  }, [resubmitId, user?.name, user?.nationalId, user?.phone]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleField = (field) => {
    setForm((current) => {
      const exists = current.selectedFields.includes(field);
      return {
        ...current,
        selectedFields: exists
          ? current.selectedFields.filter((item) => item !== field)
          : [...current.selectedFields, field],
        changes: exists
          ? current.changes.filter((change) => change.field !== field)
          : [...current.changes, { field, currentValue: '', newValue: '', reason: '' }]
      };
    });
  };

  const updateChange = (field, key, value) => {
    setForm((current) => ({
      ...current,
      changes: current.changes.map((change) => (
        change.field === field ? { ...change, [key]: value } : change
      ))
    }));
  };

  const validateForm = () => {
    const required = [
      ['fullName', 'Full name is required.'],
      ['phone', 'Phone number is required.']
    ];
    const missing = required.find(([field]) => !String(form[field] || '').trim());
    if (missing) {
      toast.error(missing[1]);
      return false;
    }
    if (form.changes.length === 0) {
      toast.error('Please select at least one field to update.');
      return false;
    }
    const incomplete = form.changes.find((change) => (
      !change.currentValue.trim() || !change.newValue.trim() || !change.reason.trim()
    ));
    if (incomplete) {
      toast.error('Each selected field needs current value, new value, and reason.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!service) {
      toast.error('Update National ID Information is not available right now.');
      return;
    }
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        serviceId: service._id || service.id,
        citizenName: form.fullName,
        updateDetails: {
          nationalIdNumber: form.nationalIdNumber,
          fullName: form.fullName,
          phone: form.phone,
          selectedFields: form.selectedFields,
          changes: form.changes,
          notes: form.notes
        }
      };
      const resubmitRequestId = resubmitRequest?._id || resubmitRequest?.id;
      const res = resubmitRequestId
        ? await apiClient.put(`/api/bookings/${resubmitRequestId}/resubmit`, payload)
        : await apiClient.post('/api/bookings', payload);
      setRequest(res.data || {});
      setResubmitRequest(null);
      toast.success(resubmitRequest ? 'Update request resubmitted successfully.' : 'Update request submitted successfully.');
    } catch (error) {
      if ([400, 404].includes(error.response?.status)) {
        return;
      }
      toast.error(error.response?.data?.message || 'Could not submit the update request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={pageShellClass}>
        <div className="mx-auto max-w-5xl">
          <div className={panelClass}>Loading request form...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <div className="mx-auto max-w-5xl space-y-4">
        <Link to="/dashboard/user/services" className="inline-flex items-center gap-2 text-sm font-bold text-[#7CB8FF] hover:text-white">
          <FiArrowLeft /> Back to services
        </Link>

        <section className={panelClass}>
          <span className="rounded-full border border-[#4189DD]/35 bg-[#4189DD]/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#7CB8FF]">
            Update Request
          </span>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">Update National ID Information</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Submit the information that needs correction. This request does not create an appointment, queue ticket, or QR code.
          </p>
        </section>

        {resubmitRequest && (
          <section className="rounded-2xl border border-red-400/40 bg-red-950/30 p-4 text-red-100">
            <p className="text-xs font-black uppercase tracking-wide text-red-200">Correction required</p>
            <p className="mt-1 text-sm font-semibold">
              Your request {resubmitRequest.ref} was cancelled. Reason: {resubmitRequest.cancellationReason || 'Please correct your information and resubmit your request.'}
            </p>
          </section>
        )}

        {request ? (
          <section className={panelClass}>
            <div className="flex items-center gap-2 text-emerald-300">
              <FiCheckCircle />
              <span className="text-sm font-bold">Request submitted for admin review</span>
            </div>
            <h2 className="mt-3 font-mono text-3xl font-black">{request.ref}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Keep this request reference for follow-up. Admin staff will review, approve, reject, or complete the request.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="Request Type" value="Update Information Request" />
              <Info label="Status" value={request.requestStatus || 'Pending'} />
              <Info label="Full Name" value={form.fullName} />
              <Info label="Phone" value={form.phone} />
            </div>
            {request.existingRegistration?.found && (
              <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h3 className="text-sm font-black text-emerald-200">Linked to existing National ID registration</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Info label="Previous Ticket Number" value={request.existingRegistration.ticketNumber} />
                  <Info label="Previous Queue Number" value={request.existingRegistration.queueNumber} />
                  <Info label="Previous Center" value={request.existingRegistration.centerName} />
                  <Info label="Previous Status" value={request.existingRegistration.status} />
                </div>
              </div>
            )}
          </section>
        ) : (
          <form onSubmit={handleSubmit} className={panelClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4189DD]/15 text-[#7CB8FF]">
                <FiEdit3 />
              </div>
              <div>
                <h2 className="text-lg font-black">Request Details</h2>
                <p className="text-xs text-slate-500">No appointment date or time is required.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="National ID Number (optional)" value={form.nationalIdNumber} onChange={(value) => updateForm('nationalIdNumber', value)} />
              <Field label="Full Name" value={form.fullName} onChange={(value) => updateForm('fullName', value)} />
              <Field label="Phone" value={form.phone} onChange={(value) => updateForm('phone', value)} />
            </div>

            <div className="mt-6">
              <span className={labelClass}>Select fields to update</span>
              <div className="flex flex-wrap gap-2">
                {updateFieldOptions.map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => toggleField(field)}
                    className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                      form.selectedFields.includes(field)
                        ? 'border-[#4189DD] bg-[#4189DD] text-white'
                        : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-[#4189DD]/60'
                    }`}
                  >
                    {field}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {form.changes.map((change) => (
                <div key={change.field} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <h3 className="mb-3 text-sm font-black text-[#7CB8FF]">{change.field}</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Field label="Current Value" value={change.currentValue} onChange={(value) => updateChange(change.field, 'currentValue', value)} />
                    <Field label="New Value" value={change.newValue} onChange={(value) => updateChange(change.field, 'newValue', value)} />
                    <Field label="Reason" value={change.reason} onChange={(value) => updateChange(change.field, 'reason', value)} />
                  </div>
                </div>
              ))}
            </div>

            <label className="mt-4 block">
              <span className={labelClass}>Notes</span>
              <textarea
                value={form.notes}
                rows={4}
                onChange={(event) => updateForm('notes', event.target.value)}
                className={`${inputClass} resize-none`}
              />
            </label>

            <div className="mt-5 flex justify-end">
              <button disabled={submitting} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Submitting...' : 'Submit Update Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <input value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />
  </label>
);

const Info = ({ label, value }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2.5">
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-white">{value || 'Not selected'}</p>
  </div>
);

export default UpdateInformationRequest;
