'use client';

import React, { useCallback, useEffect, useState } from 'react';

type Player = { telegram_id: number; username?: string | null; first_name?: string | null; last_name?: string | null; photo_url?: string | null };
type Member = { telegram_id: number; is_active: boolean; manualPoints: number; verifiedCoins: number; player: Player | null };

export function AdminLeadershipPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [selected, setSelected] = useState('');
  const [adjustment, setAdjustment] = useState<'award' | 'deduction'>('award');
  const [amount, setAmount] = useState('10');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const request = useCallback(async (method: 'GET' | 'POST', body?: unknown, query = '') => {
    const initData = window.Telegram?.WebApp?.initData || '';
    const response = await fetch('/api/admin/leadership' + query, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': initData },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Leadership request failed.');
    return data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await request('GET');
      setMembers(data.members || []);
      setHistory(data.adjustments || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load leadership data.');
    }
  }, [request]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      if (!search.trim()) { setResults([]); return; }
      try {
        const data = await request('GET', undefined, '?q=' + encodeURIComponent(search.trim()));
        if (active) setResults(data.searchResults || []);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Player search failed.');
      }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, request]);

  const runAction = async (body: unknown) => {
    setBusy(true); setMessage('');
    try {
      const data = await request('POST', body);
      setMessage(data.message || 'Saved successfully.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed.');
    } finally { setBusy(false); }
  };

  const playerName = (p?: Player | null) => p ? (p.username ? '@' + p.username : [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Registered player') : 'Player';

  return (
    <div className="space-y-4 text-white">
      <section className="rounded-2xl border border-[#FFD700]/25 bg-[#161616] p-4 space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-[#FFD700]">Leadership Board Management</h2>
        <p className="text-xs text-gray-400">Only registered players can be added. Removing a player here does not delete their game account.</p>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search registered player by Telegram ID or name" className="w-full rounded-xl bg-black border border-white/10 px-3 py-3 text-sm outline-none focus:border-[#FFD700]" />
        {results.length > 0 && <div className="space-y-2 max-h-48 overflow-y-auto">
          {results.map(p => <div key={p.telegram_id} className="flex items-center justify-between gap-2 rounded-xl bg-black/50 p-2">
            <div className="min-w-0"><div className="text-sm font-bold truncate">{playerName(p)}</div><div className="text-[10px] text-gray-500">ID: {p.telegram_id}</div></div>
            <button disabled={busy} onClick={() => void runAction({ action: 'add', telegramId: p.telegram_id })} className="rounded-lg bg-[#FFD700] px-3 py-2 text-xs font-black text-black disabled:opacity-50">Add</button>
          </div>)}
        </div>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#161616] p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase text-white">Board Members ({members.filter(m => m.is_active).length})</h3><button onClick={() => void refresh()} className="text-xs text-[#FFD700]">Refresh</button></div>
        {members.filter(m => m.is_active).length === 0 ? <p className="text-xs text-gray-500">No players have been added yet.</p> : members.filter(m => m.is_active).map(m => <div key={m.telegram_id} className="rounded-xl border border-white/5 bg-black/40 p-3">
          <div className="flex items-start justify-between gap-2"><div><div className="text-sm font-bold">{playerName(m.player)}</div><div className="text-[10px] text-gray-500">ID: {m.telegram_id}</div></div><button disabled={busy} onClick={() => void runAction({ action: 'remove', telegramId: m.telegram_id })} className="text-[10px] text-red-400">Remove</button></div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-lg bg-white/5 p-2"><span className="text-gray-400">Verified SC earned</span><div className="font-bold text-[#FFD700]">{m.verifiedCoins.toLocaleString()}</div></div><div className="rounded-lg bg-white/5 p-2"><span className="text-gray-400">Manual points</span><div className="font-bold text-[#FFD700]">{m.manualPoints.toLocaleString()}</div></div></div>
        </div>)}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#161616] p-4 space-y-3">
        <h3 className="text-xs font-black uppercase text-[#FFD700]">Manual Points Adjustment</h3>
        <select value={selected} onChange={e => setSelected(e.target.value)} className="w-full rounded-xl bg-black border border-white/10 px-3 py-3 text-sm"><option value="">Select a board member</option>{members.filter(m => m.is_active).map(m => <option key={m.telegram_id} value={m.telegram_id}>{playerName(m.player)} — {m.telegram_id}</option>)}</select>
        <div className="grid grid-cols-2 gap-2"><select value={adjustment} onChange={e => setAdjustment(e.target.value as 'award' | 'deduction')} className="rounded-xl bg-black border border-white/10 px-3 py-3 text-sm"><option value="award">Award points</option><option value="deduction">Deduct points</option></select><input type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Points" className="min-w-0 rounded-xl bg-black border border-white/10 px-3 py-3 text-sm" /></div>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (required)" rows={2} className="w-full rounded-xl bg-black border border-white/10 px-3 py-3 text-sm" />
        <button disabled={busy || !selected || !reason.trim() || !/^\d+$/.test(amount) || Number(amount) <= 0} onClick={() => void runAction({ action: 'adjust', telegramId: Number(selected), adjustment, amount: Number(amount), reason })} className="w-full rounded-xl bg-[#FFD700] py-3 text-xs font-black uppercase text-black disabled:opacity-40">{busy ? 'Saving…' : 'Submit Adjustment'}</button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#161616] p-4 space-y-2">
        <h3 className="text-xs font-black uppercase text-white">Recent Adjustment History</h3>
        {history.length === 0 ? <p className="text-xs text-gray-500">No adjustments recorded.</p> : history.slice(0, 30).map(item => <div key={item.id} className="border-b border-white/5 py-2 text-[10px]"><div className="flex justify-between gap-2"><b className={item.action === 'award' ? 'text-emerald-400' : 'text-red-400'}>{item.action === 'award' ? '+' : '-'}{Number(item.amount).toLocaleString()} points</b><span className="text-gray-500">{new Date(item.created_at).toLocaleString()}</span></div><div className="text-gray-300">Player {item.telegram_id} · {item.reason}</div><div className="text-gray-500">Admin {item.admin_telegram_id}</div></div>)}
      </section>
      {message && <p role="status" className="rounded-xl bg-white/5 p-3 text-xs text-gray-300">{message}</p>}
    </div>
  );
}
