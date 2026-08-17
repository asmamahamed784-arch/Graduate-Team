import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiActivity,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiEdit3,
  FiUserCheck,
  FiUsers,
  FiX,
  FiXCircle,
  FiAlertTriangle,
  FiBarChart2,
  FiMapPin,
  FiPieChart,
  FiTrendingUp,
  FiList,
  FiZap,
  FiPlus,
  FiHome,
  FiClock,
  FiPauseCircle,
  FiUserX,
  FiArrowRight
} from 'react-icons/fi';
import { useCountUp } from '../../hooks/useCountUp';

export function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export const KPI_ROUTES = {
  citizens: '/dashboard/admin/reports/citizens/all',
  appointments: '/admin-appointments',
  waiting: '/queue-management?filter=waiting',
  completed: '/admin-appointments?date=today&status=Completed',
  updates: '/admin-appointments?requestType=update_information',
  lost: '/admin-appointments?requestType=lost_replacement',
  cancelled: '/admin-appointments?status=Cancelled',
  operators: '/active-sessions',
  centers: '/center-management'
};

function AnimatedValue({ value }) {
  const animated = useCountUp(value);
  return formatNumber(animated);
}

export function KpiCard({ icon: Icon, label, value, note, tone = 'blue', onClick, to, className = '' }) {
  const content = (
    <>
      <div className="nqs-ad-kpi-top">
        <p className="nqs-ad-kpi-label">{label}</p>
        <span className="nqs-ad-kpi-icon" aria-hidden="true">
          <Icon />
        </span>
      </div>
      <strong className="nqs-ad-kpi-value"><AnimatedValue value={value} /></strong>
      {note ? <span className="nqs-ad-kpi-note">{note}</span> : null}
    </>
  );
  const classes = `nqs-ad-kpi nqs-ad-kpi-${tone} ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={`Open ${label}`}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes} aria-label={label}>
      {content}
    </button>
  );
}

export function StatTile({ icon: Icon, label, value, note, to, tone = 'blue' }) {
  const content = (
    <>
      <div className="nqs-ad-stat-top">
        <span className="nqs-ad-stat-label">{label}</span>
        <span className="nqs-ad-stat-icon" aria-hidden="true">
          <Icon />
        </span>
      </div>
      <strong className="nqs-ad-stat-value"><AnimatedValue value={value} /></strong>
      {note ? <span className="nqs-ad-stat-note">{note}</span> : null}
    </>
  );
  const classes = `nqs-ad-stat nqs-ad-stat-${tone}`;

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={`Open ${label}`}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}

export function DonutLegend({ labels = [], values = [], colors = [] }) {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0) || 1;
  return (
    <ul className="nqs-ad-donut-legend">
      {labels.map((label, index) => (
        <li key={label}>
          <span className="nqs-ad-dot" style={{ background: colors[index] }} />
          <span className="nqs-ad-donut-legend-label">{label}</span>
          <strong>{Math.round((Number(values[index] || 0) / total) * 100)}%</strong>
        </li>
      ))}
    </ul>
  );
}

export function CenterPopularityCard({ rows = [] }) {
  const top = rows.slice(0, 4);
  const max = top[0]?.total || 1;

  if (!top.length) {
    return <p className="nqs-ad-empty">No center activity for this period.</p>;
  }

  return (
    <div className="nqs-ad-popularity">
      <div className="nqs-ad-popularity-art" aria-hidden="true">
        <FiMapPin />
      </div>
      <ul className="nqs-ad-popularity-list">
        {top.map((row) => {
          const percent = Math.round((row.total / max) * 100);
          return (
            <li key={row.name}>
              <div className="nqs-ad-popularity-row">
                <span>{row.name}</span>
                <strong>{percent}%</strong>
              </div>
              <div className="nqs-ad-progress">
                <div style={{ width: `${percent}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function timeAgo(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function RecentActivityCard({ logs = [] }) {
  if (!logs.length) {
    return <p className="nqs-ad-empty">No recent activity yet.</p>;
  }

  return (
    <ul className="nqs-ad-activity-list">
      {logs.map((log) => (
        <li key={log.id || log.ref}>
          <span className="nqs-ad-activity-dot" aria-hidden="true">
            <FiPlus />
          </span>
          <div>
            <p>{log.action}</p>
            <span>{timeAgo(log.time)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function WidgetShell({
  title,
  subtitle,
  children,
  onRemove,
  removable,
  dragHandleProps,
  className = '',
  actions = null
}) {
  return (
    <section className={`nqs-ad-widget ${className}`.trim()}>
      <header className="nqs-ad-widget-head">
        <div className="nqs-ad-widget-title-wrap">
          {dragHandleProps ? (
            <button
              type="button"
              className="nqs-ad-drag-handle"
              aria-label={`Drag ${title}`}
              title="Drag to rearrange"
              {...dragHandleProps}
            >
              ⋮⋮
            </button>
          ) : null}
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        <div className="nqs-ad-widget-actions">
          {actions}
          {removable ? (
            <button type="button" className="nqs-ad-remove" onClick={onRemove} aria-label={`Remove ${title}`}>
              <FiXCircle />
            </button>
          ) : null}
        </div>
      </header>
      <div className="nqs-ad-widget-body">{children}</div>
    </section>
  );
}

export function QueueOverviewCard({ queue, nowServing, nextUp }) {
  const boxes = [
    { label: 'Waiting', value: queue.waiting, icon: FiUsers },
    { label: 'On Hold', value: queue.onHold, icon: FiPauseCircle },
    { label: 'No Show', value: queue.noShow, icon: FiUserX },
    { label: 'Next #', display: nextUp?.ticketId || '--', icon: FiArrowRight }
  ];

  return (
    <div className="nqs-ad-live-queue">
      <div className="nqs-ad-live-queue-status">
        <span className="nqs-ad-live-dot" aria-hidden="true" />
        Live · Now Serving
      </div>
      <div className="nqs-ad-live-queue-ticket">
        <strong>{nowServing?.ticketId || '--'}</strong>
        <span>{nowServing?.centerName ? `Desk of ${nowServing.centerName}` : 'No ticket currently being served'}</span>
      </div>
      <div className="nqs-ad-live-queue-grid">
        {boxes.map((box) => (
          <div key={box.label} className="nqs-ad-live-queue-box">
            <box.icon aria-hidden="true" />
            <div>
              <strong>{box.display ?? <AnimatedValue value={box.value} />}</strong>
              <span>{box.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServiceBreakdownCard({ service }) {
  const { label, icon: Icon, tone, requests, wait, done, drop, to } = service;
  const classes = `nqs-ad-service-card nqs-ad-service-${tone}`;
  const body = (
    <>
      <div className="nqs-ad-service-top">
        <span className="nqs-ad-service-icon" aria-hidden="true"><Icon /></span>
        <h4>{label}</h4>
      </div>
      <strong className="nqs-ad-service-total"><AnimatedValue value={requests} /></strong>
      <span className="nqs-ad-service-total-label">Requests</span>
      <div className="nqs-ad-service-metrics">
        <div>
          <strong><AnimatedValue value={wait} /></strong>
          <span>Wait</span>
        </div>
        <div>
          <strong><AnimatedValue value={done} /></strong>
          <span>Done</span>
        </div>
        <div>
          <strong><AnimatedValue value={drop} /></strong>
          <span>Drop</span>
        </div>
      </div>
    </>
  );

  if (to) {
    return <Link to={to} className={classes}>{body}</Link>;
  }
  return <div className={classes}>{body}</div>;
}

export function CenterPerformanceTable({ rows = [] }) {
  if (!rows.length) {
    return <p className="nqs-ad-empty">No center performance data available.</p>;
  }
  const max = Math.max(...rows.map((row) => row.total), 1);

  return (
    <div className="nqs-ad-table-wrap nqs-ad-center-perf-wrap">
      <table className="nqs-ad-center-perf-table">
        <thead>
          <tr>
            <th>Center Name</th>
            <th>District</th>
            <th>Appointments</th>
            <th>Waiting</th>
            <th>Completed</th>
            <th>Workload</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const percent = Math.round((row.total / max) * 100);
            const workloadTone = percent >= 70 ? 'high' : percent >= 35 ? 'mid' : 'low';
            return (
              <tr key={row.name}>
                <td className="nqs-ad-center-perf-name">{row.name}</td>
                <td>{row.district || '—'}</td>
                <td><AnimatedValue value={row.total} /></td>
                <td>{formatNumber(row.waiting)}</td>
                <td>{formatNumber(row.completed)}</td>
                <td>
                  <div className="nqs-ad-workload">
                    <div className="nqs-ad-workload-bar">
                      <div
                        className={`nqs-ad-workload-fill nqs-ad-workload-${workloadTone}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span>{percent}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SystemAlertsCard({ insights }) {
  if (!insights.length) {
    return <p className="nqs-ad-empty">No active alerts. Everything looks normal.</p>;
  }

  return (
    <ul className="nqs-ad-alerts">
      {insights.map((item) => (
        <li key={item}>
          <FiAlertTriangle aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ActiveOperatorsCard({ stats }) {
  return (
    <div className="nqs-ad-operator-grid">
      <div>
        <strong>{formatNumber(stats.total)}</strong>
        <span>Total operators</span>
      </div>
      <div>
        <strong>{formatNumber(stats.active)}</strong>
        <span>Active operators</span>
      </div>
      <div>
        <strong>{formatNumber(stats.inactive)}</strong>
        <span>Inactive operators</span>
      </div>
      <div>
        <strong>{formatNumber(stats.serving)}</strong>
        <span>Currently serving</span>
      </div>
    </div>
  );
}

export function OperationalInsightsCard({ insights }) {
  if (!insights.length) {
    return <p className="nqs-ad-empty">No operational insights available yet.</p>;
  }

  return (
    <ul className="nqs-ad-insights">
      {insights.map((item) => (
        <li key={item}>
          <FiAlertTriangle aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function QuickActionsCard() {
  const actions = [
    { to: '/admin-appointments', label: 'View Appointments', icon: FiCalendar },
    { to: '/operator-management', label: 'Create Operator', icon: FiUserCheck },
    { to: '/center-management', label: 'Manage Centers', icon: FiBriefcase },
    { to: '/dashboard/admin/reports', label: 'Open Reports', icon: FiBarChart2 }
  ];

  return (
    <div className="nqs-ad-quick-actions">
      {actions.map((action) => (
        <Link key={action.to} to={action.to} className="nqs-ad-quick-btn">
          <action.icon aria-hidden="true" />
          {action.label}
        </Link>
      ))}
    </div>
  );
}

const previewIcon = {
  kpi: FiUsers,
  line: FiTrendingUp,
  bar: FiBarChart2,
  donut: FiPieChart,
  queue: FiActivity,
  operators: FiUserCheck,
  insights: FiAlertTriangle,
  table: FiList,
  actions: FiZap
};

export function AddWidgetModal({ open, onClose, order, onAdd, catalog }) {
  if (!open) return null;

  const entries = Object.values(catalog);

  return (
    <div className="nqs-ad-drawer-overlay" role="presentation" onClick={onClose}>
      <aside
        className="nqs-ad-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nqs-add-widget-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="nqs-ad-drawer-head">
          <h2 id="nqs-add-widget-title">Add Widget</h2>
          <button type="button" onClick={onClose} aria-label="Close add widget panel">
            <FiX />
          </button>
        </header>

        <p className="nqs-ad-drawer-intro">
          Select any dashboard widget below. Widgets already on your dashboard show as Added.
        </p>

        <div className="nqs-ad-drawer-list">
          {entries.map((widget) => {
            const added = order.includes(widget.id);
            const PreviewIcon = previewIcon[widget.preview] || FiBarChart2;
            return (
              <article key={widget.id} className={`nqs-ad-drawer-card ${added ? 'is-added' : ''}`}>
                <div className={`nqs-ad-drawer-preview nqs-ad-preview-${widget.preview || 'kpi'}`} aria-hidden="true">
                  <PreviewIcon />
                </div>
                <div className="nqs-ad-drawer-copy">
                  <h3>{widget.name}</h3>
                  <p>{widget.description}</p>
                  <span className="nqs-ad-drawer-tag">{widget.tag || '#Dashboard'}</span>
                </div>
                <button
                  type="button"
                  className="nqs-ad-drawer-select"
                  disabled={added}
                  onClick={() => onAdd(widget.id)}
                >
                  {added ? 'Added' : 'Select'}
                </button>
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

export const KPI_META = {
  citizens: { label: 'Total Citizens', icon: FiUsers, tone: 'blue', note: 'Registered citizens' },
  appointments: { label: 'Total Appointments', icon: FiCalendar, tone: 'purple', note: 'All bookings' },
  waiting: { label: 'Waiting', icon: FiClock, tone: 'orange', note: 'Currently waiting' },
  completed: { label: 'Completed', icon: FiCheckCircle, tone: 'green', note: 'Finished appointments' },
  updates: { label: 'Update Requests', icon: FiEdit3, tone: 'purple', note: 'Information updates' },
  lost: { label: 'Lost ID Requests', icon: FiXCircle, tone: 'orange', note: 'Replacement cases' },
  cancelled: { label: 'Cancelled', icon: FiXCircle, tone: 'pink', note: 'Cancelled bookings' },
  operators: { label: 'Active Operators', icon: FiUserCheck, tone: 'cyan', note: 'Online now' },
  centers: { label: 'Service Centers', icon: FiBriefcase, tone: 'blue', note: 'Nationwide' }
};

export { FiMapPin, FiCalendar, FiBriefcase, FiEdit3, FiUsers, FiCheckCircle, FiXCircle, FiUserCheck, FiBarChart2 };
