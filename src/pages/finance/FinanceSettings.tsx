import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Settings, Calculator, Percent, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';

type CurrencyRow = {
  id?: string;
  code?: string;
  currency_code?: string;
  symbol?: string;
  name?: string;
  rate_vs_base_currency?: number;
  updated_at?: string | null;
};

const FinanceSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    base_currency: 'USD',
    future_fund_percentage: '',
    commission_percentage: '',
    tax_rate: '',
    transaction_fee_type: 'percentage',
    transaction_fee_value: '',
    product_cost_enabled: false,
    product_cost_type: 'percentage',
    product_cost_value: '',
    enable_auto_calculation: true,
  });

  const [newCurrency, setNewCurrency] = useState({ code: '', symbol: '', name: '', rate: '' });

  const { data: currenciesResponse } = useQuery({
    queryKey: ['system-currencies'],
    queryFn: async () => api.get('/currencies'),
  });
  const currencies: CurrencyRow[] = currenciesResponse?.data?.data || currenciesResponse?.data || [];

  const { data: currentSettingsResponse, isLoading } = useQuery({
    queryKey: ['finance-settings'],
    queryFn: async () => {
      const response = await api.get('/finance/settings');
      return response;
    },
  });
  
  const currentSettings = currentSettingsResponse?.data;
  const baseCurrency = currentSettings?.data?.base_currency || currentSettings?.data?.currency || 'USD';

  const { data: fxRatesResponse } = useQuery({
    queryKey: ['fx-rates', baseCurrency],
    queryFn: async () => api.get(`/fx-rates?base_currency=${encodeURIComponent(baseCurrency)}`),
    enabled: Boolean(baseCurrency),
  });
  const fxRates = fxRatesResponse?.data?.data || fxRatesResponse?.data || [];
  
  React.useEffect(() => {
    if (currentSettings?.data) {
      setSettings({
        base_currency: currentSettings.data.base_currency || currentSettings.data.currency || 'USD',
        future_fund_percentage: currentSettings.data.future_fund_percentage?.toString() || '',
        commission_percentage: currentSettings.data.commission_percentage?.toString() || '',
        tax_rate: currentSettings.data.tax_rate?.toString() || '',
        transaction_fee_type: currentSettings.data.transaction_fee_type || 'percentage',
        transaction_fee_value: currentSettings.data.transaction_fee_value?.toString() || '',
        product_cost_enabled: currentSettings.data.product_cost_enabled === true || currentSettings.data.product_cost_enabled === 'true',
        product_cost_type: currentSettings.data.product_cost_type || 'percentage',
        product_cost_value: currentSettings.data.product_cost_value?.toString() || '',
        enable_auto_calculation: currentSettings.data.enable_auto_calculation === undefined
          ? true
          : currentSettings.data.enable_auto_calculation === true || currentSettings.data.enable_auto_calculation === 'true',
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
        transaction_fee_value: parseFloat(data.transaction_fee_value) || 0,
        product_cost_value: parseFloat(data.product_cost_value) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-settings'] });
      toast.success('Settings updated successfully');
    },
    onError: () => toast.error('Failed to update settings'),
  });

  const createCurrencyMutation = useMutation({
    mutationFn: async (data: any) => api.post('/currencies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-currencies'] });
      queryClient.invalidateQueries({ queryKey: ['fx-rates'] });
      toast.success('Currency added successfully');
      setNewCurrency({ code: '', symbol: '', name: '', rate: '' });
    },
    onError: () => toast.error('Failed to add currency'),
  });

  const deleteCurrencyMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/currencies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-currencies'] });
      queryClient.invalidateQueries({ queryKey: ['fx-rates'] });
      toast.success('Currency deleted successfully');
    },
    onError: () => toast.error('Failed to delete currency'),
  });

  const handleAddCurrency = () => {
    if (!newCurrency.code || !newCurrency.symbol) return toast.error('Code and symbol are required');
    const rateValue = Number(newCurrency.rate || 0);
    if (newCurrency.code.toUpperCase() !== String(baseCurrency).toUpperCase() && (!rateValue || rateValue <= 0)) {
      return toast.error(`Enter exchange rate for ${baseCurrency}.`);
    }
    createCurrencyMutation.mutate({ ...newCurrency, base_currency: baseCurrency, rate: rateValue });
  };

  const getCurrencyCode = (currency: CurrencyRow) => String(currency.code || currency.currency_code || '').toUpperCase();
  const getCurrencyLabel = (currency: CurrencyRow) => getCurrencyCode(currency);
  const getCurrencyRate = (currency: CurrencyRow) => {
    const code = getCurrencyCode(currency);
    if (!code) return null;
    if (code === String(baseCurrency).toUpperCase()) return 1;

    const storedRate = Number(currency.rate_vs_base_currency || 0);
    if (Number.isFinite(storedRate) && storedRate > 0) {
      return storedRate;
    }

    const directRate = fxRates.find((rate: any) => String(rate.target_currency || '').toUpperCase() === code)?.rate;
    if (directRate !== undefined && directRate !== null && Number(directRate) > 0) {
      return Number(directRate);
    }
    const inverseRate = fxRates.find((rate: any) => String(rate.base_currency || '').toUpperCase() === code && String(rate.target_currency || '').toUpperCase() === String(baseCurrency).toUpperCase())?.rate;
    if (inverseRate !== undefined && inverseRate !== null && Number(inverseRate) > 0) {
      return 1 / Number(inverseRate);
    }

    return null;
  };

  const handleDeleteCurrency = (currency: CurrencyRow) => {
    const code = getCurrencyCode(currency);
    if (!currency.id || !code) return;
    if (code === String(baseCurrency).toUpperCase()) {
      toast.error('Base currency cannot be deleted.');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${code}? This will remove its FX mappings and currency definition.`
    );
    if (!confirmed) return;
    deleteCurrencyMutation.mutate(currency.id);
  };

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
              Automated Deductions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="base_currency">Base Currency</Label>
              <select
                id="base_currency"
                value={settings.base_currency}
                onChange={(e) => setSettings({ ...settings, base_currency: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                {currencies.map((c: any) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">All finance dashboards are normalized to this currency.</p>
            </div>
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
              <p className="text-xs text-muted-foreground mt-1">Default commission used when a payment does not already store its own commission amount</p>
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
              <p className="text-xs text-muted-foreground mt-1">Used as a fallback when a payment does not store tax_amount.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="transaction_fee_type">Transaction Fee Type</Label>
                <select
                  id="transaction_fee_type"
                  value={settings.transaction_fee_type}
                  onChange={(e) => setSettings({ ...settings, transaction_fee_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed per payment</option>
                </select>
              </div>
              <div>
                <Label htmlFor="transaction_fee_value">Transaction Fee Value</Label>
                <Input
                  id="transaction_fee_value"
                  type="number"
                  step="0.01"
                  value={settings.transaction_fee_value}
                  onChange={(e) => setSettings({ ...settings, transaction_fee_value: e.target.value })}
                  placeholder={settings.transaction_fee_type === 'fixed' ? 'e.g., 5' : 'e.g., 2.5'}
                />
              </div>
            </div>
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Product Cost Deduction</p>
                  <p className="text-xs text-muted-foreground">Optional deduction for cost of goods or project delivery expense.</p>
                </div>
                <Switch
                  checked={settings.product_cost_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, product_cost_enabled: checked })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="product_cost_type">Product Cost Type</Label>
                  <select
                    id="product_cost_type"
                    value={settings.product_cost_type}
                    onChange={(e) => setSettings({ ...settings, product_cost_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    disabled={!settings.product_cost_enabled}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed per payment</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="product_cost_value">Product Cost Value</Label>
                  <Input
                    id="product_cost_value"
                    type="number"
                    step="0.01"
                    value={settings.product_cost_value}
                    onChange={(e) => setSettings({ ...settings, product_cost_value: e.target.value })}
                    placeholder={settings.product_cost_type === 'fixed' ? 'e.g., 12' : 'e.g., 5'}
                    disabled={!settings.product_cost_enabled}
                  />
                </div>
              </div>
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
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Multi-currency support</p>
              <p className="text-sm text-muted-foreground mt-1">
                Currency conversion is handled at record level. The selected base currency is used for dashboard totals and profit reporting.
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-calculate Distributions</p>
                <p className="text-sm text-muted-foreground">Automatically calculate profits, deductions, and future fund allocations</p>
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
              <p><strong>Gross Profit</strong> = Income - Taxes - Commissions - Transaction Fees - Product Costs - Expenses - Salaries</p>
              <p><strong>Future Fund</strong> = Net Profit × {settings.future_fund_percentage || 0}%</p>
              <p><strong>Commission</strong> = Net Profit × {settings.commission_percentage || 0}%</p>
              <p><strong>Distributable</strong> = Net Profit - (Future Fund + Commission)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage Currencies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 items-end md:grid-cols-5">
              <div>
                <Label>Code</Label>
                <Input placeholder="e.g. USD" value={newCurrency.code} onChange={(e) => setNewCurrency({...newCurrency, code: e.target.value})} />
              </div>
              <div>
                <Label>Symbol</Label>
                <Input placeholder="e.g. $" value={newCurrency.symbol} onChange={(e) => setNewCurrency({...newCurrency, symbol: e.target.value})} />
              </div>
              <div>
                <Label>Name</Label>
                <Input placeholder="e.g. US Dollar" value={newCurrency.name} onChange={(e) => setNewCurrency({...newCurrency, name: e.target.value})} />
              </div>
              <div>
                <Label>Rate vs {baseCurrency}</Label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder={`1 ${baseCurrency} = ?`}
                  value={newCurrency.rate}
                  onChange={(e) => setNewCurrency({ ...newCurrency, rate: e.target.value })}
                />
              </div>
              <Button type="button" onClick={handleAddCurrency} isLoading={createCurrencyMutation.isPending} loadingText="Adding Currency...">Add Currency</Button>
            </div>
            <Separator className="my-4" />
            <div className="space-y-2">
              {currencies.map((c: any) => (
                <div key={c.id || c.code || c.currency_code} className="flex items-center justify-between gap-4 p-3 border rounded bg-card">
                  <div>
                    <div className="font-medium">{getCurrencyLabel(c)}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.symbol} - {c.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {baseCurrency} rate: {getCurrencyRate(c) !== null
                        ? `1 ${baseCurrency} = ${Number(getCurrencyRate(c)).toFixed(4)} ${getCurrencyLabel(c)}`
                        : 'Rate not set'}
                    </div>
                  </div>
                  {c.id && getCurrencyLabel(c) !== String(baseCurrency).toUpperCase() && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteCurrency(c)}
                      className="shrink-0"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" isLoading={updateMutation.isPending} loadingText="Saving Settings...">
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </form>
    </div>
  );
};

export default FinanceSettings;
