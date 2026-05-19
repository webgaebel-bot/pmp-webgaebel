import React from 'react';
import { CSS } from '@dnd-kit/utilities';
import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import type { Lead, PipelineStage } from '@/types/leads';
import { PIPELINE_STAGES } from '@/types/leads';
import { LeadScoreBadge } from './LeadScoreBadge';

interface LeadsKanbanProps {
  leads: Lead[];
  onOpenLead: (leadId: string) => void;
  onMoveLead: (leadId: string, stage: PipelineStage) => void;
}

export function LeadsKanban({ leads, onOpenLead, onMoveLead }: LeadsKanbanProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const grouped = PIPELINE_STAGES.map((stage) => ({
    stage,
    leads: leads.filter((lead) => lead.pipeline_stage === stage),
  }));

  const handleDragEnd = (event: DragEndEvent) => {
    const leadId = String(event.active.id);
    const stage = event.over?.id as PipelineStage | undefined;
    if (stage && leadId) {
      onMoveLead(leadId, stage);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid gap-4 overflow-x-auto xl:grid-cols-7">
        {grouped.map(({ stage, leads: stageLeads }) => (
          <KanbanColumn key={stage} stage={stage} leads={stageLeads} onOpenLead={onOpenLead} />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({ stage, leads, onOpenLead }: { stage: PipelineStage; leads: Lead[]; onOpenLead: (leadId: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const totalBudget = leads.reduce((sum, lead) => sum + Number(lead.budget || 0), 0);

  return (
    <div ref={setNodeRef} className={`min-h-[420px] min-w-[260px] rounded-2xl border bg-muted/30 p-3 transition-colors ${isOver ? 'border-teal-500 bg-teal-50/60' : ''}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold capitalize">{stage.replace('_', ' ')}</h3>
          <p className="text-xs text-muted-foreground">
            {leads.length} leads · PKR {totalBudget.toLocaleString()}
          </p>
        </div>
        <Badge variant="outline">{leads.length}</Badge>
      </div>
      <div className="space-y-3">
        {leads.map((lead) => (
          <KanbanLeadCard key={lead.id} lead={lead} onOpenLead={onOpenLead} />
        ))}
      </div>
    </div>
  );
}

function KanbanLeadCard({ lead, onOpenLead }: { lead: Lead; onOpenLead: (leadId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`w-full rounded-2xl border bg-background p-4 text-left transition-shadow ${isDragging ? 'opacity-70 shadow-lg' : ''}`}
      onClick={() => onOpenLead(lead.id)}
      {...listeners}
      {...attributes}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{lead.name}</p>
            <p className="text-xs text-muted-foreground">{lead.company || 'No company'}</p>
          </div>
          <LeadScoreBadge score={lead.lead_score} size="sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="capitalize">{lead.priority}</Badge>
          {lead.assigned_to_name ? <Badge variant="outline">{lead.assigned_to_name}</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {lead.next_followup_at ? `Next follow-up: ${new Date(lead.next_followup_at).toLocaleDateString()}` : 'No follow-up scheduled'}
        </p>
      </div>
    </button>
  );
}
