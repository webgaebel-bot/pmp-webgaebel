import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Lock,
  Bell,
  Shield,
  Camera,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import api, { IMAGE_BASE_URL } from '@/services/api';
import type { User as UserType } from '@/types';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [notifications, setNotifications] = useState({
    email_tasks: true,
    email_projects: true,
    email_mentions: true,
    browser_notifications: false,
  });

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const response: any = await api.getProfile();
      const data = response.data || response;
      setProfile({
        name: data?.name || '',
        email: data?.email || '',
        phone: data?.phone || '',
        bio: data?.bio || '',
      });
      // Handle both profile_image (new) and avatar (old) field names
      const imageUrl = data?.profile_image || data?.avatar;
      if (imageUrl) {
        setAvatarPreview(imageUrl.startsWith('http') ? imageUrl : `${IMAGE_BASE_URL}${imageUrl}`);
      } else if (user?.avatar) {
        setAvatarPreview(`${IMAGE_BASE_URL}${user.avatar}`);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      if (user) {
        setProfile({
          name: user.name,
          email: user.email,
          phone: '',
          bio: '',
        });
        if (user.avatar) {
          setAvatarPreview(`${IMAGE_BASE_URL}${user.avatar}`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Store file for later upload with profile update
    setSelectedAvatarFile(file);

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileUpdate = async () => {
    setIsSaving(true);
    try {
      // Create FormData for multipart request
      const formData = new FormData();
      formData.append('name', profile.name);
      formData.append('email', profile.email);
      formData.append('phone', profile.phone);
      formData.append('bio', profile.bio);
      
      // Add file if one was selected
      if (selectedAvatarFile) {
        formData.append('file', selectedAvatarFile);
      }
      
      // Call the profile update API with FormData
      const response: any = await api.updateProfile(formData);
      
      // Clear selected file after successful upload
      setSelectedAvatarFile(null);
      
      // Refetch profile to get updated data including profile_image
      await fetchProfile();
      
      toast({
        title: 'Profile Updated',
        description: response?.message || 'Your profile has been updated successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await api.changePassword(passwordData.currentPassword, passwordData.newPassword);
      toast({
        title: 'Password Changed',
        description: 'Your password has been changed successfully.',
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingPage text="Loading settings..." />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Settings"
        description="Manage your account settings and preferences"
        breadcrumbs={[{ label: 'Settings' }]}
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold mb-6">Personal Information</h3>
            
            {/* Avatar */}
            <div className="flex items-center gap-6 mb-8">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="bg-accent/20 text-accent text-2xl">
                    {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <button 
                  onClick={handleAvatarClick}
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 transition-colors"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div>
                <h4 className="font-medium">{user?.name}</h4>
                <p className="text-sm text-muted-foreground">{user?.role?.name || 'Team Member'}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={handleAvatarClick}
                >
                  {selectedAvatarFile ? 'Change Image (Pending)' : 'Change Avatar'}
                </Button>
              </div>
            </div>

            {/* Form */}
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="Enter your phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell us about yourself"
                  rows={4}
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handleProfileUpdate} disabled={isSaving} className="bg-accent hover:bg-accent/90">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold mb-6">Change Password</h3>
            
            <div className="grid gap-6 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handlePasswordChange} disabled={isSaving} className="bg-accent hover:bg-accent/90">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold mb-2">Sessions</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Manage your active sessions and sign out from other devices.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-4">
                  <Shield className="h-8 w-8 text-accent" />
                  <div>
                    <p className="font-medium">Current Session</p>
                    <p className="text-sm text-muted-foreground">Chrome on Windows • Active now</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => logout()}>
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold mb-6">Email Notifications</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Task Updates</p>
                  <p className="text-sm text-muted-foreground">
                    Receive emails when tasks are assigned or updated
                  </p>
                </div>
                <Switch
                  checked={notifications.email_tasks}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, email_tasks: checked })}
                  className="data-[state=checked]:bg-accent"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Project Updates</p>
                  <p className="text-sm text-muted-foreground">
                    Receive emails for project milestones and deadlines
                  </p>
                </div>
                <Switch
                  checked={notifications.email_projects}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, email_projects: checked })}
                  className="data-[state=checked]:bg-accent"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Mentions</p>
                  <p className="text-sm text-muted-foreground">
                    Receive emails when someone mentions you
                  </p>
                </div>
                <Switch
                  checked={notifications.email_mentions}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, email_mentions: checked })}
                  className="data-[state=checked]:bg-accent"
                />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6 shadow-card">
            <h3 className="text-lg font-semibold mb-6">Browser Notifications</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Browser Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive real-time notifications in your browser
                </p>
              </div>
              <Switch
                checked={notifications.browser_notifications}
                onCheckedChange={(checked) => setNotifications({ ...notifications, browser_notifications: checked })}
                className="data-[state=checked]:bg-accent"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
