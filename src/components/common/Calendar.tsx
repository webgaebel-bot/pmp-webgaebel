import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ChevronLeft, 
    ChevronRight, 
    ChevronDown,
    Plus,
  Menu,
  Search,
  RefreshCw,
  Grid,
  Calendar as CalendarIcon,
  List,
    Loader2,
    Mail as MailIcon,
    X
  } from 'lucide-react';
  import MailView from '@/components/common/Mail';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermission } from '@/hooks/usePermission';
import Mail from '@/components/common/Mail';
import api from '@/services/api';
import { toast } from 'sonner';

export interface CalendarEvent {
  id: string;
  title: string;
  start?: string;
  date?: string;
  end?: string;
  type?: string;
  status?: string;
  description?: string;
  color?: string;
  project_id?: number | string;
}

interface CalendarProps {
  onDateSelect?: (date: Date) => void;
  onCreateEvent?: () => void;
}

type ViewType = 'month' | 'week' | 'day' | 'agenda' | 'mail';

const Calendar: React.FC<CalendarProps> = ({ onDateSelect, onCreateEvent }) => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewType, setViewType] = useState<ViewType>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Drag & Drop states
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
  
  // Project creation modal states
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectData, setNewProjectData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    type: 'project',
    status: 'active'
  });
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Permission checks
  const canViewOwnCalendar = can('calendar.view');
  const canViewAllCalendars = can('calendar.view.all');
  const canViewProjectCalendar = can('calendar.project.view');
    const canCreateProject = can('projects.create');
  const hasCalendarAccess = canViewOwnCalendar || canViewAllCalendars;

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate, viewType]);

  const getDateRange = (): { startDate: string; endDate: string } => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = currentDate.getDate();

    if (viewType === 'month') {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    } else if (viewType === 'week') {
      const startDate = new Date(currentDate);
      startDate.setDate(day - startDate.getDay());
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    } else {
      const startDate = new Date(year, month, day);
      const endDate = new Date(year, month, day);
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    }
  };

  const fetchCalendarData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRange();
      
      const response = await api.getCalendar(startDate, endDate);
      
      // Map API response to calendar events
      const apiData = response.data || response || [];
      const mappedEvents: CalendarEvent[] = apiData.map((project: any) => {
        const typeMap: { [key: string]: string } = {
          'project': '#4285F4',
          'task': '#EA4335',
          'meeting': '#34A853',
          'deadline': '#FF6B6B',
          'review': '#FFD93D',
          'milestone': '#6BCB77',
          'active': '#4285F4',
          'completed': '#34A853',
          'pending': '#FFD93D'
        };

        return {
          id: String(project.id),
          title: project.name || project.title,
          start: project.start_date || project.start,
          end: project.end_date || project.end,
          type: project.type || 'project',
          status: project.status,
          description: project.description,
          project_id: project.id,
          color: typeMap[(project.type || project.status)?.toLowerCase()] || '#8E44AD'
        };
      });

      // Filter events based on permissions
      const filteredEvents = mappedEvents.filter(event => {
        if (canViewAllCalendars) {
          return true;
        }
        if (canViewProjectCalendar && event.type === 'project') {
          return true;
        }
        if (canViewOwnCalendar) {
          return true;
        }
        return false;
      });

      setEvents(filteredEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
      console.error('Calendar fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (event: CalendarEvent, e: React.DragEvent) => {
    setDraggedEvent(event);
    e.dataTransfer.setData('text/plain', JSON.stringify(event));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (day: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const dragDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setDragOverDate(dragDate);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = async (day: number) => {
    if (!draggedEvent) return;
    
    const dropDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = dropDate.toISOString().split('T')[0];
    
    try {
      // Calculate new dates based on original event duration
      const originalStart = new Date(draggedEvent.start || draggedEvent.date || '');
      const originalEnd = draggedEvent.end ? new Date(draggedEvent.end) : originalStart;
      
      // Calculate duration in days
      const durationMs = originalEnd.getTime() - originalStart.getTime();
      const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
      
      // Create new start and end dates
      const newStartDate = new Date(dropDate);
      const newEndDate = new Date(dropDate);
      newEndDate.setDate(newEndDate.getDate() + durationDays);
      
      // Update event locally
      const updatedEvents = events.map(event => 
        event.id === draggedEvent.id 
          ? { 
              ...event, 
              start: newStartDate.toISOString().split('T')[0],
              end: newEndDate.toISOString().split('T')[0]
            } 
          : event
      );
      
      setEvents(updatedEvents);
      setDraggedEvent(null);
      setDragOverDate(null);
      
      // If it's a project, update via API
      if (draggedEvent.project_id && can('project.update')) {
        await api.updateProject(draggedEvent.project_id.toString(), {
          start_date: newStartDate.toISOString().split('T')[0],
          end_date: newEndDate.toISOString().split('T')[0]
        });
        toast.success('Project dates updated successfully');
      }
      
    } catch (error) {
      console.error('Drop error:', error);
      toast.error('Failed to update event dates');
      // Revert to original events
      fetchCalendarData();
    }
  };

  // Project Creation Handlers
  const handleCreateProjectClick = () => {
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setNewProjectData({
        ...newProjectData,
        start_date: dateStr,
        end_date: dateStr
      });
    }
    setShowProjectModal(true);
  };

  const handleCreateProject = async () => {
    if (!newProjectData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      setIsCreatingProject(true);
      
      // Prepare project data
      const projectData = {
        name: newProjectData.name,
        description: newProjectData.description,
        start_date: newProjectData.start_date,
        end_date: newProjectData.end_date,
        type: newProjectData.type,
        status: newProjectData.status,
        // Add other required fields based on your API
        color: '#4285F4',
        priority: 'medium'
      };

      // Call API to create project
      const response = await api.createProject(projectData);
      
      toast.success('Project created successfully!');
      setShowProjectModal(false);
      
      // Reset form
      setNewProjectData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        type: 'project',
        status: 'active'
      });
      
      // Refresh calendar data
      fetchCalendarData();
      
      // Navigate to the new project if needed
      if (response.data?.id) {
        // navigate(`/projects/${response.data.id}`);
      }
      
    } catch (error: any) {
      console.error('Create project error:', error);
      toast.error(error.message || 'Failed to create project');
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Helper function to format date for input
  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Rest of your existing functions...
  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getEventsForDate = (day: number): CalendarEvent[] => {
    const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = currentDay.toISOString().split('T')[0];

    return events.filter(event => {
      const eventStart = event.start || event.date;
      const eventEnd = event.end;

      if (!eventStart) return false;

      const startDateStr = new Date(eventStart).toISOString().split('T')[0];
      const endDateStr = eventEnd ? new Date(eventEnd).toISOString().split('T')[0] : startDateStr;

      return dateStr === startDateStr || dateStr === endDateStr;
    });
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(clickedDate);
    if (onDateSelect) {
      onDateSelect(clickedDate);
    }
    
    // Show project creation modal if user has permission and date is not in the past
    if (canCreateProject) {
      const today = new Date();
        today.setHours(0, 0, 0, 0);
      clickedDate.setHours(0, 0, 0, 0);
      
      // Only open modal if clicked date is today or in the future
      if (clickedDate >= today) {
        const dateStr = clickedDate.toISOString().split('T')[0];
        setNewProjectData({
          ...newProjectData,
          start_date: dateStr,
          end_date: dateStr
        });
        setShowProjectModal(true);
      }
    }
  };

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const formatDateHeader = (): string => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'long', 
      year: 'numeric' 
    };
    
    if (viewType === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
      } else if (start.getFullYear() === end.getFullYear()) {
        return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} - ${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}, ${start.getFullYear()}`;
      } else {
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    }
    
    return currentDate.toLocaleDateString('en-US', options);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate);

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const getEventColor = (event: CalendarEvent): string => {
    return event.color || 
      (event.type === 'deadline' ? '#EA4335' :
       event.type === 'meeting' ? '#4285F4' :
       event.type === 'milestone' ? '#34A853' :
       event.type === 'review' ? '#FBBC05' : '#8E44AD');
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.project_id && canViewProjectCalendar) {
      navigate(`/projects/${event.project_id}`);
    } else if (!event.project_id && canViewOwnCalendar) {
      navigate(`/projects/${event.project_id}`);
    }
  };

  return (
    <>
      {!hasCalendarAccess ? null : (
        <div className="flex flex-col h-full bg-white">
          {/* Top Header */}
          <div className="border-b border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-8 w-8 text-blue-600" />
                    <span className="text-xl font-normal text-gray-900">Calendar</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Create Project Button */}
             
                <RefreshCw 
                  className="h-5 w-5 text-gray-600 cursor-pointer hover:rotate-180 transition-transform"
                  onClick={fetchCalendarData}
                />
              </div>
            </div>
          </div>

          {/* Main Calendar Area */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col p-6">
              {/* Calendar Controls */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToday}
                    className="border-gray-300 hover:bg-gray-50"
                  >
                    Today
                  </Button>
                  
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrevious}
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNext}
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <h2 className="text-xl font-normal text-gray-900 min-w-48">
                    {formatDateHeader()}
                  </h2>
                </div>

                {/* View Type Selector */}
                <div className="flex items-center gap-1 border border-gray-300 rounded-md p-0.5">
                  {(['month', 'week', 'day', 'agenda', ...(can('mails.view') ? ['mail'] : [])] as ViewType[]).map(view => (
                    <Button
                      key={view}
                      variant={viewType === view ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewType(view)}
                      className={`text-xs px-3 py-1 h-8 ${viewType === view ? 'bg-gray-100 shadow-sm' : ''}`}
                    >
                      {view === 'month' && <Grid className="h-3 w-3 mr-1" />}
                      {view === 'agenda' && <List className="h-3 w-3 mr-1" />}
                      {view === 'mail' && <MailIcon className="h-3 w-3 mr-1" />}
                      {view.charAt(0).toUpperCase() + view.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
                  {error}
                </div>
              )}

              {/* Calendar Grid - Month View */}
              {!isLoading && !error && viewType === 'month' && (
                <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div
                        key={day}
                        className="text-center font-normal text-xs text-gray-600 py-3 border-r border-gray-200 last:border-r-0 uppercase tracking-wide"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days Grid with Drag & Drop */}
                  <div className="grid grid-cols-7 auto-rows-fr">
                    {calendarDays.map((day, index) => {
                      const dayEvents = day ? getEventsForDate(day) : [];
                      const isToday =
                        day &&
                        day === new Date().getDate() &&
                        currentDate.getMonth() === new Date().getMonth() &&
                        currentDate.getFullYear() === new Date().getFullYear();
                      
                      const isSelected =
                        day &&
                        selectedDate &&
                        day === selectedDate.getDate() &&
                        currentDate.getMonth() === selectedDate.getMonth() &&
                        currentDate.getFullYear() === selectedDate.getFullYear();

                      const isDragOver = day && dragOverDate && 
                        day === dragOverDate.getDate() &&
                        currentDate.getMonth() === dragOverDate.getMonth() &&
                        currentDate.getFullYear() === dragOverDate.getFullYear();

                      const primaryEvent = dayEvents.length > 0 ? dayEvents[0] : null;
                      const cellBackgroundColor = primaryEvent ? getEventColor(primaryEvent) : undefined;

                      return (
                        <div
                          key={index}
                          className={`min-h-28 p-1.5 border-r border-b border-gray-200 last:border-r-0 cursor-pointer transition-all ${
                            day ? 'bg-white' : 'bg-gray-50'
                          } ${isToday && !primaryEvent ? 'bg-blue-50' : ''} 
                          ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
                          ${isDragOver ? 'ring-2 ring-green-500 ring-inset bg-green-50' : ''}`}
                          style={
                            primaryEvent && day
                              ? {
                                  backgroundColor: cellBackgroundColor,
                                  opacity: 0.85,
                                }
                              : undefined
                          }
                          onClick={() => day && handleDateClick(day)}
                          onDragOver={(e) => day && handleDragOver(day, e)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (day) handleDrop(day);
                          }}
                        >
                          {day && (
                            <div className="h-full flex flex-col">
                              {/* Date Header */}
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex gap-1">
                                  {primaryEvent && (
                                    <>
                                      {(() => {
                                        const eventStart = primaryEvent.start || primaryEvent.date;
                                        const eventEnd = primaryEvent.end;
                                        const startDateStr = new Date(eventStart).toISOString().split('T')[0];
                                        const endDateStr = eventEnd ? new Date(eventEnd).toISOString().split('T')[0] : startDateStr;
                                        const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
                                        
                                        return (
                                          <>
                                            {dateStr === startDateStr && <Badge className="text-xs">Start</Badge>}
                                            {dateStr === endDateStr && <Badge className="text-xs">End</Badge>}
                                          </>
                                        );
                                      })()}
                                    </>
                                  )}
                                </div>
                                <span
                                  className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-medium ${
                                    isToday && !primaryEvent
                                      ? 'bg-blue-600 text-white'
                                      : isSelected
                                      ? 'text-blue-600'
                                      : primaryEvent
                                      ? 'text-white font-bold'
                                      : 'text-gray-900'
                                  }`}
                                >
                                  {day}
                                </span>
                              </div>

                              {/* Events with Drag & Drop */}
                              <div className="space-y-0.5 flex-1 overflow-y-auto">
                                {dayEvents.slice(0, 4).map((event, idx) => (
                                  <div
                                    key={idx}
                                    className="text-xs px-2 py-1 rounded-sm truncate font-medium text-white cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{
                                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                      borderLeft: `3px solid rgba(255, 255, 255, 0.6)`
                                    }}
                                    title={`${event.title}${event.description ? ` - ${event.description}` : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEventClick(event);
                                    }}
                                    draggable
                                    onDragStart={(e) => handleDragStart(event, e)}
                                  >
                                    <div className="truncate">{event.title}</div>
                                    <div className="text-xs opacity-75">Drag to move</div>
                                  </div>
                                ))}
                                {dayEvents.length > 4 && (
                                  <div className="text-xs text-white px-1 font-medium">
                                    +{dayEvents.length - 4} more
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isLoading && !error && viewType === 'mail' && (
                <div className="flex-1 overflow-hidden">
                  <MailView />
                </div>
              )}

              {/* Other views (week, day, agenda, mail) remain the same */}
              {/* ... */}

            </div>
          </div>

          {/* Create Project Modal */}
          <Dialog open={showProjectModal} onOpenChange={setShowProjectModal}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project Name *</label>
                  <Input
                    placeholder="Enter project name"
                    value={newProjectData.name}
                    onChange={(e) => setNewProjectData({...newProjectData, name: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Enter project description"
                    value={newProjectData.description}
                    onChange={(e) => setNewProjectData({...newProjectData, description: e.target.value})}
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date *</label>
                    <Input
                      type="date"
                      value={newProjectData.start_date}
                      onChange={(e) => setNewProjectData({...newProjectData, start_date: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date *</label>
                    <Input
                      type="date"
                      value={newProjectData.end_date}
                      onChange={(e) => setNewProjectData({...newProjectData, end_date: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select
                      value={newProjectData.type}
                      onValueChange={(value) => setNewProjectData({...newProjectData, type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="project">Project</SelectItem>
                        <SelectItem value="task">Task</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="deadline">Deadline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select
                      value={newProjectData.status}
                      onValueChange={(value) => setNewProjectData({...newProjectData, status: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowProjectModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateProject}
                  disabled={isCreatingProject || !newProjectData.name.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isCreatingProject ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </>
  );
};

export default Calendar;
