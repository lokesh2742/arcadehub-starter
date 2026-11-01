# ArcadeHub Friends, Usernames and Online Invitations

## Username is the Friend ID

ArcadeHub no longer creates a separate random Friend ID. Each Google account receives one stable, unique username based on the first name in its Google display name plus a numeric suffix (for example, `lokesh4077`). Usernames use only lowercase letters and numbers so they are valid Realtime Database keys. Players can change their username from the Friends panel; it remains unchanged across devices and sign-ins until they change it again. Username search is case-insensitive. This avoids collisions when multiple players have the same display name. The username is stable across devices because it is stored against the Firebase Authentication UID.

Database paths:
- `playerDirectory/{username}`: searchable public username card (UID, display name, username only).
- `playerUsernames/{uid}`: the account's username mapping.
- `presence/{uid}`: live online/offline status.
- `friends/{uid}/{friendUid}`: accepted friend list.
- `friendRequests/{recipientUid}/{senderUid}`: incoming friend requests.
- `gameInvites/{recipientUid}/{inviteId}`: game invitations.
- `rooms/{roomCode}`: Tic Tac Toe / Memory Match room data.

## Firebase Realtime Database rules

Open Firebase Console → Realtime Database → Rules. Preserve the existing room validation and add narrowly scoped permissions for the new paths. Do not use unrestricted public read/write rules.

The app needs authenticated access to:
1. Read a username directory entry by exact username; create a directory entry only when its `uid` matches `auth.uid`.
2. Read/write only the caller's `playerUsernames/{auth.uid}` mapping.
3. Write/read the caller's `presence/{auth.uid}` record and read friend presence records.
4. Read the caller's friend list; create reciprocal friend entries as part of accepting an incoming request.
5. Read incoming requests/invites addressed to the caller; send a request/invite only with the caller's UID as sender.
6. Preserve existing game-room permissions and validate membership for both players.

Suggested validation:
- Directory username must match the path and directory `uid` must equal `auth.uid` on creation.
- Presence writes must be restricted to `presence/{auth.uid}`.
- A friend request's sender UID must equal `auth.uid`.
- An invitation's sender UID must equal `auth.uid`; recipient is the path owner.
- Never publish email addresses or private account information in the directory or presence records.

**Important:** GitHub Pages cannot publish Firebase security rules. If the rules do not permit these paths, search, friend requests, presence or invitations will fail with a Firebase permission error. The app intentionally does not weaken your database security.

## How it works

1. Deploy the site and hard-refresh (Ctrl + Shift + R).
2. Sign in with Google on each device.
3. Open Friends and share the displayed `@username`; search using the exact username and send a request.
4. The other player accepts the request in Inbox.
5. A player must be signed in with ArcadeHub open to appear Online.
6. In Tic Tac Toe → Online Room or Memory Match → Custom Room, use **Invite an online friend**. Offline friends cannot be invited. Accepting an invite launches the game automatically on both devices.

Only Tic Tac Toe and Memory Match currently support direct invitations. Chess, Battleship and Pool are still coming soon.

## Required rule for cross-device username search

The username search reads the exact path `playerDirectory/{username}`. If the directory is not readable to signed-in users, search on the other device will fail even though the username appears on the account that created it. Add the following child under the existing root `rules` object in Realtime Database Rules (merge it with your existing rules; do not replace your existing `rooms` rules):

```json
"playerDirectory": {
  ".read": "auth != null",
  "$username": {
    ".write": "auth != null && !data.exists() && newData.child('uid').val() === auth.uid && newData.child('username').val() === $username"
  }
}
```

Also make sure the existing rules allow each signed-in user to read/write only their own `playerUsernames/{uid}` mapping. The app repairs a missing directory entry on sign-in, so after publishing the rule, both players should sign out and sign back in once, then search using the username without the `@` (the search box also accepts it).

If search still returns a Firebase `PERMISSION_DENIED` error, the remaining issue is in the database rules for `playerDirectory` or `friendRequests`, not the displayed username. Never enable unrestricted public database read/write.
