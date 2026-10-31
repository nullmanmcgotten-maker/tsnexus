import React, { useState } from 'react';
import {
  Database,
  Download,
  RotateCcw,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
} from 'lucide-react';
import { OrderRecord, OrderState } from '../types/nexus.ts';
import { journalStore } from '../engine/journalStore.ts';

interface JournalTabProps {
  orders: OrderRecord[];
  onRefreshOrders: () => void;
}

export const JournalTab: React.FC<JournalTabProps> = ({ orders, onRefreshOrders }) => {
  const [filterState, setFilterState] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  const stats = journalStore.getSetupStats();

  const filteredOrders = orders.filter((o) => {
    if (filterState === 'ALL') return true;
    return o.state === filterState;
  });

  const exportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(orders, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `nexus_journal_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleResetDefaults = () => {
    journalStore.resetDefaults();
    onRefreshOrders();
  };

  const handleClear = () => {
    if (window.confirm('Clear all journal order records?')) {
      journalStore.clearJournal();
      onRefreshOrders();
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Top Controls Bar */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="font-bold text-white text-sm">RESTART-SAFE TRADE JOURNAL &amp; AUDIT</h3>
            <span className="text-slate-400 text-[11px]">Durable order lifecycle store (nexus_trades.sqlite3 equivalent)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportJson}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
            title="Reset sample orders to standard repository demo state"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>

      {/* Orders Filter & Table */}
      <div className="bg-[#10141f] border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Filter State:</span>
            {['ALL', 'FILLED', 'SUBMITTED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterState(st)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  filterState === st
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <span className="text-slate-400 text-[11px]">
            Showing {filteredOrders.length} of {orders.length} orders
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0e14] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Client Order ID</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Side</th>
                <th className="py-2.5 px-3">Qty</th>
                <th className="py-2.5 px-3">Entry Price</th>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3">Exchange ID</th>
                <th className="py-2.5 px-3">Updated At</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-slate-500">
                    No orders match filter state &ldquo;{filterState}&rdquo;.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.client_order_id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-white">{ord.client_order_id}</td>
                    <td className="py-2.5 px-3 text-slate-200">{ord.symbol}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ord.side === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {ord.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">{ord.quantity}</td>
                    <td className="py-2.5 px-3 text-slate-200">
                      {ord.entry_price ? `$${ord.entry_price.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ord.state === 'FILLED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : ord.state === 'SUBMITTED'
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : ord.state === 'REJECTED'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {ord.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {ord.exchange_order_id || 'None'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {ord.updated_at.substring(11, 19)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedOrder(ord)}
                        className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Order Payload Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111624] border border-slate-700 rounded-lg max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                JOURNAL RECORD: {selectedOrder.client_order_id}
              </h4>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs mb-4">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Order State:</span>
                <span className="font-bold text-emerald-400">{selectedOrder.state}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Stop Order ID:</span>
                <span>{selectedOrder.stop_order_id || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Target Order ID:</span>
                <span>{selectedOrder.target_order_id || 'N/A'}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 mb-1">RAW JSON PAYLOAD:</div>
            <pre className="bg-[#07090e] p-3 rounded border border-slate-900 text-slate-300 text-[11px] overflow-x-auto max-h-56">
              {JSON.stringify(selectedOrder, null, 2)}
            </pre>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
