import BeenToBoxProfileRoutePage from "@/components/been-to/BeenToBoxProfileRoutePage";

type PageProps = {
  params: Promise<{
    username: string;
  }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { username } = await params;

  return {
    title: `${username} | Been-To-Box`,
    description: "Open a shared Been-To-Box travel profile.",
  };
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;

  return <BeenToBoxProfileRoutePage slug={username} />;
}
