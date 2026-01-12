import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, MessageSquare, ArrowLeft, Building2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ContactAdmin: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>

        <Card className="shadow-lg border-border">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
              <Building2 className="h-8 w-8 text-accent" />
            </div>
            <CardTitle className="text-2xl">Contact Your Administrator</CardTitle>
            <CardDescription className="text-base">
              Need help with your account? Reach out to your system administrator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {/* Contact Options */}
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20">
                  <Mail className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">Email Support</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Send an email to your IT administrator
                  </p>
                  <a 
                    href="mailto:admin@company.com" 
                    className="text-sm text-accent hover:underline"
                  >
                    admin@company.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20">
                  <Phone className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">Phone Support</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Call during business hours
                  </p>
                  <a 
                    href="tel:+1234567890" 
                    className="text-sm text-accent hover:underline"
                  >
                    +1 (234) 567-890
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20">
                  <MessageSquare className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">Help Desk Ticket</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Submit a support ticket for tracking
                  </p>
                  <Button variant="outline" size="sm" className="mt-1">
                    Open Ticket
                  </Button>
                </div>
              </div>
            </div>

            {/* Business Hours */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div className="text-sm">
                <span className="font-medium">Business Hours:</span>
                <span className="text-muted-foreground ml-2">Mon - Fri, 9:00 AM - 6:00 PM</span>
              </div>
            </div>

            {/* Back to Login */}
            <div className="pt-2">
              <Button 
                onClick={() => navigate('/login')} 
                className="w-full bg-accent hover:bg-accent/90"
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          For urgent issues outside business hours, please email with "URGENT" in the subject line.
        </p>
      </div>
    </div>
  );
};

export default ContactAdmin;