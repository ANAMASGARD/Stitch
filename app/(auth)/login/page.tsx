import React, { Suspense } from 'react'
import LoginUI from '@/module/auth/components/login-ui'
import { requireUnAuth } from '@/module/auth/utils/auth-utils';

const LoginPageContent = async () => {
  await requireUnAuth();
  return (
    <div>
        <LoginUI />
    </div>
  )
}

const LoginPage = () => {
  return (
    <Suspense fallback={<div />}>
      <LoginPageContent />
    </Suspense>
  )
}

export default LoginPage