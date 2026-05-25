import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye } from 'lucide-react';
import Swal from 'sweetalert2';

const SalaryRuns: React.FC = () => {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [distributingRunId, setDistributingRunId] = useState<string | null>(null);
  const [payingEntryId, setPayingEntryId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await (api as any).getFinanceSalaries?.();
      setRuns(res?.data || []);
    } catch (e: any) {
      console.error('Failed to load salary runs:', e);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markPaid = async (entryId: string, amount: number) => {
    setPayingEntryId(entryId);
    try {
      await (api as any).paySalaryEntry?.(entryId, amount || 0);
      await load();
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
      await load();
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
      <Dialog open={Boolean(selectedRun)} onOpenChange={(open) => !open && setSelectedRun(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Salary Run Details</DialogTitle>
            <DialogDescription>Detailed breakdown of the selected salary run.</DialogDescription>
          </DialogHeader>
          {selectedRun ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Month</p>
                  <p className="font-medium">{selectedRun.salary_month || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Currency</p>
                  <p className="font-medium">{selectedRun.currency || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Total Salary</p>
                  <p className="font-medium">
                    {selectedRun.total_salary || 0} {selectedRun.currency || ''}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Founder Profit</p>
                  <p className="font-medium">
                    {selectedRun.founder_profit || 0} {selectedRun.currency || ''}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground mb-2">Entries</p>
                <div className="space-y-2">
                  {(selectedRun.salary_entries || []).map((entry: any) => (
                    <div key={entry.id} className="rounded-md border p-2">
                      <p className="font-medium">{entry.profiles?.name || entry.user_id}</p>
                      <p className="text-xs text-muted-foreground">
                        Total: {entry.total_salary || 0} {selectedRun.currency || ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedEntry)} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Salary Entry Details</DialogTitle>
            <DialogDescription>Detailed information for the selected salary entry.</DialogDescription>
          </DialogHeader>
          {selectedEntry ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Employee</p>
                  <p className="font-medium">{selectedEntry.profiles?.name || selectedEntry.user_id || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Base Salary</p>
                  <p className="font-medium">{selectedEntry.monthly_salary || 0}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Total Salary</p>
                  <p className="font-medium">{selectedEntry.total_salary || 0}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Months Count</p>
                  <p className="font-medium">{selectedEntry.months_count || 1}</p>
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Notes</p>
                <p className="font-medium">{selectedEntry.notes || '-'}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {runs.length === 0 && <div>No salary runs yet</div>}
      {runs.map((run: any) => (
        <div key={run.id} className="mb-4 rounded border p-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">
              Salary Run: {run.salary_month} - {run.currency}
            </h4>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedRun(run)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </Button>
              <Button
                size="sm"
                onClick={() => distribute(run.id)}
                isLoading={distributingRunId === run.id}
                loadingText="Distributing..."
              >
                Distribute Founder Profits
              </Button>
            </div>
          </div>

          <div className="mt-2">
            {run.salary_entries?.map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 border-b p-2">
                <div>
                  <div className="font-medium">{entry.profiles?.name || entry.user_id}</div>
                  <div className="text-sm text-muted-foreground">
                    Total: {entry.total_salary} {run.currency}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedEntry(entry)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
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
