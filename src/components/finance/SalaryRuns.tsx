import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import Swal from 'sweetalert2';

const SalaryRuns: React.FC = () => {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [distributingRunId, setDistributingRunId] = useState<string | null>(null);
  const [payingEntryId, setPayingEntryId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await (api as any).getFinanceSalaries?.();
      // API returns runs with entries nested
      setRuns(res?.data || []);
    } catch (e: any) {
      console.error('Failed to load salary runs:', e);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markPaid = async (entryId: string, amount: number) => {
    setPayingEntryId(entryId);
    try {
      await (api as any).paySalaryEntry?.(entryId, amount || 0);
      load();
      alert('Marked as paid');
    } catch (e: any) {
      alert(e?.message || 'Failed to mark paid');
    } finally {
      setPayingEntryId(null);
    }
  };

  const distribute = async (runId: string) => {
    const result = await Swal.fire({
      title: 'Distribute Founder Profits?',
      text: 'This will finalize the run and distribute founder profits.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, distribute',
      confirmButtonColor: '#0f766e',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    setDistributingRunId(runId);
    try {
      await (api as any).finalizeAndDistributeFounderProfits?.(runId);
      load();
      Swal.fire({
        title: 'Done',
        text: 'Founder profits distributed successfully.',
        icon: 'success',
        confirmButtonColor: '#0f766e',
      });
    } catch (e: any) {
      Swal.fire({
        title: 'Failed',
        text: e?.message || 'Failed to distribute founder profits',
        icon: 'error',
        confirmButtonColor: '#0f766e',
      });
    } finally {
      setDistributingRunId(null);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {runs.length === 0 && <div>No salary runs yet</div>}
      {runs.map((run: any) => (
        <div key={run.id} className="mb-4 p-3 border rounded">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Salary Run: {run.salary_month} — {run.currency}</h4>
            <div>
              <Button size="sm" onClick={() => distribute(run.id)} className="mr-2" isLoading={distributingRunId === run.id} loadingText="Distributing...">
                Distribute Founder Profits
              </Button>
            </div>
          </div>
          <div className="mt-2">
            {run.salary_entries?.map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between p-2 border-b">
                <div>
                  <div className="font-medium">{entry.profiles?.name || entry.user_id}</div>
                  <div className="text-sm text-muted-foreground">Total: {entry.total_salary} {run.currency}</div>
                </div>
                <div>
                  <Button
                    size="sm"
                    className="bg-accent"
                    onClick={() => markPaid(entry.id, entry.total_salary)}
                    isLoading={payingEntryId === entry.id}
                    loadingText="Paying..."
                  >
                    Mark Paid
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SalaryRuns;
