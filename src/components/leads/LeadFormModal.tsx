import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { DynamicSelect, type DynamicOption } from '@/components/common/DynamicSelect';
import { LEAD_PRIORITIES, LEAD_SOURCES, PIPELINE_STAGES, type CreateLeadPayload, type Lead } from '@/types/leads';

interface LeadFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateLeadPayload) => void;
  loading?: boolean;
  niches: DynamicOption[];
  services: DynamicOption[];
  nicheLoading?: boolean;
  onCreateNiche?: (niche: string) => void;
  onCreateService?: (service: string) => void;
  lead?: Lead | null;
}

const emptyContact = { name: '', email: '', phone: '', role: '', is_primary: false };

export function LeadFormModal({
  open,
  onOpenChange,
  onSubmit,
  loading,
  lead,
  niches,
  services,
  nicheLoading,
  onCreateNiche,
  onCreateService,
}: LeadFormModalProps) {
  const [form, setForm] = useState<CreateLeadPayload>({
    name: '',
    email: '',
    phone: '',
    company: '',
    designation: '',
    website: '',
    linkedin_url: '',
    facebook_url: '',
    instagram_url: '',
    x_url: '',
    services_offered: '',
    source: 'manual',
    priority: 'medium',
    pipeline_stage: 'new',
    lead_score: 50,
    budget: undefined,
    expected_close_date: '',
    tags: [],
    notes: '',
    contacts: [{ ...emptyContact, is_primary: true }],
  });
  const [tagInput, setTagInput] = useState('');
  const [customNiche, setCustomNiche] = useState('');
  const [customService, setCustomService] = useState('');
  const nicheValues = new Set(niches.map((item) => item.value));
  const serviceValues = new Set(services.map((item) => item.value));
  const nicheValue = form.designation && nicheValues.has(form.designation) ? form.designation : form.designation ? '__custom__' : '';
  const serviceValue = form.services_offered && serviceValues.has(form.services_offered) ? form.services_offered : form.services_offered ? '__custom__' : '';

  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        designation: lead.designation || '',
        website: lead.website || '',
        linkedin_url: lead.linkedin_url || '',
        facebook_url: lead.facebook_url || '',
        instagram_url: lead.instagram_url || '',
        x_url: lead.x_url || '',
        services_offered: lead.services_offered || '',
        source: lead.source || 'manual',
        priority: lead.priority || 'medium',
        pipeline_stage: lead.pipeline_stage || 'new',
        lead_score: lead.lead_score || 0,
        budget: lead.budget,
        expected_close_date: lead.expected_close_date || '',
        tags: (lead.lead_tags || []).map((tag) => tag.tag_name),
        notes: lead.notes || lead.lead_notes?.[0]?.content || '',
        contacts: lead.lead_contacts?.length ? lead.lead_contacts.map((contact) => ({ ...contact })) : [{ ...emptyContact, is_primary: true }],
      });
    } else {
      setForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        designation: '',
        website: '',
        linkedin_url: '',
        facebook_url: '',
        instagram_url: '',
        x_url: '',
        services_offered: '',
        source: 'manual',
        priority: 'medium',
        pipeline_stage: 'new',
        lead_score: 50,
        budget: undefined,
        expected_close_date: '',
        tags: [],
        notes: '',
        contacts: [{ ...emptyContact, is_primary: true }],
      });
    }
    setTagInput('');
    setCustomNiche('');
    setCustomService('');
  }, [lead, open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...form,
      email: form.email || undefined,
      phone: form.phone || undefined,
      company: form.company || undefined,
      designation: form.designation || undefined,
      website: form.website || undefined,
      linkedin_url: form.linkedin_url || undefined,
      facebook_url: form.facebook_url || undefined,
      instagram_url: form.instagram_url || undefined,
      x_url: form.x_url || undefined,
      services_offered: form.services_offered || undefined,
      expected_close_date: form.expected_close_date || undefined,
      budget: form.budget || undefined,
      notes: form.notes || undefined,
      tags: form.tags?.length ? form.tags : undefined,
      contacts: form.contacts?.filter((contact) => contact.name.trim()),
    });
  };

  const addTag = () => {
    const normalized = tagInput.trim();
    if (!normalized) return;
    setForm((current) => ({ ...current, tags: [...new Set([...(current.tags || []), normalized])] }));
    setTagInput('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{lead ? 'Edit Lead' : 'Create Lead'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Basic Info</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name*</Label>
                <Input required value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email || ''} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone || ''} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={form.company || ''} onChange={(e) => setForm((current) => ({ ...current, company: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <DynamicSelect
                  label="Niche"
                  value={nicheValue}
                  onValueChange={(value) => {
                    if (value === '__custom__') {
                      setForm((current) => ({ ...current, designation: current.designation || '' }));
                      return;
                    }
                    setForm((current) => ({ ...current, designation: value }));
                  }}
                  options={niches}
                  loading={Boolean(nicheLoading)}
                  allowCustom={Boolean(onCreateNiche)}
                  customValue={customNiche}
                  onCustomValueChange={setCustomNiche}
                  onAddCustom={(value) => {
                    const next = value.trim();
                    if (!next) return;
                    onCreateNiche?.(next);
                    setForm((current) => ({ ...current, designation: next }));
                    setCustomNiche('');
                  }}
                  searchable
                  helperText="Select a standard niche or create a new one if your role allows it."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <DynamicSelect
                  label="Services Offered"
                  value={serviceValue}
                  onValueChange={(value) => {
                    if (value === '__custom__') {
                      setForm((current) => ({ ...current, services_offered: current.services_offered || '' }));
                      return;
                    }
                    setForm((current) => ({ ...current, services_offered: value }));
                  }}
                  options={services}
                  loading={Boolean(nicheLoading)}
                  allowCustom={Boolean(onCreateService)}
                  customValue={customService}
                  onCustomValueChange={setCustomService}
                  onAddCustom={(value) => {
                    const next = value.trim();
                    if (!next) return;
                    onCreateService?.(next);
                    setForm((current) => ({ ...current, services_offered: next }));
                    setCustomService('');
                  }}
                  searchable
                  helperText="Select standard services or create a new one if your role allows it."
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input type="url" value={form.website || ''} onChange={(e) => setForm((current) => ({ ...current, website: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <Input type="url" value={form.linkedin_url || ''} onChange={(e) => setForm((current) => ({ ...current, linkedin_url: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input type="url" value={form.facebook_url || ''} onChange={(e) => setForm((current) => ({ ...current, facebook_url: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input type="url" value={form.instagram_url || ''} onChange={(e) => setForm((current) => ({ ...current, instagram_url: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>X / Twitter</Label>
                <Input type="url" value={form.x_url || ''} onChange={(e) => setForm((current) => ({ ...current, x_url: e.target.value }))} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lead Details</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Source</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.source} onChange={(e) => setForm((current) => ({ ...current, source: e.target.value as CreateLeadPayload['source'] }))}>
                  {LEAD_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Pipeline Stage</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={form.pipeline_stage} onChange={(e) => setForm((current) => ({ ...current, pipeline_stage: e.target.value as CreateLeadPayload['pipeline_stage'] }))}>
                  {PIPELINE_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label>Priority</Label>
                <RadioGroup className="grid grid-cols-2 gap-3 md:grid-cols-4" value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value as CreateLeadPayload['priority'] }))}>
                  {LEAD_PRIORITIES.map((priority) => (
                    <div key={priority} className="flex items-center gap-2 rounded-lg border p-3">
                      <RadioGroupItem value={priority} id={priority} />
                      <Label htmlFor={priority} className="capitalize">
                        {priority}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Lead Score</Label>
                  <span className="text-sm text-muted-foreground">{form.lead_score}/100</span>
                </div>
                <Slider value={[form.lead_score || 0]} min={0} max={100} step={1} onValueChange={(value) => setForm((current) => ({ ...current, lead_score: value[0] }))} />
              </div>
              <div className="space-y-2">
                <Label>Budget (PKR)</Label>
                <Input type="number" min="0" value={form.budget ?? ''} onChange={(e) => setForm((current) => ({ ...current, budget: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div className="space-y-2">
                <Label>Expected Close Date</Label>
                <Input type="date" value={form.expected_close_date || ''} onChange={(e) => setForm((current) => ({ ...current, expected_close_date: e.target.value }))} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Additional</h3>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add a tag" />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(form.tags || []).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="rounded-full border px-3 py-1 text-sm"
                    onClick={() => setForm((current) => ({ ...current, tags: current.tags?.filter((item) => item !== tag) }))}
                  >
                    {tag} x
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={4} value={form.notes || ''} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Additional Contacts</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, contacts: [...(current.contacts || []), { ...emptyContact }] }))}>
                  Add Contact
                </Button>
              </div>
              <div className="space-y-3">
                {(form.contacts || []).map((contact, index) => (
                  <div key={`${contact.email || 'contact'}-${index}`} className="grid gap-3 rounded-xl border p-3 md:grid-cols-2">
                    <Input placeholder="Name" value={contact.name} onChange={(e) => setForm((current) => ({ ...current, contacts: current.contacts?.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item) }))} />
                    <Input placeholder="Role" value={contact.role || ''} onChange={(e) => setForm((current) => ({ ...current, contacts: current.contacts?.map((item, itemIndex) => itemIndex === index ? { ...item, role: e.target.value } : item) }))} />
                    <Input placeholder="Email" value={contact.email || ''} onChange={(e) => setForm((current) => ({ ...current, contacts: current.contacts?.map((item, itemIndex) => itemIndex === index ? { ...item, email: e.target.value } : item) }))} />
                    <Input placeholder="Phone" value={contact.phone || ''} onChange={(e) => setForm((current) => ({ ...current, contacts: current.contacts?.map((item, itemIndex) => itemIndex === index ? { ...item, phone: e.target.value } : item) }))} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <Button className="w-full" type="submit" isLoading={loading} loadingText="Saving...">
            {lead ? 'Update Lead' : 'Create Lead'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
