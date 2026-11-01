# ArcadeHub Friends and Game Invitations — Firebase setup

The friends feature uses the existing Firebase Authentication user ID and Realtime Database.

## What the feature stores

- `playerDirectory/{friendCode}`: a public, searchable player card (display name, Friend ID and Firebase UID).
- `playerCodes/{uid}`: the signed-in player's own Friend ID mapping.
- `friends/{uid}/{friendUid}`: a friend-list entry.
- `friendRequests/{recipientUid}/{senderUid}`: incoming friend requests.
- `gameInvites/{recipientUid}/{inviteId}`: incoming game invitations and their status.
- `rooms/{roomCode}`: the same Tic Tac Toe / Memory Match room data used by the games.

Friend IDs are randomly generated 8-character codes. Searching is an exact code lookup, not a browse-all-players directory.

## Required Realtime Database access

Open Firebase Console → Realtime Database → Rules. The database must allow authenticated players to:

1. Read a player-directory entry by its Friend ID and create their own directory entry.
2. Read/write their own Friend ID mapping.
3. Read their own friend list; add a reciprocal friend entry only when accepting a request.
4. Read incoming requests and invites; send requests/invites to another user's inbox; accept or decline items addressed to them.
5. Create/read/update the game rooms they participate in.

**Do not switch the database to unrestricted public read/write just to make this work.** The exact rules depend on the rules already protecting your Tic Tac Toe and Memory Match rooms. Preserve those room protections and add narrowly scoped rules for the paths above. In particular, validate that a directory entry's `uid` matches `auth.uid`, that a friend request's sender matches `auth.uid`, and that an invitation's sender matches `auth.uid`. Public directory reads expose only the player's display name, Friend ID and UID; do not put email addresses or private account data there.

The app cannot publish Firebase security rules through GitHub Pages. If the database currently uses locked rules, friend search and inbox writes will show a Firebase permission error until the rules are updated.

## First-time use

1. Deploy the website update to GitHub Pages and hard-refresh (Ctrl + Shift + R).
2. Sign in with Google.
3. Open **Friends**. Your Friend ID is generated automatically; copy and share it.
4. Use **Find players** to search for a friend's exact 8-character ID.
5. The recipient accepts the request in **Inbox**. Once connected, either player can send a Tic Tac Toe or Memory Match invitation from the friend list.
6. The accepting player creates the room in the background. Both players are routed into the game without entering a room code.

## Current scope

Direct invitations are wired for the two online games currently implemented: Tic Tac Toe and Memory Match. Chess, Battleship and Pool remain coming-soon placeholders. This first version's inbox handles friend requests and game invitations; it is structured so future notification types can be added.
