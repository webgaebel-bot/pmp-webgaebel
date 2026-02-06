import React from 'react';
import { Send, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MailSidebarProps {
  onCompose: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  canSendMail: boolean;
}

export const MailSidebar: React.FC<MailSidebarProps> = ({
  onCompose,
  onRefresh,
  isRefreshing,
  canSendMail,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        {canSendMail && (
          <Button onClick={onCompose} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            Compose
          </Button>
        )}
      </div>

      <div className="px-4 pb-4">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

     
    </div>
  );
};
