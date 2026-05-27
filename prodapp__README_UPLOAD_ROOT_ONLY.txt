TCG MACHINES DASHBOARD — v15 RECHECKED CLEAN PACKAGE

UPLOAD RULE:
1. Unzip this ZIP.
2. Open the unzipped folder.
3. Upload EVERYTHING INSIDE the folder to the root of the GitHub repo.
4. Do not upload the ZIP itself.
5. Make sure prodapp__prodapp__index.html is visible at the top level of the repo.
6. Wait for GitHub Actions to finish with a green checkmark.
7. Open the Azure URL with ?v=15 at the end.

Example:
https://your-azure-site.azurestaticapps.net/?v=15

TEMPORARY PASSCODE:
TCG9000

WHAT WAS FIXED IN v15:
- All button audio was removed.
- The main dashboard no longer says audio-ready or preview copy at the top.
- The wizard, logo, and cog button art are embedded directly into prodapp__prodapp__index.html, so the main dashboard should not show blue missing-image boxes even if extra image files are not uploaded.
- prodapp__prodapp__index.html now has a proper browser title: TCG Machines Production Dashboard.
- prodapp__prodapp__index.html is the real dashboard page. The passcode is only an overlay, not a separate empty page.
- prodapp__prodapp__service-worker.js clears old caches to prevent old broken versions from sticking on iPhone.
- Scanner, Chassis, Inventory, Pre Testing, Testing, and Shipping / Receiving pages are included.
- Placeholder pages are included for Conveyor, Prod Team Weekly Schedule, and Company Policy & Employee Forms.

IMPORTANT IPHONE CACHE NOTE:
If your phone still shows an old broken version, open Settings > Safari > Advanced > Website Data, search the Azure site, delete the site data, then reopen the Azure URL with ?v=15.
