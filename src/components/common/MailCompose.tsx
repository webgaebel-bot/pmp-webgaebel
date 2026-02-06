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

interface User {
    id: string | number;
    name?: string;
    email: string;
}

interface MailComposeProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    composeData?: ComposeData;
    setComposeData: (data: ComposeData) => void;
    attachments?: File[]; // Make optional
    onAttachmentChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    removeAttachment: (index: number) => void;
    isSending: boolean;
    onSend: () => Promise<void>;
    suggestions?: User[]; // Make optional
    showSuggestions: boolean;
    isLoadingSuggestions: boolean;
    onToChange: (value: string) => Promise<void>;
    onSelectSuggestion: (user: User) => void;
}

export const MailCompose: React.FC<MailComposeProps> = ({
    isOpen,
    onOpenChange,
    composeData,
    setComposeData,
    attachments,
    onAttachmentChange,
    removeAttachment,
    isSending,
    onSend,
    suggestions,
    showSuggestions,
    isLoadingSuggestions,
    onToChange,
    onSelectSuggestion,
}) => {
    // Provide default values if composeData is undefined
    const safeComposeData = composeData || {
        to: '',
        subject: '',
        body: '',
        recipients: []
    };

    // Provide default value for attachments
    const safeAttachments = attachments || [];
    
    // Provide default value for suggestions
    const safeSuggestions = suggestions || [];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Compose Email</DialogTitle>
                    <DialogDescription>
                        Send a new email to one or more recipients
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="to">To *</Label>
                        <Input
                            id="to"
                            type="email"
                            value={safeComposeData.to}
                            onChange={(e) => onToChange(e.target.value)}
                            placeholder="Enter email address"
                            autoComplete="off"
                        />
                        {showSuggestions && safeSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-background shadow-lg z-50">
                                {safeSuggestions.map((user) => (
                                    <button
                                        key={user.id || user.email}
                                        className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
                                        onClick={() => onSelectSuggestion(user)}
                                        type="button"
                                    >
                                        <div className="flex flex-col">
                                            <p className="font-medium text-sm">{user.name || 'Unknown'}</p>
                                            <p className="text-xs text-muted-foreground">{user.email}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="subject">Subject *</Label>
                        <Input
                            id="subject"
                            value={safeComposeData.subject}
                            onChange={(e) => setComposeData({ 
                                ...safeComposeData, 
                                subject: e.target.value 
                            })}
                            placeholder="Email subject"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="body">Message *</Label>
                        <Textarea
                            id="body"
                            value={safeComposeData.body}
                            onChange={(e) => setComposeData({ 
                                ...safeComposeData, 
                                body: e.target.value 
                            })}
                            placeholder="Write your message here..."
                            rows={10}
                            className="min-h-[200px] resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Attachments</Label>
                        <div className="flex items-center gap-2">
                            <input
                                id="attachments"
                                type="file"
                                multiple
                                onChange={onAttachmentChange}
                                className="hidden"
                            />
                            <Button
                                variant="outline"
                                onClick={() => document.getElementById('attachments')?.click()}
                            >
                                <Paperclip className="h-4 w-4 mr-2" />
                                Add Attachments
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                {safeAttachments.length} file{safeAttachments.length !== 1 ? 's' : ''} attached
                            </span>
                        </div>

                        {safeAttachments.length > 0 && (
                            <div className="space-y-2">
                                {safeAttachments.map((file, index) => (
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
                                Send Email
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};