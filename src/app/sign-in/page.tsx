import { Suspense } from "react";

import AuthPage from "@/components/auth/AuthPage";

export default function SignInPage() {
  return (
    <Suspense>
      <AuthPage mode="sign-in" />
    </Suspense>
  );
}
