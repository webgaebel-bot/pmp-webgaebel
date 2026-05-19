import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Settings, Calculator, Percent } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';

const FinanceSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    future_fund_percentage: '',
    commission_percentage: '',
    enable_auto_calculation: true,
    tax_rate: '',
    currency: 'USD',
  });

  const { data: currentSettingsResponse, isLoading } = useQuery({
    queryKey: ['finance-settings'],
    queryFn: async () => {
      const response = await api.get('/finance/settings');
      return response;
    },
  });
  
  const currentSettings = currentSettingsResponse?.data;
  
  React.useEffect(() => {
    if (currentSettings?.data) {
      setSettings({
        future_fund_percentage: currentSettings.data.future_fund_percentage?.toString() || '',
        commission_percentage: currentSettings.data.commission_percentage?.toString() || '',
        enable_auto_calculation: currentSettings.data.enable_auto_calculation ?? true,
        tax_rate: currentSettings.data.tax_rate?.toString() || '',
        currency: currentSettings.data.currency || 'USD',
      });
    }
  }, [currentSettings]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post('/finance/settings', {
        ...data,
        future_fund_percentage: parseFloat(data.future_fund_percentage) || 0,
        commission_percentage: parseFloat(data.commission_percentage) || 0,
        tax_rate: parseFloat(data.tax_rate) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-settings'] });
      toast.success('Settings updated successfully');
    },
    onError: () => toast.error('Failed to update settings'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(settings);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <Button variant="ghost" size="sm" className="px-0" onClick={() => navigate('/finance')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Finance
      </Button>
      <h1 className="text-2xl font-bold">Finance Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Distribution Percentages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="future_fund">Future Fund Percentage (%)</Label>
              <Input
                id="future_fund"
                type="number"
                step="0.01"
                max="100"
                value={settings.future_fund_percentage}
                onChange={(e) => setSettings({...settings, future_fund_percentage: e.target.value})}
                placeholder="e.g., 20"
              />
              <p className="text-xs text-muted-foreground mt-1">Percentage of net profit to allocate to future fund</p>
            </div>
            <div>
              <Label htmlFor="commission">Commission Percentage (%)</Label>
              <Input
                id="commission"
                type="number"
                step="0.01"
                max="100"
                value={settings.commission_percentage}
                onChange={(e) => setSettings({...settings, commission_percentage: e.target.value})}
                placeholder="e.g., 15"
              />
              <p className="text-xs text-muted-foreground mt-1">Percentage of net profit for commission</p>
            </div>
            <div>
              <Label htmlFor="tax_rate">Tax Rate (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                step="0.01"
                max="100"
                value={settings.tax_rate}
                onChange={(e) => setSettings({...settings, tax_rate: e.target.value})}
                placeholder="e.g., 30"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={settings.currency}
                onChange={(e) => setSettings({...settings, currency: e.target.value})}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="INR">INR - Indian Rupee</option>
              </select>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-calculate Distributions</p>
                <p className="text-sm text-muted-foreground">Automatically calculate profit distributions</p>
              </div>
              <Switch
                checked={settings.enable_auto_calculation}
                onCheckedChange={(checked) => setSettings({...settings, enable_auto_calculation: checked})}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Formula Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm bg-muted/30 p-4 rounded-lg">
              <p><strong>Net Profit</strong> = Revenue - Expenses</p>
              <p><strong>Future Fund</strong> = Net Profit × {settings.future_fund_percentage || 0}%</p>
              <p><strong>Commission</strong> = Net Profit × {settings.commission_percentage || 0}%</p>
              <p><strong>Distributable</strong> = Net Profit - (Future Fund + Commission)</p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
};

export default FinanceSettings;
