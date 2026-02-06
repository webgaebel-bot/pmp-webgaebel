import React from 'react';
import { Send, Loader2, Paperclip, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';

interface ComposeData {
    to: string;
    subject: string;
    body: string;
    recipients: (string | number)[];
}

interface MailReplyProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    composeData: ComposeData;
    setComposeData: (data: ComposeData) => void;
    replyAttachments: File[];
    onAttachmentChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    removeAttachment: (index: number) => void;
    isSending: boolean;
    onSend: () => Promise<void>;
    selectedMailSubject?: string;
    selectedMailFrom?: string;
}

export const MailReply: React.FC<MailReplyProps> = ({
    isOpen,
    onOpenChange,
    composeData,
    setComposeData,
    replyAttachments,
    onAttachmentChange,
    removeAttachment,
    isSending,
    onSend,
    selectedMailSubject = '',
    selectedMailFrom = '',
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Reply to Email</DialogTitle>
                    <DialogDescription>
                        Reply to: {selectedMailSubject}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>To</Label>
                        <Input
                            value={selectedMailFrom}
                            disabled
                            className="bg-muted"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input
                            value={`Re: ${selectedMailSubject}`}
                            disabled
                            className="bg-muted"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="reply-body">Message *</Label>
                        <Textarea
                            id="reply-body"
                            value={composeData.body}
                            onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                            placeholder="Type your reply..."
                            rows={8}
                            className="min-h-[150px] resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Attachments</Label>
                        <div className="flex items-center gap-2">
                            <input
                                id="reply-attachments"
                                type="file"
                                multiple
                                onChange={onAttachmentChange}
                                className="hidden"
                            />
                            <Button
                                variant="outline"
                                onClick={() => document.getElementById('reply-attachments')?.click()}
                            >
                                <Paperclip className="h-4 w-4 mr-2" />
                                Add Attachments
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                {replyAttachments.length} file{replyAttachments.length !== 1 ? 's' : ''} attached
                            </span>
                        </div>

                        {replyAttachments.length > 0 && (
                            <div className="space-y-2">
                                {replyAttachments.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <p className="text-sm truncate">{file.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {(file.size / 1024).toFixed(2)} KB
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeAttachment(index)}
                                            className="h-8 w-8 p-0"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            onOpenChange(false);
                            setComposeData({ to: '', subject: '', body: '', recipients: [] });
                        }}
                        disabled={isSending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onSend}
                        disabled={isSending}
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
                                Send Reply
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
