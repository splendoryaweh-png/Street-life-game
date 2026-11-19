'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, Activity, CheckCircle2, XCircle, Play, Users, Clock } from 'lucide-react';

type EventRow = {
  event_id: string;
  session_id: string;
  telegram_id: number;
  block_id: string;
  event_type: string;
  sdk_state: string | null;
  done: boolean | null;
  error: boolean | null;
  description: string | null;
  elapsed_ms: number | null;
  created_at: string;
};

type Report = {
  blockId: string;
  days: number;
  generatedAt: string;
  totalEvents: number;
  capped: boolean;
  counts: { requests: number; sdkLoaded: number; started: number; completed: number; failed: number; uniquePlayers: number; uniqueSessions: number };
  events: EventRow[];
};

const label: Record<string, string> = {
  ad_requested: 'Ad requested',
  sdk_loaded: 'SDK loaded',
  controller_initialized: 'Controller ready',
  ad_started: 'Rewarded ad show() called',
  ad_completed: 'Ad completed',
  ad_failed: 'Ad failed',
  reward_granted: 'Game reward granted',
};

export function AdminAdsgramPanel() {
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const initData = window.Telegram?.WebApp?.initData || '';
      if (!initData) throw new Error('Open STREET LIFE from Telegram to view this admin report.');
      const response = await fetch('/api/admin/adsgram-diagnostics?days=' + days, {
        headers: { 'x-telegram-init-data': initData },
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load report.');
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load report.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void refresh(); }, [refresh]);

  const exportCsv = () => {
    if (!report) return;
    const columns: (keyof EventRow)[] = ['created_at', 'event_type', 'telegram_id', 'session_id', 'block_id', 'sdk_state', 'done', 'error', 'elapsed_ms', 'description'];
    const quote = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const csv = [columns.join(','), ...report.events.map((event) => columns.map((key) => quote(event[key])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'street-life-adsgram-diagnostics-' + days + 'days.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const metrics = report ? [
    { title: 'Ad requests', value: report.counts.requests, icon: Activity },
    { title: 'Rewarded ad show calls', value: report.counts.started, icon: Play },
    { title: 'Ads completed', value: report.counts.completed, icon: CheckCircle2 },
    { title: 'Ad failures', value: report.counts.failed, icon: XCircle },
    { title: 'Unique players', value: report.counts.uniquePlayers, icon: Users },
    { title: 'SDK loaded', value: report.counts.sdkLoaded, icon: Clock },
  ] : [];

  return (
    <section className="space-y-4 text-white">
      <div className="rounded-2xl border border-cyan-500/30 bg-[#101820] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-black text-sm uppercase tracking-wide text-cyan-300">Adsgram rewarded-ad monitoring</h2>
            <p className="text-[11px] text-gray-400">Private admin evidence • Rewarded video • Block ID {report?.blockId || '59485'}</p>
          </div>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[9px] font-bold text-cyan-200">ADMIN ONLY</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg bg-black border border-white/15 px-3 py-2 text-xs">
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button onClick={() => void refresh()} disabled={loading} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')} /> Refresh
          </button>
          <button onClick={exportCsv} disabled={!report?.events.length} className="rounded-lg bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 px-3 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300">{error}</div>}
      {loading && !report && <p className="text-xs text-gray-400">Loading ad activity…</p>}

      {report && <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {metrics.map(({ title, value, icon: Icon }) => (
            <div key={title} className="rounded-xl border border-white/10 bg-[#151515] p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Icon className="h-3.5 w-3.5" />{title}</div>
              <div className="mt-1 text-2xl font-black font-mono">{value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] text-amber-200">
          This report records STREET LIFE rewarded-ad SDK activity. It is not an Adsgram-certified impression or earnings report. Only Adsgram can confirm billable impressions and revenue.
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111] p-3 space-y-1 text-[10px] text-gray-400">
          <p>Total matching events: <strong className="text-white">{report.totalEvents.toLocaleString()}</strong> • Sessions: <strong className="text-white">{report.counts.uniqueSessions}</strong></p>
          <p>Report generated: {new Date(report.generatedAt).toLocaleString()}</p>
          {report.capped && <p className="text-amber-300">Showing the latest 500 events only. Export includes these displayed records.</p>}
        </div>

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="bg-[#1c1c1c] px-3 py-3 font-bold text-xs">Recent ad activity ({report.events.length})</div>
          {report.events.length === 0 ? <p className="p-4 text-xs text-gray-500">No diagnostic events in this period yet. After deployment, test an ad in the Telegram Mini App.</p> : (
            <div className="max-h-[440px] overflow-auto">
              <table className="w-full text-left text-[10px]">
                <thead className="sticky top-0 bg-[#202020] text-gray-400">
                  <tr><th className="p-2">Time</th><th className="p-2">Event</th><th className="p-2">Player ID</th><th className="p-2">Result</th></tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {report.events.map((event) => <tr key={event.event_id}>
                    <td className="p-2 whitespace-nowrap text-gray-400">{new Date(event.created_at).toLocaleString()}</td>
                    <td className="p-2 text-white">{label[event.event_type] || event.event_type}</td>
                    <td className="p-2 font-mono text-gray-300">{event.telegram_id}</td>
                    <td className="p-2 text-gray-400">{event.done === true ? 'Completed' : event.error ? (event.description || 'Error') : event.sdk_state || 'Recorded'}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>}
    </section>
  );
}
