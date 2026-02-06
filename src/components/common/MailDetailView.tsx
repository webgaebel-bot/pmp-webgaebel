import React, { useState } from 'react';
import { X, Download, FileText, Paperclip, Trash2, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

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
  subject: string;
  body: string;
  created_at?: string;
  is_read?: boolean;
  attachments?: MailAttachment[];
  replies?: MailReplyItem[];
  replies_count?: number;
}

interface MailDetailProps {
  selectedMail: MailItem;
  onBack: () => void;
  onDelete: (mailId: string) => Promise<void>;
  onSendReply: (body: string) => Promise<void>;
  onPreviewImage: (url: string) => void;
  canDelete: boolean;
  canReply: boolean;
  getFileUrl: (filePath: string) => string;
}

export const MailDetail: React.FC<MailDetailProps> = ({
  selectedMail,
  onBack,
  onDelete,
  onSendReply,
  onPreviewImage,
  canDelete,
  canReply,
  getFileUrl,
}) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM d, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  const handleDownload = (attachment: MailAttachment) => {
    const fileUrl = getFileUrl(attachment.file_path);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = attachment.original_name;
    link.click();
  };

  const handleSendReply = async () => {
    if (!replyBody.trim()) return;

    setIsSending(true);
    try {
      await onSendReply(replyBody);
      setReplyBody('');
      setShowReplyInput(false);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollArea className="w-full h-full">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-card px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="font-semibold text-lg truncate">{selectedMail.subject}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onBack} className="ml-2">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Mail Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Sender Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selectedMail.from || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{selectedMail.fromEmail}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(selectedMail.created_at)}
                </span>
              </div>
              {selectedMail.to && (
                <p className="text-sm text-muted-foreground">
                  To: {selectedMail.to}
                </p>
              )}
            </div>

            <div className="border-t" />

            {/* Mail Body */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-6">
                {selectedMail.body}
              </div>
            </div>

            {/* Attachments */}
            {selectedMail.attachments && selectedMail.attachments.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">
                    Attachments ({selectedMail.attachments.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {selectedMail.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg border hover:border-primary transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {attachment.original_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.file_size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isImage(attachment.mime_type) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPreviewImage(getFileUrl(attachment.file_path))}
                          >
                            Preview
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(attachment)}
                          className="h-8 w-8"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Replies */}
            {selectedMail.replies && selectedMail.replies.length > 0 && (
              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-sm">Replies</h3>
                <div className="space-y-4">
                  {selectedMail.replies.map((reply) => (
                    <div key={reply.id} className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{reply.sender_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {reply.sender_email}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(reply.created_at)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reply Input Section */}
            {canReply && (
              <div className="border-t pt-4 space-y-3">
                {!showReplyInput ? (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setShowReplyInput(true)}
                  >
                    <span>Reply</span>
                  </Button>
                ) : (
                  <div className="space-y-3 bg-muted/50 p-4 rounded-lg border">
                    <h3 className="font-semibold text-sm">Write a Reply</h3>
                    <Textarea
                      placeholder="Type your reply..."
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={4}
                      className="min-h-[100px] resize-none"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowReplyInput(false);
                          setReplyBody('');
                        }}
                        disabled={isSending}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSendReply}
                        disabled={isSending || !replyBody.trim()}
                        className="gap-2"
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 border-t bg-card px-6 py-4 flex items-center justify-between gap-2">
          <div />
          <div className="flex items-center gap-2">
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(selectedMail.id)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
