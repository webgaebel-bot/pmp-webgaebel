import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail as MailIcon,
  Send,
  Search,
  Loader2,
  Menu,
  Inbox,
  Send as SentIcon,
  Users,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { usePermission } from '@/hooks/usePermission';
import api, { IMAGE_BASE_URL } from '@/services/api';
import {
  initSocket,
  joinUserRoom,
  leaveUserRoom,
  disconnectSocket,
  onNewMail,
  onMailReply,
  onMailDeleted,
} from '@/services/socket';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { MailSidebar } from './MailSidebar';
import { MailList } from './MailList';
import { MailDetail } from './MailDetail';  // Updated with reply functionality
import { MailCompose } from './MailCompose';
import { MailReply } from './MailReply';

// Types
interface MailAttachment {
  id: number;
  original_name: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
}

interface MailReplyItem {
  id: number;
  body: string;
  created_at: string;
  sender_id: number;
  sender_name: string;
  sender_email?: string;
}

interface MailItem {
  id: string;
  from?: string;
  fromEmail?: string;
  to?: string;
  recipients?: string;
  recipient_name?: string;
  subject: string;
  body: string;
  preview?: string;
  created_at?: string;
  is_read?: boolean;
  is_deleted?: boolean;
  is_starred?: boolean;
  has_attachments?: boolean;
  attachments_count?: number;
  attachments?: MailAttachment[];
  threadId?: string;
  thread_id?: number | null;
  sender_id?: number;
  sender_name?: string;
  sender_email?: string;
  sender_deleted?: number;
  replies_count?: number;
  replies?: MailReplyItem[];
}

type MailView = 'inbox' | 'sent' | 'all';

const Mail: React.FC = () => {
  const { toast } = useToast();
  const { can } = usePermission();

  const [view, setView] = useState<MailView>('inbox');
  const [mails, setMails] = useState<MailItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMail, setSelectedMail] = useState<MailItem | null>(null);

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'messages' | 'all'>('messages');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compose state
  const [composeData, setComposeData] = useState({
    to: '',
    subject: '',
    body: '',
    recipients: [] as (string | number)[],
  });
  const [composeAttachments, setComposeAttachments] = useState<File[]>([]);
  const [isComposeSending, setIsComposeSending] = useState(false);
  const [showComposeSuggestions, setShowComposeSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [composeSuggestions, setComposeSuggestions] = useState<any[]>([]);

  // Reply compose state (for full reply modal if needed)
  const [replyComposeData, setReplyComposeData] = useState({
    to: '',
    subject: '',
    body: '',
    recipients: [] as (string | number)[],
  });
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const [isReplySending, setIsReplySending] = useState(false);

  // Permission check
  if (!can('mails.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <MailIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Access Denied</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You don't have permission to access the mail system
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch Inbox
  const fetchInbox = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.getInbox();
      const mailsData = response?.data || response || [];

      const normalized = Array.isArray(mailsData)
        ? mailsData.map((mail: any, idx: number) => {
          const isRead = mail.is_read === 1 || mail.is_read === true;
          const isDeleted = mail.is_deleted === 1 || mail.is_deleted === true;

          // Use thread_id as primary ID for thread-based grouping
          const mailId = mail.thread_id || mail.id || mail.threadId || `mail-${Date.now()}-${idx}`;

          return {
            id: String(mailId),
            thread_id: mail.thread_id ?? null,
            from: mail.sender_name || mail.sender_email || 'Unknown',
            fromEmail: mail.sender_email || '',
            to: mail.recipients || '',
            recipients: mail.recipients || '',
            subject: mail.subject || 'No Subject',
            body: mail.preview || mail.content || mail.body || '',
            preview: mail.preview || (mail.body ? mail.body.substring(0, 120) + '...' : ''),
            created_at: mail.created_at || mail.last_reply_at,
            is_read: isRead,
            is_deleted: isDeleted,
            has_attachments: (mail.attachments_count || 0) > 0,
            attachments_count: mail.attachments_count || 0,
            attachments: mail.attachments || [],
            sender_id: mail.sender_id,
            sender_name: mail.sender_name,
            sender_email: mail.sender_email,
            replies_count: mail.replies_count || 0,
            replies: mail.replies || [],
          } as MailItem;
        })
        : [];

      setMails(normalized);
    } catch (error) {
      console.error('Failed to fetch inbox:', error);
      toast({ title: 'Error', description: 'Failed to load inbox', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch Sent
  const fetchSentMails = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.getSentMails();
      const mailsData = response?.data || response || [];

      const normalized = Array.isArray(mailsData)
        ? mailsData.map((mail: any, idx: number) => {
          const isDeleted = mail.is_deleted === 1 || mail.is_deleted === true;

          // Use thread_id as primary ID for thread-based grouping
          const mailId = mail.thread_id || mail.id || `mail-${Date.now()}-${idx}`;

          return {
            id: String(mailId),
            thread_id: mail.thread_id ?? null,
            from: 'You',
            to: mail.recipients || 'Unknown',
            recipients: mail.recipients || '',
            subject: mail.subject || 'No Subject',
            body: mail.content || mail.body || '',
            preview: mail.preview || (mail.content ? mail.content.substring(0, 120) + '...' : ''),
            created_at: mail.created_at || mail.last_reply_at,
            is_read: true,
            is_deleted: isDeleted,
            has_attachments: (mail.attachments_count || 0) > 0,
            attachments_count: mail.attachments_count || 0,
            attachments: mail.attachments || [],
            replies_count: mail.replies_count || 0,
            replies: mail.replies || [],
          } as MailItem;
        })
        : [];

      setMails(normalized);
    } catch (error) {
      console.error('Failed to fetch sent mails:', error);
      toast({ title: 'Error', description: 'Failed to load sent mails', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch All
  const fetchAllMails = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.getAllMails();
      const threadsData = response?.data || response || [];

      const normalized = Array.isArray(threadsData)
        ? threadsData.flatMap((thread: any, threadIdx: number) => {
          return (thread.mails || []).map((mail: any, mailIdx: number) => {
            const firstRecipient = mail.recipients?.[0] || {};
            const isDeleted = mail.sender_deleted === 1 || firstRecipient.is_deleted === 1;

            // Use thread_id as primary ID for thread-based grouping
            const mailId = mail.thread_id || mail.id || `mail-${Date.now()}-${threadIdx}-${mailIdx}`;

            return {
              id: String(mailId),
              thread_id: mail.thread_id ?? null,
              from: mail.sender_name || 'Unknown',
              fromEmail: mail.sender_email || '',
              to: firstRecipient.recipient_name || 'Unknown',
              recipients: firstRecipient.recipient_name || '',
              recipient_name: firstRecipient.recipient_name || '',
              subject: mail.subject || 'No Subject',
              body: mail.body || '',
              preview: mail.body ? mail.body.substring(0, 120) + '...' : '',
              created_at: mail.created_at,
              is_read: firstRecipient.is_read === 1,
              is_deleted: isDeleted,
              sender_deleted: mail.sender_deleted,
              has_attachments: Array.isArray(mail.attachments) && mail.attachments.length > 0,
              attachments_count: mail.attachments?.length || 0,
              attachments: mail.attachments || [],
              sender_id: mail.sender_id,
              sender_name: mail.sender_name,
              sender_email: mail.sender_email,
              replies_count: mail.replies_count || 0,
              replies: mail.replies || [],
            } as MailItem;
          });
        })
        : [];

      setMails(normalized);
    } catch (error) {
      console.error('Failed to fetch all mails:', error);
      toast({ title: 'Error', description: 'Failed to load all mails', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch on view change
  useEffect(() => {
    if (view === 'inbox') fetchInbox();
    else if (view === 'sent') fetchSentMails();
    else fetchAllMails();
  }, [view, fetchInbox, fetchSentMails, fetchAllMails]);

  // Socket
  useEffect(() => {
    const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    if (!userId) return;

    initSocket();
    joinUserRoom(userId);

    const unsubNew = onNewMail(() => {
      if (view === 'inbox') fetchInbox();
    });

    const unsubReply = onMailReply(() => {
      if (view === 'inbox') fetchInbox();
    });

    const unsubDeleted = onMailDeleted((deletedData: any) => {
      setMails((prev) => prev.filter((m) => m.id !== String(deletedData.mail_id)));
      if (selectedMail?.id === String(deletedData.mail_id)) setSelectedMail(null);
    });

    return () => {
      unsubNew();
      unsubReply();
      unsubDeleted();
      leaveUserRoom(userId);
      disconnectSocket();
    };
  }, [view, fetchInbox, selectedMail?.id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (view === 'inbox') await fetchInbox();
    else if (view === 'sent') await fetchSentMails();
    else await fetchAllMails();
    setIsRefreshing(false);
  };

  const handleSelectMail = async (mail: MailItem) => {
    try {
      // Set immediately with the normalized data we already have (which includes replies)
      setSelectedMail(mail);

      // If we already have replies from the list view, we can skip the detail call
      // Or fetch more details if needed using thread_id
      const mailDetailId = String(mail.thread_id || mail.id);

      if (mailDetailId && mail.thread_id) {
        // Fetch additional details using thread_id if available
        try {
          const response = await api.getMailDetail(mailDetailId);
          const detailData = response?.data || response;

          if (detailData) {
            let recipientsStr = '';
            if (detailData.recipients) {
              if (Array.isArray(detailData.recipients)) {
                recipientsStr = detailData.recipients
                  .map((r: any) => r.email || r.name || '')
                  .filter((x: string) => x)
                  .join(', ');
              } else {
                recipientsStr = detailData.recipients;
              }
            }

            const isRead = detailData.is_read === 1 || detailData.is_read === true;
            const isDeleted = detailData.is_deleted === 1 || detailData.is_deleted === true;

            const enriched: MailItem = {
              ...mail,
              id: String(detailData.id || mail.id),
              thread_id: detailData.thread_id || mail.thread_id,
              from: detailData.sender_name || detailData.from || mail.from || 'Unknown',
              fromEmail: detailData.sender_email || detailData.fromEmail || mail.fromEmail || '',
              to: recipientsStr || mail.to || '',
              recipients: recipientsStr || mail.recipients || '',
              subject: detailData.subject || mail.subject,
              body: detailData.body || detailData.content || mail.body,
              created_at: detailData.created_at || mail.created_at,
              is_read: isRead,
              is_deleted: isDeleted,
              attachments: detailData.attachments || [],
              replies: detailData.replies || mail.replies || [],
              replies_count: detailData.replies_count || (detailData.replies?.length || 0),
              attachments_count: detailData.attachments_count || (detailData.attachments?.length || 0),
              has_attachments: (detailData.attachments?.length || 0) > 0,
            };

            setSelectedMail(enriched);
          }
        } catch (detailError) {
          // If detail fetch fails, just use the mail we already have which includes replies
          console.log('Detail fetch failed, using list data:', detailError);
        }
      }

      if (!mail.is_read && view === 'inbox') {
        await api.markMailAsRead(mail.id);
        setMails((prev) => prev.map((m) => (m.id === mail.id ? { ...m, is_read: true } : m)));
      }
    } catch (error) {
      console.error('Failed to fetch mail details:', error);
      toast({ title: 'Error', description: 'Failed to load mail details', variant: 'destructive' });
    }
  };

  const handleDeleteMail = async (mailId: string) => {
    if (!can('mails.delete')) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to delete emails',
        variant: 'destructive',
      });
      return;
    }

    try {
      await api.deleteMail(mailId);
      setMails((prev) => prev.filter((m) => m.id !== mailId));
      if (selectedMail?.id === mailId) setSelectedMail(null);
      toast({ title: 'Success', description: 'Mail deleted successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete mail', variant: 'destructive' });
    }
  };

  // Compose attachments
  const handleComposeAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setComposeAttachments((prev) => [...prev, ...files]);
  };

  const removeComposeAttachment = (index: number) => {
    setComposeAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleComposeToChange = async (value: string) => {
    setComposeData((prev) => ({ ...prev, to: value }));
    if (value.length > 0) {
      setIsLoadingSuggestions(true);
      try {
        const response: any = await api.getUsers();
        const usersData = response?.data || response || [];
        const filteredUsers = (Array.isArray(usersData) ? usersData : []).filter((user: any) =>
          user.email?.toLowerCase().includes(value.toLowerCase()) ||
          user.name?.toLowerCase().includes(value.toLowerCase())
        );
        setComposeSuggestions(filteredUsers.slice(0, 5));
        setShowComposeSuggestions(filteredUsers.length > 0);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setComposeSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    } else {
      setComposeSuggestions([]);
      setShowComposeSuggestions(false);
    }
  };

  const handleComposeSelectSuggestion = (user: any) => {
    setComposeData((prev) => ({
      ...prev,
      to: user.email,
      recipients: [user.id],
    }));
    setShowComposeSuggestions(false);
  };

  const handleSendCompose = async () => {
    if (!composeData.to || !composeData.subject || !composeData.body) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setIsComposeSending(true);
    try {
      // Prepare the payload
      const mailPayload: any = {
        recipients: composeData.recipients.length > 0 ? composeData.recipients : [composeData.to], // Use recipients array if available, else fallback to 'to' string
        subject: composeData.subject,
        body: composeData.body,
      };

      // If there are attachments, use FormData
      if (composeAttachments.length > 0) {
        const formData = new FormData();
        formData.append('recipients', JSON.stringify(mailPayload.recipients));
        formData.append('subject', mailPayload.subject);
        formData.append('body', mailPayload.body);
        composeAttachments.forEach((file) => {
          formData.append('attachments', file);
        });
        await api.sendMail(formData);
      } else {
        // Send as JSON (no attachments)
        await api.sendMail(mailPayload);
      }

      toast({ title: 'Success', description: 'Mail sent successfully' });
      setIsComposeOpen(false);
      setComposeData({ to: '', subject: '', body: '', recipients: [] });
      setComposeAttachments([]);
      if (view === 'sent') await fetchSentMails();
    } catch (error: any) {
      console.error('Send mail error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to send mail', variant: 'destructive' });
    } finally {
      setIsComposeSending(false);
    }
  };

  // Reply attachments (if using full reply modal)
  const handleReplyAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setReplyAttachments((prev) => [...prev, ...files]);
  };

  const removeReplyAttachment = (index: number) => {
    setReplyAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendReply = async (body: string) => {
    if (!selectedMail) return;
    setIsReplySending(true);

    try {
      // Use thread_id from selectedMail
      const threadId = selectedMail.thread_id || selectedMail.id;
      await api.replyMail(threadId.toString(), { body });

      toast({ title: 'Success', description: 'Reply sent successfully' });
      // Refresh the current view to show the new reply
      if (view === 'inbox') await fetchInbox();
      else if (view === 'sent') await fetchSentMails();
      else await fetchAllMails();
    } catch (error: any) {
      console.error('Reply error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to send reply', variant: 'destructive' });
    } finally {
      setIsReplySending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-80 border-r flex-col">
        <MailSidebar
          onCompose={() => setIsComposeOpen(true)}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          canSendMail={can('mails.send')}
        />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-80">
          <MailSidebar
            onCompose={() => {
              setIsComposeOpen(true);
              setIsMobileSidebarOpen(false);
            }}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            canSendMail={can('mails.send')}
          />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            const v = val as 'messages' | 'all';
            setActiveTab(v);
            setSelectedMail(null);

            if (v === 'all' && can('view_all_mails')) setView('all');
            else setView('inbox');
          }}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* Top bar */}
          <div className="border-b bg-card">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="md:hidden">
                  <Button variant="ghost" size="icon" onClick={() => setIsMobileSidebarOpen(true)}>
                    <Menu className="h-5 w-5" />
                  </Button>
                </div>

                <TabsList className="grid w-fit grid-cols-2">
                  <TabsTrigger value="messages" className="gap-2">
                    <MailIcon className="h-4 w-4" />
                    Messages
                  </TabsTrigger>
                  {can('view_all_mails') && (
                    <TabsTrigger value="all" className="gap-2">
                      <Users className="h-4 w-4" />
                      All Mails
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search emails..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[220px] lg:w-[320px]"
                  />
                </div>

                <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
                  {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <TabsContent value="messages" className="flex-1 overflow-hidden border-0">
            <div className="border-b px-4 py-3 bg-card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant={view === 'inbox' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setView('inbox');
                      setSelectedMail(null);
                    }}
                    className="gap-2"
                  >
                    <Inbox className="h-4 w-4" />
                    Inbox
                  </Button>
                  <Button
                    variant={view === 'sent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setView('sent');
                      setSelectedMail(null);
                    }}
                    className="gap-2"
                  >
                    <SentIcon className="h-4 w-4" />
                    Sent
                  </Button>
                </div>

                <div className="relative md:hidden w-[170px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Mail List - Full Width */}
            <div className="flex-1 overflow-hidden">
              <MailList
                mails={mails}
                selectedMail={selectedMail}
                isLoading={isLoading}
                view={view}
                searchQuery={searchQuery}
                onSelectMail={handleSelectMail}
                onDeleteMail={handleDeleteMail}
                canDelete={can('mails.delete')}
              />
            </div>

            {/* Mail Detail - Wider Sheet */}
            <Sheet open={!!selectedMail} onOpenChange={(open) => !open && setSelectedMail(null)}>
              <SheetContent side="right" className="w-full sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[75vw] xl:max-w-[70vw] p-0">
                {selectedMail && (
                  <MailDetail
                    selectedMail={selectedMail}
                    onBack={() => setSelectedMail(null)}
                    onDelete={handleDeleteMail}
                    onReply={() => setIsReplying(true)}
                    onSendReply={handleSendReply}
                    onPreviewImage={setPreviewImage}
                    canDelete={can('mails.delete')}
                    canReply={can('mails.send')}
                    getFileUrl={(filePath) => `${IMAGE_BASE_URL}${filePath}`}
                  />
                )}
              </SheetContent>
            </Sheet>
          </TabsContent>

          {can('view_all_mails') && (
            <TabsContent value="all" className="flex-1 overflow-hidden border-0">
              {/* Mail List - Full Width */}
              <div className="flex-1 overflow-hidden">
                <MailList
                  mails={mails}
                  selectedMail={selectedMail}
                  isLoading={isLoading}
                  view={view}
                  searchQuery={searchQuery}
                  onSelectMail={handleSelectMail}
                  onDeleteMail={handleDeleteMail}
                  canDelete={can('mails.delete')}
                />
              </div>

              {/* Mail Detail - Wider Sheet */}
              <Sheet open={!!selectedMail} onOpenChange={(open) => !open && setSelectedMail(null)}>
                <SheetContent side="right" className="w-full sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[75vw] xl:max-w-[70vw] p-0">
                  {selectedMail && (
                    <MailDetail
                      selectedMail={selectedMail}
                      onBack={() => setSelectedMail(null)}
                      onDelete={handleDeleteMail}
                      onReply={() => setIsReplying(true)}
                      onSendReply={handleSendReply}
                      onPreviewImage={setPreviewImage}
                      canDelete={can('mails.delete')}
                      canReply={can('mails.send')}
                      getFileUrl={(filePath) => `${IMAGE_BASE_URL}${filePath}`}
                    />
                  )}
                </SheetContent>
              </Sheet>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Compose */}
      <MailCompose
        isOpen={isComposeOpen}
        onOpenChange={setIsComposeOpen}
        composeData={composeData}
        setComposeData={setComposeData}
        attachments={composeAttachments}
        onAttachmentChange={handleComposeAttachmentChange}
        removeAttachment={removeComposeAttachment}
        isSending={isComposeSending}
        onSend={handleSendCompose}
        suggestions={composeSuggestions}
        showSuggestions={showComposeSuggestions}
        isLoadingSuggestions={isLoadingSuggestions}
        onToChange={handleComposeToChange}
        onSelectSuggestion={handleComposeSelectSuggestion}
      />

      {/* Reply (Full Modal - if needed) */}
      {selectedMail && (
        <MailReply
          isOpen={isReplying}
          onOpenChange={setIsReplying}
          composeData={replyComposeData}
          setComposeData={setReplyComposeData}
          replyAttachments={replyAttachments}
          onAttachmentChange={handleReplyAttachmentChange}
          removeAttachment={removeReplyAttachment}
          isSending={isReplySending}
          onSend={async () => {
            await handleSendReply(replyComposeData.body);
            setIsReplying(false);
            setReplyComposeData({ to: '', subject: '', body: '', recipients: [] });
            setReplyAttachments([]);
          }}
          selectedMailSubject={selectedMail.subject}
          selectedMailFrom={selectedMail.from || selectedMail.sender_email || 'Unknown'}
        />
      )}

      {/* Image Preview */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {previewImage && (
            <img src={previewImage} alt="Preview" className="w-full h-auto max-h-[80vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mail;
