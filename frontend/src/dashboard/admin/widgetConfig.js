/** Admin dashboard widget catalog + localStorage layout helpers */

export const WIDGET_STORAGE_KEY = 'nqs-admin-dashboard-widgets-v4';
export const WIDGET_ORDER_KEY = 'nqs-admin-dashboard-order-v4';

export const REQUIRED_WIDGETS = [
  'kpi_row',
  'service_breakdown',
  'queue_overview',
  'chart_activity',
  'chart_distribution',
  'center_performance',
  'system_alerts',
  'recent_appointments',
  'recent_activity'
];

export const DEFAULT_WIDGET_ORDER = [
  'kpi_row',
  'service_breakdown',
  'queue_overview',
  'chart_activity',
  'chart_distribution',
  'center_performance',
  'system_alerts',
  'recent_activity',
  'recent_appointments'
];

export const WIDGET_CATALOG = {
  kpi_row: {
    id: 'kpi_row',
    name: 'KPI Overview',
    description: 'Eight key National ID metrics in one overview row.',
    size: 'full',
    required: true,
    tag: '#Overview',
    preview: 'kpi'
  },
  service_breakdown: {
    id: 'service_breakdown',
    name: 'Service Breakdown',
    description: 'Requests, wait, done, and drop counts per service type.',
    size: 'xlarge',
    required: true,
    tag: '#Services',
    preview: 'kpi'
  },
  system_alerts: {
    id: 'system_alerts',
    name: 'System Alerts',
    description: 'Live operational alerts generated from real dashboard data.',
    size: 'large',
    required: true,
    tag: '#Alerts',
    preview: 'insights'
  },
  kpi_citizens: {
    id: 'kpi_citizens',
    name: 'Total Citizens',
    description: 'Registered citizens in the National ID system.',
    size: 'kpi',
    required: false,
    tag: '#Citizens',
    preview: 'kpi'
  },
  kpi_appointments: {
    id: 'kpi_appointments',
    name: 'Total Appointments',
    description: 'All National ID appointment bookings.',
    size: 'kpi',
    required: false,
    tag: '#Appointments',
    preview: 'kpi'
  },
  kpi_waiting: {
    id: 'kpi_waiting',
    name: 'Waiting Queue',
    description: 'Citizens currently waiting in queue.',
    size: 'kpi',
    required: false,
    tag: '#Queue',
    preview: 'kpi'
  },
  kpi_completed: {
    id: 'kpi_completed',
    name: 'Completed Today',
    description: 'Appointments completed today.',
    size: 'kpi',
    required: false,
    tag: '#Performance',
    preview: 'kpi'
  },
  kpi_updates: {
    id: 'kpi_updates',
    name: 'Update Requests',
    description: 'National ID information update requests.',
    size: 'kpi',
    required: false,
    tag: '#Requests',
    preview: 'kpi'
  },
  kpi_lost: {
    id: 'kpi_lost',
    name: 'Lost ID Requests',
    description: 'Lost National ID replacement requests.',
    size: 'kpi',
    required: false,
    tag: '#Requests',
    preview: 'kpi'
  },
  cancelled_requests: {
    id: 'cancelled_requests',
    name: 'Cancelled Requests',
    description: 'Cancelled appointment count.',
    size: 'kpi',
    required: false,
    tag: '#Operations',
    preview: 'kpi'
  },
  chart_activity: {
    id: 'chart_activity',
    name: 'Appointment Activity',
    description: 'Appointment volume trend over the selected period.',
    size: 'xlarge',
    required: true,
    tag: '#Analytics',
    preview: 'bar'
  },
  chart_centers: {
    id: 'chart_centers',
    name: 'Busiest Service Centers',
    description: 'Center appointment and queue volumes.',
    size: 'medium',
    required: false,
    tag: '#Centers',
    preview: 'bar'
  },
  chart_distribution: {
    id: 'chart_distribution',
    name: 'Request Distribution',
    description: 'Share of New Registration, Update, and Lost ID requests.',
    size: 'medium',
    required: true,
    tag: '#Analytics',
    preview: 'donut'
  },
  queue_overview: {
    id: 'queue_overview',
    name: 'Live Queue Status',
    description: 'Now serving, waiting, hold, no-show, and next ticket.',
    size: 'medium',
    required: true,
    tag: '#Queue',
    preview: 'queue'
  },
  center_popularity: {
    id: 'center_popularity',
    name: 'Center Popularity',
    description: 'Busiest service centers ranked by appointment volume.',
    size: 'small',
    required: false,
    tag: '#Centers',
    preview: 'bar'
  },
  recent_activity: {
    id: 'recent_activity',
    name: 'Recent Activity',
    description: 'Latest ticket actions across all service centers.',
    size: 'large',
    required: true,
    tag: '#Activity',
    preview: 'insights'
  },
  active_operators: {
    id: 'active_operators',
    name: 'Active Operators',
    description: 'Operator availability and activity status.',
    size: 'medium',
    required: false,
    tag: '#Operators',
    preview: 'operators'
  },
  operational_insights: {
    id: 'operational_insights',
    name: 'Operational Insights',
    description: 'Useful insights generated from live dashboard data.',
    size: 'medium',
    required: false,
    tag: '#Insights',
    preview: 'insights'
  },
  recent_appointments: {
    id: 'recent_appointments',
    name: 'Action Center',
    description: 'Searchable appointments table with filters and actions.',
    size: 'xlarge',
    required: true,
    tag: '#Appointments',
    preview: 'table'
  },
  center_performance: {
    id: 'center_performance',
    name: 'Service Center Performance',
    description: 'Center, district, appointments, waiting, completed, and workload.',
    size: 'full',
    required: true,
    tag: '#Centers',
    preview: 'table'
  },
  quick_actions: {
    id: 'quick_actions',
    name: 'Quick Actions',
    description: 'Shortcuts to appointments, operators, centers, and reports.',
    size: 'medium',
    required: false,
    tag: '#Shortcuts',
    preview: 'actions'
  }
};

/** Ordered list for Add Widget drawer — every dashboard widget */
export const ADDABLE_WIDGET_IDS = Object.keys(WIDGET_CATALOG);

export function loadWidgetOrder() {
  try {
    const raw = localStorage.getItem(WIDGET_ORDER_KEY);
    if (!raw) return [...DEFAULT_WIDGET_ORDER];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_WIDGET_ORDER];
    const known = parsed.filter((id) => WIDGET_CATALOG[id]);
    REQUIRED_WIDGETS.forEach((id) => {
      if (!known.includes(id)) known.push(id);
    });
    return known;
  } catch {
    return [...DEFAULT_WIDGET_ORDER];
  }
}

export function saveWidgetOrder(order) {
  localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(order));
}

export function resetWidgetLayout() {
  localStorage.removeItem(WIDGET_ORDER_KEY);
  localStorage.removeItem(WIDGET_STORAGE_KEY);
  return [...DEFAULT_WIDGET_ORDER];
}
