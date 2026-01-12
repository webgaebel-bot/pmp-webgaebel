import React from 'react';
import { X } from 'lucide-react';
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
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageName = 'Image Preview',
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/80 backdrop-blur-sm" />
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] p-0 border-0 bg-transparent shadow-none overflow-hidden">
        <div className="relative">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute -top-12 right-0 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white z-50"
            aria-label="Close preview"
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Image */}
          <div className="flex items-center justify-center">
            <img
              src={imageUrl}
              alt={imageName}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Image name */}
          {imageName && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
              <p className="text-white text-sm text-center truncate">
                {imageName}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
