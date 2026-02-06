import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@/components/ui/dialog';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName?: string;
  onDownload?: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageName = 'Image Preview',
  onDownload,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/50 backdrop-blur-sm" />
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] p-0 border-0 bg-background shadow-lg overflow-hidden rounded-lg">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">{imageName}</h2>
              <p className="text-sm text-muted-foreground mt-1">Image Preview</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(imageUrl, '_blank')}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Open in new tab"
                title="Open in new tab"
              >
                <ExternalLink className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Close preview"
              >

              </Button>
            </div>
          </div>

          {/* Image Container */}
          <div className="flex-1 flex items-center justify-center p-6 bg-muted/10 overflow-auto min-h-[400px]">
            <img
              src={imageUrl}
              alt={imageName}
              className="max-w-[85%] max-h-[70vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Click image to view full size
            </p>
            <div className="flex gap-3">
              {onDownload && (
                <Button
                  onClick={onDownload}
                  className="bg-accent hover:bg-accent/90 rounded-md"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

