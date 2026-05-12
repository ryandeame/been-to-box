import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";

export async function resolveCurrentProfileHref(userId: string) {
  const profileSnapshot = await getDoc(doc(db, "users", userId));
  const profileUsername = profileSnapshot.data()?.username;

  if (typeof profileUsername === "string" && profileUsername.length > 0) {
    return `/${profileUsername}`;
  }

  const usernameSnapshot = await getDocs(
    query(collection(db, "usernames"), where("uid", "==", userId), limit(1)),
  );
  const usernameDoc = usernameSnapshot.docs[0];

  if (usernameDoc) {
    return `/${usernameDoc.id}`;
  }

  const publicProfileSnapshot = await getDocs(
    query(collection(db, "publicProfiles"), where("uid", "==", userId), limit(1)),
  );
  const publicProfileDoc = publicProfileSnapshot.docs[0];

  if (publicProfileDoc) {
    return `/${publicProfileDoc.id}`;
  }

  return "/sign-up";
}
