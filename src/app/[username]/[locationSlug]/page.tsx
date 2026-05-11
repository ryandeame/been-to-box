import BeenToBoxProfileLocationRoutePage from "@/components/been-to/BeenToBoxProfileLocationRoutePage";

type PageProps = {
  params: Promise<{
    locationSlug: string;
    username: string;
  }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { locationSlug, username } = await params;

  return {
    title: `${username} | ${locationSlug} | Been-To-Box`,
  };
}

export default async function ProfileLocationPage({ params }: PageProps) {
  const { locationSlug, username } = await params;

  return (
    <BeenToBoxProfileLocationRoutePage
      locationSlug={locationSlug}
      slug={username}
    />
  );
}
