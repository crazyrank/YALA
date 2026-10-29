import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { portalLoginKey } from '../services/portalAccess';
import WebPageScreen from './WebPageScreen';

const RESULTS_PAGE = {
  title: 'Check Student Results',
  subtitle: 'Access student results through the external results system',
  url: 'https://yalav1.yalamatrixschools.com/dapp/view-student-results.php',
  allowedHosts: ['yalav1.yalamatrixschools.com'],
};

const ALLOWED_ROLES = new Set(['director', 'principal', 'head_teacher']);

export function canAccessResultPortal(role) {
  return ALLOWED_ROLES.has(role);
}

// Records an event on the server audit trail. Failure here must not block the page.
function recordEvent(event) {
  api.post('/results-portal/access', { event }).catch(() => {});
}

export default function ResultPortalScreen({ navigation }) {
  const { user } = useAuth();
  const allowed = canAccessResultPortal(user?.role);

  useEffect(() => {
    if (allowed) recordEvent('open');
  }, [allowed]);

  return (
    <WebPageScreen
      navigation={navigation}
      route={{
        params: {
          ...RESULTS_PAGE,
          accessDenied: !allowed,
          deniedMessage:
            'Only the Director, Principal, and Head Teachers can open the Check Student Results.',
          // One saved login per staff account on this phone.
          credentialsKey: user?.id ? portalLoginKey(user.id) : null,
          autoLogin: true,
          onAutoLogin: () => recordEvent('autologin'),
        },
      }}
    />
  );
}
