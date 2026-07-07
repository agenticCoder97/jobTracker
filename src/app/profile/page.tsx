import { Suspense } from 'react';
import { ProfileView } from '@/components/profile/ProfileView';

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileView />
    </Suspense>
  );
}
