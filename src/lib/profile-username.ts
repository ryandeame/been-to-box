import type { User } from "firebase/auth";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";

export async function claimUsernameForUser(user: User, username: string) {
  const userRef = doc(db, "users", user.uid);
  const usernameRef = doc(db, "usernames", username);
  const publicProfileRef = doc(db, "publicProfiles", username);

  await runTransaction(db, async (transaction) => {
    const [userSnapshot, usernameSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(usernameRef),
    ]);
    const claimedByUid = usernameSnapshot.exists()
      ? usernameSnapshot.data()?.uid
      : null;

    if (claimedByUid && claimedByUid !== user.uid) {
      throw new Error("That username is already taken.");
    }

    const previousUsername = userSnapshot.exists()
      ? userSnapshot.data()?.username
      : null;

    if (
      typeof previousUsername === "string" &&
      previousUsername &&
      previousUsername !== username
    ) {
      transaction.delete(doc(db, "usernames", previousUsername));
    }

    transaction.set(
      usernameRef,
      {
        displayName: user.displayName ?? "",
        photoURL: user.photoURL ?? "",
        uid: user.uid,
        updatedAt: serverTimestamp(),
        username,
      },
      { merge: true },
    );
    transaction.set(
      userRef,
      {
        displayName: user.displayName ?? "",
        email: user.email ?? "",
        photoURL: user.photoURL ?? "",
        uid: user.uid,
        updatedAt: serverTimestamp(),
        username,
        usernameUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    transaction.set(
      publicProfileRef,
      {
        displayName: user.displayName ?? username,
        photoURL: user.photoURL ?? "",
        uid: user.uid,
        updatedAt: serverTimestamp(),
        username,
      },
      { merge: true },
    );
  });

  return username;
}
