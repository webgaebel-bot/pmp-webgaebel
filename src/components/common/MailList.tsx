import React, { useMemo, useState } from 'react';
import { MoreVertical, Star, Trash2, Paperclip, MailIcon, Loader2, Archive } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MailItem {
  id: string;
  thread_id?: number | string | null;
  from?: string;
  to?: string;
  recipients?: string;
  subject: string;
  body: string;
  preview?: string;
  created_at?: string;
  is_read?: boolean;
  is_deleted?: boolean;
  has_attachments?: boolean;
  attachments_count?: number;
  replies_count?: number;
}

interface MailListProps {
  mails: MailItem[];
  isLoading: boolean;
  selectedMail: MailItem | null;
  searchQuery: string;
  view: 'inbox' | 'sent' | 'all';
  onSelectMail: (mail: MailItem) => void;
  onDeleteMail: (mailId: string) => Promise<void>;
  canDelete: boolean;
  onStarMail?: (mailId: string) => Promise<void>;
}

export const MailList: React.FC<MailListProps> = ({
  mails,
  isLoading,
  selectedMail,
  searchQuery,
  view,
  onSelectMail,
  onDeleteMail,
  canDelete,
  onStarMail,
}) => {
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const query = (searchQuery || '').toLowerCase().trim();

  // Optimized filtering with memoization
  const filteredMails = useMemo(() => {
    if (!query) return mails;

    return mails.filter((mail) => {
      if (!mail.subject && !mail.from && !mail.to && !mail.recipients && !mail.preview && !mail.body) {
        return false;
      }

      const searchFields = [
        mail.subject || '',
        mail.from || '',
        mail.to || '',
        mail.recipients || '',
        mail.preview || '',
        mail.body || '',
      ]
        .join(' ')
        .toLowerCase();

      return searchFields.includes(query);
    });
  }, [mails, query]);

  // Format date intelligently
  const formatMailDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isToday(date)) return format(date, 'HH:mm');
      if (isYesterday(date)) return 'Yesterday';
      return format(date, 'MMM d');
    } catch {
      return '';
    }
  };

  // Handle delete with loading state
  const handleDeleteMail = async (e: React.MouseEvent, mailId: string) => {
    e.stopPropagation();
    setIsDeletingId(mailId);
    try {
      await onDeleteMail(mailId);
    } catch (error) {
      console.error('Failed to delete mail:', error);
    } finally {
      setIsDeletingId(null);
    }
  };

  // Handle star with error handling
  const handleStarMail = async (e: React.MouseEvent, mailId: string) => {
    e.stopPropagation();
    if (onStarMail) {
      try {
        await onStarMail(mailId);
      } catch (error) {
        console.error('Failed to star mail:', error);
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-background overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-card flex items-center justify-between">
        <h2 className="font-semibold text-sm text-foreground">
          {filteredMails.length} {filteredMails.length === 1 ? 'email' : 'emails'}
        </h2>
        {searchQuery && (
          <span className="text-xs text-muted-foreground">
            Searching: "{searchQuery}"
          </span>
        )}
      </div>

      {/* Mail List Container */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredMails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground">
            <MailIcon className="h-12 w-12 mb-4 opacity-30" />
            <p className="font-medium text-foreground">No emails found</p>
            <p className="text-sm mt-1">
              {searchQuery
                ? 'Try a different search query'
                : view === 'sent'
                ? "You haven't sent any emails yet"
                : view === 'all'
                ? 'No emails in the system'
                : 'Your inbox is empty'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredMails.map((mail, index) => {
              const isUnread = !mail.is_read && view === 'inbox';
              const isActive = selectedMail?.id === mail.id;
              const deleteKey = String(mail.thread_id ?? mail.id);
              const isDeleting = isDeletingId === deleteKey;
              const sender = view === 'sent' ? (mail.recipients || mail.to) : mail.from;
              const formattedDate = formatMailDate(mail.created_at);

              return (
                <div
                  key={mail.id || `mail-${index}`}
                  onClick={() => !isDeleting && onSelectMail(mail)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isDeleting) {
                      onSelectMail(mail);
                    }
                  }}
                  className={[
                    'group px-3 py-2 min-h-14',
                    'flex items-center gap-3',
                    'cursor-pointer transition-all duration-150',
                    'border-l-2',
                    isActive
                      ? 'bg-muted border-l-primary'
                      : 'border-l-transparent hover:bg-muted/50',
                    isUnread
                      ? 'bg-blue-50/50 dark:bg-blue-950/10'
                      : '',
                    isDeleting ? 'opacity-50 pointer-events-none' : '',
                  ].join(' ')}
                  aria-selected={isActive}
                >
                  {/* Star Button */}
                  <button
                    type="button"
                    onClick={(e) => handleStarMail(e, deleteKey)}
                    disabled={isDeleting}
                    className="flex-shrink-0 flex items-center justify-center text-muted-foreground hover:text-yellow-500 transition-colors disabled:opacity-50"
                    aria-label={`Star ${mail.subject}`}
                  >
                    <Star className="h-4 w-4" />
                  </button>

                  {/* Sender Info */}
                  <div className="flex-shrink-0 min-w-32">
                    <p
                      className={`truncate text-sm leading-tight ${
                        isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                      }`}
                      title={sender || 'Unknown'}
                    >
                      {sender || 'Unknown'}
                    </p>
                  </div>

                  {/* Subject and Preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p
                        className={`truncate text-sm leading-tight ${
                          isUnread ? 'font-semibold text-foreground' : 'text-foreground'
                        }`}
                        title={mail.subject}
                      >
                        {mail.subject || '(No subject)'}
                      </p>

                      {mail.has_attachments && (
                        <Paperclip
                          className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0"
                          aria-label="Has attachments"
                        />
                      )}
                    </div>

                    <p className="truncate text-xs text-muted-foreground leading-tight">
                      {mail.preview || mail.body?.slice(0, 100) || '(No preview)'}
                    </p>
                  </div>

                  {/* Date and Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                    <span
                      className={`text-xs whitespace-nowrap min-w-fit ${
                        isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {formattedDate}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={isDeleting}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={(e) => handleStarMail(e, deleteKey)}>
                          <Star className="h-4 w-4 mr-2" />
                          Star
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {canDelete && (
                          <>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => handleDeleteMail(e, deleteKey)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {isDeleting ? 'Deleting...' : 'Delete'}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
