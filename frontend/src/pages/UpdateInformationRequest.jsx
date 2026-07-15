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

const getOriginalRegistration = (bookings = []) => (
  bookings.find((ticket) => ticket.requestType === 'new_national_id') || null
);

const nationalIdFromRegistration = (ticket, user) => (
  user?.nationalId ||
  ticket?.citizen?.nationalId ||
  ticket?.registrationDetails?.nationalIdNumber ||
  ticket?.nationalIdNumber ||
  ''
);

const currentValueFromRegistration = (ticket, field, user) => {
  const details = ticket?.registrationDetails || {};
  const normalizedField = String(field || '').toLowerCase();

  if (normalizedField === 'name' || normalizedField === 'full name') {
    return details.fullName || ticket?.citizenName || user?.name || '';
  }
  if (normalizedField.includes('mother')) {
    return details.motherName || '';
  }
  if (normalizedField.includes('birth')) {
    return details.dateOfBirth || '';
  }
  if (normalizedField.includes('address')) {
    return details.fullAddress || details.address || user?.address || '';
  }
  if (normalizedField.includes('phone')) {
    return details.phone || ticket?.citizen?.phone || user?.phone || '';
  }
  if (normalizedField.includes('marital')) {
    const value = details.maritalStatus || user?.maritalStatus || '';
    if (value === 'SINGLE') return 'Single';
    if (value === 'MARRIED') return 'Married';
    return '';
  }
  return 'Not recorded in current record';
};

const hydrateChangesFromRegistration = (changes = [], ticket, user) => (
  changes.map((change) => ({
    ...change,
    currentValue: currentValueFromRegistration(ticket, change.field, user) || change.currentValue || 'Not recorded in current record'
  }))
);

const UpdateInformationRequest = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const resubmitId = searchParams.get('resubmit');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState(null);
  const [existingRegistration, setExistingRegistration] = useState(null);
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
        const [serviceRes, bookingRes] = await Promise.all([
          apiClient.get('/api/services/list'),
          apiClient.get('/api/bookings/my')
        ]);
        setServices(serviceRes.data || []);
        const original = getOriginalRegistration(bookingRes.data || []);
        setExistingRegistration(original);
        if (original && !resubmitId) {
          const details = original.registrationDetails || {};
          const nationalIdNumber = nationalIdFromRegistration(original, user);
          setForm((current) => ({
            ...current,
            nationalIdNumber: nationalIdNumber || current.nationalIdNumber,
            fullName: details.fullName || original.citizenName || current.fullName,
            phone: details.phone || original.citizen?.phone || current.phone,
            changes: hydrateChangesFromRegistration(current.changes, original, user)
          }));
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Could not load service information.');
      } finally {
        setLoading(false);
      }
    };
    loadServices();
  }, [resubmitId, user]);

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
          nationalIdNumber: details.nationalIdNumber || nationalIdFromRegistration(existingRegistration, user) || '',
          fullName: details.fullName || existing.citizenName || user?.name || '',
          phone: details.phone || existing.citizen?.phone || user?.phone || '',
          selectedFields: details.selectedFields?.length ? details.selectedFields : changes.map((change) => change.field),
          changes: hydrateChangesFromRegistration(changes, existingRegistration, user),
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
  }, [existingRegistration, resubmitId, user]);

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
          : [
              ...current.changes,
              {
                field,
                currentValue: currentValueFromRegistration(existingRegistration, field, user),
                newValue: '',
                reason: ''
              }
            ]
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
      ['fullName', 'Full name is required.']
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
      !String(change.field || '').trim() || !String(change.newValue || '').trim() || !String(change.reason || '').trim()
    ));
    if (incomplete) {
      toast.error('Each selected field needs a new value and reason.');
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
          changes: hydrateChangesFromRegistration(form.changes, existingRegistration, user),
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

        {existingRegistration && !resubmitRequest && !request && (
          <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-200">Existing registration found</p>
            <p className="mt-1 text-sm font-semibold">
              This update request will be linked to ticket {existingRegistration.ref}.
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
              <Info label="National ID Number" value={form.nationalIdNumber || 'Not recorded yet'} />
              <Info label="Full Name" value={form.fullName} />
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
              <Field
                label="National ID Number"
                value={form.nationalIdNumber || 'Not recorded yet'}
                onChange={() => {}}
                readOnly
                helper="Loaded from your existing National ID record."
              />
              <Field
                label="Registered Full Name"
                value={form.fullName}
                onChange={() => {}}
                readOnly
                helper="Loaded from your previous registration."
              />
            </div>

            {!existingRegistration && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-100">
                No previous National ID registration was found on this account. Update requests can only be submitted after a New National ID Registration exists.
              </div>
            )}

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
                    <Field
                      label="Current Value"
                      value={change.currentValue || currentValueFromRegistration(existingRegistration, change.field, user)}
                      onChange={() => {}}
                      readOnly
                      helper="Read from your existing record."
                    />
                    {String(change.field || '').toLowerCase().includes('marital') ? (
                      <label>
                        <span className={labelClass}>New Value</span>
                        <select
                          value={change.newValue}
                          onChange={(event) => updateChange(change.field, 'newValue', event.target.value)}
                          className={inputClass}
                        >
                          <option value="">Select Marital Status</option>
                          <option value="SINGLE">Single</option>
                          <option value="MARRIED">Married</option>
                        </select>
                      </label>
                    ) : (
                      <Field label="New Value" value={change.newValue} onChange={(value) => updateChange(change.field, 'newValue', value)} />
                    )}
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
              <button disabled={submitting || !existingRegistration} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Submitting...' : 'Submit Update Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, readOnly = false, helper = '' }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <input
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} ${readOnly ? 'cursor-not-allowed bg-slate-100 font-bold text-slate-700' : ''}`}
    />
    {helper && <span className="mt-1 block text-[11px] font-semibold text-slate-500">{helper}</span>}
  </label>
);

const Info = ({ label, value }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2.5">
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-white">{value || 'Not selected'}</p>
  </div>
);

export default UpdateInformationRequest;
