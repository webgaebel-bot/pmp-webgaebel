import React, { useState } from 'react';
import api from '@/services/api';

interface Props {
  projectId: string;
  onClose?: () => void;
  onCreated?: () => void;
}

const PaymentPlanModal: React.FC<Props> = ({ projectId, onClose, onCreated }) => {
  const [name, setName] = useState('40/30/30 Plan');
  const [scheduleJson, setScheduleJson] = useState('[{"percent":40,"offset_days":7},{"percent":30,"offset_days":30},{"percent":30,"offset_days":60}]');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    setLoading(true);
    try {
      const schedule = JSON.parse(scheduleJson);
      await (api as any).finance.generatePaymentPlan(projectId, name, schedule);
      onCreated && onCreated();
      onClose && onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow-md max-w-xl">
      <h3 className="text-lg font-semibold mb-2">Create Payment Plan</h3>
      <div className="mb-2">
        <label className="block text-sm">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border p-2 rounded" />
      </div>
      <div className="mb-2">
        <label className="block text-sm">Schedule (JSON)</label>
        <textarea value={scheduleJson} onChange={(e) => setScheduleJson(e.target.value)} rows={6} className="w-full border p-2 rounded monospace" />
      </div>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={create} disabled={loading} aria-busy={loading ? 'true' : undefined}>
          {loading ? 'Creating...' : 'Create'}
        </button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export default PaymentPlanModal;
