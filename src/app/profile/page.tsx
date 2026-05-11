import type { Metadata } from "next";

import ProfileUsernamePage from "@/components/auth/ProfileUsernamePage";

export const metadata: Metadata = {
  title: "Profile | Ryan Deame",
  description: "Claim a shareable Been-To-Box profile username.",
};

export default function ProfilePage() {
  return <ProfileUsernamePage />;
}
