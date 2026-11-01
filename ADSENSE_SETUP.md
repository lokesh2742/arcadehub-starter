# ArcadeHub advertising readiness

## Current status

- Google AdSense is planned but is **not installed or active**.
- The homepage contains two reserved placement containers: `home-top` and `home-footer`.
- Both containers use the HTML `hidden` attribute, so they do not display and take up no layout space.
- No AdSense JavaScript, publisher ID, ad unit ID, consent-management platform, or `ads.txt` file has been added.
- No advertisements should appear inside game screens, multiplayer rooms, or near game controls.

## Before enabling ads

1. Publish the site on the intended GitHub Pages URL and confirm the site works on desktop and mobile.
2. Review the current AdSense eligibility requirements and programme policies. Approval is not guaranteed; Google reviews the site and account.
3. The AdSense account holder must meet Google's age requirement. If the site operator is under 18, a parent or legal guardian must own and manage the account and payments, in accordance with Google's current rules.
4. Complete the site's publisher/contact information and review the Privacy Policy and Terms for the actual operator and data practices.
5. Decide whether analytics or advertising cookies/identifiers will be used. Implement an appropriate consent-management solution and obtain any consent required by applicable law and Google policy before loading advertising technologies. Do not assume that hiding an ad container is a substitute for consent.
6. Once approved, add Google's exact AdSense script and publisher details as supplied in the AdSense account. Do not copy a publisher ID from another site.
7. Add the exact `ads.txt` line supplied by Google to the repository root, if AdSense requests it.
8. Update the Privacy Policy to describe the actual ad technology, data sharing, cookies/identifiers, user choices and contact route. Publish a clear way for users to manage applicable consent choices.
9. Test placements on phone and desktop. Ads must be clearly distinguishable from game content and navigation, must not cause accidental clicks, and must never obstruct gameplay or controls.

## Placement guidance

- `home-top`: reserved for a responsive placement between the hero and game library.
- `home-footer`: reserved for a placement below the game library and above the closing banner.
- Do not enable either placement until approval, policy review and any required consent setup are complete.
- Do not put ads in the Tic Tac Toe or Memory Match game screens, room creation/joining flows, or anywhere that could be mistaken for a game control.
- Never click your own ads, ask others to click them, or reward users for ad clicks.

## Official Google resources

- [AdSense eligibility requirements](https://support.google.com/adsense/answer/9724)
- [AdSense programme policies](https://support.google.com/adsense/answer/48182)
- [Ad placement policies](https://support.google.com/adsense/answer/1346295)
- [Get started with AdSense](https://www.google.com/adsense/start/)

This checklist is a project note, not legal or tax advice. Re-check Google's current requirements before applying or enabling ads.
