/**
 * Health report — assembles logged data into printable HTML.
 *
 * Charts are inline SVG rather than images: expo-print renders them
 * natively in the PDF, so there's nothing to upload or encode.
 */
import { api, toLogDate } from '@/services/api';

const DEFAULT_DAYS = 30;

const BRAND = '#0F7A5C';
const INK = '#1A2B25';
const MUTED = '#6B7F78';
const RULE = '#D8E4DF';

/** Dates for the last N days, oldest first. */
function recentDates(days = DEFAULT_DAYS) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d;
  });
}

const avg = (values) => {
  const real = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (!real.length) return 0;
  return real.reduce((s, v) => s + v, 0) / real.length;
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/** Chips plus whatever was typed in the matching "other" box. */
const withOther = (list, other) =>
  [...(list ?? []), other].filter(Boolean).join(', ') || '—';

/**
 * A line chart as inline SVG. Days with no data are plotted as zero, which
 * is honest — a gap would imply the day didn't happen.
 */
function lineChart(values, { colour, unit, dates, height = 150 }) {
  const width = 700;
  const padL = 46;
  const padR = 12;
  const padT = 12;
  const padB = 26;

  const max = Math.max(...values, 1);
  const niceMax = Math.ceil(max / 5) * 5 || 5;

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const x = (i) => padL + (i / Math.max(values.length - 1, 1)) * plotW;
  const y = (v) => padT + plotH - (v / niceMax) * plotH;

  const line = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');

  const area =
    `M ${x(0).toFixed(1)} ${(padT + plotH).toFixed(1)} ` +
    values.map((v, i) => `L ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ') +
    ` L ${x(values.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const value = Math.round(niceMax * f);
      const ly = padT + plotH - f * plotH;
      return `
      <line x1="${padL}" y1="${ly}" x2="${width - padR}" y2="${ly}"
            stroke="${RULE}" stroke-width="1" />
      <text x="${padL - 8}" y="${ly + 3}" text-anchor="end"
            font-size="9" fill="${MUTED}">${value}</text>`;
    })
    .join('');

  // Label roughly six points so the axis stays readable at any range.
  const step = Math.max(1, Math.round(values.length / 6));
  const labels = values
    .map((_, i) => {
      if (i % step !== 0 && i !== values.length - 1) return '';
      const d = dates[i];
      return `<text x="${x(i).toFixed(1)}" y="${height - 8}" text-anchor="middle"
                  font-size="8" fill="${MUTED}">${d.getDate()}/${d.getMonth() + 1}</text>`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}"
         xmlns="http://www.w3.org/2000/svg">
      ${ticks}
      <path d="${area}" fill="${colour}" fill-opacity="0.12" />
      <path d="${line}" fill="none" stroke="${colour}" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round" />
      ${labels}
      <text x="${padL}" y="${padT - 2}" font-size="8" fill="${MUTED}">${unit}</text>
    </svg>`;
}

function chartBlock(title, values, options) {
  const average = avg(values);
  return `
    <section class="chart">
      <div class="chart-head">
        <h3>${esc(title)}</h3>
        <span class="chart-avg">Average: <strong>${Math.round(average)}</strong> ${esc(options.unit)}</span>
      </div>
      ${lineChart(values, options)}
    </section>`;
}

/**
 * Collects everything the report needs.
 *
 * Activity, sleep and device metrics each come from one range call. Only the
 * daily summary is still per-day, because there's no range endpoint for it —
 * so a month is ~30 calls rather than the ~60 it used to be.
 */
export async function gatherReportData(token, { days = DEFAULT_DAYS, onProgress } = {}) {
  const dates = recentDates(days);
  const total = dates.length + 4;
  let done = 0;

  const tick = () => {
    done += 1;
    onProgress?.(Math.round((done / total) * 100));
  };

  const [profile, sleepLogs, activityRange, deviceMetrics] = await Promise.all([
    api.getProfile(token).catch(() => null),
    api.listSleepLogs(token, days).catch(() => []),
    api.getActivityRange(token, days).catch(() => []),
    api.listDeviceMetrics(token, days).catch(() => []),
  ]);

  tick();
  tick();
  tick();
  tick();

  const summaries = [];
  for (const d of dates) {
    summaries.push(await api.getDailySummary(token, toLogDate(d)).catch(() => null));
    tick();
  }

  /**
   * Both ranges are keyed by date rather than position, because a day with
   * nothing logged may be missing from either list — lining them up by index
   * would silently shift every later day.
   */
  const minutesByDate = new Map(
    (activityRange ?? []).map((a) => [a.date, a.minutes ?? 0])
  );

  const stepsByDate = new Map(
    (deviceMetrics ?? []).map((m) => [m.log_date, m.steps ?? 0])
  );

  // Activity rows carry steps too, for days synced before this endpoint.
  for (const a of activityRange ?? []) {
    if (a.steps != null && !stepsByDate.has(a.date)) {
      stepsByDate.set(a.date, a.steps);
    }
  }

  const activityDays = dates.map((d) => minutesByDate.get(toLogDate(d)) ?? 0);
  const steps = dates.map((d) => stepsByDate.get(toLogDate(d)) ?? 0);

  return { days, dates, profile, sleepLogs, summaries, activityDays, steps };
}

/** Renders the gathered data as a printable HTML document. */
export function buildReportHtml(data, { sections, user }) {
  const { days, dates, profile, sleepLogs, summaries, activityDays, steps } = data;

  const calories = summaries.map((s) => Math.round(s?.totals?.calories ?? 0));
  const sleepByDate = new Map((sleepLogs ?? []).map((s) => [s.log_date, s.hours]));
  const sleep = dates.map((d) => sleepByDate.get(toLogDate(d)) ?? 0);

  const rangeLabel = days === 7 ? 'last 7 days' : `last ${days} days`;

  const generatedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'User';

  const profileRows = profile
    ? [
        ['Age', profile.age != null ? `${Math.round(profile.age)} years` : '—'],
        ['Gender', profile.gender ?? '—'],
        ['Height', profile.height_cm ? `${profile.height_cm} cm` : '—'],
        ['Weight', profile.weight_kg ? `${profile.weight_kg} kg` : '—'],
        ['BMI', profile.bmi != null ? profile.bmi.toFixed(1) : '—'],
        ['Target weight', profile.target_weight_kg ? `${profile.target_weight_kg} kg` : '—'],
        ['Activity level', profile.activity_level ?? '—'],
        ['Goals', withOther(profile.goals, profile.other_goal)],
        ['Dietary preferences', withOther(profile.dietary_preferences, profile.other_preference)],
        ['Health conditions', withOther(profile.health_conditions, profile.other_condition)],
      ]
    : [];

  const profileSection = sections.includes('profile')
    ? `
      <section class="block">
        <h2>Profile</h2>
        <table class="kv">
          ${profileRows.map(([k, v]) =>
            `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
        </table>
      </section>`
    : '';

  const progressSection = sections.includes('progress')
    ? `
      <section class="block">
        <h2>Progress — ${esc(rangeLabel)}</h2>
        ${chartBlock('Calorie intake', calories, { colour: '#0F7A5C', unit: 'kcal', dates })}
        ${chartBlock('Steps', steps, { colour: '#2E6FA8', unit: 'steps', dates })}
        ${chartBlock('Sleep', sleep, { colour: '#7B5BD4', unit: 'hours', dates })}
        ${chartBlock('Active time', activityDays, { colour: '#C77D3A', unit: 'minutes', dates })}
      </section>`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 32px; }
      body {
        font-family: -apple-system, Roboto, 'Helvetica Neue', sans-serif;
        color: ${INK};
        font-size: 11px;
        line-height: 1.5;
      }
      header {
        border-bottom: 2px solid ${BRAND};
        padding-bottom: 12px;
        margin-bottom: 20px;
      }
      .brand { color: ${BRAND}; font-size: 18px; font-weight: 700; }
      h1 { font-size: 22px; margin: 10px 0 2px; }
      .meta { color: ${MUTED}; font-size: 10px; }
      h2 {
        font-size: 14px;
        color: ${BRAND};
        border-bottom: 1px solid ${RULE};
        padding-bottom: 5px;
        margin: 24px 0 12px;
      }
      h3 { font-size: 11px; margin: 0; }
      .block { page-break-inside: avoid; }
      table.kv { width: 100%; border-collapse: collapse; }
      table.kv th {
        text-align: left;
        font-weight: 500;
        color: ${MUTED};
        width: 38%;
        padding: 5px 0;
        border-bottom: 1px solid ${RULE};
        vertical-align: top;
      }
      table.kv td {
        padding: 5px 0;
        border-bottom: 1px solid ${RULE};
      }
      .chart { margin-bottom: 22px; page-break-inside: avoid; }
      .chart-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 4px;
      }
      .chart-avg { font-size: 9px; color: ${MUTED}; }
      .note {
        margin-top: 26px;
        padding: 12px;
        background: #F2F7F5;
        border-left: 3px solid ${BRAND};
        font-size: 9px;
        color: ${MUTED};
        line-height: 1.6;
      }
      .note strong { color: ${INK}; }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">&#10022; Knowtrients</div>
      <h1>Health Report</h1>
      <div class="meta">${esc(name)} &middot; generated ${esc(generatedAt)}</div>
    </header>

    ${profileSection}
    ${progressSection}

    <section class="note">
      <strong>About this report.</strong>
      This document summarises data you logged in Knowtrients over the
      ${esc(rangeLabel)}. Food entries and portion sizes are self-reported, so
      nutrition figures are estimates. Step data comes from Health Connect on
      your phone and is stored as you use the app, so days before you
      connected a source &mdash; or days you didn&rsquo;t open Knowtrients
      &mdash; will show as zero.
      Knowtrients&rsquo; recommendations consider nutrition and hydration only
      &mdash; they do not account for sleep or exercise.
      <br /><br />
      <strong>This is not a medical record.</strong> Knowtrients is a student
      project and does not provide medical advice. Please consult a qualified
      healthcare professional before making decisions about your health.
    </section>
  </body>
</html>`;
}