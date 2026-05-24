import React, { useEffect, useState } from 'react';
import api from '@/services/api';

interface Props {
  projectId: string;
}

const InstallmentsList: React.FC<Props> = ({ projectId }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await (api as any).finance.getPaymentPlansForProject(projectId);
      setPlans(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const markPaid = async (installmentId: string) => {
    const amount = prompt('Received amount') || '0';
    try {
      await (api as any).finance.receiveInstallmentPayment(installmentId, { received_amount: Number(amount) });
      load();
    } catch (err: any) {
      alert(err?.message || 'Failed to mark paid');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div>
      {plans.map((plan: any) => (
        <div key={plan.id} className="mb-4 p-3 border rounded">
          <h4 className="font-semibold">{plan.name} — {plan.total_amount} {plan.currency}</h4>
          <table className="w-full mt-2 table-auto">
            <thead>
              <tr className="text-left"><th>#</th><th>Percent</th><th>Due</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {plan.payment_installments?.map((inst: any) => (
                <tr key={inst.id}>
                  <td>{inst.installment_index}</td>
                  <td>{inst.percent}%</td>
                  <td>{inst.due_amount} {plan.currency} on {inst.due_date}</td>
                  <td>{inst.status}</td>
                  <td>{inst.status !== 'paid' && <button className="btn btn-sm" onClick={() => markPaid(inst.id)}>Mark Paid</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default InstallmentsList;
