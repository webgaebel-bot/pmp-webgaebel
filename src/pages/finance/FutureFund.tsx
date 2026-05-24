import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/financeEngine';

const FutureFund: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await (api as any).finance.getFutureFundSummary();
      setSummary(res.data || res);
    } catch (e) {
      console.error(e);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div>Loading...</div>;

  const totals = summary?.totalsByCurrency || {};
  const byMonth = summary?.byMonth || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Future Fund</h1>
        <p className="text-sm text-muted-foreground">Auto-collected savings from net income</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.keys(totals).length === 0 ? (
          <Card><CardContent>No future fund collected yet.</CardContent></Card>
        ) : (
          Object.entries(totals).map(([currency, amount]) => (
            <Card key={currency}>
              <CardHeader>
                <CardTitle>{currency} Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(amount, currency)}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Monthly Breakdown</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(byMonth).flatMap(([month, data]) => (
                Object.entries(data).map(([currency, amount]) => (
                  <TableRow key={`${month}-${currency}`}>
                    <TableCell>{month}</TableCell>
                    <TableCell>{currency}</TableCell>
                    <TableCell>{formatMoney(amount, currency)}</TableCell>
                  </TableRow>
                ))
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

    </div>
  );
};

export default FutureFund;
