import { Suspense } from "react";

import AuthPage from "@/components/auth/AuthPage";

export default function SignUpPage() {
  return (
    <Suspense>
      <AuthPage mode="sign-up" />
    </Suspense>
  );
}
