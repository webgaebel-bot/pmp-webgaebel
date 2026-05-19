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
  canMove?: boolean;
}

export function LeadsKanban({ leads, onOpenLead, onMoveLead, canMove = true }: LeadsKanbanProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const grouped = PIPELINE_STAGES.map((stage) => ({
    stage,
    leads: leads.filter((lead) => lead.pipeline_stage === stage),
  }));

  const handleDragEnd = (event: DragEndEvent) => {
    const leadId = String(event.active.id);
    const stage = event.over?.id as PipelineStage | undefined;
    if (canMove && stage && leadId) {
      onMoveLead(leadId, stage);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {grouped.map(({ stage, leads: stageLeads }) => (
          <KanbanColumn key={stage} stage={stage} leads={stageLeads} onOpenLead={onOpenLead} canMove={canMove} />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({ stage, leads, onOpenLead, canMove }: { stage: PipelineStage; leads: Lead[]; onOpenLead: (leadId: string) => void; canMove: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const totalBudget = leads.reduce((sum, lead) => sum + Number(lead.budget || 0), 0);

  return (
    <div ref={setNodeRef} className={`flex-shrink-0 w-[280px] min-h-[500px] rounded-xl border bg-card p-4 transition-colors ${isOver ? 'border-teal-500 bg-teal-50/60' : 'border-slate-200'}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm capitalize">{stage.replace('_', ' ')}</h3>
          <p className="text-xs text-muted-foreground">
            {leads.length} leads · PKR {totalBudget.toLocaleString()}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">{leads.length}</Badge>
      </div>
      <div className="space-y-3">
        {leads.map((lead) => (
          <KanbanLeadCard key={lead.id} lead={lead} onOpenLead={onOpenLead} canMove={canMove} />
        ))}
      </div>
    </div>
  );
}

function KanbanLeadCard({ lead, onOpenLead, canMove }: { lead: Lead; onOpenLead: (leadId: string) => void; canMove: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id, disabled: !canMove });

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`w-full rounded-lg border bg-background p-3 text-left transition-all hover:shadow-md hover:border-teal-300 ${isDragging ? 'opacity-70 shadow-lg rotate-2' : 'border-slate-200'}`}
      onClick={() => onOpenLead(lead.id)}
      {...(canMove ? listeners : {})}
      {...attributes}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{lead.name}</p>
            <p className="text-xs text-muted-foreground truncate">{lead.company || 'No company'}</p>
          </div>
          <LeadScoreBadge score={lead.lead_score} size="sm" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-xs capitalize">{lead.priority}</Badge>
          {lead.assigned_to_name ? <Badge variant="outline" className="text-xs">{lead.assigned_to_name}</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {lead.next_followup_at ? `Next follow-up: ${new Date(lead.next_followup_at).toLocaleDateString()}` : 'No follow-up scheduled'}
        </p>
      </div>
    </button>
  );
}
