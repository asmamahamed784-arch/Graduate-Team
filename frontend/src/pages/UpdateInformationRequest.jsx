import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiCheckCircle, FiEdit3 } from 'react-icons/fi';
import { apiClient } from '../api/apiClient';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks';
import {
  UPDATE_INFO_SERVICE_NAME,
  findService,
  formatSomaliPhone,
  inputClass,
  labelClass,
  pageShellClass,
  panelClass,
  updateFieldOptions
} from './appointments/appointmentShared';

const isCompletedRegistration = (ticket = {}) => {
  const status = String(ticket.status || '').trim().toLowerCase();
  const requestStatus = String(ticket.requestStatus || '').trim().toLowerCase();
  return status === 'completed' || requestStatus === 'completed';
};

const isNewRegistrationRecord = (ticket = {}) => {
  const requestType = String(ticket.requestType || ticket.type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const serviceName = String(ticket.service?.name || ticket.serviceName || ticket.service || '').trim().toLowerCase();

  if (['new_national_id', 'new_registration', 'national_id_registration'].includes(requestType)) return true;
  if (requestType && requestType.includes('update')) return false;
  if (requestType && (requestType.includes('lost') || requestType.includes('replace'))) return false;
  if (serviceName.includes('update') || serviceName.includes('lost') || serviceName.includes('replacement')) return false;
  return serviceName.includes('national id') && serviceName.includes('registration');
};

const getOriginalRegistration = (bookings = []) => (
  bookings.find((ticket) => isNewRegistrationRecord(ticket) && isCompletedRegistration(ticket)) || null
);

const canResubmitTicket = (ticket = {}) => {
  const status = String(ticket.status || '').trim().toLowerCase();
  const requestStatus = String(ticket.requestStatus || '').trim().toLowerCase();
  return Boolean(ticket.needsResubmission)
    || ['cancelled', 'canceled', 'needs_correction', 'needs correction', 'correction required'].includes(status)
    || ['resubmission required', 'needs_correction', 'needs correction', 'correction required'].includes(requestStatus);
};

const isOpenUpdateRequest = (ticket = {}) => {
  const requestType = String(ticket.requestType || '').trim().toLowerCase();
  const status = String(ticket.status || '').trim().toLowerCase();
  const requestStatus = String(ticket.requestStatus || '').trim().toLowerCase();
  return requestType === 'update_information' && (
    ['pending', 'on hold', 'waiting', 'being served', 'in progress'].includes(status) ||
    ['pending', 'under review', 'approved', 'in progress', 'resubmission required'].includes(requestStatus)
  );
};

const pickFirstTextValue = (...values) => (
  values.map((value) => String(value || '').trim()).find(Boolean) || ''
);

const nationalIdFromRegistration = (ticket, user) => (
  pickFirstTextValue(
    user?.nationalId,
    user?.nationalIdNumber,
    ticket?.citizen?.nationalId,
    ticket?.citizen?.nationalIdNumber,
    ticket?.existingRegistration?.nationalIdNumber,
    ticket?.registrationDetails?.nationalIdNumber,
    ticket?.registrationDetails?.issuedNationalId,
    ticket?.updateDetails?.nationalIdNumber,
    ticket?.replacementDetails?.nationalIdNumber,
    ticket?.nationalIdRecord?.nationalIdNumber,
    ticket?.nationalIdRecord?.number,
    ticket?.citizenSummary?.nationalIdNumber,
    ticket?.metadata?.nationalIdNumber,
    ticket?.issuedNationalId,
    ticket?.nationalId,
    ticket?.nationalIdNumber
  )
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
    return formatSomaliPhone(details.phone || ticket?.citizen?.phone || user?.phone);
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

const normalizeUpdateComparableValue = (field = '', value = '') => {
  const raw = String(value ?? '').trim();
  const key = String(field || '').toLowerCase();

  if (key.includes('phone')) return raw.replace(/\D/g, '');

  if (key.includes('birth') || key.includes('date')) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return raw.replace(/\s+/g, '').toLowerCase();
  }

  return raw.replace(/\s+/g, ' ').toLowerCase();
};

const getUnchangedUpdateField = (changes = []) => changes.find((change) => {
  const currentValue = normalizeUpdateComparableValue(change.field, change.currentValue);
  const newValue = normalizeUpdateComparableValue(change.field, change.newValue);
  return currentValue && newValue && currentValue === newValue;
});

const MARITAL_STATUS_OPTIONS = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'MARRIED', label: 'Married' }
];

const MISTAKE_TYPE_OPTIONS = [
  'Document type',
  'Office Mistake',
  'Mixed Mistake'
];

const normalizeMaritalStatusValue = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'single') return 'SINGLE';
  if (normalized === 'married') return 'MARRIED';
  return '';
};

const getMaritalStatusOptions = (currentValue) => {
  const currentStatus = normalizeMaritalStatusValue(currentValue);
  return MARITAL_STATUS_OPTIONS.filter((option) => option.value !== currentStatus);
};

const UpdateInformationRequest = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resubmitId = searchParams.get('resubmit');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState(null);
  const [pendingUpdateRequest, setPendingUpdateRequest] = useState(null);
  const [existingRegistration, setExistingRegistration] = useState(null);
  const [resubmitRequest, setResubmitRequest] = useState(null);
  const [profileUser, setProfileUser] = useState(user || null);
  const [form, setForm] = useState({
    nationalIdNumber: user?.nationalId || '',
    fullName: user?.name || '',
    phone: formatSomaliPhone(user?.phone),
    mistakeType: '',
    selectedFields: [],
    changes: [],
    notes: ''
  });

  const service = useMemo(() => findService(services, UPDATE_INFO_SERVICE_NAME), [services]);
  const activeUser = profileUser || user || {};

  useEffect(() => {
    const loadServices = async () => {
      try {
        const [serviceRes, bookingRes, profileRes] = await Promise.all([
          apiClient.get('/api/services/list'),
          apiClient.get('/api/bookings/my'),
          apiClient.get('/api/auth/profile')
        ]);
        const profile = profileRes.data || user || {};
        setProfileUser(profile);
        setServices(serviceRes.data || []);
        const original = getOriginalRegistration(bookingRes.data || []);
        const openUpdate = (bookingRes.data || []).find((ticket) => isOpenUpdateRequest(ticket) && !canResubmitTicket(ticket));
        setPendingUpdateRequest(openUpdate || null);
        setExistingRegistration(original);
        if (original && !resubmitId) {
          const details = original.registrationDetails || {};
          const nationalIdNumber = nationalIdFromRegistration(original, profile);
          setForm((current) => ({
            ...current,
            nationalIdNumber: nationalIdNumber || current.nationalIdNumber,
            fullName: details.fullName || original.citizenName || profile.name || current.fullName,
            phone: formatSomaliPhone(details.phone || original.citizen?.phone || profile.phone || current.phone),
            changes: hydrateChangesFromRegistration(current.changes, original, profile)
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
        const [res, profileRes] = await Promise.all([
          apiClient.get(`/api/bookings/${resubmitId}`),
          apiClient.get('/api/auth/profile')
        ]);
        const profile = profileRes.data || user || {};
        setProfileUser(profile);
        const existing = res.data || {};
        if (!mounted) return;
        if (!canResubmitTicket(existing)) {
          toast.error('Only requests that require correction can be resubmitted.');
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
          nationalIdNumber: details.nationalIdNumber || nationalIdFromRegistration(existingRegistration || existing, profile) || '',
          fullName: details.fullName || existing.citizenName || profile.name || '',
          phone: formatSomaliPhone(details.phone || existing.citizen?.phone || profile.phone),
          mistakeType: details.mistakeType || '',
          selectedFields: details.selectedFields?.length ? details.selectedFields : changes.map((change) => change.field),
          changes: hydrateChangesFromRegistration(changes, existingRegistration || existing, profile),
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
                currentValue: currentValueFromRegistration(existingRegistration, field, activeUser),
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
    const sourceRegistration = existingRegistration || resubmitRequest;
    const hydratedChanges = hydrateChangesFromRegistration(form.changes, sourceRegistration, activeUser);
    const required = [
      ['fullName', 'Full name is required.']
    ];
    const missing = required.find(([field]) => !String(form[field] || '').trim());
    if (missing) {
      toast.error(missing[1]);
      return false;
    }
    if (!MISTAKE_TYPE_OPTIONS.includes(form.mistakeType)) {
      toast.error('Please select type mistake.');
      return false;
    }
    if (form.changes.length === 0) {
      toast.error('Please select at least one field to update.');
      return false;
    }
    const incomplete = hydratedChanges.find((change) => (
      !String(change.field || '').trim()
        || !String(change.currentValue || '').trim()
        || !String(change.newValue || '').trim()
        || !String(change.reason || '').trim()
    ));
    if (incomplete) {
      toast.error('Each selected field needs current value, new value, and reason.');
      return false;
    }
    const unchanged = getUnchangedUpdateField(hydratedChanges);
    if (unchanged) {
      toast.error(`${unchanged.field} cannot be updated because the new value is the same as the current value.`);
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
    if (!resubmitId && pendingUpdateRequest) {
      toast.error(`You already have a pending Update Information request (${pendingUpdateRequest.ref || 'open request'}). Please wait until it is reviewed.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        serviceId: service._id || service.id,
        citizenName: form.fullName,
        updateDetails: {
          nationalIdNumber: form.nationalIdNumber,
          fullName: form.fullName,
          phone: form.phone,
          mistakeType: form.mistakeType,
          selectedFields: form.selectedFields,
          changes: hydrateChangesFromRegistration(form.changes, existingRegistration || resubmitRequest, activeUser),
          notes: form.notes
        }
      };
      const resubmitRequestId = resubmitRequest?._id || resubmitRequest?.id || resubmitRequest?.ref || resubmitId;
      if (!resubmitRequestId) {
        const otpResponse = await api.post('/api/otp/request', {
          purpose: 'update_information',
          phone: form.phone
        });
        sessionStorage.setItem('nqs_pending_otp_flow', JSON.stringify({
          purpose: 'update_information',
          phone: otpResponse.data?.data?.phone || form.phone,
          otpId: otpResponse.data?.data?.otpId,
          finalRequest: {
            method: 'post',
            url: '/api/bookings',
            payload
          },
          successPath: '/dashboard/user/appointments',
          successMessage: 'Update request submitted successfully.'
        }));
        toast.success('OTP sent.');
        navigate('/otp-verification?purpose=update_information');
        return;
      }

      const res = await apiClient.put(`/api/bookings/${resubmitRequestId}/resubmit`, payload);
      setRequest(res.data || {});
      setResubmitRequest(null);
      toast.success(resubmitRequest ? 'Update request resubmitted successfully.' : 'Update request submitted successfully.');
    } catch (error) {
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

        {pendingUpdateRequest && !resubmitRequest && !request && (
          <section className="rounded-2xl border border-amber-400/40 bg-amber-950/30 p-4 text-amber-100">
            <p className="text-xs font-black uppercase tracking-wide text-amber-200">Update request already pending</p>
            <p className="mt-1 text-sm font-semibold">
              You already submitted Update Information request {pendingUpdateRequest.ref || ''}. Please wait until the Center or Admin reviews it.
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

        {!existingRegistration && !resubmitRequest && !request ? (
          <section className={panelClass}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <FiEdit3 />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Book your first National ID appointment first</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Update Information is available only after you have submitted a New National ID Registration request.
                </p>
                <Link
                  to="/dashboard/user/new-id-registration"
                  className="mt-4 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800"
                >
                  Book Appointment
                </Link>
              </div>
            </div>
          </section>
        ) : request ? (
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
              <Info label="National ID Number" value={form.nationalIdNumber || 'Not issued yet'} />
              <Info label="Full Name" value={form.fullName} />
              <Info label="Phone Number" value={form.phone} />
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
                value={form.nationalIdNumber || 'Not issued yet'}
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
              <Field
                label="Registered Phone Number"
                value={form.phone}
                onChange={() => {}}
                readOnly
                helper="Loaded from your New National ID registration."
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label>
                <span className={labelClass}>Select Type Mistake</span>
                <select
                  value={form.mistakeType}
                  onChange={(event) => updateForm('mistakeType', event.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose mistake type</option>
                  {MISTAKE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
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
              {form.changes.map((change) => {
                const currentValue = change.currentValue || currentValueFromRegistration(existingRegistration, change.field, activeUser);
                const isMaritalStatusField = String(change.field || '').toLowerCase().includes('marital');
                const maritalStatusOptions = getMaritalStatusOptions(currentValue);

                return (
                  <div key={change.field} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <h3 className="mb-3 text-sm font-black text-[#7CB8FF]">{change.field}</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Field
                        label="Current Value"
                        value={currentValue}
                        onChange={() => {}}
                        readOnly
                        helper="Read from your existing record."
                      />
                      {isMaritalStatusField ? (
                        <label>
                          <span className={labelClass}>New Value</span>
                          <select
                            value={change.newValue}
                            onChange={(event) => updateChange(change.field, 'newValue', event.target.value)}
                            className={inputClass}
                          >
                            <option value="">Select new marital status</option>
                            {maritalStatusOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <Field label="New Value" value={change.newValue} onChange={(value) => updateChange(change.field, 'newValue', value)} />
                      )}
                      <Field label="Reason" value={change.reason} onChange={(value) => updateChange(change.field, 'reason', value)} />
                    </div>
                  </div>
                );
              })}
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
              <button disabled={submitting || (!existingRegistration && !resubmitRequest)} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
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
