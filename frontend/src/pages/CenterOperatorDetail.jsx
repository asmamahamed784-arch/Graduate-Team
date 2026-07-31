import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiEye,
  FiFileText,
  FiList,
  FiMapPin,
  FiPhone,
  FiRepeat,
  FiSave,
  FiShield,
  FiUserPlus,
  FiUsers,
  FiX,
  FiXCircle
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks';
import {
  canCancelAppointment,
  canCompleteAppointment,
} from '../utils/appointmentActions';
import { INCORRECT_FIELD_OPTIONS } from '../utils/cancellationFields';
import { getChangedUpdateFields } from '../utils/updateRequestFields';

const emptyForm = {
  name: '',
  username: '',
  phone: '',
  center: '',
  operatorType: 'operator',
  status: 'active',
  temporaryPassword: ''
};

const getRequestTypeLabel = (requestType) => {
  if (requestType === 'lost_replacement') return 'Lost ID Replacement';
  if (requestType === 'update_information') return 'Update Information Request';
  return 'New Registration';
};

const statusLabel = (status = '') => String(status || 'active').replace(/_/g, ' ');

const statusClass = (status = '') => {
  if (status === 'active') return 'bg-emerald-500/15 text-emerald-300';
  if (status === 'pending_approval') return 'bg-amber-500/15 text-amber-200';
  if (status === 'rejected') return 'bg-red-500/15 text-red-300';
  return 'bg-slate-500/15 text-slate-300';
};

const appointmentStatusClass = (status = '') => {
  const normalized = normalizeStatus(status);
  if (['completed', 'complete'].includes(normalized)) return 'bg-emerald-500/15 text-emerald-300';
  if (['cancelled', 'canceled', 'rejected', 'resubmission required', 'correction required'].includes(normalized)) return 'bg-red-500/15 text-red-300';
  if (['being served', 'in progress'].includes(normalized)) return 'bg-blue-500/15 text-blue-200';
  return 'bg-amber-500/15 text-amber-200';
};

const inputClass = 'w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text-main)] outline-none focus:border-[#4189DD] focus:ring-4 focus:ring-blue-500/20 disabled:opacity-80';

const formatSomaliPhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('25261')) return `+${digits.slice(0, 12)}`;
  if (digits.startsWith('061')) return `+252${digits.slice(1, 10)}`;
  if (digits.startsWith('61')) return `+252${digits.slice(0, 9)}`;
  return `+25261${digits.slice(0, 7)}`;
};

const isValidSomaliPhone = (value = '') => /^\+25261\d{7}$/.test(formatSomaliPhone(value));

const phoneTailFromValue = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('25261')) return digits.slice(5, 12);
  if (digits.startsWith('061')) return digits.slice(3, 10);
  if (digits.startsWith('61')) return digits.slice(2, 9);
  return digits.slice(0, 7);
};

const SomaliPhoneField = ({ value, onChange }) => (
  <div className="flex overflow-hidden rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] focus-within:border-[#4189DD] focus-within:ring-4 focus-within:ring-blue-500/20">
    <span className="flex items-center gap-2 border-r border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-3 text-sm font-black text-[var(--text-main)]">
      <FiPhone className="text-[var(--text-muted)]" />
      +252 61
    </span>
    <input
      type="tel"
      inputMode="numeric"
      maxLength={7}
      autoComplete="off"
      value={phoneTailFromValue(value)}
      onChange={(event) => onChange(formatSomaliPhone(event.target.value.replace(/\D/g, '').slice(0, 7)))}
      placeholder="8318172"
      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
    />
  </div>
);

const roleLabel = (operator = {}) => {
  const type = String(operator.operatorType || operator.role || '').toLowerCase();
  if (type === 'super_operator' || type === 'center_manager') return 'Center Manager';
  return 'Operator';
};

const normalizeStatus = (value = '') => String(value || '').trim().toLowerCase();

const isWaitingAppointment = (appointment) => {
  const status = normalizeStatus(appointment.status);
  const requestStatus = normalizeStatus(appointment.requestStatus);
  return ['waiting', 'pending', 'scheduled', 'on hold', 'resubmitted'].includes(status)
    || ['pending', 'approved', 'resubmission required'].includes(requestStatus);
};

const isCompletedAppointment = (appointment) => normalizeStatus(appointment.status) === 'completed'
  || normalizeStatus(appointment.requestStatus) === 'completed';

const getRequestGroup = (appointment) => {
  const rawValue = [
    appointment.requestType,
    appointment.service?.name,
    appointment.service?.category
  ].filter(Boolean).join(' ').toLowerCase();

  if (rawValue.includes('update')) return 'updateInformation';
  if (rawValue.includes('lost') || rawValue.includes('replace')) return 'replaceLostId';
  return 'newRegistration';
};

const getQueueNumber = (appointment) => {
  if (appointment.queueNumber) return appointment.queueNumber;
  const digits = String(appointment.ref || '').replace(/\D/g, '');
  return digits || '--';
};

const getAppointmentId = (appointment) => appointment?._id || appointment?.id || appointment?.ref;

const getDisplayStatus = (appointment = {}) => {
  const requestStatus = appointment.requestStatus || '';
  const status = appointment.status || '';
  if (normalizeStatus(requestStatus) === 'resubmission required') return 'Correction Required';
  if (normalizeStatus(status) === 'being served') return 'Serving';
  return status || requestStatus || 'Pending';
};

const titleCase = (value = '') => String(value || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  .join(' ');

const formatAppointmentDate = (value) => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getAppointmentDate = (appointment) => (
  appointment.date
  || appointment.registrationDetails?.appointmentDate
  || appointment.existingRegistration?.date
  || ''
);

const getAppointmentTime = (appointment) => (
  appointment.timeSlot
  || appointment.registrationDetails?.appointmentTime
  || appointment.existingRegistration?.timeSlot
  || '--'
);

const getCitizenPhone = (appointment) => (
  appointment.registrationDetails?.phone
  || appointment.replacementDetails?.phone
  || appointment.updateDetails?.phone
  || appointment.citizen?.phone
  || 'No Data'
);

const getCitizenName = (appointment) => titleCase(
  appointment.citizenName
  || appointment.registrationDetails?.fullName
  || appointment.replacementDetails?.fullName
  || appointment.updateDetails?.fullName
  || appointment.citizen?.name
  || 'No Data'
);

const getServiceName = (appointment) => appointment.service?.name || appointment.existingRegistration?.serviceType || 'National ID Service';

const getCenterName = (appointment) => appointment.center?.name || appointment.existingRegistration?.centerName || 'No center';

const isCancelledAppointment = (appointment) => {
  const status = normalizeStatus(appointment?.status);
  const requestStatus = normalizeStatus(appointment?.requestStatus);
  return ['cancelled', 'canceled', 'rejected'].includes(status)
    || ['rejected', 'resubmission required'].includes(requestStatus);
};

const PANEL_KEYS = ['allAppointments', 'waiting', 'completed', 'newRegistration', 'updateInformation', 'replaceLostId', 'staff'];

const CenterOperatorDetail = () => {
  const { centerKey = '', panel: panelParam = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'super_admin';
  const decodedCenterKey = decodeURIComponent(centerKey);
  const requestedPanel = PANEL_KEYS.includes(panelParam)
    ? panelParam
    : (PANEL_KEYS.includes(searchParams.get('panel')) ? searchParams.get('panel') : null);
  const isOverview = !requestedPanel;
  const activePanel = requestedPanel || 'allAppointments';
  const [centerStats, setCenterStats] = useState([]);
  const [operators, setOperators] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [cancelModalTicket, setCancelModalTicket] = useState(null);
  const [selectedCancelReasons, setSelectedCancelReasons] = useState([]);
  const [cancelNotes, setCancelNotes] = useState('');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [completeOtpTarget, setCompleteOtpTarget] = useState(null);
  const [completeOtp, setCompleteOtp] = useState('');
  const [completeOtpLoading, setCompleteOtpLoading] = useState(false);
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);

  const centerBasePath = `/dashboard/admin/operators/center/${encodeURIComponent(decodedCenterKey)}`;
  const openPanel = (panelKey) => navigate(`${centerBasePath}/${panelKey}`);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, operatorsRes, appointmentsRes] = await Promise.all([
        api.get('/api/operators/center-stats'),
        api.get('/api/operators'),
        api.get('/api/bookings/admin/all')
      ]);
      setCenterStats(statsRes.data.data || []);
      setOperators(operatorsRes.data.data || []);
      setAppointments(appointmentsRes.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load center details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Redirect legacy ?panel= links to dedicated pages.
  useEffect(() => {
    const legacyPanel = searchParams.get('panel');
    if (!panelParam && PANEL_KEYS.includes(legacyPanel)) {
      navigate(`${centerBasePath}/${legacyPanel}`, { replace: true });
    }
  }, [centerBasePath, navigate, panelParam, searchParams]);

  const center = useMemo(
    () => centerStats.find((item) => item.centerId === decodedCenterKey || item.centerKey === decodedCenterKey),
    [centerStats, decodedCenterKey]
  );

  const centerOperators = useMemo(() => {
    const allowedCenterIds = new Set([...(center?.centerIds || []), center?.centerId].filter(Boolean).map(String));
    return operators.filter((operator) => {
      const operatorCenterId = operator.center?._id || operator.center;
      return allowedCenterIds.has(String(operatorCenterId || ''));
    });
  }, [center, operators]);

  const centerAppointments = useMemo(() => {
    const allowedCenterIds = new Set([...(center?.centerIds || []), center?.centerId].filter(Boolean).map(String));
    if (!allowedCenterIds.size) return [];

    return appointments.filter((appointment) => {
      const appointmentCenterId = appointment.center?._id || appointment.center || appointment.existingRegistration?.centerId;
      const centerNameMatches = getCenterName(appointment) === center?.centerName;
      return allowedCenterIds.has(String(appointmentCenterId || '')) || centerNameMatches;
    });
  }, [appointments, center]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreateOperator = () => {
    setEditingId('');
    setForm({
      ...emptyForm,
      center: center?.centerIds?.[0] || '',
      operatorType: 'operator'
    });
    setOperatorModalOpen(true);
  };

  const editOperator = (operator) => {
    setEditingId(operator._id);
    setForm({
      name: operator.name || '',
      username: operator.username || '',
      phone: operator.phone || '',
      center: operator.center?._id || operator.center || center?.centerIds?.[0] || '',
      operatorType: 'operator',
      status: operator.status || 'active',
      temporaryPassword: ''
    });
    setOperatorModalOpen(true);
  };

  const closeOperatorModal = () => {
    setOperatorModalOpen(false);
    setEditingId('');
    setForm({ ...emptyForm, center: center?.centerIds?.[0] || '' });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!isValidSomaliPhone(form.phone)) {
      toast.error('Phone number must be a valid Somali number.');
      return;
    }
    try {
      const payload = {
        ...form,
        phone: formatSomaliPhone(form.phone),
        center: center?.centerIds?.[0] || form.center,
        operatorType: 'operator',
        email: undefined
      };

      if (editingId) {
        await api.put(`/api/operators/${editingId}`, payload);
        toast.success('Operator updated.');
      } else {
        await api.post('/api/operators', payload);
        toast.success('Operator created and sent for Super Admin approval.');
      }

      closeOperatorModal();
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save operator.');
    }
  };

  const setOperatorStatus = async (operator, status) => {
    if (!isAdmin) return;
    try {
      const endpoint = status === 'active'
        ? (operator.status === 'pending_approval' ? 'approve' : 'activate')
        : 'deactivate';
      await api.put(`/api/operators/${operator._id}/${endpoint}`);
      toast.success(status === 'active' ? 'Operator is active now.' : 'Operator deactivated.');
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update operator status.');
    }
  };

  const handleCompleteAppointment = async (appointment) => {
    const appointmentId = getAppointmentId(appointment);
    if (!appointmentId) return;
    setActionLoading(`complete-${appointmentId}`);
    try {
      const otpRequest = await api.post('/api/otp/request', {
        purpose: 'complete_service',
        ticketId: appointmentId
      });
      setCompleteOtpTarget({
        ...appointment,
        completeOtpId: otpRequest.data?.data?.otpId,
        completeOtpPhone: otpRequest.data?.data?.phone
      });
      setCompleteOtp('');
      toast.success('OTP sent to citizen phone.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to send complete-service OTP.');
    } finally {
      setActionLoading('');
    }
  };

  const verifyCompleteOtp = async () => {
    if (!completeOtpTarget || completeOtp.length !== 6) {
      toast.error('Enter the 6-digit OTP from the SMS.');
      return;
    }

    const appointmentId = getAppointmentId(completeOtpTarget);
    setCompleteOtpLoading(true);
    try {
      const otpRes = await api.post('/api/otp/verify', {
        purpose: 'complete_service',
        ticketId: appointmentId,
        otpId: completeOtpTarget.completeOtpId,
        code: completeOtp.trim()
      });
      await api.put(`/api/bookings/admin/${appointmentId}/status`, {
        status: 'Completed',
        otpToken: otpRes.data?.data?.verificationToken
      });
      toast.success(`Ticket ${completeOtpTarget.ref || ''} completed and citizen notified.`);
      setCompleteOtpTarget(null);
      setCompleteOtp('');
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid OTP.');
    } finally {
      setCompleteOtpLoading(false);
    }
  };

  const openCancelModal = (appointment) => {
    if (!canCancelAppointment(appointment)) {
      toast.info('This appointment is already closed and cannot be cancelled.');
      return;
    }
    setCancelModalTicket(appointment);
    setSelectedCancelReasons([]);
    setCancelNotes('');
    setCustomCancelReason('');
    setShowCancelConfirmation(false);
  };

  const closeCancelModal = () => {
    setCancelModalTicket(null);
    setSelectedCancelReasons([]);
    setCancelNotes('');
    setCustomCancelReason('');
    setShowCancelConfirmation(false);
  };

  const toggleCancelReason = (reason) => {
    setShowCancelConfirmation(false);
    setSelectedCancelReasons((current) =>
      current.includes(reason)
        ? current.filter((item) => item !== reason)
        : [...current, reason]
    );
  };

  const selectedReasonLabels = () =>
    selectedCancelReasons.filter((reason) => INCORRECT_FIELD_OPTIONS.includes(reason));

  const handleCancelAppointment = async (appointment, cancelData = {}) => {
    const appointmentId = getAppointmentId(appointment);
    if (!appointmentId) return;
    setActionLoading(`cancel-${appointmentId}`);
    try {
      await api.put(`/api/bookings/${appointmentId}/cancel`, {
        cancellationReason: cancelData.cancellationReason || 'Cancelled by center staff',
        cancellationReasons: cancelData.cancellationReasons || [],
        additionalNotes: cancelData.additionalNotes || '',
      });
      toast.success(`Ticket ${appointment.ref || ''} cancelled. Citizen has been notified.`);
      closeCancelModal();
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to cancel this appointment.');
    } finally {
      setActionLoading('');
    }
  };

  const submitCancel = () => {
    if (!cancelModalTicket) return;
    const isUpdateReq = cancelModalTicket.requestType === 'update_information';

    if (isUpdateReq) {
      const changedFields = getChangedUpdateFields(cancelModalTicket);
      if (!changedFields.length) {
        toast.error('No changes detected. Cancellation is not required.');
        return;
      }
      if (!customCancelReason.trim()) {
        toast.error('Please enter a cancellation reason.');
        return;
      }
      if (!showCancelConfirmation) {
        setShowCancelConfirmation(true);
        return;
      }
      const reason = customCancelReason.trim();
      handleCancelAppointment(cancelModalTicket, {
        cancellationReasons: [reason],
        cancellationReason: reason,
        additionalNotes: '',
      });
      return;
    }

    const validReasons = selectedReasonLabels();
    if (!validReasons.length) {
      toast.error('Please select at least one incorrect field.');
      return;
    }
    if (!showCancelConfirmation) {
      setShowCancelConfirmation(true);
      return;
    }
    handleCancelAppointment(cancelModalTicket, {
      cancellationReasons: validReasons,
      cancellationReason: validReasons.join(', '),
      additionalNotes: cancelNotes.trim(),
    });
  };

  const stats = center?.stats || {};
  const statCards = [
    { key: 'allAppointments', label: 'All History', value: centerAppointments.length || stats.allAppointments || 0, helper: 'All center records', icon: FiList, color: 'text-blue-600 dark:text-[#7CB8FF]' },
    { key: 'waiting', label: 'Waiting', value: stats.waiting || centerAppointments.filter(isWaitingAppointment).length || 0, helper: 'Waiting and on-hold work', icon: FiClock, color: 'text-amber-600 dark:text-amber-300' },
    { key: 'completed', label: 'Completed', value: stats.completed || centerAppointments.filter(isCompletedAppointment).length || 0, helper: 'Completed services', icon: FiCheckCircle, color: 'text-emerald-600 dark:text-emerald-300' },
    { key: 'newRegistration', label: 'New Registration', value: stats.newRegistration || centerAppointments.filter((appointment) => getRequestGroup(appointment) === 'newRegistration').length || 0, helper: 'New National ID requests', icon: FiShield, color: 'text-blue-600 dark:text-[#7CB8FF]' },
    { key: 'updateInformation', label: 'Update Info', value: stats.updateInformation || centerAppointments.filter((appointment) => getRequestGroup(appointment) === 'updateInformation').length || 0, helper: 'Information update requests', icon: FiFileText, color: 'text-sky-600 dark:text-sky-300' },
    { key: 'replaceLostId', label: 'Replace Lost ID', value: stats.replaceLostId || centerAppointments.filter((appointment) => getRequestGroup(appointment) === 'replaceLostId').length || 0, helper: 'Lost ID requests', icon: FiRepeat, color: 'text-purple-600 dark:text-purple-300' },
    { key: 'staff', label: 'Staff', value: centerOperators.length, helper: 'Operators in this center', icon: FiUsers, color: 'text-indigo-600 dark:text-indigo-300' }
  ];

  const appointmentPanels = useMemo(() => ({
    allAppointments: {
      title: 'Center Appointment History',
      description: 'All appointments, update requests, lost ID requests, waiting work, and completed work for this center.',
      rows: centerAppointments
    },
    waiting: {
      title: 'Waiting Appointments',
      description: 'Appointments currently waiting, pending, being served, or on hold.',
      rows: centerAppointments.filter(isWaitingAppointment)
    },
    completed: {
      title: 'Completed Services',
      description: 'Completed appointments for this center.',
      rows: centerAppointments.filter(isCompletedAppointment)
    },
    newRegistration: {
      title: 'New National ID Registration',
      description: 'New National ID requests submitted to this center.',
      rows: centerAppointments.filter((appointment) => getRequestGroup(appointment) === 'newRegistration')
    },
    updateInformation: {
      title: 'Update National ID Information',
      description: 'Information update requests submitted to this center.',
      rows: centerAppointments.filter((appointment) => getRequestGroup(appointment) === 'updateInformation')
    },
    replaceLostId: {
      title: 'Replace Lost National ID',
      description: 'Lost ID replacement requests submitted to this center.',
      rows: centerAppointments.filter((appointment) => getRequestGroup(appointment) === 'replaceLostId')
    }
  }), [centerAppointments]);

  const activeAppointmentPanel = appointmentPanels[activePanel];

  if (!loading && !center) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] p-4 text-[var(--text-main)] sm:p-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-8 text-center">
          <h1 className="text-2xl font-black">Center not found</h1>
          <p className="mt-2 text-[var(--text-muted)]">This center record is no longer available.</p>
          <button
            type="button"
            onClick={() => navigate('/operator-management')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#4189DD] px-5 py-3 text-sm font-black text-white"
          >
            <FiArrowLeft /> Back to Operators
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nqs-center-detail min-h-screen bg-[var(--bg-app)] p-4 text-[var(--text-main)] sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border-light)] bg-[var(--bg-card)] shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1d4ed8] via-[#3b82f6] to-[#60a5fa]" />
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#2563EB]/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate(isOverview ? '/operator-management' : centerBasePath)}
                className="mb-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-black text-[var(--text-main)] transition hover:border-[#2563EB] hover:text-[#2563EB]"
              >
                <FiArrowLeft /> {isOverview ? 'Back to centers' : 'Back to center cards'}
              </button>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#2563EB]">
                <FiMapPin className="text-xs" />
                {titleCase(center?.district || 'District')}
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                {titleCase(center?.centerName || 'Center Details')}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-3 py-1.5">
                  <FiMapPin className="text-[#2563EB]" /> {titleCase(center?.address || 'No address recorded')}
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-3 py-1.5">
                  <FiPhone className="text-[#2563EB]" /> {center?.phone || 'No phone recorded'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={openCreateOperator}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-[#1d4ed8]"
            >
              <FiUserPlus /> Create Staff
            </button>
          </div>
        </header>

        {isOverview ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                type="button"
                key={card.key}
                onClick={() => openPanel(card.key)}
                className="group relative overflow-hidden rounded-[1.5rem] border border-[var(--border-light)] bg-[var(--bg-card)] p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#2563EB] hover:shadow-xl hover:shadow-blue-950/10 focus:outline-none focus:ring-4 focus:ring-blue-500/15"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#2563EB] to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--nqs-panel-soft)] text-xl">
                    <Icon className={card.color} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xl font-black tracking-tight">{card.value}</p>
                    <p className="text-sm font-black text-[var(--text-main)]">{card.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{card.helper}</p>
                    <p className="mt-2 text-[11px] font-black text-[#2563EB]">
                      Open separate page →
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        ) : (
        <>
        <div className="rounded-[1.25rem] border border-[var(--border-light)] bg-[var(--bg-card)] p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Open page</span>
            {statCards.map((card) => {
              const active = activePanel === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => openPanel(card.key)}
                  className={`rounded-xl border px-3.5 py-2 text-xs font-black transition ${
                    active
                      ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-sm shadow-blue-600/20'
                      : 'border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-main)] hover:border-[#2563EB] hover:text-[#2563EB]'
                  }`}
                >
                  {card.label}
                  <span className={`ml-1.5 ${active ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>({card.value})</span>
                </button>
              );
            })}
          </div>
        </div>

        <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border-light)] bg-[var(--bg-card)] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[var(--border-light)] bg-[var(--nqs-panel-soft)]/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight">
                {activePanel === 'staff' ? 'Staff and Operators' : activeAppointmentPanel?.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {activePanel === 'staff'
                  ? 'Only accounts assigned to this center are shown here.'
                  : activeAppointmentPanel?.description}
              </p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-[#2563EB]/12 px-3.5 py-1.5 text-xs font-black text-[#2563EB]">
              {activePanel === 'staff' ? `${centerOperators.length} staff` : `${activeAppointmentPanel?.rows?.length || 0} records`}
            </span>
          </div>

          <div className="overflow-x-auto">
            {activePanel === 'staff' ? (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--nqs-panel-soft)] text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    {['Name', 'Username', 'Phone', 'Type', 'Status', 'Password', ...(isAdmin ? ['Admin Approval'] : [])].map((heading) => (
                      <th key={heading} className="px-4 py-3.5 font-black">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {loading ? (
                    <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-10 text-center text-[var(--text-muted)]">Loading center staff...</td></tr>
                  ) : centerOperators.length === 0 ? (
                    <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-10 text-center text-[var(--text-muted)]">No staff created for this center yet.</td></tr>
                  ) : centerOperators.map((operator) => (
                    <tr key={operator._id} className="transition hover:bg-blue-500/5">
                      <td className="px-4 py-3.5 font-semibold">{titleCase(operator.name)}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-[#2563EB]">{operator.username}</td>
                      <td className="px-4 py-3.5 text-[var(--text-muted)]">{operator.phone || '--'}</td>
                      <td className="px-4 py-3.5 text-[var(--text-muted)]">{roleLabel(operator)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusClass(operator.status)}`}>
                          {statusLabel(operator.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[var(--text-muted)]">Hidden</td>
                      {isAdmin && (
                        <td className="px-4 py-3.5">
                          {operator.status === 'active' ? (
                            <button onClick={() => setOperatorStatus(operator, 'inactive')} className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-bold text-red-500">Deactivate</button>
                          ) : (
                            <button onClick={() => setOperatorStatus(operator, 'active')} className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-600">
                              {operator.status === 'pending_approval' ? 'Approve' : 'Activate'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--nqs-panel-soft)] text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    {['Ticket Number', 'Citizen Name', 'Phone', 'Appointment Date', 'Queue Number', 'Status', 'Actions'].map((heading) => (
                      <th key={heading} className="px-4 py-3.5 font-black">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {loading ? (
                    <tr><td colSpan="7" className="px-4 py-10 text-center text-[var(--text-muted)]">Loading center appointments...</td></tr>
                  ) : !activeAppointmentPanel?.rows?.length ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-10 text-center text-[var(--text-muted)]">
                        No {activeAppointmentPanel?.title?.toLowerCase() || 'appointment'} records found for this center.
                      </td>
                    </tr>
                  ) : activeAppointmentPanel.rows.map((appointment) => {
                    const appointmentId = getAppointmentId(appointment);
                    const displayStatus = getDisplayStatus(appointment);
                    const isBusy = actionLoading.endsWith(`-${appointmentId}`);
                    const canComplete = canCompleteAppointment(appointment);
                    const canCancel = canCancelAppointment(appointment);

                    return (
                      <tr key={appointmentId} className="transition hover:bg-blue-500/5">
                        <td className="px-4 py-3.5 font-black text-[#2563EB]">{appointment.ref || '--'}</td>
                        <td className="px-4 py-3.5 font-semibold">{getCitizenName(appointment)}</td>
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">{getCitizenPhone(appointment)}</td>
                        <td className="px-4 py-3.5 text-[var(--text-muted)]">
                          <span className="block font-semibold text-[var(--text-main)]">{formatAppointmentDate(getAppointmentDate(appointment))}</span>
                          <span className="block text-xs">{getAppointmentTime(appointment)}</span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[var(--text-main)]">{getQueueNumber(appointment)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${appointmentStatusClass(displayStatus)}`}>
                            {displayStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedAppointment(appointment)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              <FiEye /> View
                            </button>
                            {canComplete && (
                              <button
                                type="button"
                                onClick={() => handleCompleteAppointment(appointment)}
                                disabled={Boolean(actionLoading)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <FiCheckCircle /> Complete
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => openCancelModal(appointment)}
                                disabled={isBusy || Boolean(actionLoading)}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <FiXCircle /> Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
        </>
        )}
      </div>

      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-main)] shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-light)] bg-blue-500/5 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7CB8FF]">Appointment Details</p>
                <h2 className="mt-1 text-2xl font-black">{selectedAppointment.ref || 'Appointment'}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="rounded-xl border border-[var(--border-light)] p-2 text-[var(--text-muted)] transition hover:border-red-400 hover:text-red-500"
                aria-label="Close appointment details"
              >
                <FiX />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-5 text-sm sm:grid-cols-2">
              {[
                ['Citizen Name', getCitizenName(selectedAppointment)],
                ['Phone', getCitizenPhone(selectedAppointment)],
                ['Service', getServiceName(selectedAppointment)],
                ['Center', getCenterName(selectedAppointment)],
                ['Appointment Date', formatAppointmentDate(getAppointmentDate(selectedAppointment))],
                ['Appointment Time', getAppointmentTime(selectedAppointment)],
                ['Queue Number', getQueueNumber(selectedAppointment)],
                ['Status', getDisplayStatus(selectedAppointment)],
                ['Request Type', selectedAppointment.requestType || 'New ID Registration'],
                ['Request Status', selectedAppointment.requestStatus || '--']
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-app)] p-3">
                  <span className="block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
                  <span className="mt-1 block font-bold text-[var(--text-main)]">{value || '--'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cancelModalTicket && (() => {
        const isUpdateReq = cancelModalTicket.requestType === 'update_information';
        const changedFields = isUpdateReq ? getChangedUpdateFields(cancelModalTicket) : [];
        const hasNoChanges = isUpdateReq && changedFields.length === 0;

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
          <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6 text-[var(--text-main)] shadow-2xl shadow-black/40 ${isUpdateReq ? 'max-w-lg' : 'max-w-2xl'}`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Operator Action</p>
                <h2 className="mt-1 text-2xl font-black">
                  {isUpdateReq ? 'Cancel Update Request' : 'Cancel Appointment'}
                </h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {isUpdateReq
                    ? 'Review the changed information and provide a cancellation reason for this update request.'
                    : 'Select the incorrect fields. The citizen will receive this feedback and can resubmit from their dashboard.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-xl border border-[var(--border-light)] p-2 text-[var(--text-muted)] transition hover:border-red-400 hover:text-red-500"
                aria-label="Close cancel appointment modal"
              >
                <FiX />
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-app)] p-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Ticket Reference</p>
                  <p className="mt-1 font-mono text-sm font-black text-[#7CB8FF]">{cancelModalTicket.ref || '--'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Citizen</p>
                  <p className="mt-1 text-sm font-black">{getCitizenName(cancelModalTicket)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Request Type</p>
                  <p className="mt-1 text-sm font-black">{getRequestTypeLabel(cancelModalTicket.requestType)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Current Status</p>
                  <p className="mt-1 text-sm font-black">{getDisplayStatus(cancelModalTicket)}</p>
                </div>
              </div>
            </div>

            {isUpdateReq ? (
              <div className="mt-5 space-y-4">
                {hasNoChanges ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
                    No changes detected. Cancellation is not required.
                  </div>
                ) : (
                  <div>
                    <span className="text-sm font-bold">Changed Information</span>
                    <div className="mt-2 overflow-hidden rounded-xl border border-[var(--border-light)]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--bg-app)] font-black uppercase text-[var(--text-muted)]">
                          <tr>
                            <th className="px-3 py-2">Field</th>
                            <th className="px-3 py-2">Previous Information</th>
                            <th className="px-3 py-2">Requested Information</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] bg-[var(--bg-card)]">
                          {changedFields.map((field, index) => (
                            <tr key={`${field.field}-${index}`}>
                              <td className="px-3 py-2 font-bold text-[#7CB8FF]">{field.field}</td>
                              <td className="px-3 py-2 text-[var(--text-muted)] line-through">{field.oldValue}</td>
                              <td className="px-3 py-2 font-bold text-emerald-500">{field.newValue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!hasNoChanges && (
                  <label className="block">
                    <span className="text-sm font-bold">Cancellation Reason</span>
                    <textarea
                      value={customCancelReason}
                      onChange={(event) => {
                        setShowCancelConfirmation(false);
                        setCustomCancelReason(event.target.value);
                      }}
                      rows={3}
                      placeholder="Enter the reason for cancelling this update request"
                      className="mt-2 w-full resize-none rounded-xl border border-[var(--border-light)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-[#4189DD] focus:ring-4 focus:ring-blue-500/20"
                    />
                  </label>
                )}
              </div>
            ) : (
              <>
                <div className="mt-5">
                  <span className="text-sm font-bold">Select incorrect fields</span>
                  <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-[var(--border-light)] bg-[var(--bg-app)] p-3 sm:grid-cols-2">
                    {INCORRECT_FIELD_OPTIONS.map((reason) => {
                      const checked = selectedCancelReasons.includes(reason);
                      return (
                        <label
                          key={reason}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                            checked
                              ? 'border-blue-500 bg-blue-500/10 text-[#7CB8FF]'
                              : 'border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-main)] hover:border-blue-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCancelReason(reason)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                          />
                          <span>{reason}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="text-sm font-bold">Additional notes</span>
                  <textarea
                    value={cancelNotes}
                    onChange={(event) => {
                      setShowCancelConfirmation(false);
                      setCancelNotes(event.target.value);
                    }}
                    rows={3}
                    placeholder="Citizen may submit a corrected request."
                    className="mt-2 w-full resize-none rounded-xl border border-[var(--border-light)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-[#4189DD] focus:ring-4 focus:ring-blue-500/20"
                  />
                </label>
              </>
            )}

            {showCancelConfirmation && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-black">Confirm cancellation</p>
                <p className="mt-2">
                  {isUpdateReq
                    ? `Cancellation reason: ${customCancelReason.trim()}. Are you sure you want to cancel this update request?`
                    : `You selected the following incorrect fields: ${selectedReasonLabels().join(', ')}. Are you sure you want to cancel this appointment?`}
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-5 py-3 text-sm font-black text-[var(--text-main)] hover:bg-blue-500/10"
              >
                Close
              </button>
              <button
                type="button"
                onClick={submitCancel}
                disabled={Boolean(actionLoading) || hasNoChanges}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? 'Cancelling...' : (isUpdateReq ? 'Confirm Cancel Update' : 'Confirm Cancellation')}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {completeOtpTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6 text-[var(--text-main)] shadow-2xl shadow-black/40">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black text-white">
                OTP
              </div>
              <h2 className="mt-4 text-xl font-black">Complete Service OTP</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Enter the 6-digit SMS code sent to {completeOtpTarget.completeOtpPhone || getCitizenPhone(completeOtpTarget)} for {completeOtpTarget.ref}.
              </p>
            </div>

            <input
              value={completeOtp}
              onChange={(event) => setCompleteOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="mt-6 w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-app)] px-4 py-3 text-center text-2xl font-black tracking-[0.4em] text-[var(--text-main)] outline-none focus:border-[#4189DD] focus:ring-4 focus:ring-blue-500/20"
            />

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCompleteOtpTarget(null);
                  setCompleteOtp('');
                }}
                className="flex-1 rounded-xl border border-[var(--border-light)] px-4 py-3 text-sm font-bold text-[var(--text-main)] hover:bg-blue-500/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completeOtpLoading || completeOtp.length !== 6}
                onClick={verifyCompleteOtp}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {completeOtpLoading ? 'Verifying...' : 'Verify & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {operatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <form
            onSubmit={submit}
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-main)] shadow-2xl shadow-black/40"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-light)] bg-blue-500/5 px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#4189DD]/15 text-[#7CB8FF]">
                  {editingId ? <FiEdit3 /> : <FiUserPlus />}
                </span>
                <div>
                  <h2 className="text-lg font-black">{editingId ? 'Edit Staff Account' : 'Create Staff Account'}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    This account will be assigned to {center?.centerName}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeOperatorModal}
                className="rounded-xl border border-[var(--border-light)] p-2 text-[var(--text-muted)] transition hover:border-red-400 hover:text-red-500"
                aria-label="Close operator modal"
              >
                <FiX />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Full Name</span>
                <input className={inputClass} placeholder="Operator full name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Username</span>
                <input className={inputClass} placeholder="username" value={form.username} onChange={(event) => updateField('username', event.target.value)} disabled={Boolean(editingId)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Phone Number</span>
                <SomaliPhoneField value={form.phone} onChange={(value) => updateField('phone', value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Account Type</span>
                <select className={inputClass} value="operator" onChange={(event) => updateField('operatorType', event.target.value)} disabled>
                  <option value="operator">Operator</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Status</span>
                <select className={inputClass} value={form.status} onChange={(event) => updateField('status', event.target.value)} disabled>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="rejected">Rejected</option>
                </select>
                <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">New staff accounts are activated only after Super Admin approval.</p>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Assigned Center</span>
                <input className={inputClass} value={center?.centerName || ''} disabled readOnly />
              </label>
              {!editingId && (
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Temporary Password</span>
                  <input className={inputClass} placeholder="Temporary password" type="password" value={form.temporaryPassword} onChange={(event) => updateField('temporaryPassword', event.target.value)} />
                </label>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-light)] px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeOperatorModal} className="rounded-xl border border-[var(--border-light)] px-5 py-2.5 text-sm font-bold text-[var(--text-main)] transition hover:bg-blue-500/10">
                Close
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4189DD] px-5 py-2.5 text-sm font-black text-white transition hover:bg-blue-500" type="submit">
                <FiSave /> {editingId ? 'Save Changes' : 'Create Staff'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default CenterOperatorDetail;
